/**
 * MongoDB Production Index Creation Script
 * 
 * This script creates all necessary indexes for the LodgeTix database
 * Run with: npx ts-node create-indexes-production.ts --dry-run
 * Remove --dry-run flag to actually create the indexes
 */

import { MongoClient, Db, Collection, CreateIndexesOptions } from 'mongodb';

// Configuration
const dryRun: boolean = process.argv.includes('--dry-run');
const dbName: string = 'LodgeTix-migration-test-1'; // Update this if your database name is different

interface IndexDefinition {
  spec: Record<string, number>;
  options: CreateIndexesOptions;
}

interface IndexStats {
  size: number;
  count: number;
}

interface CollectionStats {
  size: number;
  count: number;
  [key: string]: any;
}

// MongoDB connection
async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  const uri: string = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client: MongoClient = new MongoClient(uri);
  
  await client.connect();
  const db: Db = client.db(dbName);
  
  return { client, db };
}

// Helper function to create index with error handling
async function createIndex(collection: Collection, indexSpec: Record<string, number>, options: CreateIndexesOptions = {}): Promise<void> {
  const collectionName: string = collection.collectionName;
  const indexName: string = options.name || JSON.stringify(indexSpec);
  
  try {
    // Check if index already exists
    const existingIndexes = await collection.indexes();
    const indexExists: boolean = existingIndexes.some((idx: any) => {
      const keys: string[] = Object.keys(indexSpec);
      return keys.every((key: string) => idx.key[key] === indexSpec[key]);
    });
    
    if (indexExists) {
      console.log(`[SKIP] Index already exists on ${collectionName}: ${indexName}`);
      return;
    }
    
    if (dryRun) {
      console.log(`[DRY RUN] Would create index on ${collectionName}: ${indexName}`);
      console.log(`  Spec: ${JSON.stringify(indexSpec)}`);
      console.log(`  Options: ${JSON.stringify(options)}`);
    } else {
      console.log(`[CREATE] Creating index on ${collectionName}: ${indexName}`);
      await collection.createIndex(indexSpec, options);
      console.log(`[SUCCESS] Index created successfully`);
    }
  } catch (error: any) {
    console.log(`[ERROR] Failed to create index on ${collectionName}: ${indexName}`);
    console.log(`  Error: ${error.message}`);
  }
}

// Function to create all indexes for a collection
async function createCollectionIndexes(db: Db, collectionName: string, indexes: IndexDefinition[]): Promise<void> {
  console.log(`\n--- Creating indexes for ${collectionName} collection ---`);
  const collection: Collection = db.collection(collectionName);
  
  // Check if collection exists
  const collections = await db.listCollections().toArray();
  const collectionExists: boolean = collections.some((col: any) => col.name === collectionName);
  
  if (!collectionExists) {
    console.log(`[WARNING] Collection ${collectionName} does not exist. Skipping...`);
    return;
  }
  
  // Get collection stats
  try {
    const docCount: number = await collection.countDocuments();
    console.log(`Document count: ${docCount}`);
    
    const currentIndexes = await collection.indexes();
    console.log(`Current indexes: ${currentIndexes.length}`);
  } catch (error: any) {
    console.log(`[INFO] Could not get collection stats: ${error.message}`);
  }
  
  // Create each index
  for (let index = 0; index < indexes.length; index++) {
    const indexDef: IndexDefinition = indexes[index];
    console.log(`\n[${index + 1}/${indexes.length}] Processing index...`);
    await createIndex(collection, indexDef.spec, indexDef.options);
  }
}

// ========================================
// REGISTRATIONS COLLECTION INDEXES
// ========================================

const registrationIndexes: IndexDefinition[] = [
  // Primary lookups - most frequently used
  { spec: { "registrationId": 1 }, options: { background: true, name: "registrationId_1" } },
  { spec: { "customerId": 1 }, options: { background: true, name: "customerId_1" } },
  { spec: { "functionId": 1 }, options: { background: true, name: "functionId_1" } },
  { spec: { "authUserId": 1 }, options: { background: true, name: "authUserId_1" } },
  { spec: { "bookingContactId": 1 }, options: { background: true, name: "bookingContactId_1" } },
  
  // Payment-related indexes
  { spec: { "stripePaymentIntentId": 1 }, options: { background: true, sparse: true, name: "stripePaymentIntentId_1" } },
  { spec: { "connectedAccountId": 1 }, options: { background: true, name: "connectedAccountId_1" } },
  { spec: { "registrationData.square_payment_id": 1 }, options: { background: true, sparse: true, name: "square_payment_id_1" } },
  { spec: { "registrationData.square_customer_id": 1 }, options: { background: true, sparse: true, name: "square_customer_id_1" } },
  { spec: { "squarePaymentId": 1 }, options: { background: true, sparse: true, name: "squarePaymentId_1" } },
  
  // Organisation and event indexes
  { spec: { "organisationId": 1 }, options: { background: true, sparse: true, name: "organisationId_1" } },
  { spec: { "eventId": 1 }, options: { background: true, sparse: true, name: "eventId_1" } },
  { spec: { "primaryAttendeeId": 1 }, options: { background: true, sparse: true, name: "primaryAttendeeId_1" } },
  { spec: { "platformFeeId": 1 }, options: { background: true, sparse: true, name: "platformFeeId_1" } },
  
  // Attendee lookups
  { spec: { "registrationData.attendees.attendeeId": 1 }, options: { background: true, name: "attendees_attendeeId_1" } },
  { spec: { "registrationData.attendees.lodge_id": 1 }, options: { background: true, name: "attendees_lodge_id_1" } },
  { spec: { "registrationData.attendees.grand_lodge_id": 1 }, options: { background: true, name: "attendees_grand_lodge_id_1" } },
  { spec: { "registrationData.attendees.lodgeOrganisationId": 1 }, options: { background: true, name: "attendees_lodgeOrgId_1" } },
  { spec: { "registrationData.attendees.grandLodgeOrganisationId": 1 }, options: { background: true, name: "attendees_grandLodgeOrgId_1" } },
  { spec: { "registrationData.attendees.guestOfId": 1 }, options: { background: true, sparse: true, name: "attendees_guestOfId_1" } },
  
  // Ticket lookups
  { spec: { "registrationData.selectedTickets.attendeeId": 1 }, options: { background: true, name: "tickets_attendeeId_1" } },
  { spec: { "registrationData.selectedTickets.event_ticket_id": 1 }, options: { background: true, name: "tickets_event_ticket_id_1" } },
  
  // Compound indexes for common query patterns
  { spec: { "functionId": 1, "status": 1 }, options: { background: true, name: "functionId_status_1" } },
  { spec: { "customerId": 1, "createdAt": -1 }, options: { background: true, name: "customerId_createdAt_-1" } },
  { spec: { "registrationData.attendees.attendeeId": 1, "functionId": 1 }, options: { background: true, name: "attendeeId_functionId_1" } },
  { spec: { "functionId": 1, "paymentStatus": 1 }, options: { background: true, name: "functionId_paymentStatus_1" } },
  { spec: { "connectedAccountId": 1, "createdAt": -1 }, options: { background: true, name: "connectedAccountId_createdAt_-1" } },
  
  // Text search index for confirmation numbers
  { spec: { "confirmationNumber": 1 }, options: { background: true, name: "confirmationNumber_1" } }
];

// ========================================
// PAYMENTS COLLECTION INDEXES
// ========================================

const paymentIndexes: IndexDefinition[] = [
  // Primary payment identifiers
  { spec: { "transactionId": 1 }, options: { background: true, name: "transactionId_1" } },
  { spec: { "paymentId": 1 }, options: { background: true, name: "paymentId_1" } },
  { spec: { "customerId": 1 }, options: { background: true, sparse: true, name: "customerId_1" } },
  
  // Original data payment identifiers
  { spec: { "originalData.id": 1 }, options: { background: true, name: "originalData_id_1" } },
  { spec: { "originalData.PaymentIntent ID": 1 }, options: { background: true, name: "originalData_paymentIntentId_1" } },
  { spec: { "originalData.Card ID": 1 }, options: { background: true, sparse: true, name: "originalData_cardId_1" } },
  { spec: { "originalData.Customer ID": 1 }, options: { background: true, sparse: true, name: "originalData_customerId_1" } },
  { spec: { "originalData.Invoice ID": 1 }, options: { background: true, sparse: true, name: "originalData_invoiceId_1" } },
  { spec: { "originalData.Checkout Session ID": 1 }, options: { background: true, sparse: true, name: "originalData_checkoutSessionId_1" } },
  
  // Metadata indexes for cross-referencing
  { spec: { "originalData.functionId (metadata)": 1 }, options: { background: true, sparse: true, name: "metadata_functionId_1" } },
  { spec: { "originalData.registrationId (metadata)": 1 }, options: { background: true, sparse: true, name: "metadata_registrationId_1" } },
  { spec: { "originalData.organisationId (metadata)": 1 }, options: { background: true, sparse: true, name: "metadata_organisationId_1" } },
  { spec: { "originalData.sessionId (metadata)": 1 }, options: { background: true, sparse: true, name: "metadata_sessionId_1" } },
  
  // Compound indexes for common queries
  { spec: { "status": 1, "timestamp": -1 }, options: { background: true, name: "status_timestamp_-1" } },
  { spec: { "source": 1, "timestamp": -1 }, options: { background: true, name: "source_timestamp_-1" } },
  { spec: { "customerEmail": 1, "timestamp": -1 }, options: { background: true, name: "customerEmail_timestamp_-1" } },
  { spec: { "originalData.functionId (metadata)": 1, "status": 1 }, options: { background: true, name: "functionId_status_compound_1" } },
  
  // Time-based queries
  { spec: { "timestamp": -1 }, options: { background: true, name: "timestamp_-1" } }
];

// ========================================
// MAIN EXECUTION
// ========================================

async function main(): Promise<void> {
  console.log(`\n========================================`);
  console.log(`MongoDB Index Creation Script`);
  console.log(`Database: ${dbName}`);
  console.log(`Dry Run: ${dryRun}`);
  console.log(`========================================\n`);

  const { client, db } = await connectToDatabase();

  try {
    console.log(`\n========================================`);
    console.log(`Starting index creation process...`);
    console.log(`========================================`);

    // Create registrations indexes
    await createCollectionIndexes(db, 'registrations', registrationIndexes);

    // Create payments indexes
    await createCollectionIndexes(db, 'payments', paymentIndexes);

    // ========================================
    // SUMMARY
    // ========================================

    console.log(`\n========================================`);
    console.log(`Index Creation Summary`);
    console.log(`========================================`);

    if (dryRun) {
      console.log(`\nThis was a DRY RUN. No indexes were actually created.`);
      console.log(`To create the indexes, run this script without --dry-run:`);
      console.log(`npx ts-node create-indexes-production.ts`);
    } else {
      console.log(`\nIndex creation completed!`);
      
      // Show final index counts
      const collections: string[] = ['registrations', 'payments'];
      for (const collectionName of collections) {
        const collection: Collection = db.collection(collectionName);
        try {
          const indexes = await collection.indexes();
          console.log(`${collectionName}: ${indexes.length} indexes`);
        } catch (error: any) {
          console.log(`${collectionName}: Could not get index count - ${error.message}`);
        }
      }
    }

    console.log(`\nNext steps:`);
    console.log(`1. Monitor index build progress in MongoDB logs`);
    console.log(`2. Check index usage with db.collection.aggregate([{$indexStats: {}}])`);
    console.log(`3. Review slow query logs after indexes are built`);
    console.log(`4. Consider running analyze on collections after index creation`);

  } finally {
    await client.close();
  }
}

// Run the script
if (require.main === module) {
  main().catch((error: Error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}