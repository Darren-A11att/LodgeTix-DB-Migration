const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Import the NormalizedInvoicePreviewGenerator
const { NormalizedInvoicePreviewGenerator } = require('../dist/services/invoice-preview-generator-normalized');

async function testInvoicePreviewGeneration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING INVOICE PREVIEW GENERATION ===\n');
    
    // Find a specific payment or the first one without an invoice
    const payment = await db.collection('payments').findOne({
      status: 'paid',
      invoiceCreated: { $ne: true }
    });
    
    if (!payment) {
      console.log('No payments without invoices found');
      return;
    }
    
    console.log('Payment ID:', payment.paymentId || payment._id);
    console.log('Payment Amount:', payment.amount);
    console.log('Customer:', payment.customerName);
    
    // Find matching registration
    const registration = await db.collection('registrations').findOne({
      $or: [
        { paymentId: payment.paymentId },
        { squarePaymentId: payment.paymentId },
        { stripe_payment_intent_id: payment.paymentId },
        { 'registrationData.square_payment_id': payment.paymentId }
      ]
    });
    
    if (!registration) {
      console.log('\nNo matching registration found');
      return;
    }
    
    console.log('\n--- Registration Data ---');
    console.log('Confirmation Number:', registration.confirmationNumber);
    console.log('Registration Type:', registration.registrationType);
    console.log('Attendees Extracted:', registration.registrationData?.attendeesExtracted);
    console.log('Tickets Extracted:', registration.registrationData?.ticketsExtracted);
    
    // Check raw attendees in registration
    const rawAttendees = registration.registrationData?.attendees || [];
    console.log('\nRaw attendees in registration:', rawAttendees.length);
    if (rawAttendees.length > 0) {
      console.log('First attendee:', JSON.stringify(rawAttendees[0], null, 2));
    }
    
    // Now test the normalized preview generator
    console.log('\n--- Testing Normalized Preview Generator ---');
    
    const previewGenerator = new NormalizedInvoicePreviewGenerator(db);
    
    // Create match result
    const matchResult = {
      payment: {
        _id: payment._id?.toString(),
        paymentId: payment.paymentId,
        transactionId: payment.transactionId,
        amount: payment.amount || 0,
        timestamp: payment.timestamp,
        source: payment.source,
        customerEmail: payment.customerEmail,
        status: payment.status
      },
      registration,
      matchConfidence: 100,
      matchMethod: 'direct',
      issues: []
    };
    
    // Generate preview
    const preview = await previewGenerator.generatePreview(matchResult);
    
    if (!preview) {
      console.log('Failed to generate preview');
      return;
    }
    
    console.log('\n--- Generated Invoice Preview ---');
    console.log('Invoice Number:', preview.invoiceNumber);
    console.log('Total:', preview.total);
    console.log('Line Items:', preview.items.length);
    
    // Check line items
    preview.items.forEach((item, index) => {
      console.log(`\nItem ${index + 1}:`);
      console.log('  Description:', item.description);
      console.log('  Type:', item.type);
      console.log('  Amount:', item.amount);
      
      if (item.subItems && item.subItems.length > 0) {
        console.log('  Sub-items:');
        item.subItems.forEach(sub => {
          console.log(`    - ${sub.description}: ${sub.quantity} x $${sub.unitPrice} = $${sub.amount}`);
        });
      }
    });
    
    // Verify data fetching
    console.log('\n--- Verifying Data Fetching ---');
    
    // Check if attendees were fetched
    const attendees = await db.collection('attendees').find({
      'registrations.registrationId': registration.registrationId
    }).toArray();
    
    console.log('Attendees fetched from collection:', attendees.length);
    attendees.forEach(a => {
      console.log(`  - ${a.firstName} ${a.lastName} (ID: ${a._id})`);
    });
    
    // Check if tickets were fetched
    const tickets = await db.collection('tickets').find({
      'details.registrationId': registration.registrationId,
      status: { $ne: 'cancelled' }
    }).toArray();
    
    console.log('\nTickets fetched from collection:', tickets.length);
    tickets.forEach(t => {
      console.log(`  - ${t.eventName}: $${t.price} (Owner: ${t.ownerType}/${t.ownerOId})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the test
testInvoicePreviewGeneration();