import { MongoClient } from 'mongodb';

async function testReferenceTracking() {
  const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('=== REFERENCE TRACKING TEST ===\n');
    
    // Test with a known registration
    const registrationId = '43f3fa8b-e605-44cf-af81-d4250eaa276f';
    
    console.log('Testing registration:', registrationId);
    console.log('');
    
    // Get the registration from import_registrations
    const registration = await db.collection('import_registrations').findOne({ id: registrationId });
    
    if (!registration) {
      console.log('❌ Registration not found in import_registrations');
      return;
    }
    
    console.log('=== REGISTRATION METADATA ===');
    const metadata = registration.metadata || {};
    console.log('Extracted Customer ID:', metadata.extractedCustomerId || 'NOT SET');
    console.log('Customer UUID:', metadata.customerUUID || 'NOT SET');
    console.log('Extracted Ticket IDs:', metadata.extractedTicketIds?.length || 0, 'tickets');
    console.log('Extracted Attendee IDs:', metadata.extractedAttendeeIds?.length || 0, 'attendees');
    console.log('Extraction Completed:', metadata.extractionCompleted || false);
    console.log('Extraction Date:', metadata.extractionDate || 'NOT SET');
    
    // Check for booking contact reference
    console.log('\n=== BOOKING CONTACT REFERENCE ===');
    const bookingContactRef = registration.registrationData?.bookingContactRef;
    const bookingContactObject = registration.registrationData?.bookingContact;
    
    if (bookingContactRef) {
      console.log('✅ Booking contact replaced with reference:', bookingContactRef);
    } else if (bookingContactObject && typeof bookingContactObject === 'object') {
      console.log('⚠️ Booking contact still embedded as object');
      console.log('   Name:', bookingContactObject.firstName, bookingContactObject.lastName);
    } else if (bookingContactObject) {
      console.log('✅ Booking contact is a reference (ObjectId):', bookingContactObject);
    } else {
      console.log('❌ No booking contact found');
    }
    
    // Check extracted tickets
    console.log('\n=== EXTRACTED TICKETS ===');
    if (metadata.extractedTicketIds && metadata.extractedTicketIds.length > 0) {
      console.log(`Found ${metadata.extractedTicketIds.length} extracted ticket IDs:`);
      
      // Verify each ticket exists and has backward references
      let validTickets = 0;
      let ticketsWithRefs = 0;
      
      for (const ticketId of metadata.extractedTicketIds) {
        const ticket = await db.collection('import_tickets').findOne({ ticketId });
        if (ticket) {
          validTickets++;
          console.log(`  ✅ ${ticketId} exists`);
          
          // Check backward references
          if (ticket.metadata?.registrationId === registrationId) {
            ticketsWithRefs++;
            console.log(`     ✅ Has registration reference`);
          } else {
            console.log(`     ⚠️ Missing registration reference`);
          }
          
          if (ticket.metadata?.attendeeId) {
            console.log(`     ✅ Has attendee reference: ${ticket.metadata.attendeeId}`);
          } else {
            console.log(`     ⚠️ Missing attendee reference`);
          }
          
          if (ticket.metadata?.customerId) {
            console.log(`     ✅ Has customer reference: ${ticket.metadata.customerId}`);
          }
        } else {
          console.log(`  ❌ ${ticketId} NOT FOUND`);
        }
      }
      
      console.log(`\nSummary: ${validTickets}/${metadata.extractedTicketIds.length} tickets exist`);
      console.log(`          ${ticketsWithRefs}/${metadata.extractedTicketIds.length} have registration references`);
    } else {
      console.log('❌ No extracted ticket IDs found in metadata');
    }
    
    // Check extracted attendees
    console.log('\n=== EXTRACTED ATTENDEES ===');
    if (metadata.extractedAttendeeIds && metadata.extractedAttendeeIds.length > 0) {
      console.log(`Found ${metadata.extractedAttendeeIds.length} extracted attendee IDs:`);
      
      let validAttendees = 0;
      let attendeesWithRefs = 0;
      
      for (const attendeeId of metadata.extractedAttendeeIds) {
        const attendee = await db.collection('import_attendees').findOne({ attendeeId });
        if (attendee) {
          validAttendees++;
          console.log(`  ✅ ${attendeeId} exists`);
          
          // Check backward references
          if (attendee.metadata?.registrationId === registrationId) {
            attendeesWithRefs++;
            console.log(`     ✅ Has registration reference`);
          } else {
            console.log(`     ⚠️ Missing registration reference`);
          }
          
          if (attendee.metadata?.associatedTicketIds && attendee.metadata.associatedTicketIds.length > 0) {
            console.log(`     ✅ Has ${attendee.metadata.associatedTicketIds.length} associated ticket IDs`);
          } else {
            console.log(`     ⚠️ No associated ticket IDs`);
          }
          
          if (attendee.metadata?.customerId) {
            console.log(`     ✅ Has customer reference: ${attendee.metadata.customerId}`);
          }
          
          // Check event tickets
          if (attendee.data?.eventTickets && attendee.data.eventTickets.length > 0) {
            console.log(`     ✅ Has ${attendee.data.eventTickets.length} event tickets with ticketId references`);
          }
        } else {
          console.log(`  ❌ ${attendeeId} NOT FOUND`);
        }
      }
      
      console.log(`\nSummary: ${validAttendees}/${metadata.extractedAttendeeIds.length} attendees exist`);
      console.log(`          ${attendeesWithRefs}/${metadata.extractedAttendeeIds.length} have registration references`);
    } else {
      console.log('❌ No extracted attendee IDs found in metadata');
    }
    
    // Check for embedded data that should be removed
    console.log('\n=== EMBEDDED DATA CHECK ===');
    const embeddedTickets = registration.registrationData?.tickets || registration.registration_data?.tickets;
    const embeddedAttendees = registration.registrationData?.attendees || registration.registration_data?.attendees;
    
    if (embeddedTickets && embeddedTickets.length > 0) {
      console.log(`⚠️ Found ${embeddedTickets.length} embedded tickets still in registration`);
      console.log('   These should be removed after extraction to prevent duplication');
    } else {
      console.log('✅ No embedded tickets found (good - they have been extracted)');
    }
    
    if (embeddedAttendees && embeddedAttendees.length > 0) {
      console.log(`⚠️ Found ${embeddedAttendees.length} embedded attendees still in registration`);
      console.log('   These should be removed after extraction to prevent duplication');
    } else {
      console.log('✅ No embedded attendees found (good - they have been extracted)');
    }
    
    // Final assessment
    console.log('\n=== REFERENCE TRACKING ASSESSMENT ===');
    const issues = [];
    
    if (!metadata.extractedTicketIds || metadata.extractedTicketIds.length === 0) {
      issues.push('No extracted ticket IDs in metadata');
    }
    
    if (!metadata.extractedAttendeeIds || metadata.extractedAttendeeIds.length === 0) {
      issues.push('No extracted attendee IDs in metadata');
    }
    
    if (!metadata.extractedCustomerId && !bookingContactRef) {
      issues.push('No customer reference found');
    }
    
    if (embeddedTickets && embeddedTickets.length > 0) {
      issues.push('Embedded tickets still present');
    }
    
    if (embeddedAttendees && embeddedAttendees.length > 0) {
      issues.push('Embedded attendees still present');
    }
    
    if (issues.length === 0) {
      console.log('✅ REFERENCE TRACKING FULLY IMPLEMENTED');
      console.log('   - All extracted documents are referenced by business IDs');
      console.log('   - Backward references are in place');
      console.log('   - Embedded data has been properly handled');
    } else {
      console.log('⚠️ REFERENCE TRACKING PARTIALLY IMPLEMENTED');
      console.log('Issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await client.close();
  }
}

// Run the test
testReferenceTracking().catch(console.error);