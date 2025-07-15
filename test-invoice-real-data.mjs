#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env.local') });

// Import our modules dynamically to avoid TypeScript issues
async function loadModules() {
  const { InvoiceDataRepository } = await import('./src/services/invoice/invoice-data-repository.js');
  const { InvoiceGeneratorFactory } = await import('./src/services/invoice/generators/invoice-generator-factory.js');
  const { formatMoney } = await import('./src/services/invoice/calculators/monetary.js');
  
  return { InvoiceDataRepository, InvoiceGeneratorFactory, formatMoney };
}

// MongoDB connection details
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';

// Payment IDs provided by the user
const TEST_PAYMENT_IDS = {
  individuals: [
    'pi_3QWwNBI6o3M7akJR0xo7fLRD',
    'pi_3QWwXqI6o3M7akJR0CbhjGac',
    'pi_3QWvdDI6o3M7akJR10aGGBJz',
    'pi_3QWwKrI6o3M7akJR0pYM7Bya'
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
  console.log('MongoDB URI:', MONGODB_URI ? 'Found' : 'Not found');
  console.log('Database:', DATABASE_NAME);
  
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI not found in environment variables');
  }
  
  let client = null;
  
  try {
    // Load modules
    const { InvoiceDataRepository, InvoiceGeneratorFactory, formatMoney } = await loadModules();
    
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
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
        invoice.items.forEach((item, index) => {
          console.log(`     ${index + 1}. ${item.description}: $${formatMoney(item.price * item.quantity)}`);
        });
        
      } catch (error) {
        console.error(`❌ Error processing payment ${paymentId}:`, error.message);
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
        invoice.items.forEach((item, index) => {
          console.log(`     ${index + 1}. ${item.description}: $${formatMoney(item.price * item.quantity)}`);
        });
        
      } catch (error) {
        console.error(`❌ Error processing payment ${paymentId}:`, error.message);
      }
    }
    
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
testInvoiceGeneration()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nTest failed:', error);
    process.exit(1);
  });