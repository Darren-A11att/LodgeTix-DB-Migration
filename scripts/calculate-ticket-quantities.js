const fs = require('fs');
const path = require('path');

// Read the JSON file
const filePath = path.join(__dirname, '../supabase-ticket-analysis/all-tickets.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Calculate quantities for each unique ticket name
const ticketQuantities = {};

data.forEach(item => {
    if (item.ticket && item.ticket.name && item.ticket.quantity) {
        const ticketName = item.ticket.name;
        const quantity = item.ticket.quantity;
        
        if (ticketQuantities[ticketName]) {
            ticketQuantities[ticketName] += quantity;
        } else {
            ticketQuantities[ticketName] = quantity;
        }
    }
});

// Sort by quantity (descending)
const sortedTickets = Object.entries(ticketQuantities)
    .sort((a, b) => b[1] - a[1]);

// Display results
console.log('Ticket Quantities Summary');
console.log('========================\n');

let totalTickets = 0;
sortedTickets.forEach(([name, quantity]) => {
    console.log(`${name}: ${quantity}`);
    totalTickets += quantity;
});

console.log('\n========================');
console.log(`Total tickets: ${totalTickets}`);
console.log(`Unique ticket types: ${sortedTickets.length}`);