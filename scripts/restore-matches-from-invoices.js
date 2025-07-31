#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');

async function restoreMatchesFromInvoices() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MongoDB URI not found');
    return;
  }
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('LodgeTix-migration-test-1');
    
    console.log('=== RESTORING PAYMENT-REGISTRATION MATCHES FROM INVOICES ===\n');
    
    // Method 1: Find all payments that have customerInvoice.registrationId
    const paymentsWithInvoiceRegId = await db.collection('payments').find({
      'customerInvoice.registrationId': { $exists: true, $ne: null }
    }).toArray();
    
    console.log(`Found ${paymentsWithInvoiceRegId.length} payments with customerInvoice.registrationId\n`);
    
    // Method 2: Also check invoices collection as backup
    const invoices = await db.collection('invoices').find({
      $and: [
        { paymentId: { $exists: true, $ne: null } },
        { registrationId: { $exists: true, $ne: null } }
      ]
    }).toArray();
    
    console.log(`Found ${invoices.length} invoices in invoices collection with payment and registration links\n`);
    
    const stats = {
      totalPayments: paymentsWithInvoiceRegId.length,
      totalInvoices: invoices.length,
      paymentsUpdated: 0,
      alreadyMatched: 0,
      wrongMatch: 0,
      registrationNotFound: 0,
      errors: 0
    };
    
    // Process payments with customerInvoice.registrationId first
    console.log('=== PROCESSING PAYMENTS WITH CUSTOMER INVOICE REGISTRATION IDS ===\n');
    
    for (const payment of paymentsWithInvoiceRegId) {
      try {
        const correctRegistrationId = payment.customerInvoice.registrationId;
        console.log(`\nProcessing payment: ${payment.paymentId || payment._id}`);
        console.log(`  Customer: ${payment.customerName || payment.customerEmail || 'Unknown'}`);
        console.log(`  Amount: $${payment.amount || payment.grossAmount}`);
        console.log(`  Invoice Registration ID: ${correctRegistrationId}`);
        console.log(`  Current Matched Registration ID: ${payment.matchedRegistrationId || 'None'}`);
        
        // Find the correct registration
        const registration = await db.collection('registrations').findOne({
          _id: new ObjectId(correctRegistrationId)
        });
        
        if (!registration) {
          console.log(`  ❌ Registration not found`);
          stats.registrationNotFound++;
          continue;
        }
        
        console.log(`  Found Registration: ${registration.confirmationNumber || registration._id}`);
        
        // Check if already matched correctly
        if (payment.matchedRegistrationId === correctRegistrationId) {
          console.log(`  ✓ Already matched correctly`);
          stats.alreadyMatched++;
          continue;
        }
        
        // Check if matched to wrong registration
        if (payment.matchedRegistrationId && payment.matchedRegistrationId !== correctRegistrationId) {
          console.log(`  ⚠️  Currently matched to wrong registration: ${payment.matchedRegistrationId}`);
          stats.wrongMatch++;
        }
        
        // Update the match
        const updateResult = await db.collection('payments').updateOne(
          { _id: payment._id },
          {
            $set: {
              matchedRegistrationId: correctRegistrationId,
              matchedAt: payment.customerInvoice.date || payment.timestamp || new Date(),
              matchedBy: 'invoice_restoration',
              matchMethod: 'customerInvoice_registrationId',
              matchConfidence: 100,
              matchRestored: true,
              matchRestoredAt: new Date(),
              matchRestoredFrom: 'customerInvoice.registrationId',
              previousMatchedRegistrationId: payment.matchedRegistrationId || null,
              
              // Also set for compatibility
              linkedRegistrationId: correctRegistrationId
            }
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          console.log(`  ✅ Match restored successfully`);
          stats.paymentsUpdated++;
        } else {
          console.log(`  ⚠️  No changes made`);
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing payment ${payment._id}:`, error.message);
        stats.errors++;
      }
    }
    
    // Then process invoices from invoices collection
    console.log('\n\n=== PROCESSING INVOICES FROM INVOICES COLLECTION ===\n');
    
    for (const invoice of invoices) {
      try {
        console.log(`\nProcessing invoice: ${invoice.invoiceNumber || invoice.customerInvoiceNumber || invoice._id}`);
        console.log(`  Payment ID: ${invoice.paymentId}`);
        console.log(`  Registration ID: ${invoice.registrationId}`);
        
        // Find the payment
        const payment = await db.collection('payments').findOne({
          $or: [
            { _id: new ObjectId(invoice.paymentId) },
            { paymentId: invoice.paymentId },
            { squarePaymentId: invoice.paymentId },
            { stripePaymentId: invoice.paymentId }
          ]
        });
        
        if (!payment) {
          console.log(`  ❌ Payment not found`);
          stats.paymentNotFound++;
          continue;
        }
        
        // Find the registration
        const registration = await db.collection('registrations').findOne({
          $or: [
            { _id: new ObjectId(invoice.registrationId) },
            { registrationId: invoice.registrationId }
          ]
        });
        
        if (!registration) {
          console.log(`  ❌ Registration not found`);
          stats.registrationNotFound++;
          continue;
        }
        
        // Check if already matched correctly
        if (payment.matchedRegistrationId === registration._id.toString()) {
          console.log(`  ✓ Already matched correctly`);
          stats.alreadyMatched++;
          continue;
        }
        
        // Restore the match
        const updateResult = await db.collection('payments').updateOne(
          { _id: payment._id },
          {
            $set: {
              matchedRegistrationId: registration._id.toString(),
              matchedAt: invoice.createdAt || invoice.date || new Date(),
              matchedBy: 'invoice_restoration',
              matchMethod: 'invoice_link',
              matchConfidence: 100,
              matchRestored: true,
              matchRestoredAt: new Date(),
              matchRestoredFrom: `invoice_${invoice._id}`,
              
              // Also set for compatibility
              linkedRegistrationId: registration._id.toString()
            }
          }
        );
        
        if (updateResult.modifiedCount > 0) {
          console.log(`  ✅ Match restored successfully`);
          console.log(`     Payment: ${payment.customerName || payment.customerEmail || 'Unknown'} - $${payment.amount}`);
          console.log(`     Registration: ${registration.confirmationNumber} - ${registration.bookingContact?.name || registration.attendees?.[0]?.name || 'Unknown'}`);
          stats.paymentsUpdated++;
        } else {
          console.log(`  ⚠️  No changes made`);
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing invoice ${invoice._id}:`, error.message);
        stats.errors++;
      }
    }
    
    console.log('\n=== RESTORATION COMPLETE ===');
    console.log(`Total payments with invoice registration IDs: ${stats.totalPayments}`);
    console.log(`Total invoices processed: ${stats.totalInvoices}`);
    console.log(`Matches restored: ${stats.paymentsUpdated}`);
    console.log(`Already matched correctly: ${stats.alreadyMatched}`);
    console.log(`Wrong matches corrected: ${stats.wrongMatch}`);
    console.log(`Payments not found: ${stats.paymentNotFound || 0}`);
    console.log(`Registrations not found: ${stats.registrationNotFound}`);
    console.log(`Errors: ${stats.errors}`);
    
    // Verify the restoration
    if (stats.paymentsUpdated > 0) {
      console.log('\n=== VERIFICATION ===');
      const restoredPayments = await db.collection('payments').find({
        matchRestored: true
      }).limit(5).toArray();
      
      console.log(`\nSample of restored matches:`);
      for (const payment of restoredPayments) {
        const registration = await db.collection('registrations').findOne({
          _id: new ObjectId(payment.matchedRegistrationId)
        });
        
        console.log(`\nPayment: ${payment.paymentId || payment._id}`);
        console.log(`  Customer: ${payment.customerName || payment.customerEmail}`);
        console.log(`  Amount: $${payment.amount}`);
        console.log(`  Matched to: ${registration?.confirmationNumber || 'Unknown'}`);
        console.log(`  Registration type: ${registration?.registrationType || 'Unknown'}`);
      }
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await client.close();
  }
}

// Run if called directly
if (require.main === module) {
  console.log('Starting match restoration from invoices...\n');
  
  restoreMatchesFromInvoices()
    .then(() => {
      console.log('\n✅ Match restoration completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Match restoration failed:', error);
      process.exit(1);
    });
}

module.exports = { restoreMatchesFromInvoices };