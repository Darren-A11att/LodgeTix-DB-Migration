require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function inspectRecentInvoice() {
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
    
    console.log('Connected to MongoDB\n');
    
    // Find a recent invoice we created
    const invoice = await db.collection('invoices').findOne({
      invoiceNumber: 'LTIV-250625013'
    });
    
    if (invoice) {
      console.log('Invoice Details:');
      console.log(`  ID: ${invoice._id}`);
      console.log(`  Number: ${invoice.invoiceNumber}`);
      console.log(`  Customer Invoice Items: ${invoice.customerInvoice?.items?.length || 0}`);
      console.log(`  Supplier Invoice Items: ${invoice.supplierInvoice?.items?.length || 0}`);
      
      if (invoice.customerInvoice?.items?.length > 0) {
        console.log('\nCustomer Invoice Items:');
        invoice.customerInvoice.items.forEach((item, idx) => {
          console.log(`\n  ${idx + 1}. ${item.description}`);
          console.log(`     Type: ${item.type || 'N/A'}`);
          console.log(`     Quantity: ${item.quantity}`);
          console.log(`     Price: ${item.price}`);
          console.log(`     Has SubItems: ${!!item.subItems}`);
          
          if (item.subItems) {
            console.log(`     SubItems (${item.subItems.length}):`);
            item.subItems.forEach((sub, sidx) => {
              console.log(`       ${sidx + 1}. ${sub.description} - Qty: ${sub.quantity}, Price: $${sub.price}`);
            });
          }
        });
      }
      
      // Check the related registration
      const registrationId = invoice.customerInvoice?.registrationId || invoice.registration?._id;
      if (registrationId) {
        const registration = await db.collection('registrations').findOne({
          _id: new ObjectId(registrationId)
        });
        
        if (registration) {
          console.log('\nRegistration Details:');
          console.log(`  Confirmation: ${registration.confirmationNumber}`);
          console.log(`  Attendees: ${registration.attendees?.length || 0}`);
          console.log(`  Selected Tickets: ${registration.selectedTickets?.length || 0}`);
        }
      }
    } else {
      console.log('Invoice not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

inspectRecentInvoice().catch(console.error);