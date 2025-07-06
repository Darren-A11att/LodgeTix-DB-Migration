/**
 * MongoDB Production Index Creation Script
 * 
 * This script creates all necessary indexes for the LodgeTix database
 * Run with: mongo <connection-string> --eval "var dryRun=true" create-indexes-production.js
 * Set dryRun=false to actually create the indexes
 */

// Configuration
const dryRun = typeof dryRun !== 'undefined' ? dryRun : true;
const dbName = 'LodgeTix-migration-test-1'; // Update this if your database name is different

// Switch to the correct database
db = db.getSiblingDB(dbName);

print(`\n========================================`);
print(`MongoDB Index Creation Script`);
print(`Database: ${db.getName()}`);
print(`Dry Run: ${dryRun}`);
print(`========================================\n`);

// Helper function to create index with error handling
function createIndex(collection, indexSpec, options = {}) {
    const collectionName = collection.getName();
    const indexName = options.name || JSON.stringify(indexSpec);
    
    try {
        // Check if index already exists
        const existingIndexes = collection.getIndexes();
        const indexExists = existingIndexes.some(idx => {
            const keys = Object.keys(indexSpec);
            return keys.every(key => idx.key[key] === indexSpec[key]);
        });
        
        if (indexExists) {
            print(`[SKIP] Index already exists on ${collectionName}: ${indexName}`);
            return;
        }
        
        if (dryRun) {
            print(`[DRY RUN] Would create index on ${collectionName}: ${indexName}`);
            print(`  Spec: ${JSON.stringify(indexSpec)}`);
            print(`  Options: ${JSON.stringify(options)}`);
        } else {
            print(`[CREATE] Creating index on ${collectionName}: ${indexName}`);
            collection.createIndex(indexSpec, options);
            print(`[SUCCESS] Index created successfully`);
        }
    } catch (error) {
        print(`[ERROR] Failed to create index on ${collectionName}: ${indexName}`);
        print(`  Error: ${error.message}`);
    }
}

// Function to create all indexes for a collection
function createCollectionIndexes(collectionName, indexes) {
    print(`\n--- Creating indexes for ${collectionName} collection ---`);
    const collection = db.getCollection(collectionName);
    
    // Check if collection exists
    const collections = db.getCollectionNames();
    if (!collections.includes(collectionName)) {
        print(`[WARNING] Collection ${collectionName} does not exist. Skipping...`);
        return;
    }
    
    // Get collection stats
    const stats = collection.stats();
    print(`Collection size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    print(`Document count: ${stats.count}`);
    print(`Current indexes: ${collection.getIndexes().length}`);
    
    // Create each index
    indexes.forEach((indexDef, index) => {
        print(`\n[${index + 1}/${indexes.length}] Processing index...`);
        createIndex(collection, indexDef.spec, indexDef.options);
    });
}

// ========================================
// REGISTRATIONS COLLECTION INDEXES
// ========================================

const registrationIndexes = [
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

const paymentIndexes = [
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
// EXECUTE INDEX CREATION
// ========================================

print(`\n========================================`);
print(`Starting index creation process...`);
print(`========================================`);

// Create registrations indexes
createCollectionIndexes('registrations', registrationIndexes);

// Create payments indexes
createCollectionIndexes('payments', paymentIndexes);

// ========================================
// SUMMARY
// ========================================

print(`\n========================================`);
print(`Index Creation Summary`);
print(`========================================`);

if (dryRun) {
    print(`\nThis was a DRY RUN. No indexes were actually created.`);
    print(`To create the indexes, run this script with dryRun=false:`);
    print(`mongo <connection-string> --eval "var dryRun=false" create-indexes-production.js`);
} else {
    print(`\nIndex creation completed!`);
    
    // Show final index counts
    ['registrations', 'payments'].forEach(collectionName => {
        const collection = db.getCollection(collectionName);
        if (db.getCollectionNames().includes(collectionName)) {
            const indexCount = collection.getIndexes().length;
            print(`${collectionName}: ${indexCount} indexes`);
        }
    });
}

print(`\nNext steps:`);
print(`1. Monitor index build progress in MongoDB logs`);
print(`2. Check index usage with db.collection.aggregate([{$indexStats: {}}])`);
print(`3. Review slow query logs after indexes are built`);
print(`4. Consider running analyze on collections after index creation`);