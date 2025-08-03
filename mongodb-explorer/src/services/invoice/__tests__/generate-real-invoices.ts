/**
 * Generate invoices from real payments and registrations
 */

import { InvoiceService } from '../invoice-service';
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lodgetix';
const DB_NAME = 'lodgetix';

// Output directory
const outputDir = path.join(__dirname, 'real-invoice-outputs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Payment IDs to process
const testPaymentIds = [
  // Individuals
  '5PrnY0XUftoHpNQlwZ290aFWuNIZY', // IND-029388TI - LUIS A REYES - $277.10
  'BrhCj6Bg8tBQE7msfhF9H0x2WKCZY', // IND-702724KT - Stoyan Dimitrov - $21.47
  '1VbL3ugoImEF2C31JF8alMHhEjSZY', // IND-107839YX - Eric Amador - $21.47
  'pbpNmIVzBxUGo8UFdlH9DTCTMCbZY', // IND-648819EP - Robert Moore - $21.47
  'pv33sbCpxAUmcV6lVO0u2itrGMXZY', // IND-522951GX - Ken SHEPPARD - $287.32
  
  // Lodges
  'rk9fpBTMTybyXza0YCvph5lW3NQZY', // LDG-867620PW - Unknown - $4717.59
  'TYT8M8wPO4wy1LaBRbCyfIAXEDBZY', // LDG-643031YX - Unknown - $1179.40
  'vMYRIPaS9VU9lmsZZ7WPmH0WhkZZY', // LDG-210679FX - Unknown - $1196.32
  // We need 2 more lodge payments - let's also check these that might be lodge
  'NJ7rsmtw4soG3otEfmHtn1nVlEdZY', // IND-128022YC - David Baker - $1999.85 (high amount, might be lodge)
  'b2ujce56CqbpooEoewgNAxa9OMBZY', // IND-930810GG - David Baker - $1999.85 (high amount, might be lodge)
];

async function generateRealInvoices() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db(DB_NAME);
    
    const paymentsCollection = db.collection('payments');
    const registrationsCollection = db.collection('registrations');
    
    console.log('\\nProcessing real payments and registrations...\\n');
    
    let individualCount = 0;
    let lodgeCount = 0;
    
    for (const paymentId of testPaymentIds) {
      try {
        console.log(`\\nProcessing payment: ${paymentId}`);
        
        // Find payment
        const payment = await paymentsCollection.findOne({ paymentId });
        if (!payment) {
          console.log(`  ❌ Payment not found: ${paymentId}`);
          continue;
        }
        
        console.log(`  ✓ Found payment: ${payment.customerName || 'Unknown'} - $${payment.amount}`);
        
        // Find matching registration
        const confirmationNumber = payment.metadata?.confirmationNumber || 
                                 payment.description?.match(/[A-Z]{3}-\\d{6}[A-Z]{2}/)?.[0];
        
        if (!confirmationNumber) {
          console.log(`  ❌ No confirmation number found in payment`);
          continue;
        }
        
        console.log(`  → Looking for registration: ${confirmationNumber}`);
        
        const registration = await registrationsCollection.findOne({ 
          confirmationNumber: confirmationNumber 
        });
        
        if (!registration) {
          console.log(`  ❌ Registration not found: ${confirmationNumber}`);
          continue;
        }
        
        const registrationType = registration.registrationType || registration.type || 'unknown';
        console.log(`  ✓ Found ${registrationType} registration`);
        
        // Generate invoice numbers
        const isLodge = registrationType === 'lodge' || 
                       confirmationNumber.startsWith('LDG') ||
                       (payment.amount > 1000 && !registration.registrationData?.attendees?.length);
        
        const typePrefix = isLodge ? 'lodge' : 'individual';
        const counter = isLodge ? ++lodgeCount : ++individualCount;
        
        if ((isLodge && lodgeCount > 5) || (!isLodge && individualCount > 5)) {
          console.log(`  → Skipping (already have 5 ${typePrefix} invoices)`);
          continue;
        }
        
        const invoiceNumbers = {
          customerInvoiceNumber: `LTIV-2412-REAL${counter.toString().padStart(3, '0')}`,
          supplierInvoiceNumber: `LTSP-2412-REAL${counter.toString().padStart(3, '0')}`
        };
        
        // Generate invoices
        console.log(`  → Generating invoices...`);
        const { customerInvoice, supplierInvoice } = await InvoiceService.generateInvoicePair({
          payment,
          registration,
          invoiceNumbers
        });
        
        // Prepare output
        const output = {
          testCase: `${typePrefix}-${counter.toString().padStart(2, '0')}-real`,
          paymentId: payment.paymentId,
          confirmationNumber: confirmationNumber,
          payment: {
            _id: payment._id,
            paymentId: payment.paymentId,
            amount: payment.amount,
            customerName: payment.customerName,
            customerEmail: payment.customerEmail,
            paymentDate: payment.paymentDate || payment.timestamp,
            source: payment.source,
            metadata: payment.metadata
          },
          registration: {
            _id: registration._id,
            confirmationNumber: registration.confirmationNumber,
            registrationType: registrationType,
            functionName: registration.functionName,
            lodgeName: registration.lodgeName,
            registrationData: registration.registrationData,
            metadata: registration.metadata
          },
          customerInvoice,
          supplierInvoice,
          summary: {
            registrationType: registrationType,
            actualType: isLodge ? 'lodge' : 'individual',
            paymentSource: payment.source,
            customerTotal: customerInvoice.total,
            supplierTotal: supplierInvoice.total,
            processingFees: customerInvoice.processingFees,
            attendeeCount: registration.registrationData?.attendees?.length || 0,
            ticketCount: registration.registrationData?.selectedTickets?.length || 0
          }
        };
        
        // Save to file
        const filename = `${typePrefix}-${counter.toString().padStart(2, '0')}-${confirmationNumber}.json`;
        fs.writeFileSync(
          path.join(outputDir, filename),
          JSON.stringify(output, null, 2)
        );
        
        console.log(`  ✓ Saved to: ${filename}`);
        
      } catch (error) {
        console.error(`  ❌ Error processing ${paymentId}:`, error.message);
      }
    }
    
    console.log('\\n✅ Invoice generation complete!');
    console.log(`Generated ${individualCount} individual invoices and ${lodgeCount} lodge invoices`);
    console.log(`\\n📁 Output files saved to: ${outputDir}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the generator
generateRealInvoices();