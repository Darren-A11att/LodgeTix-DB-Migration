#!/usr/bin/env npx tsx
/**
 * Script to fix orphaned tickets that have no customer information
 * This will attempt to link tickets to customers through various methods
 */

import { MongoClient, Db, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'lodgetix'; // Using lodgetix database

class FixOrphanedTickets {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  
  private stats = {
    ticketsProcessed: 0,
    ticketsFixed: 0,
    ticketsSkipped: 0,
    customersCreated: 0,
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
   * Generate customer hash
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
   * Fix tickets with registration IDs
   */
  async fixTicketsWithRegistrations(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📋 Fixing tickets that have registration IDs...');
    
    // Find tickets with registrationId but no ownerId
    const ticketsWithReg = await this.db.collection('tickets').find({
      registrationId: { $exists: true, $ne: null, $ne: '' },
      $or: [
        { ownerId: { $exists: false } },
        { ownerId: null },
        { ownerId: '' }
      ]
    }).toArray();
    
    console.log(`  Found ${ticketsWithReg.length} tickets with registrations but no owner`);
    
    for (const ticket of ticketsWithReg) {
      try {
        // Find the registration
        const registration = await this.db.collection('registrations').findOne({ 
          id: ticket.registrationId 
        });
        
        if (!registration) {
          console.log(`    ⚠️ Registration ${ticket.registrationId} not found for ticket ${ticket.ticketId}`);
          this.stats.ticketsSkipped++;
          continue;
        }
        
        // Get booking contact
        const bookingContact = registration.registrationData?.bookingContact || 
                              registration.registration_data?.bookingContact;
        
        if (!bookingContact || typeof bookingContact !== 'object') {
          console.log(`    ⚠️ No booking contact in registration ${ticket.registrationId}`);
          this.stats.ticketsSkipped++;
          continue;
        }
        
        // Generate customer hash
        const hash = this.generateCustomerHash(
          bookingContact.firstName || bookingContact.first_name || '',
          bookingContact.lastName || bookingContact.last_name || '',
          bookingContact.email || '',
          bookingContact.businessName || bookingContact.business_name || ''
        );
        
        // Find or create customer
        let customer = await this.db.collection('customers').findOne({ hash });
        
        if (!customer) {
          // Create new customer
          const newCustomer = {
            customerId: `cust_${crypto.randomUUID()}`,
            hash,
            firstName: bookingContact.firstName || bookingContact.first_name || '',
            lastName: bookingContact.lastName || bookingContact.last_name || '',
            email: bookingContact.email || '',
            businessName: bookingContact.businessName || bookingContact.business_name || null,
            phone: bookingContact.phone || bookingContact.mobile || null,
            customerType: bookingContact.businessName ? 'business' : 'person',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const result = await this.db.collection('customers').insertOne(newCustomer);
          customer = { ...newCustomer, _id: result.insertedId };
          this.stats.customersCreated++;
          console.log(`    ✅ Created customer: ${customer.firstName} ${customer.lastName}`);
        }
        
        // Update ticket with customer info
        await this.db.collection('tickets').updateOne(
          { _id: ticket._id },
          {
            $set: {
              ownerType: 'customer',
              ownerId: customer.customerId,
              ticketOwner: {
                ownerId: customer.customerId,
                ownerType: 'customer',
                customerBusinessName: customer.businessName,
                customerName: `${customer.firstName} ${customer.lastName}`.trim()
              },
              updatedAt: new Date(),
              migrationNote: 'Fixed orphaned ticket with customer info'
            }
          }
        );
        
        this.stats.ticketsFixed++;
        console.log(`    ✅ Fixed ticket ${ticket.ticketId}`);
        
      } catch (error) {
        console.error(`    ❌ Error processing ticket ${ticket.ticketId}:`, error);
        this.stats.errors++;
      }
      
      this.stats.ticketsProcessed++;
    }
  }

  /**
   * Fix tickets without registrations by trying to match patterns
   */
  async fixOrphanedTicketsWithoutRegistrations(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📋 Processing completely orphaned tickets...');
    
    // Find tickets with no registration and no owner
    const orphanedTickets = await this.db.collection('tickets').find({
      $or: [
        { registrationId: { $exists: false } },
        { registrationId: null },
        { registrationId: '' }
      ],
      $or: [
        { ownerId: { $exists: false } },
        { ownerId: null },
        { ownerId: '' }
      ]
    }).limit(100).toArray(); // Process in batches
    
    console.log(`  Found ${orphanedTickets.length} completely orphaned tickets (batch of 100)`);
    
    // For these, we'll need to set a default owner type
    // Since we can't determine the customer, we'll mark them for manual review
    
    for (const ticket of orphanedTickets) {
      await this.db.collection('tickets').updateOne(
        { _id: ticket._id },
        {
          $set: {
            ownerType: 'unassigned',
            ownerId: null,
            needsManualReview: true,
            updatedAt: new Date(),
            migrationNote: 'Orphaned ticket - needs manual review'
          }
        }
      );
      this.stats.ticketsProcessed++;
    }
    
    console.log(`  ⚠️ Marked ${orphanedTickets.length} tickets for manual review`);
  }

  /**
   * Update all tickets to use new ownerType
   */
  async updateOwnerTypes(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📋 Updating ownerType values...');
    
    // Update organisation/contact to customer
    const result = await this.db.collection('tickets').updateMany(
      { ownerType: { $in: ['organisation', 'contact'] } },
      {
        $set: {
          ownerType: 'customer',
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`  ✅ Updated ${result.modifiedCount} tickets from organisation/contact to customer`);
  }

  /**
   * Generate report
   */
  async generateReport(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📊 Final Report');
    console.log('═══════════════════════════════════════════');
    
    // Get updated statistics
    const totalTickets = await this.db.collection('tickets').countDocuments();
    const ticketsWithOwner = await this.db.collection('tickets').countDocuments({
      ownerId: { $exists: true, $ne: null, $ne: '' }
    });
    const ticketsWithoutOwner = totalTickets - ticketsWithOwner;
    
    console.log('\n📈 Ticket Statistics:');
    console.log(`  Total tickets: ${totalTickets}`);
    console.log(`  Tickets with owner: ${ticketsWithOwner}`);
    console.log(`  Tickets without owner: ${ticketsWithoutOwner}`);
    console.log(`  Completion rate: ${((ticketsWithOwner / totalTickets) * 100).toFixed(2)}%`);
    
    // Owner type distribution
    const ownerTypes = await this.db.collection('tickets').aggregate([
      { $group: { _id: '$ownerType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('\n🏷️ Tickets by Owner Type:');
    ownerTypes.forEach(type => {
      console.log(`  ${type._id || 'null'}: ${type.count} tickets`);
    });
    
    console.log('\n✅ Migration Statistics:');
    console.log(`  Tickets processed: ${this.stats.ticketsProcessed}`);
    console.log(`  Tickets fixed: ${this.stats.ticketsFixed}`);
    console.log(`  Tickets skipped: ${this.stats.ticketsSkipped}`);
    console.log(`  Customers created: ${this.stats.customersCreated}`);
    console.log(`  Errors: ${this.stats.errors}`);
    
    console.log('\n═══════════════════════════════════════════');
  }

  async run(): Promise<void> {
    try {
      await this.connect();
      
      console.log('\n🚀 Starting to fix orphaned tickets');
      console.log('═══════════════════════════════════════════');
      
      // Step 1: Fix tickets that have registration IDs
      await this.fixTicketsWithRegistrations();
      
      // Step 2: Update owner types
      await this.updateOwnerTypes();
      
      // Step 3: Handle completely orphaned tickets
      await this.fixOrphanedTicketsWithoutRegistrations();
      
      // Generate report
      await this.generateReport();
      
      console.log('\n✅ Process completed!');
      
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
  const fixer = new FixOrphanedTickets();
  
  console.log('⚠️  This script will:');
  console.log('  1. Link tickets to customers using registration data');
  console.log('  2. Create missing customers from booking contacts');
  console.log('  3. Update ownerType to "customer"');
  console.log('  4. Mark orphaned tickets for manual review');
  console.log('\nStarting in 3 seconds... (Ctrl+C to cancel)\n');
  
  setTimeout(() => {
    fixer.run()
      .then(() => {
        console.log('\n🎉 All done!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n💥 Failed:', error);
        process.exit(1);
      });
  }, 3000);
}

export default FixOrphanedTickets;