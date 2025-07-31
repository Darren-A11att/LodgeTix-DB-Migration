require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function processPaymentImports() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== PROCESSING PAYMENT IMPORTS ===\n');
    
    // Get existing payment IDs to avoid duplicates
    const existingPayments = await db.collection('payments')
      .find({ 
        $or: [
          { paymentId: { $exists: true } },
          { transactionId: { $exists: true } },
          { squarePaymentId: { $exists: true } }
        ]
      })
      .project({ paymentId: 1, transactionId: 1, squarePaymentId: 1 })
      .toArray();
    
    // Create sets for faster lookup
    const existingPaymentIds = new Set(existingPayments.map(p => p.paymentId).filter(Boolean));
    const existingTransactionIds = new Set(existingPayments.map(p => p.transactionId).filter(Boolean));
    const existingSquarePaymentIds = new Set(existingPayments.map(p => p.squarePaymentId).filter(Boolean));
    
    console.log(`Found ${existingPayments.length} existing payments in payments collection`);
    
    // Get all unprocessed payment imports
    const paymentImports = await db.collection('payment_imports').find({
      $and: [
        { processed: { $ne: true } },
        { status: { $ne: 'FAILED' } }
      ]
    }).toArray();
    
    console.log(`Found ${paymentImports.length} unprocessed payment imports\n`);
    
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const importRecord of paymentImports) {
      try {
        // Check if already exists
        if (existingPaymentIds.has(importRecord.squarePaymentId) || 
            existingTransactionIds.has(importRecord.transactionId) ||
            existingSquarePaymentIds.has(importRecord.squarePaymentId)) {
          console.log(`Skipping duplicate payment: ${importRecord.squarePaymentId}`);
          skipped++;
          
          // Mark as processed to avoid reprocessing
          await db.collection('payment_imports').updateOne(
            { _id: importRecord._id },
            { 
              $set: { 
                processed: true,
                processedAt: new Date(),
                processedStatus: 'skipped_duplicate'
              }
            }
          );
          continue;
        }
        
        // Transform payment_import to payment format
        const payment = {
          // IDs
          paymentId: importRecord.squarePaymentId,
          transactionId: importRecord.transactionId || importRecord.orderId,
          squarePaymentId: importRecord.squarePaymentId,
          
          // Source
          source: 'square',
          
          // Customer info
          customerName: importRecord.customerName || 'Unknown',
          customerEmail: importRecord.customerEmail,
          customerId: importRecord.buyerId,
          
          // Amount info
          amount: importRecord.amount,
          grossAmount: importRecord.amount,
          currency: importRecord.currency || 'USD',
          
          // Payment details
          status: mapPaymentStatus(importRecord.status),
          paymentMethod: importRecord.paymentMethod,
          cardBrand: importRecord.cardBrand,
          cardLast4: importRecord.last4,
          
          // Timestamps
          timestamp: importRecord.createdAt,
          createdAt: importRecord.createdAt,
          updatedAt: importRecord.updatedAt || importRecord.createdAt,
          importedAt: importRecord.importedAt || new Date(),  // Preserve import time
          
          // Import metadata
          importedAt: new Date(),
          importedFrom: 'payment_imports',
          importId: importRecord.importId,
          
          // Additional data
          locationId: importRecord.locationId,
          orderId: importRecord.orderId,
          orderReference: importRecord.orderReference,
          receiptUrl: importRecord.receiptUrl,
          metadata: importRecord.metadata,
          
          // Store raw data for reference
          originalData: importRecord.rawSquareData
        };
        
        // Insert into payments collection
        await db.collection('payments').insertOne(payment);
        
        // Mark import as processed
        await db.collection('payment_imports').updateOne(
          { _id: importRecord._id },
          { 
            $set: { 
              processed: true,
              processedAt: new Date(),
              processedStatus: 'imported'
            }
          }
        );
        
        processed++;
        console.log(`Processed payment ${payment.paymentId} - ${payment.customerName} - $${payment.amount}`);
        
      } catch (error) {
        console.error(`Error processing import ${importRecord._id}:`, error.message);
        failed++;
        
        // Mark as failed
        await db.collection('payment_imports').updateOne(
          { _id: importRecord._id },
          { 
            $set: { 
              processed: true,
              processedAt: new Date(),
              processedStatus: 'failed',
              processingError: error.message
            }
          }
        );
      }
    }
    
    console.log('\n=== PROCESSING COMPLETE ===');
    console.log(`Total payment imports: ${paymentImports.length}`);
    console.log(`Successfully processed: ${processed}`);
    console.log(`Skipped (duplicates): ${skipped}`);
    console.log(`Failed: ${failed}`);
    
    // Check if Troy Quimpo's payment is now in payments collection
    console.log('\n=== CHECKING FOR TROY QUIMPO ===');
    const troyPayment = await db.collection('payments').findOne({
      $or: [
        { customerName: { $regex: /quimpo/i } },
        { customerEmail: { $regex: /quimpo/i } }
      ]
    });
    
    if (troyPayment) {
      console.log('✅ Found Troy Quimpo payment:', {
        id: troyPayment._id,
        paymentId: troyPayment.paymentId,
        customerName: troyPayment.customerName,
        customerEmail: troyPayment.customerEmail,
        amount: troyPayment.amount
      });
    } else {
      console.log('❌ Troy Quimpo payment not found after import');
    }
    
  } finally {
    await client.close();
  }
}

// Helper function to map payment status
function mapPaymentStatus(importStatus) {
  const statusMap = {
    'COMPLETED': 'paid',
    'APPROVED': 'paid',
    'PENDING': 'pending',
    'FAILED': 'failed',
    'CANCELED': 'cancelled',
    'CANCELLED': 'cancelled'
  };
  
  return statusMap[importStatus] || importStatus?.toLowerCase() || 'unknown';
}

// Run if called directly
if (require.main === module) {
  processPaymentImports().catch(console.error);
}

// Export for use in other scripts
module.exports = { processPaymentImports };