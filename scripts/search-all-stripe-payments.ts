import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

async function searchAllStripePayments(): Promise<void> {
  console.log('🔍 Searching for ALL Stripe payments across databases...\n');

  // Database connection strings
  const lodgetixConnectionString = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix';
  const testConnectionString = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/test?retryWrites=true&w=majority&appName=LodgeTix';

  const databases = [
    { name: 'lodgetix', connectionString: lodgetixConnectionString },
    { name: 'test', connectionString: testConnectionString }
  ];

  for (const database of databases) {
    console.log(`🔍 Searching database: ${database.name}`);
    
    let client: MongoClient | null = null;
    
    try {
      client = new MongoClient(database.connectionString);
      await client.connect();
      
      const db = client.db(database.name);
      
      // Get all collections
      const collections = await db.listCollections().toArray();
      console.log(`   Collections found: ${collections.map(c => c.name).join(', ')}`);
      
      for (const collection of collections) {
        const collectionName = collection.name;
        const coll = db.collection(collectionName);
        
        console.log(`\n   📂 Checking collection: ${collectionName}`);
        
        // Search for various Stripe-related patterns
        const searches = [
          // Direct Stripe provider fields
          { 'payment_provider': 'stripe' },
          { 'provider': 'stripe' },
          { 'metadata.provider': 'stripe' },
          
          // Stripe payment intent IDs (start with pi_)
          { 'payment_intent_id': /^pi_/ },
          { 'paymentIntentId': /^pi_/ },
          
          // Stripe charge IDs (start with ch_)
          { 'charge_id': /^ch_/ },
          { 'chargeId': /^ch_/ },
          
          // Search in nested fields for Stripe
          { 'originalData.payment_provider': 'stripe' },
          { 'paymentData.provider': 'stripe' },
          
          // Text search for "stripe" in various fields
          { 'note': /stripe/i },
          { 'description': /stripe/i },
          { 'source': /stripe/i }
        ];
        
        let foundStripePayments = false;
        
        for (const searchQuery of searches) {
          try {
            const count = await coll.countDocuments(searchQuery);
            if (count > 0) {
              foundStripePayments = true;
              console.log(`      ✅ Found ${count} documents matching: ${JSON.stringify(searchQuery)}`);
              
              // Get sample documents
              const samples = await coll.find(searchQuery).limit(3).toArray();
              samples.forEach((doc, index) => {
                console.log(`         Sample ${index + 1}: ${doc._id}`);
                if (doc.paymentId) console.log(`           paymentId: ${doc.paymentId}`);
                if (doc.payment_intent_id) console.log(`           payment_intent_id: ${doc.payment_intent_id}`);
                if (doc.payment_provider) console.log(`           payment_provider: ${doc.payment_provider}`);
                if (doc.provider) console.log(`           provider: ${doc.provider}`);
                if (doc.metadata?.provider) console.log(`           metadata.provider: ${doc.metadata.provider}`);
                if (doc.status) console.log(`           status: ${doc.status}`);
                if (doc.originalData?.status) console.log(`           originalData.status: ${doc.originalData.status}`);
              });
            }
          } catch (error) {
            // Ignore errors for unsupported queries on certain collections
          }
        }
        
        if (!foundStripePayments) {
          console.log(`      ❌ No Stripe payments found`);
        }
      }
      
    } catch (error) {
      console.error(`   ❌ Error searching database ${database.name}:`, error.message);
    } finally {
      if (client) {
        await client.close();
      }
    }
    
    console.log(`\n${'─'.repeat(50)}\n`);
  }
}

// Run the search
searchAllStripePayments()
  .then(() => {
    console.log('✅ Search completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Search failed:', error);
    process.exit(1);
  });

export { searchAllStripePayments };