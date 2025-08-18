import { MongoClient, Db, ObjectId } from 'mongodb';
import Stripe from 'stripe';
import { SquareClient, SquareEnvironment } from 'square';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { iterateSquarePayments } from '../../lib/square-pagination-fix';
import { 
  transformObjectKeys,
  createImportDocument,
  getCollectionName,
  createSelectiveUpdate,
  ProductionMeta,
  COLLECTION_MAPPING,
  generateCustomerHash,
  determineCustomerType,
  createCustomerFromBookingContact
} from './field-transform-utils';
import { ReferenceDataService, PackageDetails } from './reference-data-service';
import { SyncLogger, SyncConfiguration } from './sync-logger';

interface PaymentProvider {
  name: string;
  type: 'stripe' | 'square';
  client: Stripe | SquareClient;
  accountId?: string;
}

interface PaymentImport {
  id: string; // charge ID for Stripe, payment ID for Square
  paymentIntentId?: string; // for Stripe
  provider: string;
  amount: number;
  currency: string;
  status: string;
  refunded: boolean;
  amountRefunded: number;
  created: Date;
  metadata: any;
  cardBrand?: string;
  cardLast4?: string;
  receiptEmail?: string;
  customerId?: string;
  orderId?: string; // for Square
  orderData?: any; // Square order details
  customerData?: any; // Square customer details
  registrationId?: string; // linked after matching
}

interface RegistrationImport {
  id: string;
  paymentId: string; // charge ID for Stripe, payment ID for Square
  originalPaymentIntentId?: string;
  status: string;
  userId: string;
  eventId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: any;
  bookingContact?: any;
}

interface Contact {
  _id?: ObjectId;
  title: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string; // Primary deduplication key
  address: string;
  state: string;
  postcode: string;
  country: string;
  relationships?: any;
  memberships?: any;
  uniqueKey: string; // Backup key: email + mobile + lastName + firstName
  roles: Array<'customer' | 'attendee'>; // Track where this person appears
  sources: Array<'registration' | 'attendee'>; // Legacy field for backward compatibility
  linkedPartnerId?: ObjectId;
  // Reference tracking
  customerRef?: ObjectId; // Link to customer record if they made bookings
  attendeeRefs: ObjectId[]; // Links to attendee records where they attend
  registrationRefs: ObjectId[]; // Links to all associated registrations
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastSeenAs: 'customer' | 'attendee'; // Most recent role seen
}

export class EnhancedPaymentSyncService {
  private db: Db | null = null;
  private mongoClient: MongoClient | null = null;
  private supabase: any;
  private providers: PaymentProvider[] = [];
  private processedCount = 0;
  private errorCount = 0;
  private skippedCount = 0;
  private logFilePath: string;
  private processedContacts: Map<string, ObjectId> = new Map(); // Now keyed by email instead of uniqueKey
  private referenceDataService: ReferenceDataService | null = null;
  private syncRunId: string = `sync-${Date.now()}`;
  private syncLogger: SyncLogger | null = null;

  constructor() {
    // Environment variables should already be loaded by parent scripts
    // Do NOT override here as it causes cluster/database mismatches
    
    this.initializeLogging();
    this.initializeSupabase();
    this.initializePaymentProviders();
  }

  private initializeLogging() {
    const logsDir = path.join(process.cwd(), 'sync-logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = path.join(logsDir, `enhanced-sync-${timestamp}.log`);
    
    this.writeToLog('=== ENHANCED PAYMENT SYNC LOG ===');
    this.writeToLog(`Started at: ${new Date().toISOString()}`);
    this.writeToLog('Processing Square with orders/customers and contacts\n');
  }

  private writeToLog(message: string) {
    console.log(message);
    if (this.logFilePath) {
      const logMessage = `${message}\n`;
      fs.appendFileSync(this.logFilePath, logMessage);
    }
  }

  private async recordPaymentError(
    errorType: 'UNMATCHED' | 'FAILED' | 'REFUNDED',
    errorMessage: string,
    paymentData: any,
    db: Db
  ) {
    const now = Math.floor(Date.now() / 1000);
    
    try {
      // Log to error_log collection
      await db.collection('error_log').insertOne({
        timestamp: now,
        syncRunId: this.syncRunId,
        errorLevel: 'WARNING',
        entityType: 'payment',
        entityId: paymentData.id,
        operation: 'sync',
        errorMessage,
        errorCode: errorType,
        context: {
          source: 'payment_registration_match',
          provider: paymentData.provider || 'unknown',
          status: paymentData.status,
          amount: paymentData.amount,
          currency: paymentData.currency
        },
        resolution: {
          status: 'PENDING'
        }
      });

      // Also save the full record to error_payments collection
      await db.collection('error_payments').insertOne({
        originalId: paymentData.id,
        paymentId: paymentData.id,
        errorType,
        errorMessage,
        attemptedAt: now,
        originalData: paymentData,
        metadata: {
          syncRunId: this.syncRunId,
          provider: paymentData.provider,
          source: 'payment_registration_match'
        }
      });

    } catch (error) {
      this.writeToLog(`    ⚠️ Failed to record payment error: ${error}`);
    }
  }


  private initializeSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.writeToLog('✓ Supabase client initialized');
  }

  private initializePaymentProviders() {
    // SQUARE MUST BE CONFIGURED - it's required!
    if (!process.env.SQUARE_ACCESS_TOKEN) {
      throw new Error('SQUARE_ACCESS_TOKEN is required but not configured in .env.local');
    }
    
    // Production tokens start with EAAA, sandbox tokens start with different prefix
    // We'll use production unless explicitly set to sandbox
    const isSandbox = process.env.SQUARE_ENVIRONMENT === 'sandbox';
    
    this.providers.push({
      name: 'Square',
      type: 'square',
      client: new SquareClient({
        token: process.env.SQUARE_ACCESS_TOKEN,
        environment: isSandbox ? SquareEnvironment.Sandbox : SquareEnvironment.Production
      })
    });
    this.writeToLog('✓ Square provider initialized (REQUIRED)');

    // Stripe accounts
    const stripeAccounts = [
      { name: process.env.STRIPE_ACCOUNT_1_NAME || 'DA-LODGETIX', key: process.env.STRIPE_ACCOUNT_1_SECRET_KEY, id: 'stripe_1' },
      { name: process.env.STRIPE_ACCOUNT_2_NAME || 'WS-LODGETIX', key: process.env.STRIPE_ACCOUNT_2_SECRET_KEY, id: 'stripe_2' },
      { name: process.env.STRIPE_ACCOUNT_3_NAME || 'WS-LODGETICKETS', key: process.env.STRIPE_ACCOUNT_3_SECRET_KEY, id: 'stripe_3' }
    ];

    stripeAccounts.forEach(account => {
      if (account.key) {
        this.providers.push({
          name: account.name,
          type: 'stripe',
          client: new Stripe(account.key, { apiVersion: '2025-07-30.basil' }),
          accountId: account.id
        });
        this.writeToLog(`✓ ${account.name} initialized`);
      }
    });

    this.writeToLog(`\nInitialized ${this.providers.length} payment provider(s)`);
  }

  private async connectToMongoDB(): Promise<Db> {
    if (!this.db) {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      this.mongoClient = new MongoClient(uri);
      await this.mongoClient.connect();
      // Use lodgetix database in the LodgeTix-migration-test-1 cluster
      const dbName = 'lodgetix';
      this.db = this.mongoClient.db(dbName);
      this.referenceDataService = new ReferenceDataService(this.db);
      
      // Log full connection details for debugging
      const cluster = uri.includes('lodgetix-migration-test') ? 'LodgeTix-migration-test-1' : 
                      uri.includes('lodgetix.0u7ogxj') ? 'LodgeTix' : 'Unknown';
      this.writeToLog(`✓ Connected to MongoDB:`);
      this.writeToLog(`  Cluster: ${cluster}`);
      this.writeToLog(`  Database: ${dbName}`);
      this.writeToLog(`  URI: ${uri.replace(/:[^@]+@/, ':****@')}`);
    }
    return this.db;
  }

  public async disconnect(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.mongoClient = null;
      this.db = null;
    }
  }

  public async syncAllPayments(options: { limit?: number } = {}): Promise<void> {
    const db = await this.connectToMongoDB();
    
    // Initialize sync logger with configuration
    const syncConfig: SyncConfiguration = {
      providers: this.providers.map(p => p.name),
      limit: options.limit,
      dryRun: false,
      options: options
    };
    
    this.syncLogger = new SyncLogger(db, this.syncRunId, syncConfig);
    await this.syncLogger.startSession('Enhanced Payment Sync Started');
    
    try {
      // Legacy file logging (keeping for compatibility)
      this.writeToLog('\n=== STARTING ENHANCED PAYMENT SYNC ===');
      this.writeToLog('Processing workflow:');
      this.writeToLog('1. Import payment to import_payments (with field transformation)');
      this.writeToLog('2. Fetch order/customer for Square payments');
      this.writeToLog('3. Find registration in Supabase');
      this.writeToLog('4. Update with charge ID for Stripe');
      this.writeToLog('5. Import to import_registrations (with field transformation)');
      this.writeToLog('6. Import attendees to import_attendees');
      this.writeToLog('7. Import tickets to import_tickets');
      this.writeToLog('8. Import contacts to import_contacts with deduplication');
      this.writeToLog('9. Process booking contact as customer with registration metadata');
      this.writeToLog('9. Selective sync to production collections based on field comparison\n');
      
      await this.ensureCollections(db);
      
      // Clear processed contacts map for fresh sync (now email-based)
      this.processedContacts.clear();
      
      // Log initialization
      this.syncLogger.logAction('initialization', 'database', undefined, 'completed', 'Collections ensured and contacts map cleared');
      
      for (const provider of this.providers) {
        this.writeToLog(`\n━━━ Processing ${provider.name} ━━━`);
        const providerActionId = this.syncLogger.logAction('provider_processing', 'provider', provider.name, 'started', `Starting ${provider.name} processing`, provider.name);
        
        try {
          if (provider.type === 'square') {
            await this.processSquarePayments(provider, db, options);
          } else if (provider.type === 'stripe') {
            await this.processStripeCharges(provider, db, options);
          }
          
          this.syncLogger.updateAction(providerActionId, 'completed', `${provider.name} processing completed successfully`);
        } catch (error: any) {
          this.writeToLog(`Error processing ${provider.name}: ${error.message}`);
          this.errorCount++;
          
          this.syncLogger.logError('provider_processing', 'provider', error, provider.name, provider.name);
          
          await this.recordPaymentError(
            'FAILED',
            `Provider processing failed: ${error.message}`,
            { id: provider.name, provider: provider.name },
            db
          );
        }
      }

      // Perform selective sync from import collections to production collections
      this.writeToLog('\n🔄 Starting selective production sync...');
      const selectiveSyncActionId = this.syncLogger.logAction('selective_sync', 'production', undefined, 'started', 'Starting selective production sync');
      
      try {
        await this.performSelectiveSync();
        this.syncLogger.updateAction(selectiveSyncActionId, 'completed', 'Selective production sync completed');
      } catch (error: any) {
        this.syncLogger.logError('selective_sync', 'production', error);
        throw error;
      }

      // Run error verification as final step
      const verificationActionId = this.syncLogger.logAction('error_verification', 'verification', undefined, 'started', 'Starting error verification');
      
      try {
        await this.runErrorVerification();
        this.syncLogger.updateAction(verificationActionId, 'completed', 'Error verification completed');
      } catch (error: any) {
        this.syncLogger.logError('error_verification', 'verification', error);
        // Don't throw here as it's just verification
      }

      // Update statistics in sync logger
      this.syncLogger.setTotalRecords(this.processedCount + this.skippedCount + this.errorCount);

      this.writeToLog('\n=== SYNC COMPLETE ===');
      this.writeToLog(`✅ Processed: ${this.processedCount}`);
      this.writeToLog(`⏭️ Skipped: ${this.skippedCount}`);
      this.writeToLog(`❌ Errors: ${this.errorCount}`);
      this.writeToLog(`👥 Unique contacts: ${this.processedContacts.size}`);
      this.writeToLog(`📊 Total: ${this.processedCount + this.skippedCount + this.errorCount}`);
      
      await this.syncLogger.endSession('completed', 'Enhanced payment sync completed successfully');
      
    } catch (error: any) {
      if (this.syncLogger) {
        this.syncLogger.logError('sync_session', 'session', error);
        await this.syncLogger.endSession('failed', `Sync failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Cleans up error_payments records for a specific paymentId
   * @param paymentId - The payment ID (can be Stripe charge ID or Square payment ID)
   * @param db - MongoDB database instance
   * @returns Promise<number> - Number of deleted records
   */
  public async cleanupErrorRecords(paymentId: string, db: Db): Promise<number> {
    if (!paymentId || !db) {
      this.writeToLog(`  ⚠️ Invalid parameters for cleanup: paymentId=${paymentId}, db=${!!db}`);
      return 0;
    }

    try {
      this.writeToLog(`  🧹 Checking for stale error_payments records for payment: ${paymentId}`);
      
      // Search for error records by both 'paymentId' and 'originalId' fields
      const query = {
        $or: [
          { paymentId: paymentId },
          { originalId: paymentId }
        ]
      };

      // First, count how many records we'll be deleting
      const countToDelete = await db.collection('error_payments').countDocuments(query);
      
      if (countToDelete === 0) {
        return 0;
      }

      this.writeToLog(`  📊 Found ${countToDelete} stale error_payments record(s) to clean up`);

      // Perform the deletion
      const deleteResult = await db.collection('error_payments').deleteMany(query);
      
      // Audit logging
      const now = Math.floor(Date.now() / 1000);
      try {
        await db.collection('error_log').insertOne({
          timestamp: now,
          syncRunId: this.syncRunId,
          errorLevel: 'INFO',
          entityType: 'payment',
          entityId: paymentId,
          operation: 'cleanup',
          errorMessage: `Cleaned up ${deleteResult.deletedCount} stale error_payments records before reprocessing`,
          errorCode: 'CLEANUP_SUCCESS',
          context: {
            source: 'cleanup_error_records',
            deletedCount: deleteResult.deletedCount
          },
          resolution: {
            status: 'RESOLVED',
            action: 'error_records_cleaned_up',
            resolvedAt: now
          }
        });
      } catch (auditError) {
        // Silent fail for audit logging
      }

      this.writeToLog(`  ✅ Cleaned up ${deleteResult.deletedCount} stale error record(s)`);
      return deleteResult.deletedCount;

    } catch (error: any) {
      this.writeToLog(`  ⚠️ Error during cleanup: ${error.message}`);
      return 0;
    }
  }

  /**
   * Records a payment error to the error_payments collection
   * @param errorType - Type of error (UNMATCHED, FAILED, REFUNDED, DUPLICATE)
   * @param errorMessage - Descriptive error message
   * @param paymentData - Original payment data object
   * @param db - MongoDB database instance
   * @returns Promise<void>
   */

  private async ensureCollections(db: Db): Promise<void> {
    const collections = [
      'import_payments',
      'import_registrations',
      'import_attendees',
      'import_tickets', 
      'import_contacts',
      'import_customers',
      'payments',
      'registrations',
      'attendees',
      'tickets',
      'contacts',
      'customers'
    ];
    
    for (const collectionName of collections) {
      const colls = await db.listCollections({ name: collectionName }).toArray();
      if (colls.length === 0) {
        await db.createCollection(collectionName);
        this.writeToLog(`✓ Created collection: ${collectionName}`);
      }
    }
  }

  private async processSquarePayments(provider: PaymentProvider, db: Db, options: { limit?: number }): Promise<void> {
    const square = provider.client as SquareClient;
    let processedInProvider = 0;
    let totalFetched = 0;
    let cursor: string | undefined = undefined;
    
    this.writeToLog('\nFetching ALL historical Square payments (one at a time)...');
    
    // Process ALL payments - no date filtering for historical data
    do {
      try {
        // Fetch ONE payment at a time
        const response = await square.payments.list({ 
          limit: 1,  // Process 1 payment at a time as required
          cursor: cursor 
          // NO date filtering - process ALL historical data
        });
        
        const payments = response.data || [];
        
        if (payments.length === 0) {
          // No more payments
          break;
        }
        
        totalFetched += payments.length;
        this.writeToLog(`  Fetched payment ${totalFetched} (cursor: ${cursor ? 'provided' : 'none'})`);
        
        // Process the single payment
        for (const payment of payments) {
          await this.processSingleSquarePayment(payment, provider, db, square);
          processedInProvider++;
          
          if (options.limit && processedInProvider >= options.limit) {
            this.writeToLog(`Reached limit of ${options.limit} for ${provider.name}`);
            return;
          }
        }
        
        // Get cursor for next payment from the SDK response
        // The Square SDK stores the cursor at response.response.cursor
        cursor = (response as any).response?.cursor;
        
        if (cursor) {
          this.writeToLog(`  Got cursor for next payment`);
        } else {
          this.writeToLog('  No cursor found, completed all Square payments');
          break;
        }
        
      } catch (error: any) {
        this.writeToLog(`Error fetching Square payments: ${error.message}`);
        this.errorCount++;
        await this.recordPaymentError(
          'FAILED',
          `Square API fetch failed: ${error.message}`,
          { id: 'square-fetch', provider: 'square', cursor },
          db
        );
        break;
      }
    } while (cursor); // Continue while we have a cursor
    
    this.writeToLog(`✓ Processed ${processedInProvider} Square payments (total fetched: ${totalFetched})`);
  }

  private async processSingleSquarePayment(payment: any, provider: PaymentProvider, db: Db, square: SquareClient): Promise<void> {
    const paymentActionId = this.syncLogger?.logAction('payment_processing', 'payment', payment.id, 'started', `Processing Square payment: ${payment.id}`, 'square');
    
    try {
      this.writeToLog(`\n📝 Processing Square payment: ${payment.id}`);
      
      // Check payment status - track all payments but note which ones should move to production
      const shouldMoveToProduction = payment.status === 'COMPLETED' && 
                                    (!payment.refundedMoney || payment.refundedMoney.amount === 0);
      
      if (!shouldMoveToProduction) {
        this.writeToLog(`  📥 Importing non-completed payment - status: ${payment.status} (will not move to production)`);
        this.skippedCount++; // Still count as skipped for production purposes
      } else {
        this.writeToLog(`  ✅ Importing completed payment - status: ${payment.status}`);
      }

      // Refunded status is already checked in shouldMoveToProduction above
      if (payment.refundedMoney && payment.refundedMoney.amount > 0) {
        this.writeToLog(`  💰 Payment has refunds: ${Number(payment.refundedMoney.amount) / 100} ${payment.refundedMoney.currency}`);
      }

      // Check if already processed in import collection
      const existingPayment = await db.collection('import_payments').findOne({ id: payment.id });
      
      // Check if already exists in production collection
      const existingProductionPayment = await db.collection('payments').findOne({ id: payment.id });
      if (existingProductionPayment) {
        this.writeToLog(`  ✓ Payment already exists in production - skipping`);
        this.skippedCount++;
        return;
      }
      
      if (existingPayment) {
        // Check if payment has been modified since last import
        const sourceUpdatedAt = payment.updatedAt ? new Date(payment.updatedAt).getTime() : 0;
        const importUpdatedAt = existingPayment.updatedAt ? new Date(existingPayment.updatedAt).getTime() : 0;
        
        // Check for duplicate payment (same ID, amount, and timestamp)
        const sourceAmount = payment.totalMoney?.amount || 0;
        const existingAmount = existingPayment.totalMoney?.amount || 0;
        
        if (sourceUpdatedAt === importUpdatedAt && sourceAmount === existingAmount) {
          this.writeToLog(`  ⚠️ Duplicate payment detected - recording as error`);
          await this.recordPaymentError(
            'FAILED',
            `Duplicate Square payment ${payment.id} - previously processed at ${new Date(payment.updatedAt).toISOString()}`,
            { ...payment, provider: 'square' },
            db
          );
          this.skippedCount++;
          return;
        }
        
        if (sourceUpdatedAt > importUpdatedAt) {
          this.writeToLog(`  🔄 Payment has been updated - cleaning up and reprocessing`);
          // Clean up any existing error records before reprocessing
          await this.cleanupErrorRecords(payment.id, db);
          // Continue processing to update the payment
        } else {
          this.writeToLog(`  ⏭️ Already imported - skipping`);
          this.skippedCount++;
          return;
        }
      }

      // Check for duplicates based on orderId appearing multiple times
      if (payment.orderId) {
        const existingOrderPayments = await db.collection('import_payments').find({ 
          orderId: payment.orderId,
          id: { $ne: payment.id } // Exclude current payment
        }).toArray();
        
        if (existingOrderPayments.length > 0) {
          this.writeToLog(`  ⚠️ Duplicate orderId detected - recording as error`);
          await this.recordPaymentError(
            'FAILED',
            `Duplicate orderId detected: ${payment.orderId} already exists for payment(s): ${existingOrderPayments.map(p => p.id).join(', ')}`,
            payment,
            db
          );
          this.skippedCount++;
          return;
        }
      }

      // Check for duplicates based on amount + customerId + timestamp within 60 seconds
      if (payment.customerId && payment.totalMoney?.amount) {
        const paymentTime = payment.updatedAt ? new Date(payment.updatedAt).getTime() : Date.now();
        const timeWindow = 60 * 1000; // 60 seconds in milliseconds
        
        const duplicateTimePayments = await db.collection('import_payments').find({
          customerId: payment.customerId,
          'totalMoney.amount': payment.totalMoney.amount,
          id: { $ne: payment.id }, // Exclude current payment
          updatedAt: {
            $gte: new Date(paymentTime - timeWindow).toISOString(),
            $lte: new Date(paymentTime + timeWindow).toISOString()
          }
        }).toArray();
        
        if (duplicateTimePayments.length > 0) {
          this.writeToLog(`  ⚠️ Duplicate payment within time window detected - recording as error`);
          await this.recordPaymentError(
            'FAILED',
            `Duplicate Square payment ${payment.id} - previously processed at ${new Date(payment.updatedAt).toISOString()}`,
            payment,
            db
          );
          this.skippedCount++;
          return;
        }
      }

      // Fetch order if order_id exists
      let orderData = null;
      if (payment.orderId) {
        try {
          this.writeToLog(`  🛒 Fetching order: ${payment.orderId}`);
          // Use raw API call for orders
          const token = (square as any).config?.accessToken || process.env.SQUARE_ACCESS_TOKEN;
          const environment = (square as any).config?.environment || 'production';
          const baseUrl = environment === 'production' 
            ? 'https://connect.squareup.com' 
            : 'https://connect.squareupsandbox.com';
            
          const orderResponse = await fetch(`${baseUrl}/v2/orders/${payment.orderId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Square-Version': '2025-06-18',
              'Content-Type': 'application/json'
            }
          });
          
          if (orderResponse.ok) {
            const orderResult = await orderResponse.json();
            orderData = orderResult.order;
            this.writeToLog(`    ✓ Order fetched`);
          } else {
            this.writeToLog(`    ⚠️ Could not fetch order: ${orderResponse.statusText}`);
          }
        } catch (error) {
          this.writeToLog(`    ⚠️ Could not fetch order: ${error}`);
        }
      }

      // Fetch customer if customer_id exists
      let customerData = null;
      if (payment.customerId) {
        try {
          this.writeToLog(`  👤 Fetching customer: ${payment.customerId}`);
          // Use raw API call for customers
          const token = (square as any).config?.accessToken || process.env.SQUARE_ACCESS_TOKEN;
          const environment = (square as any).config?.environment || 'production';
          const baseUrl = environment === 'production' 
            ? 'https://connect.squareup.com' 
            : 'https://connect.squareupsandbox.com';
            
          const customerResponse = await fetch(`${baseUrl}/v2/customers/${payment.customerId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Square-Version': '2025-06-18',
              'Content-Type': 'application/json'
            }
          });
          
          if (customerResponse.ok) {
            const customerResult = await customerResponse.json();
            customerData = customerResult.customer;
            this.writeToLog(`    ✓ Customer fetched`);
          } else {
            this.writeToLog(`    ⚠️ Could not fetch customer: ${customerResponse.statusText}`);
          }
        } catch (error) {
          this.writeToLog(`    ⚠️ Could not fetch customer: ${error}`);
        }
      }

      // 1. Import payment to import_payments with field transformation
      // Determine payment status properly
      let paymentStatus = payment.status.toLowerCase();
      if (payment.status === 'FAILED') {
        paymentStatus = 'failed';
      } else if (payment.status === 'CANCELLED' || payment.status === 'CANCELED') {
        paymentStatus = 'cancelled';
      } else if (payment.refundedMoney && payment.refundedMoney.amount > 0) {
        // If there's any refund amount, mark as refunded
        paymentStatus = 'refunded';
      }

      const paymentImportData = {
        id: payment.id,
        provider: provider.name,
        // Convert BigInt to number for Square amounts
        amount: payment.totalMoney?.amount ? Number(payment.totalMoney.amount) / 100 : 0,
        currency: payment.totalMoney?.currency || 'USD',
        status: paymentStatus,
        refunded: payment.refundedMoney && payment.refundedMoney.amount > 0,
        amountRefunded: payment.refundedMoney?.amount ? Number(payment.refundedMoney.amount) / 100 : 0,
        created: new Date(payment.createdAt),
        metadata: payment.note ? { note: payment.note } : {},
        orderId: payment.orderId,
        orderData: orderData,
        customerData: customerData,
        customerId: payment.customerId,
        receiptEmail: customerData?.emailAddress,
        _shouldMoveToProduction: shouldMoveToProduction
      };

      const paymentImport = createImportDocument(
        paymentImportData,
        'square',
        provider.name
      );

      await db.collection('import_payments').replaceOne(
        { id: payment.id },
        paymentImport,
        { upsert: true }
      );
      this.writeToLog(`  ✓ Imported to import_payments with field transformation`);

      // 2. Find registration using payment ID
      const registration = await this.fetchRegistrationByPaymentId(payment.id);
      
      if (!registration) {
        const logPrefix = shouldMoveToProduction ? '❌' : '📝';
        this.writeToLog(`  ${logPrefix} No registration found for payment: ${payment.id}`);
        
        // Create enhanced payment data with Order and Customer objects
        const enhancedPaymentData = {
          ...paymentImportData,
          originalData: {
            payment: payment,
            order: orderData,
            customer: customerData
          }
        };
        
        // Update import_payments with "no-match" for registrationId
        await db.collection('import_payments').updateOne(
          { id: payment.id },
          { $set: { registrationId: 'no-match' } }
        );
        this.writeToLog(`  ✓ Updated import_payments with registrationId: no-match`);
        
        // Record payment error based on status
        if (payment.status === 'COMPLETED' && 
            (!payment.refundedMoney || payment.refundedMoney.amount === 0)) {
          // COMPLETED payments with no match are errors
          this.errorCount++;
          const amount = payment.totalMoney?.amount ? Number(payment.totalMoney.amount) / 100 : 0;
          const currency = payment.totalMoney?.currency || 'USD';
          await this.recordPaymentError(
            'UNMATCHED',
            `No registration found for completed Square payment ${payment.id} with order ${payment.orderId || 'none'}`,
            { ...payment, provider: 'square', orderData, customerData },
            db
          );
        } else {
          // Failed, refunded, and other non-completed payments without match are NOT errors
          this.skippedCount++;
          this.writeToLog(`  ℹ️ ${payment.status} payment - no match is not an error`);
        }
        return;
      }
      const logPrefix = shouldMoveToProduction ? '✓' : '📝';
      this.writeToLog(`  ${logPrefix} Found registration: ${registration.id}`);
      
      // Update import_payments with the found registrationId
      await db.collection('import_payments').updateOne(
        { id: payment.id },
        { $set: { registrationId: registration.id } }
      );
      this.writeToLog(`  ✓ Updated import_payments with registrationId: ${registration.id}`);

      // 3. Import FULL registration to import_registrations with field transformation
      const registrationImportData = {
        ...registration, // Include ALL fields from Supabase
        paymentId: payment.id, // Square payment ID
        gateway: provider.name, // 'Square'
        _shouldMoveToProduction: shouldMoveToProduction
      };

      // Check if registration already exists in production collection
      const existingProductionRegistration = await db.collection('registrations').findOne({ id: registration.id });
      if (existingProductionRegistration) {
        this.writeToLog(`  ✓ Registration already exists in production - skipping import`);
        return;
      }

      const registrationImport = createImportDocument(
        registrationImportData,
        'supabase',
        'supabase-registration'
      );

      await db.collection('import_registrations').replaceOne(
        { id: registration.id },
        registrationImport,
        { upsert: true }
      );
      const regLogPrefix = shouldMoveToProduction ? '✓' : '📝';
      this.writeToLog(`  ${regLogPrefix} Imported FULL registration to import_registrations with field transformation`);

      // Production sync deferred to selective sync phase
      const syncStatus = shouldMoveToProduction ? 'eligible for production sync' : 'not eligible for production sync';
      this.writeToLog(`  ⏸️ Production sync deferred to selective sync phase (${syncStatus})`);

      // 4. Process booking contact as customer (use the imported registration with transformed fields)
      await this.processCustomerFromRegistration(registrationImport, db);

      // 5. Process attendees, tickets, and contacts
      await this.processAttendeesTicketsAndContacts(registration, db);

      this.processedCount++;
      const completionPrefix = shouldMoveToProduction ? '✅' : '📝';
      this.writeToLog(`  ${completionPrefix} Completed processing Square payment ${payment.id} (${shouldMoveToProduction ? 'production eligible' : 'import only'})`);
      
      // Log success to sync logger
      if (this.syncLogger && paymentActionId) {
        this.syncLogger.updateAction(
          paymentActionId, 
          'completed', 
          `Square payment processed successfully (${shouldMoveToProduction ? 'production eligible' : 'import only'})`,
          { shouldMoveToProduction, amount: payment.amount, status: payment.status }
        );
      }
      
    } catch (error: any) {
      this.writeToLog(`  ❌ Error processing Square payment ${payment.id}: ${error.message}`);
      this.errorCount++;
      
      // Log error to sync logger
      if (this.syncLogger) {
        this.syncLogger.logError('payment_processing', 'payment', error, payment.id, 'square', { payment });
      }
      
      await this.recordPaymentError(
        'FAILED',
        `Square payment processing failed: ${error.message}`,
        { ...payment, provider: 'square' },
        db
      );
    }
  }

  private async processStripeCharges(provider: PaymentProvider, db: Db, options: { limit?: number }): Promise<void> {
    const stripe = provider.client as Stripe;
    let hasMore = true;
    let startingAfter: string | undefined;
    let processedInProvider = 0;
    
    while (hasMore) {
      try {
        // Process charges one by one
        const charges = await stripe.charges.list({
          limit: 1, // Process 1 at a time
          starting_after: startingAfter
          // NO date filtering - process ALL historical charges
        });

        for (const charge of charges.data) {
          await this.processSingleStripeCharge(charge, provider, db, stripe);
          processedInProvider++;
          
          if (options.limit && processedInProvider >= options.limit) {
            this.writeToLog(`Reached limit of ${options.limit} for ${provider.name}`);
            return;
          }
        }

        hasMore = charges.has_more;
        if (charges.data.length > 0) {
          startingAfter = charges.data[charges.data.length - 1].id;
        }
      } catch (error) {
        this.writeToLog(`Error fetching charges from ${provider.name}: ${error}`);
        this.errorCount++;
        await this.recordPaymentError(
          'FAILED',
          `Stripe charge fetch failed: ${error}`,
          { id: provider.name, provider: provider.name },
          db
        );
        break;
      }
    }
  }

  private async processSingleStripeCharge(
    charge: Stripe.Charge,
    provider: PaymentProvider,
    db: Db,
    stripe: Stripe
  ): Promise<void> {
    const chargeActionId = this.syncLogger?.logAction('payment_processing', 'payment', charge.id, 'started', `Processing Stripe charge: ${charge.id}`, 'stripe');
    
    try {
      this.writeToLog(`\n📝 Processing charge: ${charge.id}`);
      
      // Check charge status - track all charges but note which ones should move to production
      const shouldMoveToProduction = charge.paid && (!charge.refunded || charge.amount_refunded < charge.amount);
      
      if (!shouldMoveToProduction) {
        if (!charge.paid) {
          this.writeToLog(`  📥 Importing unpaid charge - status: ${charge.status} (will not move to production)`);
        } else if (charge.refunded && charge.amount_refunded === charge.amount) {
          this.writeToLog(`  📥 Importing fully refunded charge - refunded: ${charge.amount_refunded / 100} ${charge.currency} (will not move to production)`);
        } else {
          this.writeToLog(`  📥 Importing charge with issues - paid: ${charge.paid}, refunded: ${charge.refunded} (will not move to production)`);
        }
        this.skippedCount++; // Still count as skipped for production purposes
      } else {
        this.writeToLog(`  ✅ Importing successful charge - status: ${charge.status}`);
      }

      // Log refunded status for successful charges
      if (charge.refunded && charge.amount_refunded > 0 && shouldMoveToProduction) {
        this.writeToLog(`  💰 Charge has partial refunds: ${charge.amount_refunded / 100} ${charge.currency}`);
      }

      // Check if already processed in import collection
      const existingPayment = await db.collection('import_payments').findOne({ id: charge.id });
      
      // Check if already exists in production collection
      const existingProductionPayment = await db.collection('payments').findOne({ id: charge.id });
      if (existingProductionPayment) {
        this.writeToLog(`  ✓ Charge already exists in production - skipping`);
        this.skippedCount++;
        return;
      }
      
      if (existingPayment) {
        // Check if charge has been modified since last import
        const sourceCreatedAt = charge.created ? charge.created * 1000 : 0; // Convert to milliseconds
        const importCreatedAt = existingPayment.createdAt ? new Date(existingPayment.createdAt).getTime() : 0;
        const sourceRefunded = charge.refunded || false;
        const importRefunded = existingPayment.refunded || false;
        
        // Check if status changed (e.g., payment was refunded)
        if (sourceRefunded !== importRefunded || sourceCreatedAt > importCreatedAt) {
          this.writeToLog(`  🔄 Charge has been updated (refund status: ${importRefunded} → ${sourceRefunded}) - cleaning up and reprocessing`);
          // Clean up any existing error records before reprocessing
          await this.cleanupErrorRecords(charge.id, db);
          // Continue processing to update the charge
        } else {
          this.writeToLog(`  ⏭️ Already imported - skipping`);
          this.skippedCount++;
          return;
        }
      }

      // Check for test payment
      const isTestPayment = this.isTestPayment(charge);
      if (isTestPayment) {
        this.writeToLog(`  🧪 Test payment detected - skipping`);
        this.skippedCount++;
        return;
      }

      // 1. Import charge to import_payments with field transformation
      // Determine charge status properly
      let chargeStatus = charge.status;
      if (charge.refunded === true) {
        chargeStatus = 'succeeded'; // Use 'succeeded' instead of 'refunded' to match Stripe Status type
      } else if (charge.status === 'failed') {
        chargeStatus = 'failed';
      }

      const chargeImportData = {
        id: charge.id,
        paymentIntentId: charge.payment_intent as string || '',
        provider: provider.name,
        amount: charge.amount / 100,
        currency: charge.currency,
        status: chargeStatus,
        refunded: charge.refunded,
        amountRefunded: charge.amount_refunded / 100,
        created: new Date(charge.created * 1000),
        metadata: charge.metadata || {},
        cardBrand: charge.payment_method_details?.card?.brand,
        cardLast4: charge.payment_method_details?.card?.last4,
        receiptEmail: charge.receipt_email || undefined,
        customerId: charge.customer as string || undefined,
        _shouldMoveToProduction: shouldMoveToProduction
      };

      const chargeImport = createImportDocument(
        chargeImportData,
        'stripe',
        provider.name
      );

      await db.collection('import_payments').replaceOne(
        { id: charge.id },
        chargeImport,
        { upsert: true }
      );
      this.writeToLog(`  ✓ Imported charge to import_payments with field transformation`);

      // 2. Find registration using payment intent ID
      if (!charge.payment_intent) {
        this.writeToLog(`  ⚠️ No payment intent ID - cannot find registration`);
        
        // Create enhanced payment data
        const enhancedPaymentData = {
          ...chargeImportData,
          originalData: {
            charge: charge
          }
        };
        
        // Update import_payments with "no-match" for registrationId
        await db.collection('import_payments').updateOne(
          { id: charge.id },
          { $set: { registrationId: 'no-match' } }
        );
        this.writeToLog(`  ✓ Updated import_payments with registrationId: no-match`);
        
        // Record payment error based on status
        if (charge.paid && !charge.refunded) {
          // Successful charges with no payment intent are errors
          this.errorCount++;
          const amount = charge.amount / 100;
          await this.recordPaymentError(
            'UNMATCHED',
            `Stripe charge ${charge.id} has no payment intent ID - cannot find registration for $${amount} ${charge.currency}`,
            charge,
            db
          );
        } else if (charge.status === 'failed') {
          // Failed charges with no payment intent
          this.skippedCount++;
          this.writeToLog(`  ℹ️ Failed Stripe payment ${charge.id} - no registration match attempted`);
        } else if (charge.refunded) {
          // Refunded charges with no payment intent
          this.skippedCount++;
          const amount = charge.amount / 100;
          this.writeToLog(`  ℹ️ Refunded payment ${charge.id} for $${amount} ${charge.currency} - no registration found`);
        } else {
          // Other statuses without payment intent are not errors
          this.skippedCount++;
          this.writeToLog(`  ℹ️ Charge status ${charge.status} - no payment intent is not an error`);
        }
        return;
      }

      const registration = await this.fetchRegistrationByPaymentId(charge.payment_intent as string);
      
      if (!registration) {
        const logPrefix = shouldMoveToProduction ? '❌' : '📝';
        this.writeToLog(`  ${logPrefix} No registration found for payment intent: ${charge.payment_intent}`);
        
        // Create enhanced payment data
        const enhancedPaymentData = {
          ...chargeImportData,
          originalData: {
            charge: charge
          }
        };
        
        // Update import_payments with "no-match" for registrationId
        await db.collection('import_payments').updateOne(
          { id: charge.id },
          { $set: { registrationId: 'no-match' } }
        );
        this.writeToLog(`  ✓ Updated import_payments with registrationId: no-match`);
        
        // Record payment error based on status
        if (charge.paid && !charge.refunded) {
          // Successful charges with no registration match are errors
          this.errorCount++;
          const amount = charge.amount / 100;
          await this.recordPaymentError(
            'UNMATCHED',
            `No registration found for successful Stripe charge (payment intent: ${charge.payment_intent})`,
            enhancedPaymentData,
            db
          );
        } else {
          // Failed, refunded, and other non-succeeded charges without match are NOT errors
          this.skippedCount++;
          this.writeToLog(`  ℹ️ ${charge.status}${charge.refunded ? ' (refunded)' : ''} charge - no match is not an error`);
        }
        return;
      }
      const logPrefix = shouldMoveToProduction ? '✓' : '📝';
      this.writeToLog(`  ${logPrefix} Found registration: ${registration.id}`);
      
      // Update import_payments with the found registrationId
      await db.collection('import_payments').updateOne(
        { id: charge.id },
        { $set: { registrationId: registration.id } }
      );
      this.writeToLog(`  ✓ Updated import_payments with registrationId: ${registration.id}`);

      // 3. Import FULL registration to import_registrations with field transformation
      const registrationImportData = {
        ...registration, // Include ALL fields from Supabase
        paymentId: charge.id, // Use consistent paymentId field
        originalPaymentIntentId: charge.payment_intent as string,
        gateway: provider.name, // Use gateway with specific account name
        _shouldMoveToProduction: shouldMoveToProduction
      };

      // Check if registration already exists in production collection
      const existingProductionRegistration = await db.collection('registrations').findOne({ id: registration.id });
      if (existingProductionRegistration) {
        this.writeToLog(`  ✓ Registration already exists in production - skipping import`);
        return;
      }

      const registrationImport = createImportDocument(
        registrationImportData,
        'supabase',
        'supabase-registration'
      );

      await db.collection('import_registrations').replaceOne(
        { id: registration.id },
        registrationImport,
        { upsert: true }
      );
      const regLogPrefix = shouldMoveToProduction ? '✓' : '📝';
      this.writeToLog(`  ${regLogPrefix} Imported FULL registration to import_registrations with field transformation`);

      // Production sync deferred to selective sync phase
      const syncStatus = shouldMoveToProduction ? 'eligible for production sync' : 'not eligible for production sync';
      this.writeToLog(`  ⏸️ Production sync deferred to selective sync phase (${syncStatus})`);

      // 4. Process booking contact as customer (use the imported registration with transformed fields)
      await this.processCustomerFromRegistration(registrationImport, db);

      // 5. Process attendees, tickets, and contacts
      await this.processAttendeesTicketsAndContacts(registration, db);

      this.processedCount++;
      const completionPrefix = shouldMoveToProduction ? '✅' : '📝';
      this.writeToLog(`  ${completionPrefix} Completed processing charge ${charge.id} (${shouldMoveToProduction ? 'production eligible' : 'import only'})`);
      
      // Log success to sync logger
      if (this.syncLogger && chargeActionId) {
        this.syncLogger.updateAction(
          chargeActionId, 
          'completed', 
          `Stripe charge processed successfully (${shouldMoveToProduction ? 'production eligible' : 'import only'})`,
          { shouldMoveToProduction, amount: charge.amount, status: charge.status, paid: charge.paid }
        );
      }
      
    } catch (error: any) {
      this.writeToLog(`  ❌ Error processing charge ${charge.id}: ${error.message}`);
      this.errorCount++;
      
      // Log error to sync logger
      if (this.syncLogger) {
        this.syncLogger.logError('payment_processing', 'payment', error, charge.id, 'stripe', { charge });
      }
      
      await this.recordPaymentError(
        'FAILED',
        `Stripe charge processing failed: ${error.message}`,
        charge,
        db
      );
    }
  }

  private async processAttendeesTicketsAndContacts(registration: any, db: Db): Promise<void> {
    // Process booking contact first to import_contacts
    let bookingContactId: ObjectId | null = null;
    if (registration.bookingContact) {
      // Get registration ObjectId for reference linking
      const registrationDoc = await db.collection('import_registrations').findOne({ id: registration.id });
      const registrationRef = registrationDoc?._id;
      
      bookingContactId = await this.processContact(
        registration.bookingContact, 
        'registration', 
        db,
        registrationRef,
        undefined, // no attendeeRef for booking contact
        undefined  // customerRef will be set separately if needed
      );
    }

    // Get the customer information from the updated registration
    const updatedRegistration = await db.collection('import_registrations').findOne({ id: registration.id });
    const customerUUID = updatedRegistration?.metadata?.customerUUID;
    
    // Get the customer data if we have the UUID
    let customerData = null;
    if (customerUUID) {
      customerData = await db.collection('import_customers').findOne({ customerId: customerUUID });
      if (customerData) {
        this.writeToLog(`  ✓ Found customer data for ticket ownership: ${customerData.firstName} ${customerData.lastName}`);
      }
    }

    // Process attendees
    const attendees = await this.fetchAttendeesByRegistration(registration.id, registration);
    this.writeToLog(`  ✓ Found ${attendees.length} attendee(s)`);
    
    // Extract tickets from registration_data with customer info
    const tickets = await this.fetchTicketsFromRegistration(registration.id, registration, customerData);
    this.writeToLog(`  ✓ Found ${tickets.length} ticket(s) in registration`);
    
    // Store tickets to import_tickets first with field transformation
    const ticketIds: ObjectId[] = [];
    for (const ticket of tickets) {
      // Check if ticket already exists in production collection
      const existingProductionTicket = await db.collection('tickets').findOne({ ticketId: ticket.ticketId });
      if (existingProductionTicket) {
        this.writeToLog(`    ✓ Ticket already exists in production - skipping: ${ticket.ticketId}`);
        continue;
      }

      const ticketImport = createImportDocument(
        ticket,
        'supabase',
        'supabase-ticket'
      );

      this.writeToLog(`    💾 Saving ticket to import_tickets: ${ticket.ticketId} (${ticket.eventName}, qty: ${ticket.quantity})`);
      const result = await db.collection('import_tickets').replaceOne(
        { ticketId: ticket.ticketId },
        ticketImport,
        { upsert: true }
      );
      this.writeToLog(`      ${result.upsertedCount ? '✅ Created' : '🔄 Updated'} ticket document`);
      
      // Generate or get existing ObjectId for linking
      const existingTicket = await db.collection('import_tickets').findOne({ ticketId: ticket.ticketId });
      ticketIds.push(existingTicket!._id);
    }
    
    // Process and store attendees to import_attendees with linked tickets
    for (let i = 0; i < attendees.length; i++) {
      const attendee = attendees[i];
      
      // Link tickets to attendee (distribute tickets among attendees)
      const attendeeTickets = tickets
        .filter((t: any, idx: number) => idx % attendees.length === i)
        .map((t: any) => ({
          importTicketId: ticketIds[tickets.indexOf(t)],
          name: t.eventName,
          status: t.status
        }));
      
      // Add event_tickets to attendee
      const attendeeData = {
        ...attendee,
        eventTickets: attendeeTickets // Use camelCase for consistency
      };
      
      // Check if attendee already exists in production collection
      const existingProductionAttendee = await db.collection('attendees').findOne({ attendeeId: attendee.attendeeId });
      if (existingProductionAttendee) {
        this.writeToLog(`    ✓ Attendee already exists in production - skipping: ${attendee.attendeeId}`);
        continue;
      }

      const attendeeImport = createImportDocument(
        attendeeData,
        'supabase',
        'supabase-attendee'
      );

      await db.collection('import_attendees').replaceOne(
        { attendeeId: attendee.attendeeId },
        attendeeImport,
        { upsert: true }
      );

      // Process attendee as contact to import_contacts
      const attendeeDoc = await db.collection('import_attendees').findOne({ attendeeId: attendee.attendeeId });
      const attendeeRef = attendeeDoc?._id;
      const registrationDoc = await db.collection('import_registrations').findOne({ id: registration.id });
      const registrationRef = registrationDoc?._id;
      
      await this.processContact(
        attendee, 
        'attendee', 
        db,
        registrationRef,
        attendeeRef,
        undefined // customerRef not typically needed for attendees
      );
    }
  }

  private async processCustomerFromRegistration(registration: any, db: Db): Promise<void> {
    this.writeToLog(`  📝 Processing booking contact as customer`);
    
    // Check for bookingContact in registrationData (after field transformation)
    const bookingContact = registration.registrationData?.bookingContact || registration.registration_data?.bookingContact;
    
    if (!bookingContact) {
      this.writeToLog(`    ⚠️ No booking contact found in registration`);
      this.writeToLog(`    Debug: registrationData exists: ${!!registration.registrationData}`);
      this.writeToLog(`    Debug: registration_data exists: ${!!registration.registration_data}`);
      return;
    }
    
    // Check if bookingContact is already an ObjectId (already processed)
    if (bookingContact.constructor.name === 'ObjectId' || typeof bookingContact === 'string') {
      this.writeToLog(`    ℹ️ Booking contact already processed as customer`);
      return;
    }

    try {
      // Create customer from booking contact
      const customerData = createCustomerFromBookingContact(bookingContact, registration);
      this.writeToLog(`    Customer data created: ${customerData.firstName} ${customerData.lastName}`);
      
      // Build the registration metadata object
      const registrationMetadata = {
        registrationObjectId: new ObjectId(),
        customerType: customerData.customerType,
        customerBusiness: customerData.customerType === 'business' ? [{
          businessName: customerData.businessName,
          businessNumber: registration.organisation_number || null
        }] : [],
        customerAddress: [{
          street: customerData.address.street,
          city: customerData.address.city,
          state: customerData.address.state,
          postalCode: customerData.address.postalCode,
          country: customerData.address.country
        }],
        registrationId: registration.id,
        registrationType: registration.registration_type,
        functionId: registration.function_id,
        paymentId: registration.paymentId || registration.stripe_payment_intent_id || registration.square_payment_id,
        registrationConfirmationNumber: registration.confirmation_number,
        customerId: registration.auth_user_id,
        authUserId: registration.auth_user_id,
        invoiceId: registration.invoice_id || '',
        registrationDate: registration.registration_date || registration.created_at
      };

      // Create the customer import document
      const customerImport = createImportDocument(
        customerData,
        'supabase',
        'supabase-customer'
      );

      // Check if customer already exists in production collection
      const existingProductionCustomer = await db.collection('customers').findOne({ hash: customerData.hash });
      if (existingProductionCustomer) {
        this.writeToLog(`    ✓ Customer already exists in production - skipping: ${customerData.firstName} ${customerData.lastName}`);
        return;
      }

      // Remove registrations and updatedAt fields from customerImport to avoid conflicts
      const { registrations, updatedAt, ...customerImportWithoutConflicts } = customerImport;

      // Upsert customer with registration metadata
      const result = await db.collection('import_customers').updateOne(
        { hash: customerData.hash },
        {
          $setOnInsert: customerImportWithoutConflicts,
          $addToSet: {
            registrations: registrationMetadata
          },
          $set: {
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      // Get the customer ObjectId
      let customerId: ObjectId;
      if (result.upsertedId) {
        customerId = result.upsertedId;
        this.writeToLog(`    ✓ Created new customer: ${customerData.firstName} ${customerData.lastName}`);
      } else {
        const existingCustomer = await db.collection('import_customers').findOne({ hash: customerData.hash });
        customerId = existingCustomer?._id;
        this.writeToLog(`    ✓ Updated existing customer: ${customerData.firstName} ${customerData.lastName}`);
      }

      // Update the registration to replace bookingContact with customer ObjectId and store customerId
      if (customerId) {
        await db.collection('import_registrations').updateOne(
          { id: registration.id },
          {
            $set: {
              'registrationData.bookingContact': customerId,
              'metadata.customerId': customerId,
              'metadata.customerUUID': customerData.customerId // Store the UUID customerId
            }
          }
        );
        this.writeToLog(`    ✓ Updated registration with customer ObjectId and customerId: ${customerData.customerId}`);
        
        // Update the unified contact with customer reference
        const contactEmail = (bookingContact.email || '').trim().toLowerCase();
        if (contactEmail && this.processedContacts.has(contactEmail)) {
          const contactId = this.processedContacts.get(contactEmail);
          await db.collection('import_contacts').updateOne(
            { _id: contactId },
            {
              $set: {
                'data.customerRef': customerId,
                'data.updatedAt': new Date()
              }
            }
          );
          this.writeToLog(`    ✓ Linked customer to unified contact: ${contactEmail}`);
        }
      }

    } catch (error: any) {
      this.writeToLog(`    ❌ Error processing customer: ${error.message}`);
      this.errorCount++;
      // Note: customerData might not be defined if error occurred early in the process
      // We'll log a simplified error in this case
      const errorData = { registrationId: registration.id, error: error.message };
      await this.recordPaymentError(
        'FAILED',
        `Customer processing failed: ${error.message}`,
        errorData,
        db
      );
    }
  }

  private async processContact(data: any, source: 'registration' | 'attendee', db: Db, registrationRef?: ObjectId, attendeeRef?: ObjectId, customerRef?: ObjectId): Promise<ObjectId | null> {
    // Validate email as primary deduplication key
    const email = (data.email || '').trim().toLowerCase();
    if (!email) {
      this.writeToLog(`    ⚠️ Skipping contact with no email: ${data.firstName} ${data.lastName}`);
      return null;
    }

    // Extract contact fields
    const contactData = {
      title: data.title || '',
      firstName: data.firstName || data.first_name || '',
      lastName: data.lastName || data.last_name || '',
      mobile: data.mobile || data.phone || '',
      email: email,
      address: data.address || '',
      state: data.state || '',
      postcode: data.postcode || '',
      country: data.country || '',
      relationships: data.relationships || {},
      memberships: data.memberships || { grandLodge: '', lodge: '' }
    };

    // Generate unique key for backward compatibility
    const uniqueKey = crypto.createHash('md5')
      .update(`${contactData.email}${contactData.mobile}${contactData.lastName}${contactData.firstName}`)
      .digest('hex');

    // Determine role based on source
    const role: 'customer' | 'attendee' = source === 'registration' ? 'customer' : 'attendee';

    // Check if contact already processed in this sync by email (primary key)
    const processedContactId = this.processedContacts.get(email);
    if (processedContactId) {
      // Update existing contact with new role and references
      await this.updateExistingContact(db, processedContactId, role, source, registrationRef, attendeeRef, customerRef);
      this.writeToLog(`    🔄 Updated existing contact with new role '${role}': ${contactData.firstName} ${contactData.lastName}`);
      return processedContactId;
    }

    // Check if contact exists in import collection by email
    let existingContact = await db.collection('import_contacts').findOne({ 'data.email': email });
    
    // Fallback: check by uniqueKey for backward compatibility
    if (!existingContact) {
      existingContact = await db.collection('import_contacts').findOne({ 'data.uniqueKey': uniqueKey });
    }

    // Check if contact exists in production collection by email
    let existingProductionContact = await db.collection('contacts').findOne({ email: email });
    
    // Fallback: check production by uniqueKey
    if (!existingProductionContact) {
      existingProductionContact = await db.collection('contacts').findOne({ uniqueKey: uniqueKey });
    }

    if (existingProductionContact) {
      this.writeToLog(`    ✓ Contact already exists in production - skipping sync but tracking: ${contactData.firstName} ${contactData.lastName}`);
      // Still track for this sync session
      this.processedContacts.set(email, existingProductionContact._id);
      return existingProductionContact._id;
    }

    const now = new Date();
    let contactToSave: Contact;

    if (existingContact) {
      // Update existing contact with new role and references
      const existingData = existingContact.data;
      contactToSave = {
        ...existingData,
        // Update contact info with latest data (in case of changes)
        title: contactData.title || existingData.title,
        firstName: contactData.firstName || existingData.firstName,
        lastName: contactData.lastName || existingData.lastName,
        mobile: contactData.mobile || existingData.mobile,
        address: contactData.address || existingData.address,
        state: contactData.state || existingData.state,
        postcode: contactData.postcode || existingData.postcode,
        country: contactData.country || existingData.country,
        relationships: { ...existingData.relationships, ...contactData.relationships },
        memberships: { ...existingData.memberships, ...contactData.memberships },
        // Merge roles
        roles: Array.from(new Set([...(existingData.roles || []), role])),
        sources: Array.from(new Set([...(existingData.sources || []), source])),
        // Update references
        customerRef: customerRef || existingData.customerRef,
        attendeeRefs: Array.from(new Set([
          ...(existingData.attendeeRefs || []),
          ...(attendeeRef ? [attendeeRef] : [])
        ])),
        registrationRefs: Array.from(new Set([
          ...(existingData.registrationRefs || []),
          ...(registrationRef ? [registrationRef] : [])
        ])),
        updatedAt: now,
        lastSeenAs: role
      };
      
      this.writeToLog(`    🔄 Merging roles for existing contact: ${contactData.firstName} ${contactData.lastName} (${contactToSave.roles.join(', ')})`);
    } else {
      // Create new contact
      contactToSave = {
        ...contactData,
        uniqueKey: uniqueKey,
        roles: [role],
        sources: [source],
        customerRef: customerRef,
        attendeeRefs: attendeeRef ? [attendeeRef] : [],
        registrationRefs: registrationRef ? [registrationRef] : [],
        createdAt: now,
        updatedAt: now,
        lastSeenAs: role
      };

      this.writeToLog(`    ✨ Creating new contact with role '${role}': ${contactData.firstName} ${contactData.lastName}`);
    }

    // Check for partner linking
    if (data.isPartner && data.partnerId) {
      contactToSave.linkedPartnerId = new ObjectId(data.partnerId);
    }

    // Insert/update contact to import_contacts with field transformation
    const contactImport = createImportDocument(
      contactToSave,
      'supabase',
      'supabase-contact'
    );

    const result = await db.collection('import_contacts').replaceOne(
      { 'data.email': email },
      contactImport,
      { upsert: true }
    );

    const contactId = result.upsertedId || (await db.collection('import_contacts').findOne({ 'data.email': email }))?._id;
    
    if (contactId) {
      this.processedContacts.set(email, contactId);
      this.writeToLog(`    ✓ Processed unified contact: ${contactData.firstName} ${contactData.lastName} (roles: ${contactToSave.roles.join(', ')})`);
      return contactId;
    }
    
    return null;
  }

  private async updateExistingContact(
    db: Db, 
    contactId: ObjectId, 
    role: 'customer' | 'attendee', 
    source: 'registration' | 'attendee',
    registrationRef?: ObjectId,
    attendeeRef?: ObjectId,
    customerRef?: ObjectId
  ): Promise<void> {
    const updateFields: any = {
      $addToSet: {
        'data.roles': role,
        'data.sources': source
      },
      $set: {
        'data.updatedAt': new Date(),
        'data.lastSeenAs': role
      }
    };

    // Add references if provided
    if (registrationRef) {
      updateFields.$addToSet['data.registrationRefs'] = registrationRef;
    }
    if (attendeeRef) {
      updateFields.$addToSet['data.attendeeRefs'] = attendeeRef;
    }
    if (customerRef) {
      updateFields.$set['data.customerRef'] = customerRef;
    }

    await db.collection('import_contacts').updateOne(
      { _id: contactId },
      updateFields
    );
  }

  private isTestPayment(charge: Stripe.Charge): boolean {
    const cardLast4 = charge.payment_method_details?.card?.last4;
    const email = charge.receipt_email || charge.billing_details?.email || '';
    
    return cardLast4 === '8251' && email.includes('@allatt.me');
  }

  private async fetchRegistrationByPaymentId(paymentId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('registrations')
        .select('*')
        .eq('stripe_payment_intent_id', paymentId)
        .single();

      if (error || !data) {
        return null;
      }

      // Return ALL fields from Supabase, including registration_data JSON
      return {
        // Core fields
        id: data.registration_id || data.id || paymentId,
        registration_id: data.registration_id,
        
        // Payment fields
        stripe_payment_intent_id: data.stripe_payment_intent_id,
        square_payment_id: data.square_payment_id,
        square_customer_id: data.square_customer_id,
        square_fee: data.square_fee,
        stripe_fee: data.stripe_fee,
        platform_fee_amount: data.platform_fee_amount,
        platform_fee_id: data.platform_fee_id,
        connected_account_id: data.connected_account_id,
        
        // Status and amounts
        status: data.status,
        payment_status: data.payment_status,
        total_amount_paid: data.total_amount_paid,
        total_price_paid: data.total_price_paid,
        subtotal: data.subtotal,
        includes_processing_fee: data.includes_processing_fee,
        
        // IDs and references
        customer_id: data.customer_id,
        auth_user_id: data.auth_user_id,
        user_id: data.user_id || data.auth_user_id,
        event_id: data.event_id,
        function_id: data.function_id,
        organisation_id: data.organisation_id,
        booking_contact_id: data.booking_contact_id,
        primary_attendee_id: data.primary_attendee_id,
        
        // Registration details
        registration_type: data.registration_type,
        registration_date: data.registration_date,
        confirmation_number: data.confirmation_number,
        confirmation_pdf_url: data.confirmation_pdf_url,
        confirmation_generated_at: data.confirmation_generated_at,
        
        // Organisation details
        organisation_name: data.organisation_name,
        organisation_number: data.organisation_number,
        
        // Attendee info
        primary_attendee: data.primary_attendee,
        attendee_count: data.attendee_count,
        
        // Terms
        agree_to_terms: data.agree_to_terms,
        
        // Timestamps
        created_at: data.created_at,
        updated_at: data.updated_at,
        
        // Most important - the full registration data JSON
        registration_data: data.registration_data ? 
          (typeof data.registration_data === 'string' ? 
            JSON.parse(data.registration_data) : 
            data.registration_data) : null,
        
        // Legacy/backward compatibility
        metadata: data.metadata || {},
        bookingContact: data.booking_contact || data.bookingContact
      };
    } catch (error) {
      this.writeToLog(`Error fetching registration for payment ${paymentId}: ${error}`);
      return null;
    }
  }

  private async fetchAttendeesByRegistration(registrationId: string, registration?: any): Promise<any[]> {
    try {
      // First, try to extract attendees from registration_data field
      if (registration && registration.registration_data?.attendees) {
        const attendeesFromData = registration.registration_data.attendees;
        this.writeToLog(`    Extracting ${attendeesFromData.length} attendees from registration_data`);
        
        const attendeesWithFunctionNames = await Promise.all(
          attendeesFromData.map(async (attendee: any, index: number) => ({
          // Core identifiers - use clean UUIDs (let MongoDB auto-generate _id)
          // NO manual _id field - let MongoDB generate it automatically
          attendeeId: attendee.attendeeId || attendee.id || `${registrationId}_attendee_${index}`, // Use original attendeeId if available
          originalAttendeeId: attendee.attendeeId || attendee.id || `${registrationId}_attendee_${index}`, // Preserve original ID for reference
          
          // Name fields
          firstName: attendee.firstName || attendee.first_name || '',
          lastName: attendee.lastName || attendee.last_name || '',
          title: attendee.title || '',
          suffix: attendee.suffix || '',
          postNominals: attendee.postNominals || '',
          
          // Contact info
          email: attendee.primaryEmail || attendee.email || '',
          phone: attendee.primaryPhone || attendee.phone || '',
          
          // Organization/Lodge info
          organization: attendee.organization || '',
          lodge: attendee.lodge || '',
          lodge_id: attendee.lodge_id || attendee.lodgeId || null,
          lodgeNameNumber: attendee.lodgeNameNumber || '',
          grand_lodge: attendee.grandLodge || attendee.grand_lodge || '',
          grand_lodge_id: attendee.grand_lodge_id || attendee.grandLodgeId || null,
          rank: attendee.rank || '',
          grandOfficerStatus: attendee.grandOfficerStatus || '',
          
          // Membership structure
          membership: attendee.membership || {
            type: 'Lodge',
            name: attendee.lodgeNameNumber || attendee.lodge || '',
            lodgeId: attendee.lodge_id || attendee.lodgeId || null,
            stateRegion: attendee.state || '',
            constitution: attendee.constitution || attendee.grandLodge || '',
            constitutionId: attendee.grand_lodge_id || attendee.grandLodgeId || null
          },
          
          // Constitution structure
          constitution: attendee.constitution || {
            type: 'Grand Lodge',
            name: attendee.grandLodge || attendee.grand_lodge || '',
            abbreviation: attendee.grandLodgeAbbreviation || '',
            country: attendee.country || 'AUS',
            area: attendee.area || '',
            id: attendee.grand_lodge_id || attendee.grandLodgeId || null
          },
          
          // Jurisdiction
          jurisdiction: attendee.jurisdiction || {},
          
          // Attendee type and status
          attendeeType: attendee.attendeeType || 'mason',
          isPrimary: attendee.isPrimary !== undefined ? attendee.isPrimary : index === 0,
          isCheckedIn: attendee.isCheckedIn || false,
          firstTime: attendee.firstTime || false,
          
          // Partner info
          partner: attendee.partner || null,
          partnerOf: attendee.partnerOf || null,
          isPartner: attendee.isPartner || false,
          relationship: attendee.relationship || '',
          guestOfId: attendee.guestOfId || null,
          
          // Preferences
          dietary: attendee.dietary || attendee.dietaryRequirements || '',
          dietaryRequirements: attendee.dietaryRequirements || attendee.dietary || '',
          accessibility: attendee.accessibility || attendee.specialNeeds || '',
          specialNeeds: attendee.specialNeeds || attendee.accessibility || '',
          notes: attendee.notes || '',
          contactPreference: attendee.contactPreference || 'Directly',
          contactConfirmed: attendee.contactConfirmed || false,
          
          // Payment and table
          paymentStatus: attendee.paymentStatus || 'pending',
          tableAssignment: attendee.tableAssignment || null,
          useSameLodge: attendee.useSameLodge || null,
          
          // Registration linkage
          registrations: [{
            // NO manual _id field - let MongoDB generate it automatically
            status: registration.status || 'pending',
            registrationId: registration.registration_id || registration.id || registrationId,
            functionId: registration.function_id || registration.event_id,
            functionName: await this.getFunctionName(registration.function_id || registration.event_id),
            confirmationNumber: registration.confirmation_number || '',
            paymentId: registration.stripe_payment_intent_id || registration.square_payment_id || '',
            bookingContactId: registration.booking_contact_id || null
          }],
          
          // Auth
          authUserId: attendee.authUserId || registration.auth_user_id || null,
          
          // Function details
          functionName: await this.getFunctionName(registration.function_id || registration.event_id),
          
          // Event tickets (to be populated later)
          event_tickets: [],
          
          // Timestamps
          createdAt: attendee.createdAt || new Date().toISOString(),
          modifiedAt: new Date(),
          
          // Modification tracking
          lastModificationId: new ObjectId(),
          modificationHistory: [{
            id: new ObjectId(),
            type: 'creation',
            changes: [{
              field: 'name',
              from: null,
              to: `${attendee.firstName || ''} ${attendee.lastName || ''}`
            }],
            description: 'Attendee extracted from registration during sync',
            timestamp: new Date(),
            userId: 'system-sync',
            source: 'enhanced-payment-sync'
          }],
          
          // Enrichment status
          enrichmentVerified: false,
          
          // QR Code (if exists)
          qrCode: attendee.qrCode || null
        }))
        );
        
        return attendeesWithFunctionNames;
      }
      
      // Fallback: try to fetch from attendees table in Supabase
      const { data, error } = await this.supabase
        .from('attendees')
        .select('*')
        .eq('registration_id', registrationId);

      if (error || !data) {
        return [];
      }

      return data.map((attendee: any) => ({
        id: attendee.id,
        registration_id: attendee.registration_id,
        first_name: attendee.first_name || '',
        last_name: attendee.last_name || '',
        email: attendee.email || '',
        phone: attendee.phone,
        created_at: new Date(attendee.created_at),
        metadata: attendee.metadata || {},
        isPartner: attendee.is_partner,
        partnerId: attendee.partner_id
      }));
    } catch (error) {
      this.writeToLog(`Error fetching attendees: ${error}`);
      return [];
    }
  }

  private async fetchEventTicketDetails(eventTicketId: string): Promise<any> {
    try {
      if (!this.referenceDataService) {
        this.writeToLog(`    ⚠️ Reference data service not initialized`);
        return null;
      }

      this.writeToLog(`    🔍 Looking up eventTicket: ${eventTicketId}`);
      const eventTicketDetails = await this.referenceDataService.getEventTicketDetails(eventTicketId);
      
      if (eventTicketDetails) {
        // The eventTicket document has 'name' field, not 'eventName'
        const ticketName = eventTicketDetails.eventName || eventTicketDetails.name || 'Unknown Event';
        // Handle MongoDB Decimal128 price format: { "$numberDecimal": "115" }
        const ticketPrice = eventTicketDetails.price && typeof eventTicketDetails.price === 'object' && eventTicketDetails.price.$numberDecimal 
          ? parseFloat(eventTicketDetails.price.$numberDecimal) 
          : (eventTicketDetails.price || 0);
        this.writeToLog(`    ✅ Found eventTicket: ${ticketName} (price: ${ticketPrice})`);
        return {
          eventTicketId: eventTicketDetails.eventTicketId,
          eventName: ticketName,
          name: ticketName,
          price: ticketPrice
        };
      }
      
      this.writeToLog(`    ⚠️ Event ticket ${eventTicketId} not found by reference service`);
      // Additional debugging information
      this.writeToLog(`    Debug: Database connected: ${!!this.db}`);
      this.writeToLog(`    Debug: Reference service initialized: ${!!this.referenceDataService}`);
      if (this.db) {
        // Check if eventTickets collection exists and log count
        try {
          const eventTicketsCount = await this.db.collection('eventTickets').countDocuments();
          this.writeToLog(`    Debug: eventTickets collection has ${eventTicketsCount} documents`);
        } catch (countError) {
          this.writeToLog(`    Debug: Error counting eventTickets: ${countError}`);
        }
      }
      return null;
    } catch (error) {
      this.writeToLog(`    ❌ Error fetching event ticket ${eventTicketId}: ${error}`);
      return null;
    }
  }

  private async getFunctionName(functionId: string | null): Promise<string> {
    if (!functionId) {
      return 'Unknown Function';
    }

    try {
      if (!this.referenceDataService) {
        this.writeToLog(`    ⚠️ Reference data service not initialized for function lookup`);
        return 'Unknown Function';
      }

      const functionDetails = await this.referenceDataService.getFunctionDetails(functionId);
      
      if (functionDetails) {
        return functionDetails.functionName || functionDetails.name || 'Unknown Function';
      }
      
      return 'Unknown Function';
    } catch (error) {
      this.writeToLog(`    ❌ Error fetching function name for ${functionId}: ${error}`);
      return 'Unknown Function';
    }
  }

  /**
   * Get package details by package ID
   * @param packageId - The package ID (can be _id or packageId field)
   * @returns Package document with includedItems or null if not found
   */
  private async getPackageDetails(packageId: string): Promise<PackageDetails | null> {
    if (!packageId) {
      this.writeToLog(`    ⚠️ Package ID is required`);
      return null;
    }

    try {
      if (!this.referenceDataService) {
        this.writeToLog(`    ⚠️ Reference data service not initialized for package lookup`);
        return null;
      }

      this.writeToLog(`    🔍 Looking up package: ${packageId}`);
      const packageDetails = await this.referenceDataService.getPackageDetails(packageId);
      
      if (packageDetails) {
        const packageName = packageDetails.name || 'Unknown Package';
        // Handle MongoDB Decimal128 price format: { "$numberDecimal": "115" }
        const packagePrice = packageDetails.price && typeof packageDetails.price === 'object' && packageDetails.price.$numberDecimal 
          ? parseFloat(packageDetails.price.$numberDecimal) 
          : (packageDetails.price || 0);
        const includedItemsCount = packageDetails.includedItems ? packageDetails.includedItems.length : 0;
        
        this.writeToLog(`    ✅ Found package: ${packageName} (price: ${packagePrice}, items: ${includedItemsCount})`);
        return packageDetails;
      }
      
      this.writeToLog(`    ⚠️ Package ${packageId} not found`);
      // Additional debugging information
      this.writeToLog(`    Debug: Database connected: ${!!this.db}`);
      this.writeToLog(`    Debug: Reference service initialized: ${!!this.referenceDataService}`);
      if (this.db) {
        // Check if packages collection exists and log count
        try {
          const packagesCount = await this.db.collection('packages').countDocuments();
          this.writeToLog(`    Debug: packages collection has ${packagesCount} documents`);
        } catch (countError) {
          this.writeToLog(`    Debug: Error counting packages: ${countError}`);
        }
      }
      return null;
    } catch (error) {
      this.writeToLog(`    ❌ Error fetching package ${packageId}: ${error}`);
      return null;
    }
  }

  /**
   * Expands package tickets in registration data
   * @param tickets - Array of tickets that may contain packages
   * @returns Array with package tickets expanded
   */
  private async expandRegistrationTickets(tickets: any[]): Promise<any[]> {
    const expandedTickets = [];
    
    for (const ticket of tickets) {
      if (ticket.isPackage === true) {
        // Get package details and expand
        const packageId = ticket.packageId || ticket.eventTicketId;
        const packageDetails = await this.getPackageDetails(packageId);
        
        if (packageDetails?.includedItems) {
          // Create individual tickets for each item in the package
          for (const item of packageDetails.includedItems) {
            const expandedTicket = {
              id: `${ticket.id}_${item.eventTicketId}`,
              eventTicketId: item.eventTicketId,
              functionId: item.functionId,
              attendeeId: ticket.attendeeId,
              price: item.price || 0,
              quantity: item.quantity || 1,
              isFromPackage: true,
              originalPackageId: packageId,
              originalPackageTicketId: ticket.id
            };
            expandedTickets.push(expandedTicket);
          }
          this.writeToLog(`    📦 Expanded package ${packageId} into ${packageDetails.includedItems.length} tickets in registration`);
        } else {
          // If we can't expand, keep the original ticket but mark it
          expandedTickets.push({
            ...ticket,
            couldNotExpand: true
          });
          this.writeToLog(`    ⚠️ Could not expand package ${packageId} - keeping original ticket`);
        }
      } else {
        // Non-package ticket, keep as-is
        expandedTickets.push(ticket);
      }
    }
    
    return expandedTickets;
  }

  /**
   * Expands a package ticket into individual ticket items based on package contents
   * This function ONLY expands packages - it does NOT create the final ticket structure
   * @param packageTicket - The package ticket containing isPackage flag and packageId  
   * @returns Array of expanded ticket items (raw data, not final ticket objects)
   */
  private async expandPackageIntoItems(packageTicket: any): Promise<any[]> {
    try {
      const packageId = packageTicket.packageId || packageTicket.eventTicketId || packageTicket.ticketId || packageTicket.id;
      
      if (!packageId) {
        this.writeToLog(`    ⚠️ Package ticket missing packageId, returning original ticket`);
        // Return the original ticket if we can't identify the package
        return [packageTicket];
      }
      
      this.writeToLog(`    🔍 Looking up package: ${packageId}`);
      
      // Get package details from reference data service
      const packageDetails = await this.referenceDataService.getPackageDetails(packageId);
      
      if (!packageDetails || !packageDetails.includedItems || packageDetails.includedItems.length === 0) {
        this.writeToLog(`    ⚠️ No package details or included items found for package ${packageId}`);
        // Return the original ticket if we can't expand it
        return [packageTicket];
      }
      
      this.writeToLog(`    📦 Expanding package ${packageDetails.name} with ${packageDetails.includedItems.length} items`);
      
      const expandedItems: any[] = [];
      
      // Create a ticket item for each included item in the package
      for (let i = 0; i < packageDetails.includedItems.length; i++) {
        const item = packageDetails.includedItems[i];
        
        // Create an expanded ticket item that preserves the original ticket's data
        // but replaces the package reference with the individual event ticket
        const expandedItem = {
          // Preserve all original ticket fields including attendeeId
          ...packageTicket,
          // Override with individual item details
          eventTicketId: item.eventTicketId,
          ticketId: `${packageTicket.ticketId || packageId}_item_${i}`,
          price: item.price || 0,
          quantity: item.quantity || 1,
          // Mark that this came from a package
          isPackage: false,
          isFromPackage: true,
          parentPackageId: packageId,
          originalPackageTicket: packageTicket.ticketId || packageTicket.id
        };
        
        expandedItems.push(expandedItem);
      }
      
      this.writeToLog(`    ✓ Expanded package into ${expandedItems.length} individual items`);
      return expandedItems;
      
    } catch (error) {
      this.writeToLog(`    ❌ Error expanding package ticket: ${error}`);
      // Return the original ticket if expansion fails
      return [packageTicket];
    }
  }

  /**
   * DEPRECATED - Replaced with expandPackageIntoItems
   * @deprecated
   */
  private async expandPackageTickets_OLD(packageTicket: any, ownerId: string): Promise<any[]> {
    const expandedTickets: any[] = [];
    
    try {
      // Get package details
      const packageId = packageTicket.packageId || packageTicket.eventTicketId;
      const packageDetails = await this.getPackageDetails(packageId);
      
      if (!packageDetails || !packageDetails.includedItems) {
        this.writeToLog(`    ⚠️ No package details or included items found for package ${packageId}`);
        // Return the original ticket if we can't expand it
        return [{
          ...packageTicket,
          ownerId,
          ownerType: 'individual'
        }];
      }
      
      this.writeToLog(`    📦 Expanding package ${packageDetails.name} with ${packageDetails.includedItems.length} items`);
      
      // Create a ticket for each included item
      for (const item of packageDetails.includedItems) {
        const expandedTicket = {
          ticketId: `${packageTicket.ticketId || packageTicket.id}_${item.eventTicketId}`,
          eventTicketId: item.eventTicketId,
          functionId: item.functionId,
          attendeeId: packageTicket.attendeeId,
          ownerId,
          ownerType: 'individual',
          registrationId: packageTicket.registrationId,
          status: packageTicket.status || 'active',
          price: item.price || 0,
          quantity: item.quantity || 1,
          packageId: packageId,
          isFromPackage: true,
          originalPackageTicket: packageTicket.ticketId || packageTicket.id,
          createdAt: packageTicket.createdAt || new Date(),
          updatedAt: new Date()
        };
        
        expandedTickets.push(expandedTicket);
        this.writeToLog(`      ✅ Created ticket from package: ${expandedTicket.eventTicketId}`);
      }
      
      this.writeToLog(`    📦 Expanded ${expandedTickets.length} tickets from package`);
    } catch (error) {
      this.writeToLog(`    ❌ Error expanding package tickets: ${error}`);
      // Return the original ticket if expansion fails
      return [{
        ...packageTicket,
        ownerId,
        ownerType: 'individual'
      }];
    }
    
    return expandedTickets;
  }

  /**
   * Performs selective sync from import collections to production collections
   * Based on field-by-field comparison using timestamps and productionMeta
   */
  public async performSelectiveSync(): Promise<void> {
    this.writeToLog('\n=== STARTING SELECTIVE PRODUCTION SYNC ===');
    
    const db = await this.connectToMongoDB();
    
    // Define collection mappings for sync
    const collectionMappings = [
      { import: 'import_payments', production: 'payments', idField: 'id' },
      { import: 'import_registrations', production: 'registrations', idField: 'id' },
      { import: 'import_attendees', production: 'attendees', idField: 'attendeeId' },
      { import: 'import_tickets', production: 'tickets', idField: 'ticketId' },
      { import: 'import_contacts', production: 'contacts', idField: 'email' }, // Changed to email for unified deduplication
      { import: 'import_customers', production: 'customers', idField: 'hash' }
    ];

    for (const mapping of collectionMappings) {
      await this.syncCollectionSelectively(db, mapping);
    }

    this.writeToLog('=== SELECTIVE PRODUCTION SYNC COMPLETED ===\n');
  }

  private async syncCollectionSelectively(
    db: Db, 
    mapping: { import: string; production: string; idField: string }
  ): Promise<void> {
    this.writeToLog(`\n--- Syncing ${mapping.import} -> ${mapping.production} ---`);
    
    let processedCount = 0;
    let updatedCount = 0;
    let createdCount = 0;
    let skippedForProduction = 0;

    try {
      // Get all documents from import collection
      const importDocs = await db.collection(mapping.import).find({}).toArray();
      this.writeToLog(`Found ${importDocs.length} documents in ${mapping.import}`);

      for (const importDoc of importDocs) {
        const importId = importDoc[mapping.idField];
        if (!importId) {
          this.writeToLog(`  ⚠️ Skipping document missing ${mapping.idField}`);
          continue;
        }

        // Check if document should move to production
        if (importDoc._shouldMoveToProduction === false) {
          this.writeToLog(`  📝 Skipping ${importId} - not eligible for production sync`);
          skippedForProduction++;
          continue;
        }

        // Check if we've already synced this document (using productionObjectId)
        let productionDoc = null;
        if (importDoc._productionMeta?.productionObjectId) {
          productionDoc = await db.collection(mapping.production).findOne({
            _id: importDoc._productionMeta.productionObjectId
          });
        }
        
        // If not found by production ID, try to find by original ID for backward compatibility
        if (!productionDoc && importDoc.originalAttendeeId) {
          productionDoc = await db.collection(mapping.production).findOne({
            [mapping.idField]: importDoc.originalAttendeeId
          });
        } else if (!productionDoc && importDoc.originalTicketId) {
          productionDoc = await db.collection(mapping.production).findOne({
            [mapping.idField]: importDoc.originalTicketId
          });
        }

        if (!productionDoc) {
          // Create new production document with new IDs
          const newDoc = await this.createProductionDocument(importDoc, mapping);
          
          // Insert the new production document
          const insertResult = await db.collection(mapping.production).insertOne(newDoc);
          
          // Update import document with production reference
          await db.collection(mapping.import).updateOne(
            { _id: importDoc._id },
            { 
              $set: { 
                '_productionMeta.productionObjectId': insertResult.insertedId,
                '_productionMeta.syncedAt': new Date()
              }
            }
          );
          
          createdCount++;
          this.writeToLog(`  ✅ Created new ${mapping.production} document: ${newDoc[mapping.idField]}`);
        } else {
          // Perform selective field update
          const importMeta = importDoc._productionMeta as ProductionMeta;
          if (!importMeta) {
            this.writeToLog(`  ⚠️ No production metadata for ${importId}, skipping`);
            continue;
          }

          let { updateFields, hasChanges } = createSelectiveUpdate(
            importDoc,
            productionDoc,
            importMeta
          );

          // Special handling for registrations - expand package tickets
          if (mapping.production === 'registrations') {
            if (updateFields.registrationData?.tickets) {
              updateFields.registrationData.tickets = await this.expandRegistrationTickets(updateFields.registrationData.tickets);
              hasChanges = true;
            }
            if (updateFields.registration_data?.tickets) {
              updateFields.registration_data.tickets = await this.expandRegistrationTickets(updateFields.registration_data.tickets);
              hasChanges = true;
            }
          }

          if (hasChanges) {
            // Update production document
            await db.collection(mapping.production).updateOne(
              { _id: productionDoc._id },
              { $set: updateFields }
            );

            // Update import document with production reference
            await db.collection(mapping.import).updateOne(
              { _id: importDoc._id },
              { 
                $set: { 
                  '_productionMeta.productionObjectId': productionDoc._id,
                  '_productionMeta.lastSyncedAt': new Date()
                }
              }
            );

            updatedCount++;
            this.writeToLog(`  🔄 Updated ${mapping.production} document: ${productionDoc[mapping.idField]}`);
          } else {
            this.writeToLog(`  ⏭️ No changes needed for: ${productionDoc[mapping.idField]}`);
          }
        }

        processedCount++;
      }

      this.writeToLog(`✅ ${mapping.import} sync complete: ${processedCount} processed, ${createdCount} created, ${updatedCount} updated, ${skippedForProduction} skipped (not production eligible)`);
      
    } catch (error: any) {
      this.writeToLog(`❌ Error syncing ${mapping.import}: ${error.message}`);
    }
  }

  private async createProductionDocument(
    importDoc: any,
    mapping: { import: string; production: string; idField: string }
  ): Promise<any> {
    const db = this.db!;
    const newDoc = { ...importDoc };
    
    // Remove import-specific fields
    delete newDoc._id; // Will get new ObjectId on insert
    delete newDoc._productionMeta;
    delete newDoc.Id; // Remove any duplicate Id field if it exists
    
    // Generate new production IDs based on collection type
    if (mapping.production === 'attendees') {
      // Use original external ID directly (not prefixed with "prod_")
      const originalId = newDoc.originalAttendeeId;
      if (originalId) {
        newDoc.attendeeId = originalId;
      }
      
      // Map registration IDs to production IDs
      if (newDoc.registrations && Array.isArray(newDoc.registrations)) {
        for (const reg of newDoc.registrations) {
          // Keep the registration ID as-is (it should already be mapped)
          // Function IDs remain unchanged (constant collections)
        }
      }
      
      // Map importTicketId references in eventTickets to production ticket ObjectIds
      if (newDoc.eventTickets && Array.isArray(newDoc.eventTickets)) {
        for (const eventTicket of newDoc.eventTickets) {
          if (eventTicket.importTicketId) {
            // Find the production ticket ObjectId for this import ticket
            const productionTicket = await db.collection('tickets').findOne({
              '_productionMeta': { $exists: true },
              '_productionMeta.productionObjectId': { $exists: true }
            });
            
            // For now, just remove the importTicketId field since we need proper mapping logic
            // TODO: Implement proper import ticket to production ticket ObjectId mapping
            delete eventTicket.importTicketId;
          }
        }
      }
    } 
    else if (mapping.production === 'tickets') {
      // Use original external ID directly (not prefixed with "prod_")
      const originalId = newDoc.originalTicketId;
      if (originalId) {
        newDoc.ticketId = originalId;
      }
      
      // No mapping needed for ticketOwner.ownerId as it's already a clean customerId UUID
      // ticketHolder.attendeeId is also already a clean UUID or empty string
      
      // Map details.attendeeId if it exists (for backward compatibility)
      if (newDoc.details?.attendeeId && newDoc.details.attendeeId.startsWith('import_')) {
        // Find the original attendee ID from the import_attendees collection
        const importAttendee = await db.collection('import_attendees').findOne({ attendeeId: newDoc.details.attendeeId });
        if (importAttendee?.originalAttendeeId) {
          newDoc.details.attendeeId = importAttendee.originalAttendeeId;
        }
      }
      
      // Event ticket IDs remain unchanged (constant collections)
    }
    else if (mapping.production === 'registrations') {
      // Registrations keep their original IDs but need to update references
      // to attendees and tickets
      // Also expand package tickets in registrationData
      if (newDoc.registrationData?.tickets) {
        newDoc.registrationData.tickets = await this.expandRegistrationTickets(newDoc.registrationData.tickets);
      }
      
      // Same for registration_data (snake_case version)
      if (newDoc.registration_data?.tickets) {
        newDoc.registration_data.tickets = await this.expandRegistrationTickets(newDoc.registration_data.tickets);
      }
    }
    else if (mapping.production === 'payments') {
      // Payments keep their original IDs
      // Registration references stay the same within the same stage
    }
    
    // Add production metadata
    newDoc._importMeta = {
      importObjectId: importDoc._id,
      importedFrom: mapping.import,
      importedAt: new Date(),
      lastSyncedAt: new Date()
    };
    
    return newDoc;
  }

  private async fetchTicketsFromRegistration(registrationId: string, registration?: any, customerData?: any): Promise<any[]> {
    try {
      // Extract tickets from registration_data field - check both 'tickets' and 'selectedTickets'
      let ticketsFromData = registration?.registration_data?.tickets || 
                           registration?.registration_data?.selectedTickets || 
                           registration?.registrationData?.tickets || 
                           registration?.registrationData?.selectedTickets;
      
      if (ticketsFromData && ticketsFromData.length > 0) {
        const ticketSource = registration?.registration_data?.tickets ? 'tickets' : 
                            registration?.registration_data?.selectedTickets ? 'selectedTickets' :
                            registration?.registrationData?.tickets ? 'tickets (registrationData)' : 
                            'selectedTickets (registrationData)';
        this.writeToLog(`    Extracting ${ticketsFromData.length} tickets from registration_data.${ticketSource}`);
        
        // STEP 1: First expand any package tickets into individual tickets
        const expandedTicketsArray = [];
        for (const ticket of ticketsFromData) {
          if (ticket.isPackage === true) {
            this.writeToLog(`    📦 Package ticket detected: ${ticket.packageId || ticket.eventTicketId}`);
            
            // Use the consolidated expandPackageIntoItems function
            const expandedItems = await this.expandPackageIntoItems(ticket);
            expandedTicketsArray.push(...expandedItems);
          } else {
            // Non-package ticket, keep as-is
            expandedTicketsArray.push(ticket);
          }
        }
        
        // Replace ticketsFromData with the expanded array
        ticketsFromData = expandedTicketsArray;
        
        if (expandedTicketsArray.length !== ticketsFromData.length) {
          this.writeToLog(`    ✓ Expanded tickets array now contains ${expandedTicketsArray.length} items`);
        }
        this.writeToLog(`    Total tickets after expansion: ${ticketsFromData.length}`);
        
        // STEP 2: Process all tickets (both original and expanded) through normal flow
        const processedTickets = [];
        
        for (const ticket of ticketsFromData) {
          
          // Check what eventTicketId field is available and track which field was used
          let eventTicketId: string | undefined;
          let fieldUsed: string = '';
          
          if (ticket.eventTicketId) {
            eventTicketId = ticket.eventTicketId;
            fieldUsed = 'eventTicketId';
          } else if (ticket.event_ticket_id) {
            eventTicketId = ticket.event_ticket_id;
            fieldUsed = 'event_ticket_id';
          } else if (ticket.ticketId) {
            eventTicketId = ticket.ticketId;
            fieldUsed = 'ticketId';
          } else if (ticket.id) {
            eventTicketId = ticket.id;
            fieldUsed = 'id';
          }
          
          if (!eventTicketId) {
            this.writeToLog(`    ⚠️ Ticket missing eventTicketId. Available fields: ${Object.keys(ticket).join(', ')}`);
          } else if (fieldUsed !== 'eventTicketId') {
            // Log when we use a fallback field
            this.writeToLog(`    📝 Using ${fieldUsed} for eventTicketId: ${eventTicketId}`);
          }
          
          // Try to fetch event ticket details from event_tickets collection or Supabase
          const eventTicketDetails = await this.fetchEventTicketDetails(eventTicketId);
          
          // Check for missing attendeeId and log warning
          if (!ticket.attendeeId) {
            this.writeToLog(`    ⚠️ Ticket missing attendeeId (eventTicketId: ${eventTicketId}), using registrationId as fallback`);
          }
          
          // Find the attendee index based on the ticket's attendeeId
          const attendeeIndex = registration.registration_data?.attendees?.findIndex(
            (a: any) => a.attendeeId === ticket.attendeeId || a.id === ticket.attendeeId
          ) ?? 0;
          
          // Determine ticket ownership and holder
          const hasAttendee = !!ticket.attendeeId;
          
          // Create ticketOwner object - always based on the customer who purchased
          const ticketOwner = {
            ownerId: customerData?.customerId || '', // Use the UUID customerId
            ownerType: customerData?.businessName ? 'organisation' : 'contact',
            customerBusinessName: customerData?.businessName || null,
            customerName: customerData ? `${customerData.firstName} ${customerData.lastName}`.trim() : null
          };
          
          // Create ticketHolder object - who actually holds/uses the ticket
          const ticketHolder = {
            attendeeId: hasAttendee ? (ticket.attendeeId || '') : '', // Use clean attendeeId or empty string
            holderStatus: 'current' as const,
            updatedDate: new Date()
          };
          
          // Determine if this is a lodge registration for quantity calculation
          const isLodgeRegistration = registration.registration_type === 'lodge' || registration.type === 'lodge';
          
          processedTickets.push({
            // Core identifiers - use clean UUIDs without prefixes
            // NO manual _id field - we only use _id for MongoDB documents
            ticketId: ticket.ticketId || ticket.id || `${registrationId}_ticket_${ticketsFromData.indexOf(ticket)}`, // Use original ticketId if available
            originalTicketId: ticket.id || ticket.ticketId || `${ticket.attendeeId || registrationId}-${eventTicketId}`, // Preserve original ID
            eventTicketId: eventTicketId, // Reference to constant collection (allowed)
            ticketNumber: ticket.ticketNumber || `TKT-${Date.now()}${ticketsFromData.indexOf(ticket)}`,
            
            // Event details - from event ticket lookup or defaults
            eventName: eventTicketDetails?.eventName || eventTicketDetails?.name || 'Unknown Event',
            // Always use price from eventTicketDetails if available, otherwise use ticket price or 0
            // Handle MongoDB Decimal128 price format: { "$numberDecimal": "115" }
            price: eventTicketDetails?.price !== undefined 
              ? (eventTicketDetails.price && typeof eventTicketDetails.price === 'object' && eventTicketDetails.price.$numberDecimal 
                  ? parseFloat(eventTicketDetails.price.$numberDecimal) 
                  : eventTicketDetails.price)
              : (ticket.price || 0),
            // Quantity logic: 
            // - For individual registrations: always 1
            // - For lodge registrations: use ticket.quantity, or calculate from subtotal/115 if not specified
            quantity: isLodgeRegistration 
              ? (ticket.quantity || Math.round((registration.subtotal || registration.total_amount_paid || 0) / 115))
              : 1,
            
            // Ticket ownership and holder
            ticketOwner: ticketOwner,
            ticketHolder: ticketHolder,
            
            // Status - based on payment status (paid or completed = sold)
            status: (registration.payment_status === 'paid' || registration.payment_status === 'completed') ? 'sold' : 
                   registration.payment_status === 'refunded' ? 'cancelled' : 'pending',
            
            // Attributes
            attributes: eventTicketDetails?.attributes || [],
            
            // Details
            details: {
              registrationId: registration.registration_id || registrationId, // Clean UUID
              bookingContactId: registration.booking_contact_id || null,
              attendeeId: hasAttendee ? (ticket.attendeeId || null) : null, // Use clean attendeeId
              originalAttendeeId: ticket.attendeeId || null, // Preserve original
              isPackage: ticket.isPackage || false,
              // No invoice yet - will be created when invoice is actually generated
              paymentId: registration.stripe_payment_intent_id || registration.square_payment_id || ''
            },
            
            // Timestamps
            createdAt: registration.created_at || new Date().toISOString(),
            modifiedAt: new Date(),
            
            // Modification tracking
            modificationHistory: [{
              type: 'creation',
              changes: [
                {
                  field: 'status',
                  from: null,
                  to: (registration.payment_status === 'paid' || registration.payment_status === 'completed') ? 'sold' : 'pending'
                },
                {
                  field: 'price',
                  from: null,
                  to: eventTicketDetails?.price !== undefined 
                    ? (eventTicketDetails.price && typeof eventTicketDetails.price === 'object' && eventTicketDetails.price.$numberDecimal 
                        ? parseFloat(eventTicketDetails.price.$numberDecimal) 
                        : eventTicketDetails.price)
                    : (ticket.price || 0)
                }
              ],
              description: 'Ticket extracted from registration during sync',
              timestamp: new Date(),
              userId: 'system-sync',
              source: 'enhanced-payment-sync'
            }]
            // No QR code yet - will be generated when needed
          });
        }
        
        this.writeToLog(`    📦 Returning ${processedTickets.length} processed tickets from registration_data`);
        return processedTickets;
      }
      
      // No tickets in registration_data - return empty array
      this.writeToLog(`    ℹ️ No tickets found in registration_data`);
      return [];
    } catch (error) {
      this.writeToLog(`Error fetching tickets: ${error}`);
      return [];
    }
  }

  /**
   * DEPRECATED - Second duplicate function
   * @deprecated
   */
  private async expandPackageTickets_OLD2(packageTicket: any, attendeeId: string): Promise<any[]> {
    try {
      const packageId = packageTicket.packageId || packageTicket.eventTicketId || packageTicket.ticketId;
      
      if (!packageId) {
        this.writeToLog(`    ⚠️ Package ticket missing packageId`);
        return [];
      }
      
      this.writeToLog(`    🔍 Looking up package: ${packageId}`);
      
      // Query packages collection for package details
      const db = await this.connectToMongoDB();
      const packageDoc = await db.collection('packages').findOne({ packageId: packageId });
      
      if (!packageDoc) {
        this.writeToLog(`    ⚠️ Package ${packageId} not found in packages collection`);
        return [];
      }
      
      const includedItems = packageDoc.includedItems || [];
      this.writeToLog(`    📦 Package contains ${includedItems.length} items`);
      
      const expandedTickets = [];
      
      for (let i = 0; i < includedItems.length; i++) {
        const item = includedItems[i];
        
        // Fetch event ticket details for this item
        const eventTicketDetails = await this.fetchEventTicketDetails(item.eventTicketId);
        
        const expandedTicket = {
          // Core identifiers
          ticketId: `${packageTicket.ticketId || packageId}_item_${i}`,
          originalTicketId: `${packageTicket.id || packageId}_expanded_${item.eventTicketId}`,
          eventTicketId: item.eventTicketId,
          ticketNumber: `PKG-${Date.now()}-${i}`,
          
          // Event details
          eventName: eventTicketDetails?.eventName || eventTicketDetails?.name || item.name || 'Unknown Event',
          price: eventTicketDetails?.price !== undefined 
            ? (eventTicketDetails.price && typeof eventTicketDetails.price === 'object' && eventTicketDetails.price.$numberDecimal 
                ? parseFloat(eventTicketDetails.price.$numberDecimal) 
                : eventTicketDetails.price)
            : (item.price || 0),
          quantity: item.quantity || 1,
          
          // Owner info - inherit from package ticket
          ownerType: 'individual',
          ownerId: attendeeId,
          
          // Status - inherit from package
          status: packageTicket.status || 'pending',
          
          // Attributes
          attributes: eventTicketDetails?.attributes || [],
          
          // Details
          details: {
            ...packageTicket.details,
            isPackage: false,
            parentPackageId: packageId,
            attendeeId: attendeeId,
            originalAttendeeId: packageTicket.attendeeId || null
          },
          
          // Timestamps
          createdAt: packageTicket.createdAt || new Date().toISOString(),
          modifiedAt: new Date(),
          
          // Modification tracking
          modificationHistory: [{
            type: 'package_expansion',
            changes: [
              {
                field: 'expanded_from_package',
                from: null,
                to: packageId
              },
              {
                field: 'eventTicketId',
                from: null,
                to: item.eventTicketId
              }
            ],
            description: `Ticket expanded from package ${packageId} during sync`,
            timestamp: new Date(),
            userId: 'system-sync',
            source: 'enhanced-payment-sync-package-expansion'
          }]
        };
        
        expandedTickets.push(expandedTicket);
        this.writeToLog(`    ✓ Expanded package item: ${item.eventTicketId} -> ${expandedTicket.eventName}`);
      }
      
      this.writeToLog(`    📦 Successfully expanded package ${packageId} into ${expandedTickets.length} individual tickets`);
      return expandedTickets;
      
    } catch (error: any) {
      this.writeToLog(`    ❌ Error expanding package ticket: ${error.message}`);
      return [];
    }
  }

  private async runErrorVerification(): Promise<void> {
    try {
      this.writeToLog('\n🔍 Starting Error Verification...');
      this.writeToLog('Checking error documents against test database...\n');
      
      // Import the verification service
      const { ErrorVerificationService } = await import('./error-verification-service.js');
      
      const verificationService = new ErrorVerificationService();
      
      // Get MongoDB URIs - use the same connection string but point to test DB
      const importUri = process.env.MONGODB_URI || '';
      // For test DB, we use the same cluster but different database
      const testUri = importUri ? importUri.replace('/lodgetix', '/lodgetix-test') : '';
      
      // Connect and run verification
      await verificationService.connect(importUri, testUri);
      const report = await verificationService.runFullVerification();
      
      // Log verification summary
      this.writeToLog('\n📊 VERIFICATION RESULTS:');
      this.writeToLog(`Error Payments - Found: ${report.stats.errorPayments.found}, Not Found: ${report.stats.errorPayments.notFound}`);
      this.writeToLog(`Error Registrations - Found: ${report.stats.errorRegistrations.found}, Not Found: ${report.stats.errorRegistrations.notFound}`);
      this.writeToLog(`Orphaned Registrations - Found: ${report.stats.orphanedRegistrations.found}, Not Found: ${report.stats.orphanedRegistrations.notFound}`);
      
      const totalErrors = report.stats.errorPayments.total + report.stats.errorRegistrations.total + report.stats.orphanedRegistrations.total;
      const totalFound = report.stats.errorPayments.found + report.stats.errorRegistrations.found + report.stats.orphanedRegistrations.found;
      const totalNotFound = report.stats.errorPayments.notFound + report.stats.errorRegistrations.notFound + report.stats.orphanedRegistrations.notFound;
      
      if (totalErrors > 0) {
        const foundPercentage = ((totalFound / totalErrors) * 100).toFixed(2);
        this.writeToLog(`\n📈 Overall: ${foundPercentage}% of error documents exist in test DB`);
        
        if (parseFloat(foundPercentage) > 70) {
          this.writeToLog('⚠️  High found rate suggests sync is working but error handling needs review');
        } else if (parseFloat(foundPercentage) < 30) {
          this.writeToLog('⚠️  Low found rate indicates genuine sync failures');
        }
      }
      
      await verificationService.disconnect();
      this.writeToLog('✅ Error verification completed\n');
      
    } catch (error: any) {
      this.writeToLog(`⚠️  Error verification failed: ${error.message}`);
      this.writeToLog('Continuing without verification...\n');
      // Don't throw - verification is optional and shouldn't stop the sync
    }
  }
}

export default EnhancedPaymentSyncService;