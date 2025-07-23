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

async function checkUnenrichedTransactions() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    const squareTransactionsCollection = db.collection('squareTransactions');
    
    console.log('\n=== Checking Unenriched Square Transactions ===\n');
    console.log(`Total payment IDs to check: ${paymentIdsToCheck.length}`);
    console.log('-------------------------------------------\n');
    
    for (const paymentId of paymentIdsToCheck) {
      console.log(`\n📋 Payment ID: ${paymentId}`);
      console.log('═'.repeat(50));
      
      const transaction = await squareTransactionsCollection.findOne({ id: paymentId });
      
      if (!transaction) {
        console.log('❌ Transaction not found in database');
        continue;
      }
      
      // Check if enriched
      if (transaction.registration) {
        console.log('✅ Transaction is already enriched');
        console.log(`Registration ID: ${transaction.registration}`);
        continue;
      }
      
      // Report on transaction details
      console.log('❌ Transaction is NOT enriched');
      console.log('\nTransaction Details:');
      console.log(`- Status: ${transaction.status || 'N/A'}`);
      console.log(`- Created At: ${transaction.created_at || 'N/A'}`);
      console.log(`- Updated At: ${transaction.updated_at || 'N/A'}`);
      console.log(`- Amount: ${transaction.amount_money?.amount ? `$${(transaction.amount_money.amount / 100).toFixed(2)}` : 'N/A'} ${transaction.amount_money?.currency || ''}`);
      console.log(`- Location ID: ${transaction.location_id || 'N/A'}`);
      console.log(`- Order ID: ${transaction.order_id || 'N/A'}`);
      
      // Customer details
      if (transaction.customer_id) {
        console.log(`- Customer ID: ${transaction.customer_id}`);
      }
      
      // Receipt details
      if (transaction.receipt_number) {
        console.log(`- Receipt Number: ${transaction.receipt_number}`);
      }
      if (transaction.receipt_url) {
        console.log(`- Receipt URL: ${transaction.receipt_url}`);
      }
      
      // Card details
      if (transaction.card_details) {
        console.log('\nCard Details:');
        console.log(`  - Status: ${transaction.card_details.status || 'N/A'}`);
        console.log(`  - Card Brand: ${transaction.card_details.card?.card_brand || 'N/A'}`);
        console.log(`  - Last 4: ${transaction.card_details.card?.last_4 || 'N/A'}`);
        console.log(`  - Entry Method: ${transaction.card_details.entry_method || 'N/A'}`);
        
        if (transaction.card_details.card_payment_timeline) {
          console.log('\nPayment Timeline:');
          console.log(`  - Authorized At: ${transaction.card_details.card_payment_timeline.authorized_at || 'N/A'}`);
          console.log(`  - Captured At: ${transaction.card_details.card_payment_timeline.captured_at || 'N/A'}`);
        }
      }
      
      // Reference ID
      if (transaction.reference_id) {
        console.log(`\n🔍 Reference ID: ${transaction.reference_id}`);
      }
      
      // Note
      if (transaction.note) {
        console.log(`\n📝 Note: ${transaction.note}`);
      }
      
      // Check for any custom fields or metadata
      const customFields = Object.keys(transaction).filter(key => 
        !['_id', 'id', 'status', 'created_at', 'updated_at', 'amount_money', 
          'location_id', 'order_id', 'customer_id', 'receipt_number', 'receipt_url',
          'card_details', 'reference_id', 'note', 'registration'].includes(key)
      );
      
      if (customFields.length > 0) {
        console.log('\nOther Fields:');
        customFields.forEach(field => {
          console.log(`- ${field}: ${JSON.stringify(transaction[field])}`);
        });
      }
    }
    
    // Summary
    console.log('\n\n=== SUMMARY ===');
    const unenrichedCount = await squareTransactionsCollection.countDocuments({
      id: { $in: paymentIdsToCheck },
      registration: { $exists: false }
    });
    
    const enrichedCount = await squareTransactionsCollection.countDocuments({
      id: { $in: paymentIdsToCheck },
      registration: { $exists: true }
    });
    
    const notFoundCount = paymentIdsToCheck.length - unenrichedCount - enrichedCount;
    
    console.log(`Total checked: ${paymentIdsToCheck.length}`);
    console.log(`Unenriched: ${unenrichedCount}`);
    console.log(`Already enriched: ${enrichedCount}`);
    console.log(`Not found: ${notFoundCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
checkUnenrichedTransactions().catch(console.error);