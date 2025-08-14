#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import * as path from 'path';
import { MongoClient } from 'mongodb';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.explorer') });

async function testCollectionBoundaries() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('🔍 TESTING COLLECTION BOUNDARY SEPARATION');
    console.log('=========================================\n');
    
    // Test 1: Check import_attendees IDs
    console.log('1️⃣ Checking import_attendees IDs...');
    const importAttendees = await db.collection('import_attendees').find({}).limit(5).toArray();
    
    for (const attendee of importAttendees) {
      console.log(`  Attendee ID: ${attendee.attendeeId}`);
      
      if (!attendee.attendeeId?.startsWith('import_')) {
        console.log(`    ❌ ISSUE: Attendee ID should start with 'import_'`);
      } else {
        console.log(`    ✅ Correct import ID format`);
      }
      
      if (attendee._productionMeta?.productionObjectId) {
        console.log(`    → Links to production: ${attendee._productionMeta.productionObjectId}`);
      }
    }
    
    // Test 2: Check import_tickets IDs and references
    console.log('\n2️⃣ Checking import_tickets IDs and references...');
    const importTickets = await db.collection('import_tickets').find({}).limit(5).toArray();
    
    for (const ticket of importTickets) {
      console.log(`  Ticket ID: ${ticket.ticketId}`);
      
      if (!ticket.ticketId?.startsWith('import_')) {
        console.log(`    ❌ ISSUE: Ticket ID should start with 'import_'`);
      } else {
        console.log(`    ✅ Correct import ID format`);
      }
      
      // Check attendee reference
      if (ticket.ownerId) {
        if (ticket.ownerId.startsWith('import_')) {
          console.log(`    ✅ Owner reference is import: ${ticket.ownerId}`);
        } else {
          console.log(`    ❌ ISSUE: Owner should reference import_attendee: ${ticket.ownerId}`);
        }
      }
      
      // Check eventTicket reference (should be allowed - constant collection)
      if (ticket.eventTicketId) {
        console.log(`    ℹ️ EventTicket reference (constant): ${ticket.eventTicketId}`);
      }
    }
    
    // Test 3: Check production attendees
    console.log('\n3️⃣ Checking production attendees...');
    const prodAttendees = await db.collection('attendees').find({}).limit(5).toArray();
    
    for (const attendee of prodAttendees) {
      console.log(`  Attendee ID: ${attendee.attendeeId}`);
      
      if (attendee.attendeeId?.startsWith('import_')) {
        console.log(`    ❌ ISSUE: Production should not have import_ IDs`);
      } else if (attendee.attendeeId?.startsWith('prod_')) {
        console.log(`    ⚠️ Legacy format - should use original external ID: ${attendee.attendeeId}`);
      } else {
        console.log(`    ✅ Using original external ID format`);
      }
      
      if (attendee.originalAttendeeId) {
        console.log(`    📋 Original ID: ${attendee.originalAttendeeId}`);
      }
      
      if (attendee._importMeta?.importObjectId) {
        console.log(`    ← Imported from: ${attendee._importMeta.importObjectId}`);
      }
    }
    
    // Test 4: Check production tickets
    console.log('\n4️⃣ Checking production tickets...');
    const prodTickets = await db.collection('tickets').find({}).limit(5).toArray();
    
    for (const ticket of prodTickets) {
      console.log(`  Ticket ID: ${ticket.ticketId}`);
      
      if (ticket.ticketId?.startsWith('import_')) {
        console.log(`    ❌ ISSUE: Production should not have import_ IDs`);
      } else if (ticket.ticketId?.startsWith('prod_')) {
        console.log(`    ⚠️ Legacy format - should use original external ID: ${ticket.ticketId}`);
      } else {
        console.log(`    ✅ Using original external ID format`);
      }
      
      if (ticket.originalTicketId) {
        console.log(`    📋 Original ID: ${ticket.originalTicketId}`);
      }
      
      // Check attendee reference
      if (ticket.ownerId) {
        if (ticket.ownerId.startsWith('import_')) {
          console.log(`    ❌ ISSUE: Owner should not reference import_: ${ticket.ownerId}`);
        } else if (ticket.ownerId.startsWith('prod_')) {
          console.log(`    ⚠️ Legacy owner format - should use original attendee ID: ${ticket.ownerId}`);
        } else {
          console.log(`    ✅ Owner references original attendee ID: ${ticket.ownerId}`);
        }
      }
      
      // Check details.attendeeId reference
      if (ticket.details?.attendeeId) {
        if (ticket.details.attendeeId.startsWith('import_')) {
          console.log(`    ❌ ISSUE: Details attendeeId should not reference import_: ${ticket.details.attendeeId}`);
        } else if (ticket.details.attendeeId.startsWith('prod_')) {
          console.log(`    ⚠️ Legacy details format - should use original attendee ID: ${ticket.details.attendeeId}`);
        } else {
          console.log(`    ✅ Details attendeeId references original ID: ${ticket.details.attendeeId}`);
        }
      }
    }
    
    // Test 5: Summary
    console.log('\n📊 SUMMARY');
    console.log('==========');
    
    const importAttendeesCount = await db.collection('import_attendees').countDocuments({});
    const importTicketsCount = await db.collection('import_tickets').countDocuments({});
    const prodAttendeesCount = await db.collection('attendees').countDocuments({});
    const prodTicketsCount = await db.collection('tickets').countDocuments({});
    
    console.log(`Import Collections:`);
    console.log(`  import_attendees: ${importAttendeesCount} documents`);
    console.log(`  import_tickets: ${importTicketsCount} documents`);
    
    console.log(`\nProduction Collections:`);
    console.log(`  attendees: ${prodAttendeesCount} documents`);
    console.log(`  tickets: ${prodTicketsCount} documents`);
    
    // Check for cross-boundary references
    console.log('\n🔗 Cross-Boundary Check:');
    
    // Check if any import ticket references a production attendee
    const crossBoundaryTickets = await db.collection('import_tickets').countDocuments({
      ownerId: { $not: { $regex: '^import_' } }
    });
    
    if (crossBoundaryTickets > 0) {
      console.log(`  ❌ Found ${crossBoundaryTickets} import tickets referencing non-import attendees`);
    } else {
      console.log(`  ✅ No import tickets referencing production attendees`);
    }
    
    // Check if any production ticket references an import attendee
    const crossBoundaryProdTickets = await db.collection('tickets').countDocuments({
      ownerId: { $regex: '^import_' }
    });
    
    if (crossBoundaryProdTickets > 0) {
      console.log(`  ❌ Found ${crossBoundaryProdTickets} production tickets referencing import attendees`);
    } else {
      console.log(`  ✅ No production tickets referencing import attendees`);
    }
    
    // Check ID format consistency
    console.log('\n🏷️ ID Format Check:');
    
    // Check for legacy "prod_" prefixes in production
    const legacyProdAttendees = await db.collection('attendees').countDocuments({
      attendeeId: { $regex: '^prod_' }
    });
    
    const legacyProdTickets = await db.collection('tickets').countDocuments({
      ticketId: { $regex: '^prod_' }
    });
    
    if (legacyProdAttendees > 0) {
      console.log(`  ⚠️ Found ${legacyProdAttendees} production attendees with legacy "prod_" prefix`);
    } else {
      console.log(`  ✅ No production attendees using legacy "prod_" prefix`);
    }
    
    if (legacyProdTickets > 0) {
      console.log(`  ⚠️ Found ${legacyProdTickets} production tickets with legacy "prod_" prefix`);
    } else {
      console.log(`  ✅ No production tickets using legacy "prod_" prefix`);
    }
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

testCollectionBoundaries().catch(console.error);