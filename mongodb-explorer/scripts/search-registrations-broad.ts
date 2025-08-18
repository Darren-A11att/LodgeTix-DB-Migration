#!/usr/bin/env npx tsx

import { MongoClient, ObjectId } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function searchRegistrationsBroad() {
  let mongoClient: MongoClient | null = null;

  try {
    console.log('🔗 Connecting to MongoDB...');
    mongoClient = new MongoClient(process.env.MONGODB_URI!);
    await mongoClient.connect();

    const lodgetixDb = mongoClient.db('lodgetix');
    const targetId = "6886bd91bc34c2425617c25e";
    
    console.log(`🔍 Searching broadly for patterns related to: ${targetId}`);
    
    // Search for any records that might reference this ID
    console.log('\n📋 Searching in import_registrations for any reference...');
    const importRegs = await lodgetixDb.collection('import_registrations').find({
      $or: [
        { _id: targetId as any },
        { originalId: targetId },
        { sourceId: targetId },
        { "metadata.originalId": targetId }
      ]
    }).limit(5).toArray();
    
    if (importRegs.length > 0) {
      console.log(`✅ Found ${importRegs.length} import_registrations:`);
      importRegs.forEach((reg, index) => {
        console.log(`  Import Registration ${index + 1}:`);
        console.log(`    _id: ${reg._id}`);
        console.log(`    registrationId: ${reg.registrationId || 'N/A'}`);
        console.log(`    originalId: ${reg.originalId || 'N/A'}`);
        console.log(`    status: ${reg.status || 'N/A'}`);
        console.log('');
      });
    }
    
    // Search error_registrations
    console.log('📋 Searching in error_registrations...');
    const errorRegs = await lodgetixDb.collection('error_registrations').find({
      $or: [
        { _id: targetId as any },
        { originalId: targetId },
        { sourceId: targetId },
        { "data.originalId": targetId }
      ]
    }).limit(5).toArray();
    
    if (errorRegs.length > 0) {
      console.log(`✅ Found ${errorRegs.length} error_registrations:`);
      errorRegs.forEach((reg, index) => {
        console.log(`  Error Registration ${index + 1}:`);
        console.log(`    _id: ${reg._id}`);
        console.log(`    registrationId: ${reg.registrationId || 'N/A'}`);
        console.log(`    error: ${reg.error || 'N/A'}`);
        console.log('');
      });
    }
    
    // Let's also check if we can find any registrations with similar timestamp or pattern
    console.log('\n🔍 Searching for registrations with similar ObjectId timestamp...');
    try {
      const targetObjectId = new ObjectId(targetId);
      const timestamp = targetObjectId.getTimestamp();
      console.log(`Target timestamp: ${timestamp}`);
      
      // Find registrations created around the same time (within 1 hour)
      const timeRange = 60 * 60 * 1000; // 1 hour in milliseconds
      const startTime = new Date(timestamp.getTime() - timeRange);
      const endTime = new Date(timestamp.getTime() + timeRange);
      
      const nearbyRegs = await lodgetixDb.collection('registrations').find({
        createdAt: {
          $gte: startTime,
          $lte: endTime
        }
      }).limit(10).toArray();
      
      if (nearbyRegs.length > 0) {
        console.log(`✅ Found ${nearbyRegs.length} registrations created around the same time:`);
        nearbyRegs.forEach((reg, index) => {
          console.log(`  Registration ${index + 1}:`);
          console.log(`    _id: ${reg._id}`);
          console.log(`    registrationId: ${reg.registrationId || 'N/A'}`);
          console.log(`    createdAt: ${reg.createdAt || 'N/A'}`);
          console.log('');
        });
      }
    } catch (error) {
      console.log(`❌ ObjectId timestamp search failed: ${error}`);
    }
    
    // Let's also just grab some sample registrations to see what registrationIds look like
    console.log('\n📋 Sample registrations to understand registrationId format:');
    const sampleRegs = await lodgetixDb.collection('registrations').find({
      registrationId: { $exists: true }
    }).limit(5).toArray();
    
    sampleRegs.forEach((reg, index) => {
      console.log(`Sample Registration ${index + 1}:`);
      console.log(`  _id: ${reg._id}`);
      console.log(`  registrationId: ${reg.registrationId}`);
      console.log(`  event: ${reg.eventName || reg.event || 'N/A'}`);
      console.log('');
    });
    
    // If we found any registrationIds, let's trace one as an example
    if (sampleRegs.length > 0 && sampleRegs[0].registrationId) {
      console.log(`🔍 Tracing sample registrationId: ${sampleRegs[0].registrationId}`);
      await traceRegistrationId(sampleRegs[0].registrationId, lodgetixDb);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

async function traceRegistrationId(registrationId: string, lodgetixDb: any) {
  console.log(`\n🔍 Cross-system trace for registrationId: ${registrationId}`);
  console.log('='.repeat(60));
  
  const findings = {
    errorRegistrations: null,
    importRegistrations: null,
    productionRegistrations: null,
    supabaseRegistrations: null
  };
  
  // Search in error_registrations
  const errorReg = await lodgetixDb.collection('error_registrations').findOne({
    registrationId: registrationId
  });
  findings.errorRegistrations = errorReg;
  console.log(`📋 error_registrations: ${errorReg ? '✅ Found' : '❌ Not found'}`);
  if (errorReg) {
    console.log(`   Error: ${errorReg.error || 'No error message'}`);
    console.log(`   Created: ${errorReg.createdAt || 'No timestamp'}`);
  }
  
  // Search in import_registrations
  const importReg = await lodgetixDb.collection('import_registrations').findOne({
    registrationId: registrationId
  });
  findings.importRegistrations = importReg;
  console.log(`📋 import_registrations: ${importReg ? '✅ Found' : '❌ Not found'}`);
  if (importReg) {
    console.log(`   Status: ${importReg.status || 'No status'}`);
    console.log(`   Imported: ${importReg.imported || 'No flag'}`);
  }
  
  // Search in production registrations
  const prodReg = await lodgetixDb.collection('registrations').findOne({
    registrationId: registrationId
  });
  findings.productionRegistrations = prodReg;
  console.log(`📋 production registrations: ${prodReg ? '✅ Found' : '❌ Not found'}`);
  if (prodReg) {
    console.log(`   Status: ${prodReg.status || 'No status'}`);
    console.log(`   Event: ${prodReg.eventName || prodReg.event || 'No event'}`);
  }
  
  // Check Supabase
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: supabaseReg, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('registration_id', registrationId)
      .single();

    findings.supabaseRegistrations = supabaseReg;
    console.log(`🗃️ supabase registrations: ${supabaseReg && !error ? '✅ Found' : '❌ Not found'}`);
    if (supabaseReg) {
      console.log(`   ID: ${supabaseReg.id}`);
      console.log(`   Status: ${supabaseReg.status || 'No status'}`);
      console.log(`   Event ID: ${supabaseReg.event_id || 'No event ID'}`);
    } else if (error && error.code !== 'PGRST116') {
      console.log(`   Error: ${error.message}`);
    }
  } catch (error) {
    console.log(`❌ Supabase check failed: ${error}`);
  }
  
  // Summary
  console.log('\n🎯 SUMMARY:');
  console.log('-'.repeat(40));
  const foundIn = [];
  const missingFrom = [];
  
  if (findings.errorRegistrations) foundIn.push('error_registrations');
  else missingFrom.push('error_registrations');
  
  if (findings.importRegistrations) foundIn.push('import_registrations');
  else missingFrom.push('import_registrations');
  
  if (findings.productionRegistrations) foundIn.push('production_registrations');
  else missingFrom.push('production_registrations');
  
  if (findings.supabaseRegistrations) foundIn.push('supabase_registrations');
  else missingFrom.push('supabase_registrations');
  
  console.log(`✅ Found in: ${foundIn.join(', ') || 'None'}`);
  console.log(`❌ Missing from: ${missingFrom.join(', ') || 'None'}`);
  
  if (foundIn.length === 0) {
    console.log('⚠️ Registration not found in any system!');
  } else if (missingFrom.length === 0) {
    console.log('🎉 Registration found in ALL systems');
  } else {
    console.log('⚠️ Registration partially synced');
  }
}

searchRegistrationsBroad();