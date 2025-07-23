const fs = require('fs');
const path = require('path');

// Read files
const allTicketsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../supabase-ticket-analysis/all-tickets.json'), 'utf8'));
const lodgeTicketsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../supabase-ticket-analysis/lodge-tickets.json'), 'utf8'));

// Extract lodge tickets from all-tickets
const lodgeTicketsInAll = allTicketsData.filter(item => item.source === 'lodges');

// Create maps by registration ID for comparison
const lodgeByRegId = {};
lodgeTicketsData.tickets.forEach(item => {
    const regId = item.registrationId;
    if (!lodgeByRegId[regId]) lodgeByRegId[regId] = [];
    lodgeByRegId[regId].push(item);
});

const allLodgeByRegId = {};
lodgeTicketsInAll.forEach(item => {
    const regId = item.registrationId;
    if (!allLodgeByRegId[regId]) allLodgeByRegId[regId] = [];
    allLodgeByRegId[regId].push(item);
});

console.log('Lodge Ticket Transformation Analysis');
console.log('====================================\n');

// Compare registration IDs
const lodgeRegIds = new Set(Object.keys(lodgeByRegId));
const allLodgeRegIds = new Set(Object.keys(allLodgeByRegId));

console.log(`Lodge-tickets.json: ${lodgeRegIds.size} unique registration IDs`);
console.log(`All-tickets.json (lodges): ${allLodgeRegIds.size} unique registration IDs`);

// Find common registration IDs
const commonRegIds = [...lodgeRegIds].filter(id => allLodgeRegIds.has(id));
console.log(`\nCommon registration IDs: ${commonRegIds.length}`);

if (commonRegIds.length > 0) {
    console.log('\nSample transformation (first common registration):');
    console.log('--------------------------------------------------');
    const sampleRegId = commonRegIds[0];
    
    console.log(`\nRegistration ID: ${sampleRegId}`);
    
    console.log('\nOriginal (lodge-tickets.json):');
    lodgeByRegId[sampleRegId].forEach((ticket, idx) => {
        console.log(`  Ticket ${idx + 1}:`);
        console.log(`    ID: ${ticket.ticket.id}`);
        console.log(`    Event Ticket ID: ${ticket.ticket.eventTicketId}`);
        console.log(`    Quantity: ${ticket.ticket.quantity}`);
        console.log(`    Price: $${ticket.ticket.price}`);
    });
    
    console.log('\nTransformed (all-tickets.json):');
    allLodgeByRegId[sampleRegId].forEach((ticket, idx) => {
        console.log(`  Ticket ${idx + 1}:`);
        console.log(`    ID: ${ticket.ticket.id}`);
        console.log(`    Event Ticket ID: ${ticket.ticket.eventTicketId || 'N/A'}`);
        console.log(`    Name: ${ticket.ticket.name || 'N/A'}`);
        console.log(`    Quantity: ${ticket.ticket.quantity}`);
        console.log(`    Price: $${ticket.ticket.price}`);
        console.log(`    Owner Type: ${ticket.ticket.ownerType}`);
    });
}

// Check ticket ID pattern changes
console.log('\n\nTicket ID Pattern Analysis:');
console.log('---------------------------');
const lodgeTicketIdPattern = lodgeTicketsData.tickets[0]?.ticket?.id || '';
const allLodgeTicketIdPattern = lodgeTicketsInAll[0]?.ticket?.id || '';

console.log(`Lodge-tickets.json ID pattern: ${lodgeTicketIdPattern.substring(0, 50)}...`);
console.log(`All-tickets.json ID pattern: ${allLodgeTicketIdPattern.substring(0, 50)}...`);

// Check if eventTicketId changed
const lodgeEventTicketIds = new Set(lodgeTicketsData.tickets.map(t => t.ticket.eventTicketId));
const allLodgeEventTicketIds = new Set(lodgeTicketsInAll.map(t => t.ticket.eventTicketId).filter(Boolean));

console.log(`\nOriginal event ticket IDs: ${[...lodgeEventTicketIds].join(', ')}`);
console.log(`Transformed event ticket IDs: ${[...allLodgeEventTicketIds].join(', ')}`);