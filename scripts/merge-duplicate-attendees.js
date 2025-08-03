require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function mergeDuplicateAttendees() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LodgeTix-migration-test-1');
  
  try {
    console.log('=== MERGING DUPLICATE ATTENDEE RECORDS ===\n');
    
    const attendeesCollection = db.collection('attendees');
    const ticketsCollection = db.collection('tickets');
    
    // Define the duplicates to merge
    const duplicatesToMerge = [
      {
        name: 'Peter Goodridge',
        attendeeId: '01982f35-0dfe-73be-961a-02441d65840d',
        keepRegistrationId: '409c2fb7-3879-4268-9e76-6b1ae35e261c', // IND-176449HG (individual)
        removeRegistrationId: '8169f3fb-a6fb-41bc-a943-934df89268a1' // non-existent
      },
      {
        name: 'Brian Samson',
        attendeeId: '01982f25-2275-71cf-8cd2-bcb42bec5fcf',
        keepRegistrationId: '6cedcf70-4b1b-4986-9853-a1b4a82e1932', // IND-241525JY
        removeRegistrationId: '755cd600-4162-475e-8b48-4d15d37f51c0' // non-existent
      }
    ];
    
    for (const duplicate of duplicatesToMerge) {
      console.log(`\nProcessing ${duplicate.name} (${duplicate.attendeeId})...`);
      
      // Find both attendee records
      const attendeeRecords = await attendeesCollection.find({
        attendeeId: duplicate.attendeeId
      }).toArray();
      
      console.log(`  Found ${attendeeRecords.length} records`);
      
      if (attendeeRecords.length !== 2) {
        console.log(`  WARNING: Expected 2 records, found ${attendeeRecords.length}. Skipping.`);
        continue;
      }
      
      // Identify which record to keep and which to remove
      const recordToKeep = attendeeRecords.find(a => 
        a.registrations?.some(r => r.registrationId === duplicate.keepRegistrationId)
      );
      const recordToRemove = attendeeRecords.find(a => 
        a.registrations?.some(r => r.registrationId === duplicate.removeRegistrationId)
      );
      
      if (!recordToKeep || !recordToRemove) {
        console.log('  ERROR: Could not identify records to keep/remove');
        continue;
      }
      
      console.log(`  Record to keep: ${recordToKeep._id} (has email: ${recordToKeep.email})`);
      console.log(`  Record to remove: ${recordToRemove._id} (has email: ${recordToRemove.email || 'MISSING'})`);
      
      // Merge registrations arrays (combine unique registrations)
      const existingRegIds = new Set(recordToKeep.registrations?.map(r => r.registrationId) || []);
      const additionalRegistrations = (recordToRemove.registrations || [])
        .filter(r => !existingRegIds.has(r.registrationId));
      
      const mergedRegistrations = [
        ...(recordToKeep.registrations || []),
        ...additionalRegistrations
      ];
      
      // Merge event_tickets arrays
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
        source: 'merge-duplicate-attendees',
        operation: 'merge',
        modifiedBy: 'system',
        details: {
          reason: 'Merged duplicate attendee records',
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
      
      // Update any tickets that reference the old attendee record
      const ticketUpdateResult = await ticketsCollection.updateMany(
        { ownerId: recordToRemove._id.toString() },
        { $set: { ownerId: recordToKeep._id.toString() } }
      );
      
      console.log(`  Updated ${ticketUpdateResult.modifiedCount} tickets to new owner ID`);
      
      // Delete the duplicate record
      const deleteResult = await attendeesCollection.deleteOne({ _id: recordToRemove._id });
      console.log(`  Deleted duplicate record: ${deleteResult.deletedCount === 1 ? 'SUCCESS' : 'FAILED'}`);
      
      // For Peter Goodridge, also check his lodge registration
      if (duplicate.name === 'Peter Goodridge') {
        console.log('\n  Checking Peter\'s lodge registration (LDG-128834EX)...');
        const lodgeReg = await db.collection('registrations').findOne({
          registrationId: 'ac2f75bc-d628-4953-82ff-10e3491e6c6c'
        });
        
        if (lodgeReg) {
          console.log('    Lodge registration found');
          console.log('    Type:', lodgeReg.registrationType);
          console.log('    Organisation:', lodgeReg.organisationName);
          
          // Check if attendee has reference to this lodge registration
          const hasLodgeRef = mergedRegistrations.some(r => 
            r.registrationId === 'ac2f75bc-d628-4953-82ff-10e3491e6c6c'
          );
          
          if (!hasLodgeRef) {
            console.log('    Note: Attendee does not have reference to lodge registration');
            console.log('    This is correct - lodge registrations extract tickets only, not attendees');
          }
        }
      }
    }
    
    console.log('\n\n=== FINAL VERIFICATION ===\n');
    
    // Verify the merge results
    for (const duplicate of duplicatesToMerge) {
      const remainingRecords = await attendeesCollection.find({
        attendeeId: duplicate.attendeeId
      }).toArray();
      
      console.log(`${duplicate.name}:`);
      console.log(`  Remaining records: ${remainingRecords.length}`);
      
      if (remainingRecords.length === 1) {
        const record = remainingRecords[0];
        console.log(`  ✓ Successfully merged to single record`);
        console.log(`    Email: ${record.email}`);
        console.log(`    Phone: ${record.phone}`);
        console.log(`    Registrations: ${record.registrations?.length || 0}`);
        console.log(`    Tickets: ${record.event_tickets?.length || 0}`);
        
        // Show enrichment status
        const isEnriched = record.modificationHistory?.some(h => 
          h.source === 'enrich-all-attendees-complete'
        );
        console.log(`    Enrichment status: ${isEnriched ? 'ENRICHED' : 'NOT ENRICHED'}`);
      }
    }
    
    // Check overall unenriched count
    console.log('\n\n=== ENRICHMENT STATUS CHECK ===\n');
    const stillUnenriched = await attendeesCollection.countDocuments({
      'modificationHistory.source': { $ne: 'enrich-all-attendees-complete' }
    });
    
    console.log(`Total attendees still marked as unenriched: ${stillUnenriched}`);
    
  } finally {
    await client.close();
  }
}

mergeDuplicateAttendees()
  .then(() => console.log('\n✅ Merge complete'))
  .catch(console.error);