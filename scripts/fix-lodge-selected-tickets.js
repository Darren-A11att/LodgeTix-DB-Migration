const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixLodgeSelectedTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  
  console.log('Connecting to database to fix lodge registrations...');
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
    let fixedCount = 0;
    
    for (const registration of lodgeRegistrations) {
      // Get the subtotal amount - handle all cases
      let subtotal = extractNumericValue(registration.subtotal) || 
                     extractNumericValue(registration.total) || 
                     extractNumericValue(registration.total_price_paid) || 
                     extractNumericValue(registration.totalPricePaid) || 0;
      
      if (subtotal === 0) {
        console.log(`Skipping registration ${registration.confirmation_number || registration.confirmationNumber}: subtotal is 0`);
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
      
      // Check if selectedTickets already exists and needs fixing
      const existingTickets = registration.registrationData?.selectedTickets || registration.registration_data?.selectedTickets;
      let needsUpdate = false;
      
      if (!existingTickets || existingTickets.length === 0) {
        needsUpdate = true;
      } else if (existingTickets[0]?.quantity !== quantity || isNaN(existingTickets[0]?.quantity)) {
        needsUpdate = true;
        fixedCount++;
      }
      
      if (needsUpdate) {
        // Create the selectedTickets array
        const selectedTickets = [{
          eventTicketsId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216',
          quantity: quantity,
          name: 'Proclamation Banquet - Best Available'
        }];
        
        // Update the registration
        const result = await db.collection('registrations').updateOne(
          { _id: registration._id },
          {
            $set: {
              'registrationData.selectedTickets': selectedTickets
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          updatedCount++;
          console.log(`Updated registration ${registration.confirmation_number || registration.confirmationNumber}: subtotal=${subtotal}, quantity=${quantity}`);
        }
      }
    }
    
    console.log('\n=== Update Summary ===');
    console.log(`Total lodge registrations found: ${lodgeRegistrations.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Fixed incorrect quantities: ${fixedCount}`);
    console.log(`Skipped (no subtotal): ${skippedCount}`);
    
    // Verify all registrations
    console.log('\n=== Final Verification ===');
    const finalRegistrations = await db.collection('registrations').find({
      $or: [
        { registration_type: 'lodge' },
        { registration_type: 'lodges' },
        { registrationType: 'lodge' },
        { registrationType: 'lodges' }
      ]
    }).toArray();
    
    let correctCount = 0;
    let incorrectCount = 0;
    
    for (const reg of finalRegistrations) {
      const selectedTickets = reg.registrationData?.selectedTickets || reg.registration_data?.selectedTickets;
      const subtotal = extractNumericValue(reg.subtotal) || 
                       extractNumericValue(reg.total) || 
                       extractNumericValue(reg.total_price_paid) || 
                       extractNumericValue(reg.totalPricePaid) || 0;
      const expectedQuantity = subtotal > 0 ? Math.round(subtotal / 115) : 0;
      
      if (selectedTickets && selectedTickets[0]?.quantity === expectedQuantity && expectedQuantity > 0) {
        correctCount++;
      } else if (subtotal === 0) {
        // Skip count for zero subtotal
      } else {
        incorrectCount++;
        console.log(`Issue with ${reg.confirmation_number || reg.confirmationNumber}: expected ${expectedQuantity}, got ${selectedTickets?.[0]?.quantity}`);
      }
    }
    
    console.log(`\nCorrectly set: ${correctCount}`);
    console.log(`Issues remaining: ${incorrectCount}`);
    
  } finally {
    await client.close();
  }
}

function extractNumericValue(value) {
  if (value === null || value === undefined) return 0;
  
  // Handle MongoDB Decimal128 instances
  if (typeof value === 'object' && value.constructor && value.constructor.name === 'Decimal128') {
    return parseFloat(value.toString());
  }
  
  // Handle MongoDB Decimal128 as plain object
  if (typeof value === 'object' && value.$numberDecimal !== undefined) {
    return parseFloat(value.$numberDecimal);
  }
  
  // Handle plain numbers
  if (typeof value === 'number') {
    return value;
  }
  
  // Handle strings
  if (typeof value === 'string') {
    return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
  }
  
  // Handle other objects
  if (typeof value === 'object') {
    return value.value || value.amount || 0;
  }
  
  return 0;
}

// Run the fix
fixLodgeSelectedTickets().catch(console.error);