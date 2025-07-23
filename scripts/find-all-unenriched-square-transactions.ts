import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
const DATABASE_NAME = process.env.DATABASE_NAME || 'LodgeTix';

async function findAllUnenrichedTransactions() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    const squareTransactionsCollection = db.collection('squareTransactions');
    
    // Find all transactions without a registration field
    const unenrichedTransactions = await squareTransactionsCollection.find({
      registration: { $exists: false }
    }).toArray();
    
    console.log('\n=== All Unenriched Square Transactions ===\n');
    console.log(`Total unenriched transactions found: ${unenrichedTransactions.length}`);
    
    if (unenrichedTransactions.length > 0) {
      console.log('\nPayment IDs of unenriched transactions:');
      console.log('─'.repeat(50));
      
      unenrichedTransactions.forEach((transaction, index) => {
        console.log(`${index + 1}. ${transaction.id}`);
        console.log(`   - Status: ${transaction.status || 'N/A'}`);
        console.log(`   - Amount: ${transaction.amount_money?.amount ? `$${(transaction.amount_money.amount / 100).toFixed(2)}` : 'N/A'}`);
        console.log(`   - Created: ${transaction.created_at || 'N/A'}`);
        if (transaction.note) {
          console.log(`   - Note: ${transaction.note}`);
        }
        if (transaction.reference_id) {
          console.log(`   - Reference ID: ${transaction.reference_id}`);
        }
        console.log('');
      });
      
      // Check if the 8 payment IDs we're looking for are in this list
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
      
      const foundIds = unenrichedTransactions.map(t => t.id);
      const matchingIds = paymentIdsToCheck.filter(id => foundIds.includes(id));
      
      console.log('\n=== Checking for Specific Payment IDs ===');
      console.log(`Looking for ${paymentIdsToCheck.length} payment IDs`);
      console.log(`Found ${matchingIds.length} of them in unenriched transactions`);
      
      if (matchingIds.length > 0) {
        console.log('\nMatching IDs found:');
        matchingIds.forEach(id => console.log(`- ${id}`));
      }
      
      const missingIds = paymentIdsToCheck.filter(id => !foundIds.includes(id));
      if (missingIds.length > 0) {
        console.log('\nMissing IDs (not in database):');
        missingIds.forEach(id => console.log(`- ${id}`));
      }
    }
    
    // Also check total count of transactions
    const totalTransactions = await squareTransactionsCollection.countDocuments({});
    const enrichedTransactions = await squareTransactionsCollection.countDocuments({ 
      registration: { $exists: true } 
    });
    
    console.log('\n=== Database Statistics ===');
    console.log(`Total Square transactions: ${totalTransactions}`);
    console.log(`Enriched transactions: ${enrichedTransactions}`);
    console.log(`Unenriched transactions: ${unenrichedTransactions.length}`);
    console.log(`Percentage enriched: ${totalTransactions > 0 ? ((enrichedTransactions / totalTransactions) * 100).toFixed(2) : 0}%`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
findAllUnenrichedTransactions().catch(console.error);