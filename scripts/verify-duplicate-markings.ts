import { MongoClient } from 'mongodb';

// The 12 error payment IDs that should be marked as duplicates
const LODGE_PAYMENT_IDS = [
  '3ZJ3HBSr4UdPafNCaBainy55wc7YY',
  'lqOt4jZnIiTTlE97PDYCV3tShsPZY',
  'ZggJj2u2p8iwhRWOajCzg0zZ2YEZY',
  'XbYcqGOlLYy34w8GRh6oDKYqSKKZY',
  'xSlYUjRPlvBqdFASpTgzxyAq1RHZY',
  'jXbMStnAmtjde3RrcJyeFi1fUuRZY',
  'XZvsmRdAo7cOcbytf8tXyQopLI6YY',
  'zVoh8VCpVfGVFHDPCb6tQiG9uJ8YY',
  'jjZo8QIRaYRVHjWEF6kGT2A8SqYZY',
  'xECGubABWxwHhK8cYuzZJdzEfONZY',
  '7NcA5XmQQnii5C4wyZ49VRv4O6bZY',
  'NkToF5EmmRnVVpX6UAqwfq6nBLNZY'
];

async function verifyDuplicateMarkings() {
  const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const importPaymentsCollection = db.collection('import_payments');

    console.log(`\nChecking ${LODGE_PAYMENT_IDS.length} payment IDs in import_payments...\n`);

    let foundCount = 0;
    let duplicateCount = 0;

    for (const paymentId of LODGE_PAYMENT_IDS) {
      const payment = await importPaymentsCollection.findOne({
        'payment.id': paymentId
      });

      if (payment) {
        foundCount++;
        console.log(`✓ Found payment ${paymentId}`);
        console.log(`  Registration ID: ${payment.registrationId || 'N/A'}`);
        console.log(`  Duplicate Notes: ${payment.duplicateNotes || 'N/A'}`);
        console.log(`  Email: ${payment.payment?.metadata?.registrant_email || 'N/A'}`);
        
        if (payment.registrationId === 'duplicate') {
          duplicateCount++;
          console.log(`  ✓ Already marked as duplicate`);
        }
        console.log('');
      } else {
        console.log(`⚠ Payment ${paymentId} not found in import_payments`);
      }
    }

    console.log('\n=== VERIFICATION SUMMARY ===');
    console.log(`Payments found in import_payments: ${foundCount}`);
    console.log(`Payments marked as duplicate: ${duplicateCount}`);
    console.log(`Payments not found: ${LODGE_PAYMENT_IDS.length - foundCount}`);

    // Also check for any payments marked as duplicate
    const allDuplicates = await importPaymentsCollection.find({
      registrationId: 'duplicate'
    }).toArray();

    console.log(`\nTotal payments marked as duplicate: ${allDuplicates.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

verifyDuplicateMarkings().catch(console.error);