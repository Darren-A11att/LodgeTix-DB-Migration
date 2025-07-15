import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Import invoice modules using relative paths
import { InvoiceDataRepository } from '../src/services/invoice/invoice-data-repository';
import { InvoiceGeneratorFactory } from '../src/services/invoice/generators/invoice-generator-factory';
import { formatMoney } from '../src/services/invoice/calculators/monetary';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';

// Payment IDs from the database (Square payments without invoices)
const TEST_PAYMENT_IDS = {
  individuals: [
    '7fTbxcH1GzdONh6fZjVckE4KoPfZY',  // $21.47
    'ZsEMTNqhmD0zwVETdn8eYPCmrrcZY',  // $21.47
    'rFAMGl5AZuysQmzGsZKQkfOTygPZY',  // $21.47
    'R40EXOAyB9pW9wgL982AtQwCRo9YY'   // $21.47
  ],
  lodges: [
    'nDAOlY1ey3RSx6WVYo9WnCdvp9aZY',  // $1999.85
    'jJMU4B1lI87JOCclMGdKxwisHrcZY',  // $1999.85
    'DrnJc2FI9QPE3KEktWcZewKKzzJZY',  // $287.32
    'F0fRHM6SV5iy9ac26eznQ1nkDBgZY'   // $1179.40
  ]
};

async function main() {
  console.log('Environment check:');
  console.log('- MONGODB_URI:', MONGODB_URI ? 'Found' : 'Not found');
  console.log('- DATABASE_NAME:', DATABASE_NAME);
  console.log('');

  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db(DATABASE_NAME);
    console.log(`Connected to database: ${DATABASE_NAME}\n`);
    
    // Test collection access
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections`);
    console.log('- payments:', collections.some(c => c.name === 'payments') ? 'exists' : 'missing');
    console.log('- registrations:', collections.some(c => c.name === 'registrations') ? 'exists' : 'missing');
    console.log('');
    
    // Create repositories
    const dataRepository = new InvoiceDataRepository(db);
    const invoiceGeneratorFactory = new InvoiceGeneratorFactory();
    
    // Test a single payment first
    const testPaymentId = TEST_PAYMENT_IDS.individuals[0];
    console.log(`Testing single payment: ${testPaymentId}`);
    
    const { payment, registration } = await dataRepository.getPaymentWithRegistration(testPaymentId);
    
    if (!payment) {
      console.log('❌ Payment not found');
      
      // Try to find any payment
      const paymentsCollection = db.collection('payments');
      const samplePayment = await paymentsCollection.findOne({});
      console.log('\nSample payment from database:');
      console.log(JSON.stringify(samplePayment, null, 2).substring(0, 500) + '...');
    } else {
      console.log('✅ Payment found');
      console.log(`   Amount: $${formatMoney(payment.amount)}`);
      console.log(`   Source: ${payment.source}`);
      
      if (registration) {
        console.log('✅ Registration found');
        console.log(`   Confirmation: ${registration.confirmationNumber}`);
        
        // Generate invoice
        const generator = invoiceGeneratorFactory.getGenerator('Individual');
        const invoice = await generator.generateInvoice({
          payment,
          registration,
          invoiceNumbers: {
            customerInvoiceNumber: `TEST-${testPaymentId.slice(-6)}`,
            supplierInvoiceNumber: `TEST-${testPaymentId.slice(-6)}`
          }
        });
        
        console.log('\n📄 Invoice Generated:');
        console.log(`   Invoice Number: ${invoice.invoiceNumber}`);
        console.log(`   Total: $${formatMoney(invoice.total)}`);
        console.log(`   Items: ${invoice.items.length}`);
      } else {
        console.log('❌ Registration not found');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
main().catch(console.error);