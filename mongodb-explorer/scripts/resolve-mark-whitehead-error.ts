import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';

async function resolveMarkWhiteheadError() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const collection = db.collection('error_payments');
    
    console.log('🔍 Looking for Mark Whitehead error payment...\n');
    
    // Find the error payment
    const errorPayment = await collection.findOne({ 
      _id: new ObjectId('68a09e53c18a9f49d904808c')
    });
    
    if (!errorPayment) {
      console.log('❌ Error payment not found');
      return;
    }
    
    console.log('✅ Found error payment:');
    console.log(`   ID: ${errorPayment._id}`);
    console.log(`   Payment ID: ${errorPayment.paymentId}`);
    console.log(`   Customer: ${errorPayment.originalData?.customer?.given_name} ${errorPayment.originalData?.customer?.family_name}`);
    console.log(`   Amount: $${(errorPayment.originalData?.order?.total_money?.amount / 100)} ${errorPayment.originalData?.order?.total_money?.currency}`);
    console.log(`   Current Status: ${errorPayment.status || 'UNMATCHED'}`);
    
    // Update the error payment to mark as resolved
    console.log('\n🔧 Marking error payment as resolved...');
    
    const updateResult = await collection.updateOne(
      { _id: new ObjectId('68a09e53c18a9f49d904808c') },
      { 
        $set: { 
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedBy: "manual-registration-consolidation",
          resolution: {
            method: "duplicate_registration_merge",
            description: "Two separate registrations found for same payment - Grand Communication (free) and Proclamation Ceremony tickets. Communication ticket manually added to Proclamation registration.",
            registrationIds: [
              "73a43460-d2d6-4554-972c-e527f19dd286", // Primary registration (Proclamation + Communication)
              "3a1f724e-de9c-4413-b9ca-ba37f797345f"  // Secondary registration (was separate)
            ],
            primaryRegistrationId: "73a43460-d2d6-4554-972c-e527f19dd286",
            paymentId: "jvDGAbKHUVx16rkHQInX8NxfPC7YY",
            stripePaymentIntentId: errorPayment.originalData?.id || errorPayment.paymentId,
            resolvedDate: new Date().toISOString(),
            notes: "Issue was caused by duplicate registrations for same payment. Customer purchased both Grand Communication (free) and Proclamation Ceremony tickets in single transaction but system created separate registrations. Manual consolidation completed."
          },
          metadata: {
            ...errorPayment.metadata,
            resolutionDetails: {
              issueType: "duplicate_registrations",
              rootCause: "Same payment created multiple registration records",
              solution: "Consolidated tickets into single registration",
              ticketsInvolved: [
                {
                  type: "Grand Communication",
                  price: 0,
                  description: "Free ticket"
                },
                {
                  type: "Proclamation Ceremony", 
                  price: 20.45,
                  description: "Paid ticket"
                }
              ]
            }
          }
        }
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log('✅ Error payment successfully marked as resolved');
      
      // Verify the update
      const updatedPayment = await collection.findOne({ 
        _id: new ObjectId('68a09e53c18a9f49d904808c') 
      });
      
      console.log('\n📋 RESOLUTION SUMMARY:');
      console.log('════════════════════════════════════════════════════════════');
      console.log(`💳 Payment ID: ${updatedPayment.paymentId}`);
      console.log(`👤 Customer: Mark Whitehead`);
      console.log(`💰 Amount: $20.45 AUD`);
      console.log(`📧 Email: whitie62@gmail.com`);
      console.log(`✅ Status: ${updatedPayment.status}`);
      console.log(`🔧 Resolved By: ${updatedPayment.resolvedBy}`);
      console.log(`📅 Resolved At: ${updatedPayment.resolvedAt}`);
      console.log(`🎫 Primary Registration: ${updatedPayment.resolution.primaryRegistrationId}`);
      console.log(`📝 Method: ${updatedPayment.resolution.method}`);
      console.log(`💡 Solution: Consolidated duplicate registrations into single record`);
      
      console.log('\n🎯 NEXT STEPS:');
      console.log('─────────────────────────────────────────────────────────────');
      console.log('1. ✅ Error payment marked as resolved');
      console.log('2. ✅ Registration consolidation completed manually');
      console.log('3. 🔄 Run sync again to verify error clears');
      console.log('4. 📊 Check that both tickets appear in primary registration');
      
    } else {
      console.log('❌ Failed to update error payment');
    }
    
  } catch (error) {
    console.error('❌ Error resolving payment:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\nMongoDB connection closed');
  }
}

// Import ObjectId
import { ObjectId } from 'mongodb';

// Run the resolution
if (require.main === module) {
  resolveMarkWhiteheadError()
    .then(() => {
      console.log('\n✅ Mark Whitehead error resolution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Resolution failed:', error);
      process.exit(1);
    });
}

export { resolveMarkWhiteheadError };