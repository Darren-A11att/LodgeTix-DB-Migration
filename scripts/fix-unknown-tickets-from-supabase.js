#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');

async function fixUnknownTicketsFromSupabase() {
  // Initialize connections
  const mongoUri = process.env.MONGODB_URI;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!mongoUri || !supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables');
    return;
  }
  
  const mongoClient = new MongoClient(mongoUri);
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db('LodgeTix-migration-test-1');
    
    console.log('=== FIXING UNKNOWN TICKETS FROM SUPABASE ===\n');
    
    // Find the unknown ticket ID
    const unknownTicketId = 'b8a1ef1f-5f53-4544-af7b-901756b9ba7d';
    console.log(`Looking for event ticket: ${unknownTicketId} in Supabase...\n`);
    
    // Fetch from Supabase
    const { data: eventTicket, error } = await supabase
      .from('event_tickets')
      .select('*')
      .eq('event_ticket_id', unknownTicketId)
      .single();
    
    if (error) {
      console.error('Error fetching from Supabase:', error.message);
      return;
    }
    
    if (!eventTicket) {
      console.log('Event ticket not found in Supabase');
      return;
    }
    
    console.log('Found event ticket in Supabase:');
    console.log(`  Name: ${eventTicket.name}`);
    console.log(`  Price: $${eventTicket.price}`);
    console.log(`  Status: ${eventTicket.status}`);
    console.log(`  Event ID: ${eventTicket.event_id}`);
    
    // Insert into MongoDB eventTickets collection
    console.log('\nInserting into MongoDB eventTickets collection...');
    
    const eventTicketDoc = {
      eventTicketId: eventTicket.event_ticket_id,
      name: eventTicket.name,
      description: eventTicket.description,
      price: { $numberDecimal: String(eventTicket.price || 0) },
      status: eventTicket.status || 'Active',
      eventId: eventTicket.event_id,
      totalCapacity: eventTicket.total_capacity || 0,
      availableCount: eventTicket.available_count || 0,
      soldCount: eventTicket.sold_count || 0,
      isActive: eventTicket.is_active !== false,
      createdAt: eventTicket.created_at,
      updatedAt: eventTicket.updated_at,
      eligibilityCriteria: eventTicket.eligibility_criteria || { rules: [] },
      importedFromSupabase: true,
      importedAt: new Date()
    };
    
    // Try to insert or update
    const result = await db.collection('eventTickets').replaceOne(
      { eventTicketId: eventTicket.event_ticket_id },
      eventTicketDoc,
      { upsert: true }
    );
    
    if (result.upsertedCount > 0) {
      console.log('✅ Event ticket inserted successfully');
    } else if (result.modifiedCount > 0) {
      console.log('✅ Event ticket updated successfully');
    } else {
      console.log('ℹ️  Event ticket already exists with same data');
    }
    
    // Now fix the registrations with this ticket
    console.log('\nFinding registrations with unknown tickets...');
    
    const registrationsWithUnknownTickets = await db.collection('registrations').find({
      'registrationData.tickets': {
        $elemMatch: {
          eventTicketId: unknownTicketId,
          price: 0
        }
      }
    }).toArray();
    
    console.log(`Found ${registrationsWithUnknownTickets.length} registrations to fix\n`);
    
    const stats = {
      registrationsUpdated: 0,
      ticketsFixed: 0
    };
    
    // Process each registration
    for (const registration of registrationsWithUnknownTickets) {
      console.log(`Processing registration: ${registration.confirmationNumber || registration._id}`);
      
      const tickets = registration.registrationData?.tickets || [];
      let updated = false;
      let ticketsFixed = 0;
      
      // Update tickets
      const updatedTickets = tickets.map(ticket => {
        if (ticket.eventTicketId === unknownTicketId && ticket.price === 0) {
          console.log(`  ✓ Fixing ticket: ${ticket.name || eventTicket.name} - $0 → $${eventTicket.price}`);
          ticketsFixed++;
          updated = true;
          return {
            ...ticket,
            name: ticket.name || eventTicket.name,
            price: parseFloat(eventTicket.price) || 0
          };
        }
        return ticket;
      });
      
      // Update the registration if any tickets were fixed
      if (updated) {
        const updateResult = await db.collection('registrations').updateOne(
          { _id: registration._id },
          {
            $set: {
              'registrationData.tickets': updatedTickets,
              'unknownTicketsFixed': true,
              'unknownTicketsFixedAt': new Date(),
              'unknownTicketsFixedCount': ticketsFixed
            }
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          console.log(`  ✅ Updated registration with ${ticketsFixed} fixed ticket prices`);
          stats.registrationsUpdated++;
          stats.ticketsFixed += ticketsFixed;
        }
      }
    }
    
    console.log('\n=== FIX COMPLETE ===');
    console.log(`Event ticket imported from Supabase: ${eventTicket.name}`);
    console.log(`Registrations updated: ${stats.registrationsUpdated}`);
    console.log(`Total tickets fixed: ${stats.ticketsFixed}`);
    
    // Verify by running the zero price analysis again
    console.log('\n=== VERIFICATION ===');
    const remainingZeroPrice = await db.collection('registrations').countDocuments({
      'registrationData.tickets': {
        $elemMatch: {
          eventTicketId: unknownTicketId,
          price: 0
        }
      }
    });
    
    console.log(`Remaining tickets with zero price for this event ticket: ${remainingZeroPrice}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run if called directly
if (require.main === module) {
  console.log('Starting unknown ticket fix from Supabase...\n');
  
  fixUnknownTicketsFromSupabase()
    .then(() => {
      console.log('\n✅ Unknown ticket fix completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Unknown ticket fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixUnknownTicketsFromSupabase };