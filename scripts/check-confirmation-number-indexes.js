const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkConfirmationNumberIndexes() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== CHECKING CONFIRMATION NUMBER INDEXES ===\n');
    
    // Get all indexes on the registrations collection
    const indexes = await db.collection('registrations').indexes();
    
    console.log('All indexes on registrations collection:');
    indexes.forEach((index, i) => {
      console.log(`\nIndex ${i + 1}:`);
      console.log(`  Name: ${index.name}`);
      console.log(`  Keys: ${JSON.stringify(index.key)}`);
      console.log(`  Unique: ${index.unique || false}`);
      if (index.sparse) console.log(`  Sparse: ${index.sparse}`);
      if (index.background) console.log(`  Background: ${index.background}`);
    });
    
    // Check specifically for confirmationNumber index
    const confirmationIndex = indexes.find(idx => 
      Object.keys(idx.key).includes('confirmationNumber')
    );
    
    console.log('\n=== CONFIRMATION NUMBER INDEX STATUS ===');
    if (confirmationIndex) {
      console.log('✓ confirmationNumber index exists');
      console.log(`  Unique: ${confirmationIndex.unique || false}`);
      console.log(`  Keys: ${JSON.stringify(confirmationIndex.key)}`);
      
      if (!confirmationIndex.unique) {
        console.log('\n⚠️  WARNING: confirmationNumber index is NOT UNIQUE!');
        console.log('This allows duplicate confirmation numbers to be created.');
      }
    } else {
      console.log('✗ No index on confirmationNumber field');
      console.log('This can lead to:');
      console.log('  - Poor query performance');
      console.log('  - Duplicate confirmation numbers');
    }
    
    // Check for duplicates
    console.log('\n=== CHECKING FOR DUPLICATE CONFIRMATION NUMBERS ===');
    
    const duplicates = await db.collection('registrations').aggregate([
      {
        $group: {
          _id: '$confirmationNumber',
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();
    
    console.log(`\nFound ${duplicates.length} duplicate confirmation numbers`);
    
    if (duplicates.length > 0) {
      console.log('\nDuplicates:');
      duplicates.forEach(dup => {
        console.log(`  ${dup._id}: ${dup.count} occurrences`);
        console.log(`    IDs: ${dup.ids.join(', ')}`);
      });
    }
    
    // Analyze the generation algorithm's collision probability
    console.log('\n=== CONFIRMATION NUMBER GENERATION ANALYSIS ===');
    console.log('Format: PREFIX-NNNNNNAA');
    console.log('  PREFIX: 3 letters (IND, LDG, DEL, REG)');
    console.log('  NNNNNN: 6 random digits (000000-999999)');
    console.log('  AA: 2 random uppercase letters (AA-ZZ)');
    
    const totalPossibleNumbers = 1000000 * 26 * 26; // 676,000,000 per prefix
    console.log(`\nTotal possible combinations per prefix: ${totalPossibleNumbers.toLocaleString()}`);
    
    // Count registrations by prefix
    const registrationCounts = await db.collection('registrations').aggregate([
      {
        $match: {
          confirmationNumber: { $regex: /^(IND|LDG|DEL|REG)-/ }
        }
      },
      {
        $group: {
          _id: { $substr: ['$confirmationNumber', 0, 3] },
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    console.log('\nRegistrations by prefix:');
    registrationCounts.forEach(({ _id, count }) => {
      const probability = (count * (count - 1)) / (2 * totalPossibleNumbers) * 100;
      console.log(`  ${_id}: ${count} registrations`);
      console.log(`    Collision probability: ${probability.toFixed(6)}%`);
    });
    
    // Recommendation
    console.log('\n=== RECOMMENDATIONS ===');
    if (!confirmationIndex || !confirmationIndex.unique) {
      console.log('1. Create a unique index on confirmationNumber:');
      console.log("   db.registrations.createIndex({ confirmationNumber: 1 }, { unique: true, sparse: true })");
    }
    console.log('2. Add retry logic to handle duplicate generation');
    console.log('3. Consider using a more robust ID generation strategy (e.g., UUID)');
    console.log('4. Add duplicate checking before saving new registrations');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkConfirmationNumberIndexes().catch(console.error);