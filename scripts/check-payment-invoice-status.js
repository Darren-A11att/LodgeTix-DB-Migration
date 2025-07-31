const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkPaymentInvoiceStatus() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== CHECKING PAYMENT INVOICE STATUS ===\n');
    
    // Check the specific payment
    const payment = await db.collection('payments').findOne({
      paymentId: 'vJBWFiJ8DfI6MSq2MB50eKJDibMZY'
    });
    
    if (!payment) {
      console.log('Payment not found');
      return;
    }
    
    console.log('Payment found:');
    console.log('- Payment ID:', payment.paymentId);
    console.log('- Amount:', payment.amount);
    console.log('- Status:', payment.status);
    console.log('- Invoice Created:', payment.invoiceCreated);
    console.log('- Invoice Number:', payment.customerInvoiceNumber);
    
    // The API only returns payments without invoices
    if (payment.invoiceCreated === true) {
      console.log('\n❌ This payment already has an invoice created!');
      console.log('That\'s why it\'s not showing in the /api/invoices/matches endpoint');
      console.log('The matches endpoint only shows payments WITHOUT invoices');
      
      // Check if there's an invoice document
      const invoice = await db.collection('invoices').findOne({
        'payment.paymentId': payment.paymentId
      });
      
      if (invoice) {
        console.log('\n=== EXISTING INVOICE ===');
        console.log('Invoice ID:', invoice._id);
        console.log('Customer Invoice Number:', invoice.customerInvoice?.invoiceNumber);
        console.log('Created At:', invoice.createdAt);
      }
    } else {
      console.log('\n✅ This payment does not have an invoice yet');
      console.log('It should appear in the /api/invoices/matches endpoint');
      
      // Let's manually generate the preview to see what it would look like
      console.log('\n=== TESTING INVOICE PREVIEW GENERATION ===');
      
      const registration = await db.collection('registrations').findOne({
        $or: [
          { paymentId: payment.paymentId },
          { squarePaymentId: payment.paymentId },
          { 'registrationData.square_payment_id': payment.paymentId }
        ]
      });
      
      if (registration) {
        console.log('Registration found:', registration.confirmationNumber);
        
        // Check attendees and tickets
        const attendees = await db.collection('attendees').find({
          'registrations.registrationId': registration.registrationId
        }).toArray();
        
        const tickets = await db.collection('tickets').find({
          'details.registrationId': registration.registrationId,
          status: { $ne: 'cancelled' }
        }).toArray();
        
        console.log('Attendees in collection:', attendees.length);
        console.log('Tickets in collection:', tickets.length);
        
        if (attendees.length > 0 && tickets.length > 0) {
          console.log('\n✅ Invoice preview should work correctly');
        } else {
          console.log('\n❌ Missing data for invoice preview');
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the check
checkPaymentInvoiceStatus();