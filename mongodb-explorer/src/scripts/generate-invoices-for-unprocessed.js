require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');

async function generateInvoicesForUnprocessed() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  
  if (!uri || !dbName) {
    console.error('Missing MONGODB_URI or MONGODB_DB environment variables');
    process.exit(1);
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('Connected to MongoDB');
    console.log('Finding unprocessed payments...\n');
    
    // Find payments that are paid but don't have invoice data
    const unprocessedPayments = await db.collection('payments').find({
      $and: [
        {
          $or: [
            { status: 'paid' },
            { paymentStatus: 'paid' }
          ]
        },
        {
          $or: [
            { invoiceData: { $exists: false } },
            { invoiceData: null },
            { 'invoiceData.invoiceNumber': { $exists: false } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${unprocessedPayments.length} payments without invoice data`);
    
    // Get limit from command line or default to 5
    const limit = process.argv[2] ? parseInt(process.argv[2]) : 5;
    const paymentsToProcess = unprocessedPayments.slice(0, limit);
    console.log(`Processing first ${paymentsToProcess.length} payments...\n`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    // Process each payment
    for (const payment of paymentsToProcess) {
      let registration = null;
      
      // Find matching registration
      if (payment.matchedRegistrationId || payment.registrationId) {
        const regId = payment.matchedRegistrationId || payment.registrationId;
        registration = await db.collection('registrations').findOne({ _id: regId });
      } else if (payment['PaymentIntent ID']) {
        registration = await db.collection('registrations').findOne({ 
          stripePaymentIntentId: payment['PaymentIntent ID'] 
        });
      } else if (payment.paymentId) {
        registration = await db.collection('registrations').findOne({ 
          stripePaymentIntentId: payment.paymentId 
        });
      } else if (payment.transactionId) {
        registration = await db.collection('registrations').findOne({ 
          stripePaymentIntentId: payment.transactionId 
        });
      }
      
      if (!registration) {
        console.log(`No registration found for payment ${payment._id}`);
        continue;
      }
      
      // Get event tickets for this registration
      let eventTickets = [];
      if (registration.functionId) {
        eventTickets = await db.collection('eventTickets').find({
          functionId: registration.functionId
        }).toArray();
      }
      
      // Prepare the invoice generation request
      const requestData = {
        paymentId: payment._id.toString(),
        registrationId: registration._id.toString(),
        relatedDocuments: {
          eventTickets: eventTickets
        }
      };
      
      console.log(`\nProcessing payment ${payment._id} with registration ${registration.confirmationNumber}...`);
      
      try {
        // Call the create-atomic API to generate invoice
        const response = await axios.post('http://localhost:3005/api/invoices/create-atomic', requestData, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.data.success) {
          processedCount++;
          console.log(`✓ Created invoice ${response.data.invoice.invoiceNumber}`);
        } else {
          errorCount++;
          console.error(`✗ Failed to create invoice: ${response.data.error}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`✗ Error creating invoice: ${error.response?.data?.error || error.message}`);
      }
      
      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n\nSummary:`);
    console.log(`Total payments processed: ${processedCount + errorCount}`);
    console.log(`Successfully created invoices: ${processedCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

generateInvoicesForUnprocessed().catch(console.error);