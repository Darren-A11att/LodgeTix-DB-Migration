import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB || 'lodgetix';

interface PaymentRecord {
  _id: ObjectId;
  paymentId: string;
  matchedRegistrationId?: string;
  [key: string]: any;
}

interface RegistrationRecord {
  _id: ObjectId;
  stripePaymentIntentId?: string;
  squarePaymentId?: string;
  [key: string]: any;
}

async function investigatePaymentMatching() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const paymentsCollection = db.collection<PaymentRecord>('payments');
    const registrationsCollection = db.collection<RegistrationRecord>('registrations');

    // 1. Get the specific payment record
    console.log('\n=== INVESTIGATING PAYMENT ===');
    const paymentId = '685c0b9df861ce10c31247a5';
    const squarePaymentId = 'lwB7XvUF0aLc2thAcupnDtqC4hTZY';
    
    const payment = await paymentsCollection.findOne({ _id: new ObjectId(paymentId) });
    if (payment) {
      console.log(`\nPayment found:`);
      console.log(`- _id: ${payment._id}`);
      console.log(`- paymentId: ${payment.paymentId}`);
      console.log(`- matchedRegistrationId: ${payment.matchedRegistrationId || 'NOT SET'}`);
      console.log(`- Other relevant fields:`, JSON.stringify(payment, null, 2));
    } else {
      console.log(`Payment with _id ${paymentId} not found`);
    }

    // 2. Check if any registration has the Square payment ID
    console.log('\n=== SEARCHING FOR REGISTRATIONS WITH SQUARE PAYMENT ID ===');
    const registrationsWithSquareId = await registrationsCollection.find({
      $or: [
        { squarePaymentId: squarePaymentId },
        { paymentId: squarePaymentId },
        { 'payment.id': squarePaymentId },
        { 'payment.paymentId': squarePaymentId },
        { 'squarePayment.id': squarePaymentId },
        { 'squarePayment.paymentId': squarePaymentId }
      ]
    }).toArray();

    if (registrationsWithSquareId.length > 0) {
      console.log(`\nFound ${registrationsWithSquareId.length} registration(s) with Square payment ID ${squarePaymentId}:`);
      registrationsWithSquareId.forEach(reg => {
        console.log(`\n- Registration _id: ${reg._id}`);
        console.log(`  - squarePaymentId: ${reg.squarePaymentId || 'null'}`);
        console.log(`  - stripePaymentIntentId: ${reg.stripePaymentIntentId || 'null'}`);
        console.log(`  - Other payment fields:`, JSON.stringify({
          paymentId: reg.paymentId,
          payment: reg.payment,
          squarePayment: reg.squarePayment
        }, null, 2));
      });
    } else {
      console.log(`No registrations found with Square payment ID ${squarePaymentId}`);
    }

    // 3. Check the specific registration that's being matched
    console.log('\n=== CHECKING MATCHED REGISTRATION ===');
    const matchedRegId = '685beba0b2fa6b693adabc45';
    const matchedReg = await registrationsCollection.findOne({ _id: new ObjectId(matchedRegId) });
    
    if (matchedReg) {
      console.log(`\nMatched registration details:`);
      console.log(`- _id: ${matchedReg._id}`);
      console.log(`- stripePaymentIntentId: ${matchedReg.stripePaymentIntentId || 'null'}`);
      console.log(`- squarePaymentId: ${matchedReg.squarePaymentId || 'null'}`);
      console.log(`- Other payment fields:`, JSON.stringify({
        paymentId: matchedReg.paymentId,
        payment: matchedReg.payment,
        squarePayment: matchedReg.squarePayment
      }, null, 2));
    } else {
      console.log(`Registration ${matchedRegId} not found`);
    }

    // 4. Look for similar registration IDs (potential duplicates)
    console.log('\n=== SEARCHING FOR SIMILAR REGISTRATION IDS ===');
    // Extract the base part of the ID to search for similar ones
    const baseId = matchedRegId.substring(0, matchedRegId.length - 2); // Remove last 2 chars
    
    // Search by converting to string and comparing
    const allRegistrations = await registrationsCollection.find({}).limit(10000).toArray();
    const similarByString = allRegistrations.filter(reg => {
      const idStr = reg._id.toString();
      return idStr.startsWith(baseId) && idStr !== matchedRegId;
    });

    if (similarByString.length > 0) {
      console.log(`\nFound ${similarByString.length} registration(s) with similar IDs:`);
      similarByString.forEach(reg => {
        console.log(`\n- Registration _id: ${reg._id}`);
        console.log(`  - stripePaymentIntentId: ${reg.stripePaymentIntentId || 'null'}`);
        console.log(`  - squarePaymentId: ${reg.squarePaymentId || 'null'}`);
        console.log(`  - Created: ${reg.createdAt || 'unknown'}`);
        console.log(`  - Updated: ${reg.updatedAt || 'unknown'}`);
      });
    } else {
      console.log('No registrations with similar IDs found');
    }

    // 5. Check for any registrations with the Stripe payment intent ID from the matched registration
    if (matchedReg?.stripePaymentIntentId) {
      console.log('\n=== CHECKING FOR DUPLICATE STRIPE PAYMENT INTENT IDS ===');
      const duplicateStripeRegs = await registrationsCollection.find({
        stripePaymentIntentId: matchedReg.stripePaymentIntentId,
        _id: { $ne: new ObjectId(matchedRegId) }
      }).toArray();

      if (duplicateStripeRegs.length > 0) {
        console.log(`\nFound ${duplicateStripeRegs.length} other registration(s) with same Stripe payment intent ID:`);
        duplicateStripeRegs.forEach(reg => {
          console.log(`- Registration _id: ${reg._id}`);
        });
      } else {
        console.log('No duplicate Stripe payment intent IDs found');
      }
    }

    // 6. Search for the Square payment ID in specific fields
    console.log('\n=== SEARCHING FOR SQUARE PAYMENT ID IN ADDITIONAL FIELDS ===');
    const fieldSearch = await registrationsCollection.find({
      $or: [
        { 'metadata.paymentId': squarePaymentId },
        { 'metadata.squarePaymentId': squarePaymentId },
        { 'paymentInfo.id': squarePaymentId },
        { 'paymentInfo.paymentId': squarePaymentId },
        { 'paymentDetails.id': squarePaymentId },
        { 'paymentDetails.paymentId': squarePaymentId },
        { 'payment.paymentId': squarePaymentId },
        { 'payment.id': squarePaymentId },
        { paymentId: squarePaymentId }
      ]
    }).toArray();

    if (fieldSearch.length > 0) {
      console.log(`\nFound ${fieldSearch.length} registration(s) with Square payment ID in additional fields:`);
      fieldSearch.forEach(reg => {
        console.log(`\n- Registration _id: ${reg._id}`);
        console.log(`  - Relevant fields:`, JSON.stringify({
          metadata: reg.metadata,
          paymentInfo: reg.paymentInfo,
          paymentDetails: reg.paymentDetails,
          payment: reg.payment,
          paymentId: reg.paymentId
        }, null, 2));
      });
    } else {
      console.log('No registrations found containing the Square payment ID in any additional fields');
    }

    // 7. Summary and recommendations
    console.log('\n=== SUMMARY ===');
    console.log(`1. Payment ${paymentId} with Square ID ${squarePaymentId} is being matched to registration ${matchedRegId}`);
    console.log(`2. The matched registration has Stripe payment intent ID but no Square payment ID`);
    console.log(`3. No registrations found with the Square payment ID ${squarePaymentId}`);
    console.log(`4. This appears to be a mismatched payment - the Square payment should not be matched to a Stripe-based registration`);

  } catch (error) {
    console.error('Error during investigation:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the investigation
investigatePaymentMatching().catch(console.error);