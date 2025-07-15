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
const TEST_PAYMENT_IDS = [
  '7fTbxcH1GzdONh6fZjVckE4KoPfZY',  // $21.47
  'ZsEMTNqhmD0zwVETdn8eYPCmrrcZY',  // $21.47
  'rFAMGl5AZuysQmzGsZKQkfOTygPZY',  // $21.47
  'R40EXOAyB9pW9wgL982AtQwCRo9YY',  // $21.47
  'nDAOlY1ey3RSx6WVYo9WnCdvp9aZY',  // $1999.85
  'jJMU4B1lI87JOCclMGdKxwisHrcZY',  // $1999.85
  'DrnJc2FI9QPE3KEktWcZewKKzzJZY',  // $287.32
  'F0fRHM6SV5iy9ac26eznQ1nkDBgZY'   // $1179.40
];

function determineRegistrationType(registration: any): string {
  const regType = registration.registrationType || 
                 registration.registrationData?.type ||
                 registration.type ||
                 registration.metadata?.registrationType;

  if (regType?.toLowerCase().includes('lodge')) return 'Lodge';
  if (regType?.toLowerCase().includes('delegation')) return 'Delegation';
  return 'Individual';
}

async function main() {
  console.log('Invoice Generation Test with Real Data');
  console.log('=====================================\n');

  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db(DATABASE_NAME);
    console.log(`Connected to database: ${DATABASE_NAME}\n`);
    
    // Create repositories
    const dataRepository = new InvoiceDataRepository(db);
    const invoiceGeneratorFactory = new InvoiceGeneratorFactory();
    
    const results = {
      successful: 0,
      failed: 0,
      noRegistration: 0,
      errors: [] as any[]
    };
    
    // Process each payment
    for (const paymentId of TEST_PAYMENT_IDS) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Processing Payment: ${paymentId}`);
      console.log(`${'='.repeat(70)}`);
      
      try {
        // Fetch payment and registration
        const { payment, registration } = await dataRepository.getPaymentWithRegistration(paymentId);
        
        if (!payment) {
          console.log('❌ Payment not found');
          results.failed++;
          results.errors.push({ paymentId, error: 'Payment not found' });
          continue;
        }
        
        console.log(`✅ Payment found`);
        console.log(`   Source: ${payment.source}`);
        console.log(`   Amount: $${formatMoney(payment.amount || payment.grossAmount || payment.netAmount)}`);
        console.log(`   Date: ${payment.timestamp}`);
        
        if (!registration) {
          console.log('❌ No registration found');
          results.noRegistration++;
          continue;
        }
        
        console.log(`✅ Registration found`);
        console.log(`   Confirmation: ${registration.confirmationNumber}`);
        
        // Determine registration type
        const registrationType = determineRegistrationType(registration);
        console.log(`   Type: ${registrationType}`);
        
        // Generate invoice
        const generator = invoiceGeneratorFactory.getGenerator(registrationType);
        const invoice = await generator.generateInvoice({
          payment,
          registration,
          invoiceNumbers: {
            customerInvoiceNumber: `TEST-${Date.now()}-C`,
            supplierInvoiceNumber: `TEST-${Date.now()}-S`
          }
        });
        
        console.log(`\n📄 Invoice Generated Successfully!`);
        console.log(`   Invoice Number: ${invoice.invoiceNumber}`);
        console.log(`   Bill To: ${invoice.billTo.businessName || `${invoice.billTo.firstName} ${invoice.billTo.lastName}`}`);
        console.log(`   Email: ${invoice.billTo.email}`);
        console.log(`\n   Financial Summary:`);
        console.log(`   - Subtotal: $${formatMoney(invoice.subtotal)}`);
        console.log(`   - Processing Fees: $${formatMoney(invoice.processingFees)}`);
        console.log(`   - GST Included: $${formatMoney(invoice.gstIncluded)}`);
        console.log(`   - Total: $${formatMoney(invoice.total)}`);
        
        console.log(`\n   Line Items (${invoice.items.length} items):`);
        invoice.items.forEach((item: any, index: number) => {
          const total = item.price * item.quantity;
          console.log(`   ${index + 1}. ${item.description}`);
          console.log(`      Qty: ${item.quantity} × $${formatMoney(item.price)} = $${formatMoney(total)}`);
        });
        
        // Validate totals
        const calculatedTotal = invoice.items.reduce((sum: number, item: any) => 
          sum + (item.price * item.quantity), 0
        );
        
        if (Math.abs(calculatedTotal - invoice.subtotal) > 0.01) {
          console.log(`\n⚠️  Warning: Calculated subtotal ($${formatMoney(calculatedTotal)}) doesn't match invoice subtotal ($${formatMoney(invoice.subtotal)})`);
        }
        
        results.successful++;
        
      } catch (error) {
        console.error(`\n❌ Error processing payment:`, error);
        results.failed++;
        results.errors.push({ 
          paymentId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    // Summary
    console.log(`\n${'='.repeat(70)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(70)}`);
    console.log(`Total Payments Processed: ${TEST_PAYMENT_IDS.length}`);
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⚠️  No Registration: ${results.noRegistration}`);
    
    if (results.errors.length > 0) {
      console.log(`\nErrors:`);
      results.errors.forEach(err => {
        console.log(`  - ${err.paymentId}: ${err.error}`);
      });
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
main().catch(console.error);