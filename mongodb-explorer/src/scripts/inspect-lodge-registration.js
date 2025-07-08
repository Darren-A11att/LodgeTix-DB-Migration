require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function inspectLodgeRegistration() {
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
    
    // Find a lodge registration
    const lodgeReg = await db.collection('registrations').findOne({
      confirmationNumber: 'LDG-317273ME'
    });
    
    if (lodgeReg) {
      console.log('Lodge Registration Details:');
      console.log(`  ID: ${lodgeReg._id}`);
      console.log(`  Confirmation: ${lodgeReg.confirmationNumber}`);
      console.log(`  Registration Type: ${lodgeReg.registrationType}`);
      console.log(`  Event Type: ${lodgeReg.eventType || 'N/A'}`);
      console.log(`  Function Name: ${lodgeReg.functionName || 'N/A'}`);
      console.log(`  Function ID: ${lodgeReg.functionId || 'N/A'}`);
      console.log(`\n  Lodge Information:`);
      console.log(`    Lodge Name: ${lodgeReg.lodgeName || 'N/A'}`);
      console.log(`    Lodge Number: ${lodgeReg.lodgeNumber || 'N/A'}`);
      console.log(`    Lodge ID: ${lodgeReg.lodgeId || 'N/A'}`);
      console.log(`\n  Data Structure:`);
      console.log(`    Has registrationData: ${!!lodgeReg.registrationData}`);
      console.log(`    Has bookingContact: ${!!lodgeReg.registrationData?.bookingContact}`);
      console.log(`    Attendees: ${lodgeReg.attendees?.length || 0}`);
      console.log(`    Selected Tickets: ${lodgeReg.selectedTickets?.length || 0}`);
      
      // Check what fields exist
      console.log(`\n  Available Fields:`);
      Object.keys(lodgeReg).filter(key => !['_id', 'createdAt', 'updatedAt'].includes(key)).forEach(key => {
        const value = lodgeReg[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          console.log(`    ${key}: [object with ${Object.keys(value).length} keys]`);
        } else if (Array.isArray(value)) {
          console.log(`    ${key}: [array with ${value.length} items]`);
        } else {
          console.log(`    ${key}: ${value}`);
        }
      });
      
      // Check booking contact if exists
      if (lodgeReg.registrationData?.bookingContact) {
        const contact = lodgeReg.registrationData.bookingContact;
        console.log(`\n  Booking Contact:`);
        console.log(`    Name: ${[contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'N/A'}`);
        console.log(`    Email: ${contact.email || contact.emailAddress || 'N/A'}`);
        console.log(`    Business: ${contact.businessName || 'N/A'}`);
      }
      
      // Find the related payment
      const payment = await db.collection('payments').findOne({
        $or: [
          { matchedRegistrationId: lodgeReg._id },
          { registrationId: lodgeReg._id }
        ]
      });
      
      if (payment) {
        console.log(`\n  Related Payment:`);
        console.log(`    Payment ID: ${payment._id}`);
        console.log(`    Amount: $${payment.grossAmount || payment.amount}`);
        console.log(`    Status: ${payment.status || payment.paymentStatus}`);
        console.log(`    Invoice Created: ${payment.invoiceCreated || false}`);
      }
      
    } else {
      console.log('Lodge registration not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

inspectLodgeRegistration().catch(console.error);