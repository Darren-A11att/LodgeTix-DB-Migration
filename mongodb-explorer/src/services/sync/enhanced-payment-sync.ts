import { MongoClient, Db, ObjectId } from 'mongodb';
import Stripe from 'stripe';
import { SquareClient, SquareEnvironment } from 'square';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

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
    this.writeToLog('\n=== STARTING ENHANCED PAYMENT SYNC ===');
    this.writeToLog('Processing workflow:');
    this.writeToLog('1. Import payment to payments_import');
    this.writeToLog('2. Fetch order/customer for Square payments');
    this.writeToLog('3. Find registration in Supabase');
    this.writeToLog('4. Update with charge ID for Stripe');
    this.writeToLog('5. Import to registrations_import');
    this.writeToLog('6. Link and import to final collections');
    this.writeToLog('7. Process attendees and tickets');
    this.writeToLog('8. Process contacts with deduplication\n');
    
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

    this.writeToLog('\n=== SYNC COMPLETE ===');
    this.writeToLog(`✅ Processed: ${this.processedCount}`);
    this.writeToLog(`⏭️ Skipped: ${this.skippedCount}`);
    this.writeToLog(`❌ Errors: ${this.errorCount}`);
    this.writeToLog(`👥 Unique contacts: ${this.processedContacts.size}`);
    this.writeToLog(`📊 Total: ${this.processedCount + this.skippedCount + this.errorCount}`);
  }

  private async ensureCollections(db: Db): Promise<void> {
    const collections = [
      'payments_import',
      'registrations_import', 
      'payments',
      'registrations',
      'attendees',
      'tickets',
      'contacts' // NEW: contacts collection
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
    let cursor: string | undefined = undefined; // Start with blank cursor
    let processedInProvider = 0;
    const limitPerRequest = 1; // Process 1 payment at a time for Square
    
    do {
      try {
        this.writeToLog(`\nFetching Square payments (cursor: ${cursor || 'blank'})`);
        
        const response = await square.payments.list({
          limit: limitPerRequest,
          cursor: cursor
        });

        if (response.payments && response.payments.length > 0) {
          for (const payment of response.payments) {
            await this.processSingleSquarePayment(payment, provider, db, square);
            processedInProvider++;
            
            if (options.limit && processedInProvider >= options.limit) {
              this.writeToLog(`Reached limit of ${options.limit} for ${provider.name}`);
              return;
            }
          }
        }

        // Update cursor for next iteration
        cursor = response.cursor;
        
      } catch (error: any) {
        this.writeToLog(`Error fetching Square payments: ${error.message}`);
        this.errorCount++;
        break;
      }
    } while (cursor);
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

      // Check if already processed
      const existingPayment = await db.collection('payments').findOne({ id: payment.id });
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
          const orderResponse = await square.orders.retrieve(payment.orderId);
          orderData = orderResponse.order;
          this.writeToLog(`    ✓ Order fetched`);
        } catch (error) {
          this.writeToLog(`    ⚠️ Could not fetch order: ${error}`);
        }
      }

      // Fetch customer if customer_id exists
      let customerData = null;
      if (payment.customerId) {
        try {
          this.writeToLog(`  👤 Fetching customer: ${payment.customerId}`);
          const customerResponse = await square.customers.retrieve(payment.customerId);
          customerData = customerResponse.customer;
          this.writeToLog(`    ✓ Customer fetched`);
        } catch (error) {
          this.writeToLog(`    ⚠️ Could not fetch customer: ${error}`);
        }
      }

      // 1. Import payment to payments_import
      const paymentImport: PaymentImport = {
        id: payment.id,
        provider: provider.name,
        amount: (payment.totalMoney?.amount || 0) / 100,
        currency: payment.totalMoney?.currency || 'USD',
        status: payment.status.toLowerCase(),
        refunded: false,
        amountRefunded: (payment.refundedMoney?.amount || 0) / 100,
        created: new Date(payment.createdAt),
        metadata: payment.note ? { note: payment.note } : {},
        orderId: payment.orderId,
        orderData: orderData,
        customerData: customerData,
        customerId: payment.customerId,
        receiptEmail: customerData?.emailAddress
      };

      await db.collection('payments_import').replaceOne(
        { id: payment.id },
        paymentImport,
        { upsert: true }
      );
      this.writeToLog(`  ✓ Imported to payments_import`);

      // 2. Find registration using payment ID
      const registration = await this.fetchRegistrationByPaymentId(payment.id);
      
      if (!registration) {
        this.writeToLog(`  ❌ No registration found for payment: ${payment.id}`);
        this.errorCount++;
        return;
      }
      this.writeToLog(`  ✓ Found registration: ${registration.id}`);

      // 3. Import registration to registrations_import
      const registrationImport: RegistrationImport = {
        id: registration.id,
        paymentId: payment.id,
        status: registration.status === 'paid' || registration.status === 'completed' ? registration.status : 'paid',
        userId: registration.user_id,
        eventId: registration.event_id,
        createdAt: new Date(registration.created_at),
        updatedAt: new Date(registration.updated_at),
        metadata: registration.metadata || {},
        bookingContact: registration.bookingContact
      };

      await db.collection('registrations_import').replaceOne(
        { id: registration.id },
        registrationImport,
        { upsert: true }
      );
      this.writeToLog(`  ✓ Imported to registrations_import`);

      // 4. Link and import to final collections
      paymentImport.registrationId = registration.id;
      await db.collection('payments').replaceOne(
        { id: payment.id },
        paymentImport,
        { upsert: true }
      );
      
      await db.collection('registrations').replaceOne(
        { id: registration.id },
        { ...registration, paymentId: payment.id },
        { upsert: true }
      );
      this.writeToLog(`  ✓ Imported to final collections`);

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
      const existingPayment = await db.collection('payments').findOne({ id: charge.id });
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

      // 1. Import charge to payments_import
      const paymentImport: PaymentImport = {
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

      await db.collection('payments_import').replaceOne(
        { id: charge.id },
        paymentImport,
        { upsert: true }
      );
      this.writeToLog(`  ✓ Imported charge to payments_import`);

      // 2. Find registration using payment intent ID
      if (!charge.payment_intent) {
        this.writeToLog(`  ⚠️ No payment intent ID - cannot find registration`);
        this.errorCount++;
        return;
      }

      const registration = await this.fetchRegistrationByPaymentId(charge.payment_intent as string);
      
      if (!registration) {
        this.writeToLog(`  ❌ No registration found for payment intent: ${charge.payment_intent}`);
        this.errorCount++;
        return;
      }
      this.writeToLog(`  ✓ Found registration: ${registration.id}`);

      // 3. Create registration import with charge ID
      const registrationImport: RegistrationImport = {
        id: registration.id,
        paymentId: charge.id, // Use charge ID
        originalPaymentIntentId: charge.payment_intent as string,
        status: registration.status === 'paid' || registration.status === 'completed' ? registration.status : 'paid',
        userId: registration.user_id,
        eventId: registration.event_id,
        createdAt: new Date(registration.created_at),
        updatedAt: new Date(registration.updated_at),
        metadata: registration.metadata || {},
        bookingContact: registration.bookingContact
      };

      await db.collection('registrations_import').replaceOne(
        { id: registration.id },
        registrationImport,
        { upsert: true }
      );
      this.writeToLog(`  ✓ Imported to registrations_import with charge ID`);

      // 4. Link and import to final collections
      paymentImport.registrationId = registration.id;
      await db.collection('payments').replaceOne(
        { id: charge.id },
        paymentImport,
        { upsert: true }
      );
      
      await db.collection('registrations').replaceOne(
        { id: registration.id },
        { ...registration, chargeId: charge.id, paymentIntentId: charge.payment_intent },
        { upsert: true }
      );
      this.writeToLog(`  ✓ Imported to final collections`);

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
    // Process booking contact first
    if (registration.bookingContact) {
      await this.processContact(registration.bookingContact, 'registration', db);
    }

    // Process attendees
    const attendees = await this.fetchAttendeesByRegistration(registration.id);
    this.writeToLog(`  ✓ Found ${attendees.length} attendee(s)`);
    
    for (const attendee of attendees) {
      // Store attendee
      await db.collection('attendees').replaceOne(
        { id: attendee.id },
        attendee,
        { upsert: true }
      );

      // Process attendee as contact
      await this.processContact(attendee, 'attendee', db);

      // Process tickets
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

    // Insert contact
    const result = await db.collection('contacts').replaceOne(
      { uniqueKey: contact.uniqueKey },
      contact,
      { upsert: true }
    );

    const contactId = result.upsertedId || (await db.collection('contacts').findOne({ uniqueKey: contact.uniqueKey }))?._id;
    
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

      return {
        id: data.registration_id || data.id || paymentId,
        stripe_payment_intent_id: data.stripe_payment_intent_id,
        status: data.status || 'pending',
        user_id: data.user_id,
        event_id: data.event_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        metadata: data.metadata || {},
        bookingContact: data.booking_contact || data.bookingContact
      };
    } catch (error) {
      this.writeToLog(`Error fetching registration for payment ${paymentId}: ${error}`);
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
        metadata: attendee.metadata || {},
        isPartner: attendee.is_partner,
        partnerId: attendee.partner_id
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

export default EnhancedPaymentSyncService;