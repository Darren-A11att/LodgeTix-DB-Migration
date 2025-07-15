import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';

/**
 * Fix individual registrations where tickets have quantity > 1
 * For individual registrations, each ticket should have quantity = 1
 * A ticket with quantity = 4 should be expanded to 4 separate tickets
 */
async function fixTicketQuantityExpansion() {
  const mongoClient = new MongoClient(config.mongodb.uri);
  const supabase = createClient(config.supabase.url, config.supabase.key);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(config.mongodb.database);
    const registrationsCollection = db.collection('registrations');
    
    console.log('=== FIXING TICKET QUANTITY EXPANSION FOR INDIVIDUAL REGISTRATIONS ===\n');
    
    // Find individual registrations with tickets having quantity > 1
    const problematicRegistrations = await registrationsCollection.find({
      registrationType: { $in: ['individuals', 'individual'] },
      $or: [
        { 'registrationData.tickets': { 
          $elemMatch: { quantity: { $gt: 1 } } 
        }},
        { 'registration_data.tickets': { 
          $elemMatch: { quantity: { $gt: 1 } } 
        }}
      ]
    }).toArray();
    
    console.log(`Found ${problematicRegistrations.length} individual registrations to fix\n`);
    
    let fixedCount = 0;
    let errorCount = 0;
    let ticketsExpanded = 0;
    
    for (const registration of problematicRegistrations) {
      try {
        console.log(`\nProcessing ${registration.confirmationNumber} (${registration.registrationId})...`);
        
        // Fetch original data from Supabase
        const { data: supabaseReg, error } = await supabase
          .from('registrations')
          .select('registration_data')
          .eq('registration_id', registration.registrationId || registration.registration_id)
          .single();
        
        if (error) {
          console.error(`  ❌ Could not fetch from Supabase: ${error.message}`);
          errorCount++;
          continue;
        }
        
        if (!supabaseReg?.registration_data) {
          console.error(`  ❌ No registration_data found in Supabase`);
          errorCount++;
          continue;
        }
        
        const selectedTickets = supabaseReg.registration_data.selectedTickets || 
                              supabaseReg.registration_data.tickets || [];
        const attendees = supabaseReg.registration_data.attendees || [];
        
        if (selectedTickets.length === 0) {
          console.log(`  ⚠️  No selectedTickets found in Supabase`);
          continue;
        }
        
        console.log(`  Found ${selectedTickets.length} selectedTickets and ${attendees.length} attendees`);
        
        // Create properly expanded tickets array
        const expandedTickets: any[] = [];
        let attendeeIndex = 0;
        
        for (const selectedTicket of selectedTickets) {
          const quantity = selectedTicket.quantity || 1;
          const eventTicketId = selectedTicket.event_ticket_id || 
                              selectedTicket.eventTicketId || 
                              selectedTicket.ticketDefinitionId ||
                              selectedTicket.eventTicketsId;
          
          // For each quantity, create a separate ticket entry
          for (let i = 0; i < quantity; i++) {
            // Get the attendee for this ticket
            const attendee = attendees[attendeeIndex];
            const attendeeId = selectedTicket.attendeeId || 
                             attendee?.attendeeId || 
                             attendee?.id;
            
            if (!attendeeId) {
              console.warn(`    ⚠️  No attendeeId found for ticket ${i + 1} of ${eventTicketId}`);
            }
            
            const expandedTicket = {
              eventTicketId: eventTicketId,
              name: selectedTicket.name || selectedTicket.ticketName || 'Event Ticket',
              price: selectedTicket.price || 0,
              quantity: 1, // Always 1 for individual registrations
              ownerType: 'attendee',
              ownerId: attendeeId || registration.primaryAttendeeId || registration.registrationId
            };
            
            expandedTickets.push(expandedTicket);
            attendeeIndex++;
          }
        }
        
        console.log(`  ✓ Expanded to ${expandedTickets.length} individual tickets`);
        
        // Compare with current tickets
        const currentRegData = registration.registrationData || registration.registration_data;
        const currentTickets = currentRegData?.tickets || [];
        const currentTicketCount = currentTickets.length;
        const ticketsWithHighQty = currentTickets.filter((t: any) => t.quantity > 1).length;
        
        console.log(`  Current: ${currentTicketCount} tickets (${ticketsWithHighQty} with qty > 1)`);
        console.log(`  After fix: ${expandedTickets.length} tickets (all with qty = 1)`);
        
        // Update the registration
        const updatePath = registration.registrationData ? 'registrationData' : 'registration_data';
        
        const updateResult = await registrationsCollection.updateOne(
          { _id: registration._id },
          { 
            $set: { 
              [`${updatePath}.tickets`]: expandedTickets,
              'lastTicketQuantityFix': new Date(),
              'ticketQuantityFixReason': 'Expanded tickets with quantity > 1 to individual tickets'
            }
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          fixedCount++;
          ticketsExpanded += (expandedTickets.length - currentTicketCount);
          console.log(`  ✅ Successfully fixed registration`);
          
          // Show sample of expanded tickets
          if (fixedCount <= 3) {
            console.log(`  Sample expanded tickets:`);
            expandedTickets.slice(0, 3).forEach((ticket, idx) => {
              console.log(`    ${idx + 1}. ${ticket.name} - Owner: ${ticket.ownerId} (qty: ${ticket.quantity})`);
            });
          }
        } else {
          console.log(`  ⚠️  No changes made`);
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing registration: ${error}`);
        errorCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('FIX COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total registrations processed: ${problematicRegistrations.length}`);
    console.log(`Successfully fixed: ${fixedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total tickets expanded: ${ticketsExpanded}`);
    
    // Verify the fix by checking a sample
    if (fixedCount > 0) {
      console.log('\n=== VERIFICATION ===');
      
      const verifyCount = await registrationsCollection.countDocuments({
        registrationType: { $in: ['individuals', 'individual'] },
        $or: [
          { 'registrationData.tickets': { 
            $elemMatch: { quantity: { $gt: 1 } } 
          }},
          { 'registration_data.tickets': { 
            $elemMatch: { quantity: { $gt: 1 } } 
          }}
        ]
      });
      
      console.log(`Remaining individual registrations with quantity > 1: ${verifyCount}`);
      
      // Check our example registration
      const exampleCheck = await registrationsCollection.findOne({
        registrationId: "b49542ec-cbf2-43fe-95bb-b93edcd466f2"
      });
      
      if (exampleCheck) {
        const regData = exampleCheck.registrationData || exampleCheck.registration_data;
        console.log(`\nExample registration b49542ec-cbf2-43fe-95bb-b93edcd466f2:`);
        console.log(`  Tickets: ${regData?.tickets?.length || 0}`);
        console.log(`  All have quantity = 1: ${regData?.tickets?.every((t: any) => t.quantity === 1)}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the fix
if (require.main === module) {
  fixTicketQuantityExpansion().catch(console.error);
}

export { fixTicketQuantityExpansion };