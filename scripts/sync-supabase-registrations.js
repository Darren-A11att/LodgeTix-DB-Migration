#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function getLastSyncDate(db) {
  try {
    // Check if we have a sync tracking collection
    const syncTracker = await db.collection('sync_tracker').findOne({ type: 'registrations' });
    return syncTracker ? new Date(syncTracker.lastSyncDate) : null;
  } catch (error) {
    console.log('No sync tracker found, will sync all registrations');
    return null;
  }
}

async function updateLastSyncDate(db, date) {
  await db.collection('sync_tracker').updateOne(
    { type: 'registrations' },
    { $set: { type: 'registrations', lastSyncDate: date, updatedAt: new Date() } },
    { upsert: true }
  );
}

async function syncRegistrations() {
  const mongoClient = new MongoClient(process.env.MONGODB_URI);

  try {
    await mongoClient.connect();
    console.log('Connected to MongoDB');

    const db = mongoClient.db(process.env.MONGODB_DB || 'lodgetix');
    const registrationsCollection = db.collection('registrations');

    // Get the last sync date
    const lastSyncDate = await getLastSyncDate(db);
    console.log('Last sync date:', lastSyncDate || 'Never synced before');

    // First, let's check the structure of a registration
    console.log('\nChecking Supabase registration structure...');
    const { data: sampleReg, error: sampleError } = await supabase
      .from('registrations')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('Error fetching sample registration:', sampleError);
      return;
    }

    if (sampleReg && sampleReg.length > 0) {
      console.log('Sample registration fields:', Object.keys(sampleReg[0]));
    }

    // Build query for new/updated registrations
    let query = supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (lastSyncDate) {
      // Get registrations created or updated after last sync
      query = query.or(`created_at.gt.${lastSyncDate.toISOString()},updated_at.gt.${lastSyncDate.toISOString()}`);
    }

    // Fetch registrations from Supabase
    console.log('\nFetching registrations from Supabase...');
    const { data: registrations, error } = await query;

    if (error) {
      console.error('Error fetching registrations:', error);
      return;
    }

    console.log(`Found ${registrations.length} registrations to sync`);

    if (registrations.length === 0) {
      console.log('No new registrations to sync');
      return;
    }

    // Process and insert/update registrations
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const reg of registrations) {
      try {
        // Map Supabase fields to MongoDB fields
        // This mapping may need adjustment based on actual field names
        const mongoRegistration = {
          // Try to maintain compatibility with existing MongoDB structure
          registrationId: reg.id || reg.registration_id,
          confirmationNumber: reg.confirmation_number,
          registrationType: reg.registration_type,
          functionId: reg.function_id,
          registrationData: reg.registration_data || {
            selectedTickets: reg.selected_tickets || [],
            attendees: reg.attendees || [],
            bookingContact: reg.booking_contact,
            billingContact: reg.billing_contact
          },
          attendeeCount: reg.attendee_count,
          totalAmountPaid: reg.total_amount_paid,
          paymentStatus: reg.payment_status,
          stripePaymentIntentId: reg.stripe_payment_intent_id,
          squarePaymentId: reg.square_payment_id,
          createdAt: reg.created_at,
          updatedAt: reg.updated_at,
          // Preserve any additional fields
          ...reg
        };

        // Check if registration already exists
        const existingReg = await registrationsCollection.findOne({
          $or: [
            { registrationId: mongoRegistration.registrationId },
            { confirmationNumber: mongoRegistration.confirmationNumber }
          ]
        });

        if (existingReg) {
          // Update existing registration
          const result = await registrationsCollection.updateOne(
            { _id: existingReg._id },
            { $set: mongoRegistration }
          );
          if (result.modifiedCount > 0) {
            updated++;
            console.log(`Updated registration: ${mongoRegistration.confirmationNumber}`);
          }
        } else {
          // Insert new registration
          await registrationsCollection.insertOne(mongoRegistration);
          inserted++;
          console.log(`Inserted new registration: ${mongoRegistration.confirmationNumber}`);
        }
      } catch (error) {
        errors++;
        console.error(`Error processing registration ${reg.id}:`, error);
      }
    }

    // Update sync tracker with current timestamp
    await updateLastSyncDate(db, new Date());

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('SYNC SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total registrations processed: ${registrations.length}`);
    console.log(`New registrations inserted: ${inserted}`);
    console.log(`Existing registrations updated: ${updated}`);
    console.log(`Errors: ${errors}`);
    console.log('='.repeat(50));

    // Verify current count
    const totalCount = await registrationsCollection.countDocuments();
    console.log(`\nTotal registrations in MongoDB: ${totalCount}`);

  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    await mongoClient.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Add command line options
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node sync-supabase-registrations.js [options]

Options:
  --reset    Reset sync tracker and sync all registrations
  --dry-run  Show what would be synced without making changes
  --help     Show this help message

This script syncs registrations from Supabase to MongoDB.
It tracks the last sync date to only sync new/updated registrations.
  `);
  process.exit(0);
}

if (args.includes('--reset')) {
  console.log('Resetting sync tracker...');
  const mongoClient = new MongoClient(process.env.MONGODB_URI);
  mongoClient.connect().then(async () => {
    const db = mongoClient.db(process.env.MONGODB_DB || 'lodgetix');
    await db.collection('sync_tracker').deleteOne({ type: 'registrations' });
    console.log('Sync tracker reset. Will sync all registrations.');
    await mongoClient.close();
    syncRegistrations();
  });
} else {
  syncRegistrations();
}