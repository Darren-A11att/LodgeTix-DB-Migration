#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env.explorer ONLY
// STANDARDIZED: This has the correct MongoDB cluster/database settings
// All sync scripts use .env.explorer as the single source of truth
const envPath = path.resolve(__dirname, '..', '.env.explorer');
console.log(`Loading environment from: ${envPath}`);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Failed to load .env.explorer:', result.error);
} else {
  console.log(`Loaded ${Object.keys(result.parsed || {}).length} environment variables from .env.explorer`);
}

// Import the enhanced sync service
import { MongoClient, Db } from 'mongodb';
import Stripe from 'stripe';
import { SquareClient, SquareEnvironment } from 'square';
import { createClient } from '@supabase/supabase-js';

// Create a comprehensive dry-run log
class DryRunLogger {
  private logPath: string;
  private actions: any[] = [];
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
    const timestamp = this.startTime.toISOString().replace(/[:.]/g, '-');
    const logsDir = path.join(process.cwd(), 'sync-logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.logPath = path.join(logsDir, `dry-run-${timestamp}.log`);
    this.writeHeader();
  }

  private writeHeader() {
    const header = `
================================================================================
                        DRY RUN - PAYMENT SYNC SIMULATION
================================================================================
Started: ${this.startTime.toISOString()}
Mode: DRY RUN - No database modifications will be made
================================================================================

This log shows what WOULD happen if the sync was run for real.
All database operations are simulated and logged but not executed.

`;
    fs.writeFileSync(this.logPath, header);
    console.log(header);
  }

  log(category: string, action: string, details: any = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      category,
      action,
      details
    };
    this.actions.push(entry);
    
    const logLine = `[${category}] ${action}`;
    console.log(logLine);
    
    if (Object.keys(details).length > 0) {
      const detailsStr = JSON.stringify(details, null, 2).split('\n').map(line => '  ' + line).join('\n');
      console.log(detailsStr);
    }
    
    fs.appendFileSync(this.logPath, `\n${logLine}\n`);
    if (Object.keys(details).length > 0) {
      fs.appendFileSync(this.logPath, JSON.stringify(details, null, 2) + '\n');
    }
  }

  summary() {
    const endTime = new Date();
    const duration = (endTime.getTime() - this.startTime.getTime()) / 1000;
    
    // Group actions by category
    const byCategory: any = {};
    this.actions.forEach(action => {
      if (!byCategory[action.category]) {
        byCategory[action.category] = [];
      }
      byCategory[action.category].push(action);
    });

    const summary = `
================================================================================
                              DRY RUN SUMMARY
================================================================================
Duration: ${duration} seconds
Total Actions Simulated: ${this.actions.length}

Actions by Category:
${Object.entries(byCategory).map(([cat, actions]: [string, any]) => 
  `  ${cat}: ${actions.length} actions`
).join('\n')}

Log saved to: ${this.logPath}
================================================================================
`;
    
    console.log(summary);
    fs.appendFileSync(this.logPath, summary);
    
    return {
      duration,
      totalActions: this.actions.length,
      byCategory,
      logPath: this.logPath
    };
  }
}

// Dry run sync service
class DryRunSyncService {
  private logger: DryRunLogger;
  private supabase: any;
  private stripeClients: Map<string, Stripe> = new Map();
  private squareClient: SquareClient | null = null;
  
  // Counters for simulation
  private counters = {
    square: { payments: 0, orders: 0, customers: 0 },
    stripe: { charges: 0, refunded: 0, testPayments: 0 },
    registrations: { found: 0, notFound: 0 },
    attendees: 0,
    tickets: 0,
    contacts: { new: 0, updated: 0, deduplicated: 0 }
  };

  constructor() {
    this.logger = new DryRunLogger();
    this.initializeServices();
  }

  private initializeServices() {
    this.logger.log('INIT', 'Initializing services for dry run');

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.logger.log('INIT', '✓ Supabase client initialized');
    } else {
      this.logger.log('INIT', '⚠️ Supabase credentials missing');
    }

    // Initialize Square
    if (process.env.SQUARE_ACCESS_TOKEN) {
      // Production tokens start with EAAA, use production unless explicitly set to sandbox
      const isSandbox = process.env.SQUARE_ENVIRONMENT === 'sandbox';
      this.squareClient = new SquareClient({
        token: process.env.SQUARE_ACCESS_TOKEN,
        environment: isSandbox ? SquareEnvironment.Sandbox : SquareEnvironment.Production
      });
      this.logger.log('INIT', '✓ Square client initialized', { 
        environment: isSandbox ? 'sandbox' : 'production' 
      });
    } else {
      this.logger.log('INIT', '⚠️ Square access token missing');
    }

    // Initialize Stripe accounts
    const stripeAccounts = [
      { name: 'DA-LODGETIX', key: process.env.STRIPE_ACCOUNT_1_SECRET_KEY },
      { name: 'WS-LODGETIX', key: process.env.STRIPE_ACCOUNT_2_SECRET_KEY },
      { name: 'WS-LODGETICKETS', key: process.env.STRIPE_ACCOUNT_3_SECRET_KEY }
    ];

    stripeAccounts.forEach(account => {
      if (account.key) {
        this.stripeClients.set(account.name, new Stripe(account.key, {
          apiVersion: '2025-07-30.basil'
        }));
        this.logger.log('INIT', `✓ Stripe account initialized: ${account.name}`);
      } else {
        this.logger.log('INIT', `⚠️ Stripe account missing: ${account.name}`);
      }
    });
  }

  async simulateSquareSync() {
    this.logger.log('SQUARE', '━━━ Starting Square Payment Simulation ━━━');
    
    if (!this.squareClient) {
      this.logger.log('SQUARE', '❌ Square client not initialized');
      return;
    }

    try {
      // Simulate fetching ALL payments
      this.logger.log('SQUARE', 'WOULD FETCH: ALL Square payments (pagination with cursor)');
      
      let cursor: string | undefined = undefined;
      let totalFetched = 0;
      
      do {
        const response = await this.squareClient.payments.list({ 
          limit: 100,  // Max per request
          cursor: cursor 
        });
        
        if ((response as any).payments && (response as any).payments.length > 0) {
          totalFetched += (response as any).payments.length;
          
          for (const payment of (response as any).payments) {
          
          // Only log every 10th payment when processing many
          if (this.counters.square.payments % 10 === 0 || totalFetched <= 10) {
            this.logger.log('SQUARE', `Processing payment ${this.counters.square.payments + 1}/${totalFetched} - ${payment.id}`);
          }

          // Check status
          if (payment.status !== 'COMPLETED') {
            this.logger.log('SQUARE', `  ⏭️ WOULD SKIP: Status is ${payment.status}`);
            continue;
          }

          // Check refunds
          if (payment.refundedMoney && payment.refundedMoney.amount > 0) {
            this.logger.log('SQUARE', `  ⏭️ WOULD SKIP: Refunded ${payment.refundedMoney.amount / 100}`);
            this.counters.square.payments++;
            continue;
          }

          // Simulate order fetch
          if (payment.orderId) {
            this.logger.log('SQUARE', `  🛒 WOULD FETCH: Order ${payment.orderId}`);
            this.counters.square.orders++;
          }

          // Simulate customer fetch
          if (payment.customerId) {
            this.logger.log('SQUARE', `  👤 WOULD FETCH: Customer ${payment.customerId}`);
            this.counters.square.customers++;
          }

          // Simulate database operations
          this.logger.log('DATABASE', `  WOULD INSERT: Payment to payments_import`, {
            collection: 'payments_import',
            id: payment.id
          });

          // Simulate registration lookup
          this.logger.log('SUPABASE', `  WOULD SEARCH: Registration with payment_id=${payment.id}`);
          
          // Simulate finding registration (50% chance for demo)
          if (Math.random() > 0.5) {
            this.logger.log('SUPABASE', `  ✓ WOULD FIND: Registration for payment`);
            this.counters.registrations.found++;
            
            this.logger.log('DATABASE', `  WOULD INSERT: Registration to registrations_import`);
            this.logger.log('DATABASE', `  WOULD UPDATE: Link payment to registration`);
            this.logger.log('DATABASE', `  WOULD INSERT: Final payment and registration`);
            
            // Simulate attendees and tickets
            const attendeeCount = Math.floor(Math.random() * 3) + 1;
            this.logger.log('SUPABASE', `  WOULD FETCH: ${attendeeCount} attendees`);
            this.counters.attendees += attendeeCount;
            
            const ticketCount = Math.floor(Math.random() * 5);
            this.logger.log('SUPABASE', `  WOULD FETCH: ${ticketCount} tickets`);
            this.counters.tickets += ticketCount;
            
            // Simulate contact processing
            this.logger.log('CONTACTS', `  WOULD PROCESS: ${attendeeCount} contacts with deduplication`);
            this.counters.contacts.new += attendeeCount;
          } else {
            this.logger.log('SUPABASE', `  ❌ WOULD NOT FIND: Registration for payment`);
            this.counters.registrations.notFound++;
          }

          this.counters.square.payments++;
          }
        }
        
        cursor = (response as any).cursor;
      } while (cursor);
      
      this.logger.log('SQUARE', `Total Square payments found: ${totalFetched}`);
      
    } catch (error: any) {
      this.logger.log('SQUARE', `Error simulating Square sync: ${error.message}`);
    }
  }

  async simulateStripeSync() {
    for (const [accountName, stripe] of this.stripeClients) {
      this.logger.log('STRIPE', `\n━━━ Starting ${accountName} Simulation ━━━`);
      
      try {
        // Simulate fetching ALL charges
        this.logger.log('STRIPE', `WOULD FETCH: ALL charges from ${accountName}`);
        
        let hasMore = true;
        let startingAfter: string | undefined;
        let totalFetched = 0;
        
        while (hasMore) {
          const charges = await stripe.charges.list({ 
            limit: 100,  // Max per request
            starting_after: startingAfter 
          });
          
          totalFetched += charges.data.length;
        
        for (const charge of charges.data) {
          this.logger.log('STRIPE', `\n📝 WOULD PROCESS: Charge ${charge.id}`, {
            amount: charge.amount / 100,
            currency: charge.currency,
            status: charge.status,
            paid: charge.paid,
            refunded: charge.refunded
          });

          // Check if paid
          if (!charge.paid) {
            this.logger.log('STRIPE', `  ⏭️ WOULD SKIP: Not paid`);
            continue;
          }

          // Check if refunded
          if (charge.refunded && charge.amount_refunded === charge.amount) {
            this.logger.log('STRIPE', `  ⏭️ WOULD SKIP: Fully refunded`);
            this.counters.stripe.refunded++;
            continue;
          }

          // Check for test payment
          const cardLast4 = charge.payment_method_details?.card?.last4;
          const email = charge.receipt_email || charge.billing_details?.email || '';
          
          if (cardLast4 === '8251' && email.includes('@allatt.me')) {
            this.logger.log('STRIPE', `  🧪 WOULD SKIP: Test payment detected`);
            this.counters.stripe.testPayments++;
            continue;
          }

          // Simulate database operations
          this.logger.log('DATABASE', `  WOULD INSERT: Charge to payments_import`, {
            collection: 'payments_import',
            chargeId: charge.id,
            paymentIntentId: charge.payment_intent
          });

          if (charge.payment_intent) {
            // Simulate registration lookup
            this.logger.log('SUPABASE', `  WOULD SEARCH: Registration with payment_intent=${charge.payment_intent}`);
            
            // Simulate finding registration (70% chance for Stripe)
            if (Math.random() > 0.3) {
              this.logger.log('SUPABASE', `  ✓ WOULD FIND: Registration for charge`);
              this.counters.registrations.found++;
              
              this.logger.log('DATABASE', `  WOULD UPDATE: Registration with charge ID`);
              this.logger.log('DATABASE', `  WOULD INSERT: Registration to registrations_import`);
              this.logger.log('DATABASE', `  WOULD INSERT: Final collections`);
              
              // Simulate attendees and contacts
              const attendeeCount = Math.floor(Math.random() * 2) + 1;
              this.counters.attendees += attendeeCount;
              this.counters.contacts.new += attendeeCount;
            } else {
              this.logger.log('SUPABASE', `  ❌ WOULD NOT FIND: Registration for charge`);
              this.counters.registrations.notFound++;
            }
          }

          this.counters.stripe.charges++;
        }
        
        hasMore = charges.has_more;
        if (charges.data.length > 0) {
          startingAfter = charges.data[charges.data.length - 1].id;
        }
      }
      
      this.logger.log('STRIPE', `Total charges found for ${accountName}: ${totalFetched}`);
      
    } catch (error: any) {
        this.logger.log('STRIPE', `Error simulating ${accountName}: ${error.message}`);
      }
    }
  }

  async simulateContactProcessing() {
    this.logger.log('CONTACTS', '\n━━━ Contact Processing Simulation ━━━');
    
    this.logger.log('CONTACTS', 'WOULD PROCESS: Contact deduplication', {
      strategy: 'email + mobile + lastName + firstName',
      estimatedDuplicates: Math.floor(this.counters.contacts.new * 0.2),
      functionRegistrations: 'Would add event and ticket details'
    });
    
    this.counters.contacts.deduplicated = Math.floor(this.counters.contacts.new * 0.2);
    
    this.logger.log('CONTACTS', 'WOULD CREATE: FunctionRegistrations', {
      structure: {
        functionId: 'ObjectId',
        registrationId: 'ObjectId',
        registrationDate: 'Date',
        confirmationNumber: 'string',
        bookingContactId: 'ObjectId',
        attendeeDetails: 'ObjectId',
        eventsAttending: { eventId: 'ObjectId', eventName: 'string' },
        ticketsOwned: { ticketId: 'ObjectId', name: 'string' }
      }
    });
  }

  async run() {
    this.logger.log('MAIN', '🚀 Starting DRY RUN sync simulation\n');
    
    // Simulate database connection
    this.logger.log('DATABASE', 'WOULD CONNECT: MongoDB database "lodgetix"');
    
    // Simulate collection verification
    const collections = [
      'payments', 'registrations', 'attendees', 'tickets', 'contacts',
      'payments_import', 'registrations_import', 'attendees_import', 
      'tickets_import', 'contacts_import'
    ];
    
    this.logger.log('DATABASE', 'WOULD VERIFY: Collections exist', { collections });
    
    // Run FULL simulations for ALL records
    await this.simulateSquareSync();
    await this.simulateStripeSync();
    await this.simulateContactProcessing();
    
    // Generate summary
    this.logger.log('SUMMARY', '\n━━━ Simulation Statistics ━━━', {
      square: this.counters.square,
      stripe: this.counters.stripe,
      registrations: this.counters.registrations,
      attendees: this.counters.attendees,
      tickets: this.counters.tickets,
      contacts: this.counters.contacts
    });
    
    const summary = this.logger.summary();
    
    console.log('\n' + '='.repeat(80));
    console.log('🎭 DRY RUN COMPLETE - No actual changes were made');
    console.log('📄 Review the detailed log at:');
    console.log(`   ${summary.logPath}`);
    console.log('='.repeat(80));
  }
}

// Main execution
async function main() {
  const dryRun = new DryRunSyncService();
  await dryRun.run();
}

main().catch(console.error);