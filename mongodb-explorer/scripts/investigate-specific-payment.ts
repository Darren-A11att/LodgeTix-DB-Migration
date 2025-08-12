import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const MONGODB_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';
const DATABASE_NAME = 'LodgeTix-migration-test-1';

async function main() {
  const mongoClient = new MongoClient(MONGODB_URI);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(DATABASE_NAME);
    
    const paymentId = 'pi_3RYJFqKBASow5NsW1FnwbG6O';
    
    console.log('='.repeat(80));
    console.log(`🔍 DETAILED INVESTIGATION: ${paymentId}`);
    console.log('='.repeat(80));
    
    // Search in multiple ways
    const queries = [
      { paymentIntentId: paymentId },
      { paymentId: paymentId },
      { stripe_payment_intent_id: paymentId },
      { 'originalData.id': paymentId }
    ];
    
    let payment = null;
    for (const query of queries) {
      payment = await db.collection('payments').findOne(query);
      if (payment) {
        console.log(`\n✅ Found payment with query: ${JSON.stringify(query)}`);
        break;
      }
    }
    
    if (!payment) {
      console.log('❌ Payment not found in MongoDB');
      return;
    }
    
    console.log('\n📋 PAYMENT DETAILS:');
    console.log(`  MongoDB _id: ${payment._id}`);
    console.log(`  Payment ID: ${payment.paymentId || payment.paymentIntentId}`);
    console.log(`  Amount: ${payment.amount} ${payment.currency || 'AUD'}`);
    console.log(`  Gross Amount: ${payment.grossAmount}`);
    console.log(`  Status: ${payment.status}`);
    console.log(`  Created: ${payment.timestamp || payment.created}`);
    
    // Check for card details in various locations
    console.log('\n💳 CARD DETAILS:');
    console.log(`  Card Brand: ${payment.cardBrand || 'N/A'}`);
    console.log(`  Card Last4: ${payment.cardLast4 || 'N/A'}`);
    
    // Check originalData structure
    if (payment.originalData) {
      const chargeData = payment.originalData;
      console.log(`  From Original Data:`);
      console.log(`    - Card type: ${chargeData['Card type'] || 'N/A'}`);
      console.log(`    - Card: ${chargeData['Card'] || 'N/A'}`);
      
      // Check if card ends in 8251
      const cardInfo = chargeData['Card'] || '';
      if (cardInfo.includes('8251')) {
        console.log(`    ✅ TEST CARD: Contains 8251`);
      }
    }
    
    // Check email fields
    console.log('\n📧 EMAIL INFORMATION:');
    console.log(`  Customer Email: ${payment.customerEmail || 'N/A'}`);
    console.log(`  Customer Name: ${payment.customerName || 'N/A'}`);
    
    if (payment.originalData) {
      console.log(`  From Original Data:`);
      console.log(`    - Customer: ${payment.originalData['Customer'] || 'N/A'}`);
      console.log(`    - Customer email: ${payment.originalData['Customer email'] || 'N/A'}`);
      console.log(`    - Customer description: ${payment.originalData['Customer description'] || 'N/A'}`);
    }
    
    // Check if test payment
    const hasTestCard = payment.cardLast4 === '8251' || 
                       (payment.originalData?.['Card'] && payment.originalData['Card'].includes('8251'));
    const hasTestEmail = payment.customerEmail?.includes('@allatt.me') || 
                        payment.originalData?.['Customer email']?.includes('@allatt.me');
    
    console.log('\n🧪 TEST PAYMENT ANALYSIS:');
    console.log(`  Has card ending in 8251: ${hasTestCard ? '✅ YES' : '❌ NO'}`);
    console.log(`  Has @allatt.me email: ${hasTestEmail ? '✅ YES' : '❌ NO'}`);
    console.log(`  Is Test Payment: ${hasTestCard && hasTestEmail ? '✅ YES - RESOLVED' : '❌ NO'}`);
    
    // Check registration information
    console.log('\n🔗 REGISTRATION INFORMATION:');
    console.log(`  Linked Registration ID: ${payment.linkedRegistrationId || 'N/A'}`);
    console.log(`  Matched Registration ID: ${payment.matchedRegistrationId || 'N/A'}`);
    
    // Event information
    console.log('\n🎫 EVENT INFORMATION:');
    console.log(`  Event Type: ${payment.eventType || 'N/A'}`);
    console.log(`  Event Description: ${payment.eventDescription || 'N/A'}`);
    console.log(`  Function Name: ${payment.functionName || 'N/A'}`);
    console.log(`  Lodge Name: ${payment.lodgeName || 'N/A'}`);
    console.log(`  Organisation: ${payment.organisation || 'N/A'}`);
    console.log(`  Total Attendees: ${payment.totalAttendees || 'N/A'}`);
    
    // Check if we found a registration ID
    const registrationId = payment.linkedRegistrationId || payment.matchedRegistrationId;
    if (registrationId) {
      console.log(`\n🔍 Looking up registration: ${registrationId}`);
      
      // Check if it's an ObjectId
      if (registrationId.match(/^[a-f0-9]{24}$/i)) {
        console.log('  Type: MongoDB ObjectId');
        
        // Look for it in MongoDB registrations
        try {
          const mongoReg = await db.collection('registrations').findOne({ 
            _id: new ObjectId(registrationId) 
          });
          
          if (mongoReg) {
            console.log('  ✅ Found in MongoDB registrations collection');
            console.log(`    Registration ID: ${mongoReg.registration_id || mongoReg.registrationId || 'N/A'}`);
          } else {
            console.log('  ❌ Not found in MongoDB registrations collection');
          }
        } catch (error) {
          console.log(`  ❌ Error looking up registration: ${error}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('CONCLUSION:');
    if (hasTestCard && hasTestEmail) {
      console.log('✅ This is a TEST PAYMENT - Can be marked as RESOLVED');
    } else {
      console.log('⚠️  This appears to be a real payment that needs investigation');
    }
    console.log('='.repeat(80));
    
  } finally {
    await mongoClient.close();
  }
}

main().catch(console.error);