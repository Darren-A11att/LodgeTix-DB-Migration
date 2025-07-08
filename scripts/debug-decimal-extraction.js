const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function debugExtraction() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    // Test with a specific registration
    const reg = await db.collection('registrations').findOne({
      $or: [
        { confirmation_number: 'LDG-689815EJ' },
        { confirmationNumber: 'LDG-689815EJ' }
      ]
    });
    
    if (reg) {
      console.log('Testing extraction for LDG-689815EJ:');
      
      console.log('\nAll fields:');
      console.log('subtotal:', reg.subtotal);
      console.log('total:', reg.total);
      console.log('total_price_paid:', reg.total_price_paid);
      console.log('totalPricePaid:', reg.totalPricePaid);
      
      const totalPricePaid = reg.total_price_paid || reg.totalPricePaid;
      console.log('\nSelected totalPricePaid:', totalPricePaid);
      console.log('Type:', typeof totalPricePaid);
      
      if (totalPricePaid && typeof totalPricePaid === 'object') {
        console.log('Has $numberDecimal?', totalPricePaid.$numberDecimal !== undefined);
        console.log('Constructor name:', totalPricePaid.constructor?.name);
        console.log('toString() value:', totalPricePaid.toString());
        console.log('Parsed value from toString():', parseFloat(totalPricePaid.toString()));
      }
    }
  } finally {
    await client.close();
  }
}

debugExtraction().catch(console.error);