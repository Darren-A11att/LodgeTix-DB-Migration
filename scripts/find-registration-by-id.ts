#!/usr/bin/env npx tsx

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function findRegistrationById() {
  let mongoClient: MongoClient | null = null;

  try {
    console.log('🔗 Connecting to MongoDB...');
    mongoClient = new MongoClient(process.env.MONGODB_URI!);
    await mongoClient.connect();

    console.log('🔍 Checking available databases...');
    const admin = mongoClient.db().admin();
    const databases = await admin.listDatabases();
    console.log('Databases:', databases.databases.map(db => db.name));

    // Check lodgetix database
    console.log('\n🔍 Checking lodgetix database collections...');
    const lodgetixDb = mongoClient.db('lodgetix');
    const collections = await lodgetixDb.listCollections().toArray();
    console.log('LodgeTix Collections:', collections.map(c => c.name));

    const targetId = "6886bd91bc34c2425617c25e";
    
    // Search in all relevant collections for this ID
    console.log(`\n🔍 Searching for _id: ${targetId} in lodgetix collections...`);
    
    // Check registrations collection
    console.log('\n📋 Checking registrations collection...');
    try {
      const regByObjectId = await lodgetixDb.collection('registrations').findOne({
        _id: new ObjectId(targetId)
      });
      if (regByObjectId) {
        console.log('✅ Found in registrations with ObjectId!');
        console.log(`  registrationId: ${regByObjectId.registrationId || 'N/A'}`);
        console.log(`  keys: ${Object.keys(regByObjectId).join(', ')}`);
        
        // Now we can trace this registrationId
        if (regByObjectId.registrationId) {
          await traceRegistrationId(regByObjectId.registrationId, lodgetixDb);
        }
        return;
      }
    } catch (error) {
      console.log(`❌ ObjectId search failed: ${error}`);
    }
    
    // Try string search
    const regByString = await lodgetixDb.collection('registrations').findOne({
      _id: targetId as any
    });
    if (regByString) {
      console.log('✅ Found in registrations with string ID!');
      console.log(`  registrationId: ${regByString.registrationId || 'N/A'}`);
      if (regByString.registrationId) {
        await traceRegistrationId(regByString.registrationId, lodgetixDb);
      }
      return;
    }
    
    console.log('❌ Not found in registrations collection');
    
    // Check if it exists in other collections
    const collectionsToCheck = ['error_registrations', 'import_registrations', 'failed_registrations'];
    
    for (const collectionName of collectionsToCheck) {
      console.log(`\n📋 Checking ${collectionName}...`);
      try {
        const doc = await lodgetixDb.collection(collectionName).findOne({
          _id: new ObjectId(targetId)
        });
        if (doc) {
          console.log(`✅ Found in ${collectionName}!`);
          console.log(`  registrationId: ${doc.registrationId || 'N/A'}`);
          console.log(`  keys: ${Object.keys(doc).join(', ')}`);
          if (doc.registrationId) {
            await traceRegistrationId(doc.registrationId, lodgetixDb);
          }
          return;
        }
      } catch (error) {
        console.log(`❌ Error checking ${collectionName}: ${error}`);
      }
    }
    
    console.log('❌ Registration not found in any collection');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

async function traceRegistrationId(registrationId: string, lodgetixDb: any) {
  console.log(`\n🔍 Tracing registrationId: ${registrationId} across systems...`);
  
  // Search in error_registrations
  const errorReg = await lodgetixDb.collection('error_registrations').findOne({
    registrationId: registrationId
  });
  console.log(`📋 error_registrations: ${errorReg ? '✅ Found' : '❌ Not found'}`);
  if (errorReg) {
    console.log(`   Error: ${errorReg.error || 'No error message'}`);
  }
  
  // Search in import_registrations
  const importReg = await lodgetixDb.collection('import_registrations').findOne({
    registrationId: registrationId
  });
  console.log(`📋 import_registrations: ${importReg ? '✅ Found' : '❌ Not found'}`);
  if (importReg) {
    console.log(`   Status: ${importReg.status || 'No status'}`);
  }
  
  // Search in production registrations
  const prodReg = await lodgetixDb.collection('registrations').findOne({
    registrationId: registrationId
  });
  console.log(`📋 production registrations: ${prodReg ? '✅ Found' : '❌ Not found'}`);
  if (prodReg) {
    console.log(`   Status: ${prodReg.status || 'No status'}`);
  }
  
  // Check Supabase
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: supabaseReg, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('registration_id', registrationId)
      .single();

    console.log(`🗃️ supabase registrations: ${supabaseReg && !error ? '✅ Found' : '❌ Not found'}`);
    if (supabaseReg) {
      console.log(`   ID: ${supabaseReg.id}`);
      console.log(`   Status: ${supabaseReg.status || 'No status'}`);
    } else if (error) {
      console.log(`   Error: ${error.message}`);
    }
  } catch (error) {
    console.log(`❌ Supabase check failed: ${error}`);
  }
}

findRegistrationById();