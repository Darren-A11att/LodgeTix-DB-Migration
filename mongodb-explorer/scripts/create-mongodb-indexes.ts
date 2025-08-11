// @ts-nocheck
// MongoDB Index Creation Script for LodgeTix Reconciliation
// This script creates indexes for optimized querying of registration and payment collections

const { MongoClient } = require('mongodb');

// Load environment variables
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

// MongoDB connection configuration
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.DATABASE_NAME || 'lodgetix';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

// Index definitions for registration collection
const REGISTRATION_INDEXES = [
  // Single field indexes for direct lookups
  { key: { stripePaymentIntentId: 1 }, name: 'idx_stripePaymentIntentId' },
  { key: { customerId: 1 }, name: 'idx_customerId' },
  { key: { primaryEmail: 1 }, name: 'idx_primaryEmail' },
  { key: { primaryPhone: 1 }, name: 'idx_primaryPhone' },
  { key: { lodge_id: 1 }, name: 'idx_lodge_id' },
  { key: { lodgeNameNumber: 1 }, name: 'idx_lodgeNameNumber' },
  { key: { grand_lodge_id: 1 }, name: 'idx_grand_lodge_id' },
  { key: { registrationId: 1 }, name: 'idx_registrationId', unique: true },
  { key: { confirmationNumber: 1 }, name: 'idx_confirmationNumber', unique: true },
  { key: { primaryAttendee: 1 }, name: 'idx_primaryAttendee' },
  { key: { lodgeOrganisationId: 1 }, name: 'idx_lodgeOrganisationId' },
  { key: { grandLodgeOrganisationId: 1 }, name: 'idx_grandLodgeOrganisationId' },
  { key: { createdAt: -1 }, name: 'idx_createdAt' }, // Descending for recent first
  { key: { addressLine1: 1 }, name: 'idx_addressLine1' },
  { key: { 'totalAmountPaid': 1 }, name: 'idx_totalAmountPaid' },
  { key: { 'totalPricePaid': 1 }, name: 'idx_totalPricePaid' },
  
  // Compound indexes for common query patterns
  { key: { lodge_id: 1, createdAt: -1 }, name: 'idx_lodge_createdAt' },
  { key: { grand_lodge_id: 1, createdAt: -1 }, name: 'idx_grand_lodge_createdAt' },
  { key: { primaryEmail: 1, createdAt: -1 }, name: 'idx_email_createdAt' },
  { key: { stripePaymentIntentId: 1, registrationId: 1 }, name: 'idx_payment_registration' },
  { key: { lodgeOrganisationId: 1, grandLodgeOrganisationId: 1, createdAt: -1 }, name: 'idx_org_hierarchy_date' }
];

// Index definitions for payments collection
const PAYMENTS_INDEXES = [
  // Single field indexes
  { key: { id: 1 }, name: 'idx_charge_id', unique: true },
  { key: { 'PaymentIntent ID': 1 }, name: 'idx_payment_intent_id' },
  { key: { 'Card Name': 1 }, name: 'idx_card_name' },
  { key: { 'Card Address Line1': 1 }, name: 'idx_card_address' },
  { key: { 'Customer Email': 1 }, name: 'idx_customer_email' },
  { key: { 'metadata.sessionId': 1 }, name: 'idx_metadata_sessionId' },
  { key: { 'metadata.registrationId': 1 }, name: 'idx_metadata_registrationId' },
  { key: { 'metadata.organisationId': 1 }, name: 'idx_metadata_organisationId' },
  { key: { paymentId: 1 }, name: 'idx_paymentId' },
  { key: { 'metadata.subtotal': 1 }, name: 'idx_metadata_subtotal' },
  { key: { grossAmount: 1 }, name: 'idx_grossAmount' },
  { key: { feeAmount: 1 }, name: 'idx_feeAmount' },
  
  // Compound indexes for payment queries
  { key: { 'Customer Email': 1, 'metadata.registrationId': 1 }, name: 'idx_email_registration' },
  { key: { 'metadata.organisationId': 1, grossAmount: -1 }, name: 'idx_org_amount' },
  { key: { 'PaymentIntent ID': 1, 'metadata.registrationId': 1 }, name: 'idx_intent_registration' },
  { key: { 'metadata.registrationId': 1, grossAmount: 1 }, name: 'idx_registration_amount' }
];

async function createIndexes() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    
    // Create indexes for registration collection
    console.log('\n=== Creating Registration Collection Indexes ===');
    const registrationCollection = db.collection('registrations');
    
    for (const index of REGISTRATION_INDEXES) {
      try {
        const result = await registrationCollection.createIndex(index.key, { 
          name: index.name,
          unique: index.unique || false,
          background: true // Create indexes in background to avoid blocking
        });
        console.log(`✓ Created index: ${index.name}`);
      } catch (error) {
        if (error.code === 85) { // Index already exists with different options
          console.log(`⚠ Index ${index.name} already exists with different options. Dropping and recreating...`);
          try {
            await registrationCollection.dropIndex(index.name);
            await registrationCollection.createIndex(index.key, { 
              name: index.name,
              unique: index.unique || false,
              background: true
            });
            console.log(`✓ Recreated index: ${index.name}`);
          } catch (dropError) {
            // If drop fails, try creating anyway
            console.log(`⚠ Could not drop index ${index.name}, attempting to create anyway...`);
            try {
              await registrationCollection.createIndex(index.key, { 
                name: index.name,
                unique: index.unique || false,
                background: true
              });
              console.log(`✓ Created index: ${index.name}`);
            } catch (createError) {
              console.error(`✗ Failed to create index ${index.name}:`, createError.message);
            }
          }
        } else if (error.code === 86) { // Index already exists
          console.log(`✓ Index ${index.name} already exists`);
        } else {
          console.error(`✗ Failed to create index ${index.name}:`, error.message);
        }
      }
    }
    
    // Create indexes for payments collection
    console.log('\n=== Creating Payments Collection Indexes ===');
    const paymentsCollection = db.collection('payments');
    
    for (const index of PAYMENTS_INDEXES) {
      try {
        const result = await paymentsCollection.createIndex(index.key, { 
          name: index.name,
          unique: index.unique || false,
          background: true
        });
        console.log(`✓ Created index: ${index.name}`);
      } catch (error) {
        if (error.code === 85) {
          console.log(`⚠ Index ${index.name} already exists with different options. Dropping and recreating...`);
          try {
            await paymentsCollection.dropIndex(index.name);
            await paymentsCollection.createIndex(index.key, { 
              name: index.name,
              unique: index.unique || false,
              background: true
            });
            console.log(`✓ Recreated index: ${index.name}`);
          } catch (dropError) {
            // If drop fails, try creating anyway
            console.log(`⚠ Could not drop index ${index.name}, attempting to create anyway...`);
            try {
              await paymentsCollection.createIndex(index.key, { 
                name: index.name,
                unique: index.unique || false,
                background: true
              });
              console.log(`✓ Created index: ${index.name}`);
            } catch (createError) {
              console.error(`✗ Failed to create index ${index.name}:`, createError.message);
            }
          }
        } else if (error.code === 86) {
          console.log(`✓ Index ${index.name} already exists`);
        } else {
          console.error(`✗ Failed to create index ${index.name}:`, error.message);
        }
      }
    }
    
    // List all indexes for verification
    console.log('\n=== Index Summary ===');
    
    const regIndexes = await registrationCollection.listIndexes().toArray();
    console.log(`\nRegistration Collection Indexes (${regIndexes.length}):`);
    regIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    const payIndexes = await paymentsCollection.listIndexes().toArray();
    console.log(`\nPayments Collection Indexes (${payIndexes.length}):`);
    payIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    console.log('\n✓ Index creation completed successfully!');
    
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Execute the script
if (require.main === module) {
  createIndexes().catch(console.error);
}

module.exports = { createIndexes, REGISTRATION_INDEXES, PAYMENTS_INDEXES };
