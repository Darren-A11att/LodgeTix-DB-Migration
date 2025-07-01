// MongoDB Index Verification Script
// This script verifies that all required indexes are properly created and provides statistics

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'lodgetix';

async function verifyIndexes() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    
    // Verify registration collection indexes
    console.log('\n=== Registration Collection Index Verification ===');
    const registrationCollection = db.collection('registrations');
    const regIndexes = await registrationCollection.listIndexes().toArray();
    
    console.log(`Total indexes: ${regIndexes.length}`);
    console.log('\nIndex Details:');
    
    for (const index of regIndexes) {
      console.log(`\n${index.name}:`);
      console.log(`  Fields: ${JSON.stringify(index.key)}`);
      console.log(`  Unique: ${index.unique || false}`);
      
      // Get index stats if available
      try {
        const stats = await registrationCollection.aggregate([
          { $indexStats: { } },
          { $match: { name: index.name } }
        ]).toArray();
        
        if (stats.length > 0) {
          console.log(`  Usage: ${stats[0].accesses.ops} operations`);
          console.log(`  Since: ${stats[0].accesses.since}`);
        }
      } catch (e) {
        // Index stats might not be available in all MongoDB versions
      }
    }
    
    // Verify payments collection indexes
    console.log('\n=== Payments Collection Index Verification ===');
    const paymentsCollection = db.collection('payments');
    const payIndexes = await paymentsCollection.listIndexes().toArray();
    
    console.log(`Total indexes: ${payIndexes.length}`);
    console.log('\nIndex Details:');
    
    for (const index of payIndexes) {
      console.log(`\n${index.name}:`);
      console.log(`  Fields: ${JSON.stringify(index.key)}`);
      console.log(`  Unique: ${index.unique || false}`);
      
      try {
        const stats = await paymentsCollection.aggregate([
          { $indexStats: { } },
          { $match: { name: index.name } }
        ]).toArray();
        
        if (stats.length > 0) {
          console.log(`  Usage: ${stats[0].accesses.ops} operations`);
          console.log(`  Since: ${stats[0].accesses.since}`);
        }
      } catch (e) {
        // Index stats might not be available
      }
    }
    
    // Check for missing recommended indexes
    console.log('\n=== Index Coverage Analysis ===');
    
    const requiredRegFields = [
      'stripePaymentIntentId', 'customerId', 'primaryEmail', 'primaryPhone',
      'lodge_id', 'lodgeNameNumber', 'grand_lodge_id', 'registrationId',
      'confirmationNumber', 'primaryAttendee', 'lodgeOrganisationId',
      'grandLodgeOrganisationId', 'createdAt', 'addressLine1',
      'totalAmountPaid', 'totalPricePaid'
    ];
    
    const requiredPayFields = [
      'id', 'PaymentIntent ID', 'Card Name', 'Card Address Line1',
      'Customer Email', 'metadata.sessionId', 'metadata.registrationId',
      'metadata.organisationId', 'paymentId', 'metadata.subtotal',
      'grossAmount', 'feeAmount'
    ];
    
    // Check registration indexes
    console.log('\nRegistration Collection Coverage:');
    const regIndexedFields = new Set();
    regIndexes.forEach(idx => {
      Object.keys(idx.key).forEach(field => regIndexedFields.add(field));
    });
    
    requiredRegFields.forEach(field => {
      const isIndexed = regIndexedFields.has(field);
      console.log(`  ${field}: ${isIndexed ? '✓' : '✗'}`);
    });
    
    // Check payment indexes
    console.log('\nPayments Collection Coverage:');
    const payIndexedFields = new Set();
    payIndexes.forEach(idx => {
      Object.keys(idx.key).forEach(field => payIndexedFields.add(field));
    });
    
    requiredPayFields.forEach(field => {
      const isIndexed = payIndexedFields.has(field);
      console.log(`  ${field}: ${isIndexed ? '✓' : '✗'}`);
    });
    
    console.log('\n✓ Index verification completed!');
    
  } catch (error) {
    console.error('Error verifying indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Execute the script
if (require.main === module) {
  verifyIndexes().catch(console.error);
}

module.exports = { verifyIndexes };