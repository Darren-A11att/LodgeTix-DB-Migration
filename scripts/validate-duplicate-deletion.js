const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function validateDuplicateDeletion() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    // Get the archived record
    const archived = await db.collection('archived_duplicates').findOne({
      _original_id: new ObjectId('686fb56589bace4d716bde62')
    });
    
    // Get the kept record
    const kept = await db.collection('registrations').findOne({
      _id: new ObjectId('686be2a4b020a8c479e70a02')
    });
    
    if (!archived) {
      console.log('Could not find archived record');
      return;
    }
    
    if (!kept) {
      console.log('Could not find kept record');
      return;
    }
    
    console.log('=== COMPARING ARCHIVED vs KEPT RECORD ===\n');
    
    // Compare key IDs
    console.log('Primary IDs:');
    console.log(`  Archived _id: ${archived._original_id}`);
    console.log(`  Kept _id: ${kept._id}`);
    console.log(`  Same: ${archived._original_id.toString() === kept._id.toString()}`);
    
    console.log('\nRegistration IDs:');
    console.log(`  Archived: ${archived.registrationId}`);
    console.log(`  Kept: ${kept.registrationId}`);
    console.log(`  Same: ${archived.registrationId === kept.registrationId}`);
    
    console.log('\nPrimary Attendee IDs:');
    console.log(`  Archived: ${archived.primaryAttendeeId}`);
    console.log(`  Kept: ${kept.primaryAttendeeId}`);
    console.log(`  Same: ${archived.primaryAttendeeId === kept.primaryAttendeeId}`);
    
    console.log('\nEvent IDs:');
    console.log(`  Archived: ${archived.eventId}`);
    console.log(`  Kept: ${kept.eventId}`);
    console.log(`  Same: ${archived.eventId === kept.eventId}`);
    
    console.log('\nOrganisation IDs:');
    console.log(`  Archived: ${archived.organisationId}`);
    console.log(`  Kept: ${kept.organisationId}`);
    console.log(`  Same: ${archived.organisationId === kept.organisationId}`);
    
    // Check attendees
    const archivedAttendees = archived.registrationData?.attendees || [];
    const keptAttendees = kept.registrationData?.attendees || [];
    
    console.log('\nAttendees:');
    console.log(`  Archived count: ${archivedAttendees.length}`);
    console.log(`  Kept count: ${keptAttendees.length}`);
    
    if (archivedAttendees.length > 0 && keptAttendees.length > 0) {
      console.log('\n  Attendee ID comparison:');
      for (let i = 0; i < Math.min(archivedAttendees.length, keptAttendees.length); i++) {
        console.log(`    Attendee ${i + 1}:`);
        console.log(`      Archived ID: ${archivedAttendees[i].id}`);
        console.log(`      Kept ID: ${keptAttendees[i].id}`);
        console.log(`      Same: ${archivedAttendees[i].id === keptAttendees[i].id}`);
      }
    }
    
    // Check tickets
    const archivedTickets = archived.registrationData?.tickets || [];
    const keptTickets = kept.registrationData?.tickets || [];
    
    console.log('\nTickets:');
    console.log(`  Archived count: ${archivedTickets.length}`);
    console.log(`  Kept count: ${keptTickets.length}`);
    
    if (archivedTickets.length > 0 && keptTickets.length > 0) {
      console.log('\n  Ticket comparison:');
      for (let i = 0; i < Math.min(archivedTickets.length, keptTickets.length); i++) {
        console.log(`    Ticket ${i + 1}:`);
        console.log(`      Archived ownerId: ${archivedTickets[i].ownerId}`);
        console.log(`      Kept ownerId: ${keptTickets[i].ownerId}`);
        console.log(`      Same: ${archivedTickets[i].ownerId === keptTickets[i].ownerId}`);
      }
    }
    
    // Check payment data
    console.log('\nPayment Data:');
    console.log(`  Archived total: $${archived.totalPricePaid}`);
    console.log(`  Kept total: $${kept.totalPricePaid}`);
    console.log(`  Same: ${archived.totalPricePaid === kept.totalPricePaid}`);
    
    console.log('\n=== CONCLUSION ===');
    
    const differentFields = [];
    if (archived.registrationId !== kept.registrationId) differentFields.push('registrationId');
    if (archived.primaryAttendeeId !== kept.primaryAttendeeId) differentFields.push('primaryAttendeeId');
    if (archived.eventId !== kept.eventId) differentFields.push('eventId');
    if (archived.organisationId !== kept.organisationId) differentFields.push('organisationId');
    
    if (differentFields.length > 0) {
      console.log('❌ These were NOT duplicates - they have different core IDs!');
      console.log(`Different fields: ${differentFields.join(', ')}`);
      console.log('\nThis appears to be two different registrations that happened to get the same confirmation number.');
      console.log('This was a DATA CORRUPTION issue - we should NOT have deleted one of them!');
    } else {
      console.log('✅ These appear to be true duplicates with identical core IDs.');
      console.log('The deletion was appropriate.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

validateDuplicateDeletion().catch(console.error);