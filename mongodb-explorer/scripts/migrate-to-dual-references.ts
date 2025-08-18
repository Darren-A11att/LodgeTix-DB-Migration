#!/usr/bin/env tsx

/**
 * Migration Script: Add ObjectId References to Existing Data
 * 
 * This script adds missing ObjectId references to documents that only have business IDs.
 * It implements the dual reference architecture where both Business IDs and ObjectIds
 * are stored for all references.
 */

import { MongoClient, Db, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI_LODGETIX_SYNC || 
                    process.env.MONGODB_URI ||
                    'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';

interface MigrationStats {
  registrationsProcessed: number;
  ticketsUpdated: number;
  attendeesUpdated: number;
  customersUpdated: number;
  errors: number;
}

class DualReferenceMigration {
  private db: Db;
  private stats: MigrationStats = {
    registrationsProcessed: 0,
    ticketsUpdated: 0,
    attendeesUpdated: 0,
    customersUpdated: 0,
    errors: 0
  };

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Main migration process
   */
  async migrate(): Promise<void> {
    console.log('=== DUAL REFERENCE MIGRATION ===\n');
    console.log('This migration adds ObjectId references alongside existing business IDs.\n');

    // Step 1: Migrate registration references
    await this.migrateRegistrationReferences();

    // Step 2: Migrate ticket backward references
    await this.migrateTicketReferences();

    // Step 3: Migrate attendee backward references
    await this.migrateAttendeeReferences();

    // Step 4: Migrate customer references
    await this.migrateCustomerReferences();

    // Print summary
    this.printSummary();
  }

  /**
   * Add ObjectId references to registration metadata
   */
  async migrateRegistrationReferences(): Promise<void> {
    console.log('📋 MIGRATING REGISTRATION REFERENCES...\n');

    const registrations = await this.db.collection('import_registrations').find({
      'metadata.extractedTicketIds': { $exists: true }
    }).toArray();

    console.log(`Found ${registrations.length} registrations to process\n`);

    for (const reg of registrations) {
      try {
        const updates: any = {};
        
        // Add ticket ObjectIds if missing
        if (reg.metadata.extractedTicketIds && !reg.metadata.extractedTicketRefs) {
          const ticketRefs: ObjectId[] = [];
          
          for (const ticketId of reg.metadata.extractedTicketIds) {
            const ticket = await this.db.collection('import_tickets').findOne({ ticketId });
            if (ticket) {
              ticketRefs.push(ticket._id);
            }
          }
          
          if (ticketRefs.length > 0) {
            updates['metadata.extractedTicketRefs'] = ticketRefs;
            console.log(`  ✅ Added ${ticketRefs.length} ticket ObjectIds to registration ${reg.id}`);
          }
        }

        // Add attendee ObjectIds if missing
        if (reg.metadata.extractedAttendeeIds && !reg.metadata.extractedAttendeeRefs) {
          const attendeeRefs: ObjectId[] = [];
          
          for (const attendeeId of reg.metadata.extractedAttendeeIds) {
            const attendee = await this.db.collection('import_attendees').findOne({ attendeeId });
            if (attendee) {
              attendeeRefs.push(attendee._id);
            }
          }
          
          if (attendeeRefs.length > 0) {
            updates['metadata.extractedAttendeeRefs'] = attendeeRefs;
            console.log(`  ✅ Added ${attendeeRefs.length} attendee ObjectIds to registration ${reg.id}`);
          }
        }

        // Add customer ObjectId if missing
        if (reg.metadata.extractedCustomerId && !reg.metadata.extractedCustomerRef) {
          const customer = await this.db.collection('import_customers').findOne({ 
            customerId: reg.metadata.extractedCustomerId 
          });
          
          if (customer) {
            updates['metadata.extractedCustomerRef'] = customer._id;
            console.log(`  ✅ Added customer ObjectId to registration ${reg.id}`);
          }
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          await this.db.collection('import_registrations').updateOne(
            { _id: reg._id },
            { $set: updates }
          );
          this.stats.registrationsProcessed++;
        }

      } catch (error) {
        console.error(`  ❌ Error processing registration ${reg.id}:`, error);
        this.stats.errors++;
      }
    }

    console.log(`\n✅ Processed ${this.stats.registrationsProcessed} registrations\n`);
  }

  /**
   * Add ObjectId backward references to tickets
   */
  async migrateTicketReferences(): Promise<void> {
    console.log('🎫 MIGRATING TICKET REFERENCES...\n');

    const tickets = await this.db.collection('import_tickets').find({
      'metadata.registrationId': { $exists: true },
      'metadata.registrationRef': { $exists: false }
    }).toArray();

    console.log(`Found ${tickets.length} tickets to process\n`);

    for (const ticket of tickets) {
      try {
        const updates: any = {};

        // Add registration ObjectId
        if (ticket.metadata?.registrationId && !ticket.metadata?.registrationRef) {
          const registration = await this.db.collection('import_registrations').findOne({ 
            id: ticket.metadata.registrationId 
          });
          
          if (registration) {
            updates['metadata.registrationRef'] = registration._id;
          }
        }

        // Add attendee ObjectId
        if (ticket.metadata?.attendeeId && !ticket.metadata?.attendeeRef) {
          const attendee = await this.db.collection('import_attendees').findOne({ 
            attendeeId: ticket.metadata.attendeeId 
          });
          
          if (attendee) {
            updates['metadata.attendeeRef'] = attendee._id;
          }
        }

        // Add customer ObjectId
        if (ticket.metadata?.customerId && !ticket.metadata?.customerRef) {
          const customer = await this.db.collection('import_customers').findOne({ 
            customerId: ticket.metadata.customerId 
          });
          
          if (customer) {
            updates['metadata.customerRef'] = customer._id;
          }
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          await this.db.collection('import_tickets').updateOne(
            { _id: ticket._id },
            { $set: updates }
          );
          this.stats.ticketsUpdated++;
          
          if (this.stats.ticketsUpdated % 10 === 0) {
            console.log(`  ✅ Updated ${this.stats.ticketsUpdated} tickets...`);
          }
        }

      } catch (error) {
        console.error(`  ❌ Error processing ticket ${ticket.ticketId}:`, error);
        this.stats.errors++;
      }
    }

    console.log(`\n✅ Updated ${this.stats.ticketsUpdated} tickets\n`);
  }

  /**
   * Add ObjectId backward references to attendees
   */
  async migrateAttendeeReferences(): Promise<void> {
    console.log('👥 MIGRATING ATTENDEE REFERENCES...\n');

    const attendees = await this.db.collection('import_attendees').find({
      'metadata.registrationId': { $exists: true },
      'metadata.registrationRef': { $exists: false }
    }).toArray();

    console.log(`Found ${attendees.length} attendees to process\n`);

    for (const attendee of attendees) {
      try {
        const updates: any = {};

        // Add registration ObjectId
        if (attendee.metadata?.registrationId && !attendee.metadata?.registrationRef) {
          const registration = await this.db.collection('import_registrations').findOne({ 
            id: attendee.metadata.registrationId 
          });
          
          if (registration) {
            updates['metadata.registrationRef'] = registration._id;
          }
        }

        // Add ticket ObjectIds if missing
        if (attendee.metadata?.associatedTicketIds && !attendee.metadata?.associatedTicketRefs) {
          const ticketRefs: ObjectId[] = [];
          
          for (const ticketId of attendee.metadata.associatedTicketIds) {
            const ticket = await this.db.collection('import_tickets').findOne({ ticketId });
            if (ticket) {
              ticketRefs.push(ticket._id);
            }
          }
          
          if (ticketRefs.length > 0) {
            updates['metadata.associatedTicketRefs'] = ticketRefs;
          }
        }

        // Add customer ObjectId
        if (attendee.metadata?.customerId && !attendee.metadata?.customerRef) {
          const customer = await this.db.collection('import_customers').findOne({ 
            customerId: attendee.metadata.customerId 
          });
          
          if (customer) {
            updates['metadata.customerRef'] = customer._id;
          }
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          await this.db.collection('import_attendees').updateOne(
            { _id: attendee._id },
            { $set: updates }
          );
          this.stats.attendeesUpdated++;
          
          if (this.stats.attendeesUpdated % 10 === 0) {
            console.log(`  ✅ Updated ${this.stats.attendeesUpdated} attendees...`);
          }
        }

      } catch (error) {
        console.error(`  ❌ Error processing attendee ${attendee.attendeeId}:`, error);
        this.stats.errors++;
      }
    }

    console.log(`\n✅ Updated ${this.stats.attendeesUpdated} attendees\n`);
  }

  /**
   * Update customer references in registrations
   */
  async migrateCustomerReferences(): Promise<void> {
    console.log('🏢 MIGRATING CUSTOMER REFERENCES...\n');

    const registrations = await this.db.collection('import_registrations').find({
      'registrationData.bookingContactRef': { $exists: true },
      'registrationData.bookingContactObjectRef': { $exists: false }
    }).toArray();

    console.log(`Found ${registrations.length} registrations with customer references to update\n`);

    for (const reg of registrations) {
      try {
        const customerId = reg.registrationData.bookingContactRef;
        
        if (customerId && typeof customerId === 'string') {
          const customer = await this.db.collection('import_customers').findOne({ 
            customerId: customerId 
          });
          
          if (customer) {
            await this.db.collection('import_registrations').updateOne(
              { _id: reg._id },
              { 
                $set: { 
                  'registrationData.bookingContactObjectRef': customer._id 
                } 
              }
            );
            this.stats.customersUpdated++;
            console.log(`  ✅ Added customer ObjectId reference for registration ${reg.id}`);
          }
        }

      } catch (error) {
        console.error(`  ❌ Error processing registration ${reg.id}:`, error);
        this.stats.errors++;
      }
    }

    console.log(`\n✅ Updated ${this.stats.customersUpdated} customer references\n`);
  }

  /**
   * Print migration summary
   */
  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Registrations processed: ${this.stats.registrationsProcessed}`);
    console.log(`Tickets updated: ${this.stats.ticketsUpdated}`);
    console.log(`Attendees updated: ${this.stats.attendeesUpdated}`);
    console.log(`Customer references updated: ${this.stats.customersUpdated}`);
    console.log(`Errors encountered: ${this.stats.errors}`);
    
    const total = this.stats.registrationsProcessed + 
                  this.stats.ticketsUpdated + 
                  this.stats.attendeesUpdated + 
                  this.stats.customersUpdated;
    
    if (this.stats.errors === 0) {
      console.log(`\n✅ SUCCESS: Migration completed with ${total} updates`);
    } else {
      console.log(`\n⚠️ COMPLETED WITH ERRORS: ${total} updates made, ${this.stats.errors} errors`);
    }
  }
}

/**
 * Main execution
 */
async function runMigration(): Promise<void> {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('lodgetix');
    const migration = new DualReferenceMigration(db);
    
    await migration.migrate();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration crashed:', error);
      process.exit(1);
    });
}

export { DualReferenceMigration };