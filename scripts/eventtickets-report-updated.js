#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function generateEventTicketsReport() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    // Fetch all eventTickets
    const eventTicketsCollection = db.collection('eventTickets');
    const eventTickets = await eventTicketsCollection.find({}).toArray();
    console.log(`Found ${eventTickets.length} event tickets`);

    // Fetch all registrations
    const registrationsCollection = db.collection('registrations');
    const registrations = await registrationsCollection.find({}).toArray();
    console.log(`Found ${registrations.length} registrations`);

    // Create a map to count registrations per eventTicket
    const eventTicketCounts = new Map();
    
    // Initialize all eventTickets with 0 count
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      eventTicketCounts.set(ticketId, {
        eventTicketId: ticketId,
        eventId: ticket.eventId || ticket.event_id,
        name: ticket.name,
        price: extractNumericValue(ticket.price),
        totalCapacity: ticket.totalCapacity || ticket.total_capacity,
        availableCount: ticket.availableCount || ticket.available_count,
        soldCount: ticket.soldCount || ticket.sold_count,
        status: ticket.status || (ticket.isActive ? 'active' : 'inactive'),
        registrationCount: 0,
        totalQuantity: 0,
        totalRevenue: 0,
        registrations: []
      });
    });

    // Count registrations for each eventTicket
    registrations.forEach(registration => {
      const regData = registration.registrationData || registration.registration_data;
      
      // Check both new 'tickets' field and old 'selectedTickets' field
      const tickets = regData?.tickets || regData?.selectedTickets || [];
      
      if (tickets.length > 0) {
        // Track unique event tickets in this registration
        const processedTickets = new Map();
        
        tickets.forEach(ticket => {
          const eventTicketId = ticket.eventTicketId || ticket.event_ticket_id;
          if (eventTicketId) {
            // Get quantity and price from ticket object
            const quantity = ticket.quantity || 1;
            const price = extractNumericValue(ticket.price) || 0;
            const totalPrice = quantity * price;
            
            // Update or accumulate for this ticket in this registration
            if (processedTickets.has(eventTicketId)) {
              const existing = processedTickets.get(eventTicketId);
              existing.quantity += quantity;
              existing.totalPrice += totalPrice;
            } else {
              processedTickets.set(eventTicketId, {
                quantity: quantity,
                totalPrice: totalPrice
              });
            }
          }
        });
        
        // Update counts for each unique event ticket
        processedTickets.forEach((ticketInfo, eventTicketId) => {
          const ticketData = eventTicketCounts.get(eventTicketId);
          if (ticketData) {
            ticketData.registrationCount++;
            ticketData.totalQuantity += ticketInfo.quantity;
            ticketData.totalRevenue += ticketInfo.totalPrice;
            ticketData.registrations.push({
              registrationId: registration.registrationId || registration.registration_id,
              confirmationNumber: registration.confirmationNumber || registration.confirmation_number,
              registrationType: registration.registrationType || registration.registration_type,
              quantity: ticketInfo.quantity,
              revenue: ticketInfo.totalPrice,
              attendeeCount: registration.attendeeCount || registration.attendee_count,
              totalAmount: extractNumericValue(registration.totalAmountPaid || registration.total_amount_paid)
            });
          }
        });
      }
    });

    // Convert map to array and sort by total quantity (descending)
    const reportData = Array.from(eventTicketCounts.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    // Generate report
    console.log('\n' + '='.repeat(120));
    console.log('EVENT TICKETS REPORT (UPDATED SCHEMA)');
    console.log('='.repeat(120));
    console.log(`Generated on: ${new Date().toISOString()}`);
    console.log('='.repeat(120));

    // Summary statistics
    const totalEventTickets = reportData.length;
    const activeEventTickets = reportData.filter(t => t.status === 'active').length;
    const ticketsWithRegistrations = reportData.filter(t => t.registrationCount > 0).length;
    const totalQuantitySold = reportData.reduce((sum, t) => sum + t.totalQuantity, 0);
    const totalRevenue = reportData.reduce((sum, t) => sum + t.totalRevenue, 0);

    console.log('\nSUMMARY:');
    console.log(`Total Event Tickets: ${totalEventTickets}`);
    console.log(`Active Event Tickets: ${activeEventTickets}`);
    console.log(`Event Tickets with Registrations: ${ticketsWithRegistrations}`);
    console.log(`Total Quantity Sold: ${totalQuantitySold}`);
    console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log('='.repeat(120));

    // Detailed report
    console.log('\nDETAILED REPORT:');
    console.log('-'.repeat(120));
    
    reportData.forEach((ticket, index) => {
      console.log(`\n${index + 1}. ${ticket.name}`);
      console.log(`   Event Ticket ID: ${ticket.eventTicketId}`);
      console.log(`   Event ID: ${ticket.eventId}`);
      console.log(`   Status: ${ticket.status}`);
      console.log(`   Base Price: $${ticket.price.toFixed(2)}`);
      console.log(`   Capacity: ${ticket.totalCapacity || 'N/A'}`);
      console.log(`   Available: ${ticket.availableCount || 'N/A'}`);
      console.log(`   Sold Count (from DB): ${ticket.soldCount || 0}`);
      console.log(`   Registration Count: ${ticket.registrationCount}`);
      console.log(`   Total Quantity Sold: ${ticket.totalQuantity}`);
      console.log(`   Total Revenue: $${ticket.totalRevenue.toFixed(2)}`);
      if (ticket.totalQuantity > 0) {
        console.log(`   Average Price: $${(ticket.totalRevenue / ticket.totalQuantity).toFixed(2)}`);
      }
      
      if (ticket.registrationCount > 0) {
        console.log(`   Sample Registrations (showing first 5):`);
        ticket.registrations.slice(0, 5).forEach(reg => {
          console.log(`     - ${reg.confirmationNumber} (${reg.registrationType}, qty: ${reg.quantity}, revenue: $${reg.revenue.toFixed(2)})`);
        });
        if (ticket.registrations.length > 5) {
          console.log(`     ... and ${ticket.registrations.length - 5} more registrations`);
        }
      }
    });

    // Generate CSV report
    const csvHeaders = [
      'Event Ticket ID',
      'Event ID',
      'Name',
      'Status',
      'Base Price',
      'Total Capacity',
      'Available Count',
      'Sold Count (DB)',
      'Registration Count',
      'Total Quantity Sold',
      'Total Revenue',
      'Average Price'
    ];

    const csvRows = reportData.map(ticket => [
      ticket.eventTicketId,
      ticket.eventId,
      `"${ticket.name}"`,
      ticket.status,
      ticket.price.toFixed(2),
      ticket.totalCapacity || '',
      ticket.availableCount || '',
      ticket.soldCount || 0,
      ticket.registrationCount,
      ticket.totalQuantity,
      ticket.totalRevenue.toFixed(2),
      ticket.totalQuantity > 0 ? (ticket.totalRevenue / ticket.totalQuantity).toFixed(2) : '0.00'
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    const csvFilename = `eventtickets-report-updated-${new Date().toISOString().split('T')[0]}.csv`;
    const csvPath = path.join(__dirname, csvFilename);
    fs.writeFileSync(csvPath, csvContent);
    console.log(`\n\nCSV report saved to: ${csvPath}`);

    // Check for discrepancies
    console.log('\n' + '='.repeat(120));
    console.log('DISCREPANCY CHECK:');
    console.log('-'.repeat(120));
    
    let discrepanciesFound = false;
    reportData.forEach(ticket => {
      if (ticket.soldCount && ticket.totalQuantity && ticket.soldCount !== ticket.totalQuantity) {
        if (!discrepanciesFound) {
          console.log('\nEvent tickets where sold_count differs from actual quantity sold:');
          discrepanciesFound = true;
        }
        const diff = ticket.totalQuantity - ticket.soldCount;
        const percentDiff = ((diff / ticket.soldCount) * 100).toFixed(1);
        console.log(`- ${ticket.name}:`);
        console.log(`  DB sold_count: ${ticket.soldCount}`);
        console.log(`  Actual quantity: ${ticket.totalQuantity}`);
        console.log(`  Difference: ${diff > 0 ? '+' : ''}${diff} (${diff > 0 ? '+' : ''}${percentDiff}%)`);
      }
    });
    
    if (!discrepanciesFound) {
      console.log('No discrepancies found between sold_count and actual quantity sold.');
    }

    // Capacity warnings
    console.log('\n' + '='.repeat(120));
    console.log('CAPACITY WARNINGS:');
    console.log('-'.repeat(120));
    
    let warningsFound = false;
    reportData.forEach(ticket => {
      if (ticket.totalCapacity && ticket.totalQuantity) {
        const utilization = (ticket.totalQuantity / ticket.totalCapacity) * 100;
        if (utilization >= 90) {
          if (!warningsFound) {
            console.log('\nEvent tickets approaching or exceeding capacity:');
            warningsFound = true;
          }
          console.log(`- ${ticket.name}: ${ticket.totalQuantity}/${ticket.totalCapacity} (${utilization.toFixed(1)}% utilized)`);
        }
      }
    });
    
    if (!warningsFound) {
      console.log('No capacity warnings found.');
    }

  } catch (error) {
    console.error('Error generating report:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Helper function to extract numeric value from various formats
function extractNumericValue(value) {
  if (value === null || value === undefined) return 0;
  
  // Handle MongoDB Decimal128 instances
  if (typeof value === 'object' && value.constructor && value.constructor.name === 'Decimal128') {
    return parseFloat(value.toString());
  }
  
  // Handle MongoDB Decimal128 as plain object
  if (typeof value === 'object' && value.$numberDecimal !== undefined) {
    return parseFloat(value.$numberDecimal);
  }
  
  // Handle plain numbers
  if (typeof value === 'number') {
    return value;
  }
  
  // Handle strings
  if (typeof value === 'string') {
    return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
  }
  
  // Handle other objects
  if (typeof value === 'object') {
    return value.value || value.amount || 0;
  }
  
  return 0;
}

// Run the report
generateEventTicketsReport();