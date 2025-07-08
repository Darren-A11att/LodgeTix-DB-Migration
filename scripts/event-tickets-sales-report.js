#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function generateEventTicketsSalesReport() {
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

    // Fetch all transactions with event ticket items
    const transactionsCollection = db.collection('transactions');
    const eventTicketTransactions = await transactionsCollection.find({
      $or: [
        { item_description: { $regex: /event.*ticket/i } },
        { eventTicketId: { $exists: true } },
        { event_ticket_id: { $exists: true } }
      ]
    }).toArray();
    console.log(`Found ${eventTicketTransactions.length} event ticket transactions`);

    // Fetch all registrations
    const registrationsCollection = db.collection('registrations');
    const registrations = await registrationsCollection.find({}).toArray();
    console.log(`Found ${registrations.length} registrations`);

    // Create comprehensive map for each event ticket
    const eventTicketSalesData = new Map();
    
    // Initialize all eventTickets with sales data structure
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      eventTicketSalesData.set(ticketId, {
        eventTicketId: ticketId,
        eventId: ticket.eventId || ticket.event_id,
        name: ticket.name,
        description: ticket.description,
        price: parseFloat(ticket.price?.$numberDecimal || ticket.price || 0),
        totalCapacity: ticket.totalCapacity || ticket.total_capacity || 0,
        availableCount: ticket.availableCount || ticket.available_count || 0,
        soldCount: ticket.soldCount || ticket.sold_count || 0,
        status: ticket.status || (ticket.isActive ? 'active' : 'inactive'),
        createdAt: ticket.createdAt || ticket.created_at,
        // Sales metrics
        transactionCount: 0,
        registrationCount: 0,
        totalAttendees: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        // Detailed records
        transactions: [],
        registrations: [],
        monthlyRevenue: {}
      });
    });

    // Process transactions
    eventTicketTransactions.forEach(transaction => {
      const eventTicketId = transaction.eventTicketId || transaction.event_ticket_id;
      
      // Try to find matching ticket by ID or description
      let ticketData = null;
      if (eventTicketId) {
        ticketData = eventTicketSalesData.get(eventTicketId);
      } else {
        // Try to match by description
        for (const [id, data] of eventTicketSalesData) {
          if (transaction.item_description && data.name && 
              transaction.item_description.toLowerCase().includes(data.name.toLowerCase())) {
            ticketData = data;
            break;
          }
        }
      }
      
      if (ticketData) {
        ticketData.transactionCount++;
        const itemPrice = parseFloat(transaction.item_price || 0);
        const itemQuantity = parseInt(transaction.item_quantity || 1);
        ticketData.totalRevenue += itemPrice;
        ticketData.totalAttendees += itemQuantity;
        
        // Track monthly revenue
        if (transaction.invoiceDate) {
          const date = new Date(transaction.invoiceDate);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          ticketData.monthlyRevenue[monthKey] = (ticketData.monthlyRevenue[monthKey] || 0) + itemPrice;
        }
        
        ticketData.transactions.push({
          transactionId: transaction._id,
          invoiceNumber: transaction.invoiceNumber,
          invoiceDate: transaction.invoiceDate,
          quantity: itemQuantity,
          price: itemPrice,
          customerName: `${transaction.billTo_firstName || ''} ${transaction.billTo_lastName || ''}`.trim(),
          customerEmail: transaction.billTo_email
        });
      }
    });

    // Process registrations
    registrations.forEach(registration => {
      const regData = registration.registrationData || registration.registration_data;
      if (regData && regData.selectedTickets) {
        const uniqueEventTicketIds = new Set();
        
        regData.selectedTickets.forEach(ticket => {
          const eventTicketId = ticket.eventTicketId || ticket.event_ticket_id;
          if (eventTicketId) {
            uniqueEventTicketIds.add(eventTicketId);
          }
        });
        
        uniqueEventTicketIds.forEach(eventTicketId => {
          const ticketData = eventTicketSalesData.get(eventTicketId);
          if (ticketData) {
            ticketData.registrationCount++;
            ticketData.registrations.push({
              registrationId: registration.registrationId || registration.registration_id,
              confirmationNumber: registration.confirmationNumber || registration.confirmation_number,
              registrationType: registration.registrationType || registration.registration_type,
              attendeeCount: registration.attendeeCount || registration.attendee_count || 1,
              totalAmount: registration.totalAmountPaid || registration.total_amount_paid || 0
            });
          }
        });
      }
    });

    // Calculate averages and sort
    const reportData = Array.from(eventTicketSalesData.values())
      .map(ticket => {
        ticket.averageOrderValue = ticket.transactionCount > 0 
          ? (ticket.totalRevenue / ticket.transactionCount).toFixed(2) 
          : 0;
        ticket.utilizationRate = ticket.totalCapacity > 0 
          ? ((ticket.totalAttendees / ticket.totalCapacity) * 100).toFixed(1) 
          : 0;
        return ticket;
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Generate report
    console.log('\n' + '='.repeat(150));
    console.log('EVENT TICKETS SALES REPORT');
    console.log('='.repeat(150));
    console.log(`Generated on: ${new Date().toISOString()}`);
    console.log('='.repeat(150));

    // Summary statistics
    const totalTickets = reportData.length;
    const activeTickets = reportData.filter(t => t.status === 'active').length;
    const ticketsWithSales = reportData.filter(t => t.transactionCount > 0 || t.registrationCount > 0).length;
    const totalRevenue = reportData.reduce((sum, t) => sum + t.totalRevenue, 0);
    const totalAttendees = reportData.reduce((sum, t) => sum + t.totalAttendees, 0);
    const totalCapacity = reportData.reduce((sum, t) => sum + (t.totalCapacity || 0), 0);

    console.log('\nEXECUTIVE SUMMARY:');
    console.log(`Total Event Tickets: ${totalTickets}`);
    console.log(`Active Event Tickets: ${activeTickets}`);
    console.log(`Event Tickets with Sales: ${ticketsWithSales}`);
    console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`Total Attendees: ${totalAttendees}`);
    console.log(`Total Capacity: ${totalCapacity}`);
    console.log(`Overall Utilization: ${totalCapacity > 0 ? ((totalAttendees / totalCapacity) * 100).toFixed(1) : 0}%`);
    console.log('='.repeat(150));

    // Top performers
    console.log('\nTOP 10 TICKETS BY REVENUE:');
    console.log('-'.repeat(150));
    reportData.slice(0, 10).forEach((ticket, index) => {
      console.log(`${index + 1}. ${ticket.name}`);
      console.log(`   Revenue: $${ticket.totalRevenue.toFixed(2)} | Transactions: ${ticket.transactionCount} | Attendees: ${ticket.totalAttendees}`);
      console.log(`   Average Order: $${ticket.averageOrderValue} | Utilization: ${ticket.utilizationRate}%`);
    });

    // Monthly revenue breakdown
    console.log('\n\nMONTHLY REVENUE BREAKDOWN:');
    console.log('-'.repeat(80));
    
    const monthlyTotals = {};
    reportData.forEach(ticket => {
      Object.entries(ticket.monthlyRevenue).forEach(([month, revenue]) => {
        monthlyTotals[month] = (monthlyTotals[month] || 0) + revenue;
      });
    });
    
    Object.entries(monthlyTotals)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([month, revenue]) => {
        const [year, monthNum] = month.split('-');
        const monthName = new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        console.log(`${monthName}: $${revenue.toFixed(2)}`);
      });

    // Detailed report
    console.log('\n\nDETAILED TICKET ANALYSIS:');
    console.log('='.repeat(150));
    
    reportData.forEach((ticket, index) => {
      console.log(`\n${index + 1}. ${ticket.name}`);
      console.log(`   Event Ticket ID: ${ticket.eventTicketId}`);
      console.log(`   Event ID: ${ticket.eventId}`);
      console.log(`   Status: ${ticket.status}`);
      console.log(`   Price: $${ticket.price.toFixed(2)}`);
      console.log(`   Capacity: ${ticket.totalCapacity || 'Unlimited'} | Available: ${ticket.availableCount || 'N/A'} | Sold: ${ticket.soldCount || 0}`);
      console.log(`   ` + '-'.repeat(100));
      console.log(`   SALES METRICS:`);
      console.log(`   Total Revenue: $${ticket.totalRevenue.toFixed(2)}`);
      console.log(`   Transaction Count: ${ticket.transactionCount}`);
      console.log(`   Registration Count: ${ticket.registrationCount}`);
      console.log(`   Total Attendees: ${ticket.totalAttendees}`);
      console.log(`   Average Order Value: $${ticket.averageOrderValue}`);
      console.log(`   Utilization Rate: ${ticket.utilizationRate}%`);
      
      if (ticket.transactionCount > 0) {
        console.log(`   Recent Transactions (last 3):`);
        ticket.transactions.slice(-3).forEach(trans => {
          const date = trans.invoiceDate ? new Date(trans.invoiceDate).toLocaleDateString() : 'N/A';
          console.log(`     - ${trans.invoiceNumber} on ${date}: ${trans.quantity} ticket(s), $${trans.price.toFixed(2)}`);
        });
      }
    });

    // Generate CSV report
    const csvHeaders = [
      'Event Ticket ID',
      'Event ID',
      'Name',
      'Description',
      'Status',
      'Price',
      'Total Capacity',
      'Available Count',
      'Sold Count',
      'Transaction Count',
      'Registration Count',
      'Total Attendees',
      'Total Revenue',
      'Average Order Value',
      'Utilization Rate %'
    ];

    const csvRows = reportData.map(ticket => [
      ticket.eventTicketId,
      ticket.eventId,
      `"${ticket.name}"`,
      `"${ticket.description || ''}"`,
      ticket.status,
      ticket.price.toFixed(2),
      ticket.totalCapacity || '',
      ticket.availableCount || '',
      ticket.soldCount || 0,
      ticket.transactionCount,
      ticket.registrationCount,
      ticket.totalAttendees,
      ticket.totalRevenue.toFixed(2),
      ticket.averageOrderValue,
      ticket.utilizationRate
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    const csvFilename = `event-tickets-sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    const csvPath = path.join(__dirname, csvFilename);
    fs.writeFileSync(csvPath, csvContent);
    console.log(`\n\nCSV report saved to: ${csvPath}`);

    // Capacity warnings
    console.log('\n' + '='.repeat(150));
    console.log('CAPACITY WARNINGS:');
    console.log('-'.repeat(150));
    
    let warningsFound = false;
    reportData.forEach(ticket => {
      if (ticket.totalCapacity > 0 && ticket.totalAttendees > ticket.totalCapacity * 0.9) {
        if (!warningsFound) {
          console.log('\nTickets approaching or exceeding capacity:');
          warningsFound = true;
        }
        const percentFull = ((ticket.totalAttendees / ticket.totalCapacity) * 100).toFixed(1);
        console.log(`- ${ticket.name}: ${ticket.totalAttendees}/${ticket.totalCapacity} (${percentFull}% full)`);
      }
    });
    
    if (!warningsFound) {
      console.log('No capacity warnings found.');
    }

    // Revenue opportunities
    console.log('\n\nREVENUE OPPORTUNITIES:');
    console.log('-'.repeat(150));
    
    const underutilized = reportData.filter(t => 
      t.status === 'active' && 
      t.totalCapacity > 0 && 
      t.utilizationRate < 50
    );
    
    if (underutilized.length > 0) {
      console.log('Active tickets with < 50% utilization:');
      underutilized.forEach(ticket => {
        const potentialRevenue = (ticket.totalCapacity - ticket.totalAttendees) * ticket.price;
        console.log(`- ${ticket.name}: ${ticket.utilizationRate}% utilized, potential revenue: $${potentialRevenue.toFixed(2)}`);
      });
    } else {
      console.log('All active tickets are well utilized.');
    }

  } catch (error) {
    console.error('Error generating report:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the report
generateEventTicketsSalesReport();