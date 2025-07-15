const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function investigateFalseMatch() {
  const client = new MongoClient(process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017/lodgetix');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    
    // Find the payment
    const paymentId = '685c0b9df861ce10c31247a5';
    const squarePaymentId = 'lwB7XvUF0aLc2thAcupnDtqC4hTZY';
    const registrationId = '685beba0b2fa6b693adabc45';
    
    console.log('\n=== PAYMENT DETAILS ===');
    const payment = await db.collection('payments').findOne({ _id: new ObjectId(paymentId) });
    if (payment) {
      console.log('Payment found:');
      console.log('- _id:', payment._id);
      console.log('- paymentId:', payment.paymentId);
      console.log('- transactionId:', payment.transactionId);
      console.log('- Payment ID:', payment['Payment ID']);
      console.log('- PaymentIntent ID:', payment['PaymentIntent ID']);
      console.log('- matchedRegistrationId:', payment.matchedRegistrationId);
      console.log('- linkedRegistrationId:', payment.linkedRegistrationId);
      console.log('- matchMethod:', payment.matchMethod);
      console.log('- confirmationNumber:', payment.confirmationNumber);
      console.log('- originalData:', JSON.stringify(payment.originalData, null, 2));
    } else {
      console.log('Payment not found with _id:', paymentId);
    }
    
    console.log('\n=== REGISTRATION DETAILS ===');
    const registration = await db.collection('registrations').findOne({ _id: new ObjectId(registrationId) });
    if (registration) {
      console.log('Registration found:');
      console.log('- _id:', registration._id);
      console.log('- registrationId:', registration.registrationId);
      console.log('- stripePaymentIntentId:', registration.stripePaymentIntentId);
      console.log('- stripe_payment_intent_id:', registration.stripe_payment_intent_id);
      console.log('- squarePaymentId:', registration.squarePaymentId);
      console.log('- square_payment_id:', registration.square_payment_id);
      console.log('- confirmationNumber:', registration.confirmationNumber);
      console.log('- paymentInfo:', JSON.stringify(registration.paymentInfo, null, 2));
      console.log('- paymentData:', JSON.stringify(registration.paymentData, null, 2));
      console.log('- registrationData.stripePaymentIntentId:', registration.registrationData?.stripePaymentIntentId);
      console.log('- registrationData.squarePaymentId:', registration.registrationData?.squarePaymentId);
    } else {
      console.log('Registration not found with _id:', registrationId);
    }
    
    // Search for any registrations with the Square payment ID
    console.log('\n=== SEARCHING FOR REGISTRATIONS WITH SQUARE PAYMENT ID ===');
    const registrationsWithSquareId = await db.collection('registrations').find({
      $or: [
        { squarePaymentId: squarePaymentId },
        { square_payment_id: squarePaymentId },
        { 'paymentInfo.square_payment_id': squarePaymentId },
        { 'paymentData.paymentId': squarePaymentId },
        { 'registrationData.squarePaymentId': squarePaymentId },
        { 'registrationData.square_payment_id': squarePaymentId }
      ]
    }).toArray();
    
    console.log(`Found ${registrationsWithSquareId.length} registrations with Square payment ID ${squarePaymentId}`);
    registrationsWithSquareId.forEach(reg => {
      console.log('- Registration _id:', reg._id);
      console.log('  Type:', reg.registrationType);
      console.log('  Lodge:', reg.lodgeName);
    });
    
    // Check if the registration has any payment IDs that match our Square payment ID
    console.log('\n=== CHECKING FOR FALSE MATCH ===');
    if (registration) {
      const allPaymentIds = [
        registration.stripePaymentIntentId,
        registration.stripe_payment_intent_id,
        registration.squarePaymentId,
        registration.square_payment_id,
        registration.paymentInfo?.stripe_payment_intent_id,
        registration.paymentInfo?.square_payment_id,
        registration.paymentData?.transactionId,
        registration.paymentData?.paymentId,
        registration.registrationData?.stripePaymentIntentId,
        registration.registrationData?.stripe_payment_intent_id,
        registration.registrationData?.squarePaymentId,
        registration.registrationData?.square_payment_id
      ].filter(id => id);
      
      console.log('All payment IDs in registration:', allPaymentIds);
      console.log('Does any match Square payment ID?', allPaymentIds.includes(squarePaymentId));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

investigateFalseMatch().catch(console.error);