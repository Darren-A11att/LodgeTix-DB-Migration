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
import { ReferenceDataService } from './reference-data-service';

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
  email: string;
  address: string;
  state: string;
  postcode: string;
  country: string;
  relationships?: any;
  memberships?: any;
  uniqueKey: string; // email + mobile + lastName + firstName
  source: 'registration' | 'attendee';
  linkedPartnerId?: ObjectId;
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
  private processedContacts: Map<string, ObjectId> = new Map();
  private referenceDataService: ReferenceDataService | null = null;

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
    
    const db = await this.connectToMongoDB();
    await this.ensureCollections(db);
    
    // Clear processed contacts map for fresh sync
    this.processedContacts.clear();
    
    for (const provider of this.providers) {
      this.writeToLog(`\n━━━ Processing ${provider.name} ━━━`);
      
      try {
        if (provider.type === 'square') {
          await this.processSquarePayments(provider, db, options);
        } else if (provider.type === 'stripe') {
          await this.processStripeCharges(provider, db, options);
        }
      } catch (error: any) {
        this.writeToLog(`Error processing ${provider.name}: ${error.message}`);
        this.errorCount++;
      }
    }

    // Perform selective sync from import collections to production collections
    this.writeToLog('\n🔄 Starting selective production sync...');
    await this.performSelectiveSync();

    this.writeToLog('\n=== SYNC COMPLETE ===');
    this.writeToLog(`✅ Processed: ${this.processedCount}`);
    this.writeToLog(`⏭️ Skipped: ${this.skippedCount}`);
    this.writeToLog(`❌ Errors: ${this.errorCount}`);
    this.writeToLog(`👥 Unique contacts: ${this.processedContacts.size}`);
    this.writeToLog(`📊 Total: ${this.processedCount + this.skippedCount + this.errorCount}`);
  }

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
        break;
      }
    } while (cursor || totalFetched === 0); // Continue while we have a cursor OR if we haven't fetched any yet
    
    this.writeToLog(`✓ Processed ${processedInProvider} Square payments (total fetched: ${totalFetched})`);
  }

  private async processSingleSquarePayment(payment: any, provider: PaymentProvider, db: Db, square: SquareClient): Promise<void> {
    try {
      this.writeToLog(`\n📝 Processing Square payment: ${payment.id}`);
      
      // Check payment status
      if (payment.status !== 'COMPLETED') {
        this.writeToLog(`  ⏭️ Skipping - status: ${payment.status}`);
        this.skippedCount++;
        return;
      }

      // Check if refunded
      if (payment.refundedMoney && payment.refundedMoney.amount > 0) {
        this.writeToLog(`  ⏭️ Skipping - refunded`);
        this.skippedCount++;
        return;
      }

      // Check if already processed in import collection
      const existingPayment = await db.collection('import_payments').findOne({ id: payment.id });
      if (existingPayment) {
        this.writeToLog(`  ⏭️ Already imported - skipping`);
        this.skippedCount++;
        return;
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
      const paymentImportData = {
        id: payment.id,
        provider: provider.name,
        // Convert BigInt to number for Square amounts
        amount: payment.totalMoney?.amount ? Number(payment.totalMoney.amount) / 100 : 0,
        currency: payment.totalMoney?.currency || 'USD',
        status: payment.status.toLowerCase(),
        refunded: false,
        amountRefunded: payment.refundedMoney?.amount ? Number(payment.refundedMoney.amount) / 100 : 0,
        created: new Date(payment.createdAt),
        metadata: payment.note ? { note: payment.note } : {},
        orderId: payment.orderId,
        orderData: orderData,
        customerData: customerData,
        customerId: payment.customerId,
        receiptEmail: customerData?.emailAddress
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
        this.writeToLog(`  ❌ No registration found for payment: ${payment.id}`);
        // Update import_payments with "no-match" for registrationId
        await db.collection('import_payments').updateOne(
          { id: payment.id },
          { $set: { registrationId: 'no-match' } }
        );
        this.writeToLog(`  ✓ Updated import_payments with registrationId: no-match`);
        this.errorCount++;
        return;
      }
      this.writeToLog(`  ✓ Found registration: ${registration.id}`);
      
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
        gateway: provider.name // 'Square'
      };

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
      this.writeToLog(`  ✓ Imported FULL registration to import_registrations with field transformation`);

      // Production sync deferred to selective sync phase
      this.writeToLog(`  ⏸️ Production sync deferred to selective sync phase`);

      // 4. Process booking contact as customer (use the imported registration with transformed fields)
      await this.processCustomerFromRegistration(registrationImport, db);

      // 5. Process attendees, tickets, and contacts
      await this.processAttendeesTicketsAndContacts(registration, db);

      this.processedCount++;
      this.writeToLog(`  ✅ Completed processing Square payment ${payment.id}`);
      
    } catch (error: any) {
      this.writeToLog(`  ❌ Error processing Square payment ${payment.id}: ${error.message}`);
      this.errorCount++;
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

      // Check if already processed in import collection
      const existingPayment = await db.collection('import_payments').findOne({ id: charge.id });
      if (existingPayment) {
        this.writeToLog(`  ⏭️ Already imported - skipping`);
        this.skippedCount++;
        return;
      }

      // Check for test payment
      const isTestPayment = this.isTestPayment(charge);
      if (isTestPayment) {
        this.writeToLog(`  🧪 Test payment detected - skipping`);
        this.skippedCount++;
        return;
      }

      // 1. Import charge to import_payments with field transformation
      const chargeImportData = {
        id: charge.id,
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
        // Update import_payments with "no-match" for registrationId
        await db.collection('import_payments').updateOne(
          { id: charge.id },
          { $set: { registrationId: 'no-match' } }
        );
        this.writeToLog(`  ✓ Updated import_payments with registrationId: no-match`);
        this.errorCount++;
        return;
      }

      const registration = await this.fetchRegistrationByPaymentId(charge.payment_intent as string);
      
      if (!registration) {
        this.writeToLog(`  ❌ No registration found for payment intent: ${charge.payment_intent}`);
        // Update import_payments with "no-match" for registrationId
        await db.collection('import_payments').updateOne(
          { id: charge.id },
          { $set: { registrationId: 'no-match' } }
        );
        this.writeToLog(`  ✓ Updated import_payments with registrationId: no-match`);
        this.errorCount++;
        return;
      }
      this.writeToLog(`  ✓ Found registration: ${registration.id}`);
      
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
        gateway: provider.name // Use gateway with specific account name
      };

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
      this.writeToLog(`  ✓ Imported FULL registration to import_registrations with field transformation`);

      // Production sync deferred to selective sync phase
      this.writeToLog(`  ⏸️ Production sync deferred to selective sync phase`);

      // 4. Process booking contact as customer (use the imported registration with transformed fields)
      await this.processCustomerFromRegistration(registrationImport, db);

      // 5. Process attendees, tickets, and contacts
      await this.processAttendeesTicketsAndContacts(registration, db);

      this.processedCount++;
      this.writeToLog(`  ✅ Completed processing charge ${charge.id}`);
      
    } catch (error: any) {
      this.writeToLog(`  ❌ Error processing charge ${charge.id}: ${error.message}`);
      this.errorCount++;
    }
  }

  private async processAttendeesTicketsAndContacts(registration: any, db: Db): Promise<void> {
    // Process booking contact first to import_contacts
    if (registration.bookingContact) {
      await this.processContact(registration.bookingContact, 'registration', db);
    }

    // Process attendees
    const attendees = await this.fetchAttendeesByRegistration(registration.id, registration);
    this.writeToLog(`  ✓ Found ${attendees.length} attendee(s)`);
    
    // Extract tickets from registration_data
    const tickets = await this.fetchTicketsFromRegistration(registration.id, registration);
    this.writeToLog(`  ✓ Found ${tickets.length} ticket(s) in registration`);
    
    // Store tickets to import_tickets first with field transformation
    const ticketIds: ObjectId[] = [];
    for (const ticket of tickets) {
      const ticketImport = createImportDocument(
        ticket,
        'supabase',
        'supabase-ticket'
      );

      await db.collection('import_tickets').replaceOne(
        { ticketId: ticket.ticketId },
        ticketImport,
        { upsert: true }
      );
      
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
          _id: ticketIds[tickets.indexOf(t)],
          name: t.eventName,
          status: t.status
        }));
      
      // Add event_tickets to attendee
      const attendeeData = {
        ...attendee,
        eventTickets: attendeeTickets // Use camelCase for consistency
      };
      
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
      await this.processContact(attendee, 'attendee', db);
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

      // Update the registration to replace bookingContact with customer ObjectId
      if (customerId) {
        await db.collection('import_registrations').updateOne(
          { id: registration.id },
          {
            $set: {
              'registrationData.bookingContact': customerId,
              'metadata.customerId': customerId
            }
          }
        );
        this.writeToLog(`    ✓ Updated registration with customer ObjectId`);
      }

    } catch (error: any) {
      this.writeToLog(`    ❌ Error processing customer: ${error.message}`);
      this.errorCount++;
    }
  }

  private async processContact(data: any, source: 'registration' | 'attendee', db: Db): Promise<void> {
    // Extract contact fields
    const contact: Contact = {
      title: data.title || '',
      firstName: data.firstName || data.first_name || '',
      lastName: data.lastName || data.last_name || '',
      mobile: data.mobile || data.phone || '',
      email: data.email || '',
      address: data.address || '',
      state: data.state || '',
      postcode: data.postcode || '',
      country: data.country || '',
      relationships: data.relationships || {},
      memberships: data.memberships || { grandLodge: '', lodge: '' },
      uniqueKey: '',
      source: source
    };

    // Generate unique key for deduplication
    contact.uniqueKey = crypto.createHash('md5')
      .update(`${contact.email}${contact.mobile}${contact.lastName}${contact.firstName}`)
      .digest('hex');

    // Check if contact already processed
    if (this.processedContacts.has(contact.uniqueKey)) {
      this.writeToLog(`    ⏭️ Contact already processed: ${contact.firstName} ${contact.lastName}`);
      return;
    }

    // Check for partner linking
    if (data.isPartner && data.partnerId) {
      contact.linkedPartnerId = new ObjectId(data.partnerId);
    }

    // Insert contact to import_contacts with field transformation
    const contactImport = createImportDocument(
      contact,
      'supabase',
      'supabase-contact'
    );

    const result = await db.collection('import_contacts').replaceOne(
      { uniqueKey: contact.uniqueKey },
      contactImport,
      { upsert: true }
    );

    const contactId = result.upsertedId || (await db.collection('import_contacts').findOne({ uniqueKey: contact.uniqueKey }))?._id;
    
    if (contactId) {
      this.processedContacts.set(contact.uniqueKey, contactId);
      this.writeToLog(`    ✓ Processed contact: ${contact.firstName} ${contact.lastName}`);
    }
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
          // Core identifiers - use import-specific ID
          _id: new ObjectId(), // MongoDB document ID for import collection
          attendeeId: `import_${registrationId}_attendee_${index}`, // Import-specific attendee ID
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
            _id: new ObjectId(),
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
        const ticketPrice = eventTicketDetails.price || 0;
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
      { import: 'import_contacts', production: 'contacts', idField: 'uniqueKey' },
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
            this.writeToLog(`  ⚠️ No production metadata for ${idValue}, skipping`);
            continue;
          }

          const { updateFields, hasChanges } = createSelectiveUpdate(
            importDoc,
            productionDoc,
            importMeta
          );

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

      this.writeToLog(`✅ ${mapping.import} sync complete: ${processedCount} processed, ${createdCount} created, ${updatedCount} updated`);
      
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
    } 
    else if (mapping.production === 'tickets') {
      // Use original external ID directly (not prefixed with "prod_")
      const originalId = newDoc.originalTicketId;
      if (originalId) {
        newDoc.ticketId = originalId;
      }
      
      // Map owner/attendee references to original attendee IDs
      if (newDoc.ownerId && newDoc.ownerId.startsWith('import_')) {
        // Find the original attendee ID from the import_attendees collection
        const importAttendee = await db.collection('import_attendees').findOne({ attendeeId: newDoc.ownerId });
        if (importAttendee?.originalAttendeeId) {
          newDoc.ownerId = importAttendee.originalAttendeeId;
        }
      }
      
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
      // This will be handled in a separate step after all attendees/tickets are synced
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

  private async fetchTicketsFromRegistration(registrationId: string, registration?: any): Promise<any[]> {
    try {
      // Extract tickets from registration_data field
      if (registration && registration.registration_data?.tickets) {
        const ticketsFromData = registration.registration_data.tickets;
        this.writeToLog(`    Extracting ${ticketsFromData.length} tickets from registration_data`);
        
        // For each ticket, we need to fetch the event ticket details
        const processedTickets = [];
        
        for (const ticket of ticketsFromData) {
          // Try to fetch event ticket details from event_tickets collection or Supabase
          const eventTicketDetails = await this.fetchEventTicketDetails(ticket.eventTicketId);
          
          // Check for missing attendeeId and log warning
          if (!ticket.attendeeId) {
            this.writeToLog(`    ⚠️ Ticket missing attendeeId (eventTicketId: ${ticket.eventTicketId}), using registrationId as fallback`);
          }
          
          // Find the attendee index based on the ticket's attendeeId
          const attendeeIndex = registration.registration_data?.attendees?.findIndex(
            (a: any) => a.attendeeId === ticket.attendeeId || a.id === ticket.attendeeId
          ) ?? 0;
          
          // Determine owner type and ID based on whether ticket has an attendee and registration type
          const isLodgeRegistration = registration.registration_type === 'lodge' || registration.type === 'lodge';
          const hasAttendee = !!ticket.attendeeId;
          
          let ownerType: string;
          let ownerId: string;
          
          if (hasAttendee) {
            // Ticket is assigned to an attendee
            ownerType = 'individual';
            ownerId = `import_${registrationId}_attendee_${attendeeIndex}`;
          } else if (isLodgeRegistration && (registration.lodge_id || registration.lodgeId)) {
            // Lodge registration with unassigned ticket - owned by lodge
            ownerType = 'lodge';
            ownerId = registration.lodge_id || registration.lodgeId; // Use the lodge ID from registration
          } else if (isLodgeRegistration && registration.organisation_id) {
            // Fallback to organisation_id if lodge_id not available
            ownerType = 'lodge';
            ownerId = registration.organisation_id;
          } else {
            // Regular registration without attendee - owned by registration
            ownerType = 'registration';
            ownerId = registrationId;
          }
          
          processedTickets.push({
            // Core identifiers - use import-specific IDs (only _id, no duplicate Id field)
            _id: new ObjectId(), // MongoDB document ID for import collection
            ticketId: `import_${registrationId}_ticket_${ticketsFromData.indexOf(ticket)}`, // Import-specific ticket ID
            originalTicketId: ticket.id || `${ticket.attendeeId || registrationId}-${ticket.eventTicketId}`, // Preserve original ID
            eventTicketId: ticket.eventTicketId, // Reference to constant collection (allowed)
            ticketNumber: `TKT-${Date.now()}${ticketsFromData.indexOf(ticket)}`,
            
            // Event details - from event ticket lookup or defaults
            eventName: eventTicketDetails?.eventName || eventTicketDetails?.name || 'Unknown Event',
            price: ticket.price !== undefined ? ticket.price : (eventTicketDetails?.price || 0),
            quantity: 1,
            
            // Owner info - properly set based on ticket assignment and registration type
            ownerType: ownerType,
            ownerId: ownerId,
            
            // Status - based on payment status
            status: registration.payment_status === 'paid' ? 'sold' : 
                   registration.payment_status === 'refunded' ? 'cancelled' : 'pending',
            
            // Attributes
            attributes: eventTicketDetails?.attributes || [],
            
            // Details
            details: {
              registrationId: registration.registration_id || registrationId, // This is OK - within same import collection
              bookingContactId: registration.booking_contact_id || null,
              attendeeId: hasAttendee ? `import_${registrationId}_attendee_${attendeeIndex}` : null, // Link to import attendee only if has attendee
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
                  to: registration.payment_status === 'paid' ? 'sold' : 'pending'
                },
                {
                  field: 'price',
                  from: null,
                  to: ticket.price || 0
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
        
        return processedTickets;
      }
      
      // Fallback: try to fetch from tickets table in Supabase
      const { data, error } = await this.supabase
        .from('tickets')
        .select('*')
        .eq('registration_id', registrationId);

      if (error || !data) {
        return [];
      }

      return data.map((ticket: any, index: number) => ({
        eventTicketId: ticket.id,
        ticketId: ticket.id,
        ticketNumber: `TKT-${Date.now()}${index}`,
        eventName: ticket.event_name || 'Unknown Event',
        price: ticket.price || 0,
        quantity: 1,
        ownerType: 'individual',
        ownerId: registration?.user_id,
        status: ticket.status || 'active',
        attributes: [],
        details: {
          registrationId: registrationId,
          bookingContactId: null,
          invoice: {
            invoiceNumber: `LTIV-${Date.now()}`
          },
          paymentId: registration?.stripe_payment_intent_id || registration?.square_payment_id || ''
        },
        createdAt: ticket.created_at || new Date().toISOString(),
        modifiedAt: new Date(),
        lastModificationId: new ObjectId(),
        modificationHistory: [{
          id: new ObjectId(),
          type: 'creation',
          changes: [
            {
              field: 'status',
              from: null,
              to: ticket.status || 'active'
            }
          ],
          description: 'Ticket fetched from Supabase table',
          timestamp: new Date(),
          userId: 'system-sync',
          source: 'enhanced-payment-sync'
        }],
        qrCode: null
      }));
    } catch (error) {
      this.writeToLog(`Error fetching tickets: ${error}`);
      return [];
    }
  }
}

export default EnhancedPaymentSyncService;