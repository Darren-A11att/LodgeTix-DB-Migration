import { MongoClient, Db, Collection } from 'mongodb';
import Stripe from 'stripe';
import { SquareClient, SquareEnvironment } from 'square';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

interface PaymentProvider {
  name: string;
  type: 'stripe' | 'square';
  client: Stripe | SquareClient;
  accountId?: string;
}

interface PaymentRecord {
  id: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  created: Date;
  metadata: any;
  paymentIntentId?: string;
  orderId?: string;
}

interface Registration {
  id: string;
  stripe_payment_intent_id?: string;
  square_order_id?: string;
  status: string;
  user_id: string;
  event_id: string;
  created_at: Date;
  updated_at: Date;
  metadata: any;
}

interface Attendee {
  id: string;
  registration_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  created_at: Date;
  metadata: any;
}

interface Ticket {
  id: string;
  attendee_id: string;
  event_id: string;
  ticket_type: string;
  status: string;
  price: number;
  created_at: Date;
  metadata: any;
}

export class UnifiedPaymentSyncService {
  private db: Db | null = null;
  private mongoClient: MongoClient | null = null;
  private supabase: any;
  private providers: PaymentProvider[] = [];
  private processedCount = 0;
  private errorCount = 0;
  private skippedCount = 0;
  private failureLog: string[] = [];
  private logFilePath: string;

  constructor() {
    this.initializeSupabase();
    this.initializePaymentProviders();
    this.initializeLogging();
  }

  private initializeLogging() {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'sync-logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = path.join(logsDir, `sync-failures-${timestamp}.log`);
    
    // Write header
    this.writeToLog('=== PAYMENT SYNC FAILURE LOG ===');
    this.writeToLog(`Started at: ${new Date().toISOString()}`);
    this.writeToLog('This log contains payments that FAILED (not skipped)\n');
  }

  private writeToLog(message: string) {
    const logMessage = `${message}\n`;
    this.failureLog.push(message);
    fs.appendFileSync(this.logFilePath, logMessage);
  }

  private initializeSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✓ Supabase client initialized');
  }

  private initializePaymentProviders() {
    // IMPORTANT: Initialize Square FIRST - it must be processed before Stripe accounts
    if (process.env.SQUARE_ACCESS_TOKEN) {
      // Determine Square environment based on token or environment variable
      const isSandbox = process.env.SQUARE_ACCESS_TOKEN.startsWith('EAAA') || 
                        process.env.SQUARE_ENVIRONMENT === 'sandbox';
      
      this.providers.push({
        name: 'Square',
        type: 'square',
        client: new SquareClient({
          token: process.env.SQUARE_ACCESS_TOKEN,
          environment: isSandbox ? SquareEnvironment.Sandbox : SquareEnvironment.Production
        })
      });
      console.log('✓ Square provider initialized (will be processed first)');
    }

    // Initialize Stripe accounts AFTER Square
    // Initialize Stripe Account 1
    if (process.env.STRIPE_ACCOUNT_1_SECRET_KEY) {
      this.providers.push({
        name: process.env.STRIPE_ACCOUNT_1_NAME || 'Stripe Account 1',
        type: 'stripe',
        client: new Stripe(process.env.STRIPE_ACCOUNT_1_SECRET_KEY, {
          apiVersion: '2024-11-20.acacia'
        }),
        accountId: 'stripe_account_1'
      });
      console.log(`✓ Stripe Account 1 (${process.env.STRIPE_ACCOUNT_1_NAME}) initialized`);
    }

    // Initialize Stripe Account 2
    if (process.env.STRIPE_ACCOUNT_2_SECRET_KEY) {
      this.providers.push({
        name: process.env.STRIPE_ACCOUNT_2_NAME || 'Stripe Account 2',
        type: 'stripe',
        client: new Stripe(process.env.STRIPE_ACCOUNT_2_SECRET_KEY, {
          apiVersion: '2024-11-20.acacia'
        }),
        accountId: 'stripe_account_2'
      });
      console.log(`✓ Stripe Account 2 (${process.env.STRIPE_ACCOUNT_2_NAME}) initialized`);
    }

    // Initialize Stripe Account 3
    if (process.env.STRIPE_ACCOUNT_3_SECRET_KEY) {
      this.providers.push({
        name: process.env.STRIPE_ACCOUNT_3_NAME || 'Stripe Account 3',
        type: 'stripe',
        client: new Stripe(process.env.STRIPE_ACCOUNT_3_SECRET_KEY, {
          apiVersion: '2024-11-20.acacia'
        }),
        accountId: 'stripe_account_3'
      });
      console.log(`✓ Stripe Account 3 (${process.env.STRIPE_ACCOUNT_3_NAME}) initialized`);
    }

    console.log(`\nInitialized ${this.providers.length} payment provider(s)`);
  }

  private async connectToMongoDB(): Promise<Db> {
    if (!this.db) {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      this.mongoClient = new MongoClient(uri);
      await this.mongoClient.connect();
      const dbName = process.env.MONGODB_DB || 'lodgetix';
      this.db = this.mongoClient.db(dbName);
      console.log(`✓ Connected to MongoDB database: ${dbName}`);
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

  /**
   * Main sync method - processes all payments sequentially
   */
  public async syncAllPayments(options: { limit?: number } = {}): Promise<void> {
    console.log('\n=== STARTING UNIFIED PAYMENT SYNC ===');
    console.log('Processing all payments sequentially with complete data flow\n');
    
    const db = await this.connectToMongoDB();
    
    // Ensure collections exist
    await this.ensureCollections(db);
    
    // Process each provider sequentially
    for (const provider of this.providers) {
      console.log(`\n━━━ Processing payments from ${provider.name} ━━━`);
      
      try {
        if (provider.type === 'stripe') {
          await this.processStripePayments(provider, db, options);
        } else if (provider.type === 'square') {
          await this.processSquarePayments(provider, db, options);
        }
      } catch (error: any) {
        // If Square fails with auth error, log and continue with other providers
        if (provider.type === 'square' && error.statusCode === 401) {
          console.log(`   ⚠️  Square authentication failed - skipping Square payments`);
          console.log(`   Note: This is likely a sandbox token without access to production payments`);
          this.errorCount++;
        } else {
          // Re-throw other errors
          throw error;
        }
      }
    }

    console.log('\n=== SYNC COMPLETE ===');
    console.log(`✅ Processed: ${this.processedCount}`);
    console.log(`⏭️  Skipped: ${this.skippedCount}`);
    console.log(`❌ Errors: ${this.errorCount}`);
    console.log(`📊 Total: ${this.processedCount + this.skippedCount + this.errorCount}`);
    
    // Write summary to log file
    this.writeToLog(`\n\n=== SYNC SUMMARY ===`);
    this.writeToLog(`Completed at: ${new Date().toISOString()}`);
    this.writeToLog(`Processed: ${this.processedCount}`);
    this.writeToLog(`Skipped: ${this.skippedCount}`);
    this.writeToLog(`Failed: ${this.errorCount}`);
    this.writeToLog(`Total: ${this.processedCount + this.skippedCount + this.errorCount}`);
    
    if (this.errorCount > 0) {
      console.log(`\n📝 Failure log saved to: ${this.logFilePath}`);
    }
  }

  private async ensureCollections(db: Db): Promise<void> {
    const collections = ['payments', 'registrations', 'attendees', 'tickets'];
    
    for (const collectionName of collections) {
      const colls = await db.listCollections({ name: collectionName }).toArray();
      if (colls.length === 0) {
        await db.createCollection(collectionName);
        console.log(`✓ Created collection: ${collectionName}`);
      }
    }
  }

  /**
   * Process all Stripe payments for a given account
   */
  private async processStripePayments(provider: PaymentProvider, db: Db, options: { limit?: number }): Promise<void> {
    const stripe = provider.client as Stripe;
    let hasMore = true;
    let startingAfter: string | undefined;
    let processedInProvider = 0;
    
    while (hasMore) {
      try {
        // Fetch batch of payment intents
        const paymentIntents = await stripe.paymentIntents.list({
          limit: Math.min(100, options.limit || 100),
          starting_after: startingAfter
        });

        // Process each payment intent individually
        for (const paymentIntent of paymentIntents.data) {
          await this.processSingleStripePayment(paymentIntent, provider, db);
          processedInProvider++;
          
          // Check if we've reached the limit
          if (options.limit && processedInProvider >= options.limit) {
            console.log(`Reached limit of ${options.limit} for ${provider.name}`);
            return;
          }
        }

        hasMore = paymentIntents.has_more;
        if (paymentIntents.data.length > 0) {
          startingAfter = paymentIntents.data[paymentIntents.data.length - 1].id;
        }
      } catch (error) {
        console.error(`Error fetching Stripe payments from ${provider.name}:`, error);
        this.errorCount++;
        break;
      }
    }
  }

  /**
   * Process a single Stripe payment completely
   */
  private async processSingleStripePayment(
    paymentIntent: Stripe.PaymentIntent,
    provider: PaymentProvider,
    db: Db
  ): Promise<void> {
    try {
      // Skip if not succeeded or already refunded
      if (paymentIntent.status !== 'succeeded') {
        console.log(`⏭️  Skipping ${paymentIntent.id} - status: ${paymentIntent.status}`);
        this.skippedCount++;
        return;
      }

      // Check if refunded
      if (paymentIntent.charges && paymentIntent.charges.data.length > 0) {
        const charge = paymentIntent.charges.data[0];
        if (charge.refunded) {
          console.log(`⏭️  Skipping ${paymentIntent.id} - refunded`);
          this.skippedCount++;
          return;
        }
      }

      console.log(`\n📝 Processing Stripe payment: ${paymentIntent.id}`);

      // Check if payment already exists in our target database
      const existingInTarget = await db.collection('payments').findOne({ id: paymentIntent.id });
      if (existingInTarget) {
        console.log(`   ⏭️  Already imported - skipping`);
        this.skippedCount++;
        return;
      }

      // 1. Fetch registration from Supabase
      const registration = await this.fetchRegistrationByStripeId(paymentIntent.id);
      
      if (!registration) {
        // Check if payment exists in the existing payments collection with updated status
        console.log(`   ⚠️  No registration in Supabase, checking existing payments collection...`);
        
        const existingPayment = await this.checkExistingPayment(paymentIntent.id, db);
        if (existingPayment) {
          console.log(`   ✓ Found in existing payments with status: ${existingPayment.status}`);
          
          // Check if the status indicates it was refunded or canceled
          if (existingPayment.status === 'refunded' || existingPayment.status === 'canceled' || existingPayment.status === 'failed') {
            console.log(`   ⏭️  Skipping - payment was ${existingPayment.status}`);
            this.skippedCount++;
            return;
          }
        }
        
        console.error(`   ❌ CRITICAL ERROR: No registration found for payment ${paymentIntent.id}`);
        
        // Log this failure
        this.writeToLog(`\n===== FAILURE #${this.errorCount + 1} =====`);
        this.writeToLog(`Payment ID: ${paymentIntent.id}`);
        this.writeToLog(`Provider: ${provider.name}`);
        this.writeToLog(`Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency}`);
        this.writeToLog(`Created: ${new Date(paymentIntent.created * 1000).toISOString()}`);
        this.writeToLog(`Status: ${paymentIntent.status}`);
        this.writeToLog(`Reason: No registration found in Supabase and not in existing payments collection`);
        
        this.errorCount++;
        throw new Error(`Registration not found for payment ${paymentIntent.id} - terminating sync`);
      }
      console.log(`   ✓ Found registration: ${registration.id}`);

      // 2. Update registration status based on payment status
      if (registration.status !== 'paid' && registration.status !== 'completed') {
        await this.updateRegistrationStatus(registration.id, 'paid');
        registration.status = 'paid';
        console.log(`   ✓ Updated registration status to: paid`);
      }

      // 3. Store payment in MongoDB
      const paymentRecord: PaymentRecord = {
        id: paymentIntent.id,
        provider: provider.name,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        created: new Date(paymentIntent.created * 1000),
        metadata: paymentIntent.metadata || {},
        paymentIntentId: paymentIntent.id
      };
      
      await db.collection('payments').replaceOne(
        { id: paymentRecord.id },
        paymentRecord,
        { upsert: true }
      );
      console.log(`   ✓ Stored payment in MongoDB`);

      // 4. Store registration in MongoDB
      await db.collection('registrations').replaceOne(
        { id: registration.id },
        registration,
        { upsert: true }
      );
      console.log(`   ✓ Stored registration in MongoDB`);

      // 5. Fetch and store attendees
      const attendees = await this.fetchAttendeesByRegistration(registration.id);
      console.log(`   ✓ Found ${attendees.length} attendee(s)`);
      
      for (const attendee of attendees) {
        await db.collection('attendees').replaceOne(
          { id: attendee.id },
          attendee,
          { upsert: true }
        );

        // 6. Fetch and store tickets for each attendee
        const tickets = await this.fetchTicketsByAttendee(attendee.id);
        console.log(`      ✓ Found ${tickets.length} ticket(s) for attendee ${attendee.id}`);
        
        for (const ticket of tickets) {
          await db.collection('tickets').replaceOne(
            { id: ticket.id },
            ticket,
            { upsert: true }
          );
        }
      }

      this.processedCount++;
      console.log(`   ✅ Completed processing payment ${paymentIntent.id}`);
      
    } catch (error: any) {
      console.error(`   ❌ Error processing Stripe payment ${paymentIntent.id}:`, error);
      
      // Log failure if it's not a registration not found error (which is already logged)
      if (!error.message?.includes('Registration not found')) {
        this.writeToLog(`\n===== FAILURE #${this.errorCount + 1} =====`);
        this.writeToLog(`Payment ID: ${paymentIntent.id}`);
        this.writeToLog(`Provider: ${provider.name}`);
        this.writeToLog(`Error: ${error.message}`);
        this.writeToLog(`Stack: ${error.stack}`);
      }
      
      this.errorCount++;
    }
  }

  /**
   * Process all Square payments
   */
  private async processSquarePayments(provider: PaymentProvider, db: Db, options: { limit?: number }): Promise<void> {
    const square = provider.client as SquareClient;
    let cursor: string | undefined;
    let processedInProvider = 0;
    
    do {
      try {
        // Fetch batch of payments
        const response = await square.payments.list({
          limit: Math.min(100, options.limit || 100),
          cursor
        });

        if (response.payments) {
          // Process each payment individually
          for (const payment of response.payments) {
            await this.processSingleSquarePayment(payment, provider, db);
            processedInProvider++;
            
            // Check if we've reached the limit
            if (options.limit && processedInProvider >= options.limit) {
              console.log(`Reached limit of ${options.limit} for ${provider.name}`);
              return;
            }
          }
        }

        cursor = response.cursor;
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.error(`Square authentication error - likely using sandbox token for production API`);
          this.errorCount++;
          // Don't throw - just skip Square and continue
          return;
        }
        console.error(`Error fetching Square payments:`, error);
        this.errorCount++;
        break;
      }
    } while (cursor);
  }

  /**
   * Process a single Square payment completely
   */
  private async processSingleSquarePayment(
    payment: any,
    provider: PaymentProvider,
    db: Db
  ): Promise<void> {
    try {
      // Skip if not completed
      if (payment.status !== 'COMPLETED') {
        console.log(`⏭️  Skipping Square payment ${payment.id} - status: ${payment.status}`);
        this.skippedCount++;
        return;
      }

      // Check if refunded
      if (payment.refundedMoney && payment.refundedMoney.amount > 0) {
        console.log(`⏭️  Skipping Square payment ${payment.id} - refunded`);
        this.skippedCount++;
        return;
      }

      console.log(`\n📝 Processing Square payment: ${payment.id}`);

      // Check if payment already exists in our target database
      const existingInTarget = await db.collection('payments').findOne({ id: payment.id });
      if (existingInTarget) {
        console.log(`   ⏭️  Already imported - skipping`);
        this.skippedCount++;
        return;
      }

      // 1. Fetch registration from Supabase using payment ID
      const registration = await this.fetchRegistrationBySquareId(payment.id);
      if (!registration) {
        // Check if payment exists in the existing payments collection with updated status
        console.log(`   ⚠️  No registration in Supabase, checking existing payments collection...`);
        
        const existingPayment = await this.checkExistingPayment(payment.id, db);
        if (existingPayment) {
          console.log(`   ✓ Found in existing payments with status: ${existingPayment.status}`);
          
          // Check if the status indicates it was refunded or canceled
          if (existingPayment.status === 'refunded' || existingPayment.status === 'canceled' || existingPayment.status === 'failed') {
            console.log(`   ⏭️  Skipping - payment was ${existingPayment.status}`);
            this.skippedCount++;
            return;
          }
        }
        
        console.error(`   ❌ CRITICAL ERROR: No registration found for Square payment ${payment.id}`);
        
        // Log this failure
        this.writeToLog(`\n===== FAILURE #${this.errorCount + 1} =====`);
        this.writeToLog(`Payment ID: ${payment.id}`);
        this.writeToLog(`Provider: ${provider.name}`);
        this.writeToLog(`Amount: ${(payment.totalMoney?.amount || 0) / 100} ${payment.totalMoney?.currency || 'USD'}`);
        this.writeToLog(`Created: ${payment.createdAt}`);
        this.writeToLog(`Status: ${payment.status}`);
        this.writeToLog(`Reason: No registration found in Supabase and not in existing payments collection`);
        
        this.errorCount++;
        throw new Error(`Registration not found for Square payment ${payment.id} - terminating sync`);
      }
      console.log(`   ✓ Found registration: ${registration.id}`);

      // 2. Update registration status based on payment status
      if (registration.status !== 'paid' && registration.status !== 'completed') {
        await this.updateRegistrationStatus(registration.id, 'paid');
        registration.status = 'paid';
        console.log(`   ✓ Updated registration status to: paid`);
      }

      // 3. Store payment in MongoDB
      const paymentRecord: PaymentRecord = {
        id: payment.id,
        provider: provider.name,
        amount: (payment.totalMoney?.amount || 0) / 100, // Convert from cents
        currency: payment.totalMoney?.currency || 'USD',
        status: payment.status.toLowerCase(),
        created: new Date(payment.createdAt),
        metadata: payment.note ? { note: payment.note } : {},
        orderId: payment.orderId
      };
      
      await db.collection('payments').replaceOne(
        { id: paymentRecord.id },
        paymentRecord,
        { upsert: true }
      );
      console.log(`   ✓ Stored payment in MongoDB`);

      // 4. Store registration in MongoDB
      await db.collection('registrations').replaceOne(
        { id: registration.id },
        registration,
        { upsert: true }
      );
      console.log(`   ✓ Stored registration in MongoDB`);

      // 5. Fetch and store attendees
      const attendees = await this.fetchAttendeesByRegistration(registration.id);
      console.log(`   ✓ Found ${attendees.length} attendee(s)`);
      
      for (const attendee of attendees) {
        await db.collection('attendees').replaceOne(
          { id: attendee.id },
          attendee,
          { upsert: true }
        );

        // 6. Fetch and store tickets for each attendee
        const tickets = await this.fetchTicketsByAttendee(attendee.id);
        console.log(`      ✓ Found ${tickets.length} ticket(s) for attendee ${attendee.id}`);
        
        for (const ticket of tickets) {
          await db.collection('tickets').replaceOne(
            { id: ticket.id },
            ticket,
            { upsert: true }
          );
        }
      }

      this.processedCount++;
      console.log(`   ✅ Completed processing Square payment ${payment.id}`);
      
    } catch (error) {
      console.error(`   ❌ Error processing Square payment ${payment.id}:`, error);
      this.errorCount++;
    }
  }

  /**
   * Fetch registration from Supabase by Stripe payment intent ID
   */
  private async fetchRegistrationByStripeId(paymentIntentId: string): Promise<Registration | null> {
    try {
      const { data, error } = await this.supabase
        .from('registrations')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single();

      if (error || !data) {
        return null;
      }

      // Generate a unique ID from the payment intent ID if no id field exists
      const registrationId = data.id || data.stripe_payment_intent_id || paymentIntentId;

      return {
        id: registrationId,
        stripe_payment_intent_id: data.stripe_payment_intent_id,
        square_order_id: data.square_order_id,
        status: data.status || 'pending',
        user_id: data.user_id,
        event_id: data.event_id,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at),
        metadata: data.metadata || {}
      };
    } catch (error) {
      console.error(`Error fetching registration for Stripe ID ${paymentIntentId}:`, error);
      return null;
    }
  }

  /**
   * Fetch registration from Supabase by Square payment ID
   */
  private async fetchRegistrationBySquareId(paymentId: string): Promise<Registration | null> {
    try {
      // Square payments use payment ID in stripe_payment_intent_id field
      const { data, error } = await this.supabase
        .from('registrations')
        .select('*')
        .eq('stripe_payment_intent_id', paymentId)
        .single();

      if (error || !data) {
        return null;
      }

      // Generate a unique ID from the payment ID if no id field exists
      const registrationId = data.id || data.stripe_payment_intent_id || paymentId;

      return {
        id: registrationId,
        stripe_payment_intent_id: data.stripe_payment_intent_id,
        square_order_id: data.square_order_id,
        status: data.status || 'pending',
        user_id: data.user_id,
        event_id: data.event_id,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at),
        metadata: data.metadata || {}
      };
    } catch (error) {
      console.error(`Error fetching registration for Square ID ${paymentId}:`, error);
      return null;
    }
  }

  /**
   * Update registration status in Supabase
   */
  private async updateRegistrationStatus(registrationId: string, status: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('registrations')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', registrationId);

      if (error) {
        console.error(`Error updating registration status:`, error);
      }
    } catch (error) {
      console.error(`Error updating registration ${registrationId} status:`, error);
    }
  }

  /**
   * Check if payment exists in the existing payments collection
   * This is used to check for payments that were manually updated in MongoDB
   */
  private async checkExistingPayment(paymentId: string, db: Db): Promise<any> {
    try {
      // Try the LodgeTix-migration-test-1 database's payments collection
      const migrationDb = this.mongoClient?.db('LodgeTix-migration-test-1');
      if (migrationDb) {
        const payment = await migrationDb.collection('payments').findOne({
          $or: [
            { paymentId: paymentId },
            { payment_id: paymentId },
            { stripe_payment_intent_id: paymentId },
            { square_payment_id: paymentId }
          ]
        });
        
        if (payment) {
          return payment;
        }
      }
      
      // Also check the current database's payments collection
      const payment = await db.collection('payments').findOne({
        $or: [
          { id: paymentId },
          { paymentId: paymentId },
          { paymentIntentId: paymentId }
        ]
      });
      
      return payment;
    } catch (error) {
      console.error(`Error checking existing payment ${paymentId}:`, error);
      return null;
    }
  }

  /**
   * Fetch attendees from Supabase for a registration
   */
  private async fetchAttendeesByRegistration(registrationId: string): Promise<Attendee[]> {
    try {
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
        metadata: attendee.metadata || {}
      }));
    } catch (error) {
      console.error(`Error fetching attendees for registration ${registrationId}:`, error);
      return [];
    }
  }

  /**
   * Fetch tickets from Supabase for an attendee
   */
  private async fetchTicketsByAttendee(attendeeId: string): Promise<Ticket[]> {
    try {
      const { data, error } = await this.supabase
        .from('tickets')
        .select('*')
        .eq('attendee_id', attendeeId);

      if (error || !data) {
        return [];
      }

      return data.map((ticket: any) => ({
        id: ticket.id,
        attendee_id: ticket.attendee_id,
        event_id: ticket.event_id,
        ticket_type: ticket.ticket_type || 'general',
        status: ticket.status || 'active',
        price: ticket.price || 0,
        created_at: new Date(ticket.created_at),
        metadata: ticket.metadata || {}
      }));
    } catch (error) {
      console.error(`Error fetching tickets for attendee ${attendeeId}:`, error);
      return [];
    }
  }
}

// Export for use in scripts
export default UnifiedPaymentSyncService;