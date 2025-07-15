import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';

async function testRandomRegistrations(count: number = 5) {
  console.log(`Testing ${count} random individual registrations...\n`);
  
  try {
    const { db } = await connectMongoDB();
    const registrationsCollection = db.collection('registrations');
    
    // Find random individual registrations with incorrect owner IDs
    const randomRegistrations = await registrationsCollection.aggregate([
      {
        $match: {
          registrationType: 'individuals',
          'registrationData.tickets': { $exists: true },
          $expr: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$registrationData.tickets',
                    as: 'ticket',
                    cond: {
                      $eq: ['$$ticket.ownerId', '$registrationId']
                    }
                  }
                }
              },
              0
            ]
          }
        }
      },
      { $sample: { size: count } }
    ]).toArray();
    
    if (randomRegistrations.length === 0) {
      console.log('No registrations found that need fixing.');
      return;
    }
    
    console.log(`Found ${randomRegistrations.length} registrations to test.\n`);
    
    const supabase = createClient(config.supabase.url, config.supabase.key);
    
    for (let i = 0; i < randomRegistrations.length; i++) {
      const registration = randomRegistrations[i];
      console.log(`${'='.repeat(80)}`);
      console.log(`TEST ${i + 1}/${randomRegistrations.length}: Registration ${registration.registrationId}`);
      console.log(`${'='.repeat(80)}`);
      
      // Show basic info
      console.log(`\nRegistration Info:`);
      console.log(`  Type: ${registration.registrationType}`);
      console.log(`  Primary Attendee: ${registration.primaryAttendee}`);
      console.log(`  Total Amount: $${registration.totalAmountPaid?.$numberDecimal || registration.totalAmountPaid}`);
      console.log(`  Attendee Count: ${registration.attendeeCount}`);
      console.log(`  Confirmation: ${registration.confirmationNumber}`);
      
      // Show attendees
      console.log(`\nAttendees (${registration.registrationData.attendees?.length || 0}):`);
      registration.registrationData.attendees?.forEach((attendee: any, idx: number) => {
        console.log(`  ${idx + 1}. ${attendee.firstName} ${attendee.lastName} (${attendee.attendeeId})`);
      });
      
      // Show current tickets
      console.log(`\nCurrent Tickets (${registration.registrationData.tickets?.length || 0}):`);
      registration.registrationData.tickets?.forEach((ticket: any, idx: number) => {
        console.log(`  ${idx + 1}. ${ticket.name} - Owner: ${ticket.ownerId}`);
      });
      
      // Fetch from Supabase
      const { data: supabaseData, error } = await supabase
        .from('registrations')
        .select('registration_data')
        .eq('registration_id', registration.registrationId)
        .single();
      
      if (error) {
        console.log(`\n❌ Error fetching from Supabase: ${error.message}`);
        continue;
      }
      
      const regData = supabaseData?.registration_data;
      const selectedTickets = regData?.selectedTickets || regData?.tickets || null;
      
      if (!selectedTickets || selectedTickets.length === 0) {
        console.log(`\n⚠️  No selectedTickets/tickets found in Supabase`);
        continue;
      }
      
      // Show selectedTickets
      const fieldName = regData?.selectedTickets ? 'selectedTickets' : 'tickets';
      console.log(`\nSupabase ${fieldName} (${selectedTickets.length}):`);
      selectedTickets.forEach((ticket: any, idx: number) => {
        const ticketId = ticket.event_ticket_id || ticket.eventTicketId || ticket.ticketDefinitionId;
        console.log(`  ${idx + 1}. AttendeeId: ${ticket.attendeeId}${ticketId ? `, TicketId: ${ticketId}` : ''}`);
      });
      
      // Show proposed fixes
      console.log(`\nProposed Fixes:`);
      let fixCount = 0;
      registration.registrationData.tickets?.forEach((ticket: any, idx: number) => {
        if (ticket.ownerId === registration.registrationId && idx < selectedTickets.length) {
          console.log(`  ✓ Ticket ${idx + 1}: ${ticket.ownerId} → ${selectedTickets[idx].attendeeId}`);
          fixCount++;
        }
      });
      
      if (fixCount === 0) {
        console.log(`  No fixes needed`);
      } else {
        console.log(`\n  Total fixes needed: ${fixCount}`);
      }
      
      console.log('');
    }
    
    console.log(`${'='.repeat(80)}`);
    console.log(`SUMMARY: Tested ${randomRegistrations.length} registrations`);
    console.log(`${'='.repeat(80)}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await disconnectMongoDB();
  }
}

// Run the script
if (require.main === module) {
  const count = parseInt(process.argv[2]) || 5;
  testRandomRegistrations(count).catch(console.error);
}