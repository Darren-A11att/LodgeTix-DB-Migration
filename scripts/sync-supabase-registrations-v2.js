#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function getLastSyncDate(db) {
  try {
    const syncTracker = await db.collection('sync_tracker').findOne({ type: 'registrations' });
    return syncTracker ? new Date(syncTracker.lastSyncDate) : null;
  } catch (error) {
    console.log('No sync tracker found, will sync all registrations');
    return null;
  }
}

async function updateLastSyncDate(db, date) {
  await db.collection('sync_tracker').updateOne(
    { type: 'registrations' },
    { $set: { type: 'registrations', lastSyncDate: date, updatedAt: new Date() } },
    { upsert: true }
  );
}

/**
 * Transform selectedTickets to tickets array with correct ownership
 */
async function transformTickets(regData, registrationType, registrationId, eventTicketMap) {
  const selectedTickets = regData?.selectedTickets || regData?.tickets || [];
  
  if (!selectedTickets || selectedTickets.length === 0) {
    return [];
  }
  
  const transformedTickets = [];
  const isIndividual = registrationType === 'individuals' || registrationType === 'individual';
  
  for (const selectedTicket of selectedTickets) {
    const eventTicketId = selectedTicket.event_ticket_id || 
                         selectedTicket.eventTicketId || 
                         selectedTicket.ticketDefinitionId ||
                         selectedTicket.eventTicketsId; // handle with 's'
    
    if (!eventTicketId) {
      console.warn(`No event ticket ID found for ticket in registration ${registrationId}`);
      continue;
    }
    
    const ticketInfo = eventTicketMap.get(eventTicketId) || {};
    const quantity = selectedTicket.quantity || 1;
    
    // For individual registrations, ensure proper ticket expansion with correct attendee assignment
    if (isIndividual) {
      // Get attendees for position-based mapping if needed
      const attendees = regData?.attendees || [];
      const hasAttendeeIdInTicket = !!selectedTicket.attendeeId;
      
      for (let i = 0; i < quantity; i++) {
        let assignedAttendeeId;
        
        if (hasAttendeeIdInTicket) {
          // Use the attendeeId from selectedTicket
          assignedAttendeeId = selectedTicket.attendeeId;
        } else if (attendees.length > 0) {
          // Use position-based mapping
          const totalPreviousTickets = transformedTickets.length;
          const attendeeIndex = totalPreviousTickets % attendees.length;
          const attendee = attendees[attendeeIndex];
          assignedAttendeeId = attendee?.attendeeId || attendee?.id;
        }
        
        // Fallback
        if (!assignedAttendeeId) {
          assignedAttendeeId = regData?.primaryAttendee?.attendeeId || 
                             regData?.attendees?.[0]?.attendeeId ||
                             registrationId;
        }
        
        const ticket = {
          eventTicketId: eventTicketId,
          name: ticketInfo.name || selectedTicket.name || 'Unknown Ticket',
          price: ticketInfo.price || selectedTicket.price || 0,
          quantity: 1, // Always 1 for individual registrations
          ownerType: 'attendee',
          ownerId: assignedAttendeeId
        };
        
        transformedTickets.push(ticket);
      }
    } else {
      // For lodge registrations, can keep quantity > 1
      const ticket = {
        eventTicketId: eventTicketId,
        name: ticketInfo.name || selectedTicket.name || 'Unknown Ticket',
        price: ticketInfo.price || selectedTicket.price || 0,
        quantity: quantity, // Can be > 1 for lodges
        ownerType: 'lodge',
        ownerId: regData?.lodgeDetails?.lodgeId || 
                regData?.lodgeId || 
                regData?.organisationId ||
                registrationId
      };
      
      transformedTickets.push(ticket);
    }
  }
  
  return transformedTickets;
}

async function syncRegistrations() {
  const mongoClient = new MongoClient(process.env.MONGODB_URI);

  try {
    await mongoClient.connect();
    console.log('Connected to MongoDB');

    const db = mongoClient.db(process.env.MONGODB_DB || 'lodgetix');
    const registrationsCollection = db.collection('registrations');
    const eventTicketsCollection = db.collection('eventTickets');

    // Get event tickets for mapping
    console.log('Loading event tickets for mapping...');
    const eventTickets = await eventTicketsCollection.find({}).toArray();
    const eventTicketMap = new Map();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      eventTicketMap.set(ticketId, {
        name: ticket.name,
        price: parseFloat(ticket.price?.$numberDecimal || ticket.price || 0),
        description: ticket.description || ''
      });
    });
    console.log(`Loaded ${eventTicketMap.size} event tickets`);

    // Get the last sync date
    const lastSyncDate = await getLastSyncDate(db);
    console.log('Last sync date:', lastSyncDate || 'Never synced before');

    // Build query for new/updated registrations
    let query = supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (lastSyncDate) {
      query = query.or(`created_at.gt.${lastSyncDate.toISOString()},updated_at.gt.${lastSyncDate.toISOString()}`);
    }

    // Fetch registrations from Supabase
    console.log('\nFetching registrations from Supabase...');
    const { data: registrations, error } = await query;

    if (error) {
      console.error('Error fetching registrations:', error);
      return;
    }

    console.log(`Found ${registrations.length} registrations to sync`);

    if (registrations.length === 0) {
      console.log('No new registrations to sync');
      return;
    }

    // Process and insert/update registrations
    let inserted = 0;
    let updated = 0;
    let errors = 0;
    let ticketsTransformed = 0;

    for (const reg of registrations) {
      try {
        const regData = reg.registration_data || {};
        
        // Transform selectedTickets to tickets with correct ownership
        const transformedTickets = await transformTickets(
          regData,
          reg.registration_type,
          reg.id || reg.registration_id,
          eventTicketMap
        );
        
        if (transformedTickets.length > 0) {
          ticketsTransformed++;
        }
        
        // Build MongoDB document with transformed tickets
        const mongoRegistration = {
          registrationId: reg.id || reg.registration_id,
          confirmationNumber: reg.confirmation_number,
          registrationType: reg.registration_type,
          functionId: reg.function_id,
          registrationData: {
            ...regData,
            tickets: transformedTickets, // Use transformed tickets
            // Remove selectedTickets to avoid confusion
            selectedTickets: undefined
          },
          attendeeCount: reg.attendee_count,
          totalAmountPaid: reg.total_amount_paid,
          paymentStatus: reg.payment_status,
          stripePaymentIntentId: reg.stripe_payment_intent_id,
          squarePaymentId: reg.square_payment_id,
          createdAt: reg.created_at,
          updatedAt: reg.updated_at,
          primaryAttendeeId: regData?.attendees?.[0]?.attendeeId || null,
          // Add tracking fields
          lastTicketTransform: new Date(),
          ticketTransformReason: 'Sync with preserved attendeeId ownership'
        };

        // Check if registration already exists
        const existingReg = await registrationsCollection.findOne({
          $or: [
            { registrationId: mongoRegistration.registrationId },
            { confirmationNumber: mongoRegistration.confirmationNumber }
          ]
        });

        if (existingReg) {
          // Update existing registration
          const result = await registrationsCollection.updateOne(
            { _id: existingReg._id },
            { $set: mongoRegistration }
          );
          if (result.modifiedCount > 0) {
            updated++;
            console.log(`Updated registration: ${mongoRegistration.confirmationNumber} (${transformedTickets.length} tickets)`);
          }
        } else {
          // Insert new registration
          await registrationsCollection.insertOne(mongoRegistration);
          inserted++;
          console.log(`Inserted new registration: ${mongoRegistration.confirmationNumber} (${transformedTickets.length} tickets)`);
        }
        
        // Log sample transformation for first few
        if ((inserted + updated) <= 3 && transformedTickets.length > 0) {
          console.log(`  Sample ticket:`, {
            name: transformedTickets[0].name,
            ownerType: transformedTickets[0].ownerType,
            ownerId: transformedTickets[0].ownerId
          });
        }
        
      } catch (error) {
        errors++;
        console.error(`Error processing registration ${reg.id}:`, error);
      }
    }

    // Update sync tracker with current timestamp
    await updateLastSyncDate(db, new Date());

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('SYNC SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total registrations processed: ${registrations.length}`);
    console.log(`New registrations inserted: ${inserted}`);
    console.log(`Existing registrations updated: ${updated}`);
    console.log(`Registrations with tickets transformed: ${ticketsTransformed}`);
    console.log(`Errors: ${errors}`);
    console.log('='.repeat(50));

    // Verify current count
    const totalCount = await registrationsCollection.countDocuments();
    const withTickets = await registrationsCollection.countDocuments({
      'registrationData.tickets': { $exists: true, $ne: [] }
    });
    console.log(`\nTotal registrations in MongoDB: ${totalCount}`);
    console.log(`Registrations with tickets: ${withTickets}`);

  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    await mongoClient.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Add command line options
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node sync-supabase-registrations-v2.js [options]

Options:
  --reset    Reset sync tracker and sync all registrations
  --help     Show this help message

This script syncs registrations from Supabase to MongoDB with correct ticket ownership.
- Preserves attendeeId from selectedTickets as ownerId for individual registrations
- Sets lodge/organisation ID as ownerId for lodge registrations
- Transforms selectedTickets to tickets array format
  `);
  process.exit(0);
}

if (args.includes('--reset')) {
  console.log('Resetting sync tracker...');
  const mongoClient = new MongoClient(process.env.MONGODB_URI);
  mongoClient.connect().then(async () => {
    const db = mongoClient.db(process.env.MONGODB_DB || 'lodgetix');
    await db.collection('sync_tracker').deleteOne({ type: 'registrations' });
    console.log('Sync tracker reset. Will sync all registrations.');
    await mongoClient.close();
    syncRegistrations();
  });
} else {
  syncRegistrations();
}