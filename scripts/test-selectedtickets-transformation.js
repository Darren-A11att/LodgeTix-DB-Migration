#!/usr/bin/env node

/**
 * Test script to verify selectedTickets transformation
 */

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function testTransformation() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('=== TESTING SELECTEDTICKETS TRANSFORMATION ===\n');
    
    // Sample data with selectedTickets format
    const sampleData = {
      selectedTickets: [
        {
          "id": "01985ae7-8dfd-715f-900b-87399e53aebd-be94ef03-6647-48d5-97ea-f98c862e30e6",
          "price": 0,
          "isPackage": false,
          "attendeeId": "01985ae7-8dfd-715f-900b-87399e53aebd",
          "event_ticket_id": "be94ef03-6647-48d5-97ea-f98c862e30e6"
        },
        {
          "id": "01985ae7-8dfd-715f-900b-87399e53aebd-b8a1ef1f-5f53-4544-af7b-901756b9ba7d",
          "price": 0,
          "isPackage": false,
          "attendeeId": "01985ae7-8dfd-715f-900b-87399e53aebd",
          "event_ticket_id": "b8a1ef1f-5f53-4544-af7b-901756b9ba7d"
        },
        {
          "id": "01985ae7-8dfd-715f-900b-87399e53aebd-7196514b-d4b8-4fe0-93ac-deb4c205dd09",
          "price": 20,
          "isPackage": false,
          "attendeeId": "01985ae7-8dfd-715f-900b-87399e53aebd",
          "event_ticket_id": "7196514b-d4b8-4fe0-93ac-deb4c205dd09"
        }
      ]
    };
    
    console.log('Input data (selectedTickets):', JSON.stringify(sampleData.selectedTickets, null, 2));
    
    // Transform the data
    const transformed = await transformRegistrationData(sampleData, 'individual', db);
    
    console.log('\nTransformed data (tickets):', JSON.stringify(transformed.tickets, null, 2));
    console.log('\nselectedTickets removed:', !transformed.selectedTickets);
    
    // Verify transformation
    console.log('\n=== VERIFICATION ===');
    console.log(`Number of tickets created: ${transformed.tickets.length}`);
    console.log(`All tickets have eventTicketId: ${transformed.tickets.every(t => t.eventTicketId)}`);
    console.log(`All tickets have ownerId: ${transformed.tickets.every(t => t.ownerId)}`);
    console.log(`All tickets have ownerType: ${transformed.tickets.every(t => t.ownerType)}`);
    console.log(`All tickets have status: ${transformed.tickets.every(t => t.status)}`);
    
    // Check a recent import
    console.log('\n=== CHECKING RECENT IMPORTS ===');
    const recentImport = await db.collection('registration_imports').findOne(
      { 'registrationData.selectedTickets': { $exists: true } },
      { sort: { importedAt: -1 } }
    );
    
    if (recentImport) {
      console.log(`Found recent import with selectedTickets: ${recentImport.confirmationNumber}`);
      console.log(`Has tickets array: ${!!recentImport.registrationData?.tickets}`);
      console.log(`Number of selectedTickets: ${recentImport.registrationData?.selectedTickets?.length || 0}`);
      console.log(`Number of tickets: ${recentImport.registrationData?.tickets?.length || 0}`);
    } else {
      console.log('No recent imports found with selectedTickets');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await client.close();
  }
}

/**
 * Transform registration data from Supabase format to MongoDB format
 * Converts selectedTickets to tickets array with proper ownership
 */
async function transformRegistrationData(registrationData, registrationType, db) {
  if (!registrationData) return registrationData;
  
  // If registrationData has selectedTickets, transform them to tickets
  if (registrationData.selectedTickets && registrationData.selectedTickets.length > 0 && (!registrationData.tickets || registrationData.tickets.length === 0)) {
    // Get event tickets for mapping names and prices
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    const ticketMap = new Map();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      // Handle MongoDB Decimal128 type
      let price = 0;
      if (ticket.price) {
        if (ticket.price.$numberDecimal) {
          price = parseFloat(ticket.price.$numberDecimal);
        } else if (ticket.price.toString) {
          // Handle Decimal128 object
          price = parseFloat(ticket.price.toString());
        } else {
          price = parsePrice(ticket.price);
        }
      }
      
      ticketMap.set(ticketId, {
        name: ticket.name,
        price: price,
        description: ticket.description || ''
      });
    });
    
    // Convert selectedTickets to tickets format
    const tickets = [];
    
    registrationData.selectedTickets.forEach(selectedTicket => {
      // Handle both eventTicketsId (with s) and eventTicketId (without s)
      const eventTicketId = selectedTicket.event_ticket_id || selectedTicket.eventTicketId || 
                           selectedTicket.eventTicketsId || selectedTicket.ticketDefinitionId;
      const ticketInfo = ticketMap.get(eventTicketId) || {};
      const quantity = selectedTicket.quantity || 1;
      
      // Determine owner based on registration type
      const isIndividual = registrationType === 'individuals' || 
                         registrationType === 'individual';
      
      // Create ticket entries based on quantity
      for (let i = 0; i < quantity; i++) {
        const ticket = {
          eventTicketId: eventTicketId,
          name: ticketInfo.name || selectedTicket.name || 'Unknown Ticket',
          price: ticketInfo.price !== undefined ? ticketInfo.price : parsePrice(selectedTicket.price),
          quantity: 1,
          ownerType: isIndividual ? 'attendee' : 'lodge',
          status: 'sold'
        };
        
        // CRITICAL: Preserve attendeeId for individual registrations
        if (isIndividual && selectedTicket.attendeeId) {
          ticket.ownerId = selectedTicket.attendeeId; // Preserve the original attendeeId
        } else {
          // For lodge registrations, use lodge/organisation ID
          ticket.ownerId = registrationData?.lodgeDetails?.lodgeId || 
                          registrationData?.lodgeId || 
                          registrationData?.organisationId ||
                          registrationData?.registrationId || 
                          registrationData?.registration_id;
        }
        
        tickets.push(ticket);
      }
    });
    
    // Create a new object with tickets and without selectedTickets
    const transformedData = { ...registrationData };
    transformedData.tickets = tickets;
    delete transformedData.selectedTickets;
    
    return transformedData;
  }
  
  return registrationData;
}

/**
 * Parse price value (handle various formats)
 */
function parsePrice(price) {
  if (price === null || price === undefined) return 0;
  if (typeof price === 'number') return price;
  if (typeof price === 'string') {
    const cleaned = price.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
  return 0;
}

// Run the test
testTransformation();