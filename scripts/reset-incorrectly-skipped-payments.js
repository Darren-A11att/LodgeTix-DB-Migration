const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function resetIncorrectlySkippedPayments() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== RESETTING INCORRECTLY SKIPPED PAYMENTS ===\n');
    
    // Find payments marked as skipped_duplicate
    const skippedPayments = await db.collection('payment_imports').find({
      processedStatus: 'skipped_duplicate',
      processed: true
    }).toArray();
    
    console.log(`Found ${skippedPayments.length} payments marked as skipped_duplicate\n`);
    
    let resetCount = 0;
    let actuallyExistCount = 0;
    
    for (const payment of skippedPayments) {
      // Check if payment really exists in main collection
      const existsInMain = await db.collection('payments').findOne({
        $or: [
          { paymentId: payment.squarePaymentId },
          { squarePaymentId: payment.squarePaymentId },
          { transactionId: payment.transactionId }
        ]
      });
      
      if (!existsInMain) {
        // Reset to unprocessed so it can be processed again
        await db.collection('payment_imports').updateOne(
          { _id: payment._id },
          { 
            $set: { 
              processed: false,
              processedStatus: 'pending'
            },
            $unset: {
              processedAt: '',
              matchedRegistrationId: ''
            }
          }
        );
        resetCount++;
        console.log(`✓ Reset payment: ${payment.squarePaymentId} - ${payment.customerName}`);
      } else {
        actuallyExistCount++;
        console.log(`○ Payment actually exists: ${payment.squarePaymentId}`);
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total skipped payments: ${skippedPayments.length}`);
    console.log(`Actually exist in main: ${actuallyExistCount}`);
    console.log(`Reset to unprocessed: ${resetCount}`);
    
    if (resetCount > 0) {
      console.log('\n✅ These payments can now be processed again by running the sync script.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Run the reset
resetIncorrectlySkippedPayments();