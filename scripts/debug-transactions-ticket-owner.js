const { MongoClient } = require('mongodb');

async function debugTransactionsTicketOwner() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('LodgeTix');
    
    console.log('\n=== ANALYZING TRANSACTIONS COLLECTION ===');
    
    // Get sample transactions
    const transactions = await db.collection('transactions').find({}).limit(5).toArray();
    
    console.log(`\nFound ${transactions.length} sample transactions`);
    
    // Analyze transaction structure for ticket/owner data
    transactions.forEach((transaction, index) => {
      console.log(`\n--- Transaction ${index + 1} ---`);
      console.log(`ID: ${transaction._id}`);
      console.log(`Registration Type: ${transaction.registrationType}`);
      console.log(`Invoice Type: ${transaction.invoiceType}`);
      console.log(`Payment Status: ${transaction.paymentStatus}`);
      
      // Check for owner/attendee data
      console.log('\nBill To Information:');
      console.log(`  Business Name: ${transaction.billTo_businessName || 'N/A'}`);
      console.log(`  First Name: ${transaction.billTo_firstName || 'N/A'}`);
      console.log(`  Last Name: ${transaction.billTo_lastName || 'N/A'}`);
      console.log(`  Email: ${transaction.billTo_email || 'N/A'}`);
      
      // Check for item/ticket data
      console.log('\nItem Information:');
      console.log(`  Description: ${transaction.item_description || 'N/A'}`);
      console.log(`  Quantity: ${transaction.item_quantity || 'N/A'}`);
      console.log(`  Price: ${transaction.item_price || 'N/A'}`);
      
      // Look for any ticket-related fields
      const ticketFields = Object.keys(transaction).filter(key => 
        key.toLowerCase().includes('ticket') || 
        key.toLowerCase().includes('attendee') ||
        key.toLowerCase().includes('owner')
      );
      
      if (ticketFields.length > 0) {
        console.log('\nTicket-related fields found:');
        ticketFields.forEach(field => {
          console.log(`  ${field}: ${JSON.stringify(transaction[field])}`);
        });
      }
    });
    
    // Check for different registration types
    console.log('\n\n=== REGISTRATION TYPES ===');
    const regTypes = await db.collection('transactions').distinct('registrationType');
    console.log('Unique registration types:', regTypes);
    
    // Check for lodge vs individual registrations
    console.log('\n=== CHECKING LODGE VS INDIVIDUAL REGISTRATIONS ===');
    
    // Find a lodge registration
    const lodgeTransaction = await db.collection('transactions').findOne({ 
      registrationType: { $regex: /lodge/i } 
    });
    
    if (lodgeTransaction) {
      console.log('\nFound lodge registration:');
      console.log(`  Registration ID: ${lodgeTransaction.registrationId}`);
      console.log(`  Business Name: ${lodgeTransaction.billTo_businessName}`);
      console.log(`  Item: ${lodgeTransaction.item_description}`);
    }
    
    // Find an individual registration
    const individualTransaction = await db.collection('transactions').findOne({ 
      registrationType: { $regex: /individual/i } 
    });
    
    if (individualTransaction) {
      console.log('\nFound individual registration:');
      console.log(`  Registration ID: ${individualTransaction.registrationId}`);
      console.log(`  Name: ${individualTransaction.billTo_firstName} ${individualTransaction.billTo_lastName}`);
      console.log(`  Item: ${individualTransaction.item_description}`);
    }
    
    // Check invoice items structure
    console.log('\n\n=== CHECKING INVOICE ITEMS ===');
    const invoice = await db.collection('invoices').findOne({});
    
    if (invoice && invoice.items) {
      console.log('\nInvoice items structure:');
      console.log(`Number of items: ${invoice.items.length}`);
      if (invoice.items.length > 0) {
        console.log('\nFirst item:');
        console.log(JSON.stringify(invoice.items[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the debug script
debugTransactionsTicketOwner().catch(console.error);