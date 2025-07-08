#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function generateEventTicketsRegistrationReport() {
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
      // Use eventTicketId if available, otherwise use event_ticket_id
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      eventTicketCounts.set(ticketId, {
        eventTicketId: ticketId,
        eventId: ticket.eventId || ticket.event_id,
        name: ticket.name,
        price: ticket.price?.$numberDecimal || ticket.price,
        totalCapacity: ticket.totalCapacity || ticket.total_capacity,
        availableCount: ticket.availableCount || ticket.available_count,
        soldCount: ticket.soldCount || ticket.sold_count,
        status: ticket.status || (ticket.isActive ? 'active' : 'inactive'),
        registrationCount: 0,
        attendeeCount: 0,
        registrations: []
      });
    });

    // Count registrations for each eventTicket
    registrations.forEach(registration => {
      // Handle both registrationData and registration_data field names
      const regData = registration.registrationData || registration.registration_data;
      if (regData && regData.selectedTickets) {
        const selectedTickets = regData.selectedTickets;
        
        // Track unique event tickets in this registration
        const uniqueEventTicketIds = new Set();
        
        selectedTickets.forEach(ticket => {
          // Handle different field names
          const eventTicketId = ticket.eventTicketId || ticket.event_ticket_id;
          if (eventTicketId) {
            uniqueEventTicketIds.add(eventTicketId);
            
            // Increment attendee count for this event ticket
            const ticketData = eventTicketCounts.get(eventTicketId);
            if (ticketData) {
              ticketData.attendeeCount++;
            }
          }
        });
        
        // Count each unique event ticket only once per registration
        uniqueEventTicketIds.forEach(eventTicketId => {
          const ticketData = eventTicketCounts.get(eventTicketId);
          if (ticketData) {
            ticketData.registrationCount++;
            ticketData.registrations.push({
              registrationId: registration.registrationId || registration.registration_id,
              confirmationNumber: registration.confirmationNumber || registration.confirmation_number,
              registrationType: registration.registrationType || registration.registration_type,
              attendeeCount: registration.attendeeCount || registration.attendee_count,
              totalAmount: registration.totalAmountPaid || registration.total_amount_paid
            });
          }
        });
      }
    });

    // Convert map to array and sort by registration count (descending)
    const reportData = Array.from(eventTicketCounts.values())
      .sort((a, b) => b.registrationCount - a.registrationCount);

    // Generate report
    console.log('\n' + '='.repeat(120));
    console.log('EVENT TICKETS REGISTRATION COUNT REPORT');
    console.log('='.repeat(120));
    console.log(`Generated on: ${new Date().toISOString()}`);
    console.log('='.repeat(120));

    // Summary statistics
    const totalEventTickets = reportData.length;
    const activeEventTickets = reportData.filter(t => t.status === 'active').length;
    const ticketsWithRegistrations = reportData.filter(t => t.registrationCount > 0).length;
    const totalAttendees = reportData.reduce((sum, t) => sum + t.attendeeCount, 0);

    console.log('\nSUMMARY:');
    console.log(`Total Event Tickets: ${totalEventTickets}`);
    console.log(`Active Event Tickets: ${activeEventTickets}`);
    console.log(`Event Tickets with Registrations: ${ticketsWithRegistrations}`);
    console.log(`Total Attendees Across All Tickets: ${totalAttendees}`);
    console.log('='.repeat(120));

    // Detailed report
    console.log('\nDETAILED REPORT:');
    console.log('-'.repeat(120));
    
    reportData.forEach((ticket, index) => {
      console.log(`\n${index + 1}. ${ticket.name}`);
      console.log(`   Event Ticket ID: ${ticket.eventTicketId}`);
      console.log(`   Event ID: ${ticket.eventId}`);
      console.log(`   Status: ${ticket.status}`);
      console.log(`   Price: $${ticket.price}`);
      console.log(`   Capacity: ${ticket.totalCapacity || 'N/A'}`);
      console.log(`   Available: ${ticket.availableCount || 'N/A'}`);
      console.log(`   Sold Count (from eventTickets): ${ticket.soldCount || 0}`);
      console.log(`   Registration Count: ${ticket.registrationCount}`);
      console.log(`   Total Attendees: ${ticket.attendeeCount}`);
      
      if (ticket.registrationCount > 0) {
        console.log(`   Sample Registrations (showing first 5):`);
        ticket.registrations.slice(0, 5).forEach(reg => {
          console.log(`     - ${reg.confirmationNumber} (${reg.registrationType}, ${reg.attendeeCount} attendees, $${reg.totalAmount || 0})`);
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
      'Price',
      'Total Capacity',
      'Available Count',
      'Sold Count',
      'Registration Count',
      'Total Attendees'
    ];

    const csvRows = reportData.map(ticket => [
      ticket.eventTicketId,
      ticket.eventId,
      `"${ticket.name}"`,
      ticket.status,
      ticket.price,
      ticket.totalCapacity || '',
      ticket.availableCount || '',
      ticket.soldCount || 0,
      ticket.registrationCount,
      ticket.attendeeCount
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    const csvFilename = `eventtickets-registration-report-${new Date().toISOString().split('T')[0]}.csv`;
    const csvPath = path.join(__dirname, csvFilename);
    fs.writeFileSync(csvPath, csvContent);
    console.log(`\n\nCSV report saved to: ${csvPath}`);

    // Check for discrepancies
    console.log('\n' + '='.repeat(120));
    console.log('DISCREPANCY CHECK:');
    console.log('-'.repeat(120));
    
    let discrepanciesFound = false;
    reportData.forEach(ticket => {
      if (ticket.soldCount && ticket.attendeeCount && ticket.soldCount !== ticket.attendeeCount) {
        if (!discrepanciesFound) {
          console.log('\nEvent tickets where sold_count differs from actual attendee count:');
          discrepanciesFound = true;
        }
        console.log(`- ${ticket.name}: sold_count=${ticket.soldCount}, actual attendees=${ticket.attendeeCount}`);
      }
    });
    
    if (!discrepanciesFound) {
      console.log('No discrepancies found between sold_count and actual attendee counts.');
    }

  } catch (error) {
    console.error('Error generating report:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the report
generateEventTicketsRegistrationReport();