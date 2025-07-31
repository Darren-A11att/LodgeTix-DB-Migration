#!/usr/bin/env node

/**
 * Fix tickets array on registrations imported after a specific date
 * Re-transforms selectedTickets to tickets with proper names and prices
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function fixRecentImportTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('=== FIXING TICKETS ON RECENT IMPORTS ===\n');
    
    // The cutoff date
    const cutoffDate = new Date(1753279500249); // 2025-01-22T18:45:00.249Z
    console.log(`Fixing registrations imported after: ${cutoffDate.toISOString()}\n`);
    
    // First, let's see how many registrations need fixing
    const affectedCount = await db.collection('registrations').countDocuments({
      importedAt: { $gte: cutoffDate },
      'registrationData.tickets': { $exists: true }
    });
    
    const withBadTickets = await db.collection('registrations').countDocuments({
      importedAt: { $gte: cutoffDate },
      'registrationData.tickets.name': 'Unknown Ticket'
    });
    
    console.log(`Total registrations imported after cutoff: ${affectedCount}`);
    console.log(`Registrations with "Unknown Ticket": ${withBadTickets}\n`);
    
    // Get event tickets for mapping names and prices
    console.log('Loading eventTickets for mapping...');
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    const ticketMap = new Map();
    
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      // Handle MongoDB Decimal128 type
      let price = 0;
      if (ticket.price) {
        if (ticket.price.$numberDecimal) {
          price = parseFloat(ticket.price.$numberDecimal);
        } else if (ticket.price.toString) {
          // Handle Decimal128 object
          price = parseFloat(ticket.price.toString());
        } else {
          price = parsePrice(ticket.price);
        }
      }
      
      if (ticketId) {
        ticketMap.set(ticketId, {
          name: ticket.name,
          price: price,
          description: ticket.description || ''
        });
      }
    });
    
    console.log(`Created ticketMap with ${ticketMap.size} event tickets\n`);
    
    // Find all registrations that need fixing
    const registrationsToFix = await db.collection('registrations').find({
      importedAt: { $gte: cutoffDate },
      'registrationData.tickets': { $exists: true }
    }).toArray();
    
    console.log(`Found ${registrationsToFix.length} registrations to check\n`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const registration of registrationsToFix) {
      try {
        const regData = registration.registrationData || registration.registration_data;
        
        if (!regData || !regData.tickets || regData.tickets.length === 0) {
          skippedCount++;
          continue;
        }
        
        // Check if this registration needs fixing
        const hasUnknownTickets = regData.tickets.some(t => t.name === 'Unknown Ticket');
        const hasBadPrices = regData.tickets.some(t => t.price === 0 && ticketMap.has(t.eventTicketId) && ticketMap.get(t.eventTicketId).price > 0);
        
        if (!hasUnknownTickets && !hasBadPrices) {
          skippedCount++;
          continue;
        }
        
        // Fix the tickets
        const fixedTickets = regData.tickets.map(ticket => {
          const ticketInfo = ticketMap.get(ticket.eventTicketId);
          
          if (ticketInfo) {
            return {
              ...ticket,
              name: ticketInfo.name,
              price: ticketInfo.price
            };
          }
          
          return ticket;
        });
        
        // Update the registration
        const updatePath = registration.registrationData ? 'registrationData' : 'registration_data';
        
        await db.collection('registrations').updateOne(
          { _id: registration._id },
          { 
            $set: { 
              [`${updatePath}.tickets`]: fixedTickets 
            }
          }
        );
        
        fixedCount++;
        
        if (fixedCount <= 5) {
          console.log(`Fixed registration ${registration.confirmationNumber}:`);
          console.log(`  Before: ${regData.tickets.filter(t => t.name === 'Unknown Ticket').length} unknown tickets`);
          console.log(`  After: ${fixedTickets.filter(t => t.name === 'Unknown Ticket').length} unknown tickets`);
          const summary = {};
          fixedTickets.forEach(t => {
            const key = `${t.name} ($${t.price})`;
            summary[key] = (summary[key] || 0) + 1;
          });
          Object.entries(summary).forEach(([name, count]) => {
            console.log(`  - ${name}: ${count} tickets`);
          });
          console.log();
        }
        
      } catch (error) {
        console.error(`Error fixing registration ${registration._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n=== FIX COMPLETE ===');
    console.log(`Total registrations checked: ${registrationsToFix.length}`);
    console.log(`Successfully fixed: ${fixedCount}`);
    console.log(`Skipped (already correct): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Verify the fix
    console.log('\n=== VERIFICATION ===');
    
    const stillBadCount = await db.collection('registrations').countDocuments({
      importedAt: { $gte: cutoffDate },
      'registrationData.tickets.name': 'Unknown Ticket'
    });
    
    console.log(`Registrations still with "Unknown Ticket": ${stillBadCount}`);
    
    if (stillBadCount > 0) {
      // Show a sample of remaining issues
      const sample = await db.collection('registrations').findOne({
        importedAt: { $gte: cutoffDate },
        'registrationData.tickets.name': 'Unknown Ticket'
      });
      
      if (sample) {
        console.log('\nSample registration still with unknown tickets:');
        console.log(`Confirmation: ${sample.confirmationNumber}`);
        const unknownTickets = sample.registrationData.tickets.filter(t => t.name === 'Unknown Ticket');
        console.log(`Unknown tickets: ${unknownTickets.length}`);
        unknownTickets.slice(0, 3).forEach(t => {
          console.log(`  - EventTicketId: ${t.eventTicketId} (not found in eventTickets collection)`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

/**
 * Parse price value (handle various formats)
 */
function parsePrice(price) {
  if (price === null || price === undefined) return 0;
  if (typeof price === 'number') return price;
  if (typeof price === 'string') {
    const cleaned = price.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
  return 0;
}

// Run the fix
fixRecentImportTickets()
  .then(() => {
    console.log('\n✅ Fix completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });