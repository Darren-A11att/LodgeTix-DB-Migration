import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
const DATABASE_NAME = process.env.DATABASE_NAME || 'LodgeTix';

// Payment IDs to check
const paymentIdsToCheck = [
  'nVNemNbGg3V5dGg2EOXOnLa58AeZY',
  'bTp1t6NLdAcZLC4aAy1b7uM0KP8YY',
  'bD5NnYXdmohsMmTpxZm4LyWgmaDZY',
  'B8ola9eL7qdDsS429Y0aVe2RdFEZY',
  'ZGl4I1DWP3Szndxp5dqn8p4ryCTZY',
  '3XGeLFuHz8QmRUIhslQ1RoVdNPLZY',
  'v9dZC6uSezIMwsrldensrqNh5FYZY',
  'TF0Fz77XqhMipWYhqJY4UcS1ncVZY'
];

async function searchPaymentIdsInTransactions() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    const transactionsCollection = db.collection('transactions');
    
    console.log('\n=== Searching for Payment IDs in transactions collection ===\n');
    console.log(`Payment IDs to search: ${paymentIdsToCheck.length}`);
    console.log('─'.repeat(60));
    
    // First, let's check if any of these IDs exist in the paymentId field
    console.log('\n1. Checking paymentId field:');
    for (const paymentId of paymentIdsToCheck) {
      const transaction = await transactionsCollection.findOne({ paymentId: paymentId });
      if (transaction) {
        console.log(`✅ Found: ${paymentId}`);
        console.log(`   - Registration ID: ${transaction.registrationId}`);
        console.log(`   - Payment Status: ${transaction.paymentStatus}`);
        console.log(`   - Amount: ${transaction.paymentAmount || 'N/A'}`);
      } else {
        console.log(`❌ Not found: ${paymentId}`);
      }
    }
    
    // Let's also check if these IDs might be in any other field
    console.log('\n2. Checking all fields for these payment IDs:');
    for (const paymentId of paymentIdsToCheck) {
      const transaction = await transactionsCollection.findOne({
        $or: [
          { paymentId: paymentId },
          { transactionId: paymentId },
          { squarePaymentId: paymentId },
          { externalPaymentId: paymentId }
        ]
      });
      
      if (transaction) {
        console.log(`\n✅ Found ${paymentId} in transaction:`);
        console.log(JSON.stringify(transaction, null, 2));
      }
    }
    
    // Get sample transactions to understand the structure
    console.log('\n3. Sample transactions to understand structure:');
    const sampleTransactions = await transactionsCollection.find({}).limit(3).toArray();
    
    sampleTransactions.forEach((transaction, index) => {
      console.log(`\nSample ${index + 1}:`);
      console.log(`- _id: ${transaction._id}`);
      console.log(`- paymentId: ${transaction.paymentId}`);
      console.log(`- registrationId: ${transaction.registrationId}`);
      console.log(`- paymentStatus: ${transaction.paymentStatus}`);
      console.log(`- paymentDate: ${transaction.paymentDate}`);
      console.log(`- All fields: ${Object.keys(transaction).join(', ')}`);
    });
    
    // Check if there are any transactions without registrations
    const transactionsWithoutRegistration = await transactionsCollection.find({
      $or: [
        { registrationId: null },
        { registrationId: { $exists: false } },
        { registrationId: '' }
      ]
    }).toArray();
    
    console.log(`\n4. Transactions without registration: ${transactionsWithoutRegistration.length}`);
    if (transactionsWithoutRegistration.length > 0) {
      console.log('Payment IDs of transactions without registration:');
      transactionsWithoutRegistration.forEach(t => {
        console.log(`- ${t.paymentId || 'No paymentId'} (ID: ${t._id})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
searchPaymentIdsInTransactions().catch(console.error);