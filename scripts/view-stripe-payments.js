const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function viewStripePayments() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== STRIPE PAYMENTS COLLECTION OVERVIEW ===\n');
    
    // Get total count
    const totalCount = await db.collection('stripe_payments').countDocuments();
    console.log(`Total Stripe payments: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log('\nNo Stripe payments found. Run "npm run sync:stripe" to import payments.\n');
      return;
    }
    
    // Get counts by account
    console.log('\n📊 Payments by Account:');
    const accountCounts = await db.collection('stripe_payments').aggregate([
      {
        $group: {
          _id: '$stripeAccountName',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          minDate: { $min: '$createdAt' },
          maxDate: { $max: '$createdAt' }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    accountCounts.forEach(account => {
      console.log(`\n  ${account._id || 'Unknown Account'}:`);
      console.log(`    - Payments: ${account.count}`);
      console.log(`    - Total Amount: $${account.totalAmount.toFixed(2)}`);
      console.log(`    - Date Range: ${account.minDate.toISOString().split('T')[0]} to ${account.maxDate.toISOString().split('T')[0]}`);
    });
    
    // Get counts by status
    console.log('\n📊 Payments by Status:');
    const statusCounts = await db.collection('stripe_payments').aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    statusCounts.forEach(status => {
      console.log(`  ${status._id}: ${status.count}`);
    });
    
    // Get connected account payments
    const connectedPayments = await db.collection('stripe_payments').countDocuments({
      stripeConnectedAccountId: { $exists: true }
    });
    
    if (connectedPayments > 0) {
      console.log(`\n📊 Connected Account Payments: ${connectedPayments}`);
      
      const connectedAccountCounts = await db.collection('stripe_payments').aggregate([
        {
          $match: { stripeConnectedAccountId: { $exists: true } }
        },
        {
          $group: {
            _id: {
              primaryAccount: '$stripePrimaryAccountName',
              connectedAccount: '$stripeConnectedAccountId'
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        },
        { $sort: { '_id.primaryAccount': 1 } }
      ]).toArray();
      
      connectedAccountCounts.forEach(account => {
        console.log(`\n  Primary: ${account._id.primaryAccount}`);
        console.log(`  Connected: ${account._id.connectedAccount}`);
        console.log(`    - Payments: ${account.count}`);
        console.log(`    - Total: $${account.totalAmount.toFixed(2)}`);
      });
    }
    
    // Get recent payments
    console.log('\n📊 Recent Payments (last 10):');
    const recentPayments = await db.collection('stripe_payments')
      .find()
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    
    console.log('\n  Date       | Account           | Amount     | Customer Email              | Payment ID');
    console.log('  -----------|-------------------|------------|-----------------------------|--------------------------');
    
    recentPayments.forEach(payment => {
      const date = payment.createdAt.toISOString().split('T')[0];
      const account = (payment.stripeAccountName || 'Unknown').padEnd(17);
      const amount = `$${payment.amount.toFixed(2)}`.padEnd(10);
      const email = (payment.customerEmail || 'No email').slice(0, 27).padEnd(27);
      const id = payment.stripePaymentIntentId;
      
      console.log(`  ${date} | ${account} | ${amount} | ${email} | ${id}`);
    });
    
    // Check for duplicates
    console.log('\n📊 Checking for Duplicates:');
    const duplicates = await db.collection('stripe_payments').aggregate([
      {
        $group: {
          _id: '$stripePaymentIntentId',
          count: { $sum: 1 },
          accounts: { $addToSet: '$stripeAccountName' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();
    
    if (duplicates.length > 0) {
      console.log(`  ⚠️  Found ${duplicates.length} duplicate payment(s):`);
      duplicates.forEach(dup => {
        console.log(`    - ${dup._id}: ${dup.count} copies in accounts: ${dup.accounts.join(', ')}`);
      });
    } else {
      console.log('  ✅ No duplicate payments found');
    }
    
    // Summary statistics
    console.log('\n📊 Summary Statistics:');
    const stats = await db.collection('stripe_payments').aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' },
          minAmount: { $min: '$amount' },
          maxAmount: { $max: '$amount' },
          uniqueCustomers: { $addToSet: '$customerEmail' }
        }
      }
    ]).toArray();
    
    if (stats.length > 0) {
      const stat = stats[0];
      console.log(`  Total Revenue: $${stat.totalAmount.toFixed(2)}`);
      console.log(`  Average Payment: $${stat.avgAmount.toFixed(2)}`);
      console.log(`  Smallest Payment: $${stat.minAmount.toFixed(2)}`);
      console.log(`  Largest Payment: $${stat.maxAmount.toFixed(2)}`);
      console.log(`  Unique Customers: ${stat.uniqueCustomers.filter(e => e).length}`);
    }
    
    console.log('\n✅ Analysis complete!\n');
    
  } catch (error) {
    console.error('Error viewing Stripe payments:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run if called directly
if (require.main === module) {
  viewStripePayments()
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { viewStripePayments };