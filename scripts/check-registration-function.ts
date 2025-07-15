import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'lodgetix';

async function checkRegistrationFunction() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log('Checking Registration IND-296416RL (Randall Wilson)\n');
    console.log('='.repeat(60));
    
    // Find the registration by confirmationNumber
    const registration = await db.collection('registrations').findOne({
      confirmationNumber: 'IND-296416RL'
    });
    
    if (!registration) {
      console.log('Registration not found!');
      return;
    }
    
    console.log('\n1. Registration Details:');
    console.log(`   - Confirmation Number: ${registration.confirmationNumber}`);
    console.log(`   - Registration ID: ${registration._id}`);
    console.log(`   - Function ID: ${registration.functionId || 'NOT SET'}`);
    console.log(`   - Function Name: ${registration.functionName || 'NOT SET'}`);
    console.log(`   - Registration Type: ${registration.registrationType}`);
    
    if (registration.functionId) {
      // Try to fetch the function
      let functionDoc = null;
      const functionId = registration.functionId;
      
      console.log('\n2. Looking up Function in Database:');
      
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
        console.log('\n3. Function Found:');
        console.log(`   - Function Name: ${functionDoc.name}`);
        console.log(`   - This should appear in emails as: "${functionDoc.name}"`);
      } else {
        console.log('\n3. Function NOT Found!');
        console.log('   - This explains why emails show "Function" instead of the actual name');
      }
    } else {
      console.log('\n2. NO FUNCTION ID SET!');
      console.log('   - This registration has no functionId');
      console.log('   - This is why emails default to "Function"');
    }
    
    // Check the payment record too
    if (registration.paymentId) {
      const payment = await db.collection('payments').findOne({
        _id: registration.paymentId
      });
      
      if (payment) {
        console.log('\n4. Payment Record:');
        console.log(`   - Payment ID: ${payment._id}`);
        console.log(`   - Invoice Email Sent: ${payment.invoiceEmailSent || false}`);
        console.log(`   - Invoice Emailed To: ${payment.invoiceEmailedTo || 'NOT SET'}`);
      }
    }
    
    // Check invoice record
    const invoice = await db.collection('invoices').findOne({
      registrationId: registration._id
    });
    
    if (invoice) {
      console.log('\n5. Invoice Record:');
      console.log(`   - Invoice Number: ${invoice.invoiceNumber}`);
      console.log(`   - Email Sent: ${invoice.emailSent || false}`);
      console.log(`   - Emailed To: ${invoice.emailedTo || 'NOT SET'}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the check
checkRegistrationFunction().catch(console.error);