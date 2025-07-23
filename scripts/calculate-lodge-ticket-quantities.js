const fs = require('fs');
const path = require('path');

// Read the JSON file
const filePath = path.join(__dirname, '../supabase-ticket-analysis/lodge-tickets.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Get the tickets array
const tickets = data.tickets || [];

// Calculate quantities for each unique ticket
const ticketsByEventId = {};
const ticketsByPackageStatus = { package: 0, individual: 0 };
let totalQuantity = 0;
let totalTickets = tickets.length;

tickets.forEach(item => {
    if (item.ticket) {
        const ticket = item.ticket;
        const eventTicketId = ticket.eventTicketId;
        const quantity = ticket.quantity || 0;
        const isPackage = ticket.isPackage;
        
        // Group by eventTicketId
        if (ticketsByEventId[eventTicketId]) {
            ticketsByEventId[eventTicketId].count += 1;
            ticketsByEventId[eventTicketId].totalQuantity += quantity;
        } else {
            ticketsByEventId[eventTicketId] = {
                count: 1,
                totalQuantity: quantity,
                isPackage: isPackage,
                price: ticket.price
            };
        }
        
        // Count package vs individual
        if (isPackage) {
            ticketsByPackageStatus.package += quantity;
        } else {
            ticketsByPackageStatus.individual += quantity;
        }
        
        totalQuantity += quantity;
    }
});

// Display results
console.log('Lodge Tickets Analysis');
console.log('======================\n');

console.log('Summary:');
console.log(`Total ticket records: ${totalTickets}`);
console.log(`Total ticket quantity: ${totalQuantity}`);
console.log(`Unique event ticket IDs: ${Object.keys(ticketsByEventId).length}`);
console.log(`Package tickets: ${ticketsByPackageStatus.package}`);
console.log(`Individual tickets: ${ticketsByPackageStatus.individual}`);

console.log('\nBreakdown by Event Ticket ID:');
console.log('-----------------------------');
Object.entries(ticketsByEventId)
    .sort((a, b) => b[1].totalQuantity - a[1].totalQuantity)
    .forEach(([eventId, info]) => {
        console.log(`\nEvent Ticket ID: ${eventId}`);
        console.log(`  Records: ${info.count}`);
        console.log(`  Total Quantity: ${info.totalQuantity}`);
        console.log(`  Type: ${info.isPackage ? 'Package' : 'Individual'}`);
        console.log(`  Price: $${info.price}`);
    });