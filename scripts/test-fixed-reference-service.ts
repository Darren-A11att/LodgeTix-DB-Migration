#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { ReferenceDataService } from '../src/services/sync/reference-data-service';

dotenv.config({ path: '.env.local' });

async function testFixedReferenceService() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('🧪 TESTING FIXED REFERENCE DATA SERVICE');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Database: ${db.databaseName}\n`);
    
    // Initialize reference data service
    const referenceService = new ReferenceDataService(db);
    
    // Test 1: Check collection structure
    console.log('📚 Checking Collection Field Structure:');
    console.log('────────────────────────────────────────');
    
    // Check functions collection
    const functionSample = await db.collection('functions').findOne({});
    if (functionSample) {
      console.log(`Functions collection sample fields: ${Object.keys(functionSample).join(', ')}`);
      if (functionSample.functionId) {
        console.log(`  Sample functionId: ${functionSample.functionId}`);
        
        // Test the lookup
        const functionDetails = await referenceService.getFunctionDetails(functionSample.functionId);
        if (functionDetails) {
          console.log(`  ✅ Function lookup successful: ${functionDetails.functionName || functionDetails.name}`);
        } else {
          console.log(`  ❌ Function lookup failed`);
        }
      }
    } else {
      console.log('  No functions found');
    }
    
    // Check eventTickets collection
    const eventTicketSample = await db.collection('eventTickets').findOne({});
    if (eventTicketSample) {
      console.log(`\nEvent Tickets collection sample fields: ${Object.keys(eventTicketSample).join(', ')}`);
      if (eventTicketSample.eventTicketId) {
        console.log(`  Sample eventTicketId: ${eventTicketSample.eventTicketId}`);
        
        // Test the lookup
        const eventTicketDetails = await referenceService.getEventTicketDetails(eventTicketSample.eventTicketId);
        if (eventTicketDetails) {
          console.log(`  ✅ Event ticket lookup successful: ${eventTicketDetails.eventName || 'Unknown event'}`);
        } else {
          console.log(`  ❌ Event ticket lookup failed`);
        }
      }
    } else {
      console.log('\n  No event tickets found');
    }
    
    // Check lodges collection
    const lodgeSample = await db.collection('lodges').findOne({});
    if (lodgeSample) {
      console.log(`\nLodges collection sample fields: ${Object.keys(lodgeSample).join(', ')}`);
      if (lodgeSample.lodgeId) {
        console.log(`  Sample lodgeId: ${lodgeSample.lodgeId}`);
        
        // Test the lookup
        const lodgeDetails = await referenceService.getLodgeDetails(lodgeSample.lodgeId);
        if (lodgeDetails) {
          console.log(`  ✅ Lodge lookup successful: ${lodgeDetails.name}`);
        } else {
          console.log(`  ❌ Lodge lookup failed`);
        }
      }
    } else {
      console.log('\n  No lodges found');
    }
    
    // Test 2: Test with real data from registrations
    console.log('\n🔍 Testing with Real Registration Data:');
    console.log('─────────────────────────────────────────');
    
    const registration = await db.collection('registrations').findOne({ 
      function_id: { $exists: true, $ne: null } 
    });
    
    if (registration) {
      console.log(`  Registration ID: ${registration.id}`);
      console.log(`  Function ID: ${registration.function_id}`);
      
      const functionDetails = await referenceService.getFunctionDetails(registration.function_id);
      if (functionDetails) {
        console.log(`  ✅ Function Name: ${functionDetails.functionName || functionDetails.name}`);
      } else {
        console.log(`  ❌ Function not found for ID: ${registration.function_id}`);
        
        // Check if function exists with this ID
        const directLookup = await db.collection('functions').findOne({ functionId: registration.function_id });
        if (directLookup) {
          console.log(`    Direct lookup successful: ${directLookup.functionName || directLookup.name}`);
        } else {
          console.log(`    Function does not exist in collection`);
        }
      }
    } else {
      console.log('  No registrations with function_id found');
    }
    
    console.log('\n✅ Fixed Reference Data Service Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

testFixedReferenceService().catch(console.error);