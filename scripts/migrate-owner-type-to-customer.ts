#!/usr/bin/env npx tsx
/**
 * Migration script to update ownerType from 'organisation'/'contact' to 'customer'
 * and ensure proper customer references in tickets and registrations
 */

import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'lodgetix_reconcile';

class OwnerTypeMigration {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private stats = {
    ticketsUpdated: 0,
    ticketsSkipped: 0,
    registrationsUpdated: 0,
    registrationsSkipped: 0,
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
   * Update tickets with ownerType 'organisation' or 'contact' to 'customer'
   */
  async migrateTickets(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📋 Starting ticket migration...');
    
    // Count tickets that need updating
    const ticketsToUpdate = await this.db.collection('tickets').countDocuments({
      ownerType: { $in: ['organisation', 'contact'] }
    });
    
    const importTicketsToUpdate = await this.db.collection('import_tickets').countDocuments({
      ownerType: { $in: ['organisation', 'contact'] }
    });
    
    console.log(`  Found ${ticketsToUpdate} tickets in 'tickets' collection to update`);
    console.log(`  Found ${importTicketsToUpdate} tickets in 'import_tickets' collection to update`);
    
    // Update tickets collection
    if (ticketsToUpdate > 0) {
      const result = await this.db.collection('tickets').updateMany(
        { ownerType: { $in: ['organisation', 'contact'] } },
        { 
          $set: { 
            ownerType: 'customer',
            updatedAt: new Date(),
            migrationNote: 'Updated ownerType from organisation/contact to customer'
          } 
        }
      );
      
      this.stats.ticketsUpdated += result.modifiedCount;
      console.log(`  ✅ Updated ${result.modifiedCount} tickets in 'tickets' collection`);
    }
    
    // Update import_tickets collection
    if (importTicketsToUpdate > 0) {
      const result = await this.db.collection('import_tickets').updateMany(
        { ownerType: { $in: ['organisation', 'contact'] } },
        { 
          $set: { 
            ownerType: 'customer',
            updatedAt: new Date(),
            migrationNote: 'Updated ownerType from organisation/contact to customer'
          } 
        }
      );
      
      this.stats.ticketsUpdated += result.modifiedCount;
      console.log(`  ✅ Updated ${result.modifiedCount} tickets in 'import_tickets' collection`);
    }
    
    // Log tickets with other ownerTypes for information
    const otherOwnerTypes = await this.db.collection('tickets').distinct('ownerType', {
      ownerType: { $nin: ['customer', 'organisation', 'contact'] }
    });
    
    if (otherOwnerTypes.length > 0) {
      console.log(`  ℹ️  Other ownerType values found (not modified): ${otherOwnerTypes.join(', ')}`);
      for (const type of otherOwnerTypes) {
        const count = await this.db.collection('tickets').countDocuments({ ownerType: type });
        console.log(`     - ${type}: ${count} tickets`);
      }
    }
  }

  /**
   * Ensure registrations have proper customer references
   */
  async updateRegistrationCustomerReferences(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📋 Checking registration customer references...');
    
    // Find registrations that have bookingContact but no customer reference
    const registrationsNeedingUpdate = await this.db.collection('registrations').countDocuments({
      'registrationData.bookingContact': { $exists: true },
      'registrationData.bookingContactRef': { $exists: false }
    });
    
    const importRegistrationsNeedingUpdate = await this.db.collection('import_registrations').countDocuments({
      'registrationData.bookingContact': { $exists: true },
      'registrationData.bookingContactRef': { $exists: false }
    });
    
    console.log(`  Found ${registrationsNeedingUpdate} registrations in 'registrations' needing customer reference`);
    console.log(`  Found ${importRegistrationsNeedingUpdate} registrations in 'import_registrations' needing customer reference`);
    
    // Note: Actual customer reference updates would need to match customers based on booking contact data
    // This would require looking up customers by hash or creating them if they don't exist
    // For now, we'll just report the status
    
    if (registrationsNeedingUpdate > 0 || importRegistrationsNeedingUpdate > 0) {
      console.log(`  ⚠️  Note: Run the payment sync to create proper customer references for these registrations`);
    }
  }

  /**
   * Generate report of current state
   */
  async generateReport(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n📊 Migration Report:');
    console.log('═══════════════════════════════════════════');
    
    // Tickets summary
    const ticketsSummary = await this.db.collection('tickets').aggregate([
      { $group: { _id: '$ownerType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('\n📎 Tickets by ownerType:');
    for (const item of ticketsSummary) {
      console.log(`  ${item._id || 'null'}: ${item.count} tickets`);
    }
    
    // Import tickets summary
    const importTicketsSummary = await this.db.collection('import_tickets').aggregate([
      { $group: { _id: '$ownerType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    if (importTicketsSummary.length > 0) {
      console.log('\n📎 Import Tickets by ownerType:');
      for (const item of importTicketsSummary) {
        console.log(`  ${item._id || 'null'}: ${item.count} tickets`);
      }
    }
    
    // Customers summary
    const customersCount = await this.db.collection('customers').countDocuments({});
    const importCustomersCount = await this.db.collection('import_customers').countDocuments({});
    
    console.log('\n👥 Customers:');
    console.log(`  Production customers: ${customersCount}`);
    console.log(`  Import customers: ${importCustomersCount}`);
    
    // Migration stats
    console.log('\n✅ Migration Statistics:');
    console.log(`  Tickets updated: ${this.stats.ticketsUpdated}`);
    console.log(`  Tickets skipped: ${this.stats.ticketsSkipped}`);
    console.log(`  Registrations updated: ${this.stats.registrationsUpdated}`);
    console.log(`  Errors: ${this.stats.errors}`);
    
    console.log('\n═══════════════════════════════════════════');
  }

  async run(): Promise<void> {
    try {
      await this.connect();
      
      console.log('\n🚀 Starting ownerType migration to "customer"');
      console.log('═══════════════════════════════════════════');
      
      // Show current state
      console.log('\n📸 Current State:');
      await this.generateReport();
      
      // Perform migrations
      await this.migrateTickets();
      await this.updateRegistrationCustomerReferences();
      
      // Show final state
      console.log('\n📸 Final State:');
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
  const migration = new OwnerTypeMigration();
  
  migration.run()
    .then(() => {
      console.log('\n🎉 Migration script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error);
      process.exit(1);
    });
}

export default OwnerTypeMigration;