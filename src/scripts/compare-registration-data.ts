import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';

async function compareRegistration(registrationId: string) {
  console.log(`Comparing registration ${registrationId} between MongoDB and Supabase...\n`);
  
  try {
    // Connect to MongoDB
    const { db } = await connectMongoDB();
    const registrationsCollection = db.collection('registrations');
    
    // Fetch from MongoDB
    const mongoRegistration = await registrationsCollection.findOne({ registrationId });
    
    if (!mongoRegistration) {
      console.log('Registration not found in MongoDB');
      return;
    }
    
    // Connect to Supabase
    const supabase = createClient(config.supabase.url, config.supabase.key);
    
    // Fetch from Supabase
    const { data: supabaseData, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('registration_id', registrationId)
      .single();
    
    if (error) {
      console.error('Error fetching from Supabase:', error);
      return;
    }
    
    console.log('=== MONGODB DATA ===\n');
    console.log('Basic Info:');
    console.log(`  Status: ${mongoRegistration.status}`);
    console.log(`  Type: ${mongoRegistration.registrationType}`);
    console.log(`  Total Amount: $${mongoRegistration.totalAmountPaid?.$numberDecimal || mongoRegistration.totalAmountPaid}`);
    console.log(`  Primary Attendee: ${mongoRegistration.primaryAttendee}`);
    console.log(`  Confirmation: ${mongoRegistration.confirmationNumber}`);
    
    console.log('\nAttendees:');
    const mongoAttendees = mongoRegistration.registrationData?.attendees || [];
    mongoAttendees.forEach((att: any, idx: number) => {
      console.log(`  ${idx + 1}. ${att.firstName} ${att.lastName} (${att.attendeeId})`);
    });
    
    console.log('\nTickets in MongoDB:');
    const mongoTickets = mongoRegistration.registrationData?.tickets || [];
    mongoTickets.forEach((ticket: any, idx: number) => {
      console.log(`  ${idx + 1}. ${ticket.name || 'Unknown'}`);
      console.log(`     Event Ticket ID: ${ticket.eventTicketId}`);
      console.log(`     Owner ID: ${ticket.ownerId}`);
      console.log(`     Owner Type: ${ticket.ownerType}`);
      console.log(`     Price: $${ticket.price}`);
    });
    
    console.log('\n\n=== SUPABASE DATA ===\n');
    console.log('Basic Info:');
    console.log(`  Status: ${supabaseData.status}`);
    console.log(`  Type: ${supabaseData.registration_type}`);
    console.log(`  Total Amount: $${supabaseData.total_amount}`);
    console.log(`  Email: ${supabaseData.email}`);
    console.log(`  Confirmation: ${supabaseData.confirmation_number}`);
    
    const supabaseRegData = supabaseData.registration_data;
    
    console.log('\nAttendees in Supabase:');
    const supabaseAttendees = supabaseRegData?.attendees || [];
    supabaseAttendees.forEach((att: any, idx: number) => {
      console.log(`  ${idx + 1}. ${att.firstName} ${att.lastName} (${att.attendeeId})`);
    });
    
    // Check for selectedTickets or tickets
    const ticketsField = supabaseRegData?.selectedTickets ? 'selectedTickets' : 
                       supabaseRegData?.tickets ? 'tickets' : null;
    
    if (ticketsField) {
      console.log(`\n${ticketsField} in Supabase:`);
      const supabaseTickets = supabaseRegData[ticketsField];
      supabaseTickets.forEach((ticket: any, idx: number) => {
        console.log(`  ${idx + 1}. Ticket ID: ${ticket.id}`);
        console.log(`     Event Ticket ID: ${ticket.event_ticket_id || ticket.eventTicketId || ticket.ticketDefinitionId || 'N/A'}`);
        console.log(`     Attendee ID: ${ticket.attendeeId}`);
        console.log(`     Price: $${ticket.price}`);
        if (ticket.isPackage !== undefined) {
          console.log(`     Is Package: ${ticket.isPackage}`);
        }
      });
    } else {
      console.log('\nNo selectedTickets or tickets field found in Supabase registration_data');
    }
    
    // Show tickets in the nested structure if different
    if (supabaseRegData?.tickets && ticketsField !== 'tickets') {
      console.log('\nAlso found nested tickets array:');
      supabaseRegData.tickets.forEach((ticket: any, idx: number) => {
        console.log(`  ${idx + 1}. ${ticket.name || 'Unknown'}`);
        console.log(`     Event Ticket ID: ${ticket.eventTicketId}`);
        console.log(`     Owner ID: ${ticket.ownerId}`);
        console.log(`     Owner Type: ${ticket.ownerType}`);
      });
    }
    
    console.log('\n\n=== COMPARISON SUMMARY ===\n');
    console.log(`MongoDB Tickets: ${mongoTickets.length}`);
    console.log(`Supabase ${ticketsField || 'tickets'}: ${ticketsField ? supabaseRegData[ticketsField].length : 0}`);
    
    // Check if tickets need fixing
    const needsFix = mongoTickets.some((ticket: any) => ticket.ownerId === registrationId);
    console.log(`\nNeeds Owner ID Fix: ${needsFix ? 'YES' : 'NO'}`);
    
    if (needsFix && ticketsField && supabaseRegData[ticketsField]) {
      console.log('\nProposed fixes:');
      mongoTickets.forEach((ticket: any, idx: number) => {
        if (ticket.ownerId === registrationId && idx < supabaseRegData[ticketsField].length) {
          const correctAttendeeId = supabaseRegData[ticketsField][idx].attendeeId;
          console.log(`  Ticket ${idx + 1}: ${ticket.ownerId} → ${correctAttendeeId}`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await disconnectMongoDB();
  }
}

// Run the comparison
if (require.main === module) {
  const registrationId = process.argv[2];
  if (!registrationId) {
    console.error('Please provide a registration ID');
    process.exit(1);
  }
  compareRegistration(registrationId).catch(console.error);
}