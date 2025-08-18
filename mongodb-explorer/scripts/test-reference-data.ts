#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { ReferenceDataService } from '../src/services/sync/reference-data-service';

dotenv.config({ path: '.env.local' });

async function testReferenceData() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('🧪 REFERENCE DATA SERVICE TEST');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Database: ${db.databaseName}\n`);
    
    // Initialize reference data service
    const referenceService = new ReferenceDataService(db);
    
    // Test 1: Check available reference collections
    console.log('📚 Available Reference Collections:');
    console.log('────────────────────────────────');
    const collections = ['functions', 'eventTickets', 'events', 'locations', 'lodges', 'organisations'];
    for (const coll of collections) {
      const count = await db.collection(coll).countDocuments();
      console.log(`  ${coll}: ${count} documents`);
    }
    
    // Test 2: Test function lookup
    console.log('\n🔍 Testing Function Lookups:');
    console.log('──────────────────────────');
    
    // Get a sample registration with functionId
    const registration = await db.collection('registrations').findOne({ 
      function_id: { $exists: true, $ne: null } 
    });
    
    if (registration) {
      console.log(`  Registration ID: ${registration.id}`);
      console.log(`  Function ID: ${registration.function_id}`);
      
      const functionDetails = await referenceService.getFunctionDetails(registration.function_id);
      if (functionDetails) {
        console.log(`  ✅ Function Name: ${functionDetails.functionName || functionDetails.name}`);
        console.log(`     Type: ${functionDetails.type || 'N/A'}`);
        console.log(`     Event: ${functionDetails.eventId || 'N/A'}`);
      } else {
        console.log(`  ❌ Function not found for ID: ${registration.function_id}`);
      }
    } else {
      console.log('  No registrations with function_id found');
    }
    
    // Test 3: Test event ticket lookup
    console.log('\n🎫 Testing Event Ticket Lookups:');
    console.log('────────────────────────────────');
    
    // Get a sample ticket with eventTicketId
    const ticket = await db.collection('tickets').findOne({ 
      eventTicketId: { $exists: true, $ne: null } 
    });
    
    if (ticket) {
      console.log(`  Ticket ID: ${ticket.ticketId}`);
      console.log(`  Event Ticket ID: ${ticket.eventTicketId}`);
      
      const eventTicketDetails = await referenceService.getEventTicketDetails(ticket.eventTicketId);
      if (eventTicketDetails) {
        console.log(`  ✅ Event Name: ${eventTicketDetails.eventName}`);
        console.log(`     Price: $${eventTicketDetails.price}`);
        console.log(`     Type: ${eventTicketDetails.ticketType || 'N/A'}`);
      } else {
        console.log(`  ❌ Event ticket not found for ID: ${ticket.eventTicketId}`);
      }
    } else {
      console.log('  No tickets with eventTicketId found');
    }
    
    // Test 4: Test lodge lookup
    console.log('\n🏛️ Testing Lodge Lookups:');
    console.log('────────────────────────');
    
    const attendee = await db.collection('attendees').findOne({ 
      lodge_id: { $exists: true, $ne: null } 
    });
    
    if (attendee) {
      console.log(`  Attendee: ${attendee.firstName} ${attendee.lastName}`);
      console.log(`  Lodge ID: ${attendee.lodge_id}`);
      
      const lodgeDetails = await referenceService.getLodgeDetails(attendee.lodge_id);
      if (lodgeDetails) {
        console.log(`  ✅ Lodge Name: ${lodgeDetails.name}`);
        console.log(`     Lodge Number: ${lodgeDetails.lodgeNumber || 'N/A'}`);
        console.log(`     Grand Lodge: ${lodgeDetails.grandLodgeId || 'N/A'}`);
      } else {
        console.log(`  ❌ Lodge not found for ID: ${attendee.lodge_id}`);
      }
    } else {
      console.log('  No attendees with lodge_id found');
    }
    
    // Test 5: Test caching
    console.log('\n⚡ Testing Cache Performance:');
    console.log('──────────────────────────────');
    
    if (registration && registration.function_id) {
      // First call (database)
      const start1 = Date.now();
      await referenceService.getFunctionDetails(registration.function_id);
      const time1 = Date.now() - start1;
      console.log(`  First lookup (database): ${time1}ms`);
      
      // Second call (cache)
      const start2 = Date.now();
      await referenceService.getFunctionDetails(registration.function_id);
      const time2 = Date.now() - start2;
      console.log(`  Second lookup (cache): ${time2}ms`);
      console.log(`  Speed improvement: ${Math.round((time1 - time2) / time1 * 100)}%`);
    }
    
    // Test 6: Check cache stats
    const cacheStats = referenceService.getCacheStats();
    console.log('\n📊 Cache Statistics:');
    console.log('───────────────────');
    console.log(`  Entries: ${cacheStats.size}`);
    console.log(`  Collections cached: ${cacheStats.keys.join(', ')}`);
    
    // Test 7: Run a quick sync test
    console.log('\n🔄 Testing in Sync Context:');
    console.log('──────────────────────────');
    
    const importReg = await db.collection('import_registrations').findOne({});
    if (importReg) {
      console.log(`  Import Registration: ${importReg.id}`);
      
      // Check if functionName was added
      if (importReg.functionName) {
        console.log(`  ✅ Function Name in import: ${importReg.functionName}`);
      } else {
        console.log(`  ⚠️  No functionName in import registration`);
      }
      
      // Check attendees for function names
      const importAttendee = await db.collection('import_attendees').findOne({
        'registrations.registrationId': importReg.id
      });
      
      if (importAttendee && importAttendee.functionName) {
        console.log(`  ✅ Function Name in attendee: ${importAttendee.functionName}`);
      } else {
        console.log(`  ⚠️  No functionName in import attendee`);
      }
    }
    
    console.log('\n✅ Reference Data Service Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

testReferenceData().catch(console.error);