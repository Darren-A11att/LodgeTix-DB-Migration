#!/usr/bin/env node

/**
 * Update ticket structure to use ownerType/ownerId
 * IMPORTANT: This script now PRESERVES attendeeId from selectedTickets by fetching from Supabase
 * - For individual registrations: ownerId = attendeeId from selectedTickets (fetched from Supabase)
 * - For lodge registrations: ownerId = lodgeId/organisationId
 */

const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function updateTicketStructure() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== UPDATING TICKET STRUCTURE TO USE ownerType/ownerId ===\n');
    console.log('IMPORTANT: This script now preserves attendeeId from Supabase\n');
    
    // Get all registrations
    const registrations = await db.collection('registrations').find({}).toArray();
    console.log(`Found ${registrations.length} total registrations\n`);
    
    let updatedCount = 0;
    let individualCount = 0;
    let lodgeCount = 0;
    let errorCount = 0;
    let preservedAttendeeCount = 0;
    
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
        let ticketToAttendeeMap = new Map();
        
        // For individual registrations, fetch original selectedTickets from Supabase
        if (!isLodge && registration.registrationType === 'individuals') {
          try {
            const { data: supabaseReg, error } = await supabase
              .from('registrations')
              .select('registration_data')
              .eq('registration_id', registration.registrationId || registration.registration_id)
              .single();
            
            if (error) {
              console.warn(`Could not fetch Supabase data for ${registration.registrationId}: ${error.message}`);
            } else if (supabaseReg?.registration_data) {
              const selectedTickets = supabaseReg.registration_data.selectedTickets || 
                                    supabaseReg.registration_data.tickets || [];
              
              // Build ticket to attendee mapping
              selectedTickets.forEach((ticket) => {
                const eventTicketId = ticket.event_ticket_id || 
                                    ticket.eventTicketId || 
                                    ticket.ticketDefinitionId ||
                                    ticket.eventTicketsId;
                if (eventTicketId && ticket.attendeeId) {
                  ticketToAttendeeMap.set(eventTicketId, ticket.attendeeId);
                }
              });
              
              if (ticketToAttendeeMap.size > 0) {
                preservedAttendeeCount++;
              }
            }
          } catch (err) {
            console.warn(`Error fetching Supabase data: ${err.message}`);
          }
        }
        
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
              
              // CRITICAL: Use attendeeId from mapping if available
              const attendeeIdFromMapping = ticketToAttendeeMap.get(ticket.eventTicketId);
              if (attendeeIdFromMapping) {
                newTicket.ownerId = attendeeIdFromMapping; // Preserve the original attendeeId
              } else {
                // Fallback to primary attendee only if mapping not found
                newTicket.ownerId = registration.primaryAttendeeId || 
                                  registration.registrationId;
              }
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
              
              // CRITICAL: Use attendeeId from mapping if available
              const attendeeIdFromMapping = ticketToAttendeeMap.get(ticket.eventTicketId);
              if (attendeeIdFromMapping) {
                newTicket.ownerId = attendeeIdFromMapping; // Preserve the original attendeeId
              } else {
                // Fallback to primary attendee only if mapping not found
                newTicket.ownerId = registration.primaryAttendeeId || 
                                  registration.registrationId;
              }
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
                [`${updatePath}.tickets`]: updatedTickets,
                'lastTicketStructureUpdate': new Date(),
                'ticketStructureUpdateReason': ticketToAttendeeMap.size > 0 ? 
                  'Updated with preserved attendeeId from Supabase' : 
                  'Updated without Supabase data'
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
            if (ticketToAttendeeMap.size > 0) {
              console.log(`  ✅ Preserved ${ticketToAttendeeMap.size} attendeeIds from Supabase`);
            }
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
    console.log(`  - Individuals with preserved attendeeIds: ${preservedAttendeeCount}`);
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
    
    console.log('\n✅ Individual ticket ownership has been updated with preserved attendeeIds from Supabase');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Add command line options
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node update-ticket-structure-owner.js [options]

Options:
  --help     Show this help message

This script updates ticket structure to use ownerType/ownerId while preserving attendeeId.
- Fetches original selectedTickets from Supabase for individual registrations
- Preserves attendeeId as ownerId for individual tickets
- Sets lodge/organisation ID as ownerId for lodge tickets
  `);
  process.exit(0);
}

updateTicketStructure().catch(console.error);