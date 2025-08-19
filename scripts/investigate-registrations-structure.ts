#!/usr/bin/env tsx

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function investigateRegistrationsStructure() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const registrationsCollection = db.collection('registrations');
    
    // Step 1: Get basic statistics
    console.log('\n🔍 Step 1: Basic registrations statistics...');
    
    const totalRegistrations = await registrationsCollection.countDocuments();
    console.log(`Total registrations: ${totalRegistrations}`);
    
    if (totalRegistrations === 0) {
      console.log('❌ No registrations found in the collection!');
      return;
    }
    
    // Step 2: Sample registrations to understand structure
    console.log('\n🔍 Step 2: Examining registration structure...');
    
    const sampleRegistrations = await registrationsCollection.find({}).limit(10).toArray();
    
    sampleRegistrations.forEach((reg, index) => {
      console.log(`\n--- Registration ${index + 1} ---`);
      console.log(`ID: ${reg._id}`);
      console.log(`Available fields:`, Object.keys(reg));
      
      // Check for lodge-related fields
      if (reg.lodgeName) {
        console.log(`Lodge Name: ${reg.lodgeName}`);
      }
      if (reg.amount) {
        console.log(`Amount: $${(reg.amount / 100).toFixed(2)}`);
      }
      if (reg.paymentIntentId) {
        console.log(`Payment Intent: ${reg.paymentIntentId}`);
      }
      if (reg.originalData) {
        console.log(`Original data keys:`, Object.keys(reg.originalData));
        if (reg.originalData.lodge_name) {
          console.log(`Original Lodge Name: ${reg.originalData.lodge_name}`);
        }
      }
      if (reg.email) {
        console.log(`Email: ${reg.email}`);
      }
      if (reg.firstName && reg.lastName) {
        console.log(`Name: ${reg.firstName} ${reg.lastName}`);
      }
    });
    
    // Step 3: Search more broadly for any Lodge references
    console.log('\n🔍 Step 3: Searching for any Lodge references...');
    
    // Check different possible field names
    const lodgeQueries = [
      { lodgeName: { $exists: true } },
      { 'originalData.lodge_name': { $exists: true } },
      { 'originalData.lodgeName': { $exists: true } },
      { 'lodge_name': { $exists: true } },
      { 'lodge': { $exists: true } }
    ];
    
    for (const query of lodgeQueries) {
      const count = await registrationsCollection.countDocuments(query);
      if (count > 0) {
        console.log(`Found ${count} registrations with query:`, JSON.stringify(query));
        
        const samples = await registrationsCollection.find(query).limit(3).toArray();
        samples.forEach((reg, idx) => {
          console.log(`  Sample ${idx + 1}: ${reg._id}`);
          if (reg.lodgeName) console.log(`    Lodge: ${reg.lodgeName}`);
          if (reg.originalData?.lodge_name) console.log(`    Original Lodge: ${reg.originalData.lodge_name}`);
          if (reg.amount) console.log(`    Amount: $${(reg.amount / 100).toFixed(2)}`);
        });
      }
    }
    
    // Step 4: Text search across all registrations
    console.log('\n🔍 Step 4: Text search for Lodge keywords...');
    
    const keywords = ['Jerusalem', 'Mark Owen', 'lodge', 'Lodge'];
    
    for (const keyword of keywords) {
      // Use aggregation to search across all string fields
      const pipeline = [
        {
          $match: {
            $expr: {
              $regexMatch: {
                input: { $toString: "$$ROOT" },
                regex: keyword,
                options: "i"
              }
            }
          }
        },
        { $limit: 5 }
      ];
      
      try {
        const results = await registrationsCollection.aggregate(pipeline).toArray();
        if (results.length > 0) {
          console.log(`\nFound ${results.length} registrations containing "${keyword}":`);
          results.forEach((reg, idx) => {
            console.log(`  ${idx + 1}. ID: ${reg._id}`);
            if (reg.lodgeName) console.log(`     Lodge: ${reg.lodgeName}`);
            if (reg.firstName && reg.lastName) console.log(`     Name: ${reg.firstName} ${reg.lastName}`);
            if (reg.email) console.log(`     Email: ${reg.email}`);
          });
        }
      } catch (error) {
        console.log(`Could not search for "${keyword}": ${error.message}`);
      }
    }
    
    // Step 5: Check amounts around $1150
    console.log('\n🔍 Step 5: Searching for registrations with amount around $1150...');
    
    const amountQueries = [
      { amount: 115000 }, // $1150.00 in cents
      { amount: { $gte: 114000, $lte: 116000 } }, // Range around $1150
      { 'originalData.amount': 115000 },
      { 'originalData.amount': { $gte: 114000, $lte: 116000 } }
    ];
    
    for (const query of amountQueries) {
      const count = await registrationsCollection.countDocuments(query);
      if (count > 0) {
        console.log(`Found ${count} registrations with amount query:`, JSON.stringify(query));
        
        const samples = await registrationsCollection.find(query).limit(3).toArray();
        samples.forEach((reg, idx) => {
          console.log(`  Sample ${idx + 1}: ${reg._id}`);
          console.log(`    Amount: $${((reg.amount || reg.originalData?.amount || 0) / 100).toFixed(2)}`);
          if (reg.firstName && reg.lastName) console.log(`    Name: ${reg.firstName} ${reg.lastName}`);
          if (reg.lodgeName) console.log(`    Lodge: ${reg.lodgeName}`);
        });
      }
    }
    
    console.log('\n✅ Registration structure investigation completed!');
    
  } catch (error) {
    console.error('❌ Error during registration structure investigation:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
investigateRegistrationsStructure().catch(console.error);