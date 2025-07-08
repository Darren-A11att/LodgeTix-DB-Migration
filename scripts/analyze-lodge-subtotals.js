const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function analyzeLodgeSubtotals() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    // Find all lodge registrations
    const lodgeRegistrations = await db.collection('registrations').find({
      $or: [
        { registration_type: 'lodge' },
        { registration_type: 'lodges' },
        { registrationType: 'lodge' },
        { registrationType: 'lodges' }
      ]
    }).toArray();
    
    console.log(`\nAnalyzing ${lodgeRegistrations.length} lodge registrations:\n`);
    
    for (const reg of lodgeRegistrations) {
      const confirmationNumber = reg.confirmation_number || reg.confirmationNumber;
      
      // Get all possible price fields
      const subtotal = reg.subtotal;
      const total = reg.total;
      const totalPricePaid = reg.total_price_paid || reg.totalPricePaid;
      
      // Extract numeric values
      let subtotalValue = extractNumericValue(subtotal);
      let totalValue = extractNumericValue(total);
      let totalPricePaidValue = extractNumericValue(totalPricePaid);
      
      // Use the first non-zero value
      let finalAmount = subtotalValue || totalValue || totalPricePaidValue || 0;
      let banquetQuantity = finalAmount > 0 ? Math.round(finalAmount / 115) : 0;
      
      console.log(`${confirmationNumber}:`);
      console.log(`  Subtotal: ${subtotalValue} (raw: ${JSON.stringify(subtotal)})`);
      console.log(`  Total: ${totalValue} (raw: ${JSON.stringify(total)})`);
      console.log(`  Total Price Paid: ${totalPricePaidValue} (raw: ${JSON.stringify(totalPricePaid)})`);
      console.log(`  Final Amount Used: ${finalAmount}`);
      console.log(`  Calculated Banquet Tickets: ${banquetQuantity}`);
      console.log('');
    }
  } finally {
    await client.close();
  }
}

function extractNumericValue(value) {
  if (value === null || value === undefined) return 0;
  
  // Handle MongoDB Decimal128
  if (typeof value === 'object' && value !== null && value.$numberDecimal !== undefined) {
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

analyzeLodgeSubtotals().catch(console.error);