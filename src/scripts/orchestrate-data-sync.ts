import 'dotenv/config';
import { execSync } from 'child_process';
import { connectMongoDB } from '../connections/mongodb';
import { Collection } from 'mongodb';
import { SquareClient, SquareEnvironment } from 'square';

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

interface FailedRegistration extends Registration {
  failureReason: string;
  failedAt: Date;
  attemptedPaymentId?: string;
  validationErrors: string[];
}

class DataSyncOrchestrator {
  private registrationsCollection!: Collection<Registration>;
  private paymentsCollection!: Collection<Payment>;
  private failedRegistrationsCollection!: Collection<FailedRegistration>;
  private squareClient: SquareClient;
  
  constructor() {
    this.squareClient = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: SquareEnvironment.Production
    });
  }
  
  async initialize() {
    const connection = await connectMongoDB();
    this.registrationsCollection = connection.db.collection<Registration>('registrations');
    this.paymentsCollection = connection.db.collection<Payment>('payments');
    this.failedRegistrationsCollection = connection.db.collection<FailedRegistration>('failedRegistrations');
    
    // Create indexes (wrapped in try-catch to handle existing indexes)
    try {
      await this.registrationsCollection.createIndex({ confirmationNumber: 1 });
    } catch (e) { /* Index already exists */ }
    
    try {
      await this.registrationsCollection.createIndex({ squarePaymentId: 1 });
    } catch (e) { /* Index already exists */ }
    
    try {
      await this.registrationsCollection.createIndex({ stripePaymentIntentId: 1 });
    } catch (e) { /* Index already exists */ }
    
    try {
      await this.paymentsCollection.createIndex({ paymentId: 1 });
    } catch (e) { /* Index already exists */ }
    
    try {
      await this.paymentsCollection.createIndex({ source: 1, status: 1 });
    } catch (e) { /* Index already exists */ }
    
    try {
      await this.failedRegistrationsCollection.createIndex({ confirmationNumber: 1 });
    } catch (e) { /* Index already exists */ }
  }
  
  // Step 1: Import recent registrations from Supabase
  async importRegistrationsFromSupabase() {
    console.log('\n📥 Step 1: Importing recent registrations from Supabase...');
    
    try {
      // Run the sync script
      execSync('node scripts/sync-supabase-registrations.js', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      console.log('✅ Registration import completed');
    } catch (error) {
      console.error('❌ Failed to import registrations:', error);
      throw error;
    }
  }
  
  // Step 2: Import payments from Square API
  async importPaymentsFromSquare() {
    console.log('\n💳 Step 2: Importing payments from Square API...');
    
    try {
      // Run the Square sync script
      execSync('npx tsx src/scripts/sync-square-payments.ts', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      console.log('✅ Square payment import completed');
    } catch (error) {
      console.error('❌ Failed to import Square payments:', error);
      throw error;
    }
  }
  
  // Step 3: Match payments to registrations
  async matchPaymentsToRegistrations() {
    console.log('\n🔗 Step 3: Matching payments to registrations...');
    
    let matched = 0;
    let unmatched = 0;
    
    // Get all registrations that have Square payment IDs
    const registrationsWithSquarePayments = await this.registrationsCollection.find({
      squarePaymentId: { $exists: true, $ne: null }
    }).toArray();
    
    console.log(`Found ${registrationsWithSquarePayments.length} registrations with Square payment IDs`);
    
    for (const registration of registrationsWithSquarePayments) {
      // Find matching payment
      const payment = await this.paymentsCollection.findOne({
        paymentId: registration.squarePaymentId,
        source: 'square'
      });
      
      if (payment) {
        // Update registration with payment status
        await this.registrationsCollection.updateOne(
          { _id: registration._id },
          {
            $set: {
              paymentMatched: true,
              paymentMatchedAt: new Date(),
              actualPaymentStatus: payment.status,
              actualPaymentAmount: payment.grossAmount
            }
          }
        );
        matched++;
      } else {
        unmatched++;
      }
    }
    
    console.log(`✅ Matched ${matched} payments to registrations`);
    console.log(`⚠️  ${unmatched} registrations have payment IDs but no matching payment found`);
  }
  
  // Step 4: Validate pending registrations
  async validatePendingRegistrations() {
    console.log('\n🔍 Step 4: Validating pending registrations...');
    
    let validated = 0;
    let failed = 0;
    
    // Find all pending registrations
    const pendingRegistrations = await this.registrationsCollection.find({
      paymentStatus: { $in: ['pending', 'processing', 'awaiting_payment'] }
    }).toArray();
    
    console.log(`Found ${pendingRegistrations.length} pending registrations to validate`);
    
    for (const registration of pendingRegistrations) {
      const validationErrors: string[] = [];
      let hasValidPayment = false;
      
      // Check Square payment
      if (registration.squarePaymentId) {
        const squarePayment = await this.paymentsCollection.findOne({
          paymentId: registration.squarePaymentId,
          source: 'square'
        });
        
        if (squarePayment) {
          if (squarePayment.status === 'paid' || squarePayment.status === 'completed') {
            hasValidPayment = true;
            
            // Update registration to paid
            await this.registrationsCollection.updateOne(
              { _id: registration._id },
              {
                $set: {
                  paymentStatus: 'paid',
                  paymentValidatedAt: new Date(),
                  validatedPaymentId: squarePayment.paymentId,
                  validatedPaymentAmount: squarePayment.grossAmount
                }
              }
            );
            validated++;
          } else {
            validationErrors.push(`Square payment exists but status is ${squarePayment.status}`);
          }
        } else {
          // Try to fetch from Square API directly
          try {
            const apiResponse = await this.squareClient.payments.get({
              paymentId: registration.squarePaymentId
            });
            
            if (apiResponse.payment) {
              const payment = apiResponse.payment;
              if (payment.status === 'COMPLETED') {
                hasValidPayment = true;
                validationErrors.push('Payment found in Square API but not in local database');
              } else {
                validationErrors.push(`Square API payment status: ${payment.status}`);
              }
            }
          } catch (error) {
            validationErrors.push(`Square payment ID ${registration.squarePaymentId} not found in database or API`);
          }
        }
      }
      
      // Check Stripe payment
      if (!hasValidPayment && registration.stripePaymentIntentId) {
        const stripePayment = await this.paymentsCollection.findOne({
          paymentId: registration.stripePaymentIntentId,
          source: 'stripe'
        });
        
        if (stripePayment && stripePayment.status === 'paid') {
          hasValidPayment = true;
          
          // Update registration to paid
          await this.registrationsCollection.updateOne(
            { _id: registration._id },
            {
              $set: {
                paymentStatus: 'paid',
                paymentValidatedAt: new Date(),
                validatedPaymentId: stripePayment.paymentId,
                validatedPaymentAmount: stripePayment.grossAmount
              }
            }
          );
          validated++;
        } else if (stripePayment) {
          validationErrors.push(`Stripe payment exists but status is ${stripePayment.status}`);
        } else {
          validationErrors.push(`Stripe payment intent ${registration.stripePaymentIntentId} not found`);
        }
      }
      
      // If no payment IDs at all
      if (!registration.squarePaymentId && !registration.stripePaymentIntentId) {
        validationErrors.push('No payment ID found (neither Square nor Stripe)');
      }
      
      // If registration has no valid payment, move to failed collection
      if (!hasValidPayment) {
        await this.moveToFailedRegistrations(registration, validationErrors);
        failed++;
      }
    }
    
    console.log(`✅ Validated ${validated} registrations with successful payments`);
    console.log(`❌ Moved ${failed} registrations to failedRegistrations collection`);
  }
  
  // Helper: Move registration to failed collection
  async moveToFailedRegistrations(registration: Registration, validationErrors: string[]) {
    const failedRegistration: FailedRegistration = {
      ...registration,
      failureReason: 'Payment validation failed',
      failedAt: new Date(),
      attemptedPaymentId: registration.squarePaymentId || registration.stripePaymentIntentId,
      validationErrors: validationErrors
    };
    
    // Insert into failed collection
    await this.failedRegistrationsCollection.insertOne(failedRegistration);
    
    // Remove from main registrations collection
    await this.registrationsCollection.deleteOne({ _id: registration._id });
    
    console.log(`  ↪️  Moved registration ${registration.confirmationNumber} to failedRegistrations`);
    validationErrors.forEach(error => console.log(`     - ${error}`));
  }
  
  // Step 5: Generate summary report
  async generateSummaryReport() {
    console.log('\n📊 Step 5: Generating summary report...\n');
    
    const totalRegistrations = await this.registrationsCollection.countDocuments();
    const paidRegistrations = await this.registrationsCollection.countDocuments({ paymentStatus: 'paid' });
    const pendingRegistrations = await this.registrationsCollection.countDocuments({ 
      paymentStatus: { $in: ['pending', 'processing', 'awaiting_payment'] }
    });
    const failedRegistrations = await this.failedRegistrationsCollection.countDocuments();
    
    const totalPayments = await this.paymentsCollection.countDocuments();
    const squarePayments = await this.paymentsCollection.countDocuments({ source: 'square' });
    const stripePayments = await this.paymentsCollection.countDocuments({ source: 'stripe' });
    
    console.log('=' * 60);
    console.log('DATA SYNC SUMMARY');
    console.log('=' * 60);
    console.log('\nRegistrations:');
    console.log(`  Total: ${totalRegistrations}`);
    console.log(`  Paid: ${paidRegistrations}`);
    console.log(`  Pending: ${pendingRegistrations}`);
    console.log(`  Failed: ${failedRegistrations}`);
    
    console.log('\nPayments:');
    console.log(`  Total: ${totalPayments}`);
    console.log(`  Square: ${squarePayments}`);
    console.log(`  Stripe: ${stripePayments}`);
    
    // Show sample failed registrations
    if (failedRegistrations > 0) {
      console.log('\nSample Failed Registrations:');
      const samples = await this.failedRegistrationsCollection.find().limit(3).toArray();
      samples.forEach(reg => {
        console.log(`\n  ${reg.confirmationNumber}:`);
        console.log(`    Reason: ${reg.failureReason}`);
        console.log(`    Errors: ${reg.validationErrors.join(', ')}`);
      });
    }
    
    console.log('\n' + '=' * 60);
  }
  
  // Main orchestration method
  async orchestrate() {
    try {
      await this.initialize();
      
      console.log('🚀 Starting data sync orchestration...\n');
      
      // Step 1: Import registrations from Supabase
      await this.importRegistrationsFromSupabase();
      
      // Step 2: Import payments from Square
      await this.importPaymentsFromSquare();
      
      // Step 3: Match payments to registrations
      await this.matchPaymentsToRegistrations();
      
      // Step 4: Validate pending registrations
      await this.validatePendingRegistrations();
      
      // Step 5: Generate summary report
      await this.generateSummaryReport();
      
      console.log('\n✅ Data sync orchestration completed successfully!');
      
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
Usage: npx tsx orchestrate-data-sync.ts [options]

Options:
  --skip-registrations   Skip importing registrations from Supabase
  --skip-payments        Skip importing payments from Square
  --dry-run              Run validation only (no imports)
  --help                 Show this help message

This script orchestrates the complete data sync process:
1. Imports recent registrations from Supabase
2. Imports payments from Square API
3. Matches payments to registrations
4. Validates pending registrations have valid payments
5. Moves invalid registrations to failedRegistrations collection
    `);
    process.exit(0);
  }
  
  const orchestrator = new DataSyncOrchestrator();
  
  if (args.includes('--dry-run')) {
    console.log('🔍 Running in dry-run mode (validation only)...\n');
    await orchestrator.initialize();
    await orchestrator.matchPaymentsToRegistrations();
    await orchestrator.validatePendingRegistrations();
    await orchestrator.generateSummaryReport();
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