const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkRecentRegistrationsWithTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    const registrationsCollection = db.collection('registrations');
    const proclamationBanquetTicketId = "fd12d7f0-f346-49bf-b1eb-0682ad226216";
    
    // Calculate 48 hours ago
    const twoDaysAgo = new Date();
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
    
    let report = '# Recent Registrations Proclamation Banquet Tickets Check\n\n';
    report += `Generated at: ${new Date().toISOString()}\n\n`;
    
    // 1. Check Troy Quimpo's registration
    console.log('Checking Troy Quimpo registration...');
    const troyRegistrations = await registrationsCollection.find({
      $or: [
        { 'registrationData.bookingContact.emailAddress': 'troyquimpo@yahoo.com' },
        { 'registrationData.bookingContact.firstName': 'Troy', 'registrationData.bookingContact.lastName': 'Quimpo' }
      ]
    }).toArray();
    
    report += '## Troy Quimpo Registrations\n\n';
    let troyTicketCount = 0;
    
    for (const reg of troyRegistrations) {
      report += `### Registration: ${reg.confirmationNumber}\n`;
      report += `- Type: ${reg.registrationType}\n`;
      if (reg.registrationType === 'lodge') {
        report += `- Lodge Name: ${reg.registrationData?.lodgeDetails?.lodgeName || reg.organisationName || 'Unknown'}\n`;
      }
      report += `- Created: ${reg.createdAt}\n`;
      report += `- Total Amount: $${reg.totalAmountPaid}\n`;
      
      if (reg.registrationData?.tickets && Array.isArray(reg.registrationData.tickets)) {
        const proclamationTickets = reg.registrationData.tickets.filter(
          ticket => ticket.eventTicketId === proclamationBanquetTicketId
        );
        
        if (proclamationTickets.length > 0) {
          report += `- **Proclamation Banquet Tickets Found:**\n`;
          proclamationTickets.forEach(ticket => {
            report += `  - Quantity: ${ticket.quantity}\n`;
            report += `  - Status: ${ticket.status}\n`;
            report += `  - Price per ticket: $${ticket.pricePerTicket || ticket.price || 'N/A'}\n`;
            report += `  - Total: $${ticket.total || (ticket.quantity * (ticket.pricePerTicket || ticket.price || 0))}\n`;
            troyTicketCount += ticket.quantity;
          });
        } else {
          report += `- **No Proclamation Banquet tickets found**\n`;
        }
      } else {
        report += `- **No tickets array found**\n`;
      }
      report += '\n';
    }
    
    // 2. Check Lodge Ionic's registration
    console.log('Checking Lodge Ionic registration...');
    const ionicRegistrations = await registrationsCollection.find({
      $or: [
        { 'registrationData.lodgeDetails.lodgeName': { $regex: /ionic/i } },
        { 'organisationName': { $regex: /ionic/i } }
      ]
    }).toArray();
    
    report += '## Lodge Ionic Registrations\n\n';
    let ionicTicketCount = 0;
    
    for (const reg of ionicRegistrations) {
      report += `### Registration: ${reg.confirmationNumber}\n`;
      report += `- Type: ${reg.registrationType}\n`;
      report += `- Lodge Name: ${reg.registrationData?.lodgeDetails?.lodgeName || reg.organisationName || 'Unknown'}\n`;
      report += `- Created: ${reg.createdAt}\n`;
      report += `- Total Amount: $${reg.totalAmountPaid}\n`;
      
      if (reg.registrationData?.tickets && Array.isArray(reg.registrationData.tickets)) {
        const proclamationTickets = reg.registrationData.tickets.filter(
          ticket => ticket.eventTicketId === proclamationBanquetTicketId
        );
        
        if (proclamationTickets.length > 0) {
          report += `- **Proclamation Banquet Tickets Found:**\n`;
          proclamationTickets.forEach(ticket => {
            report += `  - Quantity: ${ticket.quantity}\n`;
            report += `  - Status: ${ticket.status}\n`;
            report += `  - Price per ticket: $${ticket.pricePerTicket || ticket.price || 'N/A'}\n`;
            report += `  - Total: $${ticket.total || (ticket.quantity * (ticket.pricePerTicket || ticket.price || 0))}\n`;
            ionicTicketCount += ticket.quantity;
          });
        } else {
          report += `- **No Proclamation Banquet tickets found**\n`;
        }
      } else {
        report += `- **No tickets array found**\n`;
      }
      report += '\n';
    }
    
    // 3. Check all recent registrations (last 48 hours)
    console.log('Checking all recent registrations...');
    const recentRegistrations = await registrationsCollection.find({
      createdAt: { $gte: twoDaysAgo }
    }).toArray();
    
    report += `## All Recent Registrations (Last 48 Hours)\n\n`;
    report += `Total recent registrations: ${recentRegistrations.length}\n\n`;
    
    // List all recent registrations first
    report += `### All Recent Registrations:\n`;
    recentRegistrations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    recentRegistrations.forEach(reg => {
      const name = reg.registrationType === 'lodge' 
        ? (reg.registrationData?.lodgeDetails?.lodgeName || reg.organisationName || 'Unknown Lodge')
        : `${reg.registrationData?.bookingContact?.firstName || ''} ${reg.registrationData?.bookingContact?.lastName || ''}`.trim();
      report += `- ${reg.confirmationNumber} (${reg.registrationType}) - ${name} - Created: ${reg.createdAt}\n`;
    });
    report += '\n';
    
    let recentTicketCount = 0;
    const recentWithTickets = [];
    
    for (const reg of recentRegistrations) {
      if (reg.registrationData?.tickets && Array.isArray(reg.registrationData.tickets)) {
        const proclamationTickets = reg.registrationData.tickets.filter(
          ticket => ticket.eventTicketId === proclamationBanquetTicketId
        );
        
        if (proclamationTickets.length > 0) {
          let ticketTotal = 0;
          proclamationTickets.forEach(ticket => {
            ticketTotal += ticket.quantity;
          });
          
          recentWithTickets.push({
            confirmationNumber: reg.confirmationNumber,
            type: reg.registrationType,
            name: reg.registrationType === 'lodge' 
              ? (reg.registrationData?.lodgeDetails?.lodgeName || reg.organisationName || 'Unknown Lodge')
              : `${reg.registrationData?.bookingContact?.firstName || ''} ${reg.registrationData?.bookingContact?.lastName || ''}`.trim(),
            createdAt: reg.createdAt,
            ticketCount: ticketTotal,
            tickets: proclamationTickets
          });
          
          recentTicketCount += ticketTotal;
        }
      }
    }
    
    report += `### Registrations with Proclamation Banquet Tickets:\n\n`;
    
    if (recentWithTickets.length > 0) {
      recentWithTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      recentWithTickets.forEach(reg => {
        report += `- **${reg.confirmationNumber}** (${reg.type})\n`;
        report += `  - Name: ${reg.name}\n`;
        report += `  - Created: ${reg.createdAt}\n`;
        report += `  - Proclamation Tickets: ${reg.ticketCount}\n`;
        reg.tickets.forEach(ticket => {
          report += `    - Status: ${ticket.status}, Price: $${ticket.pricePerTicket || ticket.price || 'N/A'}, Total: $${ticket.total || (ticket.quantity * (ticket.pricePerTicket || ticket.price || 0))}\n`;
        });
        report += '\n';
      });
    } else {
      report += 'No recent registrations found with Proclamation Banquet tickets.\n\n';
    }
    
    // Summary
    report += '## Summary\n\n';
    report += `- Troy Quimpo total Proclamation tickets: ${troyTicketCount}\n`;
    report += `- Lodge Ionic total Proclamation tickets: ${ionicTicketCount}\n`;
    report += `- Total recent registrations (48 hours): ${recentRegistrations.length}\n`;
    report += `- Recent registrations with Proclamation tickets: ${recentWithTickets.length}\n`;
    report += `- Total Proclamation tickets in recent registrations: ${recentTicketCount}\n`;
    
    // Save report
    fs.writeFileSync('/tmp/recent-registrations-check.md', report);
    console.log('\nReport saved to: /tmp/recent-registrations-check.md');
    
    // Also output to console
    console.log('\n' + report);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the check
checkRecentRegistrationsWithTickets();