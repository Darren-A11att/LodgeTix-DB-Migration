import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'lodgetix';

async function testFunctionNameRetrieval() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('Testing Function Name Retrieval for Invoice Emails\n');
    console.log('='.repeat(60));
    
    // Get a sample registration with a functionId
    const registration = await db.collection('registrations').findOne({
      functionId: { $exists: true, $ne: null }
    });
    
    if (!registration) {
      console.log('No registrations found with functionId');
      return;
    }
    
    console.log('\n1. Sample Registration:');
    console.log(`   - Registration ID: ${registration._id}`);
    console.log(`   - Function ID: ${registration.functionId}`);
    console.log(`   - Function Name in Registration: ${registration.functionName || 'Not stored'}`);
    
    // Test the function retrieval logic
    let functionDoc = null;
    const functionId = registration.functionId;
    
    console.log('\n2. Testing Function Retrieval Methods:');
    
    // Method 1: Find by functionId field
    functionDoc = await db.collection('functions').findOne({ functionId });
    console.log(`   - By functionId field: ${functionDoc ? 'Found' : 'Not found'}`);
    
    // Method 2: Find by _id if valid ObjectId
    if (!functionDoc && ObjectId.isValid(functionId)) {
      functionDoc = await db.collection('functions').findOne({ _id: new ObjectId(functionId) });
      console.log(`   - By _id field: ${functionDoc ? 'Found' : 'Not found'}`);
    }
    
    // Method 3: Find by id field
    if (!functionDoc) {
      functionDoc = await db.collection('functions').findOne({ id: functionId });
      console.log(`   - By id field: ${functionDoc ? 'Found' : 'Not found'}`);
    }
    
    if (functionDoc) {
      console.log('\n3. Function Details:');
      console.log(`   - Function Name: ${functionDoc.name}`);
      console.log(`   - Function Date: ${functionDoc.date}`);
      console.log(`   - Lodge: ${functionDoc.lodge}`);
      
      console.log('\n4. Email Generation Test:');
      console.log(`   - Function name for email: "${functionDoc.name}"`);
      console.log(`   - Email subject would be: "Tax Invoice [INVOICE_NUMBER] for ${functionDoc.name}"`);
      console.log(`   - Email body would include: "Thank you for registering for ${functionDoc.name}"`);
    } else {
      console.log('\n❌ ERROR: Function not found in database!');
      console.log('   This would result in emails using "Function" as the default name');
    }
    
    // Test multiple registrations
    console.log('\n5. Testing Multiple Registrations:');
    const registrationsWithFunctions = await db.collection('registrations')
      .find({ functionId: { $exists: true, $ne: null } })
      .limit(5)
      .toArray();
    
    for (const reg of registrationsWithFunctions) {
      let func = null;
      
      // Try all methods to find the function
      func = await db.collection('functions').findOne({ functionId: reg.functionId });
      if (!func && ObjectId.isValid(reg.functionId)) {
        func = await db.collection('functions').findOne({ _id: new ObjectId(reg.functionId) });
      }
      if (!func) {
        func = await db.collection('functions').findOne({ id: reg.functionId });
      }
      
      console.log(`   - Registration ${reg._id}:`);
      console.log(`     Function ID: ${reg.functionId}`);
      console.log(`     Function Found: ${func ? 'Yes' : 'No'}`);
      console.log(`     Function Name: ${func ? func.name : 'Would use default "Function"'}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the test
testFunctionNameRetrieval().catch(console.error);