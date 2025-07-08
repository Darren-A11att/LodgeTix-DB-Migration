#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const testOnly = args.includes('--test-only');
const confirmationNumber = args.find(arg => arg.startsWith('--reg='))?.split('=')[1];

async function migrateLegacyRegistrations() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    console.log('Mode:', dryRun ? 'DRY RUN' : 'LIVE UPDATE');
    if (testOnly) console.log('Testing on single registration only');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const registrationsCollection = db.collection('registrations');

    // Find the registrations to migrate
    let query = {
      registrationType: 'individuals',
      $and: [
        {
          $or: [
            { attendeeCount: { $exists: false } },
            { attendeeCount: 0 },
            { attendee_count: 0 }
          ]
        },
        {
          $or: [
            { 'registrationData.primaryAttendee': { $exists: true } },
            { 'registrationData.tickets': { $exists: true } }
          ]
        }
      ]
    };

    if (testOnly && confirmationNumber) {
      query = { confirmationNumber };
    } else if (testOnly) {
      query.confirmationNumber = 'IND-616604CO'; // Default test registration
    }

    const registrationsToMigrate = await registrationsCollection.find(query).toArray();
    console.log(`\nFound ${registrationsToMigrate.length} registrations to migrate`);

    if (registrationsToMigrate.length === 0) {
      console.log('No registrations need migration');
      return;
    }

    // Process each registration
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const registration of registrationsToMigrate) {
      try {
        console.log(`\nProcessing: ${registration.confirmationNumber || registration.confirmation_number || registration._id}`);
        
        const updates = {};
        const regData = registration.registrationData || {};
        
        // 1. Transform tickets array to simple format
        if (regData.tickets && Array.isArray(regData.tickets)) {
          console.log(`  - Found ${regData.tickets.length} tickets to transform`);
          
          const simpleTickets = [];
          
          // Group tickets by eventTicketId to aggregate quantities
          const ticketMap = new Map();
          
          regData.tickets.forEach(ticket => {
            const eventTicketId = ticket.eventTicketId || ticket.ticketDefinitionId;
            if (!eventTicketId) {
              console.warn(`    Warning: Ticket without eventTicketId found`);
              return;
            }
            
            if (ticketMap.has(eventTicketId)) {
              // Increment quantity for existing ticket
              const existing = ticketMap.get(eventTicketId);
              existing.quantity += (ticket.quantity || 1);
            } else {
              // Add new ticket
              ticketMap.set(eventTicketId, {
                eventTicketId: eventTicketId,
                name: ticket.name || 'Unknown Ticket',
                price: typeof ticket.price === 'object' && ticket.price.$numberDecimal 
                  ? parseFloat(ticket.price.$numberDecimal)
                  : (ticket.price || 0),
                quantity: ticket.quantity || 1
              });
            }
          });
          
          // Convert map to array
          simpleTickets.push(...ticketMap.values());
          
          updates['registrationData.tickets'] = simpleTickets;
          console.log(`  - Transformed to ${simpleTickets.length} simplified tickets`);
        }

        // 2. Consolidate attendees
        const attendees = [];
        
        if (regData.primaryAttendee) {
          attendees.push(regData.primaryAttendee);
          console.log(`  - Added primary attendee: ${regData.primaryAttendee.firstName} ${regData.primaryAttendee.lastName}`);
        }
        
        if (regData.additionalAttendees && Array.isArray(regData.additionalAttendees)) {
          attendees.push(...regData.additionalAttendees);
          console.log(`  - Added ${regData.additionalAttendees.length} additional attendees`);
        }
        
        if (attendees.length > 0) {
          updates['registrationData.attendees'] = attendees;
          
          // Remove old fields
          updates['registrationData.primaryAttendee'] = '';
          updates['registrationData.additionalAttendees'] = '';
        }

        // 3. Update attendeeCount at root level
        const newAttendeeCount = attendees.length;
        updates.attendeeCount = newAttendeeCount;
        console.log(`  - Set attendeeCount to ${newAttendeeCount}`);

        // Show preview in dry-run mode
        if (dryRun) {
          console.log('\n  Preview of updates:');
          console.log('  - New tickets format:', JSON.stringify(updates['registrationData.tickets'] || [], null, 2).split('\n').slice(0, 10).join('\n'));
          console.log(`  - Attendees count: ${attendees.length}`);
          console.log(`  - Will remove primaryAttendee and additionalAttendees fields`);
        } else {
          // Apply updates
          const updateOperation = {
            $set: updates
          };
          
          // Use $unset to remove fields
          if (updates['registrationData.primaryAttendee'] === '') {
            delete updates['registrationData.primaryAttendee'];
            delete updates['registrationData.additionalAttendees'];
            updateOperation.$unset = {
              'registrationData.primaryAttendee': '',
              'registrationData.additionalAttendees': ''
            };
          }
          
          const result = await registrationsCollection.updateOne(
            { _id: registration._id },
            updateOperation
          );
          
          if (result.modifiedCount > 0) {
            console.log('  ✓ Successfully migrated');
            successCount++;
          } else {
            console.log('  ! No changes made');
          }
        }

      } catch (error) {
        console.error(`  ✗ Error processing registration:`, error.message);
        errors.push({ 
          registration: registration.confirmationNumber || registration._id, 
          error: error.message 
        });
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    if (dryRun) {
      console.log('DRY RUN - No actual changes were made');
    }
    console.log(`Total registrations processed: ${registrationsToMigrate.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(err => {
        console.log(`  - ${err.registration}: ${err.error}`);
      });
    }

    // In dry-run mode, save a sample of the transformed data
    if (dryRun && registrationsToMigrate.length > 0) {
      const sampleFile = path.join(__dirname, 'migration-preview.json');
      fs.writeFileSync(sampleFile, JSON.stringify({
        mode: 'dry-run',
        timestamp: new Date().toISOString(),
        sampleCount: Math.min(3, registrationsToMigrate.length),
        samples: registrationsToMigrate.slice(0, 3).map(reg => ({
          confirmationNumber: reg.confirmationNumber,
          original: {
            hasTickets: !!reg.registrationData?.tickets,
            ticketCount: reg.registrationData?.tickets?.length || 0,
            hasPrimaryAttendee: !!reg.registrationData?.primaryAttendee,
            additionalAttendeesCount: reg.registrationData?.additionalAttendees?.length || 0,
            attendeeCount: reg.attendeeCount || 0
          },
          wouldBecome: {
            attendeeCount: (reg.registrationData?.primaryAttendee ? 1 : 0) + 
                          (reg.registrationData?.additionalAttendees?.length || 0),
            hasAttendees: true,
            hasSimpleTickets: true
          }
        }))
      }, null, 2));
      console.log(`\nPreview saved to: ${sampleFile}`);
    }

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node migrate-legacy-registrations.js [options]

Options:
  --dry-run      Preview changes without applying them
  --test-only    Test on a single registration only
  --reg=XXX      Specify registration confirmation number for test
  --help         Show this help message

Examples:
  node migrate-legacy-registrations.js --dry-run
  node migrate-legacy-registrations.js --test-only --reg=IND-616604CO
  node migrate-legacy-registrations.js

This script migrates legacy registration formats to the current standard format.
  `);
  process.exit(0);
}

// Run migration
migrateLegacyRegistrations();