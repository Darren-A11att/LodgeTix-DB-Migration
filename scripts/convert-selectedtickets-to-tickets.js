#!/usr/bin/env node

/**
 * Convert selectedTickets to tickets array format
 * IMPORTANT: This script now PRESERVES attendeeId from selectedTickets
 * - For individual registrations: ownerId = attendeeId from selectedTickets
 * - For lodge registrations: ownerId = lodgeId/organisationId
 */

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { roundToTwoDecimals, parsePrice } = require('./number-helpers');

async function convertSelectedTicketsToTickets() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    // Get event tickets for mapping
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    const ticketMap = new Map();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      ticketMap.set(ticketId, {
        name: ticket.name,
        price: parsePrice(ticket.price),
        description: ticket.description || ''
      });
    });
    
    console.log('\n=== FINDING REGISTRATIONS WITH selectedTickets ===');
    
    // Find all registrations with selectedTickets
    const registrations = await db.collection('registrations').find({
      $or: [
        { 'registrationData.selectedTickets': { $exists: true, $ne: [] } },
        { 'registration_data.selectedTickets': { $exists: true, $ne: [] } }
      ]
    }).toArray();
    
    console.log(`Found ${registrations.length} registrations with selectedTickets`);
    
    // Check how many already have tickets array
    const withBothArrays = registrations.filter(reg => {
      const regData = reg.registrationData || reg.registration_data;
      return regData.tickets && regData.tickets.length > 0;
    });
    
    console.log(`Registrations that already have tickets array: ${withBothArrays.length}`);
    console.log(`Registrations that need conversion: ${registrations.length - withBothArrays.length}`);
    
    console.log('\n=== CONVERSION PLAN ===');
    console.log('This script will:');
    console.log('1. Convert selectedTickets array to tickets array format');
    console.log('2. Handle eventTicketsId (with s) to eventTicketId (without s)');
    console.log('3. Add price, name, and proper structure for each ticket');
    console.log('4. PRESERVE attendeeId from selectedTickets as ownerId for individuals');
    console.log('5. Set ownerType/ownerId based on registration type');
    console.log('6. Remove the selectedTickets array after conversion');
    console.log('7. Skip registrations that already have a tickets array');
    
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    let convertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const registration of registrations) {
      try {
        const regData = registration.registrationData || registration.registration_data;
        
        // Skip if already has tickets array
        if (regData.tickets && regData.tickets.length > 0) {
          skippedCount++;
          continue;
        }
        
        if (regData && regData.selectedTickets && regData.selectedTickets.length > 0) {
          // Convert selectedTickets to tickets format
          const tickets = [];
          
          regData.selectedTickets.forEach(selectedTicket => {
            // Handle both eventTicketsId (with s) and eventTicketId (without s)
            const eventTicketId = selectedTicket.eventTicketsId || selectedTicket.eventTicketId || 
                                 selectedTicket.event_ticket_id || selectedTicket.ticketDefinitionId;
            const ticketInfo = ticketMap.get(eventTicketId) || {};
            const quantity = selectedTicket.quantity || 1;
            
            // Determine owner based on registration type
            const isIndividual = registration.registrationType === 'individuals' || 
                               registration.registrationType === 'individual';
            
            // Create ticket entries based on quantity
            for (let i = 0; i < quantity; i++) {
              const ticket = {
                id: `${registration.registrationId || registration.registration_id}-${eventTicketId}-${i}`,
                price: ticketInfo.price !== undefined ? ticketInfo.price : parsePrice(selectedTicket.price),
                isPackage: false,
                eventTicketId: eventTicketId,
                name: ticketInfo.name || selectedTicket.name || 'Unknown Ticket',
                quantity: 1,
                ownerType: isIndividual ? 'attendee' : 'lodge'
              };
              
              // CRITICAL: Preserve attendeeId for individual registrations
              if (isIndividual) {
                ticket.ownerId = selectedTicket.attendeeId; // Preserve the original attendeeId
              } else {
                // For lodge registrations, use lodge/organisation ID
                ticket.ownerId = regData?.lodgeDetails?.lodgeId || 
                                regData?.lodgeId || 
                                regData?.organisationId ||
                                registration.registrationId || 
                                registration.registration_id;
              }
              
              tickets.push(ticket);
            }
          });
          
          // Update the registration
          const updatePath = registration.registrationData ? 'registrationData' : 'registration_data';
          
          await db.collection('registrations').updateOne(
            { _id: registration._id },
            { 
              $set: { 
                [`${updatePath}.tickets`]: tickets 
              },
              $unset: {
                [`${updatePath}.selectedTickets`]: ""
              }
            }
          );
          
          convertedCount++;
          
          if (convertedCount <= 5) {
            console.log(`\nConverted registration ${registration.confirmationNumber}:`);
            console.log(`  Created ${tickets.length} ticket entries`);
            const summary = {};
            tickets.forEach(t => {
              const key = `${t.name} ($${t.price})`;
              summary[key] = (summary[key] || 0) + 1;
            });
            Object.entries(summary).forEach(([name, count]) => {
              console.log(`  - ${name}: ${count} tickets`);
            });
          }
        }
      } catch (error) {
        console.error(`Error converting registration ${registration._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n=== CONVERSION COMPLETE ===');
    console.log(`Total registrations processed: ${registrations.length}`);
    console.log(`Successfully converted: ${convertedCount}`);
    console.log(`Skipped (already had tickets): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Verify the conversion
    console.log('\n=== VERIFICATION ===');
    
    // Check remaining selectedTickets
    const remainingSelectedTickets = await db.collection('registrations').countDocuments({
      $or: [
        { 'registrationData.selectedTickets': { $exists: true } },
        { 'registration_data.selectedTickets': { $exists: true } }
      ]
    });
    
    console.log(`Remaining registrations with selectedTickets: ${remainingSelectedTickets}`);
    
    // Show a sample converted registration
    if (convertedCount > 0) {
      const convertedReg = await db.collection('registrations').findOne({
        $and: [
          { _id: registrations[0]._id },
          {
            $or: [
              { 'registrationData.tickets': { $exists: true } },
              { 'registration_data.tickets': { $exists: true } }
            ]
          }
        ]
      });
      
      if (convertedReg) {
        const regData = convertedReg.registrationData || convertedReg.registration_data;
        console.log('\nSample converted registration:');
        console.log(`Confirmation: ${convertedReg.confirmationNumber}`);
        console.log(`Tickets array (first 3):`, JSON.stringify(regData.tickets.slice(0, 3), null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the conversion
convertSelectedTicketsToTickets();