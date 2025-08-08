// @ts-nocheck
const { MongoClient } = require('mongodb');

async function searchPaymentAndRegistration(transactionId, confirmationNumber) {
  // Load environment variables
  require('dotenv').config({ path: '.env.local' });
  
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'LodgeTix';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log(`Connected to MongoDB database: ${dbName}`);
    const db = client.db(dbName);
    
    console.log('=== SEARCHING FOR PAYMENT ===');
    console.log(`Transaction ID: ${transactionId}\n`);
    
    // Search for payment with the transaction ID
    const payment = await db.collection('payments').findOne({
      $or: [
        { transactionId: transactionId },
        { paymentId: transactionId },
        { stripePaymentIntentId: transactionId },
        { 'transactionDetails.transactionId': transactionId }
      ]
    });
    
    if (payment) {
      console.log('✓ Payment found!');
      console.log('Payment details:');
      console.log('- MongoDB ID:', payment._id);
      console.log('- Transaction ID:', payment.transactionId || payment.paymentId);
      console.log('- Amount:', payment.amount || payment.grossAmount || payment.transactionDetails?.amount);
      console.log('- Currency:', payment.currency || 'AUD');
      console.log('- Customer Email:', payment.customerEmail || payment.email || payment.customer?.email);
      console.log('- Date:', payment.timestamp || payment.createdAt || payment.transactionDetails?.timestamp);
      console.log('- Status:', payment.status || 'Unknown');
      console.log('- Invoice Created:', payment.invoiceCreated || false);
      console.log('- Invoice Number:', payment.invoiceNumber || 'N/A');
      console.log('- Invoice ID:', payment.invoiceId || 'N/A');
      console.log('- Registration ID:', payment.registrationId || 'N/A');
      
      // Check if invoice exists
      if (payment.invoiceId) {
        const invoice = await db.collection('invoices').findOne({ _id: payment.invoiceId });
        console.log('- Invoice exists in DB:', !!invoice);
        if (invoice) {
          console.log('  - Invoice Status:', invoice.status);
          console.log('  - Invoice Total:', invoice.total);
        }
      }
    } else {
      console.log('✗ Payment not found with transaction ID:', transactionId);
      
      // Try broader search
      const similarPayments = await db.collection('payments').find({
        $or: [
          { transactionId: { $regex: transactionId.substring(0, 10), $options: 'i' } },
          { paymentId: { $regex: transactionId.substring(0, 10), $options: 'i' } }
        ]
      }).limit(5).toArray();
      
      if (similarPayments.length > 0) {
        console.log('\nSimilar payments found:');
        similarPayments.forEach(p => {
          console.log(`- ${p.transactionId || p.paymentId} (${p.customerEmail || p.email})`);
        });
      }
    }
    
    console.log('\n=== SEARCHING FOR REGISTRATION ===');
    console.log(`Confirmation Number: ${confirmationNumber}\n`);
    
    // Search for registration with the confirmation number
    const registration = await db.collection('registrations').findOne({
      $or: [
        { confirmationNumber: confirmationNumber },
        { confirmationCode: confirmationNumber },
        { 'registrationDetails.confirmationNumber': confirmationNumber }
      ]
    });
    
    if (registration) {
      console.log('✓ Registration found!');
      console.log('Registration details:');
      console.log('- MongoDB ID:', registration._id);
      console.log('- Confirmation Number:', registration.confirmationNumber || registration.confirmationCode);
      console.log('- Contact ID:', registration.contactId);
      console.log('- Event ID:', registration.eventId);
      console.log('- Function ID:', registration.functionId);
      console.log('- Status:', registration.status || 'Unknown');
      console.log('- Created:', registration.createdAt);
      console.log('- Updated:', registration.updatedAt);
      console.log('- Total Amount:', registration.totalAmount || registration.total);
      console.log('- Payment Status:', registration.paymentStatus || 'Unknown');
      
      // Check for associated contact
      if (registration.contactId) {
        const contact = await db.collection('contacts').findOne({ _id: registration.contactId });
        if (contact) {
          console.log('\nAssociated Contact:');
          console.log('- Name:', `${contact.firstName} ${contact.lastName}`);
          console.log('- Email:', contact.email);
        }
      }
      
      // Check for associated function
      if (registration.functionId) {
        const func = await db.collection('functions').findOne({ _id: registration.functionId });
        if (func) {
          console.log('\nAssociated Function:');
          console.log('- Name:', func.name);
          console.log('- Date:', func.date || func.startDate);
        }
      }
    } else {
      console.log('✗ Registration not found with confirmation number:', confirmationNumber);
      
      // Try broader search
      const similarRegistrations = await db.collection('registrations').find({
        confirmationNumber: { $regex: confirmationNumber.substring(0, 8), $options: 'i' }
      }).limit(5).toArray();
      
      if (similarRegistrations.length > 0) {
        console.log('\nSimilar registrations found:');
        similarRegistrations.forEach(r => {
          console.log(`- ${r.confirmationNumber} (Contact ID: ${r.contactId})`);
        });
      }
    }
    
    // Check if payment and registration are linked
    if (payment && registration) {
      console.log('\n=== RELATIONSHIP CHECK ===');
      if (payment.registrationId === registration._id.toString()) {
        console.log('✓ Payment and Registration are properly linked!');
      } else {
        console.log('✗ Payment and Registration are NOT linked');
        console.log('- Payment registrationId:', payment.registrationId || 'None');
        console.log('- Registration ID:', registration._id);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Get command line arguments
const transactionId = process.argv[2];
const confirmationNumber = process.argv[3];

if (!transactionId || !confirmationNumber) {
  console.log('Usage: node search-payment-registration.js <transactionId> <confirmationNumber>');
  console.log('Example: node search-payment-registration.js nWPv0XIDWiytzqKiC8Z12mPR6pMZY IND-997699KO');
  process.exit(1);
}

searchPaymentAndRegistration(transactionId, confirmationNumber).catch(console.error);
