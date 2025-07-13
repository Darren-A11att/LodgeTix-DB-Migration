import 'dotenv/config';
import { connectMongoDB } from '../connections/mongodb';

async function showDataQualitySummary() {
  const connection = await connectMongoDB();
  const db = connection.db;
  
  console.log('\n' + '='.repeat(70));
  console.log('DATA QUALITY SUMMARY REPORT');
  console.log('='.repeat(70));
  console.log(`Generated: ${new Date().toLocaleString()}\n`);
  
  // Payments Summary
  console.log('📊 PAYMENTS');
  console.log('-'.repeat(50));
  
  const paymentStats = await db.collection('payments').aggregate([
    {
      $group: {
        _id: { source: '$source', status: '$status' },
        count: { $sum: 1 },
        totalAmount: { $sum: '$grossAmount' }
      }
    },
    { $sort: { '_id.source': 1, '_id.status': 1 } }
  ]).toArray();
  
  let totalPayments = 0;
  let totalPaymentAmount = 0;
  
  paymentStats.forEach(stat => {
    const source = stat._id.source || 'unknown';
    const status = stat._id.status || 'unknown';
    console.log(`${source.toUpperCase()} - ${status}: ${stat.count} payments, $${stat.totalAmount.toFixed(2)}`);
    totalPayments += stat.count;
    totalPaymentAmount += stat.totalAmount;
  });
  
  console.log(`\nTotal Payments: ${totalPayments} ($${totalPaymentAmount.toFixed(2)})`);
  
  // Registrations Summary
  console.log('\n📊 REGISTRATIONS');
  console.log('-'.repeat(50));
  
  const registrationStats = {
    total: await db.collection('registrations').countDocuments(),
    paid: await db.collection('registrations').countDocuments({ paymentStatus: 'paid' }),
    pending: await db.collection('registrations').countDocuments({ 
      paymentStatus: { $in: ['pending', 'processing', 'awaiting_payment'] } 
    }),
    verified: await db.collection('registrations').countDocuments({ paymentVerified: true }),
    withSquareId: await db.collection('registrations').countDocuments({ 
      squarePaymentId: { $exists: true, $ne: null } 
    }),
    withStripeId: await db.collection('registrations').countDocuments({ 
      stripePaymentIntentId: { $exists: true, $ne: null } 
    })
  };
  
  console.log(`Total Registrations: ${registrationStats.total}`);
  console.log(`  - Paid Status: ${registrationStats.paid}`);
  console.log(`  - Pending Status: ${registrationStats.pending}`);
  console.log(`  - Payment Verified: ${registrationStats.verified}`);
  console.log(`  - With Square Payment ID: ${registrationStats.withSquareId}`);
  console.log(`  - With Stripe Payment ID: ${registrationStats.withStripeId}`);
  
  // Pending Imports Summary
  console.log('\n📊 PENDING IMPORTS');
  console.log('-'.repeat(50));
  
  const pendingCount = await db.collection('pending-imports').countDocuments();
  const pendingByReason = await db.collection('pending-imports').aggregate([
    {
      $group: {
        _id: '$reason',
        count: { $sum: 1 }
      }
    }
  ]).toArray();
  
  console.log(`Total Pending Imports: ${pendingCount}`);
  if (pendingByReason.length > 0) {
    console.log('\nBy Reason:');
    pendingByReason.forEach(item => {
      console.log(`  - ${item._id}: ${item.count}`);
    });
  }
  
  // Failed Registrations Summary
  console.log('\n📊 FAILED REGISTRATIONS');
  console.log('-'.repeat(50));
  
  const failedCount = await db.collection('failedRegistrations').countDocuments();
  const failedByReason = await db.collection('failedRegistrations').aggregate([
    {
      $group: {
        _id: '$failureReason',
        count: { $sum: 1 }
      }
    }
  ]).toArray();
  
  console.log(`Total Failed Registrations: ${failedCount}`);
  if (failedByReason.length > 0) {
    console.log('\nBy Failure Reason:');
    failedByReason.forEach(item => {
      console.log(`  - ${item._id}: ${item.count}`);
    });
  }
  
  // Data Quality Metrics
  console.log('\n📊 DATA QUALITY METRICS');
  console.log('-'.repeat(50));
  
  const totalRegistrationsAll = registrationStats.total + pendingCount + failedCount;
  const verifiedPercentage = (registrationStats.verified / totalRegistrationsAll * 100).toFixed(1);
  const pendingPercentage = (pendingCount / totalRegistrationsAll * 100).toFixed(1);
  const failedPercentage = (failedCount / totalRegistrationsAll * 100).toFixed(1);
  
  console.log(`Total Registration Records: ${totalRegistrationsAll}`);
  console.log(`  - Verified & Imported: ${registrationStats.verified} (${verifiedPercentage}%)`);
  console.log(`  - Pending Import: ${pendingCount} (${pendingPercentage}%)`);
  console.log(`  - Failed: ${failedCount} (${failedPercentage}%)`);
  
  // Payment Matching
  console.log('\n📊 PAYMENT MATCHING');
  console.log('-'.repeat(50));
  
  const registrationsWithPayments = await db.collection('registrations').aggregate([
    {
      $lookup: {
        from: 'payments',
        let: { 
          squareId: '$squarePaymentId',
          stripeId: '$stripePaymentIntentId'
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$paymentId', '$$squareId'] },
                  { $eq: ['$paymentId', '$$stripeId'] }
                ]
              }
            }
          }
        ],
        as: 'matchedPayments'
      }
    },
    {
      $group: {
        _id: null,
        totalWithMatches: {
          $sum: { $cond: [{ $gt: [{ $size: '$matchedPayments' }, 0] }, 1, 0] }
        },
        totalWithoutMatches: {
          $sum: { $cond: [{ $eq: [{ $size: '$matchedPayments' }, 0] }, 1, 0] }
        }
      }
    }
  ]).toArray();
  
  if (registrationsWithPayments.length > 0) {
    const stats = registrationsWithPayments[0];
    console.log(`Registrations with matched payments: ${stats.totalWithMatches}`);
    console.log(`Registrations without matched payments: ${stats.totalWithoutMatches}`);
  }
  
  // Recent Activity
  console.log('\n📊 RECENT ACTIVITY (Last 24 Hours)');
  console.log('-'.repeat(50));
  
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const recentPayments = await db.collection('payments').countDocuments({
    importedAt: { $gte: yesterday }
  });
  
  const recentRegistrations = await db.collection('registrations').countDocuments({
    importedAt: { $gte: yesterday }
  });
  
  const recentPending = await db.collection('pending-imports').countDocuments({
    pendingSince: { $gte: yesterday }
  });
  
  console.log(`New payments imported: ${recentPayments}`);
  console.log(`New registrations imported: ${recentRegistrations}`);
  console.log(`New pending imports: ${recentPending}`);
  
  console.log('\n' + '='.repeat(70));
  console.log('END OF REPORT');
  console.log('='.repeat(70) + '\n');
}

// Run the summary
showDataQualitySummary().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Error generating summary:', error);
  process.exit(1);
});