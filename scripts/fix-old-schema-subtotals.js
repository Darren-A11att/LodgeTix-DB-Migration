const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixOldSchemaSubtotals() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  
  console.log('Connecting to database to fix old schema subtotals...');
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    // Find lodge registrations with zero subtotal but valid attendee count
    console.log('\n=== Finding old schema lodge registrations ===');
    // First get all lodge registrations
    const allLodgeRegistrations = await db.collection('registrations').find({
      $or: [
        { registration_type: 'lodge' },
        { registration_type: 'lodges' },
        { registrationType: 'lodge' },
        { registrationType: 'lodges' }
      ]
    }).toArray();
    
    // Filter for old schema registrations in JavaScript
    const oldSchemaRegistrations = allLodgeRegistrations.filter(reg => {
      const subtotal = extractNumericValue(reg.subtotal);
      const attendeeCount = reg.attendee_count || reg.attendeeCount || 0;
      return subtotal === 0 && attendeeCount > 0;
    });
    
    console.log(`Found ${oldSchemaRegistrations.length} old schema registrations to fix`);
    
    let updatedCount = 0;
    
    for (const registration of oldSchemaRegistrations) {
      const confirmationNumber = registration.confirmation_number || registration.confirmationNumber;
      const attendeeCount = registration.attendee_count || registration.attendeeCount || 0;
      
      // Calculate subtotal based on attendee count
      const calculatedSubtotal = attendeeCount * 115;
      
      console.log(`\nProcessing ${confirmationNumber}:`);
      console.log(`  Attendee Count: ${attendeeCount}`);
      console.log(`  Current Subtotal: ${registration.subtotal}`);
      console.log(`  Calculated Subtotal: ${calculatedSubtotal}`);
      
      // Update the registration with the correct subtotal
      const updateFields = {
        subtotal: calculatedSubtotal
      };
      
      // Also update total_price_paid if it's zero or missing
      const currentTotal = extractNumericValue(registration.total_price_paid || registration.totalPricePaid);
      if (currentTotal === 0) {
        updateFields.totalPricePaid = calculatedSubtotal;
      }
      
      const result = await db.collection('registrations').updateOne(
        { _id: registration._id },
        { $set: updateFields }
      );
      
      if (result.modifiedCount > 0) {
        updatedCount++;
        console.log(`  ✓ Updated successfully`);
      } else {
        console.log(`  ! No changes made`);
      }
    }
    
    console.log('\n=== Update Summary ===');
    console.log(`Total old schema registrations found: ${oldSchemaRegistrations.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    
    // Verify the updates
    console.log('\n=== Verification ===');
    const updatedRegs = await db.collection('registrations').find({
      $or: [
        { confirmation_number: { $in: ['LDG-499228VV', 'LDG-047204NQ', 'LDG-144723KI', 'LDG-490194LF'] } },
        { confirmationNumber: { $in: ['LDG-499228VV', 'LDG-047204NQ', 'LDG-144723KI', 'LDG-490194LF'] } }
      ]
    }).toArray();
    
    for (const reg of updatedRegs) {
      const confirmationNumber = reg.confirmation_number || reg.confirmationNumber;
      const subtotal = extractNumericValue(reg.subtotal);
      const totalPricePaid = extractNumericValue(reg.total_price_paid || reg.totalPricePaid);
      const attendeeCount = reg.attendee_count || reg.attendeeCount;
      const selectedTickets = reg.registrationData?.selectedTickets || reg.registration_data?.selectedTickets;
      
      console.log(`\n${confirmationNumber}:`);
      console.log(`  Attendee Count: ${attendeeCount}`);
      console.log(`  Subtotal: $${subtotal}`);
      console.log(`  Total Price Paid: $${totalPricePaid}`);
      console.log(`  Selected Tickets Quantity: ${selectedTickets?.[0]?.quantity || 'Not set'}`);
      console.log(`  Calculation Check: ${attendeeCount} × $115 = $${attendeeCount * 115} ${subtotal === attendeeCount * 115 ? '✓' : '✗'}`);
    }
    
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
fixOldSchemaSubtotals().catch(console.error);