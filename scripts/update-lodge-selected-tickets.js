const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function updateLodgeSelectedTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  
  console.log('Connecting to database to update lodge registrations...');
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    // Find all lodge registrations
    console.log('\n=== Finding lodge registrations ===');
    const lodgeRegistrations = await db.collection('registrations').find({
      $or: [
        { registration_type: 'lodge' },
        { registration_type: 'lodges' },
        { registrationType: 'lodge' },
        { registrationType: 'lodges' }
      ]
    }).toArray();
    
    console.log(`Found ${lodgeRegistrations.length} lodge registrations`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const registration of lodgeRegistrations) {
      // Get the subtotal amount - handle objects and strings
      let subtotal = registration.subtotal || registration.total || registration.total_price_paid || registration.totalPricePaid || 0;
      
      // Handle case where subtotal might be an object or string
      if (typeof subtotal === 'object' && subtotal !== null) {
        // Handle MongoDB Decimal128 type
        if (subtotal.$numberDecimal !== undefined) {
          subtotal = parseFloat(subtotal.$numberDecimal);
        } else if (subtotal.constructor && subtotal.constructor.name === 'Decimal128') {
          // Handle Decimal128 object instances
          subtotal = parseFloat(subtotal.toString());
        } else {
          // Try to extract a numeric value from other object types
          subtotal = subtotal.value || subtotal.amount || 0;
        }
      }
      
      // Convert string to number if needed
      if (typeof subtotal === 'string') {
        subtotal = parseFloat(subtotal.replace(/[^0-9.-]/g, ''));
      }
      
      // Ensure subtotal is a valid number
      if (isNaN(subtotal) || subtotal === 0) {
        console.log(`Skipping registration ${registration.confirmation_number || registration.confirmationNumber}: invalid or zero subtotal`);
        skippedCount++;
        continue;
      }
      
      // Calculate quantity based on subtotal / 115
      const quantity = Math.round(subtotal / 115);
      
      if (quantity === 0) {
        console.log(`Skipping registration ${registration.confirmation_number || registration.confirmationNumber}: calculated quantity is 0`);
        skippedCount++;
        continue;
      }
      
      // Create the selectedTickets array
      const selectedTickets = [{
        eventTicketsId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216',
        quantity: quantity,
        name: 'Proclamation Banquet - Best Available'
      }];
      
      // Prepare the update based on the structure
      let updateOperation;
      
      // Check if registrationData exists
      if (registration.registrationData || registration.registration_data) {
        // Update within registrationData
        updateOperation = {
          $set: {
            'registrationData.selectedTickets': selectedTickets,
            'registration_data.selectedTickets': selectedTickets
          }
        };
      } else {
        // Create registrationData with selectedTickets
        updateOperation = {
          $set: {
            'registrationData': {
              selectedTickets: selectedTickets
            },
            'registration_data': {
              selectedTickets: selectedTickets
            }
          }
        };
      }
      
      // Update the registration
      const result = await db.collection('registrations').updateOne(
        { _id: registration._id },
        updateOperation
      );
      
      if (result.modifiedCount > 0) {
        updatedCount++;
        console.log(`Updated registration ${registration.confirmation_number || registration.confirmationNumber}: subtotal=${subtotal}, quantity=${quantity}`);
      }
    }
    
    console.log('\n=== Update Summary ===');
    console.log(`Total lodge registrations found: ${lodgeRegistrations.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Skipped (no subtotal): ${skippedCount}`);
    
    // Verify a sample of updated registrations
    console.log('\n=== Verification (Sample of 5) ===');
    const updatedSample = await db.collection('registrations').find({
      $and: [
        {
          $or: [
            { registration_type: 'lodge' },
            { registration_type: 'lodges' },
            { registrationType: 'lodge' },
            { registrationType: 'lodges' }
          ]
        },
        {
          $or: [
            { 'registrationData.selectedTickets': { $exists: true } },
            { 'registration_data.selectedTickets': { $exists: true } }
          ]
        }
      ]
    }).limit(5).toArray();
    
    for (const reg of updatedSample) {
      const selectedTickets = reg.registrationData?.selectedTickets || reg.registration_data?.selectedTickets;
      console.log(`- ${reg.confirmation_number || reg.confirmationNumber}: ${selectedTickets?.[0]?.quantity} tickets`);
    }
    
  } finally {
    await client.close();
  }
}

// Run the update
updateLodgeSelectedTickets().catch(console.error);