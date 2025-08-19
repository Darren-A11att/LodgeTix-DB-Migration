import { MongoClient } from 'mongodb';

async function verifyCurrentErrorPayments() {
  const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const errorPaymentsCollection = db.collection('error_payments');

    // Get total count
    const totalCount = await errorPaymentsCollection.countDocuments();
    console.log(`\nTotal error_payments count: ${totalCount}`);

    // Check for any Lodge-related payments
    const lodgePayments = await errorPaymentsCollection.find({
      $or: [
        { 'payment.metadata.lodge_name': { $exists: true } },
        { 'payment.metadata.registrant_email': /jerusalem|markowen|lodge/i }
      ]
    }).toArray();

    console.log(`\nLodge-related error payments found: ${lodgePayments.length}`);
    
    if (lodgePayments.length > 0) {
      console.log('\nLodge payments in error_payments:');
      lodgePayments.forEach(payment => {
        console.log(`- ID: ${payment.payment.id}`);
        console.log(`  Lodge: ${payment.payment.metadata?.lodge_name || 'N/A'}`);
        console.log(`  Email: ${payment.payment.metadata?.registrant_email || 'N/A'}`);
        console.log(`  Amount: ${payment.payment.amount_received || 'N/A'}`);
        console.log('');
      });
    }

    // Sample a few error payments to see what's there
    const samplePayments = await errorPaymentsCollection.find({}).limit(5).toArray();
    console.log('\nSample error payments (first 5):');
    samplePayments.forEach(payment => {
      console.log(`- ID: ${payment.payment.id}`);
      console.log(`  Email: ${payment.payment.metadata?.registrant_email || 'N/A'}`);
      console.log(`  Amount: ${payment.payment.amount_received || 'N/A'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

verifyCurrentErrorPayments().catch(console.error);