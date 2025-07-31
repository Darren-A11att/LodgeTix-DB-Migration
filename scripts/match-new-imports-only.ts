import { MongoClient, Db, Collection } from 'mongodb';

interface Payment {
  _id: any;
  paymentId?: string;
  transactionId?: string;
  matchedRegistrationId?: string;
  matchedBy?: string;
  invoiceCreated?: boolean;
  invoiceId?: string;
  importedAt?: Date;
  matchedAt?: Date;
}

interface Registration {
  _id: any;
  registrationId?: string;
  stripePaymentIntentId?: string;
  squarePaymentId?: string;
  importedAt?: Date;
  registrationData?: any;
}

export class SafePaymentMatcher {
  private db: Db;
  private paymentsCollection: Collection<Payment>;
  private registrationsCollection: Collection<Registration>;

  constructor(db: Db) {
    this.db = db;
    this.paymentsCollection = db.collection('payments');
    this.registrationsCollection = db.collection('registrations');
  }

  /**
   * Match only newly imported payments and registrations
   * Preserves manual matches and invoiced matches
   */
  async matchNewImportsOnly(hoursBack: number = 1): Promise<{
    processed: number;
    matched: number;
    skipped: number;
    protected: number;
  }> {
    const stats = {
      processed: 0,
      matched: 0,
      skipped: 0,
      protected: 0
    };

    // Calculate cutoff time for "new" imports
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

    console.log(`\n🔍 Processing payments imported after: ${cutoffTime.toISOString()}`);

    // Get only recently imported, unmatched payments
    const newPayments = await this.paymentsCollection.find({
      $and: [
        // Must be recently imported
        { importedAt: { $gte: cutoffTime } },
        // Must not have a match already
        {
          $or: [
            { matchedRegistrationId: { $exists: false } },
            { matchedRegistrationId: null },
            { matchedRegistrationId: '' }
          ]
        }
      ]
    }).toArray();

    console.log(`Found ${newPayments.length} new unmatched payments to process\n`);

    for (const payment of newPayments) {
      stats.processed++;

      // Skip if payment has no IDs to match
      if (!payment.paymentId && !payment.transactionId) {
        stats.skipped++;
        continue;
      }

      // Find matching registration
      const match = await this.findMatchingRegistration(payment);
      
      if (match) {
        await this.createMatch(payment._id, match._id);
        stats.matched++;
        console.log(`✅ Matched payment ${payment.paymentId || payment.transactionId} to registration ${match.registrationId || match._id}`);
      }
    }

    // Also check existing matches for protection
    await this.protectExistingMatches(stats);

    return stats;
  }

  /**
   * Find a registration that contains the payment ID
   */
  private async findMatchingRegistration(payment: Payment): Promise<Registration | null> {
    const paymentIds = [];
    if (payment.paymentId) paymentIds.push(payment.paymentId);
    if (payment.transactionId && payment.transactionId !== payment.paymentId) {
      paymentIds.push(payment.transactionId);
    }

    if (paymentIds.length === 0) return null;

    // Search for registration containing any of these payment IDs
    const query = {
      $or: [
        { stripePaymentIntentId: { $in: paymentIds } },
        { squarePaymentId: { $in: paymentIds } },
        { 'registrationData.stripePaymentIntentId': { $in: paymentIds } },
        { 'registrationData.squarePaymentId': { $in: paymentIds } },
        { 'registrationData.stripe_payment_intent_id': { $in: paymentIds } },
        { 'registrationData.square_payment_id': { $in: paymentIds } }
      ]
    };

    return await this.registrationsCollection.findOne(query);
  }

  /**
   * Create a match between payment and registration
   */
  private async createMatch(paymentId: any, registrationId: any): Promise<void> {
    await this.paymentsCollection.updateOne(
      { _id: paymentId },
      {
        $set: {
          matchedRegistrationId: registrationId.toString(),
          matchedAt: new Date(),
          matchedBy: 'safe_import_matcher',
          matchMethod: 'paymentId',
          matchConfidence: 100
        }
      }
    );
  }

  /**
   * Check and log protected matches that won't be touched
   */
  private async protectExistingMatches(stats: { protected: number }): Promise<void> {
    // Count manual matches
    const manualMatches = await this.paymentsCollection.countDocuments({
      matchedBy: 'manual'
    });

    // Count invoiced matches
    const invoicedMatches = await this.paymentsCollection.countDocuments({
      $or: [
        { invoiceCreated: true },
        { invoiceId: { $exists: true, $ne: null } }
      ]
    });

    stats.protected = manualMatches + invoicedMatches;

    if (stats.protected > 0) {
      console.log(`\n🛡️  Protected matches:`);
      console.log(`   - Manual matches: ${manualMatches}`);
      console.log(`   - Invoiced matches: ${invoicedMatches}`);
      console.log(`   Total protected: ${stats.protected}`);
    }
  }

  /**
   * Re-validate existing matches WITHOUT touching protected ones
   */
  async validateExistingMatches(): Promise<{
    validated: number;
    invalid: number;
    protected: number;
  }> {
    const stats = {
      validated: 0,
      invalid: 0,
      protected: 0
    };

    // Get all matched payments
    const matchedPayments = await this.paymentsCollection.find({
      matchedRegistrationId: { $exists: true, $ne: null, $ne: '' }
    }).toArray();

    console.log(`\n🔍 Validating ${matchedPayments.length} existing matches...`);

    for (const payment of matchedPayments) {
      // SKIP if manual match
      if (payment.matchedBy === 'manual') {
        stats.protected++;
        console.log(`🛡️  Skipping manual match: ${payment._id}`);
        continue;
      }

      // SKIP if has invoice
      if (payment.invoiceCreated || payment.invoiceId) {
        stats.protected++;
        console.log(`🛡️  Skipping invoiced match: ${payment._id}`);
        continue;
      }

      // Validate the match still exists
      const registration = await this.registrationsCollection.findOne({
        _id: payment.matchedRegistrationId
      });

      if (!registration) {
        // Registration no longer exists
        await this.clearMatch(payment._id);
        stats.invalid++;
      } else {
        // Check if payment ID still exists in registration
        const stillValid = await this.validateMatch(payment, registration);
        if (stillValid) {
          stats.validated++;
        } else {
          await this.clearMatch(payment._id);
          stats.invalid++;
        }
      }
    }

    return stats;
  }

  /**
   * Validate that payment ID still exists in registration
   */
  private async validateMatch(payment: Payment, registration: Registration): Promise<boolean> {
    const paymentIds = [];
    if (payment.paymentId) paymentIds.push(payment.paymentId);
    if (payment.transactionId) paymentIds.push(payment.transactionId);

    for (const paymentId of paymentIds) {
      if (
        registration.stripePaymentIntentId === paymentId ||
        registration.squarePaymentId === paymentId ||
        registration.registrationData?.stripePaymentIntentId === paymentId ||
        registration.registrationData?.squarePaymentId === paymentId ||
        registration.registrationData?.stripe_payment_intent_id === paymentId ||
        registration.registrationData?.square_payment_id === paymentId
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Clear an invalid match (NOT for manual or invoiced matches)
   */
  private async clearMatch(paymentId: any): Promise<void> {
    await this.paymentsCollection.updateOne(
      { _id: paymentId },
      {
        $unset: {
          matchedRegistrationId: '',
          matchedAt: '',
          matchedBy: '',
          matchMethod: '',
          matchConfidence: ''
        },
        $set: {
          matchCleared: true,
          matchClearedAt: new Date(),
          matchClearedReason: 'validation_failed'
        }
      }
    );
  }
}

// Script to run the safe matcher
async function runSafeMatcher() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('🔐 Safe Payment Matcher - Import Mode');
    console.log('=====================================\n');
    
    const matcher = new SafePaymentMatcher(db);
    
    // Match only payments imported in the last hour
    console.log('Step 1: Matching newly imported payments...');
    const matchResults = await matcher.matchNewImportsOnly(1); // Last 1 hour
    
    console.log('\n📊 Matching Results:');
    console.log(`   Processed: ${matchResults.processed}`);
    console.log(`   Matched: ${matchResults.matched}`);
    console.log(`   Skipped: ${matchResults.skipped}`);
    console.log(`   Protected: ${matchResults.protected}`);
    
    // Optionally validate existing matches (excluding protected ones)
    if (process.argv.includes('--validate')) {
      console.log('\nStep 2: Validating existing matches...');
      const validationResults = await matcher.validateExistingMatches();
      
      console.log('\n📊 Validation Results:');
      console.log(`   Valid: ${validationResults.validated}`);
      console.log(`   Invalid (cleared): ${validationResults.invalid}`);
      console.log(`   Protected (skipped): ${validationResults.protected}`);
    }
    
    console.log('\n✅ Safe matching complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

// Export for use in other scripts
export { runSafeMatcher };

// Run if called directly
if (require.main === module) {
  runSafeMatcher().catch(console.error);
}