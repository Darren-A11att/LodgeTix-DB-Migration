import { MongoClient } from 'mongodb';

async function debugRegistrationTickets() {
  const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    const registrationId = '43f3fa8b-e605-44cf-af81-d4250eaa276f';
    const registration = await db.collection('registrations').findOne({ id: registrationId });
    
    if (!registration) {
      console.log('Registration not found');
      return;
    }
    
    console.log('=== REGISTRATION DATA ===');
    console.log('Registration ID:', registrationId);
    console.log('Type:', registration.registration_type || registration.type);
    
    // Get tickets from registration_data
    const ticketsData = registration.registration_data?.selectedTickets || 
                       registration.registration_data?.tickets || 
                       registration.registrationData?.selectedTickets || 
                       registration.registrationData?.tickets || [];
    
    console.log('\n=== RAW TICKETS IN REGISTRATION ===');
    console.log('Total tickets:', ticketsData.length);
    
    // Group tickets by attendeeId
    const ticketsByAttendee = new Map<string, any[]>();
    
    ticketsData.forEach((ticket: any, idx: number) => {
      const attendeeId = ticket.attendeeId || 'no-attendee';
      if (!ticketsByAttendee.has(attendeeId)) {
        ticketsByAttendee.set(attendeeId, []);
      }
      ticketsByAttendee.get(attendeeId)!.push(ticket);
    });
    
    console.log('\n=== TICKETS GROUPED BY ATTENDEE ===');
    for (const [attendeeId, tickets] of ticketsByAttendee) {
      console.log(`\nAttendee: ${attendeeId}`);
      console.log(`  Number of tickets: ${tickets.length}`);
      tickets.forEach((ticket: any, idx: number) => {
        console.log(`  ${idx + 1}. eventTicketId: ${ticket.eventTicketId}`);
        console.log(`     ticketId: ${ticket.ticketId || ticket.id}`);
        console.log(`     price: $${ticket.price}`);
        console.log(`     isPackage: ${ticket.isPackage}`);
        console.log(`     packageId: ${ticket.packageId || 'none'}`);
      });
    }
    
    // Check for duplicates by eventTicketId
    console.log('\n=== CHECKING FOR DUPLICATE EVENT TICKET IDS ===');
    const eventTicketCounts = new Map<string, number>();
    ticketsData.forEach((ticket: any) => {
      const etId = ticket.eventTicketId;
      eventTicketCounts.set(etId, (eventTicketCounts.get(etId) || 0) + 1);
    });
    
    const duplicates = Array.from(eventTicketCounts.entries()).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log('⚠️ FOUND DUPLICATE EVENT TICKET IDS:');
      duplicates.forEach(([etId, count]) => {
        console.log(`  ${etId}: appears ${count} times`);
      });
    } else {
      console.log('✅ No duplicate event ticket IDs found');
    }
    
    // Check for unique ticketIds
    console.log('\n=== CHECKING TICKET ID UNIQUENESS ===');
    const ticketIdSet = new Set<string>();
    let duplicateTicketIds = 0;
    
    ticketsData.forEach((ticket: any) => {
      const tId = ticket.ticketId || ticket.id;
      if (ticketIdSet.has(tId)) {
        console.log(`  ⚠️ Duplicate ticketId: ${tId}`);
        duplicateTicketIds++;
      } else {
        ticketIdSet.add(tId);
      }
    });
    
    if (duplicateTicketIds === 0) {
      console.log('✅ All ticketIds are unique');
    } else {
      console.log(`⚠️ Found ${duplicateTicketIds} duplicate ticketIds`);
    }
    
    // Simulate the expansion check
    console.log('\n=== PACKAGE EXPANSION CHECK ===');
    const packageTickets = ticketsData.filter((t: any) => t.isPackage === true);
    console.log(`Package tickets found: ${packageTickets.length}`);
    
    if (packageTickets.length === 0) {
      console.log('ℹ️ No package tickets to expand - all tickets appear to be already expanded or individual tickets');
    }
    
    // Check event_tickets collection for these IDs
    console.log('\n=== CHECKING EVENT_TICKETS COLLECTION ===');
    const uniqueEventTicketIds = Array.from(new Set(ticketsData.map((t: any) => t.eventTicketId)));
    
    for (const etId of uniqueEventTicketIds) {
      const eventTicket = await db.collection('event_tickets').findOne({ eventTicketId: etId });
      if (eventTicket) {
        console.log(`✅ Found: ${eventTicket.name} (${etId}) - Price: $${eventTicket.price?.$numberDecimal || eventTicket.price || 0}`);
      } else {
        console.log(`❌ NOT FOUND: ${etId}`);
      }
    }
    
    // Check what the problem event ticket is
    const problemEventTicketId = 'd4e5f6a7-b8c9-4567-def0-456789012345';
    console.log('\n=== INVESTIGATING PROBLEM TICKET ===');
    console.log('Looking for event ticket:', problemEventTicketId);
    
    const problemEventTicket = await db.collection('event_tickets').findOne({ eventTicketId: problemEventTicketId });
    if (problemEventTicket) {
      console.log('Found in event_tickets:', problemEventTicket.name);
    } else {
      console.log('❌ NOT FOUND in event_tickets collection');
      console.log('This could be why tickets are not being created properly!');
    }
    
    // Check for the specific tickets that appear to be missing from the package
    console.log('\n=== ANALYZING TICKET PATTERNS ===');
    
    // First 5 tickets all have the same attendeeId and include the package ID in their ticketId
    const firstAttendeeId = '019750ed-3bc6-75ce-bb60-f9b4f8c9a66c';
    const packageId = '88567b9c-9675-4ee2-b572-eace1c580eb4';
    
    const firstAttendeeTickets = ticketsData.filter((t: any) => t.attendeeId === firstAttendeeId);
    console.log(`\nTickets for first attendee (${firstAttendeeId}): ${firstAttendeeTickets.length}`);
    
    const packageExpandedTickets = firstAttendeeTickets.filter((t: any) => 
      t.ticketId && t.ticketId.includes(packageId)
    );
    console.log(`Tickets that appear to be from package expansion: ${packageExpandedTickets.length}`);
    
    if (packageExpandedTickets.length === 5) {
      console.log('✅ All 5 package items appear to be expanded correctly in the registration data');
    } else {
      console.log(`⚠️ Expected 5 expanded tickets but found ${packageExpandedTickets.length}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

debugRegistrationTickets().catch(console.error);