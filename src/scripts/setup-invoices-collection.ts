import { connectMongoDB, disconnectMongoDB } from '../connections/mongodb';
import { Invoice } from '../types/invoice';

async function setupInvoicesCollection() {
  try {
    console.log('Setting up invoices collection...');
    
    const { db } = await connectMongoDB();
    
    // Check if collection exists
    const collections = await db.listCollections({ name: 'invoices' }).toArray();
    
    if (collections.length > 0) {
      console.log('Invoices collection already exists');
      
      // Drop existing indexes (except _id) to recreate them
      const invoicesCollection = db.collection<Invoice>('invoices');
      const indexes = await invoicesCollection.indexes();
      
      for (const index of indexes) {
        if (index.name !== '_id_') {
          await invoicesCollection.dropIndex(index.name!);
          console.log(`Dropped index: ${index.name}`);
        }
      }
    } else {
      // Create the collection
      await db.createCollection('invoices');
      console.log('Created invoices collection');
    }
    
    const invoicesCollection = db.collection<Invoice>('invoices');
    
    // Create indexes
    console.log('Creating indexes...');
    
    // Index on invoiceNumber (unique)
    await invoicesCollection.createIndex(
      { invoiceNumber: 1 },
      { 
        unique: true,
        name: 'invoiceNumber_unique'
      }
    );
    console.log('Created unique index on invoiceNumber');
    
    // Index on date for sorting
    await invoicesCollection.createIndex(
      { date: -1 },
      { 
        name: 'date_desc'
      }
    );
    console.log('Created index on date');
    
    // Index on status for filtering
    await invoicesCollection.createIndex(
      { status: 1 },
      { 
        name: 'status_idx'
      }
    );
    console.log('Created index on status');
    
    // Compound index for common queries
    await invoicesCollection.createIndex(
      { status: 1, date: -1 },
      { 
        name: 'status_date_compound'
      }
    );
    console.log('Created compound index on status and date');
    
    // Index on paymentId for lookups
    await invoicesCollection.createIndex(
      { paymentId: 1 },
      { 
        name: 'paymentId_idx',
        sparse: true
      }
    );
    console.log('Created index on paymentId');
    
    // Index on registrationId for lookups
    await invoicesCollection.createIndex(
      { registrationId: 1 },
      { 
        name: 'registrationId_idx',
        sparse: true
      }
    );
    console.log('Created index on registrationId');
    
    // Index on billTo.email for customer lookups
    await invoicesCollection.createIndex(
      { 'billTo.email': 1 },
      { 
        name: 'billTo_email_idx'
      }
    );
    console.log('Created index on billTo.email');
    
    // Set up validation
    console.log('Setting up validation...');
    await db.command({
      collMod: 'invoices',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['invoiceNumber', 'date', 'status', 'supplier', 'billTo', 'items', 'subtotal', 'processingFees', 'gstIncluded', 'total'],
          properties: {
            invoiceNumber: {
              bsonType: 'string',
              description: 'Invoice number must be a string'
            },
            date: {
              bsonType: 'date',
              description: 'Date must be a valid date'
            },
            status: {
              enum: ['paid', 'pending', 'overdue', 'cancelled'],
              description: 'Status must be one of the allowed values'
            },
            supplier: {
              bsonType: 'object',
              required: ['name', 'abn', 'address'],
              properties: {
                name: { bsonType: 'string' },
                abn: { bsonType: 'string' },
                address: { bsonType: 'string' }
              }
            },
            billTo: {
              bsonType: 'object',
              required: ['name', 'email'],
              properties: {
                name: { bsonType: 'string' },
                email: { 
                  bsonType: 'string',
                  pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
                },
                phone: { bsonType: 'string' },
                address: { bsonType: 'string' }
              }
            },
            items: {
              bsonType: 'array',
              minItems: 1,
              items: {
                bsonType: 'object',
                required: ['description', 'quantity', 'price'],
                properties: {
                  description: { bsonType: 'string' },
                  quantity: { 
                    bsonType: 'number',
                    minimum: 1
                  },
                  price: { 
                    bsonType: 'number',
                    minimum: 0
                  }
                }
              }
            },
            subtotal: {
              bsonType: 'number',
              minimum: 0
            },
            processingFees: {
              bsonType: 'number',
              minimum: 0
            },
            gstIncluded: {
              bsonType: 'number',
              minimum: 0
            },
            total: {
              bsonType: 'number',
              minimum: 0
            },
            paymentId: {
              bsonType: 'string'
            },
            registrationId: {
              bsonType: 'string'
            }
          }
        }
      },
      validationLevel: 'moderate',
      validationAction: 'warn'
    });
    console.log('Validation rules applied');
    
    console.log('\nInvoices collection setup complete!');
    
    // Show collection stats
    const count = await invoicesCollection.countDocuments();
    console.log('\nCollection stats:');
    console.log(`- Document count: ${count}`);
    
  } catch (error) {
    console.error('Error setting up invoices collection:', error);
    throw error;
  } finally {
    await disconnectMongoDB();
  }
}

// Run the setup
setupInvoicesCollection()
  .then(() => {
    console.log('\nSetup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nSetup failed:', error);
    process.exit(1);
  });