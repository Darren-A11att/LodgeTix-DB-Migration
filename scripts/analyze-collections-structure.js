const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function analyzeCollections() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== ANALYZING LODGES AND ATTENDEES COLLECTIONS ===\n');
    
    // Check lodges collection
    console.log('1. LODGES COLLECTION:');
    console.log('--------------------');
    const lodgesCollection = db.collection('lodges');
    const lodgeCount = await lodgesCollection.countDocuments();
    console.log(`Total documents: ${lodgeCount}`);
    
    if (lodgeCount > 0) {
      // Get sample documents
      const sampleLodges = await lodgesCollection.find({}).limit(3).toArray();
      console.log('\nSample lodge documents:');
      sampleLodges.forEach((lodge, index) => {
        console.log(`\nLodge ${index + 1}:`);
        console.log(`  _id: ${lodge._id} (type: ${typeof lodge._id})`);
        console.log(`  lodgeId: ${lodge.lodgeId} (type: ${typeof lodge.lodgeId})`);
        console.log(`  name: ${lodge.name || lodge.lodgeName || lodge.displayName}`);
        console.log(`  number: ${lodge.number || lodge.lodgeNumber}`);
        console.log(`  Available fields: ${Object.keys(lodge).join(', ')}`);
      });
      
      // Check different ID field names
      const idFieldAnalysis = await Promise.all([
        lodgesCollection.countDocuments({ lodgeId: { $exists: true } }),
        lodgesCollection.countDocuments({ _id: { $exists: true } }),
        lodgesCollection.countDocuments({ id: { $exists: true } }),
        lodgesCollection.countDocuments({ lodge_id: { $exists: true } }),
        lodgesCollection.countDocuments({ organisationId: { $exists: true } }),
        lodgesCollection.countDocuments({ organisation_id: { $exists: true } })
      ]);
      
      console.log('\nID field analysis:');
      console.log(`  Documents with lodgeId: ${idFieldAnalysis[0]}`);
      console.log(`  Documents with _id: ${idFieldAnalysis[1]}`);
      console.log(`  Documents with id: ${idFieldAnalysis[2]}`);
      console.log(`  Documents with lodge_id: ${idFieldAnalysis[3]}`);
      console.log(`  Documents with organisationId: ${idFieldAnalysis[4]}`);
      console.log(`  Documents with organisation_id: ${idFieldAnalysis[5]}`);
    }
    
    // Check attendees collection
    console.log('\n\n2. ATTENDEES COLLECTION:');
    console.log('------------------------');
    const attendeesCollection = db.collection('attendees');
    const attendeeCount = await attendeesCollection.countDocuments();
    console.log(`Total documents: ${attendeeCount}`);
    
    if (attendeeCount > 0) {
      // Get sample documents
      const sampleAttendees = await attendeesCollection.find({}).limit(3).toArray();
      console.log('\nSample attendee documents:');
      sampleAttendees.forEach((attendee, index) => {
        console.log(`\nAttendee ${index + 1}:`);
        console.log(`  _id: ${attendee._id} (type: ${typeof attendee._id})`);
        console.log(`  attendeeId: ${attendee.attendeeId} (type: ${typeof attendee.attendeeId})`);
        console.log(`  attendeeNumber: ${attendee.attendeeNumber}`);
        console.log(`  name: ${attendee.profile?.firstName} ${attendee.profile?.lastName}`);
        console.log(`  Available fields: ${Object.keys(attendee).join(', ')}`);
        
        // Check masonic info
        if (attendee.masonicInfo) {
          console.log(`  Masonic info fields: ${Object.keys(attendee.masonicInfo).join(', ')}`);
          console.log(`    lodgeId: ${attendee.masonicInfo.lodgeId} (type: ${typeof attendee.masonicInfo.lodgeId})`);
          console.log(`    lodge: ${attendee.masonicInfo.lodge}`);
        }
      });
      
      // Check lodgeId references in attendees
      const lodgeIdAnalysis = await Promise.all([
        attendeesCollection.countDocuments({ 'masonicInfo.lodgeId': { $exists: true } }),
        attendeesCollection.countDocuments({ 'masonicInfo.lodge': { $exists: true } }),
        attendeesCollection.countDocuments({ 'masonicInfo.lodgeOrganisationId': { $exists: true } }),
        attendeesCollection.countDocuments({ 'masonicInfo': { $exists: true } })
      ]);
      
      console.log('\nLodge reference analysis in attendees:');
      console.log(`  Documents with masonicInfo.lodgeId: ${lodgeIdAnalysis[0]}`);
      console.log(`  Documents with masonicInfo.lodge: ${lodgeIdAnalysis[1]}`);
      console.log(`  Documents with masonicInfo.lodgeOrganisationId: ${lodgeIdAnalysis[2]}`);
      console.log(`  Documents with masonicInfo: ${lodgeIdAnalysis[3]}`);
    }
    
    // Try a sample lookup
    console.log('\n\n3. TESTING SAMPLE LOOKUP:');
    console.log('-------------------------');
    
    // Find an attendee with a lodgeId to test
    const attendeeWithLodge = await attendeesCollection.findOne({
      'masonicInfo.lodgeId': { $exists: true, $ne: null }
    });
    
    if (attendeeWithLodge) {
      console.log(`\nFound attendee with lodgeId: ${attendeeWithLodge.masonicInfo.lodgeId}`);
      console.log(`Attendee: ${attendeeWithLodge.profile.firstName} ${attendeeWithLodge.profile.lastName}`);
      
      // Try to find the lodge using different field names
      const lodgeSearches = await Promise.all([
        lodgesCollection.findOne({ lodgeId: attendeeWithLodge.masonicInfo.lodgeId }),
        lodgesCollection.findOne({ _id: attendeeWithLodge.masonicInfo.lodgeId }),
        lodgesCollection.findOne({ id: attendeeWithLodge.masonicInfo.lodgeId }),
        lodgesCollection.findOne({ organisationId: attendeeWithLodge.masonicInfo.lodgeId }),
        lodgesCollection.findOne({ organisation_id: attendeeWithLodge.masonicInfo.lodgeId })
      ]);
      
      console.log('\nLodge lookup results:');
      console.log(`  By lodgeId: ${lodgeSearches[0] ? 'FOUND' : 'NOT FOUND'}`);
      console.log(`  By _id: ${lodgeSearches[1] ? 'FOUND' : 'NOT FOUND'}`);
      console.log(`  By id: ${lodgeSearches[2] ? 'FOUND' : 'NOT FOUND'}`);
      console.log(`  By organisationId: ${lodgeSearches[3] ? 'FOUND' : 'NOT FOUND'}`);
      console.log(`  By organisation_id: ${lodgeSearches[4] ? 'FOUND' : 'NOT FOUND'}`);
      
      if (lodgeSearches.some(l => l)) {
        const foundLodge = lodgeSearches.find(l => l);
        console.log(`\nFound lodge: ${foundLodge.name || foundLodge.lodgeName || foundLodge.displayName}`);
      }
    }
    
    // Test aggregation pipeline
    console.log('\n\n4. TESTING AGGREGATION PIPELINE:');
    console.log('--------------------------------');
    
    const aggregationResult = await attendeesCollection.aggregate([
      { $match: { 'masonicInfo.lodgeId': { $exists: true, $ne: null } } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'lodges',
          let: { lodge_id: '$masonicInfo.lodgeId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$lodgeId', '$$lodge_id'] },
                    { $eq: ['$_id', '$$lodge_id'] },
                    { $eq: ['$organisationId', '$$lodge_id'] },
                    { $eq: ['$organisation_id', '$$lodge_id'] }
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
          attendeeName: { $concat: ['$profile.firstName', ' ', '$profile.lastName'] },
          lodgeId: '$masonicInfo.lodgeId',
          lodgeName: '$masonicInfo.lodge',
          matchedLodge: { $arrayElemAt: ['$lodgeDetails', 0] }
        }
      }
    ]).toArray();
    
    console.log(`\nAggregation results (${aggregationResult.length} records):`);
    aggregationResult.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.attendeeName}:`);
      console.log(`   Lodge ID in attendee: ${result.lodgeId}`);
      console.log(`   Lodge name in attendee: ${result.lodgeName}`);
      console.log(`   Matched lodge: ${result.matchedLodge ? result.matchedLodge.name || result.matchedLodge.lodgeName : 'NOT FOUND'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

analyzeCollections().catch(console.error);