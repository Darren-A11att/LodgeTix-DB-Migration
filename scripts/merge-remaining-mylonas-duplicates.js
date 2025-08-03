require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function mergeRemainingMylonasDuplicates() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LodgeTix-migration-test-1');
  
  try {
    console.log('=== MERGING REMAINING MYLONAS DUPLICATE RECORDS ===\n');
    
    const attendeesCollection = db.collection('attendees');
    
    // Define the duplicates to merge based on the investigation
    const duplicatesToMerge = [
      {
        name: 'Ross Mylonas',
        primaryAttendeeId: '0197575b-6904-70fb-998d-01aadc74c8cb',
        keepRecordId: '688af613aa226597b8dbbbb4', // Has complete data
        removeRecordId: '688af613aa226597b8dbbbce' // Missing data
      },
      {
        name: 'Ross Mylonas',
        primaryAttendeeId: '01975769-6f90-7708-82f8-74bab685100c',
        keepRecordId: '688af614aa226597b8dbbbd6', // Has complete data
        removeRecordId: '688af615aa226597b8dbbc08' // Missing data
      },
      {
        name: 'Sofia Mylonas',
        primaryAttendeeId: '0197575e-bcf8-7529-8422-08b177de5c6f',
        keepRecordId: '688af613aa226597b8dbbbb6', // Has complete data
        removeRecordId: '688af613aa226597b8dbbbd0' // Missing data
      },
      {
        name: 'Sofia Mylonas',
        primaryAttendeeId: '0197576a-dbc7-7593-b2f4-49ab733eecdf',
        keepRecordId: '688af614aa226597b8dbbbd8', // Has complete data
        removeRecordId: '688af615aa226597b8dbbc0a' // Missing data
      }
    ];
    
    for (const duplicate of duplicatesToMerge) {
      console.log(`\nProcessing ${duplicate.name} (${duplicate.primaryAttendeeId})...`);
      
      // Get both records
      const recordToKeep = await attendeesCollection.findOne({ 
        _id: new ObjectId(duplicate.keepRecordId) 
      });
      
      const recordToRemove = await attendeesCollection.findOne({ 
        _id: new ObjectId(duplicate.removeRecordId) 
      });
      
      if (!recordToKeep || !recordToRemove) {
        console.log('  ERROR: One or both records not found');
        continue;
      }
      
      console.log(`  Record to keep: ${recordToKeep._id}`);
      console.log(`    Type: ${recordToKeep.attendeeType}, Email: ${recordToKeep.email || 'N/A'}`);
      console.log(`    Registrations: ${recordToKeep.registrations?.map(r => r.confirmationNumber).join(', ')}`);
      
      console.log(`  Record to remove: ${recordToRemove._id}`);
      console.log(`    Type: ${recordToRemove.attendeeType || 'MISSING'}, Email: ${recordToRemove.email || 'MISSING'}`);
      console.log(`    Registrations: ${recordToRemove.registrations?.map(r => r.confirmationNumber).join(', ')}`);
      
      // Merge registrations
      const existingRegIds = new Set(recordToKeep.registrations?.map(r => r.registrationId) || []);
      const additionalRegistrations = (recordToRemove.registrations || [])
        .filter(r => !existingRegIds.has(r.registrationId));
      
      const mergedRegistrations = [
        ...(recordToKeep.registrations || []),
        ...additionalRegistrations
      ];
      
      // Merge event_tickets
      const existingTicketIds = new Set(recordToKeep.event_tickets?.map(t => t._id.toString()) || []);
      const additionalTickets = (recordToRemove.event_tickets || [])
        .filter(t => !existingTicketIds.has(t._id.toString()));
      
      const mergedTickets = [
        ...(recordToKeep.event_tickets || []),
        ...additionalTickets
      ];
      
      // Create modification history entry
      const modificationEntry = {
        id: new ObjectId().toString(),
        timestamp: new Date(),
        source: 'merge-remaining-duplicates',
        operation: 'merge',
        modifiedBy: 'system',
        details: {
          reason: 'Merged remaining duplicate attendee records',
          mergedFromId: recordToRemove._id,
          registrationsAdded: additionalRegistrations.length,
          ticketsAdded: additionalTickets.length
        }
      };
      
      // Update the record to keep
      const updateResult = await attendeesCollection.updateOne(
        { _id: recordToKeep._id },
        {
          $set: {
            registrations: mergedRegistrations,
            event_tickets: mergedTickets,
            modifiedAt: new Date(),
            lastModificationId: modificationEntry.id
          },
          $push: {
            modificationHistory: modificationEntry
          }
        }
      );
      
      console.log(`  Updated record: ${updateResult.modifiedCount === 1 ? 'SUCCESS' : 'FAILED'}`);
      console.log(`  Added ${additionalRegistrations.length} registrations`);
      
      // Delete the duplicate record
      const deleteResult = await attendeesCollection.deleteOne({ _id: recordToRemove._id });
      console.log(`  Deleted duplicate: ${deleteResult.deletedCount === 1 ? 'SUCCESS' : 'FAILED'}`);
    }
    
    console.log('\n\n=== FINAL VERIFICATION ===\n');
    
    // Check Ross Mylonas records
    const rossRecords = await attendeesCollection.find({
      firstName: 'Ross',
      lastName: 'Mylonas'
    }).toArray();
    
    console.log(`Ross Mylonas records: ${rossRecords.length}`);
    rossRecords.forEach((r, i) => {
      console.log(`  ${i+1}. Type: ${r.attendeeType}, Registrations: ${r.registrations?.length || 0}, Enriched: ${r.modificationHistory?.some(h => h.source === 'enrich-all-attendees-complete') ? 'YES' : 'NO'}`);
    });
    
    // Check Sofia records
    const sofiaRecords = await attendeesCollection.find({
      firstName: 'Sofia'
    }).toArray();
    
    console.log(`\nSofia records: ${sofiaRecords.length}`);
    sofiaRecords.forEach((s, i) => {
      console.log(`  ${i+1}. Name: ${s.firstName} ${s.lastName}, Type: ${s.attendeeType}, Registrations: ${s.registrations?.length || 0}, Enriched: ${s.modificationHistory?.some(h => h.source === 'enrich-all-attendees-complete') ? 'YES' : 'NO'}`);
    });
    
    // Final enrichment status
    console.log('\n\n=== FINAL ENRICHMENT STATUS ===\n');
    
    const totalAttendees = await attendeesCollection.countDocuments();
    const enrichedAttendees = await attendeesCollection.countDocuments({
      'modificationHistory.source': 'enrich-all-attendees-complete'
    });
    const stillUnenriched = totalAttendees - enrichedAttendees;
    
    console.log(`Total attendees: ${totalAttendees}`);
    console.log(`Enriched attendees: ${enrichedAttendees}`);
    console.log(`Still unenriched: ${stillUnenriched}`);
    console.log(`Enrichment rate: ${((enrichedAttendees / totalAttendees) * 100).toFixed(2)}%`);
    
  } finally {
    await client.close();
  }
}

mergeRemainingMylonasDuplicates()
  .then(() => console.log('\n✅ Merge complete'))
  .catch(console.error);