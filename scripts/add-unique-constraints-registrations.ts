import { MongoClient, Db, Collection, ObjectId, CreateIndexesOptions } from 'mongodb';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface Registration {
  _id: ObjectId;
  confirmationNumber?: string;
  registrationId?: string;
}

interface DuplicateResult {
  _id: string | null;
  count: number;
  ids: ObjectId[];
}

interface IndexInfo {
  name: string;
  unique?: boolean;
}

async function addUniqueConstraints(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db: Db = client.db(dbName);
  
  try {
    console.log('=== ADDING UNIQUE CONSTRAINTS TO REGISTRATIONS ===\n');
    
    const collection: Collection<Registration> = db.collection('registrations');
    
    // First, check for any duplicates that would prevent unique index creation
    console.log('1. Checking for duplicate confirmation numbers...');
    const confirmationDuplicates: DuplicateResult[] = await collection.aggregate([
      {
        $group: {
          _id: '$confirmationNumber',
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 },
          _id: { $ne: null }
        }
      }
    ]).toArray();
    
    if (confirmationDuplicates.length > 0) {
      console.log(`\n⚠️  Found ${confirmationDuplicates.length} duplicate confirmation numbers:`);
      confirmationDuplicates.forEach(dup => {
        console.log(`   ${dup._id}: ${dup.count} occurrences`);
      });
      console.log('\nThese must be resolved before adding unique constraint.');
      return;
    }
    
    console.log('✓ No duplicate confirmation numbers found\n');
    
    // Check for duplicate registrationIds
    console.log('2. Checking for duplicate registration IDs...');
    const registrationIdDuplicates: DuplicateResult[] = await collection.aggregate([
      {
        $group: {
          _id: '$registrationId',
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 },
          _id: { $ne: null }
        }
      }
    ]).toArray();
    
    if (registrationIdDuplicates.length > 0) {
      console.log(`\n⚠️  Found ${registrationIdDuplicates.length} duplicate registration IDs:`);
      registrationIdDuplicates.forEach(dup => {
        console.log(`   ${dup._id}: ${dup.count} occurrences`);
      });
      console.log('\nThese must be resolved before adding unique constraint.');
      return;
    }
    
    console.log('✓ No duplicate registration IDs found\n');
    
    // Drop existing non-unique indexes if they exist
    console.log('3. Dropping existing non-unique indexes...');
    
    try {
      await collection.dropIndex('confirmationNumber_1');
      console.log('   Dropped non-unique confirmationNumber index');
    } catch (e) {
      console.log('   No existing confirmationNumber index to drop');
    }
    
    try {
      await collection.dropIndex('registrationId_1');
      console.log('   Dropped non-unique registrationId index');
    } catch (e) {
      console.log('   No existing registrationId index to drop');
    }
    
    // Create unique indexes
    console.log('\n4. Creating unique indexes...');
    
    // Create unique index on confirmationNumber (sparse to allow nulls)
    const confirmationIndexOptions: CreateIndexesOptions = { 
      unique: true, 
      sparse: true,
      name: 'idx_unique_confirmationNumber',
      background: true
    };
    const confirmationResult = await collection.createIndex(
      { confirmationNumber: 1 },
      confirmationIndexOptions
    );
    console.log(`   ✓ Created unique index on confirmationNumber: ${confirmationResult}`);
    
    // Create unique index on registrationId (sparse to allow nulls)
    const registrationIdIndexOptions: CreateIndexesOptions = { 
      unique: true, 
      sparse: true,
      name: 'idx_unique_registrationId',
      background: true
    };
    const registrationIdResult = await collection.createIndex(
      { registrationId: 1 },
      registrationIdIndexOptions
    );
    console.log(`   ✓ Created unique index on registrationId: ${registrationIdResult}`);
    
    // Verify the indexes
    console.log('\n5. Verifying indexes...');
    const indexes: IndexInfo[] = await collection.indexes();
    
    const confirmationIndex = indexes.find(idx => idx.name === 'idx_unique_confirmationNumber');
    const registrationIndex = indexes.find(idx => idx.name === 'idx_unique_registrationId');
    
    if (confirmationIndex && confirmationIndex.unique) {
      console.log('   ✓ confirmationNumber unique index verified');
    } else {
      console.log('   ✗ confirmationNumber unique index NOT properly created');
    }
    
    if (registrationIndex && registrationIndex.unique) {
      console.log('   ✓ registrationId unique index verified');
    } else {
      console.log('   ✗ registrationId unique index NOT properly created');
    }
    
    // Summary
    console.log('\n=== UNIQUE CONSTRAINTS SUMMARY ===');
    console.log('confirmationNumber: UNIQUE constraint applied (sparse - allows nulls)');
    console.log('registrationId: UNIQUE constraint applied (sparse - allows nulls)');
    console.log('\nThis matches Supabase behavior where:');
    console.log('- Duplicate confirmation numbers are prevented at database level');
    console.log('- Duplicate registration IDs are prevented at database level');
    console.log('- NULL values are allowed (for registrations not yet confirmed)');
    
    // Additional recommendations
    console.log('\n=== RECOMMENDATIONS ===');
    console.log('1. Update any code that creates registrations to handle unique constraint violations');
    console.log('2. Implement retry logic when generating confirmation numbers (like Supabase RPC functions)');
    console.log('3. Consider using MongoDB transactions for atomic operations');
    console.log('4. Example retry logic for confirmation number generation:\n');
    
    console.log(`async function generateUniqueConfirmationNumber(db: Db, registrationType: string): Promise<string> {
  const prefix = registrationType === 'lodge' ? 'LDG' : 'IND';
  let attempts = 0;
  
  while (attempts < 10) {
    const confirmationNumber = \`\${prefix}-\${
      Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
    }\${
      String.fromCharCode(65 + Math.floor(Math.random() * 26))
    }\${
      String.fromCharCode(65 + Math.floor(Math.random() * 26))
    }\`;
    
    try {
      // Test if this confirmation number already exists
      const exists = await db.collection('registrations').findOne({ confirmationNumber });
      if (!exists) {
        return confirmationNumber;
      }
    } catch (error) {
      console.error('Error checking confirmation number:', error);
    }
    
    attempts++;
  }
  
  throw new Error('Failed to generate unique confirmation number after 10 attempts');
}`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
  } finally {
    await client.close();
  }
}

addUniqueConstraints().catch(console.error);