import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface Decimal128 {
  $numberDecimal: string;
}

interface MonetaryValue {
  value?: number;
  amount?: number;
  $numberDecimal?: string;
}

interface Registration {
  _id: ObjectId;
  confirmation_number?: string;
  confirmationNumber?: string;
  subtotal?: number | string | Decimal128 | MonetaryValue;
  total?: number | string | Decimal128 | MonetaryValue;
  total_price_paid?: number | string | Decimal128 | MonetaryValue;
  totalPricePaid?: number | string | Decimal128 | MonetaryValue;
  registration_type?: string;
  registrationType?: string;
}

async function analyzeLodgeSubtotals(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db: Db = client.db(dbName);
  
  try {
    // Find all lodge registrations
    const lodgeRegistrations = await db.collection<Registration>('registrations').find({
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

function extractNumericValue(value: any): number {
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
    const obj = value as MonetaryValue;
    return obj.value || obj.amount || 0;
  }
  
  return 0;
}

analyzeLodgeSubtotals().catch(console.error);