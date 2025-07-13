const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function updateTicketStructure() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== UPDATING TICKET STRUCTURE TO USE ownerType/ownerId ===\n');
    
    // Get all registrations
    const registrations = await db.collection('registrations').find({}).toArray();
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
        
        let hasChanges = false;
        let updatedTickets;
        
        if (Array.isArray(regData.tickets)) {
          // Handle array format
          updatedTickets = regData.tickets.map(ticket => {
            const newTicket = { ...ticket };
            
            // Remove attendeeId if it exists
            delete newTicket.attendeeId;
            
            // Add new owner fields
            if (isLodge) {
              newTicket.ownerType = 'lodge';
              // Get lodge ID from various possible locations
              newTicket.ownerId = regData.lodgeDetails?.lodgeId || 
                                 regData.lodgeId || 
                                 registration.organisationId ||
                                 registration.registrationId;
            } else {
              newTicket.ownerType = 'attendee';
              // For now, assign to primary attendee - we'll fix this with Supabase data
              newTicket.ownerId = registration.primaryAttendeeId || 
                                registration.registrationId;
            }
            
            hasChanges = true;
            return newTicket;
          });
        } else if (typeof regData.tickets === 'object') {
          // Handle object format (ticket ID as key)
          updatedTickets = {};
          
          for (const [ticketId, ticket] of Object.entries(regData.tickets)) {
            const newTicket = { ...ticket };
            
            // Remove attendeeId if it exists
            delete newTicket.attendeeId;
            
            // Add new owner fields
            if (isLodge) {
              newTicket.ownerType = 'lodge';
              newTicket.ownerId = regData.lodgeDetails?.lodgeId || 
                                 regData.lodgeId || 
                                 registration.organisationId ||
                                 registration.registrationId;
            } else {
              newTicket.ownerType = 'attendee';
              newTicket.ownerId = registration.primaryAttendeeId || 
                                registration.registrationId;
            }
            
            updatedTickets[ticketId] = newTicket;
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          // Update the registration
          const updatePath = registration.registrationData ? 'registrationData' : 'registration_data';
          
          await db.collection('registrations').updateOne(
            { _id: registration._id },
            { 
              $set: { 
                [`${updatePath}.tickets`]: updatedTickets 
              }
            }
          );
          
          updatedCount++;
          if (isLodge) {
            lodgeCount++;
          } else {
            individualCount++;
          }
          
          // Log first few updates
          if (updatedCount <= 5) {
            console.log(`Updated ${registration.confirmationNumber} (${isLodge ? 'LODGE' : 'INDIVIDUAL'}):`);
            const sampleTicket = Array.isArray(updatedTickets) ? updatedTickets[0] : Object.values(updatedTickets)[0];
            console.log(`  Sample ticket:`, {
              name: sampleTicket.name,
              ownerType: sampleTicket.ownerType,
              ownerId: sampleTicket.ownerId
            });
          }
        }
      } catch (error) {
        console.error(`Error updating registration ${registration._id}:`, error.message);
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
    const sampleIndividual = await db.collection('registrations').findOne({
      registrationType: { $in: ['individual', 'individuals'] },
      'registrationData.tickets': { $exists: true }
    });
    
    if (sampleIndividual) {
      const tickets = sampleIndividual.registrationData?.tickets || sampleIndividual.registration_data?.tickets;
      console.log('\nSample INDIVIDUAL registration tickets:');
      const sampleTickets = Array.isArray(tickets) ? tickets.slice(0, 2) : Object.values(tickets).slice(0, 2);
      console.log(JSON.stringify(sampleTickets, null, 2));
    }
    
    // Sample lodge
    const sampleLodge = await db.collection('registrations').findOne({
      registrationType: { $in: ['lodge', 'lodges'] },
      'registrationData.tickets': { $exists: true }
    });
    
    if (sampleLodge) {
      const tickets = sampleLodge.registrationData?.tickets || sampleLodge.registration_data?.tickets;
      console.log('\nSample LODGE registration tickets:');
      const sampleTickets = Array.isArray(tickets) ? tickets.slice(0, 2) : Object.values(tickets).slice(0, 2);
      console.log(JSON.stringify(sampleTickets, null, 2));
    }
    
    console.log('\n⚠️  NOTE: Individual ticket ownership is currently set to primaryAttendeeId');
    console.log('    This will be corrected when we fetch data from Supabase');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

updateTicketStructure().catch(console.error);