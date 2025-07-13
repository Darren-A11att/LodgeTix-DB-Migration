import { MongoClient, Db, Collection } from 'mongodb';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface Registration {
  subtotal?: any;
  total?: any;
  total_price_paid?: any;
  totalPricePaid?: any;
  confirmation_number?: string;
  confirmationNumber?: string;
}

async function debugExtraction(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }
  
  const client = await MongoClient.connect(uri);
  const db: Db = client.db(dbName);
  
  try {
    // Test with a specific registration
    const reg: Registration | null = await db.collection('registrations').findOne({
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
        console.log('Has $numberDecimal?', (totalPricePaid as any).$numberDecimal !== undefined);
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