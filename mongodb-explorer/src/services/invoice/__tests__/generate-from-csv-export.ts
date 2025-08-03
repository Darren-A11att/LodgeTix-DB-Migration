/**
 * Generate invoices from the ACTUAL CSV export data
 * This uses the real registration data from your database export
 */

import { InvoiceService } from '../invoice-service';
import { PaymentData, RegistrationData } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse/sync';

// Output directory
const outputDir = path.join(__dirname, 'actual-invoice-outputs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read the registrations CSV
const registrationsCsvPath = '/Users/darrenallatt/Development/LodgeTix - Reconcile/Database-Export/registrations_rows (1).csv';
const paymentsCsvPath = '/Users/darrenallatt/Development/LodgeTix - Reconcile/Payments-Export/transactions-2025-01-01-2026-01-01.csv';

// Parse CSVs
const registrationsData = fs.readFileSync(registrationsCsvPath, 'utf-8');
const registrations = csv.parse(registrationsData, { columns: true });

const paymentsData = fs.readFileSync(paymentsCsvPath, 'utf-8');
const payments = csv.parse(paymentsData, { columns: true });

// Your test cases
const testCases = [
  // Individuals
  { paymentId: '5PrnY0XUftoHpNQlwZ290aFWuNIZY', confirmationNumber: 'IND-029388TI' },
  { paymentId: 'BrhCj6Bg8tBQE7msfhF9H0x2WKCZY', confirmationNumber: 'IND-702724KT' },
  { paymentId: '1VbL3ugoImEF2C31JF8alMHhEjSZY', confirmationNumber: 'IND-107839YX' },
  { paymentId: 'pbpNmIVzBxUGo8UFdlH9DTCTMCbZY', confirmationNumber: 'IND-648819EP' },
  { paymentId: 'pv33sbCpxAUmcV6lVO0u2itrGMXZY', confirmationNumber: 'IND-522951GX' },
  
  // Lodges
  { paymentId: 'rk9fpBTMTybyXza0YCvph5lW3NQZY', confirmationNumber: 'LDG-867620PW' },
  { paymentId: 'TYT8M8wPO4wy1LaBRbCyfIAXEDBZY', confirmationNumber: 'LDG-643031YX' },
  { paymentId: 'vMYRIPaS9VU9lmsZZ7WPmH0WhkZZY', confirmationNumber: 'LDG-210679FX' },
  { paymentId: 'NJ7rsmtw4soG3otEfmHtn1nVlEdZY', confirmationNumber: 'IND-128022YC' },
  { paymentId: 'b2ujce56CqbpooEoewgNAxa9OMBZY', confirmationNumber: 'IND-930810GG' }
];

async function generateFromCsvExport() {
  console.log('Generating invoices from ACTUAL CSV export data...\\n');
  
  let successCount = 0;
  
  for (const testCase of testCases) {
    try {
      console.log(`\\nProcessing ${testCase.confirmationNumber}...`);
      
      // Find registration in CSV
      const registrationRow = registrations.find((r: any) => 
        r.confirmation_number === testCase.confirmationNumber
      );
      
      if (!registrationRow) {
        console.log(`  ❌ Registration not found in CSV: ${testCase.confirmationNumber}`);
        continue;
      }
      
      // Find payment in CSV
      const paymentRow = payments.find((p: any) => 
        p['Transaction ID'] === testCase.paymentId
      );
      
      if (!paymentRow) {
        console.log(`  ❌ Payment not found in CSV: ${testCase.paymentId}`);
        continue;
      }
      
      // Parse registration data JSON
      const registrationData = JSON.parse(registrationRow.registration_data || '{}');
      
      // Convert CSV data to our types
      const payment: PaymentData = {
        _id: testCase.paymentId,
        paymentId: testCase.paymentId,
        transactionId: paymentRow['Payment ID'],
        amount: parseFloat(paymentRow['Net Total'].replace(/[$,]/g, '')),
        grossAmount: parseFloat(paymentRow['Total Collected'].replace(/[$,]/g, '')),
        fees: Math.abs(parseFloat(paymentRow['Fees'].replace(/[$,]/g, ''))),
        currency: 'AUD',
        paymentMethod: 'credit_card',
        paymentDate: new Date(`${paymentRow['Date']} ${paymentRow['Time']}`),
        customerName: paymentRow['Customer Name'] || registrationRow.primary_attendee,
        cardBrand: paymentRow['Card Brand'],
        cardLast4: paymentRow['PAN Suffix'],
        status: 'paid',
        source: 'square',
        description: paymentRow['Details']
      };
      
      const registration: RegistrationData = {
        _id: registrationRow.registration_id,
        confirmationNumber: registrationRow.confirmation_number,
        registrationType: registrationRow.registration_type,
        functionName: registrationData.functionName || 'Grand Proclamation 2025',
        lodgeName: registrationRow.organisation_name,
        registrationData: registrationData,
        metadata: registrationData.metadata || {},
        customerEmail: registrationData.bookingContact?.email || registrationData.bookingContact?.emailAddress
      };
      
      console.log(`  ✓ Found registration: ${registration.registrationType}`);
      console.log(`  ✓ Found payment: $${payment.grossAmount} (${payment.customerName})`);
      console.log(`  ✓ Attendees: ${registrationData.attendees?.length || 0}`);
      console.log(`  ✓ Tickets: ${registrationData.selectedTickets?.length || 0}`);
      
      // Generate invoice numbers
      const invoiceNumbers = {
        customerInvoiceNumber: `LTIV-2412-REAL${(successCount + 1).toString().padStart(3, '0')}`,
        supplierInvoiceNumber: `LTSP-2412-REAL${(successCount + 1).toString().padStart(3, '0')}`
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
          confirmationNumber: testCase.confirmationNumber
        },
        csvData: {
          paymentRow: {
            Date: paymentRow['Date'],
            Time: paymentRow['Time'],
            'Gross Sales': paymentRow['Gross Sales'],
            'Total Collected': paymentRow['Total Collected'],
            'Fees': paymentRow['Fees'],
            'Net Total': paymentRow['Net Total'],
            'Customer Name': paymentRow['Customer Name'],
            'Card Brand': paymentRow['Card Brand'],
            'PAN Suffix': paymentRow['PAN Suffix']
          },
          registrationRow: {
            registration_type: registrationRow.registration_type,
            primary_attendee: registrationRow.primary_attendee,
            attendee_count: registrationRow.attendee_count,
            total_amount_paid: registrationRow.total_amount_paid
          }
        },
        parsedData: {
          payment,
          registration: {
            _id: registration._id,
            confirmationNumber: registration.confirmationNumber,
            registrationType: registration.registrationType,
            attendeeCount: registrationData.attendees?.length,
            ticketCount: registrationData.selectedTickets?.length
          }
        },
        generatedInvoices: {
          customer: customerInvoice,
          supplier: supplierInvoice
        },
        summary: {
          paymentAmount: payment.grossAmount,
          customerInvoiceTotal: customerInvoice.total,
          supplierInvoiceTotal: supplierInvoice.total,
          processingFees: customerInvoice.processingFees,
          softwareUtilizationFee: supplierInvoice.items.find(i => i.description.includes('Software'))?.price || 0
        }
      };
      
      const filename = `${testCase.confirmationNumber}.json`;
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
    }
  }
  
  console.log('\\n' + '='.repeat(50));
  console.log(`✅ Successfully generated: ${successCount} invoices from ACTUAL DATA`);
  console.log(`\\n📁 Output directory: ${outputDir}`);
  console.log('\\nThese invoices were generated from your actual database export CSVs!');
}

// Run it
generateFromCsvExport().catch(console.error);