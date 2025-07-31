const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Import the required modules
const { NormalizedInvoicePreviewGenerator } = require('../dist/services/invoice-preview-generator-normalized');

async function testBackendInvoiceMatches() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING BACKEND INVOICE MATCHES RESPONSE ===\n');
    
    // Find the specific payment mentioned by the user
    const payment = await db.collection('payments').findOne({
      paymentId: 'vJBWFiJ8DfI6MSq2MB50eKJDibMZY'
    });
    
    if (!payment) {
      console.log('Payment not found');
      return;
    }
    
    console.log('Found payment:', payment.paymentId);
    console.log('Amount:', payment.amount);
    
    // Find the registration
    const registration = await db.collection('registrations').findOne({
      $or: [
        { paymentId: payment.paymentId },
        { squarePaymentId: payment.paymentId },
        { 'registrationData.square_payment_id': payment.paymentId }
      ]
    });
    
    if (!registration) {
      console.log('Registration not found');
      return;
    }
    
    console.log('\nFound registration:', registration.confirmationNumber);
    console.log('Type:', registration.registrationType);
    
    // Create the match result
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
    
    // Test the preview generator
    const previewGenerator = new NormalizedInvoicePreviewGenerator(db);
    const preview = await previewGenerator.generatePreview(matchResult);
    
    if (!preview) {
      console.log('No preview generated');
      return;
    }
    
    console.log('\n=== INVOICE PREVIEW ===');
    console.log('Invoice Number:', preview.invoiceNumber);
    console.log('Total:', preview.total);
    console.log('\nLine Items:');
    
    preview.items.forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.description}`);
      console.log(`   Type: ${item.type}`);
      console.log(`   Amount: $${item.amount}`);
      
      if (item.subItems) {
        item.subItems.forEach(sub => {
          console.log(`   - ${sub.description}: $${sub.amount}`);
        });
      }
    });
    
    // This is what should be in the API response
    console.log('\n=== EXPECTED API RESPONSE STRUCTURE ===');
    const apiResponse = {
      payment: payment,
      registration: registration,
      invoice: preview,
      matchConfidence: 100,
      matchDetails: []
    };
    
    console.log('\nThe invoice field should contain:');
    console.log('- items array with proper attendee names');
    console.log('- items array with ticket details as sub-items');
    console.log(`- Actual items count: ${preview.items.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the test
testBackendInvoiceMatches();