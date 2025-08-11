import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'LodgeTix';

async function getDatabaseSummary() {
  const client = new MongoClient(MONGODB_URI!);
  
  try {
    await client.connect();
    const db = client.db(MONGODB_DB);
    
    console.log('📊 LodgeTix Database Summary');
    console.log('=' .repeat(50));
    console.log(`📍 Database: ${MONGODB_DB}`);
    console.log(`📍 URI: ${MONGODB_URI?.substring(0, 50)}...`);
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`\n📋 Collections: ${collections.length}`);
    
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      
      console.log(`\n📦 ${collectionName.toUpperCase()}`);
      console.log(`   📊 Total Documents: ${count}`);
      
      // Get some sample data for each collection
      if (count > 0) {
        if (collectionName === 'payments') {
          const sample = await collection.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$grossAmount' } } },
            { $sort: { count: -1 } }
          ]).toArray();
          
          console.log('   💰 Payment Status Breakdown:');
          sample.forEach((status: any) => {
            console.log(`      ${status._id}: ${status.count} payments ($${status.totalAmount?.toFixed(2) || '0.00'})`);
          });
        }
        
        if (collectionName === 'registrations') {
          const sample = await collection.aggregate([
            { $group: { _id: '$registrationType', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmountPaid' } } },
            { $sort: { count: -1 } }
          ]).toArray();
          
          console.log('   🎫 Registration Type Breakdown:');
          sample.forEach((type: any) => {
            console.log(`      ${type._id}: ${type.count} registrations ($${type.totalAmount?.toFixed(2) || '0.00'})`);
          });
        }
        
        if (collectionName === 'attendees') {
          const sample = await collection.aggregate([
            { $group: { _id: { type: '$attendeeType', primary: '$isPrimary' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]).toArray();
          
          console.log('   👥 Attendee Breakdown:');
          sample.forEach((breakdown: any) => {
            const role = breakdown._id.primary ? 'Primary' : 'Secondary';
            console.log(`      ${breakdown._id.type} (${role}): ${breakdown.count} attendees`);
          });
        }
      }
    }
    
    // Summary stats
    const paymentsCount = await db.collection('payments').countDocuments();
    const registrationsCount = await db.collection('registrations').countDocuments();
    const attendeesCount = await db.collection('attendees').countDocuments();
    
    console.log('\n✅ IMPORT SUMMARY');
    console.log('=' .repeat(30));
    console.log(`💰 Payments imported: ${paymentsCount}`);
    console.log(`🎫 Registrations imported: ${registrationsCount} (completed payments only)`);
    console.log(`👥 Attendees imported: ${attendeesCount} (from completed registrations only)`);
    
    // Data integrity check
    console.log('\n🔍 DATA INTEGRITY CHECK');
    console.log('=' .repeat(30));
    
    const completedPayments = await db.collection('payments').countDocuments({ status: 'paid' });
    const paidRegistrations = await db.collection('registrations').countDocuments({ paymentStatus: 'completed' });
    
    console.log(`✅ Completed Payments: ${completedPayments}`);
    console.log(`✅ Completed Registrations: ${paidRegistrations}`);
    console.log(`✅ Attendees from Completed Registrations: ${attendeesCount}`);
    
    if (paidRegistrations > 0) {
      console.log(`📈 Average attendees per registration: ${(attendeesCount / paidRegistrations).toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('❌ Error getting database summary:', error);
  } finally {
    await client.close();
  }
}

async function main() {
  try {
    await getDatabaseSummary();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}