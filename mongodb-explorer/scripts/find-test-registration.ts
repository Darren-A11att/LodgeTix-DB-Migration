#!/usr/bin/env npx tsx

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function findTestRegistration() {
  let mongoClient: MongoClient | null = null;

  try {
    console.log('🔗 Connecting to MongoDB...');
    mongoClient = new MongoClient(process.env.MONGODB_URI!);
    await mongoClient.connect();

    const testDb = mongoClient.db('test');
    
    console.log('🔍 Checking available collections in test database...');
    const collections = await testDb.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    console.log('\n🔍 Looking for registrations with similar _id...');
    
    // Try to find registrations that might match
    const registrations = await testDb.collection('registrations').find({
      _id: { $regex: "6886bd91bc34c2425617c25e" }
    }).limit(5).toArray();
    
    if (registrations.length === 0) {
      console.log('❌ No registrations found with similar _id');
      
      // Let's check what registrations exist
      console.log('\n🔍 Checking first few registrations in collection...');
      const sampleRegistrations = await testDb.collection('registrations').find({}).limit(5).toArray();
      
      sampleRegistrations.forEach((reg, index) => {
        console.log(`Registration ${index + 1}:`);
        console.log(`  _id: ${reg._id}`);
        console.log(`  registrationId: ${reg.registrationId || 'N/A'}`);
        console.log(`  keys: ${Object.keys(reg).join(', ')}`);
        console.log('');
      });
    } else {
      console.log(`✅ Found ${registrations.length} matching registrations:`);
      registrations.forEach((reg, index) => {
        console.log(`Registration ${index + 1}:`);
        console.log(`  _id: ${reg._id}`);
        console.log(`  registrationId: ${reg.registrationId || 'N/A'}`);
        console.log(`  keys: ${Object.keys(reg).join(', ')}`);
        console.log('');
      });
    }

    // Try ObjectId format
    console.log('\n🔍 Trying ObjectId format...');
    try {
      const objectIdRegistration = await testDb.collection('registrations').findOne({
        _id: new ObjectId("6886bd91bc34c2425617c25e")
      });
      if (objectIdRegistration) {
        console.log('✅ Found with ObjectId format!');
        console.log(`  registrationId: ${objectIdRegistration.registrationId}`);
      } else {
        console.log('❌ Not found with ObjectId format');
      }
    } catch (error) {
      console.log(`❌ Invalid ObjectId format: ${error}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

findTestRegistration();