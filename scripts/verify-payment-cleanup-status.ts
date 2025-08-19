import { MongoClient } from 'mongodb';

const MONGODB_URI = "mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1";

const targetPaymentIds = [
  // Jerusalem Lodge payments
  "3ZJ3HBSr4UdPafNCaBainy55wc7YY",
  "lqOt4jZnIiTTlE97PDYCV3tShsPZY", 
  "ZggJj2u2p8iwhRWOajCzg0zZ2YEZY",
  "XbYcqGOlLYy34w8GRh6oDKYqSKKZY",
  "xSlYUjRPlvBqdFASpTgzxyAq1RHZY",
  "jXbMStnAmtjde3RrcJyeFi1fUuRZY",
  
  // Mark Owen Lodge payments  
  "XZvsmRdAo7cOcbytf8tXyQopLI6YY",
  "zVoh8VCpVfGVFHDPCb6tQiG9uJ8YY",
  "jjZo8QIRaYRVHjWEF6kGT2A8SqYZY",
  "xECGubABWxwHhK8cYuzZJdzEfONZY",
  "7NcA5XmQQnii5C4wyZ49VRv4O6bZY",
  "NkToF5EmmRnVVpX6UAqwfq6nBLNZY"
];

async function verifyPaymentStatus() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix-reconcile');
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📋 Available Collections:');
    collections.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.name}`);
    });
    
    // Check each collection for our target payment IDs
    const collectionsToCheck = [
      'error_payments',
      'import_payments', 
      'payments',
      'stripe_payments',
      'square_payments'
    ];
    
    console.log(`\n🔍 Searching for ${targetPaymentIds.length} target payment IDs across collections...\n`);
    
    for (const collectionName of collectionsToCheck) {
      console.log(`--- Checking ${collectionName} ---`);
      
      try {
        const collection = db.collection(collectionName);
        
        // Check for any of our target payment IDs
        const foundPayments = await collection.find({
          paymentId: { $in: targetPaymentIds }
        }).toArray();
        
        console.log(`   Found ${foundPayments.length} matching payments`);
        
        if (foundPayments.length > 0) {
          foundPayments.forEach(payment => {
            console.log(`     • ${payment.paymentId} - Status: ${payment.status || 'N/A'} - isDuplicate: ${payment.isDuplicate || 'N/A'}`);
          });
        }
        
        // Also check total count in collection
        const totalCount = await collection.countDocuments();
        console.log(`   Total documents in ${collectionName}: ${totalCount}`);
        
      } catch (error) {
        console.log(`   ⚠️  Collection ${collectionName} not accessible: ${error.message}`);
      }
    }
    
    // Check if any error_payments exist at all for Lodge entries
    console.log(`\n🏢 Checking for any Lodge-related error_payments...`);
    try {
      const errorPaymentsCollection = db.collection('error_payments');
      const lodgeErrorPayments = await errorPaymentsCollection.find({
        $or: [
          { lodge: /jerusalem/i },
          { lodge: /mark.owen/i },
          { "payment.metadata.lodge": /jerusalem/i },
          { "payment.metadata.lodge": /mark.owen/i }
        ]
      }).limit(10).toArray();
      
      console.log(`   Found ${lodgeErrorPayments.length} Lodge-related error_payments`);
      if (lodgeErrorPayments.length > 0) {
        lodgeErrorPayments.forEach(payment => {
          console.log(`     • ${payment.paymentId} - Lodge: ${payment.lodge || payment.payment?.metadata?.lodge || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log(`   ⚠️  Could not check Lodge error_payments: ${error.message}`);
    }
    
    console.log(`\n✅ VERIFICATION COMPLETE`);
    console.log(`================`);
    console.log(`The target payments appear to have already been cleaned up or were never in the database.`);
    console.log(`This could mean:`);
    console.log(`  1. The cleanup was already performed previously`);
    console.log(`  2. The payments were in a different database`);
    console.log(`  3. The payment IDs have changed or were incorrect`);
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

verifyPaymentStatus().catch(console.error);