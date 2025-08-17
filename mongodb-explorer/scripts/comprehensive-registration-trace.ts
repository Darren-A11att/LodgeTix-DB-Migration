#!/usr/bin/env npx tsx

import { MongoClient, ObjectId } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

interface TraceResult {
  sourceRecord: any;
  registrationId: string;
  foundInErrorRegistrations: any | null;
  foundInImportRegistrations: any | null;
  foundInProductionRegistrations: any | null;
  foundInSupabase: any | null;
  summary: {
    locations: string[];
    missing: string[];
  };
}

async function comprehensiveTrace(): Promise<TraceResult> {
  const result: TraceResult = {
    sourceRecord: null,
    registrationId: '',
    foundInErrorRegistrations: null,
    foundInImportRegistrations: null,
    foundInProductionRegistrations: null,
    foundInSupabase: null,
    summary: {
      locations: [],
      missing: []
    }
  };

  let mongoClient: MongoClient | null = null;

  try {
    console.log('🔗 Connecting to MongoDB...');
    mongoClient = new MongoClient(process.env.MONGODB_URI!);
    await mongoClient.connect();

    const targetId = "6886bd91bc34c2425617c25e";
    
    // Step 1: Find the source record
    console.log(`🔍 Step 1: Locating source record with _id: ${targetId}`);
    const sourceDb = mongoClient.db('LodgeTix-migration-test-1');
    const sourceRecord = await sourceDb.collection('registrations').findOne({
      _id: new ObjectId(targetId)
    });

    if (!sourceRecord) {
      throw new Error(`Source record not found with _id: ${targetId}`);
    }

    result.sourceRecord = sourceRecord;
    result.registrationId = sourceRecord.registrationId;
    
    console.log(`✅ Found source record!`);
    console.log(`   Database: LodgeTix-migration-test-1`);
    console.log(`   Collection: registrations`);
    console.log(`   _id: ${sourceRecord._id}`);
    console.log(`   registrationId: ${sourceRecord.registrationId}`);
    console.log(`   status: ${sourceRecord.status || 'N/A'}`);
    console.log(`   customerId: ${sourceRecord.customerId || 'N/A'}`);
    console.log(`   registrationDate: ${sourceRecord.registrationDate || 'N/A'}`);
    console.log(`   totalAmountPaid: ${sourceRecord.totalAmountPaid || 'N/A'}`);

    // Step 2: Search across target systems
    console.log(`\n🔍 Step 2: Searching for registrationId: ${result.registrationId} across target systems`);
    console.log('='.repeat(80));

    const lodgetixDb = mongoClient.db('lodgetix');

    // Search in error_registrations
    console.log('\n📋 Checking error_registrations collection...');
    const errorRegistration = await lodgetixDb.collection('error_registrations').findOne({
      registrationId: result.registrationId
    });
    
    if (errorRegistration) {
      result.foundInErrorRegistrations = errorRegistration;
      result.summary.locations.push('error_registrations');
      console.log(`✅ FOUND in error_registrations`);
      console.log(`   _id: ${errorRegistration._id}`);
      console.log(`   error: ${errorRegistration.error || 'No error message'}`);
      console.log(`   createdAt: ${errorRegistration.createdAt || 'No timestamp'}`);
      console.log(`   data keys: ${Object.keys(errorRegistration).join(', ')}`);
    } else {
      result.summary.missing.push('error_registrations');
      console.log(`❌ NOT found in error_registrations`);
    }

    // Search in import_registrations
    console.log('\n📋 Checking import_registrations collection...');
    const importRegistration = await lodgetixDb.collection('import_registrations').findOne({
      registrationId: result.registrationId
    });
    
    if (importRegistration) {
      result.foundInImportRegistrations = importRegistration;
      result.summary.locations.push('import_registrations');
      console.log(`✅ FOUND in import_registrations`);
      console.log(`   _id: ${importRegistration._id}`);
      console.log(`   status: ${importRegistration.status || 'No status'}`);
      console.log(`   imported: ${importRegistration.imported || 'No flag'}`);
      console.log(`   createdAt: ${importRegistration.createdAt || 'No timestamp'}`);
      console.log(`   data keys: ${Object.keys(importRegistration).join(', ')}`);
    } else {
      result.summary.missing.push('import_registrations');
      console.log(`❌ NOT found in import_registrations`);
    }

    // Search in production registrations
    console.log('\n📋 Checking production registrations collection...');
    const productionRegistration = await lodgetixDb.collection('registrations').findOne({
      registrationId: result.registrationId
    });
    
    if (productionRegistration) {
      result.foundInProductionRegistrations = productionRegistration;
      result.summary.locations.push('production_registrations');
      console.log(`✅ FOUND in production registrations`);
      console.log(`   _id: ${productionRegistration._id}`);
      console.log(`   status: ${productionRegistration.status || 'No status'}`);
      console.log(`   event: ${productionRegistration.eventName || productionRegistration.event || 'No event'}`);
      console.log(`   customerId: ${productionRegistration.customerId || 'No customer'}`);
      console.log(`   data keys: ${Object.keys(productionRegistration).join(', ')}`);
    } else {
      result.summary.missing.push('production_registrations');
      console.log(`❌ NOT found in production registrations`);
    }

    // Step 3: Search in Supabase
    console.log('\n📋 Checking Supabase registrations table...');
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: supabaseRegistration, error: supabaseError } = await supabase
        .from('registrations')
        .select('*')
        .eq('registration_id', result.registrationId)
        .single();

      if (supabaseRegistration && !supabaseError) {
        result.foundInSupabase = supabaseRegistration;
        result.summary.locations.push('supabase_registrations');
        console.log(`✅ FOUND in Supabase registrations`);
        console.log(`   id: ${supabaseRegistration.id}`);
        console.log(`   status: ${supabaseRegistration.status || 'No status'}`);
        console.log(`   event_id: ${supabaseRegistration.event_id || 'No event ID'}`);
        console.log(`   customer_id: ${supabaseRegistration.customer_id || 'No customer ID'}`);
        console.log(`   created_at: ${supabaseRegistration.created_at || 'No timestamp'}`);
        console.log(`   updated_at: ${supabaseRegistration.updated_at || 'No timestamp'}`);
      } else {
        result.summary.missing.push('supabase_registrations');
        console.log(`❌ NOT found in Supabase registrations`);
        if (supabaseError && supabaseError.code !== 'PGRST116') {
          console.log(`   Error: ${supabaseError.message}`);
        }
      }
    } catch (error) {
      result.summary.missing.push('supabase_registrations');
      console.log(`❌ Supabase check failed: ${error}`);
    }

  } catch (error) {
    console.error('❌ Error during comprehensive trace:', error);
    throw error;
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }

  return result;
}

async function main() {
  try {
    console.log('🚀 COMPREHENSIVE REGISTRATION TRACE REPORT');
    console.log('='.repeat(80));
    console.log('Tracing registration from test database across all systems...\n');
    
    const result = await comprehensiveTrace();
    
    // Final Report
    console.log('\n📊 FINAL TRACE REPORT');
    console.log('='.repeat(80));
    
    console.log('\n🎯 SOURCE REGISTRATION:');
    console.log('-'.repeat(40));
    console.log(`📍 Location: LodgeTix-migration-test-1.registrations`);
    console.log(`🔑 MongoDB _id: ${result.sourceRecord._id}`);
    console.log(`🆔 Registration ID: ${result.registrationId}`);
    console.log(`📊 Status: ${result.sourceRecord.status || 'No status'}`);
    console.log(`👤 Customer ID: ${result.sourceRecord.customerId || 'No customer ID'}`);
    console.log(`📅 Registration Date: ${result.sourceRecord.registrationDate || 'No date'}`);
    console.log(`💰 Total Amount: ${result.sourceRecord.totalAmountPaid || 'No amount'}`);
    
    console.log('\n🔍 CROSS-SYSTEM SEARCH RESULTS:');
    console.log('-'.repeat(40));
    console.log(`✅ Found in: ${result.summary.locations.join(', ') || 'NONE'}`);
    console.log(`❌ Missing from: ${result.summary.missing.join(', ') || 'NONE'}`);
    
    console.log('\n📋 DETAILED FINDINGS:');
    console.log('-'.repeat(40));
    
    if (result.foundInErrorRegistrations) {
      console.log('🚨 ERROR_REGISTRATIONS: ✅ Found');
      console.log(`   → Error Message: ${result.foundInErrorRegistrations.error || 'No error message'}`);
      console.log(`   → Created: ${result.foundInErrorRegistrations.createdAt || 'No timestamp'}`);
      console.log(`   → This indicates the registration failed during import`);
    } else {
      console.log('🚨 ERROR_REGISTRATIONS: ❌ Not Found');
      console.log(`   → Registration was not logged as an error`);
    }
    
    if (result.foundInImportRegistrations) {
      console.log('\n📥 IMPORT_REGISTRATIONS: ✅ Found');
      console.log(`   → Status: ${result.foundInImportRegistrations.status || 'No status'}`);
      console.log(`   → Import Flag: ${result.foundInImportRegistrations.imported || 'No flag'}`);
      console.log(`   → This indicates the registration was staged for import`);
    } else {
      console.log('\n📥 IMPORT_REGISTRATIONS: ❌ Not Found');
      console.log(`   → Registration was not staged for import`);
    }
    
    if (result.foundInProductionRegistrations) {
      console.log('\n✅ PRODUCTION_REGISTRATIONS: ✅ Found');
      console.log(`   → Status: ${result.foundInProductionRegistrations.status || 'No status'}`);
      console.log(`   → Event: ${result.foundInProductionRegistrations.eventName || 'No event'}`);
      console.log(`   → Customer ID: ${result.foundInProductionRegistrations.customerId || 'No customer'}`);
      console.log(`   → Registration successfully imported to production MongoDB`);
    } else {
      console.log('\n✅ PRODUCTION_REGISTRATIONS: ❌ Not Found');
      console.log(`   → Registration not imported to production MongoDB`);
    }
    
    if (result.foundInSupabase) {
      console.log('\n🗃️ SUPABASE_REGISTRATIONS: ✅ Found');
      console.log(`   → Supabase ID: ${result.foundInSupabase.id}`);
      console.log(`   → Status: ${result.foundInSupabase.status || 'No status'}`);
      console.log(`   → Event ID: ${result.foundInSupabase.event_id || 'No event ID'}`);
      console.log(`   → Customer ID: ${result.foundInSupabase.customer_id || 'No customer ID'}`);
      console.log(`   → Created: ${result.foundInSupabase.created_at || 'No timestamp'}`);
      console.log(`   → Registration successfully synced to Supabase`);
    } else {
      console.log('\n🗃️ SUPABASE_REGISTRATIONS: ❌ Not Found');
      console.log(`   → Registration not synced to Supabase`);
    }
    
    console.log('\n🎯 SYNC STATUS SUMMARY:');
    console.log('-'.repeat(40));
    
    if (result.summary.locations.length === 0) {
      console.log('❌ CRITICAL: Registration exists in test database but NOT in any target system!');
      console.log('   This registration has not been migrated/synced anywhere.');
    } else if (result.summary.missing.length === 0) {
      console.log('🎉 PERFECT: Registration found in ALL target systems');
      console.log('   Complete synchronization achieved.');
    } else {
      console.log('⚠️ PARTIAL SYNC: Registration partially migrated');
      console.log(`   Successful sync to: ${result.summary.locations.join(', ')}`);
      console.log(`   Missing sync to: ${result.summary.missing.join(', ')}`);
      
      // Provide specific recommendations
      if (result.summary.missing.includes('import_registrations')) {
        console.log('\n💡 RECOMMENDATION: Registration should be added to import_registrations for tracking');
      }
      if (result.summary.missing.includes('production_registrations')) {
        console.log('💡 RECOMMENDATION: Registration should be migrated to production MongoDB');
      }
      if (result.summary.missing.includes('supabase_registrations')) {
        console.log('💡 RECOMMENDATION: Registration should be synced to Supabase for API access');
      }
    }

  } catch (error) {
    console.error('💥 TRACE FAILED:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { comprehensiveTrace };