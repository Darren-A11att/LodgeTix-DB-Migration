const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findMissingRegistrationId() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FINDING REGISTRATIONS WITHOUT REGISTRATION ID ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    
    // Find registrations without registrationId
    const missingRegistrations = await registrationsCollection.find({
      $or: [
        { registrationId: { $exists: false } },
        { registrationId: null },
        { registrationId: '' }
      ]
    }).toArray();
    
    console.log(`Found ${missingRegistrations.length} registration(s) without registrationId:\n`);
    
    for (const reg of missingRegistrations) {
      console.log('Registration Details:');
      console.log('===================');
      console.log(`_id: ${reg._id}`);
      console.log(`Confirmation Number: ${reg.confirmationNumber || 'N/A'}`);
      console.log(`Payment ID: ${reg.paymentId || 'N/A'}`);
      console.log(`Stripe Payment ID: ${reg.stripePaymentId || 'N/A'}`);
      console.log(`Created At: ${reg.createdAt || 'N/A'}`);
      console.log(`Updated At: ${reg.updatedAt || 'N/A'}`);
      console.log(`Imported At: ${reg.importedAt || 'N/A'}`);
      
      // Registration Data
      if (reg.registrationData) {
        console.log('\nRegistration Data:');
        
        // Booking Contact
        if (reg.registrationData.bookingContact) {
          console.log('  Booking Contact:');
          console.log(`    Name: ${reg.registrationData.bookingContact.firstName} ${reg.registrationData.bookingContact.lastName}`);
          console.log(`    Email: ${reg.registrationData.bookingContact.emailAddress}`);
          console.log(`    Phone: ${reg.registrationData.bookingContact.phoneNumber || 'N/A'}`);
        }
        
        // Billing Details (if no booking contact)
        if (!reg.registrationData.bookingContact && reg.registrationData.billingDetails) {
          console.log('  Billing Details:');
          console.log(`    Name: ${reg.registrationData.billingDetails.firstName} ${reg.registrationData.billingDetails.lastName}`);
          console.log(`    Email: ${reg.registrationData.billingDetails.emailAddress}`);
        }
        
        // Lodge Details
        if (reg.registrationData.lodgeDetails) {
          console.log('  Lodge Details:');
          console.log(`    Lodge Name: ${reg.registrationData.lodgeDetails.lodgeName || 'N/A'}`);
          console.log(`    Lodge Number: ${reg.registrationData.lodgeDetails.lodgeNumber || 'N/A'}`);
        }
        
        // Tickets
        if (reg.registrationData.tickets && Array.isArray(reg.registrationData.tickets)) {
          console.log(`  Tickets: ${reg.registrationData.tickets.length} ticket(s)`);
        }
      }
      
      // Check if this has any other unique identifiers
      console.log('\nOther Identifiers:');
      console.log(`  registrationId: ${reg.registrationId || 'MISSING'}`);
      console.log(`  invoiceReference: ${reg.invoiceReference || 'N/A'}`);
      console.log(`  registrationType: ${reg.registrationType || 'N/A'}`);
      
      // Show raw object keys to see what fields exist
      console.log('\nAll top-level fields:');
      console.log(' ', Object.keys(reg).join(', '));
      
      console.log('\n---\n');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the search
findMissingRegistrationId();