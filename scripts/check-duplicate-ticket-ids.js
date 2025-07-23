const fs = require('fs');
const path = require('path');

// Define file paths
const files = {
    'all-tickets.json': path.join(__dirname, '../supabase-ticket-analysis/all-tickets.json'),
    'lodge-tickets.json': path.join(__dirname, '../supabase-ticket-analysis/lodge-tickets.json'),
    'package-tickets.json': path.join(__dirname, '../supabase-ticket-analysis/package-tickets.json')
};

// Function to extract tickets from each file based on its structure
function extractTickets(filename, data) {
    if (filename === 'lodge-tickets.json' || filename === 'package-tickets.json') {
        return data.tickets || [];
    }
    return data;
}

// Collect all ticket IDs from all files
const allTicketIds = {};
const duplicatesWithinFiles = {};
const ticketsByFile = {};

// Process each file
Object.entries(files).forEach(([filename, filepath]) => {
    try {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        const tickets = extractTickets(filename, data);
        
        ticketsByFile[filename] = {};
        duplicatesWithinFiles[filename] = [];
        
        tickets.forEach((item, index) => {
            if (item.ticket && item.ticket.id) {
                const ticketId = item.ticket.id;
                
                // Track within file
                if (ticketsByFile[filename][ticketId]) {
                    ticketsByFile[filename][ticketId].push(index);
                    if (ticketsByFile[filename][ticketId].length === 2) {
                        duplicatesWithinFiles[filename].push(ticketId);
                    }
                } else {
                    ticketsByFile[filename][ticketId] = [index];
                }
                
                // Track across all files
                if (!allTicketIds[ticketId]) {
                    allTicketIds[ticketId] = [];
                }
                allTicketIds[ticketId].push({
                    file: filename,
                    index: index,
                    registrationId: item.registrationId,
                    ticketName: item.ticket.name || 'N/A',
                    eventTicketId: item.ticket.eventTicketId,
                    quantity: item.ticket.quantity,
                    price: item.ticket.price
                });
            }
        });
    } catch (error) {
        console.error(`Error reading ${filename}:`, error.message);
    }
});

// Find duplicates across files
const duplicatesAcrossFiles = {};
Object.entries(allTicketIds).forEach(([ticketId, occurrences]) => {
    const uniqueFiles = [...new Set(occurrences.map(o => o.file))];
    if (uniqueFiles.length > 1) {
        duplicatesAcrossFiles[ticketId] = occurrences;
    }
});

// Display results
console.log('Ticket ID Duplication Analysis');
console.log('==============================\n');

// Duplicates within each file
console.log('1. DUPLICATES WITHIN FILES:');
console.log('---------------------------');
Object.entries(duplicatesWithinFiles).forEach(([filename, duplicates]) => {
    console.log(`\n${filename}: ${duplicates.length} duplicate IDs`);
    if (duplicates.length > 0) {
        duplicates.forEach(ticketId => {
            const indices = ticketsByFile[filename][ticketId];
            console.log(`  - ID: ${ticketId} (appears ${indices.length} times at indices: ${indices.join(', ')})`);
        });
    }
});

// Duplicates across files
console.log('\n\n2. DUPLICATES ACROSS FILES:');
console.log('---------------------------');
const crossFileDuplicateCount = Object.keys(duplicatesAcrossFiles).length;
console.log(`Found ${crossFileDuplicateCount} ticket IDs that appear in multiple files\n`);

if (crossFileDuplicateCount > 0) {
    Object.entries(duplicatesAcrossFiles).forEach(([ticketId, occurrences]) => {
        console.log(`\nTicket ID: ${ticketId}`);
        occurrences.forEach(occ => {
            console.log(`  - File: ${occ.file}`);
            console.log(`    Index: ${occ.index}`);
            console.log(`    Registration ID: ${occ.registrationId}`);
            console.log(`    Ticket Name: ${occ.ticketName}`);
            console.log(`    Event Ticket ID: ${occ.eventTicketId}`);
            console.log(`    Quantity: ${occ.quantity}`);
            console.log(`    Price: $${occ.price}`);
        });
    });
}

// Summary statistics
console.log('\n\n3. SUMMARY STATISTICS:');
console.log('----------------------');
const totalUniqueIds = Object.keys(allTicketIds).length;
console.log(`Total unique ticket IDs across all files: ${totalUniqueIds}`);
Object.entries(ticketsByFile).forEach(([filename, tickets]) => {
    console.log(`${filename}: ${Object.keys(tickets).length} unique ticket IDs`);
});