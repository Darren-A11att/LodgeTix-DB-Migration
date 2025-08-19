#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function setupErrorCollections() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('🔧 Setting up error collections...');
    console.log('===================================\n');

    // Define error collections and their indexes
    const errorCollections = [
      {
        name: 'error_payments',
        indexes: [
          { key: { originalId: 1 }, options: { sparse: true } },
          { key: { errorType: 1 } },
          { key: { attemptedAt: -1 } },
          { key: { 'metadata.syncRunId': 1 } },
          { key: { paymentId: 1 }, options: { sparse: true } },
          { key: { squarePaymentId: 1 }, options: { sparse: true } },
          { key: { stripePaymentId: 1 }, options: { sparse: true } }
        ]
      },
      {
        name: 'error_registrations',
        indexes: [
          { key: { originalId: 1 }, options: { sparse: true } },
          { key: { registrationId: 1 }, options: { sparse: true } },
          { key: { errorType: 1 } },
          { key: { attemptedAt: -1 } },
          { key: { paymentId: 1 }, options: { sparse: true } },
          { key: { 'metadata.syncRunId': 1 } }
        ]
      },
      {
        name: 'error_tickets',
        indexes: [
          { key: { originalId: 1 }, options: { sparse: true } },
          { key: { ticketId: 1 }, options: { sparse: true } },
          { key: { errorType: 1 } },
          { key: { attemptedAt: -1 } },
          { key: { registrationId: 1 }, options: { sparse: true } },
          { key: { 'metadata.syncRunId': 1 } }
        ]
      },
      {
        name: 'error_log',
        indexes: [
          { key: { timestamp: -1 } },
          { key: { syncRunId: 1 } },
          { key: { errorLevel: 1 } },
          { key: { entityType: 1, entityId: 1 } },
          { key: { 'resolution.status': 1 } },
          { key: { errorCode: 1 } },
          // Compound index for efficient querying
          { key: { syncRunId: 1, errorLevel: 1, timestamp: -1 } }
        ]
      },
      {
        name: 'error_customers',
        indexes: [
          { key: { originalId: 1 }, options: { sparse: true } },
          { key: { customerId: 1 }, options: { sparse: true } },
          { key: { errorType: 1 } },
          { key: { attemptedAt: -1 } },
          { key: { 'metadata.syncRunId': 1 } }
        ]
      },
      {
        name: 'error_contacts',
        indexes: [
          { key: { originalId: 1 }, options: { sparse: true } },
          { key: { contactId: 1 }, options: { sparse: true } },
          { key: { errorType: 1 } },
          { key: { attemptedAt: -1 } },
          { key: { 'metadata.syncRunId': 1 } }
        ]
      },
      {
        name: 'error_attendees',
        indexes: [
          { key: { originalId: 1 }, options: { sparse: true } },
          { key: { attendeeId: 1 }, options: { sparse: true } },
          { key: { errorType: 1 } },
          { key: { attemptedAt: -1 } },
          { key: { registrationId: 1 }, options: { sparse: true } },
          { key: { 'metadata.syncRunId': 1 } }
        ]
      }
    ];

    // Create collections and indexes
    for (const config of errorCollections) {
      // Create collection if it doesn't exist
      const collections = await db.listCollections({ name: config.name }).toArray();
      if (collections.length === 0) {
        await db.createCollection(config.name);
        console.log(`✅ Created collection: ${config.name}`);
      } else {
        console.log(`📦 Collection exists: ${config.name}`);
      }

      // Create indexes
      const collection = db.collection(config.name);
      
      // Drop existing indexes except _id
      try {
        const existingIndexes = await collection.indexes();
        for (const index of existingIndexes) {
          if (index.name !== '_id_') {
            await collection.dropIndex(index.name);
          }
        }
      } catch (error) {
        console.log(`   Note: Could not drop indexes for ${config.name}`);
      }
      
      // Create new indexes
      for (const index of config.indexes) {
        try {
          await collection.createIndex(index.key, index.options || {});
        } catch (error) {
          console.log(`   Warning: Could not create index on ${Object.keys(index.key).join(',')}: ${error.message}`);
        }
      }
      console.log(`   ✓ Created ${config.indexes.length} indexes for ${config.name}`);
    }

    // Create validation schemas for critical collections
    console.log('\n📋 Setting up validation schemas...');
    
    try {
      await db.command({
        collMod: 'error_payments',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['errorType', 'errorMessage', 'attemptedAt'],
            properties: {
              errorType: {
                enum: ['UNMATCHED', 'INVALID_STATUS', 'PROCESSING_ERROR', 'VALIDATION_ERROR', 'DUPLICATE']
              }
            }
          }
        },
        validationLevel: 'moderate'
      });
      console.log('   ✓ Validation schema set for error_payments');
    } catch (error) {
      console.log('   Note: Could not set validation for error_payments');
    }

    try {
      await db.command({
        collMod: 'error_log',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['timestamp', 'syncRunId', 'errorLevel', 'entityType', 'errorMessage'],
            properties: {
              errorLevel: {
                enum: ['WARNING', 'ERROR', 'CRITICAL', 'INFO']
              },
              entityType: {
                enum: ['payment', 'registration', 'ticket', 'customer', 'contact', 'attendee', 'transaction']
              },
              'resolution.status': {
                enum: ['PENDING', 'RESOLVED', 'IGNORED', 'RETRY']
              }
            }
          }
        },
        validationLevel: 'moderate'
      });
      console.log('   ✓ Validation schema set for error_log');
    } catch (error) {
      console.log('   Note: Could not set validation for error_log');
    }

    // Create initial error log entry
    const errorLog = db.collection('error_log');
    await errorLog.insertOne({
      timestamp: Math.floor(Date.now() / 1000),
      syncRunId: 'setup-' + Date.now(),
      errorLevel: 'INFO',
      entityType: 'transaction',
      entityId: 'system',
      operation: 'setup_error_collections',
      errorMessage: 'Error collections initialized successfully',
      errorCode: 'SETUP_COMPLETE',
      context: {
        source: 'system',
        userId: 'setup-script'
      },
      resolution: {
        status: 'RESOLVED'
      }
    });

    console.log('\n✅ Error collections setup complete!');
    console.log('===================================');
    console.log(`Created ${errorCollections.length} error collections with indexes`);
    console.log('Validation schemas applied');
    console.log('Initial error log entry created\n');

  } catch (error) {
    console.error('❌ Error setting up collections:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run if executed directly
if (require.main === module) {
  setupErrorCollections()
    .then(() => {
      console.log('✅ Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupErrorCollections };