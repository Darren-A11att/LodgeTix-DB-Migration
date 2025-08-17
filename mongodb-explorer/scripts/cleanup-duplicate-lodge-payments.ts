import { MongoClient } from 'mongodb';

const MONGODB_URI = "mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1";

interface PaymentToCleanup {
  paymentId: string;
  lodge: string;
}

const paymentsToCleanup: PaymentToCleanup[] = [
  // Jerusalem Lodge payments
  { paymentId: "3ZJ3HBSr4UdPafNCaBainy55wc7YY", lodge: "Jerusalem" },
  { paymentId: "lqOt4jZnIiTTlE97PDYCV3tShsPZY", lodge: "Jerusalem" },
  { paymentId: "ZggJj2u2p8iwhRWOajCzg0zZ2YEZY", lodge: "Jerusalem" },
  { paymentId: "XbYcqGOlLYy34w8GRh6oDKYqSKKZY", lodge: "Jerusalem" },
  { paymentId: "xSlYUjRPlvBqdFASpTgzxyAq1RHZY", lodge: "Jerusalem" },
  { paymentId: "jXbMStnAmtjde3RrcJyeFi1fUuRZY", lodge: "Jerusalem" },
  
  // Mark Owen Lodge payments
  { paymentId: "XZvsmRdAo7cOcbytf8tXyQopLI6YY", lodge: "Mark Owen" },
  { paymentId: "zVoh8VCpVfGVFHDPCb6tQiG9uJ8YY", lodge: "Mark Owen" },
  { paymentId: "jjZo8QIRaYRVHjWEF6kGT2A8SqYZY", lodge: "Mark Owen" },
  { paymentId: "xECGubABWxwHhK8cYuzZJdzEfONZY", lodge: "Mark Owen" },
  { paymentId: "7NcA5XmQQnii5C4wyZ49VRv4O6bZY", lodge: "Mark Owen" },
  { paymentId: "NkToF5EmmRnVVpX6UAqwfq6nBLNZY", lodge: "Mark Owen" }
];

async function cleanupDuplicatePayments() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const importPaymentsCollection = db.collection('import_payments');
    const errorPaymentsCollection = db.collection('error_payments');
    
    let importPaymentsMarked = 0;
    let errorPaymentsDeleted = 0;
    const processedPaymentIds: string[] = [];
    
    console.log(`\n🧹 Starting cleanup of ${paymentsToCleanup.length} duplicate/failed payments...\n`);
    
    for (const payment of paymentsToCleanup) {
      console.log(`\n--- Processing ${payment.lodge} Lodge Payment: ${payment.paymentId} ---`);
      
      // 1. Mark as duplicate in import_payments
      const updateResult = await importPaymentsCollection.updateOne(
        { paymentId: payment.paymentId },
        { 
          $set: { 
            status: 'duplicate',
            isDuplicate: true,
            duplicateNote: `Marked as duplicate - successful registration exists for ${payment.lodge} Lodge`,
            duplicateMarkedAt: new Date()
          }
        }
      );
      
      if (updateResult.matchedCount > 0) {
        console.log(`✅ Marked import_payment as duplicate: ${payment.paymentId}`);
        importPaymentsMarked++;
      } else {
        console.log(`⚠️  No import_payment found for: ${payment.paymentId}`);
      }
      
      // 2. Delete from error_payments
      const deleteResult = await errorPaymentsCollection.deleteOne({
        paymentId: payment.paymentId
      });
      
      if (deleteResult.deletedCount > 0) {
        console.log(`🗑️  Deleted from error_payments: ${payment.paymentId}`);
        errorPaymentsDeleted++;
      } else {
        console.log(`⚠️  No error_payment found for: ${payment.paymentId}`);
      }
      
      processedPaymentIds.push(payment.paymentId);
    }
    
    // Final summary
    console.log(`\n🎯 CLEANUP SUMMARY:`);
    console.log(`================`);
    console.log(`📊 Import payments marked as duplicate: ${importPaymentsMarked}`);
    console.log(`🗑️  Error payments deleted: ${errorPaymentsDeleted}`);
    console.log(`📝 Total payment IDs processed: ${processedPaymentIds.length}`);
    
    console.log(`\n📋 All Payment IDs Processed:`);
    processedPaymentIds.forEach((id, index) => {
      const payment = paymentsToCleanup[index];
      console.log(`   ${index + 1}. ${id} (${payment.lodge} Lodge)`);
    });
    
    // Verify cleanup
    console.log(`\n🔍 Verification:`);
    const remainingErrorPayments = await errorPaymentsCollection.countDocuments({
      paymentId: { $in: processedPaymentIds }
    });
    
    const markedImportPayments = await importPaymentsCollection.countDocuments({
      paymentId: { $in: processedPaymentIds },
      isDuplicate: true
    });
    
    console.log(`   Remaining error_payments for these IDs: ${remainingErrorPayments} (should be 0)`);
    console.log(`   Import_payments marked as duplicate: ${markedImportPayments}`);
    
    if (remainingErrorPayments === 0 && markedImportPayments === processedPaymentIds.length) {
      console.log(`\n✅ CLEANUP SUCCESSFUL! All duplicate payments have been properly processed.`);
    } else {
      console.log(`\n⚠️  CLEANUP INCOMPLETE - some payments may not have been processed correctly.`);
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

cleanupDuplicatePayments().catch(console.error);