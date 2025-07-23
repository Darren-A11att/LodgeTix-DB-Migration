#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function compareTicketSnapshots() {
  const BANQUET_TICKET_ID = 'fd12d7f0-f346-49bf-b1eb-0682ad226216';
  
  // Read both JSON files
  const oldPath = path.join(__dirname, '../supabase-ticket-analysis/all-tickets.json');
  const newPath = path.join(__dirname, '../supabase-ticket-analysis/all-tickets-2307.json');
  
  const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
  const newData = JSON.parse(fs.readFileSync(newPath, 'utf8'));
  
  console.log('=== OVERALL COMPARISON ===');
  console.log(`July 15 snapshot: ${oldData.length} total tickets`);
  console.log(`July 23 snapshot: ${newData.length} total tickets`);
  console.log(`Difference: ${newData.length - oldData.length} tickets\n`);
  
  // Focus on Proclamation Banquet tickets
  const oldBanquet = oldData.filter(item => 
    (item.ticket?.eventTicketId === BANQUET_TICKET_ID) || 
    (item.eventTicketId === BANQUET_TICKET_ID)
  );
  
  const newBanquet = newData.filter(item => 
    item.ticket.eventTicketId === BANQUET_TICKET_ID
  );
  
  // Calculate quantities
  const oldBanquetQty = oldBanquet.reduce((sum, item) => 
    sum + ((item.ticket?.quantity || item.quantity) || 1), 0
  );
  
  const newBanquetQty = newBanquet.reduce((sum, item) => 
    sum + (item.ticket.quantity || 1), 0
  );
  
  console.log('=== PROCLAMATION BANQUET COMPARISON ===');
  console.log(`July 15: ${oldBanquet.length} entries, ${oldBanquetQty} total quantity`);
  console.log(`July 23: ${newBanquet.length} entries, ${newBanquetQty} total quantity`);
  console.log(`Difference: ${newBanquetQty - oldBanquetQty} tickets\n`);
  
  // Find registrations that existed in old but not in new (by registrationId)
  const oldRegIds = new Set(oldBanquet.map(item => item.registrationId));
  const newRegIds = new Set(newBanquet.map(item => item.registrationId));
  
  const removedRegIds = [...oldRegIds].filter(id => !newRegIds.has(id));
  const addedRegIds = [...newRegIds].filter(id => !oldRegIds.has(id));
  
  console.log('=== REGISTRATION CHANGES ===');
  console.log(`Registrations removed: ${removedRegIds.length}`);
  console.log(`Registrations added: ${addedRegIds.length}\n`);
  
  if (removedRegIds.length > 0) {
    console.log('REMOVED REGISTRATIONS:');
    removedRegIds.forEach(regId => {
      const oldTickets = oldBanquet.filter(item => item.registrationId === regId);
      const totalQty = oldTickets.reduce((sum, item) => 
        sum + ((item.ticket?.quantity || item.quantity) || 1), 0
      );
      console.log(`- ${regId}: ${totalQty} banquet tickets`);
    });
    console.log('');
  }
  
  if (addedRegIds.length > 0) {
    console.log('ADDED REGISTRATIONS:');
    addedRegIds.forEach(regId => {
      const newTickets = newBanquet.filter(item => item.registrationId === regId);
      const totalQty = newTickets.reduce((sum, item) => 
        sum + (item.ticket.quantity || 1), 0
      );
      const confirmationNumber = newTickets[0]?.confirmationNumber || 'unknown';
      const createdAt = newTickets[0]?.createdAt ? new Date(newTickets[0].createdAt).toISOString().split('T')[0] : 'unknown';
      console.log(`- ${regId} (${confirmationNumber}, created ${createdAt}): ${totalQty} banquet tickets`);
    });
    console.log('');
  }
  
  // Check for quantity changes in existing registrations
  console.log('=== QUANTITY CHANGES IN EXISTING REGISTRATIONS ===');
  let quantityChanges = 0;
  
  [...oldRegIds].filter(id => newRegIds.has(id)).forEach(regId => {
    const oldTickets = oldBanquet.filter(item => item.registrationId === regId);
    const newTickets = newBanquet.filter(item => item.registrationId === regId);
    
    const oldQty = oldTickets.reduce((sum, item) => 
      sum + ((item.ticket?.quantity || item.quantity) || 1), 0
    );
    const newQty = newTickets.reduce((sum, item) => 
      sum + (item.ticket.quantity || 1), 0
    );
    
    if (oldQty !== newQty) {
      const confirmationNumber = newTickets[0]?.confirmationNumber || 'unknown';
      console.log(`- ${regId} (${confirmationNumber}): ${oldQty} → ${newQty} (${newQty > oldQty ? '+' : ''}${newQty - oldQty})`);
      quantityChanges++;
    }
  });
  
  if (quantityChanges === 0) {
    console.log('No quantity changes found in existing registrations');
  }
  
  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Expected change: +30 tickets (Troy's 20 + Lodge Ionic's 10)`);
  console.log(`Actual change: ${newBanquetQty - oldBanquetQty} tickets`);
  console.log(`Discrepancy: ${(newBanquetQty - oldBanquetQty) - 30} tickets`);
}

// Run comparison
compareTicketSnapshots();