import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';

async function testSingleRegistration(registrationId: string) {
  console.log(`Testing fix for registration: ${registrationId}`);
  
  try {
    const { db } = await connectMongoDB();
    const registrationsCollection = db.collection('registrations');
    
    // Fetch the registration from MongoDB
    const registration = await registrationsCollection.findOne({ registrationId });
    
    if (!registration) {
      console.log('Registration not found in MongoDB');
      return;
    }
    
    console.log('\n=== Current MongoDB Registration ===');
    console.log('Registration ID:', registration.registrationId);
    console.log('Registration Type:', registration.registrationType);
    console.log('\nCurrent Tickets:');
    registration.registrationData.tickets.forEach((ticket: any, index: number) => {
      console.log(`  ${index + 1}. ${ticket.name}`);
      console.log(`     Event Ticket ID: ${ticket.eventTicketId}`);
      console.log(`     Owner Type: ${ticket.ownerType}`);
      console.log(`     Owner ID: ${ticket.ownerId}`);
      console.log(`     Price: $${ticket.price}`);
    });
    
    // Fetch from Supabase
    const supabase = createClient(config.supabase.url, config.supabase.key);
    const { data: supabaseData, error } = await supabase
      .from('registrations')
      .select('registration_data')
      .eq('registration_id', registrationId)
      .single();
    
    if (error) {
      console.error('\nError fetching from Supabase:', error);
      return;
    }
    
    const regData = supabaseData?.registration_data;
    const selectedTickets = regData?.selectedTickets || regData?.tickets || null;
    
    if (!selectedTickets) {
      console.log('\nNo selectedTickets/tickets found in Supabase');
      return;
    }
    
    console.log(`\n=== Supabase ${regData?.selectedTickets ? 'selectedTickets' : 'tickets'} ===`);
    selectedTickets.forEach((ticket: any, index: number) => {
      console.log(`  ${index + 1}. Ticket ID: ${ticket.id}`);
      console.log(`     Event Ticket ID: ${ticket.event_ticket_id || ticket.eventTicketId || ticket.ticketDefinitionId || 'N/A'}`);
      console.log(`     Attendee ID: ${ticket.attendeeId}`);
      console.log(`     Price: $${ticket.price}`);
      if (ticket.isPackage !== undefined) {
        console.log(`     Is Package: ${ticket.isPackage}`);
      }
    });
    
    // Show the mapping
    console.log('\n=== Proposed Fixes ===');
    
    // Since all tickets have the same eventTicketId, we need to map by index
    let fixCount = 0;
    registration.registrationData.tickets.forEach((ticket: any, index: number) => {
      if (ticket.ownerId === registration.registrationId && index < selectedTickets.length) {
        const correctAttendeeId = selectedTickets[index].attendeeId;
        console.log(`  Ticket ${index + 1} (${ticket.name}):`);
        console.log(`    Current Owner ID: ${ticket.ownerId}`);
        console.log(`    Correct Owner ID: ${correctAttendeeId}`);
        console.log(`    NEEDS FIX ✓`);
        fixCount++;
      } else if (ticket.ownerId !== registration.registrationId) {
        console.log(`  Ticket ${index + 1} (${ticket.name}): Already has correct owner ID`);
      } else {
        console.log(`  Ticket ${index + 1} (${ticket.name}): No matching selectedTicket found`);
      }
    });
    
    console.log(`\nTotal tickets needing fix: ${fixCount}`);
    
    // Ask for confirmation
    console.log('\nTo apply this fix, run: npm run fix-ticket-owners');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await disconnectMongoDB();
  }
}

// Run the test
if (require.main === module) {
  const registrationId = process.argv[2] || 'c2f9862b-e01b-4a40-b111-6b8bd836e0fc';
  testSingleRegistration(registrationId).catch(console.error);
}