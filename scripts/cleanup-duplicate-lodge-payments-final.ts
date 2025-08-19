import { MongoClient } from 'mongodb';

// The 12 error payment IDs to clean up
const LODGE_PAYMENT_IDS = [
  // Jerusalem Lodge (6 payments)
  '3ZJ3HBSr4UdPafNCaBainy55wc7YY',
  'lqOt4jZnIiTTlE97PDYCV3tShsPZY',
  'ZggJj2u2p8iwhRWOajCzg0zZ2YEZY',
  'XbYcqGOlLYy34w8GRh6oDKYqSKKZY',
  'xSlYUjRPlvBqdFASpTgzxyAq1RHZY',
  'jXbMStnAmtjde3RrcJyeFi1fUuRZY',
  // Mark Owen Lodge (6 payments)
  'XZvsmRdAo7cOcbytf8tXyQopLI6YY',
  'zVoh8VCpVfGVFHDPCb6tQiG9uJ8YY',
  'jjZo8QIRaYRVHjWEF6kGT2A8SqYZY',
  'xECGubABWxwHhK8cYuzZJdzEfONZY',
  '7NcA5XmQQnii5C4wyZ49VRv4O6bZY',
  'NkToF5EmmRnVVpX6UAqwfq6nBLNZY'
];

async function cleanupDuplicateLodgePayments() {
  const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix';
  const client = new MongoClient(uri);
  
  let importPaymentsUpdated = 0;
  let errorPaymentsDeleted = 0;
  const errors: string[] = [];
  const actions: string[] = [];

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const importPaymentsCollection = db.collection('import_payments');
    const errorPaymentsCollection = db.collection('error_payments');

    console.log(`\nProcessing ${LODGE_PAYMENT_IDS.length} duplicate Lodge payment IDs...\n`);

    for (const paymentId of LODGE_PAYMENT_IDS) {
      try {
        console.log(`Processing payment ID: ${paymentId}`);
        
        // 1. Update import_payments collection - mark as duplicate
        const importUpdateResult = await importPaymentsCollection.updateOne(
          { 'payment.id': paymentId },
          { 
            $set: { 
              registrationId: 'duplicate',
              duplicateNotes: 'Lodge payment - successful registration exists with different payment ID'
            }
          }
        );

        if (importUpdateResult.matchedCount > 0) {
          console.log(`✓ Marked import_payment as duplicate for ${paymentId}`);
          actions.push(`✓ Marked import_payment as duplicate: ${paymentId}`);
          importPaymentsUpdated++;
        } else {
          console.log(`⚠ No import_payment found for ${paymentId}`);
          actions.push(`⚠ No import_payment found: ${paymentId}`);
        }

        // 2. Delete from error_payments collection
        const errorDeleteResult = await errorPaymentsCollection.deleteOne({
          'payment.id': paymentId
        });

        if (errorDeleteResult.deletedCount > 0) {
          console.log(`✓ Deleted error_payment for ${paymentId}`);
          actions.push(`✓ Deleted error_payment: ${paymentId}`);
          errorPaymentsDeleted++;
        } else {
          console.log(`⚠ No error_payment found for ${paymentId}`);
          actions.push(`⚠ No error_payment found: ${paymentId}`);
        }

        console.log(''); // Empty line for readability

      } catch (error) {
        const errorMsg = `Error processing ${paymentId}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Summary report
    console.log('\n=== CLEANUP SUMMARY ===');
    console.log(`Import payments marked as duplicate: ${importPaymentsUpdated}`);
    console.log(`Error payments deleted: ${errorPaymentsDeleted}`);
    console.log(`Errors encountered: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(error => console.log(`- ${error}`));
    }

    console.log('\nDetailed Actions Taken:');
    actions.forEach(action => console.log(action));

  } catch (error) {
    console.error('Connection error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }

  return {
    importPaymentsUpdated,
    errorPaymentsDeleted,
    errors,
    actions
  };
}

cleanupDuplicateLodgePayments().catch(console.error);