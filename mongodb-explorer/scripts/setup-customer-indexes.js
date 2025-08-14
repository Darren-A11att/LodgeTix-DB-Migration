#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function setupCustomerIndexes() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');
    
    const db = client.db('lodgetix');
    
    console.log('📋 Setting up customer collection indexes...\n');
    
    // Create unique index on import_customers.hash
    try {
      await db.collection('import_customers').createIndex(
        { hash: 1 },
        { 
          unique: true,
          name: 'hash_unique',
          background: true,
          partialFilterExpression: { hash: { $exists: true } }
        }
      );
      console.log('✓ Created unique index on import_customers.hash');
    } catch (error) {
      if (error.codeName === 'IndexOptionsConflict') {
        console.log('  Index already exists on import_customers.hash');
      } else {
        console.error('  Error creating index on import_customers:', error.message);
      }
    }
    
    // Create unique index on customers.hash
    try {
      await db.collection('customers').createIndex(
        { hash: 1 },
        { 
          unique: true,
          name: 'hash_unique',
          background: true,
          partialFilterExpression: { hash: { $exists: true } }
        }
      );
      console.log('✓ Created unique index on customers.hash');
    } catch (error) {
      if (error.codeName === 'IndexOptionsConflict') {
        console.log('  Index already exists on customers.hash');
      } else {
        console.error('  Error creating index on customers:', error.message);
      }
    }
    
    // Create compound index for customer lookup
    try {
      await db.collection('customers').createIndex(
        { firstName: 1, lastName: 1, email: 1 },
        { 
          name: 'customer_lookup',
          background: true
        }
      );
      console.log('✓ Created compound index for customer lookup');
    } catch (error) {
      if (error.codeName === 'IndexOptionsConflict') {
        console.log('  Compound index already exists on customers');
      } else {
        console.error('  Error creating compound index:', error.message);
      }
    }
    
    // Create index on customerType for filtering
    try {
      await db.collection('customers').createIndex(
        { customerType: 1 },
        { 
          name: 'customer_type',
          background: true
        }
      );
      console.log('✓ Created index on customerType');
    } catch (error) {
      if (error.codeName === 'IndexOptionsConflict') {
        console.log('  Index already exists on customerType');
      } else {
        console.error('  Error creating customerType index:', error.message);
      }
    }
    
    // List all indexes
    console.log('\n📊 Current indexes on customer collections:');
    
    const importIndexes = await db.collection('import_customers').indexes();
    console.log('\nimport_customers indexes:');
    importIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    const prodIndexes = await db.collection('customers').indexes();
    console.log('\ncustomers indexes:');
    prodIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    console.log('\n✅ Customer index setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

setupCustomerIndexes().catch(console.error);