const fs = require('fs');
const path = require('path');

// Read all three files
const allTicketsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../supabase-ticket-analysis/all-tickets.json'), 'utf8'));
const lodgeTicketsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../supabase-ticket-analysis/lodge-tickets.json'), 'utf8'));
const packageTicketsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../supabase-ticket-analysis/package-tickets.json'), 'utf8'));

// Analyze sources in all-tickets.json
const sourceBreakdown = {};
const ticketsBySource = {};

allTicketsData.forEach(item => {
    const source = item.source || 'unknown';
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
    
    if (!ticketsBySource[source]) {
        ticketsBySource[source] = [];
    }
    ticketsBySource[source].push(item);
});

// Display breakdown
console.log('Source Analysis for all-tickets.json');
console.log('====================================\n');

console.log('Ticket counts by source:');
Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]).forEach(([source, count]) => {
    console.log(`- ${source}: ${count} tickets`);
});

console.log(`\nTotal tickets: ${allTicketsData.length}`);

// Check if lodge and package tickets are marked with their respective sources
console.log('\n\nSource field in other files:');
console.log('----------------------------');

// Check lodge-tickets.json
const lodgeSources = new Set();
lodgeTicketsData.tickets.forEach(item => {
    if (item.source) lodgeSources.add(item.source);
});
console.log(`lodge-tickets.json sources: ${Array.from(lodgeSources).join(', ')}`);

// Check package-tickets.json
const packageSources = new Set();
packageTicketsData.tickets.forEach(item => {
    if (item.source) packageSources.add(item.source);
});
console.log(`package-tickets.json sources: ${Array.from(packageSources).join(', ')}`);

// Verify transformation theory
console.log('\n\nTransformation Analysis:');
console.log('------------------------');

if (ticketsBySource['lodges']) {
    console.log(`\nFound ${ticketsBySource['lodges'].length} tickets with source='lodges' in all-tickets.json`);
    console.log(`Lodge-tickets.json has ${lodgeTicketsData.tickets.length} tickets`);
    
    // Check if quantities match
    let lodgeQuantityInAll = 0;
    ticketsBySource['lodges'].forEach(item => {
        if (item.ticket && item.ticket.quantity) {
            lodgeQuantityInAll += item.ticket.quantity;
        }
    });
    
    let lodgeQuantityOriginal = 0;
    lodgeTicketsData.tickets.forEach(item => {
        if (item.ticket && item.ticket.quantity) {
            lodgeQuantityOriginal += item.ticket.quantity;
        }
    });
    
    console.log(`Total quantity in all-tickets (lodges): ${lodgeQuantityInAll}`);
    console.log(`Total quantity in lodge-tickets.json: ${lodgeQuantityOriginal}`);
}

if (ticketsBySource['packages']) {
    console.log(`\nFound ${ticketsBySource['packages'].length} tickets with source='packages' in all-tickets.json`);
    console.log(`Package-tickets.json has ${packageTicketsData.tickets.length} tickets`);
}

// Show sample tickets from each source
console.log('\n\nSample tickets by source:');
console.log('-------------------------');
Object.entries(ticketsBySource).forEach(([source, tickets]) => {
    if (tickets.length > 0) {
        const sample = tickets[0];
        console.log(`\n${source} sample:`);
        console.log(`  Registration ID: ${sample.registrationId}`);
        console.log(`  Ticket ID: ${sample.ticket?.id}`);
        console.log(`  Name: ${sample.ticket?.name || 'N/A'}`);
        console.log(`  Quantity: ${sample.ticket?.quantity || 1}`);
        console.log(`  Owner Type: ${sample.ticket?.ownerType || 'N/A'}`);
    }
});