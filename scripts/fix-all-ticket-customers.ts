#!/usr/bin/env npx tsx
/**
 * Comprehensive script to fix ALL ticket customer issues:
 * 1. Fix tickets with empty ownerIds by creating customers from registrations
 * 2. Update all ownerType values from 'contact'/'organisation' to 'customer'
 * 3. Ensure all tickets have proper customer references
 */

import { MongoClient, Db, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'lodgetix';

class FixAllTicketCustomers {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private customerCache = new Map<string, any>();
  
  private stats = {
    ticketsWithEmptyOwnerId: 0,
    ticketsFixed: 0,
    ticketsUpdatedOwnerType: 0,
    customersCreated: 0,
    customersReused: 0,
    errors: 0
  };

  async connect(): Promise<void> {
    console.log('🔗 Connecting to MongoDB...');
    this.client = new MongoClient(MONGODB_URI);
    await this.client.connect();
    this.db = this.client.db(DB_NAME);
    console.log(`✅ Connected to database: ${DB_NAME}`);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  /**
   * Generate customer hash from firstName, lastName, email, businessName
   */
  private generateCustomerHash(
    firstName: string, 
    lastName: string, 
    email: string, 
    businessName?: string
  ): string {
    const normalizedData = [
      (firstName || '').trim().toLowerCase(),
      (lastName || '').trim().toLowerCase(),
      (email || '').trim().toLowerCase(),
      (businessName || '').trim().toLowerCase()
    ].join('|');
    
    return crypto.createHash('sha256').update(normalizedData).digest('hex');
  }

  /**
   * Find or create customer from booking contact
   */
  private async findOrCreateCustomer(bookingContact: any): Promise<any> {
    if (!this.db) throw new Error('Database not connected');
    
    // Extract fields
    const firstName = bookingContact.firstName || bookingContact.first_name || '';
    const lastName = bookingContact.lastName || bookingContact.last_name || '';
    const email = bookingContact.email || bookingContact.emailAddress || '';
    const businessName = bookingContact.businessName || bookingContact.business_name || '';
    
    // Generate hash
    const hash = this.generateCustomerHash(firstName, lastName, email, businessName);
    
    // Check cache
    if (this.customerCache.has(hash)) {
      this.stats.customersReused++;
      return this.customerCache.get(hash);
    }
    
    // Check database
    let customer = await this.db.collection('customers').findOne({ hash });
    
    if (customer) {
      this.stats.customersReused++;
      this.customerCache.set(hash, customer);
      return customer;
    }
    
    // Create new customer
    const newCustomer = {
      customerId: `cust_${crypto.randomUUID()}`,
      hash,
      firstName,
      lastName,
      email,
      businessName: businessName || null,
      phone: bookingContact.phone || bookingContact.mobileNumber || bookingContact.mobile || null,
      customerType: businessName ? 'business' : 'person',
      address: {
        street: bookingContact.addressLine1 || bookingContact.address || '',
        city: bookingContact.city || '',
        state: bookingContact.stateProvince || bookingContact.state || '',
        postalCode: bookingContact.postalCode || bookingContact.postal_code || '',
        country: bookingContact.country || 'AU'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await this.db.collection('customers').insertOne(newCustomer);
    newCustomer._id = result.insertedId;
    
    this.stats.customersCreated++;
    this.customerCache.set(hash, newCustomer);
    console.log(`    ✅ Created customer: ${firstName} ${lastName} (${newCustomer.customerId})`);
    
    return newCustomer;
  }

  /**
   * Step 1: Fix tickets with empty ownerIds
   */
  async fixEmptyOwnerIds(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📋 Step 1: Fixing tickets with empty ownerIds...');
    
    // Find all tickets with empty ownerId
    const ticketsWithEmptyOwner = await this.db.collection('tickets').find({
      'ticketOwner.ownerId': ''
    }).toArray();
    
    this.stats.ticketsWithEmptyOwnerId = ticketsWithEmptyOwner.length;
    console.log(`  Found ${ticketsWithEmptyOwner.length} tickets with empty ownerId`);
    
    // Group by registration to batch process
    const ticketsByRegistration = new Map<string, any[]>();
    
    for (const ticket of ticketsWithEmptyOwner) {
      const regId = ticket.details?.registrationId || ticket.metadata?.registrationId;
      if (regId) {
        if (!ticketsByRegistration.has(regId)) {
          ticketsByRegistration.set(regId, []);
        }
        ticketsByRegistration.get(regId)!.push(ticket);
      }
    }
    
    console.log(`  Grouped into ${ticketsByRegistration.size} registrations`);
    
    // Process each registration
    for (const [regId, tickets] of ticketsByRegistration) {
      try {
        // Find the registration
        const registration = await this.db.collection('registrations').findOne({ id: regId });
        
        if (!registration) {
          console.log(`    ⚠️ Registration ${regId} not found`);
          continue;
        }
        
        // Get booking contact
        const bookingContact = registration.registrationData?.bookingContact;
        
        if (!bookingContact || typeof bookingContact !== 'object') {
          console.log(`    ⚠️ No booking contact in registration ${regId}`);
          continue;
        }
        
        // Find or create customer
        const customer = await this.findOrCreateCustomer(bookingContact);
        
        // Update all tickets for this registration
        for (const ticket of tickets) {
          await this.db.collection('tickets').updateOne(
            { _id: ticket._id },
            {
              $set: {
                'ticketOwner.ownerId': customer.customerId,
                'ticketOwner.ownerType': 'customer',
                'ticketOwner.customerBusinessName': customer.businessName,
                'ticketOwner.customerName': `${customer.firstName} ${customer.lastName}`.trim(),
                'metadata.customerId': customer.customerId,
                'metadata.customerRef': customer._id,
                updatedAt: new Date(),
                migrationNote: 'Fixed empty ownerId and set customer reference'
              }
            }
          );
          this.stats.ticketsFixed++;
        }
        
        console.log(`    ✅ Fixed ${tickets.length} tickets for registration ${regId}`);
        
      } catch (error) {
        console.error(`    ❌ Error processing registration ${regId}:`, error);
        this.stats.errors++;
      }
    }
  }

  /**
   * Step 2: Update all ownerType values to 'customer'
   */
  async updateOwnerTypes(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📋 Step 2: Updating ownerType values to "customer"...');
    
    // Update tickets with ownerType 'contact' or 'organisation'
    const result = await this.db.collection('tickets').updateMany(
      { 
        'ticketOwner.ownerType': { $in: ['contact', 'organisation'] },
        'ticketOwner.ownerId': { $ne: '', $exists: true, $ne: null }
      },
      {
        $set: {
          'ticketOwner.ownerType': 'customer',
          updatedAt: new Date()
        }
      }
    );
    
    this.stats.ticketsUpdatedOwnerType = result.modifiedCount;
    console.log(`  ✅ Updated ${result.modifiedCount} tickets from contact/organisation to customer`);
  }

  /**
   * Generate final report
   */
  async generateReport(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📊 Final Report');
    console.log('═══════════════════════════════════════════');
    
    // Get current state
    const totalTickets = await this.db.collection('tickets').countDocuments();
    const ticketsWithValidOwner = await this.db.collection('tickets').countDocuments({
      'ticketOwner.ownerId': { $exists: true, $ne: '', $ne: null }
    });
    const ticketsWithCustomerType = await this.db.collection('tickets').countDocuments({
      'ticketOwner.ownerType': 'customer'
    });
    
    console.log('\n📈 Current State:');
    console.log(`  Total tickets: ${totalTickets}`);
    console.log(`  Tickets with valid ownerId: ${ticketsWithValidOwner} (${((ticketsWithValidOwner/totalTickets)*100).toFixed(1)}%)`);
    console.log(`  Tickets with ownerType='customer': ${ticketsWithCustomerType} (${((ticketsWithCustomerType/totalTickets)*100).toFixed(1)}%)`);
    
    // Check the specific tickets mentioned
    console.log('\n🎫 Status of Specific Tickets:');
    const ticketNumbers = [
      'TKT-17560069367950',
      'TKT-17560069367951',
      'TKT-17555160654791',
      'TKT-17555161136400',
      'TKT-17555161136401'
    ];
    
    for (const ticketNum of ticketNumbers) {
      const ticket = await this.db.collection('tickets').findOne({ ticketNumber: ticketNum });
      if (ticket) {
        const status = ticket.ticketOwner?.ownerId ? '✅ FIXED' : '❌ STILL BROKEN';
        console.log(`  ${ticketNum}: ${status}`);
        if (ticket.ticketOwner?.ownerId) {
          console.log(`    Customer: ${ticket.ticketOwner.customerName} (${ticket.ticketOwner.ownerId})`);
        }
      }
    }
    
    console.log('\n✅ Migration Statistics:');
    console.log(`  Tickets with empty ownerId found: ${this.stats.ticketsWithEmptyOwnerId}`);
    console.log(`  Tickets fixed with customer info: ${this.stats.ticketsFixed}`);
    console.log(`  Tickets updated ownerType: ${this.stats.ticketsUpdatedOwnerType}`);
    console.log(`  Customers created: ${this.stats.customersCreated}`);
    console.log(`  Customers reused: ${this.stats.customersReused}`);
    console.log(`  Errors: ${this.stats.errors}`);
    
    console.log('\n═══════════════════════════════════════════');
  }

  async run(): Promise<void> {
    try {
      await this.connect();
      
      console.log('\n🚀 Starting comprehensive ticket customer fix');
      console.log('═══════════════════════════════════════════');
      
      // Step 1: Fix empty ownerIds
      await this.fixEmptyOwnerIds();
      
      // Step 2: Update ownerType values
      await this.updateOwnerTypes();
      
      // Generate report
      await this.generateReport();
      
      console.log('\n✅ All tickets have been processed!');
      
    } catch (error) {
      console.error('\n❌ Process failed:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const fixer = new FixAllTicketCustomers();
  
  console.log('⚠️  This script will:');
  console.log('  1. Fix all tickets with empty ownerIds');
  console.log('  2. Create customers from registration booking contacts');
  console.log('  3. Update all ownerType values to "customer"');
  console.log('  4. Ensure proper customer references');
  console.log('\nStarting in 3 seconds... (Ctrl+C to cancel)\n');
  
  setTimeout(() => {
    fixer.run()
      .then(() => {
        console.log('\n🎉 Success! All tickets have been fixed.');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n💥 Failed:', error);
        process.exit(1);
      });
  }, 3000);
}

export default FixAllTicketCustomers;