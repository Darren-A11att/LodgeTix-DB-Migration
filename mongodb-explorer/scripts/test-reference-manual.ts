import { MongoClient } from 'mongodb';

async function manualReferenceUpdate() {
  const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('=== MANUAL REFERENCE UPDATE TEST ===\n');
    
    const registrationId = '43f3fa8b-e605-44cf-af81-d4250eaa276f';
    console.log('Processing registration:', registrationId);
    
    // Get the registration
    const registration = await db.collection('registrations').findOne({ id: registrationId });
    if (!registration) {
      console.log('❌ Registration not found');
      return;
    }
    
    // Extract ticket IDs from the registration data
    const ticketsData = registration.registration_data?.selectedTickets || 
                       registration.registration_data?.tickets || 
                       registration.registrationData?.selectedTickets || 
                       registration.registrationData?.tickets || [];
    
    console.log('\n=== EXTRACTING REFERENCES ===');
    console.log('Found', ticketsData.length, 'tickets in registration data');
    
    // Collect all unique ticket IDs (business IDs, not ObjectIds)
    const extractedTicketIds: string[] = [];
    const attendeeIdSet = new Set<string>();
    
    for (const ticket of ticketsData) {
      const ticketId = ticket.ticketId || ticket.id;
      if (ticketId) {
        extractedTicketIds.push(ticketId);
        console.log('  - Ticket:', ticketId);
        
        // Also collect attendee IDs
        if (ticket.attendeeId) {
          attendeeIdSet.add(ticket.attendeeId);
        }
      }
    }
    
    const extractedAttendeeIds = Array.from(attendeeIdSet);
    console.log('\nFound', extractedAttendeeIds.length, 'unique attendee IDs:');
    extractedAttendeeIds.forEach(id => console.log('  - Attendee:', id));
    
    // Get customer ID from metadata
    const customerUUID = registration.metadata?.customerUUID || registration.customerId;
    console.log('\nCustomer UUID:', customerUUID || 'NOT FOUND');
    
    // Update the import_registrations document with extracted references
    console.log('\n=== UPDATING REGISTRATION WITH REFERENCES ===');
    
    const updateResult = await db.collection('import_registrations').updateOne(
      { id: registrationId },
      {
        $set: {
          'metadata.extractedTicketIds': extractedTicketIds,
          'metadata.extractedAttendeeIds': extractedAttendeeIds,
          'metadata.extractedCustomerId': customerUUID,
          'metadata.ticketCount': extractedTicketIds.length,
          'metadata.attendeeCount': extractedAttendeeIds.length,
          'metadata.extractionCompleted': true,
          'metadata.extractionDate': new Date(),
          'metadata.manualUpdate': true
        }
      },
      { upsert: true }
    );
    
    if (updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0) {
      console.log('✅ Successfully updated registration with references');
      console.log('   - Ticket references:', extractedTicketIds.length);
      console.log('   - Attendee references:', extractedAttendeeIds.length);
      console.log('   - Customer reference:', customerUUID ? 'Yes' : 'No');
    } else {
      console.log('⚠️ No changes made to registration');
    }
    
    // Update tickets with backward references
    console.log('\n=== ADDING BACKWARD REFERENCES TO TICKETS ===');
    let ticketsUpdated = 0;
    
    for (const ticketId of extractedTicketIds) {
      // Find which attendee this ticket belongs to
      const ticketData = ticketsData.find((t: any) => (t.ticketId || t.id) === ticketId);
      const attendeeId = ticketData?.attendeeId;
      
      const ticketUpdate = await db.collection('import_tickets').updateOne(
        { ticketId: ticketId },
        {
          $set: {
            'metadata.registrationId': registrationId,
            'metadata.attendeeId': attendeeId,
            'metadata.customerId': customerUUID,
            'metadata.extractedFrom': 'registration',
            'metadata.referenceUpdate': new Date()
          }
        }
      );
      
      if (ticketUpdate.modifiedCount > 0) {
        ticketsUpdated++;
        console.log(`  ✅ Updated ticket ${ticketId} with references`);
      }
    }
    console.log(`Updated ${ticketsUpdated}/${extractedTicketIds.length} tickets with backward references`);
    
    // Update attendees with backward references
    console.log('\n=== ADDING BACKWARD REFERENCES TO ATTENDEES ===');
    let attendeesUpdated = 0;
    
    for (const attendeeId of extractedAttendeeIds) {
      // Find tickets for this attendee
      const attendeeTickets = ticketsData
        .filter((t: any) => t.attendeeId === attendeeId)
        .map((t: any) => t.ticketId || t.id);
      
      const attendeeUpdate = await db.collection('import_attendees').updateOne(
        { attendeeId: attendeeId },
        {
          $set: {
            'metadata.registrationId': registrationId,
            'metadata.associatedTicketIds': attendeeTickets,
            'metadata.customerId': customerUUID,
            'metadata.extractedFrom': 'registration',
            'metadata.referenceUpdate': new Date()
          }
        }
      );
      
      if (attendeeUpdate.modifiedCount > 0) {
        attendeesUpdated++;
        console.log(`  ✅ Updated attendee ${attendeeId} with references`);
        console.log(`     Associated tickets: ${attendeeTickets.length}`);
      }
    }
    console.log(`Updated ${attendeesUpdated}/${extractedAttendeeIds.length} attendees with backward references`);
    
    // Replace booking contact with reference
    if (customerUUID) {
      console.log('\n=== REPLACING BOOKING CONTACT WITH REFERENCE ===');
      const bookingUpdate = await db.collection('import_registrations').updateOne(
        { id: registrationId },
        {
          $set: {
            'registrationData.bookingContactRef': customerUUID
          }
        }
      );
      
      if (bookingUpdate.modifiedCount > 0) {
        console.log('✅ Replaced booking contact with customer reference:', customerUUID);
      }
    }
    
    console.log('\n=== REFERENCE UPDATE COMPLETE ===');
    console.log('✅ All references have been updated');
    console.log('\nNow run test-reference-tracking.ts to verify the results');
    
  } catch (error) {
    console.error('Error during manual update:', error);
  } finally {
    await client.close();
  }
}

// Run the manual update
manualReferenceUpdate().catch(console.error);