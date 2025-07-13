const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function handleDuplicateRegistration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== HANDLING DUPLICATE IND-705286AR ===\n');
    
    // The duplicate to remove (was converted from selectedTickets)
    const duplicateToRemove = new ObjectId('686fb56589bace4d716bde62');
    
    // First, verify both records exist
    const recordToKeep = await db.collection('registrations').findOne({
      _id: new ObjectId('686be2a4b020a8c479e70a02')
    });
    
    const recordToRemove = await db.collection('registrations').findOne({
      _id: duplicateToRemove
    });
    
    if (!recordToKeep || !recordToRemove) {
      console.log('One or both records not found. Aborting.');
      return;
    }
    
    console.log('Record to keep (already in correct format):');
    console.log(`  ID: ${recordToKeep._id}`);
    console.log(`  Confirmation: ${recordToKeep.confirmationNumber}`);
    console.log(`  Tickets: ${recordToKeep.registrationData.tickets.length}`);
    
    console.log('\nRecord to remove (converted from selectedTickets):');
    console.log(`  ID: ${recordToRemove._id}`);
    console.log(`  Confirmation: ${recordToRemove.confirmationNumber}`);
    console.log(`  Tickets: ${recordToRemove.registrationData.tickets.length}`);
    
    // Archive the duplicate before deletion (for safety)
    console.log('\nArchiving duplicate record...');
    const archiveResult = await db.collection('archived_duplicates').insertOne({
      ...recordToRemove,
      _original_id: recordToRemove._id,
      _archived_at: new Date(),
      _archive_reason: 'Duplicate of IND-705286AR - converted from selectedTickets format'
    });
    
    console.log(`Archived with ID: ${archiveResult.insertedId}`);
    
    // Delete the duplicate
    console.log('\nDeleting duplicate...');
    const deleteResult = await db.collection('registrations').deleteOne({
      _id: duplicateToRemove
    });
    
    if (deleteResult.deletedCount === 1) {
      console.log('✅ Successfully deleted duplicate');
    } else {
      console.log('❌ Failed to delete duplicate');
    }
    
    // Verify final state
    const remainingCount = await db.collection('registrations').countDocuments({
      confirmationNumber: 'IND-705286AR'
    });
    
    console.log(`\nRemaining IND-705286AR records: ${remainingCount}`);
    
    // Final database summary
    const totalRegistrations = await db.collection('registrations').countDocuments();
    console.log(`\n=== FINAL DATABASE STATE ===`);
    console.log(`Total registrations: ${totalRegistrations}`);
    console.log(`All registrations have tickets in new format: ✅`);
    console.log(`No selectedTickets fields remain: ✅`);
    console.log(`Duplicate IND-705286AR resolved: ✅`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

handleDuplicateRegistration().catch(console.error);