import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test the ticket quantity fix on a single registration
 * Shows before/after without making changes
 */
async function testTicketQuantityFix(registrationId?: string) {
  const mongoClient = new MongoClient(config.mongodb.uri);
  const supabase = createClient(config.supabase.url, config.supabase.key);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(config.mongodb.database);
    const registrationsCollection = db.collection('registrations');
    
    // Use provided ID or the example
    const targetId = registrationId || "b49542ec-cbf2-43fe-95bb-b93edcd466f2";
    
    console.log(`=== TESTING TICKET QUANTITY FIX FOR ${targetId} ===\n`);
    
    // Get current MongoDB data
    const mongoReg = await registrationsCollection.findOne({
      registrationId: targetId
    });
    
    if (!mongoReg) {
      console.error(`Registration ${targetId} not found in MongoDB`);
      return;
    }
    
    const currentRegData = mongoReg.registrationData || mongoReg.registration_data;
    const currentTickets = currentRegData?.tickets || [];
    
    console.log('=== CURRENT MONGODB DATA ===');
    console.log(`Confirmation: ${mongoReg.confirmationNumber}`);
    console.log(`Type: ${mongoReg.registrationType}`);
    console.log(`Attendee count: ${mongoReg.attendeeCount || currentRegData?.attendees?.length || 0}`);
    console.log(`Current ticket count: ${currentTickets.length}`);
    console.log('\nCurrent tickets:');
    currentTickets.forEach((ticket: any, idx: number) => {
      console.log(`  ${idx + 1}. ${ticket.name}`);
      console.log(`     - Event Ticket ID: ${ticket.eventTicketId}`);
      console.log(`     - Quantity: ${ticket.quantity}`);
      console.log(`     - Owner Type: ${ticket.ownerType}`);
      console.log(`     - Owner ID: ${ticket.ownerId}`);
      console.log(`     - Price: $${ticket.price}`);
    });
    
    // Fetch from Supabase
    console.log('\n=== FETCHING FROM SUPABASE ===');
    
    const { data: supabaseReg, error } = await supabase
      .from('registrations')
      .select('registration_data')
      .eq('registration_id', targetId)
      .single();
    
    if (error) {
      console.error(`Error fetching from Supabase: ${error.message}`);
      return;
    }
    
    if (!supabaseReg?.registration_data) {
      console.error('No registration_data found in Supabase');
      return;
    }
    
    const selectedTickets = supabaseReg.registration_data.selectedTickets || 
                          supabaseReg.registration_data.tickets || [];
    const attendees = supabaseReg.registration_data.attendees || [];
    
    console.log(`Found ${selectedTickets.length} selectedTickets`);
    console.log(`Found ${attendees.length} attendees`);
    
    console.log('\nSelectedTickets from Supabase:');
    selectedTickets.forEach((ticket: any, idx: number) => {
      console.log(`  ${idx + 1}. ${ticket.name || 'Unknown'}`);
      console.log(`     - Event Ticket ID: ${ticket.event_ticket_id || ticket.eventTicketId || ticket.ticketDefinitionId}`);
      console.log(`     - Quantity: ${ticket.quantity || 1}`);
      console.log(`     - Attendee ID: ${ticket.attendeeId || 'Not specified'}`);
      console.log(`     - Price: $${ticket.price || 0}`);
    });
    
    console.log('\nAttendees from Supabase:');
    attendees.forEach((attendee: any, idx: number) => {
      console.log(`  ${idx + 1}. ${attendee.firstName} ${attendee.lastName}`);
      console.log(`     - ID: ${attendee.attendeeId || attendee.id}`);
      console.log(`     - Email: ${attendee.email}`);
    });
    
    // Create the expanded tickets array
    console.log('\n=== PROPOSED FIX ===');
    
    const expandedTickets: any[] = [];
    let attendeeIndex = 0;
    
    for (const selectedTicket of selectedTickets) {
      const quantity = selectedTicket.quantity || 1;
      const eventTicketId = selectedTicket.event_ticket_id || 
                          selectedTicket.eventTicketId || 
                          selectedTicket.ticketDefinitionId ||
                          selectedTicket.eventTicketsId;
      
      console.log(`\nProcessing selectedTicket: ${selectedTicket.name} (qty: ${quantity})`);
      
      // For each quantity, create a separate ticket entry
      for (let i = 0; i < quantity; i++) {
        // Get the attendee for this ticket
        const attendee = attendees[attendeeIndex];
        const attendeeId = selectedTicket.attendeeId || 
                         attendee?.attendeeId || 
                         attendee?.id;
        
        const expandedTicket = {
          eventTicketId: eventTicketId,
          name: selectedTicket.name || selectedTicket.ticketName || 'Event Ticket',
          price: selectedTicket.price || 0,
          quantity: 1, // Always 1 for individual registrations
          ownerType: 'attendee',
          ownerId: attendeeId || mongoReg.primaryAttendeeId || mongoReg.registrationId
        };
        
        expandedTickets.push(expandedTicket);
        console.log(`  Created ticket ${i + 1}/${quantity} for attendee: ${attendee?.firstName} ${attendee?.lastName} (${attendeeId})`);
        
        attendeeIndex++;
      }
    }
    
    console.log('\n=== COMPARISON ===');
    console.log(`Current tickets: ${currentTickets.length}`);
    console.log(`Expanded tickets: ${expandedTickets.length}`);
    console.log(`Difference: +${expandedTickets.length - currentTickets.length} tickets`);
    
    console.log('\n=== EXPANDED TICKETS (PREVIEW) ===');
    expandedTickets.forEach((ticket, idx) => {
      console.log(`  ${idx + 1}. ${ticket.name}`);
      console.log(`     - Event Ticket ID: ${ticket.eventTicketId}`);
      console.log(`     - Quantity: ${ticket.quantity} ✓`);
      console.log(`     - Owner Type: ${ticket.ownerType}`);
      console.log(`     - Owner ID: ${ticket.ownerId}`);
      console.log(`     - Price: $${ticket.price}`);
    });
    
    // Check if attendee count matches
    const totalQuantityNeeded = selectedTickets.reduce((sum: number, ticket: any) => 
      sum + (ticket.quantity || 1), 0
    );
    
    console.log('\n=== VALIDATION ===');
    console.log(`Total tickets needed: ${totalQuantityNeeded}`);
    console.log(`Total attendees: ${attendees.length}`);
    console.log(`Expanded tickets created: ${expandedTickets.length}`);
    console.log(`Match: ${totalQuantityNeeded === expandedTickets.length ? '✅ Yes' : '❌ No'}`);
    
    if (attendees.length < totalQuantityNeeded) {
      console.log('\n⚠️  WARNING: Not enough attendees for all tickets!');
      console.log(`   Need ${totalQuantityNeeded} attendees but only have ${attendees.length}`);
    }
    
    // Save test results to JSON
    const outputDir = path.join(process.cwd(), 'script-outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `ticket-quantity-test-${targetId}-${timestamp}.json`);
    
    const testResults = {
      timestamp: new Date().toISOString(),
      registrationId: targetId,
      confirmationNumber: mongoReg.confirmationNumber,
      registrationType: mongoReg.registrationType,
      currentState: {
        ticketCount: currentTickets.length,
        tickets: currentTickets.map((t: any) => ({
          eventTicketId: t.eventTicketId,
          name: t.name,
          quantity: t.quantity,
          ownerType: t.ownerType,
          ownerId: t.ownerId,
          price: t.price
        }))
      },
      supabaseData: {
        selectedTicketsCount: selectedTickets.length,
        selectedTickets: selectedTickets.map((t: any) => ({
          eventTicketId: t.event_ticket_id || t.eventTicketId,
          name: t.name,
          quantity: t.quantity || 1,
          attendeeId: t.attendeeId,
          price: t.price
        })),
        attendeeCount: attendees.length,
        attendees: attendees.map((a: any) => ({
          id: a.attendeeId || a.id,
          name: `${a.firstName} ${a.lastName}`,
          email: a.email
        }))
      },
      proposedFix: {
        expandedTicketCount: expandedTickets.length,
        expandedTickets: expandedTickets,
        ticketDistribution: attendees.map((a: any, idx: number) => ({
          attendee: `${a.firstName} ${a.lastName}`,
          attendeeId: a.attendeeId || a.id,
          ticketCount: expandedTickets.filter(t => t.ownerId === (a.attendeeId || a.id)).length
        }))
      },
      validation: {
        totalTicketsNeeded: totalQuantityNeeded,
        totalAttendees: attendees.length,
        expandedTicketsCreated: expandedTickets.length,
        match: totalQuantityNeeded === expandedTickets.length,
        hasEnoughAttendees: attendees.length >= totalQuantityNeeded
      }
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(testResults, null, 2));
    console.log(`\n✅ Test results saved to: ${outputFile}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the test
if (require.main === module) {
  const registrationId = process.argv[2];
  testTicketQuantityFix(registrationId).catch(console.error);
}

export { testTicketQuantityFix };