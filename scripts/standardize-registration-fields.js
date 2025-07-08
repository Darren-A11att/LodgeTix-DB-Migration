#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlySnakeCase = args.includes('--only-snake-case');
const singleReg = args.find(arg => arg.startsWith('--reg='))?.split('=')[1];

// Field mapping from snake_case to camelCase
const fieldMappings = {
  // Root level fields
  'registration_id': 'registrationId',
  'customer_id': 'customerId',
  'registration_date': 'registrationDate',
  'total_amount_paid': 'totalAmountPaid',
  'total_price_paid': 'totalPricePaid',
  'payment_status': 'paymentStatus',
  'agree_to_terms': 'agreeToTerms',
  'stripe_payment_intent_id': 'stripePaymentIntentId',
  'primary_attendee_id': 'primaryAttendeeId',
  'registration_type': 'registrationType',
  'created_at': 'createdAt',
  'updated_at': 'updatedAt',
  'registration_data': 'registrationData',
  'confirmation_number': 'confirmationNumber',
  'organisation_id': 'organisationId',
  'connected_account_id': 'connectedAccountId',
  'platform_fee_amount': 'platformFeeAmount',
  'platform_fee_id': 'platformFeeId',
  'confirmation_pdf_url': 'confirmationPdfUrl',
  'stripe_fee': 'stripeFee',
  'includes_processing_fee': 'includesProcessingFee',
  'function_id': 'functionId',
  'auth_user_id': 'authUserId',
  'organisation_name': 'organisationName',
  'organisation_number': 'organisationNumber',
  'primary_attendee': 'primaryAttendee',
  'attendee_count': 'attendeeCount',
  'confirmation_generated_at': 'confirmationGeneratedAt',
  'event_id': 'eventId',
  'booking_contact_id': 'bookingContactId',
  'square_payment_id': 'squarePaymentId',
  'square_fee': 'squareFee'
};

// Ticket field standardization
const ticketFieldMappings = {
  'event_ticket_id': 'eventTicketId',
  'ticket_definition_id': 'ticketDefinitionId'
};

async function standardizeRegistrations() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    console.log('Mode:', dryRun ? 'DRY RUN' : 'LIVE UPDATE');
    if (onlySnakeCase) console.log('Processing only snake_case registrations');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const coll = db.collection('registrations');

    // Build query
    let query = {};
    if (singleReg) {
      // Check both confirmationNumber and confirmation_number for single registration
      query = { 
        $or: [
          { confirmationNumber: singleReg },
          { confirmation_number: singleReg }
        ]
      };
    } else if (onlySnakeCase) {
      // Find registrations with snake_case fields
      query = {
        $or: [
          { registration_id: { $exists: true } },
          { registration_type: { $exists: true } },
          { total_amount_paid: { $exists: true } },
          { attendee_count: { $exists: true } },
          { confirmation_number: { $exists: true } }
        ]
      };
    }

    const registrations = await coll.find(query).toArray();
    console.log(`\nFound ${registrations.length} registrations to process`);

    let processedCount = 0;
    let fieldUpdates = 0;
    let ticketUpdates = 0;

    for (const reg of registrations) {
      const updates = {};
      const unsets = {};
      let hasChanges = false;

      // Process root level fields
      for (const [snakeField, camelField] of Object.entries(fieldMappings)) {
        if (reg[snakeField] !== undefined) {
          // If camelCase doesn't exist, add it
          if (reg[camelField] === undefined) {
            updates[camelField] = reg[snakeField];
            fieldUpdates++;
          }
          // Always remove the snake_case field
          unsets[snakeField] = '';
          hasChanges = true;
        }
      }

      // Process ticket fields within registrationData
      if (reg.registrationData || reg.registration_data) {
        const regData = reg.registrationData || reg.registration_data;
        
        // Ensure we use registrationData (camelCase)
        if (reg.registration_data && !reg.registrationData) {
          // We need to handle the entire registrationData object at once
          const newRegData = { ...reg.registration_data };
          
          // Process selectedTickets array if it exists
          if (newRegData.selectedTickets && Array.isArray(newRegData.selectedTickets)) {
            newRegData.selectedTickets = newRegData.selectedTickets.map(ticket => {
              const newTicket = { ...ticket };
              
              // Standardize event_ticket_id to eventTicketId
              if (ticket.event_ticket_id && !ticket.eventTicketId) {
                newTicket.eventTicketId = ticket.event_ticket_id;
                delete newTicket.event_ticket_id;
                ticketUpdates++;
              }

              // Copy ticketDefinitionId to eventTicketId if eventTicketId is missing
              if (ticket.ticketDefinitionId && !newTicket.eventTicketId) {
                newTicket.eventTicketId = ticket.ticketDefinitionId;
                ticketUpdates++;
              }

              // Ensure quantity field exists
              if (!newTicket.quantity) {
                newTicket.quantity = 1;
                ticketUpdates++;
              }

              return newTicket;
            });
          }

          // Ensure 'tickets' field exists in simplified format (for compatibility)
          if (newRegData.selectedTickets && !newRegData.tickets) {
            // Create simplified tickets array
            const ticketMap = new Map();
            
            newRegData.selectedTickets.forEach(ticket => {
              const eventTicketId = ticket.eventTicketId || ticket.event_ticket_id || ticket.ticketDefinitionId;
              if (eventTicketId) {
                if (ticketMap.has(eventTicketId)) {
                  ticketMap.get(eventTicketId).quantity += (ticket.quantity || 1);
                } else {
                  ticketMap.set(eventTicketId, {
                    eventTicketId: eventTicketId,
                    name: ticket.name || 'Unknown Ticket',
                    price: typeof ticket.price === 'object' && ticket.price.$numberDecimal 
                      ? parseFloat(ticket.price.$numberDecimal)
                      : (ticket.price || 0),
                    quantity: ticket.quantity || 1
                  });
                }
              }
            });

            if (ticketMap.size > 0) {
              newRegData.tickets = Array.from(ticketMap.values());
            }
          }
          
          updates.registrationData = newRegData;
          unsets.registration_data = '';
          hasChanges = true;
        } else if (reg.registrationData) {
          // registrationData already exists in camelCase, process tickets within it
          const updatedTickets = [];
          let ticketsModified = false;
          
          if (regData.selectedTickets && Array.isArray(regData.selectedTickets)) {
            regData.selectedTickets.forEach(ticket => {
              const newTicket = { ...ticket };
              let ticketChanged = false;

              // Standardize event_ticket_id to eventTicketId
              if (ticket.event_ticket_id && !ticket.eventTicketId) {
                newTicket.eventTicketId = ticket.event_ticket_id;
                delete newTicket.event_ticket_id;
                ticketChanged = true;
              }

              // Copy ticketDefinitionId to eventTicketId if eventTicketId is missing
              if (ticket.ticketDefinitionId && !newTicket.eventTicketId) {
                newTicket.eventTicketId = ticket.ticketDefinitionId;
                ticketChanged = true;
              }

              // Ensure quantity field exists
              if (!newTicket.quantity) {
                newTicket.quantity = 1;
                ticketChanged = true;
              }

              if (ticketChanged) {
                ticketUpdates++;
                ticketsModified = true;
              }

              updatedTickets.push(newTicket);
            });

            if (ticketsModified) {
              updates['registrationData.selectedTickets'] = updatedTickets;
              hasChanges = true;
            }
          }

          // Ensure 'tickets' field exists in simplified format (for compatibility)
          if (regData.selectedTickets && !regData.tickets) {
            // Create simplified tickets array
            const ticketMap = new Map();
            
            regData.selectedTickets.forEach(ticket => {
              const eventTicketId = ticket.eventTicketId || ticket.event_ticket_id || ticket.ticketDefinitionId;
              if (eventTicketId) {
                if (ticketMap.has(eventTicketId)) {
                  ticketMap.get(eventTicketId).quantity += (ticket.quantity || 1);
                } else {
                  ticketMap.set(eventTicketId, {
                    eventTicketId: eventTicketId,
                    name: ticket.name || 'Unknown Ticket',
                    price: typeof ticket.price === 'object' && ticket.price.$numberDecimal 
                      ? parseFloat(ticket.price.$numberDecimal)
                      : (ticket.price || 0),
                    quantity: ticket.quantity || 1
                  });
                }
              }
            });

            if (ticketMap.size > 0) {
              updates['registrationData.tickets'] = Array.from(ticketMap.values());
              hasChanges = true;
            }
          }
        }
      }

      if (hasChanges) {
        processedCount++;
        
        if (dryRun) {
          console.log(`\n[DRY RUN] Would update ${reg.confirmationNumber || reg.confirmation_number}:`);
          console.log('  Updates:', Object.keys(updates).length, 'fields');
          console.log('  Removals:', Object.keys(unsets).length, 'fields');
          if (Object.keys(updates).length > 0) {
            console.log('  Sample updates:', Object.keys(updates).slice(0, 5).join(', '));
          }
        } else {
          const updateOperation = { $set: updates };
          if (Object.keys(unsets).length > 0) {
            updateOperation.$unset = unsets;
          }

          const result = await coll.updateOne(
            { _id: reg._id },
            updateOperation
          );

          if (result.modifiedCount > 0) {
            console.log(`✓ Updated ${reg.confirmationNumber || reg.confirmation_number}`);
          }
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('STANDARDIZATION SUMMARY');
    console.log('='.repeat(60));
    if (dryRun) {
      console.log('DRY RUN - No actual changes were made');
    }
    console.log(`Total registrations checked: ${registrations.length}`);
    console.log(`Registrations needing updates: ${processedCount}`);
    console.log(`Field updates: ${fieldUpdates}`);
    console.log(`Ticket field updates: ${ticketUpdates}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node standardize-registration-fields.js [options]

Options:
  --dry-run           Preview changes without applying them
  --only-snake-case   Only process registrations with snake_case fields
  --reg=XXX           Process a specific registration by confirmation number
  --help              Show this help message

This script standardizes field naming conventions across all registrations:
- Converts snake_case to camelCase
- Ensures ticket fields use eventTicketId
- Creates simplified 'tickets' array for compatibility
- Adds quantity field to all tickets

Examples:
  node standardize-registration-fields.js --dry-run
  node standardize-registration-fields.js --only-snake-case
  node standardize-registration-fields.js --reg=IND-671599JU
  `);
  process.exit(0);
}

// Run standardization
standardizeRegistrations();