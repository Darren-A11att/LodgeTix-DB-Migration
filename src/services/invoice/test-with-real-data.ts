/**
 * Test invoice generation with real data from the database
 */

import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { InvoiceDataRepository } from './invoice-data-repository';

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
import { InvoiceGeneratorFactory } from './generators/invoice-generator-factory';
import { formatMoney } from './calculators/monetary';

// MongoDB connection details
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

// Payment IDs provided by the user
const TEST_PAYMENT_IDS = {
  individuals: [
    'pi_3QWwNBI6o3M7akJR0xo7fLRD',
    'pi_3QWwXqI6o3M7akJR0CbhjGac',
    'pi_3QWvdDI6o3M7akJR10aGGBJz',
    'pi_3QWwKrI6o3M7akJR0pYM7Bya',
    'pi_3QWwNBI6o3M7akJR0xo7fLRD' // duplicate, will skip
  ],
  lodges: [
    'pi_3QWvJxI6o3M7akJR1QL0aLKK',
    'pi_3QX0NRI6o3M7akJR0HdqiJgb',
    'pi_3QX17xI6o3M7akJR0fZCQ9z6',
    'pi_3QX0jVI6o3M7akJR175YQnxr',
    'pi_3QWvgLI6o3M7akJR09n6rCT5'
  ]
};

async function testInvoiceGeneration() {
  let client: MongoClient | null = null;
  
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db: Db = client.db(DATABASE_NAME);
    console.log(`Connected to database: ${DATABASE_NAME}\n`);
    
    // Create repositories and services
    const dataRepository = new InvoiceDataRepository(db);
    const invoiceGeneratorFactory = new InvoiceGeneratorFactory();
    
    // Test Individual Registrations
    console.log('=== TESTING INDIVIDUAL REGISTRATIONS ===\n');
    
    for (const paymentId of TEST_PAYMENT_IDS.individuals) {
      console.log(`\nProcessing payment: ${paymentId}`);
      console.log('-'.repeat(50));
      
      try {
        // Fetch payment and registration
        const { payment, registration } = await dataRepository.getPaymentWithRegistration(paymentId);
        
        if (!payment) {
          console.log(`❌ Payment not found: ${paymentId}`);
          continue;
        }
        
        if (!registration) {
          console.log(`❌ No registration found for payment: ${paymentId}`);
          console.log(`   Payment amount: $${formatMoney(payment.amount)}`);
          console.log(`   Payment date: ${payment.timestamp}`);
          continue;
        }
        
        console.log(`✅ Found payment and registration`);
        console.log(`   Confirmation: ${registration.confirmationNumber}`);
        console.log(`   Amount: $${formatMoney(payment.amount)}`);
        
        // Generate invoice
        const generator = invoiceGeneratorFactory.getGenerator('Individual');
        const invoice = await generator.generateInvoice({
          payment,
          registration,
          invoiceNumbers: {
            customerInvoiceNumber: `TEST-${paymentId.slice(-6)}`,
            supplierInvoiceNumber: `TEST-${paymentId.slice(-6)}`
          }
        });
        
        console.log(`\n📄 Invoice Generated:`);
        console.log(`   Invoice Number: ${invoice.invoiceNumber}`);
        console.log(`   Bill To: ${invoice.billTo.firstName} ${invoice.billTo.lastName}`);
        console.log(`   Subtotal: $${formatMoney(invoice.subtotal)}`);
        console.log(`   Processing Fees: $${formatMoney(invoice.processingFees)}`);
        console.log(`   GST Included: $${formatMoney(invoice.gstIncluded)}`);
        console.log(`   Total: $${formatMoney(invoice.total)}`);
        console.log(`   Items: ${invoice.items.length}`);
        
        // Show line items
        invoice.items.forEach((item: any, index: number) => {
          console.log(`     ${index + 1}. ${item.description}: $${formatMoney(item.price * item.quantity)}`);
        });
        
      } catch (error) {
        console.error(`❌ Error processing payment ${paymentId}:`, error);
      }
    }
    
    // Test Lodge Registrations
    console.log('\n\n=== TESTING LODGE REGISTRATIONS ===\n');
    
    for (const paymentId of TEST_PAYMENT_IDS.lodges) {
      console.log(`\nProcessing payment: ${paymentId}`);
      console.log('-'.repeat(50));
      
      try {
        // Fetch payment and registration
        const { payment, registration } = await dataRepository.getPaymentWithRegistration(paymentId);
        
        if (!payment) {
          console.log(`❌ Payment not found: ${paymentId}`);
          continue;
        }
        
        if (!registration) {
          console.log(`❌ No registration found for payment: ${paymentId}`);
          console.log(`   Payment amount: $${formatMoney(payment.amount)}`);
          console.log(`   Payment date: ${payment.timestamp}`);
          continue;
        }
        
        console.log(`✅ Found payment and registration`);
        console.log(`   Confirmation: ${registration.confirmationNumber}`);
        console.log(`   Amount: $${formatMoney(payment.amount)}`);
        
        // Generate invoice
        const generator = invoiceGeneratorFactory.getGenerator('Lodge');
        const invoice = await generator.generateInvoice({
          payment,
          registration,
          invoiceNumbers: {
            customerInvoiceNumber: `TEST-${paymentId.slice(-6)}`,
            supplierInvoiceNumber: `TEST-${paymentId.slice(-6)}`
          }
        });
        
        console.log(`\n📄 Invoice Generated:`);
        console.log(`   Invoice Number: ${invoice.invoiceNumber}`);
        console.log(`   Bill To: ${invoice.billTo.businessName || `${invoice.billTo.firstName} ${invoice.billTo.lastName}`}`);
        console.log(`   Subtotal: $${formatMoney(invoice.subtotal)}`);
        console.log(`   Processing Fees: $${formatMoney(invoice.processingFees)}`);
        console.log(`   GST Included: $${formatMoney(invoice.gstIncluded)}`);
        console.log(`   Total: $${formatMoney(invoice.total)}`);
        console.log(`   Items: ${invoice.items.length}`);
        
        // Show line items
        invoice.items.forEach((item: any, index: number) => {
          console.log(`     ${index + 1}. ${item.description}: $${formatMoney(item.price * item.quantity)}`);
        });
        
      } catch (error) {
        console.error(`❌ Error processing payment ${paymentId}:`, error);
      }
    }
    
    // Test unmatched payments
    console.log('\n\n=== UNMATCHED PAYMENTS ===\n');
    const unmatchedPayments = await dataRepository.getUnmatchedPayments(10);
    console.log(`Found ${unmatchedPayments.length} unmatched payments`);
    
    unmatchedPayments.slice(0, 5).forEach(payment => {
      console.log(`  - ${payment.paymentId || payment.transactionId}: $${formatMoney(payment.amount)} (${payment.source})`);
    });
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nDatabase connection closed');
    }
  }
}

// Run the test
if (require.main === module) {
  testInvoiceGeneration()
    .then(() => {
      console.log('\nTest completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nTest failed:', error);
      process.exit(1);
    });
}

export { testInvoiceGeneration };