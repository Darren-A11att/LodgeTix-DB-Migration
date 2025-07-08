const { createClient } = require('@supabase/supabase-js');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

// Check for required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('ERROR: Supabase credentials not found in environment variables.');
  console.error('Please set the following environment variables:');
  console.error('- SUPABASE_URL');
  console.error('- SUPABASE_ANON_KEY');
  console.error('\nYou can either:');
  console.error('1. Add them to your .env.local file');
  console.error('2. Set them inline when running the script:');
  console.error('   SUPABASE_URL="your-url" SUPABASE_ANON_KEY="your-key" node scripts/fetch-and-save-registration.js');
  process.exit(1);
}

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// MongoDB configuration
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'lodgetix';

// Registration ID to fetch
const REGISTRATION_ID = '93b24ee1-d710-4f2f-8840-9ffbec20ce94';

async function fetchAndSaveRegistration() {
  let mongoClient;
  
  try {
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log(`Fetching registration ${REGISTRATION_ID} from Supabase...`);
    
    // Fetch specific registration from Supabase
    const { data: registration, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('registration_id', REGISTRATION_ID)
      .single();
    
    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    if (!registration) {
      throw new Error(`Registration ${REGISTRATION_ID} not found in Supabase`);
    }
    
    console.log('Registration fetched successfully:');
    console.log(JSON.stringify(registration, null, 2));
    
    // Connect to MongoDB
    console.log('\nConnecting to MongoDB...');
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    
    const db = mongoClient.db(dbName);
    const collection = db.collection('registrations');
    
    // Check if registration already exists in MongoDB
    const existingRegistration = await collection.findOne({
      $or: [
        { registration_id: REGISTRATION_ID },
        { registrationId: REGISTRATION_ID }
      ]
    });
    
    if (existingRegistration) {
      console.log('\nRegistration already exists in MongoDB. Updating...');
      
      // Update existing registration
      const result = await collection.updateOne(
        {
          $or: [
            { registration_id: REGISTRATION_ID },
            { registrationId: REGISTRATION_ID }
          ]
        },
        {
          $set: {
            ...registration,
            lastUpdatedFromSupabase: new Date(),
            supabaseSync: true
          }
        }
      );
      
      console.log(`Updated ${result.modifiedCount} document(s)`);
    } else {
      console.log('\nInserting new registration into MongoDB...');
      
      // Insert new registration
      const result = await collection.insertOne({
        ...registration,
        insertedFromSupabase: new Date(),
        supabaseSync: true
      });
      
      console.log(`Inserted document with _id: ${result.insertedId}`);
    }
    
    // Verify the saved document
    console.log('\nVerifying saved document...');
    const savedDoc = await collection.findOne({
      $or: [
        { registration_id: REGISTRATION_ID },
        { registrationId: REGISTRATION_ID }
      ]
    });
    
    console.log('Document saved successfully:');
    console.log(JSON.stringify(savedDoc, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log('\nMongoDB connection closed');
    }
  }
}

// Run the script
fetchAndSaveRegistration();