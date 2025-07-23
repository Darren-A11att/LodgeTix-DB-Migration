import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import { roundToTwoDecimals, parsePrice } from '../utils/number-helpers';

interface SelectedTicket {
  id: string;
  price: number;
  isPackage: boolean;
  attendeeId: string;
  event_ticket_id?: string;
  eventTicketId?: string;
  ticketDefinitionId?: string;
  quantity?: number;
  name?: string;
}

interface TransformedTicket {
  eventTicketId: string;
  name: string;
  price: number;
  quantity: number;
  ownerType: 'attendee' | 'lodge';
  ownerId: string;
}

/**
 * Import registrations from Supabase with correct ticket ownership
 * This script ensures that ticket ownerId is set to the attendeeId from selectedTickets
 */
async function importRegistrationsWithCorrectOwnership() {
  console.log('Starting registration import with correct ownership...\n');
  
  const mongoClient = new MongoClient(config.mongodb.uri);
  const supabase = createClient(config.supabase.url, config.supabase.key);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(config.mongodb.database);
    const registrationsCollection = db.collection('registrations');
    const eventTicketsCollection = db.collection('eventTickets');
    
    // Get event tickets for mapping names and prices
    const eventTickets = await eventTicketsCollection.find({}).toArray();
    const ticketMap = new Map();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      ticketMap.set(ticketId, {
        name: ticket.name,
        price: parsePrice(ticket.price),
        description: ticket.description || ''
      });
    });
    
    // Fetch registrations from Supabase
    const { data: registrations, error } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${registrations?.length || 0} registrations in Supabase\n`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const supabaseReg of registrations || []) {
      try {
        const regData = supabaseReg.registration_data;
        
        // Get selectedTickets or tickets from registration data
        const selectedTickets = regData?.selectedTickets || regData?.tickets || [];
        
        // Transform selectedTickets to tickets array with correct ownership
        const transformedTickets: TransformedTicket[] = [];
        
        if (selectedTickets.length > 0) {
          // For individual registrations, each ticket should be owned by its attendeeId
          const isIndividual = supabaseReg.registration_type === 'individuals' || 
                              supabaseReg.registration_type === 'individual';
          
          selectedTickets.forEach((selectedTicket: SelectedTicket) => {
            const eventTicketId = selectedTicket.event_ticket_id || 
                                 selectedTicket.eventTicketId || 
                                 selectedTicket.ticketDefinitionId;
            
            if (!eventTicketId) {
              console.warn(`No event ticket ID found for ticket in registration ${supabaseReg.id}`);
              return;
            }
            
            const ticketInfo = ticketMap.get(eventTicketId) || {};
            const quantity = selectedTicket.quantity || 1;
            
            // For individual registrations, preserve the attendeeId
            // For lodge registrations, use the organisation/lodge ID
            let ownerId: string;
            let ownerType: 'attendee' | 'lodge';
            
            if (isIndividual) {
              ownerType = 'attendee';
              ownerId = selectedTicket.attendeeId; // Preserve the original attendeeId
            } else {
              ownerType = 'lodge';
              ownerId = regData?.lodgeDetails?.lodgeId || 
                       regData?.lodgeId || 
                       supabaseReg.organisation_id ||
                       supabaseReg.id;
            }
            
            transformedTickets.push({
              eventTicketId: eventTicketId,
              name: ticketInfo.name || selectedTicket.name || 'Unknown Ticket',
              price: ticketInfo.price !== undefined ? ticketInfo.price : parsePrice(selectedTicket.price),
              quantity: quantity,
              ownerType: ownerType,
              ownerId: ownerId
            });
          });
        }
        
        // Prepare MongoDB document
        const mongoRegistration = {
          registrationId: supabaseReg.id || supabaseReg.registration_id,
          confirmationNumber: supabaseReg.confirmation_number,
          registrationType: supabaseReg.registration_type,
          functionId: supabaseReg.function_id,
          registrationData: {
            ...regData,
            tickets: transformedTickets, // Use transformed tickets with correct ownership
            // Remove selectedTickets to avoid confusion
            selectedTickets: undefined
          },
          attendeeCount: supabaseReg.attendee_count,
          totalAmountPaid: roundToTwoDecimals(supabaseReg.total_amount_paid),
          paymentStatus: supabaseReg.payment_status,
          stripePaymentIntentId: supabaseReg.stripe_payment_intent_id,
          squarePaymentId: supabaseReg.square_payment_id,
          createdAt: supabaseReg.created_at,
          updatedAt: supabaseReg.updated_at,
          primaryAttendeeId: regData?.attendees?.[0]?.attendeeId || null,
          ...supabaseReg
        };
        
        // Update or insert registration
        const result = await registrationsCollection.replaceOne(
          { registrationId: mongoRegistration.registrationId },
          mongoRegistration,
          { upsert: true }
        );
        
        processedCount++;
        
        if (processedCount <= 5) {
          console.log(`Processed ${mongoRegistration.confirmationNumber}:`);
          console.log(`  Type: ${mongoRegistration.registrationType}`);
          console.log(`  Tickets: ${transformedTickets.length}`);
          if (transformedTickets.length > 0) {
            console.log(`  Sample ticket:`, {
              name: transformedTickets[0].name,
              ownerType: transformedTickets[0].ownerType,
              ownerId: transformedTickets[0].ownerId
            });
          }
        }
        
      } catch (error) {
        errorCount++;
        console.error(`Error processing registration ${supabaseReg.id}:`, error);
      }
    }
    
    console.log('\n=== IMPORT COMPLETE ===');
    console.log(`Total registrations processed: ${processedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Verify the import
    const totalInMongo = await registrationsCollection.countDocuments();
    const withCorrectOwnership = await registrationsCollection.countDocuments({
      'registrationData.tickets': { $exists: true, $ne: [] },
      'registrationData.tickets.ownerId': { $exists: true }
    });
    
    console.log(`\nTotal registrations in MongoDB: ${totalInMongo}`);
    console.log(`Registrations with correct ticket ownership: ${withCorrectOwnership}`);
    
  } catch (error) {
    console.error('Import error:', error);
  } finally {
    await mongoClient.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the import
if (require.main === module) {
  importRegistrationsWithCorrectOwnership().catch(console.error);
}