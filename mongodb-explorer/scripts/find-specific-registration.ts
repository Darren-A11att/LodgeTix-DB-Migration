#!/usr/bin/env npx tsx

import { MongoClient, ObjectId } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function findSpecificRegistration() {
  let mongoClient: MongoClient | null = null;

  try {
    console.log('🔗 Connecting to MongoDB...');
    mongoClient = new MongoClient(process.env.MONGODB_URI!);
    await mongoClient.connect();

    const targetId = "6886bd91bc34c2425617c25e";
    console.log(`🔍 Looking for registration: ${targetId}`);
    
    // Check all databases for this ID
    const admin = mongoClient.db().admin();
    const databases = await admin.listDatabases();
    
    for (const dbInfo of databases.databases) {
      if (dbInfo.name === 'admin' || dbInfo.name === 'local') continue;
      
      console.log(`\n📋 Checking database: ${dbInfo.name}`);
      const db = mongoClient.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      
      for (const collInfo of collections) {
        const collection = db.collection(collInfo.name);
        
        // Try both ObjectId and string searches
        try {
          // Try ObjectId first
          let found = null;
          try {
            found = await collection.findOne({ _id: new ObjectId(targetId) });
          } catch (e) {
            // Invalid ObjectId, try string
            found = await collection.findOne({ _id: targetId as any });
          }
          
          if (found) {
            console.log(`✅ FOUND in ${dbInfo.name}.${collInfo.name}!`);
            console.log(`   _id: ${found._id}`);
            console.log(`   registrationId: ${found.registrationId || 'N/A'}`);
            console.log(`   Keys: ${Object.keys(found).slice(0, 10).join(', ')}${Object.keys(found).length > 10 ? '...' : ''}`);
            
            if (found.registrationId) {
              console.log(`\n🔍 Tracing registrationId: ${found.registrationId}`);
              await traceRegistrationId(found.registrationId);
              return;
            }
          }
        } catch (error) {
          // Silently continue - some collections might have access issues
        }
      }
    }
    
    console.log(`❌ Registration with _id ${targetId} not found in any database/collection`);
    
    // Let's also search for any documents that might contain this as a field value
    console.log('\n🔍 Searching for this ID as a field value...');
    
    const lodgetixDb = mongoClient.db('lodgetix');
    const searchCollections = ['registrations', 'import_registrations', 'error_registrations'];
    
    for (const collName of searchCollections) {
      try {
        const results = await lodgetixDb.collection(collName).find({
          $or: [
            { originalId: targetId },
            { sourceId: targetId },
            { parentId: targetId },
            { "metadata.originalId": targetId },
            { "data.originalId": targetId }
          ]
        }).limit(5).toArray();
        
        if (results.length > 0) {
          console.log(`✅ Found ${results.length} documents in ${collName} referencing this ID:`);
          results.forEach((doc, i) => {
            console.log(`  Document ${i + 1}:`);
            console.log(`    _id: ${doc._id}`);
            console.log(`    registrationId: ${doc.registrationId || 'N/A'}`);
            if (doc.registrationId) {
              console.log(`\n🔍 Tracing this registrationId: ${doc.registrationId}`);
              // Don't await here to avoid blocking
              traceRegistrationId(doc.registrationId).catch(console.error);
            }
          });
        }
      } catch (error) {
        console.log(`❌ Error searching ${collName}: ${error}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

async function traceRegistrationId(registrationId: string) {
  console.log(`\n🔍 Cross-system trace for registrationId: ${registrationId}`);
  console.log('='.repeat(60));
  
  let mongoClient: MongoClient | null = null;
  
  try {
    mongoClient = new MongoClient(process.env.MONGODB_URI!);
    await mongoClient.connect();
    const lodgetixDb = mongoClient.db('lodgetix');
    
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
        console.log(`   Created: ${supabaseReg.created_at || 'No timestamp'}`);
      } else if (error && error.code !== 'PGRST116') {
        console.log(`   Error: ${error.message}`);
      }
    } catch (error) {
      console.log(`❌ Supabase check failed: ${error}`);
    }
    
    // Summary
    console.log('\n🎯 REGISTRATION TRACE SUMMARY:');
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
    
    console.log(`🔑 Registration ID: ${registrationId}`);
    console.log(`✅ Found in: ${foundIn.join(', ') || 'None'}`);
    console.log(`❌ Missing from: ${missingFrom.join(', ') || 'None'}`);
    
    if (foundIn.length === 0) {
      console.log('⚠️ Registration not found in any system!');
    } else if (missingFrom.length === 0) {
      console.log('🎉 Registration found in ALL systems');
    } else {
      console.log('⚠️ Registration partially synced');
    }
    
  } catch (error) {
    console.error('❌ Error in trace:', error);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

findSpecificRegistration();