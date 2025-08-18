import { EnhancedPaymentSyncService } from '../src/services/sync/enhanced-payment-sync';
import { MongoClient, Db } from 'mongodb';

async function testAttendeesSync() {
  console.log('Testing attendees sync...');
  
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lodgetix';
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Test the specific sync for attendees
    const mapping = { import: 'import_attendees', production: 'attendees', idField: 'attendeeId' };
    
    console.log(`\n--- Syncing ${mapping.import} -> ${mapping.production} ---`);
    
    // Count documents in import collection
    const importCount = await db.collection(mapping.import).countDocuments();
    console.log(`Found ${importCount} documents in ${mapping.import}`);
    
    // Try to find one with the problematic query first (to reproduce the error)
    console.log('\nTesting problematic query...');
    try {
      const problematicDoc = await db.collection('tickets').findOne({
        '_productionMeta': { $exists: true },
        '_productionMeta.productionObjectId': { $exists: true }
      });
      console.log('✅ Query executed successfully');
      if (problematicDoc) {
        console.log('Found document with productionObjectId:', problematicDoc._id);
      } else {
        console.log('No documents found with productionObjectId');
      }
    } catch (error: any) {
      console.log('❌ Query failed with error:', error.message);
    }
    
    // Now run the actual sync
    const syncService = new EnhancedPaymentSyncService();
    // connectToMongoDB is private and called internally
    
    console.log('\nRunning selective sync for attendees...');
    await (syncService as any)['syncCollectionSelectively'](db, mapping);
    
    console.log('✅ Test completed successfully');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
  }
}

testAttendeesSync().catch(console.error);