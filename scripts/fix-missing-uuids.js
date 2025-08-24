#!/usr/bin/env node

/**
 * Fix Missing UUIDs Script
 * 
 * This script:
 * 1. Generates UUIDv4 for contacts missing contactId
 * 2. Generates UUIDv4 for tickets with compound IDs (eventTicketId-attendeeId)
 */

const { MongoClient, ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function fixContactIds(db) {
  console.log('\n📋 Fixing Contact IDs...\n');
  
  const contacts = db.collection('contacts');
  
  // Count contacts without contactId
  const missingContactId = await contacts.countDocuments({
    $or: [
      { contactId: { $exists: false } },
      { contactId: null },
      { contactId: '' }
    ]
  });
  
  console.log(`  Found ${missingContactId} contacts without valid contactId`);
  
  if (missingContactId > 0) {
    console.log('  Generating UUIDv4 for each contact...\n');
    
    // Find all contacts without contactId
    const contactsToFix = await contacts.find({
      $or: [
        { contactId: { $exists: false } },
        { contactId: null },
        { contactId: '' }
      ]
    }).toArray();
    
    let fixed = 0;
    let errors = 0;
    
    for (const contact of contactsToFix) {
      try {
        const newContactId = uuidv4();
        
        await contacts.updateOne(
          { _id: contact._id },
          { 
            $set: { 
              contactId: newContactId,
              updatedAt: new Date(),
              _metadata: {
                ...contact._metadata,
                contactIdGenerated: true,
                contactIdGeneratedAt: new Date()
              }
            }
          }
        );
        
        fixed++;
        
        if (fixed <= 5) {
          console.log(`    ✅ Contact ${contact._id}: assigned ${newContactId}`);
        } else if (fixed === 6) {
          console.log(`    ... processing remaining contacts ...`);
        }
        
      } catch (error) {
        errors++;
        console.error(`    ❌ Failed to update contact ${contact._id}: ${error.message}`);
      }
    }
    
    console.log(`\n  Summary: Fixed ${fixed} contacts, ${errors} errors`);
  } else {
    console.log('  ✅ All contacts already have valid contactId');
  }
  
  return missingContactId;
}

async function fixTicketIds(db) {
  console.log('\n📋 Fixing Ticket IDs...\n');
  
  const tickets = db.collection('tickets');
  
  // Check for compound ticketIds (containing hyphen pattern like xxx-xxx)
  const sampleTicket = await tickets.findOne({});
  let needsFix = false;
  
  if (sampleTicket && sampleTicket.ticketId) {
    // Check if ticketId is not a valid UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sampleTicket.ticketId);
    
    if (!isValidUUID) {
      needsFix = true;
      console.log(`  Sample ticketId format: ${sampleTicket.ticketId}`);
      console.log('  This appears to be a compound ID, not a valid UUID');
    }
  }
  
  // Count tickets with invalid ticketId
  const allTickets = await tickets.find({}).toArray();
  let invalidTickets = 0;
  
  for (const ticket of allTickets) {
    if (!ticket.ticketId || !isValidUUID(ticket.ticketId)) {
      invalidTickets++;
    }
  }
  
  console.log(`  Found ${invalidTickets} tickets with invalid/missing ticketId`);
  
  if (invalidTickets > 0) {
    console.log('  Generating UUIDv4 for each ticket...\n');
    
    let fixed = 0;
    let errors = 0;
    
    for (const ticket of allTickets) {
      if (!ticket.ticketId || !isValidUUID(ticket.ticketId)) {
        try {
          const newTicketId = uuidv4();
          const originalTicketId = ticket.ticketId || 'missing';
          
          await tickets.updateOne(
            { _id: ticket._id },
            { 
              $set: { 
                ticketId: newTicketId,
                originalCompoundId: originalTicketId,  // Preserve original for reference
                updatedAt: new Date(),
                _metadata: {
                  ...ticket._metadata,
                  ticketIdGenerated: true,
                  ticketIdGeneratedAt: new Date(),
                  originalTicketId: originalTicketId
                }
              }
            }
          );
          
          fixed++;
          
          if (fixed <= 5) {
            console.log(`    ✅ Ticket ${ticket._id}:`);
            console.log(`       Original: ${originalTicketId}`);
            console.log(`       New UUID: ${newTicketId}`);
          } else if (fixed === 6) {
            console.log(`    ... processing remaining tickets ...`);
          }
          
        } catch (error) {
          errors++;
          console.error(`    ❌ Failed to update ticket ${ticket._id}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n  Summary: Fixed ${fixed} tickets, ${errors} errors`);
  } else {
    console.log('  ✅ All tickets already have valid UUID ticketId');
  }
  
  return invalidTickets;
}

function isValidUUID(value) {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function verifyFixes(db) {
  console.log('\n📊 Verification Results:\n');
  
  // Verify contacts
  const contacts = db.collection('contacts');
  const totalContacts = await contacts.countDocuments({});
  const contactsWithId = await contacts.countDocuments({ 
    contactId: { $exists: true, $ne: null, $ne: '' } 
  });
  
  console.log('  Contacts:');
  console.log(`    Total: ${totalContacts}`);
  console.log(`    With contactId: ${contactsWithId} (${((contactsWithId/totalContacts)*100).toFixed(1)}%)`);
  
  // Sample contact verification
  const sampleContact = await contacts.findOne({ contactId: { $exists: true } });
  if (sampleContact) {
    console.log(`    Sample contactId: ${sampleContact.contactId} ${isValidUUID(sampleContact.contactId) ? '✅' : '❌'}`);
  }
  
  // Verify tickets
  const tickets = db.collection('tickets');
  const totalTickets = await tickets.countDocuments({});
  const ticketsWithValidId = await tickets.find({}).toArray();
  let validCount = 0;
  
  for (const ticket of ticketsWithValidId) {
    if (ticket.ticketId && isValidUUID(ticket.ticketId)) {
      validCount++;
    }
  }
  
  console.log('\n  Tickets:');
  console.log(`    Total: ${totalTickets}`);
  console.log(`    With valid UUID ticketId: ${validCount} (${((validCount/totalTickets)*100).toFixed(1)}%)`);
  
  // Sample ticket verification
  const sampleTicket = await tickets.findOne({ ticketId: { $exists: true } });
  if (sampleTicket) {
    console.log(`    Sample ticketId: ${sampleTicket.ticketId} ${isValidUUID(sampleTicket.ticketId) ? '✅' : '❌'}`);
    if (sampleTicket.originalCompoundId) {
      console.log(`    Original compound ID preserved: ${sampleTicket.originalCompoundId}`);
    }
  }
  
  // Check for any remaining issues
  const remainingContactIssues = await contacts.countDocuments({
    $or: [
      { contactId: { $exists: false } },
      { contactId: null },
      { contactId: '' }
    ]
  });
  
  const remainingTicketIssues = totalTickets - validCount;
  
  console.log('\n  ⚠️  Remaining Issues:');
  console.log(`    Contacts without contactId: ${remainingContactIssues}`);
  console.log(`    Tickets without valid UUID: ${remainingTicketIssues}`);
  
  if (remainingContactIssues === 0 && remainingTicketIssues === 0) {
    console.log('\n  ✅ All issues resolved!');
  }
}

async function main() {
  console.log('🔧 Fix Missing UUIDs Tool');
  console.log('===========================\n');
  console.log('This script will:');
  console.log('1. Generate UUIDv4 for contacts missing contactId');
  console.log('2. Generate UUIDv4 for tickets with compound IDs');
  console.log('3. Preserve original values in metadata');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('\n✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    
    // Fix contacts
    const contactsFixed = await fixContactIds(db);
    
    // Fix tickets  
    const ticketsFixed = await fixTicketIds(db);
    
    // Verify fixes
    await verifyFixes(db);
    
    console.log('\n📊 Overall Summary:');
    console.log(`  Contacts processed: ${contactsFixed}`);
    console.log(`  Tickets processed: ${ticketsFixed}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n✅ Process complete');
  }
}

main().catch(console.error);