import { MongoClient, Db } from 'mongodb';
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

interface ChargeImport {
  chargeId: string;
  paymentIntentId: string;
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
}

interface RegistrationImport {
  id: string;
  chargeId: string; // Updated to use charge ID
  originalPaymentIntentId: string; // Keep original for reference
  status: string;
  userId: string;
  eventId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: any;
}

export class ChargeBasedPaymentSyncService {
  private db: Db | null = null;
  private mongoClient: MongoClient | null = null;
  private supabase: any;
  private providers: PaymentProvider[] = [];
  private processedCount = 0;
  private errorCount = 0;
  private skippedCount = 0;
  private logFilePath: string;

  constructor() {
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
    this.logFilePath = path.join(logsDir, `charge-sync-${timestamp}.log`);
    
    this.writeToLog('=== CHARGE-BASED PAYMENT SYNC LOG ===');
    this.writeToLog(`Started at: ${new Date().toISOString()}`);
    this.writeToLog('Using charge IDs instead of payment intent IDs\n');
  }

  private writeToLog(message: string) {
    console.log(message);
    if (this.logFilePath) {
      const logMessage = `${message}\n`;
      fs.appendFileSync(this.logFilePath, logMessage);
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
    // Square first
    if (process.env.SQUARE_ACCESS_TOKEN) {
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
      this.writeToLog('✓ Square provider initialized');
    }

    // Stripe accounts
    const stripeAccounts = [
      { name: process.env.STRIPE_ACCOUNT_1_NAME || 'DA-LODGETIX', key: process.env.STRIPE_ACCOUNT_1_SECRET_KEY, id: 'stripe_1' },
      { name: process.env.STRIPE_ACCOUNT_2_NAME || 'WS-LODGETIX', key: process.env.STRIPE_ACCOUNT_2_SECRET_KEY, id: 'stripe_2' },
      { name: process.env.STRIPE_ACCOUNT_3_NAME || 'LodgeTix-MSW', key: process.env.STRIPE_ACCOUNT_3_SECRET_KEY, id: 'stripe_3' }
    ];

    stripeAccounts.forEach(account => {
      if (account.key) {
        this.providers.push({
          name: account.name,
          type: 'stripe',
          client: new Stripe(account.key, { apiVersion: '2024-11-20.acacia' }),
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
      const dbName = process.env.MONGODB_DB || 'lodgetix';
      this.db = this.mongoClient.db(dbName);
      this.writeToLog(`✓ Connected to MongoDB database: ${dbName}`);
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
    this.writeToLog('\n=== STARTING CHARGE-BASED PAYMENT SYNC ===');
    this.writeToLog('Processing pattern:');
    this.writeToLog('1. Get charges from Stripe (not payment intents)');
    this.writeToLog('2. Import charge to payments_import collection');
    this.writeToLog('3. Find registration using payment intent ID');
    this.writeToLog('4. Replace payment intent ID with charge ID in registration');
    this.writeToLog('5. Import to registrations_import collection');
    this.writeToLog('6. Match and import to final collections');
    this.writeToLog('7. Process attendees and tickets\n');
    
    const db = await this.connectToMongoDB();
    await this.ensureCollections(db);
    
    for (const provider of this.providers) {
      this.writeToLog(`\n━━━ Processing ${provider.name} ━━━`);
      
      try {
        if (provider.type === 'stripe') {
          await this.processStripeCharges(provider, db, options);
        } else if (provider.type === 'square') {
          await this.processSquarePayments(provider, db, options);
        }
      } catch (error: any) {
        if (provider.type === 'square' && error.statusCode === 401) {
          this.writeToLog(`⚠️ Square authentication failed - skipping`);
        } else {
          throw error;
        }
      }
    }

    this.writeToLog('\n=== SYNC COMPLETE ===');
    this.writeToLog(`✅ Processed: ${this.processedCount}`);
    this.writeToLog(`⏭️ Skipped: ${this.skippedCount}`);
    this.writeToLog(`❌ Errors: ${this.errorCount}`);
    this.writeToLog(`📊 Total: ${this.processedCount + this.skippedCount + this.errorCount}`);
    this.writeToLog(`\n📝 Log saved to: ${this.logFilePath}`);
  }

  private async ensureCollections(db: Db): Promise<void> {
    const collections = [
      'payments_import',
      'registrations_import', 
      'payments',
      'registrations',
      'attendees',
      'tickets'
    ];
    
    for (const collectionName of collections) {
      const colls = await db.listCollections({ name: collectionName }).toArray();
      if (colls.length === 0) {
        await db.createCollection(collectionName);
        this.writeToLog(`✓ Created collection: ${collectionName}`);
      }
    }
  }

  private async processStripeCharges(provider: PaymentProvider, db: Db, options: { limit?: number }): Promise<void> {
    const stripe = provider.client as Stripe;
    let hasMore = true;
    let startingAfter: string | undefined;
    let processedInProvider = 0;
    
    while (hasMore) {
      try {
        // Get charges directly, not payment intents
        const charges = await stripe.charges.list({
          limit: Math.min(100, options.limit || 100),
          starting_after: startingAfter
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
    try {
      this.writeToLog(`\n📝 Processing charge: ${charge.id}`);
      
      // Skip if not paid or fully refunded
      if (!charge.paid) {
        this.writeToLog(`  ⏭️ Skipping - not paid`);
        this.skippedCount++;
        return;
      }

      if (charge.refunded && charge.amount_refunded === charge.amount) {
        this.writeToLog(`  ⏭️ Skipping - fully refunded`);
        this.skippedCount++;
        return;
      }

      // Check if already processed
      const existingPayment = await db.collection('payments').findOne({ chargeId: charge.id });
      if (existingPayment) {
        this.writeToLog(`  ⏭️ Already imported - skipping`);
        this.skippedCount++;
        return;
      }

      // Check for test payment (card 8251 + @allatt.me)
      const isTestPayment = this.isTestPayment(charge);
      if (isTestPayment) {
        this.writeToLog(`  🧪 Test payment detected - skipping`);
        this.skippedCount++;
        return;
      }

      // 1. Import charge to payments_import
      const chargeImport: ChargeImport = {
        chargeId: charge.id,
        paymentIntentId: charge.payment_intent as string || '',
        provider: provider.name,
        amount: charge.amount / 100,
        currency: charge.currency,
        status: charge.status,
        refunded: charge.refunded,
        amountRefunded: charge.amount_refunded / 100,
        created: new Date(charge.created * 1000),
        metadata: charge.metadata || {},
        cardBrand: charge.payment_method_details?.card?.brand,
        cardLast4: charge.payment_method_details?.card?.last4,
        receiptEmail: charge.receipt_email || undefined,
        customerId: charge.customer as string || undefined
      };

      await db.collection('payments_import').replaceOne(
        { chargeId: charge.id },
        chargeImport,
        { upsert: true }
      );
      this.writeToLog(`  ✓ Imported charge to payments_import`);

      // 2. Find registration using payment intent ID
      if (!charge.payment_intent) {
        this.writeToLog(`  ⚠️ No payment intent ID - cannot find registration`);
        this.errorCount++;
        return;
      }

      const registration = await this.fetchRegistrationByPaymentIntentId(charge.payment_intent as string);
      
      if (!registration) {
        this.writeToLog(`  ❌ No registration found for payment intent: ${charge.payment_intent}`);
        this.errorCount++;
        return;
      }
      this.writeToLog(`  ✓ Found registration: ${registration.id}`);

      // 3. Create registration import with charge ID
      const registrationImport: RegistrationImport = {
        id: registration.id,
        chargeId: charge.id, // Use charge ID instead of payment intent
        originalPaymentIntentId: charge.payment_intent as string,
        status: registration.status === 'paid' || registration.status === 'completed' ? registration.status : 'paid',
        userId: registration.user_id,
        eventId: registration.event_id,
        createdAt: new Date(registration.created_at),
        updatedAt: new Date(registration.updated_at),
        metadata: registration.metadata || {}
      };

      await db.collection('registrations_import').replaceOne(
        { id: registration.id },
        registrationImport,
        { upsert: true }
      );
      this.writeToLog(`  ✓ Imported registration to registrations_import with charge ID`);

      // 4. Import to final collections
      await db.collection('payments').replaceOne(
        { chargeId: charge.id },
        { ...chargeImport, registrationId: registration.id },
        { upsert: true }
      );
      
      await db.collection('registrations').replaceOne(
        { id: registration.id },
        { ...registration, chargeId: charge.id, paymentIntentId: charge.payment_intent },
        { upsert: true }
      );
      this.writeToLog(`  ✓ Imported to final collections`);

      // 5. Process attendees and tickets
      const attendees = await this.fetchAttendeesByRegistration(registration.id);
      this.writeToLog(`  ✓ Found ${attendees.length} attendee(s)`);
      
      for (const attendee of attendees) {
        await db.collection('attendees').replaceOne(
          { id: attendee.id },
          attendee,
          { upsert: true }
        );

        const tickets = await this.fetchTicketsByAttendee(attendee.id);
        this.writeToLog(`    ✓ Found ${tickets.length} ticket(s) for attendee ${attendee.id}`);
        
        for (const ticket of tickets) {
          await db.collection('tickets').replaceOne(
            { id: ticket.id },
            ticket,
            { upsert: true }
          );
        }
      }

      this.processedCount++;
      this.writeToLog(`  ✅ Completed processing charge ${charge.id}`);
      
    } catch (error: any) {
      this.writeToLog(`  ❌ Error processing charge ${charge.id}: ${error.message}`);
      this.errorCount++;
    }
  }

  private isTestPayment(charge: Stripe.Charge): boolean {
    const cardLast4 = charge.payment_method_details?.card?.last4;
    const email = charge.receipt_email || charge.billing_details?.email || '';
    
    return cardLast4 === '8251' && email.includes('@allatt.me');
  }

  private async processSquarePayments(provider: PaymentProvider, db: Db, options: { limit?: number }): Promise<void> {
    const square = provider.client as SquareClient;
    let cursor: string | undefined;
    let processedInProvider = 0;
    
    do {
      try {
        const response = await square.payments.list({
          limit: Math.min(100, options.limit || 100),
          cursor
        });

        if (response.payments) {
          for (const payment of response.payments) {
            await this.processSingleSquarePayment(payment, provider, db);
            processedInProvider++;
            
            if (options.limit && processedInProvider >= options.limit) {
              this.writeToLog(`Reached limit of ${options.limit} for ${provider.name}`);
              return;
            }
          }
        }

        cursor = response.cursor;
      } catch (error: any) {
        if (error.statusCode === 401) {
          this.writeToLog(`Square authentication error`);
          this.errorCount++;
          return;
        }
        this.writeToLog(`Error fetching Square payments: ${error}`);
        this.errorCount++;
        break;
      }
    } while (cursor);
  }

  private async processSingleSquarePayment(payment: any, provider: PaymentProvider, db: Db): Promise<void> {
    try {
      if (payment.status !== 'COMPLETED') {
        this.skippedCount++;
        return;
      }

      if (payment.refundedMoney && payment.refundedMoney.amount > 0) {
        this.skippedCount++;
        return;
      }

      // Square payments work similarly but use payment ID directly
      const registration = await this.fetchRegistrationByPaymentIntentId(payment.id);
      if (!registration) {
        this.errorCount++;
        return;
      }

      // Process similar to Stripe but adapted for Square
      // ... Square-specific implementation
      
    } catch (error) {
      this.writeToLog(`Error processing Square payment ${payment.id}: ${error}`);
      this.errorCount++;
    }
  }

  private async fetchRegistrationByPaymentIntentId(paymentIntentId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('registrations')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.registration_id || data.id || paymentIntentId,
        stripe_payment_intent_id: data.stripe_payment_intent_id,
        status: data.status || 'pending',
        user_id: data.user_id,
        event_id: data.event_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        metadata: data.metadata || {}
      };
    } catch (error) {
      this.writeToLog(`Error fetching registration for payment ${paymentIntentId}: ${error}`);
      return null;
    }
  }

  private async fetchAttendeesByRegistration(registrationId: string): Promise<any[]> {
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
      this.writeToLog(`Error fetching attendees: ${error}`);
      return [];
    }
  }

  private async fetchTicketsByAttendee(attendeeId: string): Promise<any[]> {
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
      this.writeToLog(`Error fetching tickets: ${error}`);
      return [];
    }
  }
}

export default ChargeBasedPaymentSyncService;