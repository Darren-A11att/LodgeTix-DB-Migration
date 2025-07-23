const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkUnenrichedPaymentStatus() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== UNENRICHED TRANSACTIONS PAYMENT STATUS ===\n');
    
    const squareTransactionsCollection = db.collection('squareTransactions');
    
    // The 8 unenriched payment IDs from the report
    const paymentIds = [
      'nVNemNbGg3V5dGg2EOXOnLa58AeZY',
      'bTp1t6NLdAcZLC4aAy1b7uM0KP8YY',
      'bD5NnYXdmohsMmTpxZm4LyWgmaDZY',
      'B8ola9eL7qdDsS429Y0aVe2RdFEZY',
      'ZGl4I1DWP3Szndxp5dqn8p4ryCTZY',
      '3XGeLFuHz8QmRUIhslQ1RoVdNPLZY',
      'v9dZC6uSezIMwsrldensrqNh5FYZY',
      'TF0Fz77XqhMipWYhqJY4UcS1ncVZY'
    ];
    
    console.log('Checking specific payment IDs:\n');
    
    for (const paymentId of paymentIds) {
      const transaction = await squareTransactionsCollection.findOne({ _id: paymentId });
      
      if (transaction) {
        console.log(`\nPayment ID: ${paymentId}`);
        console.log(`  Payment Status: ${transaction.payment?.status || 'Unknown'}`);
        console.log(`  Amount: $${transaction.summary?.amount ? (transaction.summary.amount / 100).toFixed(2) : 'Unknown'}`);
        console.log(`  Customer: ${transaction.summary?.customerName || 'Unknown'} (${transaction.summary?.customerEmail || 'Unknown'})`);
        console.log(`  Has Registration: ${transaction.registration ? 'Yes' : 'No'}`);
        console.log(`  Type: ${transaction.order?.metadata?.registration_type || transaction.transactionType || 'Unknown'}`);
        console.log(`  Created: ${transaction.payment?.created_at || 'Unknown'}`);
        
        // Payment details
        if (transaction.payment) {
          console.log('  Payment Details:');
          console.log(`    Card Brand: ${transaction.payment.card_details?.card?.card_brand || 'Unknown'}`);
          console.log(`    Last 4: ${transaction.payment.card_details?.card?.last_4 || 'Unknown'}`);
          console.log(`    AVS Status: ${transaction.payment.card_details?.avs_status || 'Unknown'}`);
          console.log(`    CVV Status: ${transaction.payment.card_details?.cvv_status || 'Unknown'}`);
          console.log(`    Entry Method: ${transaction.payment.card_details?.entry_method || 'Unknown'}`);
          console.log(`    Statement Description: ${transaction.payment.card_details?.statement_description || 'Unknown'}`);
        }
        
        // Order info
        if (transaction.order?.metadata) {
          console.log('  Order Metadata:');
          Object.entries(transaction.order.metadata).forEach(([key, value]) => {
            console.log(`    ${key}: ${value}`);
          });
        }
      } else {
        console.log(`\nPayment ID ${paymentId} not found in squareTransactions`);
      }
    }
    
    // Also check for ALL unenriched transactions
    console.log('\n\n=== ALL UNENRICHED TRANSACTIONS IN COLLECTION ===\n');
    
    const unenriched = await squareTransactionsCollection
      .find({ registration: { $exists: false } })
      .toArray();
    
    console.log(`Total unenriched transactions: ${unenriched.length}\n`);
    
    if (unenriched.length > 0) {
      // Group by status
      const byStatus = {};
      unenriched.forEach(tx => {
        const status = tx.payment?.status || 'UNKNOWN';
        if (!byStatus[status]) byStatus[status] = [];
        byStatus[status].push(tx);
      });
      
      console.log('Breakdown by Payment Status:');
      Object.entries(byStatus).forEach(([status, transactions]) => {
        console.log(`\n${status}: ${transactions.length} transaction(s)`);
        
        transactions.forEach(tx => {
          console.log(`  - ${tx._id}`);
          console.log(`    Amount: $${tx.summary?.amount ? (tx.summary.amount / 100).toFixed(2) : 'Unknown'}`);
          console.log(`    Customer: ${tx.summary?.customerName || 'Unknown'}`);
          console.log(`    Type: ${tx.order?.metadata?.registration_type || tx.transactionType || 'Unknown'}`);
          console.log(`    Created: ${tx.payment?.created_at || tx.summary?.createdAt || 'Unknown'}`);
        });
      });
      
      // Summary of amounts
      console.log('\n=== FINANCIAL SUMMARY ===');
      const totalAmount = unenriched.reduce((sum, tx) => {
        return sum + (tx.summary?.amount || 0);
      }, 0);
      
      console.log(`Total unenriched amount: $${(totalAmount / 100).toFixed(2)}`);
      
      // By type
      const byType = {};
      unenriched.forEach(tx => {
        const type = tx.order?.metadata?.registration_type || 'unknown';
        if (!byType[type]) byType[type] = { count: 0, amount: 0 };
        byType[type].count++;
        byType[type].amount += (tx.summary?.amount || 0);
      });
      
      console.log('\nBy Registration Type:');
      Object.entries(byType).forEach(([type, data]) => {
        console.log(`  ${type}: ${data.count} transactions, $${(data.amount / 100).toFixed(2)}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the check
checkUnenrichedPaymentStatus();