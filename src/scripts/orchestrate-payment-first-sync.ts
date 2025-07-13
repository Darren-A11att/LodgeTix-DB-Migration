import 'dotenv/config';
import { execSync } from 'child_process';
import { connectMongoDB } from '../connections/mongodb';
import { Collection } from 'mongodb';

// Handle BigInt serialization
// @ts-ignore
BigInt.prototype.toJSON = function() {
  return this.toString();
};

interface Registration {
  _id?: any;
  registrationId: string;
  confirmationNumber: string;
  paymentStatus: string;
  stripePaymentIntentId?: string;
  squarePaymentId?: string;
  totalAmountPaid?: number;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

interface Payment {
  _id?: any;
  paymentId: string;
  transactionId: string;
  status: string;
  grossAmount: number;
  source: 'square' | 'stripe';
  timestamp: Date;
  [key: string]: any;
}

interface PendingImport extends Registration {
  pendingSince: Date;
  attemptedPaymentIds: string[];
  lastCheckDate: Date;
  checkCount: number;
  reason: string;
}

class PaymentFirstOrchestrator {
  private registrationsCollection!: Collection<Registration>;
  private paymentsCollection!: Collection<Payment>;
  private pendingImportsCollection!: Collection<PendingImport>;
  private failedRegistrationsCollection!: Collection<any>;
  
  async initialize() {
    const connection = await connectMongoDB();
    this.registrationsCollection = connection.db.collection<Registration>('registrations');
    this.paymentsCollection = connection.db.collection<Payment>('payments');
    this.pendingImportsCollection = connection.db.collection<PendingImport>('pending-imports');
    this.failedRegistrationsCollection = connection.db.collection('failedRegistrations');
    
    // Create indexes
    await this.createIndexes();
  }
  
  private async createIndexes() {
    // Create indexes with error handling
    const indexes = [
      { collection: this.registrationsCollection, index: { confirmationNumber: 1 } },
      { collection: this.registrationsCollection, index: { squarePaymentId: 1 } },
      { collection: this.registrationsCollection, index: { stripePaymentIntentId: 1 } },
      { collection: this.paymentsCollection, index: { paymentId: 1 } },
      { collection: this.paymentsCollection, index: { source: 1, status: 1 } },
      { collection: this.pendingImportsCollection, index: { confirmationNumber: 1 } },
      { collection: this.pendingImportsCollection, index: { pendingSince: 1 } },
      { collection: this.pendingImportsCollection, index: { squarePaymentId: 1 } },
      { collection: this.pendingImportsCollection, index: { stripePaymentIntentId: 1 } }
    ];
    
    for (const { collection, index } of indexes) {
      try {
        await collection.createIndex(index);
      } catch (e) {
        // Index already exists
      }
    }
  }
  
  // Step 1: Import ALL payments first (Square and Stripe)
  async importAllPayments() {
    console.log('\n💳 Step 1: Importing ALL payments (Square & Stripe)...');
    
    try {
      // Import Square payments
      console.log('\n  📱 Importing Square payments...');
      execSync('npx tsx src/scripts/sync-square-payments.ts', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      // Import Stripe payments if script exists
      console.log('\n  💳 Checking for Stripe payment import script...');
      const stripeScriptPath = 'src/scripts/sync-stripe-payments.ts';
      const fs = require('fs');
      
      if (fs.existsSync(stripeScriptPath)) {
        console.log('  Running Stripe payment import...');
        execSync(`npx tsx ${stripeScriptPath}`, {
          stdio: 'inherit',
          cwd: process.cwd()
        });
      } else {
        console.log('  ℹ️  No Stripe payment sync script found. Assuming Stripe payments are already imported.');
      }
      
      // Show payment statistics
      const squareCount = await this.paymentsCollection.countDocuments({ source: 'square' });
      const stripeCount = await this.paymentsCollection.countDocuments({ source: 'stripe' });
      
      console.log(`\n✅ Payment import completed:`);
      console.log(`   - Square payments: ${squareCount}`);
      console.log(`   - Stripe payments: ${stripeCount}`);
      console.log(`   - Total payments: ${squareCount + stripeCount}`);
      
    } catch (error) {
      console.error('❌ Failed to import payments:', error);
      throw error;
    }
  }
  
  // Step 2: Import registrations WITH payment validation
  async importRegistrationsWithPaymentCheck() {
    console.log('\n📥 Step 2: Importing registrations (only those with valid payments)...');
    
    // First, run the Supabase sync to get all registrations into a temporary collection
    console.log('\n  🔄 Fetching registrations from Supabase...');
    
    // We'll modify the sync script to return data instead of directly inserting
    // For now, let's process existing registrations and pending-imports
    
    await this.processSupabaseRegistrations();
  }
  
  private async processSupabaseRegistrations() {
    // Get the Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!
    );
    
    // Fetch recent registrations from Supabase
    const { data: registrations, error } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100); // Process in batches
    
    if (error) {
      console.error('Error fetching from Supabase:', error);
      return;
    }
    
    console.log(`\n  📊 Processing ${registrations.length} registrations from Supabase...`);
    
    let imported = 0;
    let pending = 0;
    let skipped = 0;
    
    for (const reg of registrations) {
      // Map Supabase fields to MongoDB structure
      const mongoRegistration: Registration = {
        registrationId: reg.id || reg.registration_id,
        confirmationNumber: reg.confirmation_number,
        registrationType: reg.registration_type,
        paymentStatus: reg.payment_status,
        stripePaymentIntentId: reg.stripe_payment_intent_id,
        squarePaymentId: reg.square_payment_id,
        totalAmountPaid: reg.total_amount_paid,
        createdAt: new Date(reg.created_at),
        updatedAt: new Date(reg.updated_at),
        ...reg
      };
      
      // Check if already exists in registrations or pending-imports
      const existsInMain = await this.registrationsCollection.findOne({
        confirmationNumber: mongoRegistration.confirmationNumber
      });
      
      if (existsInMain) {
        skipped++;
        continue;
      }
      
      const existsInPending = await this.pendingImportsCollection.findOne({
        confirmationNumber: mongoRegistration.confirmationNumber
      });
      
      // Check for matching payment
      const hasValidPayment = await this.checkForValidPayment(mongoRegistration);
      
      if (hasValidPayment) {
        // Import to main registrations collection
        await this.registrationsCollection.insertOne({
          ...mongoRegistration,
          importedAt: new Date(),
          paymentVerified: true
        });
        
        // Remove from pending if it was there
        if (existsInPending) {
          await this.pendingImportsCollection.deleteOne({ _id: existsInPending._id });
        }
        
        imported++;
        console.log(`  ✅ Imported: ${mongoRegistration.confirmationNumber} (payment verified)`);
      } else {
        // Add to pending-imports collection
        if (!existsInPending) {
          const pendingImport: PendingImport = {
            ...mongoRegistration,
            pendingSince: new Date(),
            attemptedPaymentIds: [
              mongoRegistration.squarePaymentId,
              mongoRegistration.stripePaymentIntentId
            ].filter(Boolean) as string[],
            lastCheckDate: new Date(),
            checkCount: 1,
            reason: this.getNoPaymentReason(mongoRegistration)
          };
          
          await this.pendingImportsCollection.insertOne(pendingImport);
          pending++;
          console.log(`  ⏳ Pending: ${mongoRegistration.confirmationNumber} (${pendingImport.reason})`);
        }
      }
    }
    
    console.log(`\n  📊 Registration processing summary:`);
    console.log(`     - Imported to main collection: ${imported}`);
    console.log(`     - Added to pending-imports: ${pending}`);
    console.log(`     - Skipped (already exists): ${skipped}`);
  }
  
  private async checkForValidPayment(registration: Registration): Promise<boolean> {
    // Check Square payment
    if (registration.squarePaymentId) {
      const squarePayment = await this.paymentsCollection.findOne({
        paymentId: registration.squarePaymentId,
        source: 'square',
        status: { $in: ['paid', 'completed'] }
      });
      
      if (squarePayment) {
        return true;
      }
    }
    
    // Check Stripe payment
    if (registration.stripePaymentIntentId) {
      const stripePayment = await this.paymentsCollection.findOne({
        paymentId: registration.stripePaymentIntentId,
        source: 'stripe',
        status: { $in: ['paid', 'succeeded'] }
      });
      
      if (stripePayment) {
        return true;
      }
    }
    
    return false;
  }
  
  private getNoPaymentReason(registration: Registration): string {
    if (!registration.squarePaymentId && !registration.stripePaymentIntentId) {
      return 'No payment ID provided';
    }
    
    const reasons = [];
    if (registration.squarePaymentId) {
      reasons.push('Square payment not found or not completed');
    }
    if (registration.stripePaymentIntentId) {
      reasons.push('Stripe payment not found or not completed');
    }
    
    return reasons.join('; ');
  }
  
  // Step 3: Process pending imports
  async processPendingImports() {
    console.log('\n🔄 Step 3: Processing pending imports...');
    
    const pendingImports = await this.pendingImportsCollection.find({
      checkCount: { $lt: 5 } // Don't recheck too many times
    }).toArray();
    
    console.log(`\n  Found ${pendingImports.length} pending imports to check`);
    
    let resolved = 0;
    let stillPending = 0;
    let failed = 0;
    
    for (const pending of pendingImports) {
      const hasValidPayment = await this.checkForValidPayment(pending);
      
      if (hasValidPayment) {
        // Move to main registrations collection
        const { _id, pendingSince, attemptedPaymentIds, lastCheckDate, checkCount, reason, ...registration } = pending;
        
        await this.registrationsCollection.insertOne({
          ...registration,
          importedAt: new Date(),
          paymentVerified: true,
          previouslyPendingSince: pendingSince
        });
        
        await this.pendingImportsCollection.deleteOne({ _id });
        
        resolved++;
        console.log(`  ✅ Resolved: ${pending.confirmationNumber} - payment now found`);
      } else {
        // Update check count and date
        await this.pendingImportsCollection.updateOne(
          { _id: pending._id },
          {
            $set: {
              lastCheckDate: new Date(),
              reason: this.getNoPaymentReason(pending)
            },
            $inc: { checkCount: 1 }
          }
        );
        
        // If checked too many times, move to failed
        if (pending.checkCount >= 4) {
          await this.failedRegistrationsCollection.insertOne({
            ...pending,
            failureReason: 'Payment not found after multiple attempts',
            failedAt: new Date()
          });
          
          await this.pendingImportsCollection.deleteOne({ _id: pending._id });
          failed++;
          console.log(`  ❌ Failed: ${pending.confirmationNumber} - exceeded retry limit`);
        } else {
          stillPending++;
        }
      }
    }
    
    console.log(`\n  📊 Pending imports processing summary:`);
    console.log(`     - Resolved (payment found): ${resolved}`);
    console.log(`     - Still pending: ${stillPending}`);
    console.log(`     - Moved to failed: ${failed}`);
  }
  
  // Step 4: Generate comprehensive report
  async generateReport() {
    console.log('\n📊 Step 4: Generating comprehensive report...\n');
    
    const totalRegistrations = await this.registrationsCollection.countDocuments();
    const paidRegistrations = await this.registrationsCollection.countDocuments({ 
      paymentStatus: { $in: ['paid', 'completed'] } 
    });
    const pendingImports = await this.pendingImportsCollection.countDocuments();
    const failedRegistrations = await this.failedRegistrationsCollection.countDocuments();
    
    const totalPayments = await this.paymentsCollection.countDocuments();
    const squarePayments = await this.paymentsCollection.countDocuments({ source: 'square' });
    const stripePayments = await this.paymentsCollection.countDocuments({ source: 'stripe' });
    
    console.log('=' .repeat(70));
    console.log('PAYMENT-FIRST SYNC REPORT');
    console.log('=' .repeat(70));
    
    console.log('\nPayments:');
    console.log(`  Total: ${totalPayments}`);
    console.log(`  Square: ${squarePayments}`);
    console.log(`  Stripe: ${stripePayments}`);
    
    console.log('\nRegistrations:');
    console.log(`  Verified & Imported: ${totalRegistrations}`);
    console.log(`  Paid Status: ${paidRegistrations}`);
    console.log(`  Pending Import: ${pendingImports} (awaiting payment verification)`);
    console.log(`  Failed: ${failedRegistrations}`);
    
    // Show sample pending imports
    if (pendingImports > 0) {
      console.log('\nSample Pending Imports:');
      const samples = await this.pendingImportsCollection.find().limit(5).toArray();
      
      for (const sample of samples) {
        console.log(`\n  ${sample.confirmationNumber}:`);
        console.log(`    Amount: $${sample.totalAmountPaid || 0}`);
        console.log(`    Reason: ${sample.reason}`);
        console.log(`    Pending since: ${sample.pendingSince.toLocaleDateString()}`);
        console.log(`    Check count: ${sample.checkCount}`);
        if (sample.squarePaymentId) {
          console.log(`    Square ID: ${sample.squarePaymentId}`);
        }
        if (sample.stripePaymentIntentId) {
          console.log(`    Stripe ID: ${sample.stripePaymentIntentId}`);
        }
      }
    }
    
    console.log('\n' + '=' .repeat(70));
  }
  
  // Main orchestration
  async orchestrate() {
    try {
      await this.initialize();
      
      console.log('🚀 Starting payment-first sync orchestration...\n');
      
      // Step 1: Import all payments
      await this.importAllPayments();
      
      // Step 2: Import registrations with payment validation
      await this.importRegistrationsWithPaymentCheck();
      
      // Step 3: Process any existing pending imports
      await this.processPendingImports();
      
      // Step 4: Generate report
      await this.generateReport();
      
      console.log('\n✅ Payment-first sync orchestration completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Orchestration failed:', error);
      throw error;
    }
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx tsx orchestrate-payment-first-sync.ts [options]

Options:
  --process-pending   Only process pending imports (skip new imports)
  --report-only       Generate report without making changes
  --help              Show this help message

This script orchestrates a payment-first sync process:
1. Imports all payments from Square and Stripe
2. Imports registrations ONLY if they have valid payments
3. Stores registrations without payments in pending-imports collection
4. Processes pending imports to check for newly arrived payments
5. Generates a comprehensive report
    `);
    process.exit(0);
  }
  
  const orchestrator = new PaymentFirstOrchestrator();
  
  if (args.includes('--process-pending')) {
    console.log('🔄 Processing pending imports only...\n');
    await orchestrator.initialize();
    await orchestrator.processPendingImports();
    await orchestrator.generateReport();
  } else if (args.includes('--report-only')) {
    console.log('📊 Generating report only...\n');
    await orchestrator.initialize();
    await orchestrator.generateReport();
  } else {
    await orchestrator.orchestrate();
  }
}

// Run the orchestration
main().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});