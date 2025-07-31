const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findDuplicateRegistrationIds() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== SEARCHING FOR DUPLICATE REGISTRATION IDS ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    
    // Find duplicates using aggregation
    const duplicates = await registrationsCollection.aggregate([
      {
        $match: {
          registrationId: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$registrationId',
          count: { $sum: 1 },
          documents: { 
            $push: {
              id: '$_id',
              confirmationNumber: '$confirmationNumber',
              email: {
                $ifNull: [
                  '$registrationData.bookingContact.emailAddress',
                  '$registrationData.billingDetails.emailAddress'
                ]
              },
              createdAt: '$createdAt',
              paymentId: '$paymentId'
            }
          }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $sort: {
          count: -1
        }
      }
    ]).toArray();
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate registrationIds found!\n');
    } else {
      console.log(`⚠️  Found ${duplicates.length} registrationIds that appear multiple times:\n`);
      
      for (const dup of duplicates) {
        console.log(`Registration ID: ${dup._id}`);
        console.log(`Appears ${dup.count} times:`);
        
        for (const doc of dup.documents) {
          console.log(`  - Document ID: ${doc.id}`);
          console.log(`    Confirmation: ${doc.confirmationNumber || 'N/A'}`);
          console.log(`    Email: ${doc.email || 'N/A'}`);
          console.log(`    Created: ${doc.createdAt || 'N/A'}`);
          console.log(`    Payment ID: ${doc.paymentId || 'N/A'}`);
          console.log('');
        }
        console.log('---\n');
      }
      
      // Summary
      const totalDuplicateRecords = duplicates.reduce((sum, dup) => sum + dup.count, 0);
      console.log('SUMMARY:');
      console.log(`Total unique registrationIds with duplicates: ${duplicates.length}`);
      console.log(`Total records involved: ${totalDuplicateRecords}`);
    }
    
    // Also check for missing registrationIds
    const missingCount = await registrationsCollection.countDocuments({
      $or: [
        { registrationId: { $exists: false } },
        { registrationId: null },
        { registrationId: '' }
      ]
    });
    
    if (missingCount > 0) {
      console.log(`\n⚠️  Also found ${missingCount} registrations without a registrationId`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the search
findDuplicateRegistrationIds();