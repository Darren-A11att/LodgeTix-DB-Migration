const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function verifyFranciscussRegistration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== VERIFYING FRANCISCUSS SUNGA REGISTRATION ===\n');
    
    const registrationsCollection = db.collection('registrations');
    
    // Find the registration we just created
    const registration = await registrationsCollection.findOne({
      _id: new ObjectId('6886b9c2cb0d89a1a6a1dab8')
    });
    
    if (!registration) {
      console.log('❌ Registration not found!');
      return;
    }
    
    console.log('✅ Registration Found:');
    console.log(`   ID: ${registration._id}`);
    console.log(`   Confirmation: ${registration.confirmationNumber}`);
    console.log(`   Type: ${registration.registrationType}`);
    console.log(`   Status: ${registration.status}`);
    console.log(`   Amount Paid: $${registration.totalAmountPaid}`);
    
    console.log('\n📋 Booking Contact:');
    console.log(`   Name: ${registration.registrationData.bookingContact.firstName} ${registration.registrationData.bookingContact.lastName}`);
    console.log(`   Email: ${registration.registrationData.bookingContact.emailAddress}`);
    
    console.log('\n🏛️ Lodge Details:');
    console.log(`   Lodge: ${registration.registrationData.lodgeDetails.lodgeName}`);
    console.log(`   Lodge Number: ${registration.registrationData.lodgeDetails.lodgeNumber}`);
    console.log(`   Lodge ID: ${registration.registrationData.lodgeDetails.lodgeId}`);
    
    console.log('\n🎫 Tickets:');
    if (registration.registrationData.tickets && registration.registrationData.tickets.length > 0) {
      console.log(`   Total Tickets: ${registration.registrationData.tickets.length}`);
      
      // Show first few tickets as examples
      console.log('\n   Sample Tickets:');
      registration.registrationData.tickets.slice(0, 3).forEach((ticket, index) => {
        console.log(`\n   Ticket ${index + 1}:`);
        console.log(`     ID: ${ticket.eventTicketId}`);
        console.log(`     Name: ${ticket.name}`);
        console.log(`     Price: $${ticket.price}`);
        console.log(`     Quantity: ${ticket.quantity}`);
        console.log(`     Owner Type: ${ticket.ownerType}`);
        console.log(`     Owner ID: ${ticket.ownerId}`);
        if (ticket.tableNumber) console.log(`     Table: ${ticket.tableNumber}`);
        if (ticket.seatNumber) console.log(`     Seat: ${ticket.seatNumber}`);
      });
      
      if (registration.registrationData.tickets.length > 3) {
        console.log(`\n   ... and ${registration.registrationData.tickets.length - 3} more tickets`);
      }
      
      // Calculate total from tickets
      const ticketTotal = registration.registrationData.tickets.reduce((sum, ticket) => {
        return sum + (ticket.price * (ticket.quantity || 1));
      }, 0);
      
      console.log(`\n   Total from tickets: $${ticketTotal.toFixed(2)}`);
      console.log(`   Subtotal recorded: $${registration.subtotal}`);
      
    } else {
      console.log('   ❌ No tickets found!');
    }
    
    console.log('\n📦 Package Details:');
    if (registration.registrationData.packageDetails) {
      console.log(`   Package ID: ${registration.registrationData.packageDetails.packageId}`);
      console.log(`   Table Count: ${registration.registrationData.packageDetails.tableCount}`);
      console.log(`   Package Count: ${registration.registrationData.packageDetails.packageCount}`);
      console.log(`   Items per Package: ${registration.registrationData.packageDetails.itemsPerPackage}`);
    }
    
    console.log('\n💳 Payment Info:');
    console.log(`   Stripe Payment ID: ${registration.stripePaymentId}`);
    console.log(`   Payment Status: ${registration.paymentStatus}`);
    console.log(`   Created At: ${registration.createdAt}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the verification
verifyFranciscussRegistration();