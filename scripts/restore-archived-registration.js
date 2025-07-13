const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function restoreArchivedRegistration() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== RESTORING INCORRECTLY DELETED REGISTRATION ===\n');
    
    // Get the archived record
    const archived = await db.collection('archived_duplicates').findOne({
      _original_id: new ObjectId('686fb56589bace4d716bde62')
    });
    
    if (!archived) {
      console.log('Could not find archived record to restore');
      return;
    }
    
    console.log('Found archived record:');
    console.log(`  Original ID: ${archived._original_id}`);
    console.log(`  Confirmation: ${archived.confirmationNumber}`);
    console.log(`  Total Paid: $${archived.totalPricePaid}`);
    console.log(`  Attendees: ${archived.registrationData?.attendees?.length || 0}`);
    console.log(`  Tickets: ${archived.registrationData?.tickets?.length || 0}`);
    
    // Remove archive metadata fields
    delete archived._archived_at;
    delete archived._archive_reason;
    
    // Restore the original _id
    archived._id = archived._original_id;
    delete archived._original_id;
    
    // Insert back into registrations collection
    console.log('\nRestoring to registrations collection...');
    
    try {
      const restoreResult = await db.collection('registrations').insertOne(archived);
      console.log(`✅ Successfully restored with ID: ${restoreResult.insertedId}`);
    } catch (insertError) {
      if (insertError.code === 11000) {
        console.log('❌ Record already exists in registrations collection');
      } else {
        throw insertError;
      }
    }
    
    // Update confirmation number to make it unique
    console.log('\nFixing duplicate confirmation number issue...');
    const updateResult = await db.collection('registrations').updateOne(
      { _id: archived._id },
      { 
        $set: { 
          confirmationNumber: `${archived.confirmationNumber}-RESTORED`,
          notes: 'This registration was incorrectly deleted due to duplicate confirmation number. Original confirmation: ' + archived.confirmationNumber
        } 
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log(`✅ Updated confirmation number to: ${archived.confirmationNumber}-RESTORED`);
    }
    
    // Remove from archived collection
    await db.collection('archived_duplicates').deleteOne({
      _original_id: new ObjectId('686fb56589bace4d716bde62')
    });
    
    // Final verification
    const totalRegistrations = await db.collection('registrations').countDocuments();
    const duplicateCount = await db.collection('registrations').countDocuments({
      confirmationNumber: 'IND-705286AR'
    });
    
    console.log('\n=== RESTORATION COMPLETE ===');
    console.log(`Total registrations: ${totalRegistrations}`);
    console.log(`Records with IND-705286AR: ${duplicateCount}`);
    console.log('\nNote: The restored record now has confirmation number IND-705286AR-RESTORED');
    console.log('This preserves both registrations while avoiding the duplicate confirmation number.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

restoreArchivedRegistration().catch(console.error);