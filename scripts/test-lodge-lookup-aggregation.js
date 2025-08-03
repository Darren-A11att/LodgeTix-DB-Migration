const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testLodgeLookupAggregation() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING LODGE LOOKUP AGGREGATION ===\n');
    
    const attendeesCollection = db.collection('attendees');
    const lodgesCollection = db.collection('lodges');
    
    // First, let's understand the data structure better
    console.log('1. CHECKING DATA STRUCTURE:');
    console.log('---------------------------');
    
    // Check a sample attendee with organization
    const attendeeWithOrg = await attendeesCollection.findOne({
      organization: { $exists: true, $ne: null, $ne: '' }
    });
    console.log('Sample attendee with organization:');
    console.log(`  Name: ${attendeeWithOrg.firstName} ${attendeeWithOrg.lastName}`);
    console.log(`  Organization: ${attendeeWithOrg.organization}`);
    
    // Check a sample lodge
    const sampleLodge = await lodgesCollection.findOne({});
    console.log('\nSample lodge:');
    console.log(`  Name: ${sampleLodge.name}`);
    console.log(`  Display Name: ${sampleLodge.displayName}`);
    console.log(`  Lodge ID: ${sampleLodge.lodgeId}`);
    console.log(`  _id: ${sampleLodge._id}`);
    
    // Test different aggregation approaches
    console.log('\n\n2. TESTING AGGREGATION WITH ORGANIZATION FIELD:');
    console.log('-----------------------------------------------');
    
    // Approach 1: Lookup by matching organization to lodge name/displayName
    const aggregation1 = await attendeesCollection.aggregate([
      {
        $match: {
          organization: { $exists: true, $ne: null, $ne: '' }
        }
      },
      { $limit: 10 },
      {
        $lookup: {
          from: 'lodges',
          let: { org_name: '$organization' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$name', '$$org_name'] },
                    { $eq: ['$displayName', '$$org_name'] }
                  ]
                }
              }
            }
          ],
          as: 'lodgeDetails'
        }
      },
      {
        $project: {
          attendeeName: { $concat: ['$firstName', ' ', '$lastName'] },
          organization: 1,
          hasLodgeMatch: { $gt: [{ $size: '$lodgeDetails' }, 0] },
          lodgeId: { $arrayElemAt: ['$lodgeDetails.lodgeId', 0] },
          lodgeName: { $arrayElemAt: ['$lodgeDetails.displayName', 0] }
        }
      }
    ]).toArray();
    
    console.log(`\nResults (${aggregation1.length} attendees):`);
    aggregation1.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.attendeeName}`);
      console.log(`   Organization: ${result.organization}`);
      console.log(`   Lodge Match: ${result.hasLodgeMatch ? 'YES' : 'NO'}`);
      if (result.hasLodgeMatch) {
        console.log(`   Lodge ID: ${result.lodgeId}`);
        console.log(`   Lodge Name: ${result.lodgeName}`);
      }
    });
    
    // Count total matches
    const matchCount = await attendeesCollection.aggregate([
      {
        $match: {
          organization: { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $lookup: {
          from: 'lodges',
          let: { org_name: '$organization' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$name', '$$org_name'] },
                    { $eq: ['$displayName', '$$org_name'] }
                  ]
                }
              }
            }
          ],
          as: 'lodgeDetails'
        }
      },
      {
        $match: {
          'lodgeDetails.0': { $exists: true }
        }
      },
      {
        $count: 'totalMatches'
      }
    ]).toArray();
    
    console.log(`\n\nTotal attendees with matching lodge: ${matchCount[0]?.totalMatches || 0}`);
    
    // Test if we need to handle case sensitivity or trim spaces
    console.log('\n\n3. CHECKING FOR POTENTIAL MATCHING ISSUES:');
    console.log('------------------------------------------');
    
    // Check for case differences
    const caseTestAgg = await attendeesCollection.aggregate([
      {
        $match: {
          organization: { $exists: true, $ne: null, $ne: '' }
        }
      },
      { $limit: 5 },
      {
        $lookup: {
          from: 'lodges',
          let: { org_name: { $toLower: '$organization' } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: [{ $toLower: '$name' }, '$$org_name'] },
                    { $eq: [{ $toLower: '$displayName' }, '$$org_name'] }
                  ]
                }
              }
            }
          ],
          as: 'lodgeDetailsCaseInsensitive'
        }
      },
      {
        $lookup: {
          from: 'lodges',
          let: { org_name: '$organization' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$name', '$$org_name'] },
                    { $eq: ['$displayName', '$$org_name'] }
                  ]
                }
              }
            }
          ],
          as: 'lodgeDetailsCaseSensitive'
        }
      },
      {
        $project: {
          organization: 1,
          caseSensitiveMatch: { $gt: [{ $size: '$lodgeDetailsCaseSensitive' }, 0] },
          caseInsensitiveMatch: { $gt: [{ $size: '$lodgeDetailsCaseInsensitive' }, 0] }
        }
      },
      {
        $match: {
          caseSensitiveMatch: false,
          caseInsensitiveMatch: true
        }
      }
    ]).toArray();
    
    if (caseTestAgg.length > 0) {
      console.log('\nFound case sensitivity issues:');
      caseTestAgg.forEach(item => {
        console.log(`  Organization: "${item.organization}" - matches only with case-insensitive`);
      });
    } else {
      console.log('\nNo case sensitivity issues found in sample.');
    }
    
    // Show the aggregation pipeline structure that works
    console.log('\n\n4. RECOMMENDED AGGREGATION PIPELINE:');
    console.log('------------------------------------');
    console.log(`
db.attendees.aggregate([
  {
    $lookup: {
      from: 'lodges',
      let: { org_name: '$organization' },
      pipeline: [
        {
          $match: {
            $expr: {
              $or: [
                { $eq: ['$name', '$$org_name'] },
                { $eq: ['$displayName', '$$org_name'] }
              ]
            }
          }
        }
      ],
      as: 'lodgeDetails'
    }
  },
  {
    $unwind: {
      path: '$lodgeDetails',
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $addFields: {
      lodgeId: '$lodgeDetails.lodgeId',
      lodgeName: '$lodgeDetails.displayName'
    }
  }
])
    `);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

testLodgeLookupAggregation().catch(console.error);