const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function verifySquareImportCompleteness() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== VERIFYING SQUARE IMPORT COMPLETENESS ===\n');
    
    // Read the CSV file
    const csvPath = '/Users/darrenallatt/Downloads/transactions-2025-01-01-2026-01-01.csv';
    console.log(`Reading CSV report: ${csvPath}\n`);
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`Found ${records.length} transactions in CSV report\n`);
    
    // Get all imported transactions from MongoDB
    const transactionsCollection = db.collection('squareTransactions');
    const importedTransactions = await transactionsCollection.find({}).toArray();
    const importedIds = new Set(importedTransactions.map(t => t._id));
    
    console.log(`Found ${importedTransactions.length} transactions in MongoDB\n`);
    
    // Analyze CSV transactions
    const missingTransactions = [];
    const transactionsByStatus = {};
    const transactionsByType = {};
    let totalAmountInCSV = 0;
    
    for (const record of records) {
      // Extract transaction ID from various possible fields
      let transactionId = record['Transaction ID'] || 
                         record['Payment ID'] || 
                         record['Transaction'] ||
                         record['ID'];
      
      // Clean up the ID if needed
      if (transactionId) {
        transactionId = transactionId.trim();
      }
      
      // Get amount
      const grossAmount = parseFloat(record['Gross Amount'] || record['Amount'] || '0');
      totalAmountInCSV += grossAmount;
      
      // Get status
      const status = record['Transaction Status'] || record['Status'] || 'Unknown';
      transactionsByStatus[status] = (transactionsByStatus[status] || 0) + 1;
      
      // Get type
      const type = record['Transaction Type'] || record['Type'] || 'Unknown';
      transactionsByType[type] = (transactionsByType[type] || 0) + 1;
      
      // Check if this transaction is imported
      if (transactionId && !importedIds.has(transactionId)) {
        missingTransactions.push({
          id: transactionId,
          date: record['Date'] || record['Created At'] || record['Time'],
          amount: grossAmount,
          status: status,
          type: type,
          customer: record['Customer Name'] || record['Customer'] || 'Unknown',
          description: record['Description'] || record['Item'] || ''
        });
      }
    }
    
    console.log('=== CSV ANALYSIS ===');
    console.log(`Total transactions: ${records.length}`);
    console.log(`Total amount: $${totalAmountInCSV.toFixed(2)}`);
    
    console.log('\nTransactions by Status:');
    Object.entries(transactionsByStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    console.log('\nTransactions by Type:');
    Object.entries(transactionsByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    console.log('\n=== IMPORT VERIFICATION ===');
    console.log(`Transactions in CSV: ${records.length}`);
    console.log(`Transactions in MongoDB: ${importedTransactions.length}`);
    console.log(`Missing transactions: ${missingTransactions.length}`);
    
    if (missingTransactions.length > 0) {
      console.log('\n⚠️  MISSING TRANSACTIONS:\n');
      
      // Group missing by date
      const missingByDate = {};
      missingTransactions.forEach(tx => {
        const date = tx.date || 'Unknown Date';
        if (!missingByDate[date]) {
          missingByDate[date] = [];
        }
        missingByDate[date].push(tx);
      });
      
      // Show missing transactions by date
      Object.entries(missingByDate).forEach(([date, transactions]) => {
        console.log(`\n${date} (${transactions.length} transactions):`);
        transactions.forEach(tx => {
          console.log(`  - ${tx.id || 'No ID'} | $${tx.amount.toFixed(2)} | ${tx.status} | ${tx.customer}`);
          if (tx.description) {
            console.log(`    ${tx.description}`);
          }
        });
      });
      
      // Save missing transactions to file
      const outputPath = path.join(__dirname, 'missing-square-transactions.json');
      fs.writeFileSync(outputPath, JSON.stringify({
        count: missingTransactions.length,
        transactions: missingTransactions,
        summary: {
          totalMissingAmount: missingTransactions.reduce((sum, tx) => sum + tx.amount, 0),
          byStatus: missingTransactions.reduce((acc, tx) => {
            acc[tx.status] = (acc[tx.status] || 0) + 1;
            return acc;
          }, {}),
          byType: missingTransactions.reduce((acc, tx) => {
            acc[tx.type] = (acc[tx.type] || 0) + 1;
            return acc;
          }, {})
        }
      }, null, 2));
      
      console.log(`\n💾 Missing transactions saved to: ${outputPath}`);
    } else {
      console.log('\n✅ All transactions from CSV are imported!');
    }
    
    // Check for transactions in MongoDB but not in CSV
    const csvIds = new Set();
    records.forEach(record => {
      const id = record['Transaction ID'] || record['Payment ID'] || record['Transaction'] || record['ID'];
      if (id) {
        csvIds.add(id.trim());
      }
    });
    
    const inMongoNotInCSV = importedTransactions.filter(t => !csvIds.has(t._id));
    
    if (inMongoNotInCSV.length > 0) {
      console.log(`\n⚠️  Found ${inMongoNotInCSV.length} transactions in MongoDB but not in CSV:`);
      inMongoNotInCSV.forEach(tx => {
        console.log(`  - ${tx._id} | $${(tx.summary.amount / 100).toFixed(2)} | ${tx.payment.created_at}`);
      });
    }
    
    // Date range analysis
    console.log('\n=== DATE RANGE ANALYSIS ===');
    
    // Get date range from CSV
    const csvDates = records.map(r => {
      const dateStr = r['Date'] || r['Created At'] || r['Time'];
      return dateStr ? new Date(dateStr) : null;
    }).filter(d => d && !isNaN(d));
    
    if (csvDates.length > 0) {
      const csvMinDate = new Date(Math.min(...csvDates));
      const csvMaxDate = new Date(Math.max(...csvDates));
      console.log(`CSV date range: ${csvMinDate.toISOString()} to ${csvMaxDate.toISOString()}`);
    }
    
    // Get date range from MongoDB
    const mongoDateRange = await transactionsCollection.aggregate([
      {
        $group: {
          _id: null,
          minDate: { $min: '$payment.created_at' },
          maxDate: { $max: '$payment.created_at' }
        }
      }
    ]).toArray();
    
    if (mongoDateRange.length > 0) {
      console.log(`MongoDB date range: ${mongoDateRange[0].minDate} to ${mongoDateRange[0].maxDate}`);
    }
    
    // Recommendations
    console.log('\n=== RECOMMENDATIONS ===');
    
    if (missingTransactions.length > 0) {
      const oldestMissing = missingTransactions.reduce((oldest, tx) => {
        const date = new Date(tx.date);
        return !oldest || date < new Date(oldest.date) ? tx : oldest;
      }, null);
      
      const newestMissing = missingTransactions.reduce((newest, tx) => {
        const date = new Date(tx.date);
        return !newest || date > new Date(newest.date) ? tx : newest;
      }, null);
      
      console.log(`\n1. Run the import script with extended date range:`);
      console.log(`   Oldest missing: ${oldestMissing?.date}`);
      console.log(`   Newest missing: ${newestMissing?.date}`);
      console.log(`\n2. Some transactions might be:`);
      console.log(`   - Refunds or adjustments (check transaction types)`);
      console.log(`   - From different Square accounts or locations`);
      console.log(`   - Test transactions that should be excluded`);
    } else {
      console.log('\n✅ Import is complete! All transactions are accounted for.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the verification
verifySquareImportCompleteness();