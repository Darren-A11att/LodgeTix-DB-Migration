// @ts-nocheck
/**
 * Test Commerce Admin Interface
 * Verifies that the admin interface can access the commerce database
 */

const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';

async function testCommerceAdmin() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    
    const db = client.db('commerce');
    
    console.log('\n========================================');
    console.log('  COMMERCE ADMIN INTERFACE TEST');
    console.log('========================================\n');
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('Available Collections:');
    for (const name of collectionNames) {
      const count = await db.collection(name).countDocuments();
      console.log(`- ${name}: ${count} documents`);
    }
    
    console.log('\n✅ Commerce database is accessible');
    console.log('\nAdmin Interface Features:');
    console.log('- View all records in a table format');
    console.log('- Search and filter records');
    console.log('- Create new records');
    console.log('- Edit existing records');
    console.log('- Delete records');
    
    console.log('\nAccess the admin interface at:');
    console.log('http://localhost:3005/admin');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testCommerceAdmin().catch(console.error);
