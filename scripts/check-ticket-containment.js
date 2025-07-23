const fs = require('fs');
const path = require('path');

// Read all three files
const allTicketsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../supabase-ticket-analysis/all-tickets.json'), 'utf8'));
const lodgeTicketsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../supabase-ticket-analysis/lodge-tickets.json'), 'utf8'));
const packageTicketsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../supabase-ticket-analysis/package-tickets.json'), 'utf8'));

// Extract ticket IDs from each file
const allTicketIds = new Set();
allTicketsData.forEach(item => {
    if (item.ticket && item.ticket.id) {
        allTicketIds.add(item.ticket.id);
    }
});

const lodgeTicketIds = new Set();
lodgeTicketsData.tickets.forEach(item => {
    if (item.ticket && item.ticket.id) {
        lodgeTicketIds.add(item.ticket.id);
    }
});

const packageTicketIds = new Set();
packageTicketsData.tickets.forEach(item => {
    if (item.ticket && item.ticket.id) {
        packageTicketIds.add(item.ticket.id);
    }
});

// Check containment
const lodgeNotInAll = [];
const packageNotInAll = [];

lodgeTicketIds.forEach(id => {
    if (!allTicketIds.has(id)) {
        lodgeNotInAll.push(id);
    }
});

packageTicketIds.forEach(id => {
    if (!allTicketIds.has(id)) {
        packageNotInAll.push(id);
    }
});

// Calculate overlap
const lodgeInAll = Array.from(lodgeTicketIds).filter(id => allTicketIds.has(id));
const packageInAll = Array.from(packageTicketIds).filter(id => allTicketIds.has(id));

// Display results
console.log('Ticket Containment Analysis');
console.log('===========================\n');

console.log('File Statistics:');
console.log(`all-tickets.json: ${allTicketIds.size} unique ticket IDs`);
console.log(`lodge-tickets.json: ${lodgeTicketIds.size} unique ticket IDs`);
console.log(`package-tickets.json: ${packageTicketIds.size} unique ticket IDs`);

console.log('\nContainment Check:');
console.log('------------------');

console.log('\nLodge Tickets:');
console.log(`- ${lodgeInAll.length} out of ${lodgeTicketIds.size} lodge tickets ARE in all-tickets.json (${(lodgeInAll.length/lodgeTicketIds.size*100).toFixed(1)}%)`);
console.log(`- ${lodgeNotInAll.length} lodge tickets are NOT in all-tickets.json`);

console.log('\nPackage Tickets:');
console.log(`- ${packageInAll.length} out of ${packageTicketIds.size} package tickets ARE in all-tickets.json (${(packageInAll.length/packageTicketIds.size*100).toFixed(1)}%)`);
console.log(`- ${packageNotInAll.length} package tickets are NOT in all-tickets.json`);

if (lodgeNotInAll.length > 0) {
    console.log('\nLodge ticket IDs missing from all-tickets.json:');
    lodgeNotInAll.forEach(id => console.log(`  - ${id}`));
}

if (packageNotInAll.length > 0) {
    console.log('\nPackage ticket IDs missing from all-tickets.json:');
    packageNotInAll.forEach(id => console.log(`  - ${id}`));
}

// Check if all-tickets contains tickets not in lodge or package
const allOnlyIds = Array.from(allTicketIds).filter(id => 
    !lodgeTicketIds.has(id) && !packageTicketIds.has(id)
);

console.log(`\nTickets in all-tickets.json but NOT in lodge or package: ${allOnlyIds.length}`);

// Summary
console.log('\n\nSUMMARY:');
console.log('--------');
if (lodgeNotInAll.length === 0 && packageNotInAll.length === 0) {
    console.log('✓ YES: all-tickets.json contains ALL tickets from both lodge-tickets.json and package-tickets.json');
} else {
    console.log('✗ NO: all-tickets.json is missing some tickets from lodge and/or package files');
}

console.log(`\nall-tickets.json appears to contain:`);
console.log(`- Regular individual tickets: ${allOnlyIds.length}`);
console.log(`- Lodge tickets: ${lodgeInAll.length}/${lodgeTicketIds.size}`);
console.log(`- Package tickets: ${packageInAll.length}/${packageTicketIds.size}`);