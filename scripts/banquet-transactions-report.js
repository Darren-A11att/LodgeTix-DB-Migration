const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env.local' });

async function generateBanquetReport() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    console.log('='.repeat(80));
    console.log('BANQUET TRANSACTIONS REPORT');
    console.log('='.repeat(80));
    
    const db = client.db(dbName);
    
    // Count all transactions with "banquet" in the description (case-insensitive)
    const banquetCount = await db.collection('transactions').countDocuments({
      item_description: { $regex: /banquet/i }
    });
    
    console.log(`\nTotal transactions with "banquet" in description: ${banquetCount}`);
    
    // Get more detailed breakdown
    const banquetTransactions = await db.collection('transactions')
      .find({ item_description: { $regex: /banquet/i } })
      .toArray();
    
    // Group by exact description to see different types of banquet items
    const descriptionGroups = {};
    let totalRevenue = 0;
    
    banquetTransactions.forEach(transaction => {
      const desc = transaction.item_description || 'Unknown';
      if (!descriptionGroups[desc]) {
        descriptionGroups[desc] = {
          count: 0,
          totalPrice: 0,
          invoices: new Set()
        };
      }
      descriptionGroups[desc].count++;
      descriptionGroups[desc].totalPrice += (transaction.item_price || 0);
      descriptionGroups[desc].invoices.add(transaction.invoiceNumber);
      totalRevenue += (transaction.item_price || 0);
    });
    
    // Display breakdown by description
    console.log('\nBreakdown by Description:');
    console.log('-'.repeat(80));
    
    Object.entries(descriptionGroups)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([description, data]) => {
        console.log(`\nDescription: ${description}`);
        console.log(`  Count: ${data.count}`);
        console.log(`  Total Revenue: $${data.totalPrice.toFixed(2)}`);
        console.log(`  Average Price: $${(data.totalPrice / data.count).toFixed(2)}`);
        console.log(`  Unique Invoices: ${data.invoices.size}`);
      });
    
    // Summary statistics
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY STATISTICS');
    console.log('='.repeat(80));
    console.log(`Total Banquet Transactions: ${banquetCount}`);
    console.log(`Total Banquet Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`Average Banquet Price: $${(totalRevenue / banquetCount).toFixed(2)}`);
    
    // Date range of transactions
    const dateRange = await db.collection('transactions').aggregate([
      { $match: { item_description: { $regex: /banquet/i } } },
      { $group: {
        _id: null,
        minDate: { $min: '$invoiceDate' },
        maxDate: { $max: '$invoiceDate' }
      }}
    ]).toArray();
    
    if (dateRange.length > 0) {
      const minDate = new Date(dateRange[0].minDate);
      const maxDate = new Date(dateRange[0].maxDate);
      console.log(`\nDate Range: ${minDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}`);
    }
    
    // Monthly breakdown
    console.log('\nMonthly Breakdown:');
    console.log('-'.repeat(40));
    
    const monthlyBreakdown = await db.collection('transactions').aggregate([
      { $match: { item_description: { $regex: /banquet/i } } },
      { $group: {
        _id: {
          year: { $year: '$invoiceDate' },
          month: { $month: '$invoiceDate' }
        },
        count: { $sum: 1 },
        revenue: { $sum: '$item_price' }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]).toArray();
    
    monthlyBreakdown.forEach(month => {
      const monthName = new Date(month._id.year, month._id.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      console.log(`${monthName}: ${month.count} transactions, $${month.revenue.toFixed(2)}`);
    });
    
    // Export option - save to CSV
    const exportData = banquetTransactions.map(t => ({
      transactionId: t._id,
      invoiceNumber: t.invoiceNumber,
      invoiceDate: t.invoiceDate,
      description: t.item_description,
      quantity: t.item_quantity,
      price: t.item_price,
      customerName: `${t.billTo_firstName || ''} ${t.billTo_lastName || ''}`.trim(),
      customerEmail: t.billTo_email
    }));
    
    const csv = [
      'Transaction ID,Invoice Number,Invoice Date,Description,Quantity,Price,Customer Name,Customer Email',
      ...exportData.map(row => 
        `${row.transactionId},"${row.invoiceNumber}",${new Date(row.invoiceDate).toLocaleDateString()},"${row.description}",${row.quantity},${row.price},"${row.customerName}","${row.customerEmail}"`
      )
    ].join('\n');
    
    // Save CSV file
    const fs = require('fs');
    const filename = `banquet-transactions-report-${new Date().toISOString().split('T')[0]}.csv`;
    fs.writeFileSync(filename, csv);
    console.log(`\n\nReport exported to: ${filename}`);
    
  } catch (error) {
    console.error('Error generating report:', error);
  } finally {
    await client.close();
  }
}

generateBanquetReport();