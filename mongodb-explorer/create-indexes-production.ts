/**
 * MongoDB Production Index Creation Script
 * 
 * This script creates all necessary indexes for the LodgeTix database
 * Note: This script is designed to be run with MongoDB shell, converted to TypeScript for type safety
 */

import { MongoClient, Db, Collection, IndexDescription } from 'mongodb';

interface IndexSpec {
  [key: string]: number | string;
}

interface IndexOptions {
  name?: string;
  unique?: boolean;
  sparse?: boolean;
  background?: boolean;
  [key: string]: any;
}

class MongoIndexCreator {
  private db: Db;
  private dryRun: boolean;

  constructor(db: Db, dryRun = true) {
    this.db = db;
    this.dryRun = dryRun;
  }

  async createIndex(collectionName: string, indexSpec: IndexSpec, options: IndexOptions = {}): Promise<void> {
    const collection = this.db.collection(collectionName);
    const indexName = options.name || JSON.stringify(indexSpec);
    
    try {
      // Check if index already exists
      const existingIndexes: IndexDescription[] = await collection.listIndexes().toArray();
      const indexExists = existingIndexes.some(idx => {
        const keys = Object.keys(indexSpec);
        return keys.every(key => idx.key && idx.key[key] === indexSpec[key]);
      });
      
      if (indexExists) {
        console.log(`[SKIP] Index already exists on ${collectionName}: ${indexName}`);
        return;
      }
      
      if (this.dryRun) {
        console.log(`[DRY RUN] Would create index on ${collectionName}: ${indexName}`);
        console.log(`  Spec: ${JSON.stringify(indexSpec)}`);
        console.log(`  Options: ${JSON.stringify(options)}`);
      } else {
        console.log(`[CREATE] Creating index on ${collectionName}: ${indexName}`);
        await collection.createIndex(indexSpec, options);
        console.log(`[SUCCESS] Index created successfully`);
      }
    } catch (error: any) {
      console.error(`[ERROR] Failed to create index on ${collectionName}: ${indexName}`);
      console.error(`  Error: ${error.message}`);
    }
  }

  async createAllIndexes(): Promise<void> {
    console.log('\n========================================');
    console.log('MongoDB Index Creation Script');
    console.log(`Database: ${this.db.databaseName}`);
    console.log(`Dry Run: ${this.dryRun}`);
    console.log('========================================\n');

    // Primary collection indexes
    await this.createIndex('attendees', { attendeeNumber: 1 }, { unique: true, name: 'attendeeNumber_unique' });
    await this.createIndex('attendees', { attendeeId: 1 }, { unique: true, name: 'attendeeId_unique' });
    await this.createIndex('attendees', { registrationId: 1 }, { name: 'registrationId_1' });
    await this.createIndex('attendees', { functionId: 1 }, { name: 'functionId_1' });
    await this.createIndex('attendees', { contactId: 1 }, { sparse: true, name: 'contactId_1' });
    await this.createIndex('attendees', { 'profile.primaryEmail': 1 }, { sparse: true, name: 'profile_email_1' });
    await this.createIndex('attendees', { status: 1 }, { name: 'status_1' });
    await this.createIndex('attendees', { attendeeType: 1 }, { name: 'attendeeType_1' });
    await this.createIndex('attendees', { 'qrCode.code': 1 }, { unique: true, name: 'qrCode_unique' });
    await this.createIndex('attendees', { 'metadata.createdAt': 1 }, { name: 'created_at_1' });

    // Contacts collection
    await this.createIndex('contacts', { contactNumber: 1 }, { unique: true, name: 'contactNumber_unique' });
    await this.createIndex('contacts', { 'profile.email': 1 }, { sparse: true, name: 'profile_email_1' });
    await this.createIndex('contacts', { 'profile.firstName': 1, 'profile.lastName': 1 }, { name: 'name_compound' });
    await this.createIndex('contacts', { 'metadata.createdAt': 1 }, { name: 'created_at_1' });

    // Functions collection
    await this.createIndex('functions', { functionId: 1 }, { unique: true, name: 'functionId_unique' });
    await this.createIndex('functions', { slug: 1 }, { unique: true, name: 'slug_unique' });
    await this.createIndex('functions', { 'dates.startDate': 1 }, { name: 'start_date_1' });
    await this.createIndex('functions', { 'dates.publishedDate': 1 }, { sparse: true, name: 'published_date_1' });

    // Registrations collection
    await this.createIndex('registrations', { registrationNumber: 1 }, { unique: true, name: 'registrationNumber_unique' });
    await this.createIndex('registrations', { functionId: 1 }, { name: 'functionId_1' });
    await this.createIndex('registrations', { status: 1 }, { name: 'status_1' });
    await this.createIndex('registrations', { type: 1 }, { name: 'type_1' });
    await this.createIndex('registrations', { 'metadata.createdAt': 1 }, { name: 'created_at_1' });
    await this.createIndex('registrations', { 'billing.contact.email': 1 }, { sparse: true, name: 'billing_email_1' });

    // Financial transactions
    await this.createIndex('financialTransactions', { transactionId: 1 }, { unique: true, name: 'transactionId_unique' });
    await this.createIndex('financialTransactions', { 'reference.id': 1 }, { name: 'reference_id_1' });
    await this.createIndex('financialTransactions', { 'reference.functionId': 1 }, { name: 'reference_functionId_1' });
    await this.createIndex('financialTransactions', { type: 1 }, { name: 'type_1' });
    await this.createIndex('financialTransactions', { 'audit.createdAt': 1 }, { name: 'created_at_1' });
    await this.createIndex('financialTransactions', { 'reconciliation.status': 1 }, { name: 'reconciliation_status_1' });

    // Invoices collection
    await this.createIndex('invoices', { invoiceNumber: 1 }, { unique: true, name: 'invoiceNumber_unique' });
    await this.createIndex('invoices', { registrationId: 1 }, { sparse: true, name: 'registrationId_1' });
    await this.createIndex('invoices', { status: 1 }, { name: 'status_1' });
    await this.createIndex('invoices', { date: 1 }, { name: 'date_1' });
    await this.createIndex('invoices', { 'billTo.email': 1 }, { sparse: true, name: 'billTo_email_1' });

    // Tickets collection
    await this.createIndex('tickets', { registrationId: 1 }, { name: 'registrationId_1' });
    await this.createIndex('tickets', { attendeeId: 1 }, { name: 'attendeeId_1' });
    await this.createIndex('tickets', { eventId: 1 }, { name: 'eventId_1' });
    await this.createIndex('tickets', { productId: 1 }, { name: 'productId_1' });
    await this.createIndex('tickets', { status: 1 }, { name: 'status_1' });

    console.log('\n========================================');
    console.log(this.dryRun ? 'DRY RUN COMPLETE' : 'INDEX CREATION COMPLETE');
    console.log('========================================\n');
  }
}

async function main(): Promise<void> {
  const MONGODB_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
  const DATABASE_NAME = 'LodgeTix';
  const dryRun = process.env.DRY_RUN === 'false' ? false : true;

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    
    const indexCreator = new MongoIndexCreator(db, dryRun);
    await indexCreator.createAllIndexes();
    
  } catch (error: any) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { MongoIndexCreator };
