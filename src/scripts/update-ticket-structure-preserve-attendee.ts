import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';

/**
 * Update ticket structure to use ownerType/ownerId while preserving attendeeId from selectedTickets
 * This is an improved version that fetches the original attendeeId from Supabase
 */
async function updateTicketStructurePreserveAttendee() {
  const mongoClient = new MongoClient(config.mongodb.uri);
  const supabase = createClient(config.supabase.url, config.supabase.key);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(config.mongodb.database);
    const registrationsCollection = db.collection('registrations');
    
    console.log('=== UPDATING TICKET STRUCTURE WITH PRESERVED ATTENDEE IDS ===\n');
    
    // Get all registrations
    const registrations = await registrationsCollection.find({}).toArray();
    console.log(`Found ${registrations.length} total registrations\n`);
    
    let updatedCount = 0;
    let individualCount = 0;
    let lodgeCount = 0;
    let errorCount = 0;
    
    for (const registration of registrations) {
      try {
        const regData = registration.registrationData || registration.registration_data;
        
        if (!regData || !regData.tickets) {
          continue;
        }
        
        const isLodge = registration.registrationType === 'lodge' || 
                       registration.registrationType === 'lodges' ||
                       (regData.lodgeDetails && regData.tableCount);
        
        // For individual registrations, fetch original data from Supabase
        if (!isLodge && registration.registrationType === 'individuals') {
          // Fetch from Supabase to get original selectedTickets with attendeeIds
          const { data: supabaseReg, error } = await supabase
            .from('registrations')
            .select('registration_data')
            .eq('registration_id', registration.registrationId)
            .single();
          
          if (error) {
            console.error(`Could not fetch Supabase data for ${registration.registrationId}:`, error);
            continue;
          }
          
          const supabaseTickets = supabaseReg?.registration_data?.selectedTickets || 
                                 supabaseReg?.registration_data?.tickets || [];
          
          if (supabaseTickets.length === 0) {
            console.log(`No selectedTickets found in Supabase for ${registration.registrationId}`);
            continue;
          }
          
          // Create mapping of ticket position to attendeeId
          const attendeeIdMap = new Map<number, string>();
          let ticketIndex = 0;
          
          supabaseTickets.forEach((ticket: any) => {
            const quantity = ticket.quantity || 1;
            for (let i = 0; i < quantity; i++) {
              attendeeIdMap.set(ticketIndex, ticket.attendeeId);
              ticketIndex++;
            }
          });
          
          // Update tickets with correct owner information
          let hasChanges = false;
          const updatedTickets = regData.tickets.map((ticket: any, index: number) => {
            const newTicket = { ...ticket };
            
            // Remove old attendeeId field if it exists
            delete newTicket.attendeeId;
            
            // Set owner fields
            newTicket.ownerType = 'attendee';
            
            // Use the attendeeId from the mapping based on position
            const correctAttendeeId = attendeeIdMap.get(index);
            if (correctAttendeeId) {
              newTicket.ownerId = correctAttendeeId;
              hasChanges = true;
            } else {
              // Fallback if mapping fails
              newTicket.ownerId = registration.primaryAttendeeId || registration.registrationId;
              console.warn(`Could not find attendeeId for ticket ${index} in registration ${registration.registrationId}`);
            }
            
            return newTicket;
          });
          
          if (hasChanges) {
            // Update the registration
            const updatePath = registration.registrationData ? 'registrationData' : 'registration_data';
            
            await registrationsCollection.updateOne(
              { _id: registration._id },
              { 
                $set: { 
                  [`${updatePath}.tickets`]: updatedTickets,
                  'lastTicketStructureUpdate': new Date(),
                  'ticketStructureUpdateReason': 'Preserved attendeeId from Supabase selectedTickets'
                }
              }
            );
            
            updatedCount++;
            individualCount++;
            
            if (updatedCount <= 5) {
              console.log(`Updated ${registration.confirmationNumber} (INDIVIDUAL):`);
              console.log(`  Mapped ${attendeeIdMap.size} tickets to attendees`);
              const sampleTicket = updatedTickets[0];
              console.log(`  Sample ticket:`, {
                name: sampleTicket.name,
                ownerType: sampleTicket.ownerType,
                ownerId: sampleTicket.ownerId
              });
            }
          }
        } else if (isLodge) {
          // Handle lodge registrations
          let hasChanges = false;
          const updatedTickets = regData.tickets.map((ticket: any) => {
            const newTicket = { ...ticket };
            
            // Remove attendeeId if it exists
            delete newTicket.attendeeId;
            
            // Add new owner fields
            newTicket.ownerType = 'lodge';
            newTicket.ownerId = regData.lodgeDetails?.lodgeId || 
                              regData.lodgeId || 
                              registration.organisationId ||
                              registration.registrationId;
            
            hasChanges = true;
            return newTicket;
          });
          
          if (hasChanges) {
            const updatePath = registration.registrationData ? 'registrationData' : 'registration_data';
            
            await registrationsCollection.updateOne(
              { _id: registration._id },
              { 
                $set: { 
                  [`${updatePath}.tickets`]: updatedTickets,
                  'lastTicketStructureUpdate': new Date(),
                  'ticketStructureUpdateReason': 'Updated lodge ticket ownership'
                }
              }
            );
            
            updatedCount++;
            lodgeCount++;
          }
        }
      } catch (error) {
        console.error(`Error updating registration ${registration._id}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n=== UPDATE COMPLETE ===');
    console.log(`Total registrations updated: ${updatedCount}`);
    console.log(`  - Individual registrations: ${individualCount}`);
    console.log(`  - Lodge registrations: ${lodgeCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Show sample of updated structure
    console.log('\n=== SAMPLE UPDATED STRUCTURES ===');
    
    // Sample individual
    const sampleIndividual = await registrationsCollection.findOne({
      registrationType: { $in: ['individual', 'individuals'] },
      'registrationData.tickets': { $exists: true },
      'lastTicketStructureUpdate': { $exists: true }
    });
    
    if (sampleIndividual) {
      const tickets = sampleIndividual.registrationData?.tickets || sampleIndividual.registration_data?.tickets;
      console.log('\nSample INDIVIDUAL registration tickets:');
      const sampleTickets = Array.isArray(tickets) ? tickets.slice(0, 3) : Object.values(tickets).slice(0, 3);
      console.log(JSON.stringify(sampleTickets, null, 2));
    }
    
    console.log('\n✅ Ticket ownership has been updated with preserved attendee IDs');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the update
if (require.main === module) {
  updateTicketStructurePreserveAttendee().catch(console.error);
}