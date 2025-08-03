/**
 * Generate invoices from actual database data
 */

import { InvoiceService } from '../invoice-service';
import { InvoiceDataService } from '../data-service';
import * as fs from 'fs';
import * as path from 'path';

// Output directory
const outputDir = path.join(__dirname, 'database-invoice-outputs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Your provided payment IDs and confirmation numbers
const testCases = [
  // Individuals
  { paymentId: '5PrnY0XUftoHpNQlwZ290aFWuNIZY', confirmationNumber: 'IND-029388TI', name: 'LUIS A REYES' },
  { paymentId: 'BrhCj6Bg8tBQE7msfhF9H0x2WKCZY', confirmationNumber: 'IND-702724KT', name: 'Stoyan Dimitrov' },
  { paymentId: '1VbL3ugoImEF2C31JF8alMHhEjSZY', confirmationNumber: 'IND-107839YX', name: 'Eric Amador' },
  { paymentId: 'pbpNmIVzBxUGo8UFdlH9DTCTMCbZY', confirmationNumber: 'IND-648819EP', name: 'Robert Moore' },
  { paymentId: 'pv33sbCpxAUmcV6lVO0u2itrGMXZY', confirmationNumber: 'IND-522951GX', name: 'Ken SHEPPARD' },
  
  // Lodges
  { paymentId: 'rk9fpBTMTybyXza0YCvph5lW3NQZY', confirmationNumber: 'LDG-867620PW', name: 'Unknown' },
  { paymentId: 'TYT8M8wPO4wy1LaBRbCyfIAXEDBZY', confirmationNumber: 'LDG-643031YX', name: 'Unknown' },
  { paymentId: 'vMYRIPaS9VU9lmsZZ7WPmH0WhkZZY', confirmationNumber: 'LDG-210679FX', name: 'Unknown' },
  { paymentId: 'NJ7rsmtw4soG3otEfmHtn1nVlEdZY', confirmationNumber: 'IND-128022YC', name: 'David Baker' },
  { paymentId: 'b2ujce56CqbpooEoewgNAxa9OMBZY', confirmationNumber: 'IND-930810GG', name: 'David Baker' }
];

async function generateFromDatabase() {
  console.log('Fetching data from database and generating invoices...\\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const testCase of testCases) {
    try {
      console.log(`\\nProcessing ${testCase.confirmationNumber} (${testCase.name})...`);
      
      // Fetch from database
      const { payment, registration } = await InvoiceDataService.getInvoiceData(
        testCase.paymentId,
        testCase.confirmationNumber
      );
      
      if (!payment) {
        console.log(`  ❌ Payment not found: ${testCase.paymentId}`);
        failCount++;
        continue;
      }
      
      if (!registration) {
        console.log(`  ❌ Registration not found: ${testCase.confirmationNumber}`);
        failCount++;
        continue;
      }
      
      console.log(`  ✓ Found payment: $${payment.amount || payment.grossAmount}`);
      console.log(`  ✓ Found registration: ${registration.registrationType || 'unknown'} type`);
      
      // Generate invoice numbers
      const invoiceNumbers = {
        customerInvoiceNumber: `LTIV-2412-DB${(successCount + 1).toString().padStart(3, '0')}`,
        supplierInvoiceNumber: `LTSP-2412-DB${(successCount + 1).toString().padStart(3, '0')}`
      };
      
      // Generate invoices
      console.log(`  → Generating invoices...`);
      const { customerInvoice, supplierInvoice } = await InvoiceService.generateInvoicePair({
        payment,
        registration,
        invoiceNumbers
      });
      
      // Save output
      const output = {
        testCase: {
          paymentId: testCase.paymentId,
          confirmationNumber: testCase.confirmationNumber,
          customerName: testCase.name
        },
        databaseData: {
          payment: {
            _id: payment._id,
            paymentId: payment.paymentId,
            amount: payment.amount,
            grossAmount: payment.grossAmount,
            fees: payment.fees,
            customerName: payment.customerName,
            customerEmail: payment.customerEmail,
            paymentDate: payment.paymentDate || payment.timestamp,
            source: payment.source,
            transactionId: payment.transactionId,
            metadata: payment.metadata
          },
          registration: {
            _id: registration._id,
            confirmationNumber: registration.confirmationNumber,
            registrationType: registration.registrationType,
            functionName: registration.functionName,
            registrationData: registration.registrationData,
            metadata: registration.metadata,
            lodgeName: registration.lodgeName,
            attendeeCount: registration.registrationData?.attendees?.length || 0
          }
        },
        generatedInvoices: {
          customer: customerInvoice,
          supplier: supplierInvoice
        },
        summary: {
          paymentAmount: payment.grossAmount || payment.amount,
          customerInvoiceTotal: customerInvoice.total,
          supplierInvoiceTotal: supplierInvoice.total,
          processingFees: customerInvoice.processingFees,
          attendeeCount: registration.registrationData?.attendees?.length || 0,
          ticketCount: registration.registrationData?.selectedTickets?.length || 0
        }
      };
      
      const filename = `${testCase.confirmationNumber}-${testCase.name.replace(/\\s+/g, '-').toLowerCase()}.json`;
      fs.writeFileSync(
        path.join(outputDir, filename),
        JSON.stringify(output, null, 2)
      );
      
      console.log(`  ✓ Generated successfully!`);
      console.log(`    Customer Invoice: ${customerInvoice.invoiceNumber} - $${customerInvoice.total.toFixed(2)}`);
      console.log(`    Supplier Invoice: ${supplierInvoice.invoiceNumber} - $${supplierInvoice.total.toFixed(2)}`);
      console.log(`  ✓ Saved to: ${filename}`);
      
      successCount++;
      
    } catch (error) {
      console.error(`  ❌ Error processing ${testCase.confirmationNumber}:`, error.message);
      failCount++;
    }
  }
  
  console.log('\\n' + '='.repeat(50));
  console.log(`✅ Successfully generated: ${successCount} invoices`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount} invoices`);
  }
  console.log(`\\n📁 Output directory: ${outputDir}`);
}

// Run it
generateFromDatabase().catch(console.error).finally(() => process.exit());