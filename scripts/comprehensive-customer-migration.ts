#!/usr/bin/env npx tsx
/**
 * Comprehensive migration script to:
 * 1. Update ownerType from 'organisation'/'contact' to 'customer'
 * 2. Ensure all customers are properly created and deduplicated
 * 3. Update all references across collections
 * 4. Link attendees to customers where applicable
 */

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'lodgetix_reconcile';

interface Customer {
  _id?: ObjectId;
  customerId: string;
  hash: string;
  firstName: string;
  lastName: string;
  email: string;
  businessName?: string;
  phone?: string;
  customerType: 'person' | 'business';
  address?: any;
  createdAt: Date;
  updatedAt: Date;
}

class ComprehensiveCustomerMigration {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private customerCache = new Map<string, Customer>();
  
  private stats = {
    customersCreated: 0,
    customersFound: 0,
    ticketsUpdated: 0,
    importTicketsUpdated: 0,
    registrationsUpdated: 0,
    importRegistrationsUpdated: 0,
    attendeesLinked: 0,
    ordersUpdated: 0,
    invoicesUpdated: 0,
    errors: 0
  };

  async connect(): Promise<void> {
    try {
      console.log('🔗 Connecting to MongoDB...');
      this.client = new MongoClient(MONGODB_URI);
      await this.client.connect();
      this.db = this.client.db(DB_NAME);
      console.log(`✅ Connected to database: ${DB_NAME}`);
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  /**
   * Generate customer hash based on firstName, lastName, email, businessName
   */
  private generateCustomerHash(firstName: string, lastName: string, email: string, businessName?: string): string {
    const normalizedData = [
      (firstName || '').trim().toLowerCase(),
      (lastName || '').trim().toLowerCase(),
      (email || '').trim().toLowerCase(),
      (businessName || '').trim().toLowerCase()
    ].join('|');
    
    return crypto.createHash('sha256').update(normalizedData).digest('hex');
  }

  /**
   * Find or create a customer based on hash
   */
  private async findOrCreateCustomer(customerData: Partial<Customer>): Promise<Customer> {
    if (!this.db) throw new Error('Database not connected');
    
    const hash = this.generateCustomerHash(
      customerData.firstName || '',
      customerData.lastName || '',
      customerData.email || '',
      customerData.businessName
    );
    
    // Check cache first
    if (this.customerCache.has(hash)) {
      this.stats.customersFound++;
      return this.customerCache.get(hash)!;
    }
    
    // Check database
    let customer = await this.db.collection<Customer>('customers').findOne({ hash });
    
    if (!customer) {
      // Check import_customers collection as well
      customer = await this.db.collection<Customer>('import_customers').findOne({ hash });
    }
    
    if (customer) {
      this.stats.customersFound++;
      this.customerCache.set(hash, customer);
      return customer;
    }
    
    // Create new customer
    const newCustomer: Customer = {
      customerId: `cust_${crypto.randomUUID()}`,
      hash,
      firstName: customerData.firstName || '',
      lastName: customerData.lastName || '',
      email: customerData.email || '',
      businessName: customerData.businessName,
      phone: customerData.phone,
      customerType: customerData.businessName ? 'business' : 'person',
      address: customerData.address,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await this.db.collection<Customer>('customers').insertOne(newCustomer);
    newCustomer._id = result.insertedId;
    
    this.stats.customersCreated++;
    this.customerCache.set(hash, newCustomer);
    
    console.log(`    ✅ Created new customer: ${newCustomer.firstName} ${newCustomer.lastName} (${newCustomer.customerId})`);
    
    return newCustomer;
  }

  /**
   * Migrate tickets collection
   */
  async migrateTickets(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📋 Migrating tickets collection...');
    
    // Update tickets with ownerType 'organisation' or 'contact' to 'customer'
    const collections = ['tickets', 'import_tickets'];
    
    for (const collectionName of collections) {
      const collection = this.db.collection(collectionName);
      
      // Count tickets needing update
      const count = await collection.countDocuments({
        ownerType: { $in: ['organisation', 'contact'] }
      });
      
      if (count === 0) {
        console.log(`  ℹ️  No tickets in '${collectionName}' need ownerType update`);
        continue;
      }
      
      console.log(`  📝 Updating ${count} tickets in '${collectionName}'...`);
      
      // Update ownerType
      const result = await collection.updateMany(
        { ownerType: { $in: ['organisation', 'contact'] } },
        { 
          $set: { 
            ownerType: 'customer',
            'ticketOwner.ownerType': 'customer',
            updatedAt: new Date(),
            migrationNote: 'Updated ownerType to customer'
          } 
        }
      );
      
      if (collectionName === 'tickets') {
        this.stats.ticketsUpdated += result.modifiedCount;
      } else {
        this.stats.importTicketsUpdated += result.modifiedCount;
      }
      
      console.log(`    ✅ Updated ${result.modifiedCount} tickets`);
    }
  }

  /**
   * Process registrations to ensure customer references
   */
  async processRegistrations(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📋 Processing registrations for customer references...');
    
    const collections = ['registrations', 'import_registrations'];
    
    for (const collectionName of collections) {
      const collection = this.db.collection(collectionName);
      
      // Find registrations with bookingContact but no customer reference
      const registrations = await collection.find({
        $or: [
          { 'registrationData.bookingContact': { $exists: true, $type: 'object' } },
          { 'registration_data.bookingContact': { $exists: true, $type: 'object' } }
        ]
      }).toArray();
      
      if (registrations.length === 0) {
        console.log(`  ℹ️  No registrations in '${collectionName}' need processing`);
        continue;
      }
      
      console.log(`  📝 Processing ${registrations.length} registrations in '${collectionName}'...`);
      
      let updatedCount = 0;
      
      for (const registration of registrations) {
        const bookingContact = registration.registrationData?.bookingContact || 
                               registration.registration_data?.bookingContact;
        
        if (!bookingContact || typeof bookingContact !== 'object') {
          continue;
        }
        
        // Find or create customer from booking contact
        const customer = await this.findOrCreateCustomer({
          firstName: bookingContact.firstName || bookingContact.first_name || '',
          lastName: bookingContact.lastName || bookingContact.last_name || '',
          email: bookingContact.email || '',
          businessName: bookingContact.businessName || bookingContact.business_name,
          phone: bookingContact.phone || bookingContact.mobile || '',
          address: {
            street: bookingContact.address || bookingContact.street || '',
            city: bookingContact.city || '',
            state: bookingContact.state || '',
            postalCode: bookingContact.postalCode || bookingContact.postal_code || '',
            country: bookingContact.country || 'AU'
          }
        });
        
        // Update registration with customer reference
        const updateData: any = {
          updatedAt: new Date(),
          'metadata.customerId': customer._id,
          'metadata.customerUUID': customer.customerId
        };
        
        if (registration.registrationData) {
          updateData['registrationData.bookingContactRef'] = customer.customerId;
        }
        if (registration.registration_data) {
          updateData['registration_data.bookingContactRef'] = customer.customerId;
        }
        
        await collection.updateOne(
          { _id: registration._id },
          { $set: updateData }
        );
        
        updatedCount++;
      }
      
      if (collectionName === 'registrations') {
        this.stats.registrationsUpdated += updatedCount;
      } else {
        this.stats.importRegistrationsUpdated += updatedCount;
      }
      
      console.log(`    ✅ Updated ${updatedCount} registrations with customer references`);
    }
  }

  /**
   * Link attendees to customers where applicable
   */
  async linkAttendeesToCustomers(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📋 Linking attendees to customers...');
    
    const collections = ['attendees', 'import_attendees'];
    
    for (const collectionName of collections) {
      const collection = this.db.collection(collectionName);
      
      // Find attendees with email addresses
      const attendees = await collection.find({
        email: { $exists: true, $ne: '' }
      }).toArray();
      
      if (attendees.length === 0) {
        console.log(`  ℹ️  No attendees in '${collectionName}' to link`);
        continue;
      }
      
      console.log(`  📝 Processing ${attendees.length} attendees in '${collectionName}'...`);
      
      let linkedCount = 0;
      
      for (const attendee of attendees) {
        // Skip if already has customer reference
        if (attendee.customerId || attendee.customerRef) {
          continue;
        }
        
        // Try to find matching customer by email and name
        const hash = this.generateCustomerHash(
          attendee.firstName || '',
          attendee.lastName || '',
          attendee.email || '',
          '' // Attendees typically don't have business names
        );
        
        const customer = await this.db.collection<Customer>('customers').findOne({ hash });
        
        if (customer) {
          await collection.updateOne(
            { _id: attendee._id },
            { 
              $set: { 
                customerId: customer.customerId,
                customerRef: customer._id,
                updatedAt: new Date()
              } 
            }
          );
          linkedCount++;
        }
      }
      
      this.stats.attendeesLinked += linkedCount;
      console.log(`    ✅ Linked ${linkedCount} attendees to customers`);
    }
  }

  /**
   * Update orders collection with customer references
   */
  async updateOrders(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📋 Updating orders collection...');
    
    const collections = ['orders', 'import_orders'];
    
    for (const collectionName of collections) {
      const collection = this.db.collection(collectionName);
      
      // Check if collection exists
      const collectionExists = await this.db.listCollections({ name: collectionName }).hasNext();
      if (!collectionExists) {
        console.log(`  ℹ️  Collection '${collectionName}' does not exist`);
        continue;
      }
      
      // Find orders without customer references
      const orders = await collection.find({
        customerId: { $exists: false }
      }).limit(100).toArray(); // Process in batches
      
      if (orders.length === 0) {
        console.log(`  ℹ️  No orders in '${collectionName}' need customer references`);
        continue;
      }
      
      console.log(`  📝 Processing ${orders.length} orders in '${collectionName}'...`);
      
      let updatedCount = 0;
      
      for (const order of orders) {
        // Try to find customer from order data
        if (order.customer || order.billingDetails) {
          const customerData = order.customer || order.billingDetails;
          
          const customer = await this.findOrCreateCustomer({
            firstName: customerData.firstName || customerData.first_name || '',
            lastName: customerData.lastName || customerData.last_name || '',
            email: customerData.email || '',
            businessName: customerData.businessName || customerData.company || '',
            phone: customerData.phone || '',
            address: customerData.address
          });
          
          await collection.updateOne(
            { _id: order._id },
            { 
              $set: { 
                customerId: customer.customerId,
                customerRef: customer._id,
                updatedAt: new Date()
              } 
            }
          );
          
          updatedCount++;
        }
      }
      
      this.stats.ordersUpdated += updatedCount;
      console.log(`    ✅ Updated ${updatedCount} orders with customer references`);
    }
  }

  /**
   * Update invoices collection
   */
  async updateInvoices(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📋 Updating invoices collection...');
    
    const collections = ['invoices', 'import_invoices'];
    
    for (const collectionName of collections) {
      const collection = this.db.collection(collectionName);
      
      // Check if collection exists
      const collectionExists = await this.db.listCollections({ name: collectionName }).hasNext();
      if (!collectionExists) {
        console.log(`  ℹ️  Collection '${collectionName}' does not exist`);
        continue;
      }
      
      // Update any invoices with old ownerType values
      const result = await collection.updateMany(
        { 'customer.ownerType': { $in: ['organisation', 'contact'] } },
        { 
          $set: { 
            'customer.ownerType': 'customer',
            updatedAt: new Date()
          } 
        }
      );
      
      if (result.modifiedCount > 0) {
        this.stats.invoicesUpdated += result.modifiedCount;
        console.log(`    ✅ Updated ${result.modifiedCount} invoices`);
      } else {
        console.log(`  ℹ️  No invoices in '${collectionName}' need updates`);
      }
    }
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📊 Migration Report');
    console.log('═══════════════════════════════════════════');
    
    // Customers summary
    const customersCount = await this.db.collection('customers').countDocuments({});
    const importCustomersCount = await this.db.collection('import_customers').countDocuments({});
    
    console.log('\n👥 Customers:');
    console.log(`  Total customers: ${customersCount}`);
    console.log(`  Import customers: ${importCustomersCount}`);
    console.log(`  Customers created: ${this.stats.customersCreated}`);
    console.log(`  Existing customers found: ${this.stats.customersFound}`);
    
    // Tickets summary
    const ticketsSummary = await this.db.collection('tickets').aggregate([
      { $group: { _id: '$ownerType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('\n🎫 Tickets by ownerType:');
    for (const item of ticketsSummary) {
      console.log(`  ${item._id || 'null'}: ${item.count} tickets`);
    }
    
    // Migration statistics
    console.log('\n✅ Migration Statistics:');
    console.log(`  Tickets updated: ${this.stats.ticketsUpdated}`);
    console.log(`  Import tickets updated: ${this.stats.importTicketsUpdated}`);
    console.log(`  Registrations updated: ${this.stats.registrationsUpdated}`);
    console.log(`  Import registrations updated: ${this.stats.importRegistrationsUpdated}`);
    console.log(`  Attendees linked: ${this.stats.attendeesLinked}`);
    console.log(`  Orders updated: ${this.stats.ordersUpdated}`);
    console.log(`  Invoices updated: ${this.stats.invoicesUpdated}`);
    console.log(`  Errors: ${this.stats.errors}`);
    
    console.log('\n═══════════════════════════════════════════');
  }

  async run(): Promise<void> {
    try {
      await this.connect();
      
      console.log('\n🚀 Starting comprehensive customer migration');
      console.log('═══════════════════════════════════════════');
      
      // Process in order
      await this.processRegistrations();     // Create customers from registrations first
      await this.migrateTickets();          // Update ticket ownerTypes
      await this.linkAttendeesToCustomers(); // Link attendees to customers
      await this.updateOrders();            // Update orders with customer refs
      await this.updateInvoices();          // Update invoices
      
      // Generate final report
      await this.generateReport();
      
      console.log('\n✅ Migration completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      this.stats.errors++;
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  const migration = new ComprehensiveCustomerMigration();
  
  console.log('⚠️  This migration will:');
  console.log('  1. Create customers from registration booking contacts');
  console.log('  2. Update ticket ownerType from organisation/contact to customer');
  console.log('  3. Link attendees to customers by matching email/name');
  console.log('  4. Update orders and invoices with customer references');
  console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  
  setTimeout(() => {
    migration.run()
      .then(() => {
        console.log('\n🎉 Migration completed successfully!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n💥 Migration failed:', error);
        process.exit(1);
      });
  }, 5000);
}

export default ComprehensiveCustomerMigration;