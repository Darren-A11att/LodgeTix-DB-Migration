const { MongoClient } = require('mongodb');
const { ReferenceDataService } = require('../src/services/sync/reference-data-service.ts');
const dotenv = require('dotenv');

// Load environment variables from .env.explorer
dotenv.config({ path: '.env.explorer' });

async function testGrandLodgeLookup() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in environment variables');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    const referenceService = new ReferenceDataService(db);

    console.log('🔍 Testing Grand Lodge Lookup Functionality');
    console.log('================================================');

    // First, let's see what grand lodges exist
    const grandLodgesCollection = db.collection('grandLodges');
    const sampleGrandLodges = await grandLodgesCollection.find({}).limit(5).toArray();
    
    console.log(`\nFound ${sampleGrandLodges.length} sample grand lodges:`);
    sampleGrandLodges.forEach((gl, index) => {
      console.log(`  ${index + 1}. ID: ${gl.grandLodgeId || gl.id || gl._id} | Name: ${gl.name || 'NO NAME'}`);
    });

    // Test the lookup functionality
    if (sampleGrandLodges.length > 0) {
      const testGrandLodge = sampleGrandLodges[0];
      const testId = testGrandLodge.grandLodgeId || testGrandLodge.id || testGrandLodge._id;
      
      console.log(`\n🧪 Testing lookup for ID: ${testId}`);
      const result = await referenceService.getGrandLodgeDetails(testId);
      
      if (result) {
        console.log('✅ Lookup successful:');
        console.log(`   Name: ${result.name}`);
        console.log(`   Abbreviation: ${result.abbreviation || 'N/A'}`);
        console.log(`   Country: ${result.country || 'N/A'}`);
      } else {
        console.log('❌ Lookup failed - no result returned');
      }
    }

    // Now check for attendees with grandLodgeId but missing grandLodge name
    const attendeesCollection = db.collection('attendees');
    const attendeesWithMissingGrandLodge = await attendeesCollection.find({
      $and: [
        { $or: [{ grand_lodge_id: { $exists: true, $ne: null } }, { grandLodgeId: { $exists: true, $ne: null } }] },
        { $or: [{ grand_lodge: { $in: [null, ''] } }, { grandLodge: { $in: [null, ''] } }, { grand_lodge: { $exists: false } }, { grandLodge: { $exists: false } }] }
      ]
    }).limit(3).toArray();

    console.log(`\n🔍 Found ${attendeesWithMissingGrandLodge.length} attendees with grandLodgeId but missing grandLodge name:`);
    
    for (const attendee of attendeesWithMissingGrandLodge) {
      const grandLodgeId = attendee.grand_lodge_id || attendee.grandLodgeId;
      const grandLodgeName = attendee.grand_lodge || attendee.grandLodge;
      
      console.log(`\n  Attendee: ${attendee.firstName} ${attendee.lastName}`);
      console.log(`  Grand Lodge ID: ${grandLodgeId}`);
      console.log(`  Current Grand Lodge Name: "${grandLodgeName || 'MISSING'}"`);
      
      // Test the lookup
      if (grandLodgeId) {
        const grandLodgeDetails = await referenceService.getGrandLodgeDetails(grandLodgeId);
        if (grandLodgeDetails) {
          console.log(`  ✅ Would be fixed to: "${grandLodgeDetails.name}"`);
        } else {
          console.log(`  ❌ No grand lodge found for ID: ${grandLodgeId}`);
        }
      }
    }

  } finally {
    await client.close();
  }
}

testGrandLodgeLookup().catch(console.error);