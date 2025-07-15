import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { SupabaseRegistrationSearchService } from '../services/supabase-registration-search';
import { config } from '../config/environment';
import { createClient } from '@supabase/supabase-js';

interface Ticket {
  eventTicketId: string;
  name: string;
  price: number;
  quantity: number;
  ownerType: string;
  ownerId: string;
}

interface Registration {
  _id: string;
  registrationId: string;
  registrationType: string;
  registrationData: {
    selectedTickets?: Array<{
      id: string;
      price: number;
      isPackage: boolean;
      attendeeId: string;
      event_ticket_id: string;
    }>;
    tickets: Ticket[];
  };
}

async function fetchSelectedTicketsFromSupabase(registrationId: string) {
  const supabase = createClient(config.supabase.url, config.supabase.key);
  
  const { data, error } = await supabase
    .from('registrations')
    .select('registration_data')
    .eq('registration_id', registrationId)
    .single();
  
  if (error) {
    console.error(`Error fetching registration ${registrationId} from Supabase:`, error);
    return null;
  }
  
  const regData = data?.registration_data;
  if (!regData) return null;
  
  // Handle different field name variations
  const tickets = regData.selectedTickets || regData.tickets || null;
  
  if (!tickets || !Array.isArray(tickets)) {
    return null;
  }
  
  // Normalize ticket data to always have attendeeId and eventTicketId
  return tickets.map((ticket: any) => ({
    attendeeId: ticket.attendeeId,
    eventTicketId: ticket.event_ticket_id || ticket.eventTicketId || ticket.ticketDefinitionId,
    originalData: ticket
  }));
}

async function main() {
  console.log('Starting ticket owner ID fix process...');
  
  try {
    const { db } = await connectMongoDB();
    const registrationsCollection = db.collection('registrations');
    
    // Find all individual registrations where tickets have incorrect ownerIds
    const affectedRegistrations = await registrationsCollection.find({
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
    }).toArray();
    
    console.log(`Found ${affectedRegistrations.length} affected registrations`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const registration of affectedRegistrations) {
      console.log(`\nProcessing registration ${registration.registrationId}`);
      
      try {
        // Fetch selectedTickets from Supabase
        const selectedTickets = await fetchSelectedTicketsFromSupabase(registration.registrationId);
        
        if (!selectedTickets || selectedTickets.length === 0) {
          console.log(`No selectedTickets found in Supabase for ${registration.registrationId}`);
          errorCount++;
          continue;
        }
        
        // Update tickets array with correct ownerIds
        // Since tickets might have the same eventTicketId, we map by index
        const updatedTickets = registration.registrationData.tickets.map((ticket: Ticket, index: number) => {
          if (ticket.ownerId === registration.registrationId && index < selectedTickets.length) {
            const correctAttendeeId = selectedTickets[index].attendeeId;
            console.log(`  Fixing ticket ${index + 1} (${ticket.name}): ${ticket.ownerId} -> ${correctAttendeeId}`);
            return {
              ...ticket,
              ownerId: correctAttendeeId
            };
          }
          
          return ticket;
        });
        
        // Check if any tickets were actually updated
        const hasChanges = updatedTickets.some((ticket: Ticket, index: number) => 
          ticket.ownerId !== registration.registrationData.tickets[index].ownerId
        );
        
        if (hasChanges) {
          // Update the registration in MongoDB
          const updateResult = await registrationsCollection.updateOne(
            { _id: registration._id },
            { 
              $set: { 
                'registrationData.tickets': updatedTickets,
                'lastTicketOwnerUpdate': new Date(),
                'ticketOwnerUpdateReason': 'Fixed owner IDs from selectedTickets in Supabase'
              }
            }
          );
          
          if (updateResult.modifiedCount > 0) {
            console.log(`  Successfully updated registration ${registration.registrationId}`);
            successCount++;
          } else {
            console.log(`  Failed to update registration ${registration.registrationId}`);
            errorCount++;
          }
        } else {
          console.log(`  No changes needed for registration ${registration.registrationId}`);
        }
        
      } catch (error) {
        console.error(`Error processing registration ${registration.registrationId}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total affected registrations: ${affectedRegistrations.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Error in main process:', error);
  } finally {
    await disconnectMongoDB();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}