import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Enhanced version of ticket quantity fix that handles edge cases better
 * - Position-based mapping when attendeeId is not in selectedTickets
 * - Handles cases where there are more tickets than attendees
 * - Better attendee assignment logic
 */
async function fixTicketQuantityExpansionV2() {
  const mongoClient = new MongoClient(config.mongodb.uri);
  const supabase = createClient(config.supabase.url, config.supabase.key);
  
  // Initialize output tracking
  const fixResults: any[] = [];
  const errors: any[] = [];
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(config.mongodb.database);
    const registrationsCollection = db.collection('registrations');
    
    console.log('=== FIXING TICKET QUANTITY EXPANSION (V2) ===\n');
    
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
    let partialFixCount = 0;
    
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
          errors.push({
            registrationId: registration.registrationId,
            confirmationNumber: registration.confirmationNumber,
            error: 'Supabase fetch error',
            message: error.message
          });
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
        
        // Calculate total tickets needed
        const totalTicketsNeeded = selectedTickets.reduce((sum: number, ticket: any) => 
          sum + (ticket.quantity || 1), 0
        );
        
        console.log(`  Total tickets needed: ${totalTicketsNeeded}`);
        
        // Build attendee ID mapping
        const attendeeIdMap = new Map<number, string>();
        attendees.forEach((attendee: any, index: number) => {
          const attendeeId = attendee.attendeeId || attendee.id || `attendee-${index}`;
          attendeeIdMap.set(index, attendeeId);
        });
        
        // Create properly expanded tickets array
        const expandedTickets: any[] = [];
        let globalTicketIndex = 0;
        
        for (const selectedTicket of selectedTickets) {
          const quantity = selectedTicket.quantity || 1;
          const eventTicketId = selectedTicket.event_ticket_id || 
                              selectedTicket.eventTicketId || 
                              selectedTicket.ticketDefinitionId ||
                              selectedTicket.eventTicketsId;
          
          const ticketName = selectedTicket.name || 
                           selectedTicket.ticketName || 
                           selectedTicket.ticket_name || 
                           'Event Ticket';
          
          // Check if this selectedTicket has an attendeeId (position-based mapping)
          const hasAttendeeIdInTicket = !!selectedTicket.attendeeId;
          
          // For each quantity, create a separate ticket entry
          for (let i = 0; i < quantity; i++) {
            let assignedAttendeeId: string | undefined;
            
            if (hasAttendeeIdInTicket) {
              // Use the attendeeId from selectedTicket
              assignedAttendeeId = selectedTicket.attendeeId;
            } else {
              // Use position-based mapping
              const attendeeIndex = globalTicketIndex % attendees.length;
              assignedAttendeeId = attendeeIdMap.get(attendeeIndex);
              
              if (!assignedAttendeeId && attendees[attendeeIndex]) {
                // Fallback to creating ID from attendee data
                const attendee = attendees[attendeeIndex];
                assignedAttendeeId = attendee.attendeeId || 
                                   attendee.id || 
                                   `${registration.registrationId}-attendee-${attendeeIndex}`;
              }
            }
            
            // Final fallback
            if (!assignedAttendeeId) {
              assignedAttendeeId = registration.primaryAttendeeId || 
                                 registration.registrationId || 
                                 `${registration.registrationId}-ticket-${globalTicketIndex}`;
            }
            
            const expandedTicket = {
              eventTicketId: eventTicketId,
              name: ticketName,
              price: selectedTicket.price || 0,
              quantity: 1, // Always 1 for individual registrations
              ownerType: 'attendee',
              ownerId: assignedAttendeeId,
              // Add metadata for tracking
              originalQuantity: quantity,
              originalTicketIndex: selectedTickets.indexOf(selectedTicket),
              expandedIndex: i
            };
            
            expandedTickets.push(expandedTicket);
            globalTicketIndex++;
          }
        }
        
        console.log(`  ✓ Expanded to ${expandedTickets.length} individual tickets`);
        
        // Validate the expansion
        let isPartialFix = false;
        if (totalTicketsNeeded > attendees.length) {
          console.log(`  ⚠️  Warning: Need ${totalTicketsNeeded} tickets but only ${attendees.length} attendees`);
          console.log(`     Some tickets will share the same attendee ID`);
          isPartialFix = true;
        }
        
        // Compare with current tickets
        const currentRegData = registration.registrationData || registration.registration_data;
        const currentTickets = currentRegData?.tickets || [];
        const currentTicketCount = currentTickets.length;
        
        console.log(`  Current: ${currentTicketCount} tickets`);
        console.log(`  After fix: ${expandedTickets.length} tickets`);
        
        // Update the registration
        const updatePath = registration.registrationData ? 'registrationData' : 'registration_data';
        
        const updateResult = await registrationsCollection.updateOne(
          { _id: registration._id },
          { 
            $set: { 
              [`${updatePath}.tickets`]: expandedTickets.map(ticket => {
                // Remove tracking metadata before saving
                const { originalQuantity, originalTicketIndex, expandedIndex, ...cleanTicket } = ticket;
                return cleanTicket;
              }),
              'lastTicketQuantityFix': new Date(),
              'ticketQuantityFixReason': isPartialFix ? 
                'Expanded tickets (partial fix - more tickets than attendees)' : 
                'Expanded tickets with quantity > 1 to individual tickets',
              'ticketQuantityFixMetadata': {
                totalTicketsNeeded,
                attendeeCount: attendees.length,
                wasPartialFix: isPartialFix
              }
            }
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          fixedCount++;
          if (isPartialFix) partialFixCount++;
          ticketsExpanded += (expandedTickets.length - currentTicketCount);
          console.log(`  ✅ Successfully fixed registration ${isPartialFix ? '(partial)' : ''}`);
          
          // Track fix results
          const ownerDistribution = new Map<string, number>();
          expandedTickets.forEach(ticket => {
            ownerDistribution.set(ticket.ownerId, (ownerDistribution.get(ticket.ownerId) || 0) + 1);
          });
          
          fixResults.push({
            registrationId: registration.registrationId,
            confirmationNumber: registration.confirmationNumber,
            status: 'fixed',
            isPartialFix,
            before: {
              ticketCount: currentTicketCount,
              ticketsWithHighQuantity: currentTickets.filter((t: any) => t.quantity > 1).length
            },
            after: {
              ticketCount: expandedTickets.length,
              allQuantityOne: true
            },
            attendeeCount: attendees.length,
            ticketDistribution: Object.fromEntries(ownerDistribution),
            metadata: {
              totalTicketsNeeded,
              wasPartialFix: isPartialFix
            }
          });
          
          // Show distribution for first few
          if (fixedCount <= 3) {
            console.log(`  Ticket distribution:`);
            let attendeeNum = 1;
            ownerDistribution.forEach((count, ownerId) => {
              console.log(`    Attendee ${attendeeNum}: ${count} tickets (ID: ${ownerId})`);
              attendeeNum++;
            });
          }
        } else {
          console.log(`  ⚠️  No changes made`);
          fixResults.push({
            registrationId: registration.registrationId,
            confirmationNumber: registration.confirmationNumber,
            status: 'unchanged',
            reason: 'No modifications needed'
          });
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing registration: ${error}`);
        errorCount++;
        errors.push({
          registrationId: registration.registrationId,
          confirmationNumber: registration.confirmationNumber,
          error: 'Processing error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('FIX COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total registrations processed: ${problematicRegistrations.length}`);
    console.log(`Successfully fixed: ${fixedCount}`);
    console.log(`  - Complete fixes: ${fixedCount - partialFixCount}`);
    console.log(`  - Partial fixes: ${partialFixCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total tickets expanded: ${ticketsExpanded}`);
    
    // Verify the fix
    let verifyCount = 0;
    let partialFixStats = 0;
    
    if (fixedCount > 0) {
      console.log('\n=== VERIFICATION ===');
      
      verifyCount = await registrationsCollection.countDocuments({
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
      
      // Show statistics about partial fixes
      partialFixStats = await registrationsCollection.countDocuments({
        'ticketQuantityFixMetadata.wasPartialFix': true
      });
      
      console.log(`Registrations with partial fixes (more tickets than attendees): ${partialFixStats}`);
    }
    
    // Save results to JSON
    const outputDir = path.join(process.cwd(), 'script-outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `ticket-quantity-fix-results-${timestamp}.json`);
    
    const output = {
      timestamp: new Date().toISOString(),
      summary: {
        totalProcessed: problematicRegistrations.length,
        successfullyFixed: fixedCount,
        completeFixes: fixedCount - partialFixCount,
        partialFixes: partialFixCount,
        unchanged: fixResults.filter(r => r.status === 'unchanged').length,
        errors: errorCount,
        totalTicketsExpanded: ticketsExpanded
      },
      fixResults: fixResults,
      errors: errors,
      verification: {
        remainingWithQuantityGt1: verifyCount || 0,
        registrationsWithPartialFixes: partialFixStats || 0
      }
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\n✅ Fix results saved to: ${outputFile}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the fix
if (require.main === module) {
  fixTicketQuantityExpansionV2().catch(console.error);
}

export { fixTicketQuantityExpansionV2 };