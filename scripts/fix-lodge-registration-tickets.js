const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixLodgeRegistrationTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FIXING LODGE REGISTRATION TICKETS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    
    // Find all lodge registrations
    const lodgeRegistrations = await registrationsCollection.find({
      registrationType: 'lodge'
    }).toArray();
    
    console.log(`Found ${lodgeRegistrations.length} lodge registrations\n`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const registration of lodgeRegistrations) {
      console.log(`Processing: ${registration.confirmationNumber}`);
      console.log(`  Lodge: ${registration.registrationData?.lodgeDetails?.lodgeName || 'Unknown'}`);
      console.log(`  Amount paid: $${registration.totalAmountPaid}`);
      
      // Calculate quantity based on amount paid
      // $115 per package of 10
      const pricePerPackage = 1150; // $1150 for 10 tickets
      const amountPaid = registration.totalAmountPaid || 0;
      
      // Round to nearest package of 10
      let quantity = Math.round((amountPaid / pricePerPackage) * 10);
      
      // Ensure minimum of 10 for lodge registrations
      if (quantity < 10) {
        quantity = 10;
      }
      
      // Ensure it's a multiple of 10
      quantity = Math.round(quantity / 10) * 10;
      
      console.log(`  Calculated quantity: ${quantity} tickets`);
      
      // Get the lodge's own ID
      const lodgeId = registration.registrationData?.lodgeDetails?.lodgeId || 
                     registration.organisationId || 
                     '9f314f40-81ca-4add-af47-fa79c05091d5'; // default if not found
      
      // Create the new ticket structure
      const newTicket = {
        eventTicketId: "fd12d7f0-f346-49bf-b1eb-0682ad226216",
        name: "Proclamation Banquet - Best Available",
        price: 115,
        quantity: quantity,
        ownerType: "lodge",
        ownerId: lodgeId
      };
      
      // Update the registration
      const result = await registrationsCollection.updateOne(
        { _id: registration._id },
        { 
          $set: { 
            'registrationData.tickets': [newTicket], // Single ticket object with quantity
            'metadata.ticketsFixedAt': new Date(),
            'metadata.ticketsFixedBy': 'fix-lodge-registration-tickets'
          }
        }
      );
      
      if (result.modifiedCount > 0) {
        updated++;
        console.log(`  ✅ Updated with ${quantity} tickets (lodge ID: ${lodgeId})\n`);
      } else {
        skipped++;
        console.log(`  ⏭️  Skipped (no changes made)\n`);
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total lodge registrations: ${lodgeRegistrations.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    
    // Verify specific registrations
    console.log('\n=== VERIFICATION ===');
    const verifyRegs = [
      'LDG-102908JR', // Troy Quimpo
      'LDG-862926IO'  // Lodge Ionic
    ];
    
    for (const confNum of verifyRegs) {
      const reg = await registrationsCollection.findOne({ confirmationNumber: confNum });
      if (reg && reg.registrationData?.tickets?.[0]) {
        const ticket = reg.registrationData.tickets[0];
        console.log(`\n${confNum}:`);
        console.log(`  Lodge: ${reg.registrationData.lodgeDetails?.lodgeName}`);
        console.log(`  Ticket: ${ticket.name}`);
        console.log(`  Quantity: ${ticket.quantity}`);
        console.log(`  Owner ID: ${ticket.ownerId}`);
        console.log(`  Total value: $${ticket.price * ticket.quantity}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the script
fixLodgeRegistrationTickets();