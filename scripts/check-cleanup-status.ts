import { MongoClient } from 'mongodb';

async function checkCleanupStatus() {
  const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const importPaymentsCollection = db.collection('import_payments');
    const errorPaymentsCollection = db.collection('error_payments');

    // Check for payments marked as duplicate
    const duplicatePayments = await importPaymentsCollection.find({
      $or: [
        { isDuplicate: true },
        { registrationId: 'duplicate' },
        { duplicateReason: { $exists: true } }
      ]
    }).toArray();

    console.log(`\nPayments marked as duplicate: ${duplicatePayments.length}`);
    
    if (duplicatePayments.length > 0) {
      console.log('\nDuplicate payments found:');
      duplicatePayments.forEach((payment, index) => {
        console.log(`${index + 1}. Payment ID: ${payment.paymentId || payment.payment?.id || 'N/A'}`);
        console.log(`   isDuplicate: ${payment.isDuplicate || false}`);
        console.log(`   registrationId: ${payment.registrationId || 'N/A'}`);
        console.log(`   duplicateReason: ${payment.duplicateReason || payment.duplicateNotes || 'N/A'}`);
        console.log(`   resolvedByScript: ${payment.resolvedByScript || 'N/A'}`);
        console.log('');
      });
    }

    // Check current error payments count
    const errorCount = await errorPaymentsCollection.countDocuments();
    console.log(`Current error_payments count: ${errorCount}`);

    // Check for any Lodge-related references in import_payments
    const lodgePayments = await importPaymentsCollection.find({
      $or: [
        { 'payment.metadata.lodge_name': { $exists: true } },
        { duplicateReason: /lodge/i },
        { 'originalData.note': /lodge/i }
      ]
    }).toArray();

    console.log(`\nLodge-related payments in import_payments: ${lodgePayments.length}`);

    if (lodgePayments.length > 0) {
      console.log('\nLodge payments details:');
      lodgePayments.slice(0, 5).forEach((payment, index) => {
        console.log(`${index + 1}. Payment ID: ${payment.paymentId || payment.payment?.id || 'N/A'}`);
        console.log(`   Lodge: ${payment.payment?.metadata?.lodge_name || 'N/A'}`);
        console.log(`   isDuplicate: ${payment.isDuplicate || false}`);
        console.log(`   registrationId: ${payment.registrationId || 'N/A'}`);
        console.log('');
      });
    }

    // Check for any resolvedByScript references
    const resolvedPayments = await importPaymentsCollection.find({
      resolvedByScript: { $exists: true }
    }).toArray();

    console.log(`\nPayments resolved by scripts: ${resolvedPayments.length}`);
    
    if (resolvedPayments.length > 0) {
      const scriptCounts = resolvedPayments.reduce((acc, payment) => {
        const script = payment.resolvedByScript;
        acc[script] = (acc[script] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('\nResolution scripts used:');
      Object.entries(scriptCounts).forEach(([script, count]) => {
        console.log(`- ${script}: ${count} payments`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

checkCleanupStatus().catch(console.error);