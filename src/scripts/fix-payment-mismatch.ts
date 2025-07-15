import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB || 'lodgetix';

async function fixPaymentMismatch() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const paymentsCollection = db.collection('payments');
    const registrationsCollection = db.collection('registrations');

    // The payment that's incorrectly matched
    const paymentId = '685c0b9df861ce10c31247a5';
    const squarePaymentId = 'lwB7XvUF0aLc2thAcupnDtqC4hTZY';
    const incorrectRegistrationId = '685beba0b2fa6b693adabc45';
    const correctRegistrationId = '685beba0b2fa6b693adabc6d';

    console.log('\n=== FIXING PAYMENT MISMATCH ===');
    console.log(`Payment: ${paymentId}`);
    console.log(`Square Payment ID: ${squarePaymentId}`);
    console.log(`Incorrect Registration: ${incorrectRegistrationId}`);
    console.log(`Correct Registration: ${correctRegistrationId}`);

    // First, verify the correct registration exists and has the Square payment ID
    const correctRegistration = await registrationsCollection.findOne({ 
      _id: new ObjectId(correctRegistrationId) 
    });

    if (!correctRegistration) {
      console.error(`\nCorrect registration ${correctRegistrationId} not found!`);
      return;
    }

    if (correctRegistration.squarePaymentId !== squarePaymentId) {
      console.error(`\nCorrect registration does not have the expected Square payment ID!`);
      console.error(`Expected: ${squarePaymentId}`);
      console.error(`Found: ${correctRegistration.squarePaymentId}`);
      return;
    }

    console.log('\n✓ Verified correct registration has the Square payment ID');

    // Update the payment record to point to the correct registration
    const updateResult = await paymentsCollection.updateOne(
      { _id: new ObjectId(paymentId) },
      {
        $set: {
          matchedRegistrationId: correctRegistrationId,
          matchCorrectedAt: new Date(),
          matchCorrectionReason: 'Fixed incorrect match - payment was matched to Stripe registration instead of Square registration'
        }
      }
    );

    if (updateResult.modifiedCount === 1) {
      console.log('\n✓ Successfully updated payment to match correct registration');
    } else {
      console.error('\n✗ Failed to update payment');
      console.error('Update result:', updateResult);
    }

    // Verify the fix
    const updatedPayment = await paymentsCollection.findOne({ 
      _id: new ObjectId(paymentId) 
    });

    console.log('\n=== VERIFICATION ===');
    console.log(`Payment ${paymentId} is now matched to: ${updatedPayment?.matchedRegistrationId}`);
    console.log(`Match corrected at: ${updatedPayment?.matchCorrectedAt}`);

  } catch (error) {
    console.error('Error fixing payment mismatch:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the fix
fixPaymentMismatch().catch(console.error);