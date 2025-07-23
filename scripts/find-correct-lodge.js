const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findCorrectLodge() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== SEARCHING FOR LODGE JOSE RIZAL NO. 1045 ===\n');
    
    const lodgesCollection = db.collection('lodges');
    
    // Search with various patterns
    const searchPatterns = [
      { name: { $regex: 'Jose Rizal', $options: 'i' } },
      { lodgeName: { $regex: 'Jose Rizal', $options: 'i' } },
      { lodgeNumber: '1045' },
      { number: '1045' },
      { name: { $regex: '1045', $options: 'i' } },
      { lodgeName: { $regex: '1045', $options: 'i' } }
    ];
    
    const lodges = await lodgesCollection.find({
      $or: searchPatterns
    }).toArray();
    
    console.log(`Found ${lodges.length} potential lodge(s):\n`);
    
    for (const lodge of lodges) {
      console.log(`Lodge ID: ${lodge._id}`);
      console.log(`  Name: ${lodge.name || lodge.lodgeName || 'N/A'}`);
      console.log(`  Lodge Number: ${lodge.lodgeNumber || lodge.number || 'N/A'}`);
      console.log(`  Description: ${lodge.description || 'N/A'}`);
      
      // Check if this lodge has any additional fields that might help identify it
      const otherFields = Object.keys(lodge).filter(k => 
        !['_id', 'name', 'lodgeName', 'lodgeNumber', 'number', 'description'].includes(k)
      );
      
      if (otherFields.length > 0) {
        console.log(`  Other fields: ${otherFields.join(', ')}`);
      }
      
      console.log('');
    }
    
    // Also check registrations to see what lodge names/IDs are being used
    console.log('=== CHECKING LODGE REGISTRATIONS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const lodgeRegistrations = await registrationsCollection.aggregate([
      {
        $match: {
          registrationType: 'lodge',
          $or: [
            { 'registrationData.lodgeDetails.lodgeName': { $regex: 'Jose Rizal', $options: 'i' } },
            { organisationName: { $regex: 'Jose Rizal', $options: 'i' } }
          ]
        }
      },
      {
        $group: {
          _id: {
            lodgeId: '$registrationData.lodgeDetails.lodgeId',
            lodgeName: '$registrationData.lodgeDetails.lodgeName',
            organisationName: '$organisationName'
          },
          count: { $sum: 1 },
          example: { $first: '$confirmationNumber' }
        }
      }
    ]).toArray();
    
    console.log(`Found ${lodgeRegistrations.length} distinct lodge registration patterns:\n`);
    
    for (const pattern of lodgeRegistrations) {
      console.log(`Pattern ${lodgeRegistrations.indexOf(pattern) + 1}:`);
      console.log(`  Lodge ID: ${pattern._id.lodgeId || 'N/A'}`);
      console.log(`  Lodge Name: ${pattern._id.lodgeName || 'N/A'}`);
      console.log(`  Organisation Name: ${pattern._id.organisationName || 'N/A'}`);
      console.log(`  Count: ${pattern.count} registrations`);
      console.log(`  Example: ${pattern.example}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the search
findCorrectLodge();