/**
 * MongoDB Index Creation Script
 * 
 * This script creates all necessary indexes for optimal query performance
 * Run after collections have been created
 */

const MONGODB_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
const DATABASE_NAME = 'LodgeTix';

const { MongoClient } = require('mongodb');

async function createIndexes() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    console.log(`Connected to database: ${DATABASE_NAME}`);
    
    // ATTENDEES COLLECTION INDEXES
    console.log('\n📇 Creating indexes for attendees collection...');
    
    await db.collection('attendees').createIndex(
      { "attendeeNumber": 1 },
      { unique: true, name: "attendeeNumber_unique" }
    );
    
    await db.collection('attendees').createIndex(
      { "attendeeId": 1 },
      { unique: true, name: "attendeeId_unique" }
    );
    
    await db.collection('attendees').createIndex(
      { "functionId": 1, "status": 1 },
      { name: "function_status" }
    );
    
    await db.collection('attendees').createIndex(
      { "registrationId": 1 },
      { name: "registration_lookup" }
    );
    
    await db.collection('attendees').createIndex(
      { "contactId": 1 },
      { name: "contact_lookup" }
    );
    
    await db.collection('attendees').createIndex(
      { "qrCode.code": 1 },
      { unique: true, name: "qr_code_unique" }
    );
    
    await db.collection('attendees').createIndex(
      { "profile.primaryEmail": 1 },
      { name: "email_lookup" }
    );
    
    await db.collection('attendees').createIndex(
      { "isCheckedIn": 1, "functionId": 1 },
      { name: "checkin_status" }
    );
    
    console.log('✓ Attendees indexes created');
    
    // CONTACTS COLLECTION INDEXES
    console.log('\n👥 Creating indexes for contacts collection...');
    
    await db.collection('contacts').createIndex(
      { "contactNumber": 1 },
      { unique: true, name: "contactNumber_unique" }
    );
    
    await db.collection('contacts').createIndex(
      { "profile.email": 1 },
      { sparse: true, name: "email_unique" }
    );
    
    await db.collection('contacts').createIndex(
      { "profile.firstName": 1, "profile.lastName": 1 },
      { name: "name_search" }
    );
    
    await db.collection('contacts').createIndex(
      { "masonicProfile.craft.lodge.organisationId": 1 },
      { sparse: true, name: "lodge_members" }
    );
    
    await db.collection('contacts').createIndex(
      { "userId": 1 },
      { sparse: true, name: "user_lookup" }
    );
    
    console.log('✓ Contacts indexes created');
    
    // FINANCIAL TRANSACTIONS COLLECTION INDEXES
    console.log('\n💰 Creating indexes for financial-transactions collection...');
    
    await db.collection('financialTransactions').createIndex(
      { "transactionId": 1 },
      { unique: true, name: "transactionId_unique" }
    );
    
    await db.collection('financialTransactions').createIndex(
      { "reference.functionId": 1, "type": 1 },
      { name: "function_transactions" }
    );
    
    await db.collection('financialTransactions').createIndex(
      { "parties.customer.id": 1 },
      { name: "customer_lookup" }
    );
    
    await db.collection('financialTransactions').createIndex(
      { "reconciliation.status": 1, "audit.createdAt": -1 },
      { name: "reconciliation_queue" }
    );
    
    await db.collection('financialTransactions').createIndex(
      { "payments.gatewayTransactionId": 1 },
      { sparse: true, name: "gateway_lookup" }
    );
    
    console.log('✓ Financial transactions indexes created');
    
    // FUNCTIONS COLLECTION INDEXES
    console.log('\n🎪 Creating indexes for functions collection...');
    
    await db.collection('functions').createIndex(
      { "functionId": 1 },
      { unique: true, name: "functionId_unique" }
    );
    
    await db.collection('functions').createIndex(
      { "slug": 1 },
      { unique: true, name: "slug_unique" }
    );
    
    await db.collection('functions').createIndex(
      { "dates.startDate": 1, "dates.endDate": 1 },
      { name: "date_range" }
    );
    
    await db.collection('functions').createIndex(
      { "events.event_id": 1 },
      { name: "event_lookup" }
    );
    
    console.log('✓ Functions indexes created');
    
    // INVOICES COLLECTION INDEXES
    console.log('\n📄 Creating indexes for invoices collection...');
    
    await db.collection('invoices').createIndex(
      { "invoiceNumber": 1 },
      { unique: true, name: "invoiceNumber_unique" }
    );
    
    await db.collection('invoices').createIndex(
      { "parties.customer.id": 1, "status": 1 },
      { name: "customer_invoices" }
    );
    
    await db.collection('invoices').createIndex(
      { "status": 1, "dueDate": 1 },
      { name: "overdue_check" }
    );
    
    await db.collection('invoices').createIndex(
      { "references.functionId": 1 },
      { sparse: true, name: "function_invoices" }
    );
    
    console.log('✓ Invoices indexes created');
    
    // JURISDICTIONS COLLECTION INDEXES
    console.log('\n🏛️ Creating indexes for jurisdictions collection...');
    
    await db.collection('jurisdictions').createIndex(
      { "jurisdictionId": 1 },
      { unique: true, name: "jurisdictionId_unique" }
    );
    
    await db.collection('jurisdictions').createIndex(
      { "country": 1, "type": 1 },
      { name: "country_type" }
    );
    
    await db.collection('jurisdictions').createIndex(
      { "parentJurisdictionId": 1 },
      { sparse: true, name: "hierarchy_lookup" }
    );
    
    console.log('✓ Jurisdictions indexes created');
    
    // ORGANISATIONS COLLECTION INDEXES
    console.log('\n🏢 Creating indexes for organisations collection...');
    
    await db.collection('organisations').createIndex(
      { "organisationId": 1 },
      { unique: true, name: "organisationId_unique" }
    );
    
    await db.collection('organisations').createIndex(
      { "type": 1, "status": 1 },
      { name: "type_status" }
    );
    
    await db.collection('organisations').createIndex(
      { "number": 1, "jurisdictionId": 1 },
      { sparse: true, name: "lodge_number" }
    );
    
    await db.collection('organisations').createIndex(
      { "officers.contactId": 1 },
      { sparse: true, name: "officer_lookup" }
    );
    
    console.log('✓ Organisations indexes created');
    
    // PRODUCTS COLLECTION INDEXES
    console.log('\n📦 Creating indexes for products collection...');
    
    await db.collection('products').createIndex(
      { "productId": 1 },
      { unique: true, name: "productId_unique" }
    );
    
    await db.collection('products').createIndex(
      { "functionId": 1, "status": 1 },
      { sparse: true, name: "function_products" }
    );
    
    await db.collection('products').createIndex(
      { "eventId": 1, "status": 1 },
      { sparse: true, name: "event_products" }
    );
    
    await db.collection('products').createIndex(
      { "type": 1, "status": 1 },
      { name: "product_type" }
    );
    
    console.log('✓ Products indexes created');
    
    // REGISTRATIONS COLLECTION INDEXES
    console.log('\n📝 Creating indexes for registrations collection...');
    
    await db.collection('registrations').createIndex(
      { "registrationNumber": 1 },
      { unique: true, name: "registrationNumber_unique" }
    );
    
    await db.collection('registrations').createIndex(
      { "functionId": 1, "status": 1 },
      { name: "function_registrations" }
    );
    
    await db.collection('registrations').createIndex(
      { "registrant.contactId": 1 },
      { sparse: true, name: "contact_registrations" }
    );
    
    await db.collection('registrations').createIndex(
      { "registrant.organisationId": 1 },
      { sparse: true, name: "organisation_registrations" }
    );
    
    await db.collection('registrations').createIndex(
      { "registrationDate": -1 },
      { name: "registration_date" }
    );
    
    await db.collection('registrations').createIndex(
      { "attendees.attendeeId": 1 },
      { sparse: true, name: "attendee_lookup" }
    );
    
    console.log('✓ Registrations indexes created');
    
    // TICKETS COLLECTION INDEXES
    console.log('\n🎫 Creating indexes for tickets collection...');
    
    await db.collection('tickets').createIndex(
      { "ticketNumber": 1 },
      { unique: true, name: "ticketNumber_unique" }
    );
    
    await db.collection('tickets').createIndex(
      { "qrCode.code": 1 },
      { unique: true, name: "qr_code_unique" }
    );
    
    await db.collection('tickets').createIndex(
      { "eventId": 1, "status": 1 },
      { name: "event_tickets" }
    );
    
    await db.collection('tickets').createIndex(
      { "attendeeId": 1 },
      { sparse: true, name: "attendee_tickets" }
    );
    
    await db.collection('tickets').createIndex(
      { "registrationId": 1 },
      { name: "registration_tickets" }
    );
    
    await db.collection('tickets').createIndex(
      { "status": 1, "usage.used": 1 },
      { name: "ticket_usage" }
    );
    
    console.log('✓ Tickets indexes created');
    
    // USERS COLLECTION INDEXES
    console.log('\n👤 Creating indexes for users collection...');
    
    await db.collection('users').createIndex(
      { "email": 1 },
      { unique: true, name: "email_unique" }
    );
    
    await db.collection('users').createIndex(
      { "contactId": 1 },
      { sparse: true, unique: true, name: "contact_unique" }
    );
    
    await db.collection('users').createIndex(
      { "status": 1, "roles": 1 },
      { name: "status_roles" }
    );
    
    await db.collection('users').createIndex(
      { "authentication.lastLogin": -1 },
      { sparse: true, name: "last_login" }
    );
    
    console.log('✓ Users indexes created');
    
    // TEXT SEARCH INDEXES
    console.log('\n🔍 Creating text search indexes...');
    
    await db.collection('attendees').createIndex(
      { 
        "profile.firstName": "text",
        "profile.lastName": "text",
        "profile.primaryEmail": "text"
      },
      { name: "attendee_text_search" }
    );
    
    await db.collection('contacts').createIndex(
      {
        "profile.firstName": "text",
        "profile.lastName": "text",
        "profile.email": "text"
      },
      { name: "contact_text_search" }
    );
    
    await db.collection('organisations').createIndex(
      {
        "name": "text",
        "number": "text"
      },
      { name: "organisation_text_search" }
    );
    
    console.log('✓ Text search indexes created');
    
    console.log('\n✅ All indexes created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the script
createIndexes().catch(console.error);