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

// Create a comprehensive dry-run log for FULL sync
class FullDryRunLogger {
  private logPath: string;
  private actions: any[] = [];
  private startTime: Date;
  private verbose: boolean = false;

  constructor() {
    this.startTime = new Date();
    const timestamp = this.startTime.toISOString().replace(/[:.]/g, '-');
    const logsDir = path.join(process.cwd(), 'sync-logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.logPath = path.join(logsDir, `full-dry-run-${timestamp}.log`);
    this.writeHeader();
  }

  private writeHeader() {
    const header = `
================================================================================
                    FULL DRY RUN - COMPLETE PAYMENT SYNC SIMULATION
================================================================================
Started: ${this.startTime.toISOString()}
Mode: DRY RUN - No database modifications will be made
Scope: ALL RECORDS from ALL payment providers
================================================================================

This simulation processes ALL payments from:
- Square (Production)
- Stripe Account 1 (DA-LODGETIX)
- Stripe Account 2 (WS-LODGETIX)  
- Stripe Account 3 (WS-LODGETICKETS)

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
    
    // Only log to console if verbose or important
    const isImportant = category === 'SUMMARY' || category === 'ERROR' || 
                       action.includes('Total') || action.includes('Starting');
    
    if (isImportant || this.verbose) {
      const logLine = `[${category}] ${action}`;
      console.log(logLine);
      
      if (Object.keys(details).length > 0 && this.verbose) {
        const detailsStr = JSON.stringify(details, null, 2).split('\n').map(line => '  ' + line).join('\n');
        console.log(detailsStr);
      }
    }
    
    // Always write to file
    fs.appendFileSync(this.logPath, `\n[${category}] ${action}\n`);
    if (Object.keys(details).length > 0) {
      fs.appendFileSync(this.logPath, JSON.stringify(details, null, 2) + '\n');
    }
  }

  progress(current: number, total: number, type: string) {
    if (current % 10 === 0 || current === total) {
      console.log(`[PROGRESS] ${type}: ${current}/${total} processed`);
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
                              FULL DRY RUN SUMMARY
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

// Full dry run sync service
class FullDryRunSyncService {
  private logger: FullDryRunLogger;
  private supabase: any;
  private stripeClients: Map<string, Stripe> = new Map();
  private squareClient: SquareClient | null = null;
  
  // Comprehensive counters
  private counters = {
    square: { 
      payments: 0, 
      completed: 0,
      skipped: 0,
      refunded: 0,
      orders: 0, 
      customers: 0 
    },
    stripe: { 
      charges: 0, 
      paid: 0,
      refunded: 0, 
      testPayments: 0,
      byAccount: new Map<string, number>()
    },
    registrations: { 
      found: 0, 
      notFound: 0 
    },
    attendees: 0,
    tickets: 0,
    contacts: { 
      new: 0, 
      updated: 0, 
      deduplicated: 0 
    }
  };

  constructor() {
    this.logger = new FullDryRunLogger();
    this.initializeServices();
  }

  private initializeServices() {
    this.logger.log('INIT', 'Initializing services for FULL dry run');

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.logger.log('INIT', '✓ Supabase client initialized');
    } else {
      this.logger.log('INIT', '⚠️ Supabase credentials missing');
    }

    // Initialize Square (Production)
    if (process.env.SQUARE_ACCESS_TOKEN) {
      // Use production unless explicitly set to sandbox
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
        this.counters.stripe.byAccount.set(account.name, 0);
        this.logger.log('INIT', `✓ Stripe account initialized: ${account.name}`);
      } else {
        this.logger.log('INIT', `⚠️ Stripe account missing: ${account.name}`);
      }
    });
  }

  async simulateSquareSync() {
    this.logger.log('SQUARE', '━━━ Starting Square Payment Simulation (ONE AT A TIME) ━━━');
    
    if (!this.squareClient) {
      this.logger.log('SQUARE', '❌ Square client not initialized');
      return;
    }

    try {
      let cursor: string | undefined = undefined;
      let paymentCount = 0;
      
      // Process payments ONE at a time with cursor
      while (true) {
        // Fetch ONE payment
        const response = await this.squareClient.payments.list({ 
          limit: 1,  // ONE payment at a time as required
          cursor: cursor 
        });
        
        const payments = response.data || [];
        
        if (payments.length === 0) {
          // No more payments
          break;
        }
        
        paymentCount++;
        
        // Process the ONE payment
        for (const payment of payments) {
            this.counters.square.payments++;
            
            // Process payment
            if (payment.status !== 'COMPLETED') {
              this.counters.square.skipped++;
              continue;
            }

            if (payment.refundedMoney && payment.refundedMoney.amount > 0) {
              this.counters.square.refunded++;
              continue;
            }

            this.counters.square.completed++;

            // Count operations
            if (payment.orderId) this.counters.square.orders++;
            if (payment.customerId) this.counters.square.customers++;

            // Simulate registration lookup (would actually call Supabase)
            // For simulation, assume 70% have registrations
            if (Math.random() > 0.3) {
              this.counters.registrations.found++;
              
              // Simulate attendees and tickets
              const attendeeCount = Math.floor(Math.random() * 3) + 1;
              this.counters.attendees += attendeeCount;
              this.counters.tickets += attendeeCount * 2;
              this.counters.contacts.new += attendeeCount;
            } else {
              this.counters.registrations.notFound++;
            }
            
            // Show progress every 10 payments
            if (this.counters.square.payments % 10 === 0) {
              this.logger.progress(this.counters.square.payments, this.counters.square.payments, 'Square payments');
            }
        }
        
        // Get cursor for next payment from response.response.cursor
        cursor = (response as any).response?.cursor;
        
        if (!cursor) {
          // No more payments
          break;
        }
      }
      
      this.logger.log('SQUARE', `✅ Square simulation complete`, {
        totalPayments: this.counters.square.payments,
        completed: this.counters.square.completed,
        skipped: this.counters.square.skipped,
        refunded: this.counters.square.refunded
      });
      
    } catch (error: any) {
      this.logger.log('SQUARE', `Error simulating Square sync: ${error.message}`);
    }
  }

  async simulateStripeSync() {
    for (const [accountName, stripe] of this.stripeClients) {
      this.logger.log('STRIPE', `\n━━━ Starting ${accountName} Simulation (ONE AT A TIME) ━━━`);
      
      try {
        let hasMore = true;
        let startingAfter: string | undefined;
        let accountCharges = 0;
        
        while (hasMore) {
          // Fetch ONE charge at a time
          const charges = await stripe.charges.list({ 
            limit: 1,  // ONE charge at a time as required
            starting_after: startingAfter 
          });
          
          for (const charge of charges.data) {
            this.counters.stripe.charges++;
            accountCharges++;
            
            // Process charge
            if (!charge.paid) {
              continue;
            }

            if (charge.refunded && charge.amount_refunded === charge.amount) {
              this.counters.stripe.refunded++;
              continue;
            }

            // Check for test payment
            const cardLast4 = charge.payment_method_details?.card?.last4;
            const email = charge.receipt_email || charge.billing_details?.email || '';
            
            if (cardLast4 === '8251' && email.includes('@allatt.me')) {
              this.counters.stripe.testPayments++;
              continue;
            }

            this.counters.stripe.paid++;

            // Simulate registration lookup
            if (charge.payment_intent) {
              // For simulation, assume 80% have registrations for Stripe
              if (Math.random() > 0.2) {
                this.counters.registrations.found++;
                
                // Simulate attendees
                const attendeeCount = Math.floor(Math.random() * 2) + 1;
                this.counters.attendees += attendeeCount;
                this.counters.contacts.new += attendeeCount;
              } else {
                this.counters.registrations.notFound++;
              }
            }
            
            // Show progress every 10 charges
            if (accountCharges % 10 === 0) {
              this.logger.progress(accountCharges, accountCharges, `${accountName} charges`);
            }
          }
          
          hasMore = charges.has_more;
          if (charges.data.length > 0) {
            startingAfter = charges.data[charges.data.length - 1].id;
          }
        }
        
        this.counters.stripe.byAccount.set(accountName, accountCharges);
        this.logger.log('STRIPE', `✅ ${accountName} simulation complete`, {
          totalCharges: accountCharges
        });
        
      } catch (error: any) {
        this.logger.log('STRIPE', `Error simulating ${accountName}: ${error.message}`);
      }
    }
    
    this.logger.log('STRIPE', `✅ All Stripe accounts complete`, {
      totalCharges: this.counters.stripe.charges,
      paid: this.counters.stripe.paid,
      refunded: this.counters.stripe.refunded,
      testPayments: this.counters.stripe.testPayments,
      byAccount: Object.fromEntries(this.counters.stripe.byAccount)
    });
  }

  async simulateContactProcessing() {
    this.logger.log('CONTACTS', '\n━━━ Contact Processing Simulation ━━━');
    
    // Estimate deduplication
    this.counters.contacts.deduplicated = Math.floor(this.counters.contacts.new * 0.15);
    const uniqueContacts = this.counters.contacts.new - this.counters.contacts.deduplicated;
    
    this.logger.log('CONTACTS', 'Contact deduplication analysis', {
      totalContacts: this.counters.contacts.new,
      duplicatesRemoved: this.counters.contacts.deduplicated,
      uniqueContacts: uniqueContacts,
      strategy: 'email + mobile + lastName + firstName'
    });
  }

  async run() {
    this.logger.log('MAIN', '🚀 Starting FULL DRY RUN sync simulation\n');
    
    // Simulate database connection
    this.logger.log('DATABASE', 'WOULD CONNECT: MongoDB database "lodgetix"');
    
    // Run full simulations
    await this.simulateSquareSync();
    await this.simulateStripeSync();
    await this.simulateContactProcessing();
    
    // Generate final summary
    const totalPayments = this.counters.square.completed + this.counters.stripe.paid;
    const totalSkipped = this.counters.square.skipped + this.counters.square.refunded + 
                        this.counters.stripe.refunded + this.counters.stripe.testPayments;
    
    this.logger.log('SUMMARY', '\n━━━ FINAL SIMULATION STATISTICS ━━━', {
      totalRecordsProcessed: this.counters.square.payments + this.counters.stripe.charges,
      totalPaymentsToImport: totalPayments,
      totalSkipped: totalSkipped,
      square: {
        totalProcessed: this.counters.square.payments,
        completed: this.counters.square.completed,
        skipped: this.counters.square.skipped,
        refunded: this.counters.square.refunded,
        orders: this.counters.square.orders,
        customers: this.counters.square.customers
      },
      stripe: {
        totalProcessed: this.counters.stripe.charges,
        paid: this.counters.stripe.paid,
        refunded: this.counters.stripe.refunded,
        testPayments: this.counters.stripe.testPayments,
        byAccount: Object.fromEntries(this.counters.stripe.byAccount)
      },
      registrations: this.counters.registrations,
      estimatedAttendees: this.counters.attendees,
      estimatedTickets: this.counters.tickets,
      estimatedContacts: {
        total: this.counters.contacts.new,
        unique: this.counters.contacts.new - this.counters.contacts.deduplicated,
        deduplicated: this.counters.contacts.deduplicated
      }
    });
    
    const summary = this.logger.summary();
    
    console.log('\n' + '='.repeat(80));
    console.log('🎭 FULL DRY RUN COMPLETE - No actual changes were made');
    console.log(`📊 Total payments that would be imported: ${totalPayments}`);
    console.log(`⏭️  Total payments that would be skipped: ${totalSkipped}`);
    console.log('📄 Review the detailed log at:');
    console.log(`   ${summary.logPath}`);
    console.log('='.repeat(80));
  }
}

// Main execution
async function main() {
  const dryRun = new FullDryRunSyncService();
  await dryRun.run();
}

main().catch(console.error);