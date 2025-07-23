#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function sumBanquetTicketsFromJSON() {
  const BANQUET_TICKET_ID = 'fd12d7f0-f346-49bf-b1eb-0682ad226216';
  const jsonPath = path.join(__dirname, '../supabase-ticket-analysis/all-tickets.json');

  try {
    // Read the JSON file
    console.log(`Reading tickets from: ${jsonPath}`);
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(jsonContent);

    // Extract tickets array
    const allTickets = data.tickets || data || [];
    console.log(`Total ticket entries in file: ${allTickets.length}`);

    // Filter and sum Proclamation Banquet tickets
    let totalBanquetQuantity = 0;
    let banquetTicketCount = 0;
    let registrationsWithBanquet = new Set();

    allTickets.forEach(item => {
      // Handle nested structure where ticket is inside an object
      const ticket = item.ticket || item;
      
      if (ticket.eventTicketId === BANQUET_TICKET_ID || 
          ticket.event_ticket_id === BANQUET_TICKET_ID) {
        
        const quantity = ticket.quantity || 1;
        totalBanquetQuantity += quantity;
        banquetTicketCount++;
        
        // Track unique registrations
        const regId = item.registrationId || ticket.registrationId || ticket.registration_id;
        if (regId) {
          registrationsWithBanquet.add(regId);
        }
      }
    });

    console.log('\n=== Proclamation Banquet Ticket Summary ===');
    console.log(`Event Ticket ID: ${BANQUET_TICKET_ID}`);
    console.log(`Total quantity (sum of all quantities): ${totalBanquetQuantity}`);
    console.log(`Number of ticket entries: ${banquetTicketCount}`);
    console.log(`Unique registrations with this ticket: ${registrationsWithBanquet.size}`);

    // Show breakdown by quantity
    const quantityBreakdown = {};
    allTickets.forEach(item => {
      const ticket = item.ticket || item;
      if (ticket.eventTicketId === BANQUET_TICKET_ID || 
          ticket.event_ticket_id === BANQUET_TICKET_ID) {
        const qty = ticket.quantity || 1;
        quantityBreakdown[qty] = (quantityBreakdown[qty] || 0) + 1;
      }
    });

    console.log('\n=== Quantity Breakdown ===');
    Object.keys(quantityBreakdown).sort((a, b) => Number(a) - Number(b)).forEach(qty => {
      console.log(`Quantity ${qty}: ${quantityBreakdown[qty]} tickets`);
    });

    // Check file metadata
    const stats = fs.statSync(jsonPath);
    console.log(`\n=== File Info ===`);
    console.log(`Last modified: ${stats.mtime}`);
    console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('Error:', error.message);
    if (error.code === 'ENOENT') {
      console.error(`File not found: ${jsonPath}`);
    }
  }
}

// Run the script
sumBanquetTicketsFromJSON();