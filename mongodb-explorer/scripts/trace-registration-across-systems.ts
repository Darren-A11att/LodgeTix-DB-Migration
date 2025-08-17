#!/usr/bin/env npx tsx

import { MongoClient, ObjectId } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

interface RegistrationTraceResult {
  registrationId: string | null;
  foundInErrorRegistrations: any | null;
  foundInImportRegistrations: any | null;
  foundInProductionRegistrations: any | null;
  foundInSupabase: any | null;
  summary: {
    locations: string[];
    missing: string[];
  };
}

async function traceRegistrationAcrossSystems(): Promise<RegistrationTraceResult> {
  const result: RegistrationTraceResult = {
    registrationId: null,
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
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    mongoClient = new MongoClient(process.env.MONGODB_URI!);
    await mongoClient.connect();

    // Step 1: Extract registrationId from test database
    console.log('🔍 Extracting registrationId from test database...');
    const testDb = mongoClient.db('test');
    const testRegistration = await testDb.collection('registrations').findOne({
      _id: new ObjectId("6886bd91bc34c2425617c25e")
    });

    if (!testRegistration) {
      throw new Error('Registration with _id 6886bd91bc34c2425617c25e not found in test database');
    }

    const registrationId = testRegistration.registrationId;
    if (!registrationId) {
      throw new Error('registrationId field not found in test registration');
    }

    result.registrationId = registrationId;
    console.log(`✅ Found registrationId: ${registrationId}`);

    // Step 2: Search in lodgetix database collections
    console.log('🔍 Searching in lodgetix database...');
    const lodgetixDb = mongoClient.db('lodgetix');

    // Search in error_registrations
    console.log('  📋 Checking error_registrations...');
    const errorRegistration = await lodgetixDb.collection('error_registrations').findOne({
      registrationId: registrationId
    });
    if (errorRegistration) {
      result.foundInErrorRegistrations = errorRegistration;
      result.summary.locations.push('error_registrations');
      console.log(`  ✅ Found in error_registrations with error: ${errorRegistration.error || 'No error message'}`);
    } else {
      result.summary.missing.push('error_registrations');
      console.log('  ❌ Not found in error_registrations');
    }

    // Search in import_registrations
    console.log('  📋 Checking import_registrations...');
    const importRegistration = await lodgetixDb.collection('import_registrations').findOne({
      registrationId: registrationId
    });
    if (importRegistration) {
      result.foundInImportRegistrations = importRegistration;
      result.summary.locations.push('import_registrations');
      console.log(`  ✅ Found in import_registrations with status: ${importRegistration.status || 'No status'}`);
    } else {
      result.summary.missing.push('import_registrations');
      console.log('  ❌ Not found in import_registrations');
    }

    // Search in production registrations
    console.log('  📋 Checking production registrations...');
    const productionRegistration = await lodgetixDb.collection('registrations').findOne({
      registrationId: registrationId
    });
    if (productionRegistration) {
      result.foundInProductionRegistrations = productionRegistration;
      result.summary.locations.push('lodgetix_registrations');
      console.log(`  ✅ Found in production registrations with status: ${productionRegistration.status || 'No status'}`);
    } else {
      result.summary.missing.push('lodgetix_registrations');
      console.log('  ❌ Not found in production registrations');
    }

    // Step 3: Search in Supabase
    console.log('🔍 Searching in Supabase...');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: supabaseRegistration, error: supabaseError } = await supabase
      .from('registrations')
      .select('*')
      .eq('registration_id', registrationId)
      .single();

    if (supabaseRegistration && !supabaseError) {
      result.foundInSupabase = supabaseRegistration;
      result.summary.locations.push('supabase_registrations');
      console.log(`  ✅ Found in Supabase with id: ${supabaseRegistration.id}`);
    } else {
      result.summary.missing.push('supabase_registrations');
      console.log(`  ❌ Not found in Supabase${supabaseError ? ` (Error: ${supabaseError.message})` : ''}`);
    }

  } catch (error) {
    console.error('❌ Error during registration trace:', error);
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
    console.log('🚀 Starting registration trace across systems...\n');
    
    const result = await traceRegistrationAcrossSystems();
    
    console.log('\n📊 REGISTRATION TRACE REPORT');
    console.log('=' .repeat(50));
    console.log(`🔑 Registration ID: ${result.registrationId}`);
    console.log(`📍 Found in: ${result.summary.locations.join(', ') || 'None'}`);
    console.log(`❌ Missing from: ${result.summary.missing.join(', ') || 'None'}`);
    
    console.log('\n📋 DETAILED FINDINGS:');
    console.log('-'.repeat(30));
    
    if (result.foundInErrorRegistrations) {
      console.log('🚨 ERROR_REGISTRATIONS:');
      console.log(`   Error: ${result.foundInErrorRegistrations.error || 'No error message'}`);
      console.log(`   Created: ${result.foundInErrorRegistrations.createdAt || 'No timestamp'}`);
      console.log(`   Data keys: ${Object.keys(result.foundInErrorRegistrations).join(', ')}`);
    }
    
    if (result.foundInImportRegistrations) {
      console.log('📥 IMPORT_REGISTRATIONS:');
      console.log(`   Status: ${result.foundInImportRegistrations.status || 'No status'}`);
      console.log(`   Imported: ${result.foundInImportRegistrations.imported || 'No import flag'}`);
      console.log(`   Data keys: ${Object.keys(result.foundInImportRegistrations).join(', ')}`);
    }
    
    if (result.foundInProductionRegistrations) {
      console.log('✅ PRODUCTION_REGISTRATIONS:');
      console.log(`   Status: ${result.foundInProductionRegistrations.status || 'No status'}`);
      console.log(`   Event: ${result.foundInProductionRegistrations.eventName || result.foundInProductionRegistrations.event || 'No event'}`);
      console.log(`   Data keys: ${Object.keys(result.foundInProductionRegistrations).join(', ')}`);
    }
    
    if (result.foundInSupabase) {
      console.log('🗃️ SUPABASE_REGISTRATIONS:');
      console.log(`   ID: ${result.foundInSupabase.id}`);
      console.log(`   Status: ${result.foundInSupabase.status || 'No status'}`);
      console.log(`   Created: ${result.foundInSupabase.created_at || 'No timestamp'}`);
      console.log(`   Event ID: ${result.foundInSupabase.event_id || 'No event ID'}`);
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log('-'.repeat(20));
    
    if (result.summary.locations.length === 0) {
      console.log('❌ Registration not found in any system!');
    } else if (result.summary.missing.length === 0) {
      console.log('✅ Registration found in ALL systems');
    } else {
      console.log(`⚠️ Registration partially synced - missing from: ${result.summary.missing.join(', ')}`);
    }

  } catch (error) {
    console.error('💥 Failed to trace registration:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { traceRegistrationAcrossSystems };