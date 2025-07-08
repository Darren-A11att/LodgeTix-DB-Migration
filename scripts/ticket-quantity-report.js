#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function generateTicketQuantityReport() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    console.log('Generating Ticket Quantity Report...\n');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const registrationsCollection = db.collection('registrations');
    const eventTicketsCollection = db.collection('eventTickets');

    // Get all event tickets for reference
    const eventTickets = await eventTicketsCollection.find({}).toArray();
    const ticketMap = new Map();
    eventTickets.forEach(ticket => {
      const id = ticket.eventTicketId || ticket.event_ticket_id;
      ticketMap.set(id, {
        name: ticket.name,
        price: ticket.price?.$numberDecimal || ticket.price || 0
      });
    });

    // Aggregate ticket quantities from individual registrations
    const ticketSales = new Map();

    const individualRegs = await registrationsCollection.find({
      $or: [
        { registrationType: 'individuals' },
        { registration_type: 'individuals' }
      ]
    }).toArray();

    individualRegs.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      if (regData && regData.selectedTickets) {
        regData.selectedTickets.forEach(ticket => {
          const ticketId = ticket.event_ticket_id || ticket.eventTicketId;
          const quantity = ticket.quantity || 1; // Default to 1 if not set
          
          if (!ticketSales.has(ticketId)) {
            ticketSales.set(ticketId, {
              name: ticket.name || ticketMap.get(ticketId)?.name || 'Unknown',
              price: parseFloat(ticket.price?.$numberDecimal || ticket.price || ticketMap.get(ticketId)?.price || 0),
              totalQuantity: 0,
              registrationCount: 0,
              revenue: 0
            });
          }
          
          const sales = ticketSales.get(ticketId);
          sales.totalQuantity += quantity;
          sales.revenue += sales.price * quantity;
        });
        
        // Count unique registrations per ticket
        const uniqueTickets = new Set();
        regData.selectedTickets.forEach(ticket => {
          const ticketId = ticket.event_ticket_id || ticket.eventTicketId;
          uniqueTickets.add(ticketId);
        });
        
        uniqueTickets.forEach(ticketId => {
          if (ticketSales.has(ticketId)) {
            ticketSales.get(ticketId).registrationCount++;
          }
        });
      }
    });

    // Sort by total quantity sold
    const sortedSales = Array.from(ticketSales.entries())
      .map(([id, data]) => ({ ticketId: id, ...data }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    // Display report
    console.log('='.repeat(80));
    console.log('TICKET SALES REPORT - INDIVIDUAL REGISTRATIONS');
    console.log('='.repeat(80));
    console.log(`Generated: ${new Date().toLocaleString('en-AU')}`);
    console.log(`Total Individual Registrations: ${individualRegs.length}`);
    console.log('='.repeat(80));

    console.log('\nTICKET SALES SUMMARY:');
    console.log('-'.repeat(80));
    console.log('Ticket Name'.padEnd(50) + 'Qty'.padStart(8) + 'Regs'.padStart(8) + 'Price'.padStart(10) + 'Revenue'.padStart(12));
    console.log('-'.repeat(80));

    let totalQuantity = 0;
    let totalRevenue = 0;

    sortedSales.forEach(sale => {
      console.log(
        sale.name.substring(0, 49).padEnd(50) +
        sale.totalQuantity.toString().padStart(8) +
        sale.registrationCount.toString().padStart(8) +
        `$${sale.price.toFixed(2)}`.padStart(10) +
        `$${sale.revenue.toFixed(2)}`.padStart(12)
      );
      totalQuantity += sale.totalQuantity;
      totalRevenue += sale.revenue;
    });

    console.log('-'.repeat(80));
    console.log(
      'TOTALS:'.padEnd(50) +
      totalQuantity.toString().padStart(8) +
      ''.padStart(8) +
      ''.padStart(10) +
      `$${totalRevenue.toFixed(2)}`.padStart(12)
    );
    console.log('='.repeat(80));

    // Show registrations with quantity > 1 (if any)
    console.log('\nREGISTRATIONS WITH MULTIPLE TICKET QUANTITIES:');
    console.log('-'.repeat(80));
    
    let multiQuantityFound = false;
    individualRegs.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      if (regData && regData.selectedTickets) {
        const hasMultiQuantity = regData.selectedTickets.some(ticket => 
          ticket.quantity && ticket.quantity > 1
        );
        
        if (hasMultiQuantity) {
          multiQuantityFound = true;
          const confirmationNumber = reg.confirmationNumber || reg.confirmation_number || 'N/A';
          console.log(`\nRegistration: ${confirmationNumber}`);
          regData.selectedTickets.forEach(ticket => {
            if (ticket.quantity && ticket.quantity > 1) {
              console.log(`  - ${ticket.name}: Quantity ${ticket.quantity}`);
            }
          });
        }
      }
    });

    if (!multiQuantityFound) {
      console.log('No registrations found with quantity > 1 (all tickets have quantity = 1)');
    }

  } catch (error) {
    console.error('Error generating report:', error);
  } finally {
    await client.close();
    console.log('\nReport complete.');
  }
}

// Run the report
generateTicketQuantityReport();