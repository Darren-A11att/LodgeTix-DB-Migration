import { connectMongoDB } from '../connections/mongodb';

async function checkPaymentFormats() {
  const connection = await connectMongoDB();
  const paymentsCollection = connection.db.collection('payments');
  
  console.log('🔍 Checking payment data formats...\n');
  
  // Check for various status formats
  const statusCounts = await paymentsCollection.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        sources: { $addToSet: '$source' }
      }
    },
    { $sort: { count: -1 } }
  ]).toArray();
  
  console.log('Status distribution:');
  statusCounts.forEach(item => {
    console.log(`  ${item._id}: ${item.count} (sources: ${item.sources.join(', ')})`);
  });
  
  // Check for payments with string amounts (with currency symbols)
  console.log('\n🔍 Checking for string amount fields...');
  
  const stringAmountPayments = await paymentsCollection.find({
    $or: [
      { grossAmount: { $type: 'string' } },
      { netAmount: { $type: 'string' } },
      { feeAmount: { $type: 'string' } }
    ]
  }).limit(5).toArray();
  
  if (stringAmountPayments.length > 0) {
    console.log(`Found ${stringAmountPayments.length} payments with string amounts:`);
    stringAmountPayments.forEach((payment, index) => {
      console.log(`\nPayment ${index + 1} (${payment.source}):`);
      console.log(`  grossAmount: ${payment.grossAmount} (type: ${typeof payment.grossAmount})`);
      console.log(`  netAmount: ${payment.netAmount} (type: ${typeof payment.netAmount})`);
      console.log(`  feeAmount: ${payment.feeAmount} (type: ${typeof payment.feeAmount})`);
    });
  } else {
    console.log('✓ All amount fields are numbers');
  }
  
  // Check for negative fees
  console.log('\n🔍 Checking for negative fees...');
  const negativeFeePayments = await paymentsCollection.find({
    feeAmount: { $lt: 0 }
  }).limit(5).toArray();
  
  if (negativeFeePayments.length > 0) {
    console.log(`Found ${negativeFeePayments.length} payments with negative fees:`);
    negativeFeePayments.forEach((payment, index) => {
      console.log(`  Payment ${index + 1}: feeAmount = ${payment.feeAmount} (${payment.source})`);
    });
  } else {
    console.log('✓ No negative fees found');
  }
  
  // Check for missing currency
  console.log('\n🔍 Checking for missing currency...');
  const missingCurrencyCount = await paymentsCollection.countDocuments({
    $or: [
      { currency: { $exists: false } },
      { currency: '' },
      { currency: null }
    ]
  });
  
  if (missingCurrencyCount > 0) {
    console.log(`Found ${missingCurrencyCount} payments without currency`);
    const samples = await paymentsCollection.find({
      $or: [
        { currency: { $exists: false } },
        { currency: '' },
        { currency: null }
      ]
    }).limit(3).toArray();
    
    samples.forEach((payment, index) => {
      console.log(`  Payment ${index + 1}: source=${payment.source}, transactionId=${payment.transactionId}`);
    });
  } else {
    console.log('✓ All payments have currency');
  }
  
  // Check for already normalized payments
  console.log('\n🔍 Checking normalization status...');
  const normalizedCount = await paymentsCollection.countDocuments({ normalized: true });
  const totalCount = await paymentsCollection.countDocuments();
  
  console.log(`Total payments: ${totalCount}`);
  console.log(`Already normalized: ${normalizedCount}`);
  console.log(`Not normalized: ${totalCount - normalizedCount}`);
  
  // Check original CSV data
  console.log('\n🔍 Checking originalData for unconverted values...');
  const sampleWithOriginal = await paymentsCollection.find({
    'originalData.Fees': { $exists: true }
  }).limit(3).toArray();
  
  if (sampleWithOriginal.length > 0) {
    console.log('Sample original data:');
    sampleWithOriginal.forEach((payment, index) => {
      console.log(`\nPayment ${index + 1}:`);
      console.log(`  Current feeAmount: ${payment.feeAmount}`);
      console.log(`  Original Fees: ${payment.originalData.Fees}`);
      console.log(`  Original Gross Sales: ${payment.originalData['Gross Sales']}`);
      console.log(`  Original Transaction Status: ${payment.originalData['Transaction Status']}`);
    });
  }
}

checkPaymentFormats().then(() => {
  console.log('\n✅ Check complete!');
  process.exit(0);
}).catch(error => {
  console.error('Check failed:', error);
  process.exit(1);
});