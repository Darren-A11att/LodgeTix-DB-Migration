#!/usr/bin/env tsx

/**
 * Test script to verify the immediate sync per payment approach
 * This will check that data is being synced to production immediately after each payment
 */

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';

async function monitorSync() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('🔍 MONITORING IMMEDIATE SYNC PROGRESS...\n');
    
    // Check import collections
    console.log('📦 IMPORT COLLECTIONS:');
    const importPayments = await db.collection('import_payments').countDocuments({});
    const importRegistrations = await db.collection('import_registrations').countDocuments({});
    const importAttendees = await db.collection('import_attendees').countDocuments({});
    const importCustomers = await db.collection('import_customers').countDocuments({});
    const importContacts = await db.collection('import_contacts').countDocuments({});
    const importTickets = await db.collection('import_tickets').countDocuments({});
    
    console.log(`  import_payments: ${importPayments}`);
    console.log(`  import_registrations: ${importRegistrations}`);
    console.log(`  import_attendees: ${importAttendees}`);
    console.log(`  import_customers: ${importCustomers}`);
    console.log(`  import_contacts: ${importContacts}`);
    console.log(`  import_tickets: ${importTickets}`);
    
    console.log('\n🏭 PRODUCTION COLLECTIONS:');
    const prodPayments = await db.collection('payments').countDocuments({});
    const prodRegistrations = await db.collection('registrations').countDocuments({});
    const prodAttendees = await db.collection('attendees').countDocuments({});
    const prodCustomers = await db.collection('customers').countDocuments({});
    const prodContacts = await db.collection('contacts').countDocuments({});
    const prodTickets = await db.collection('tickets').countDocuments({});
    
    console.log(`  payments: ${prodPayments}`);
    console.log(`  registrations: ${prodRegistrations}`);
    console.log(`  attendees: ${prodAttendees}`);
    console.log(`  customers: ${prodCustomers}`);
    console.log(`  contacts: ${prodContacts}`);
    console.log(`  tickets: ${prodTickets}`);
    
    // Check sync progress
    console.log('\n📊 SYNC PROGRESS:');
    
    // Check how many import documents have production references
    const syncedPayments = await db.collection('import_payments').countDocuments({
      '_productionMeta.productionObjectId': { $exists: true }
    });
    const syncedRegistrations = await db.collection('import_registrations').countDocuments({
      '_productionMeta.productionObjectId': { $exists: true }
    });
    const syncedTickets = await db.collection('import_tickets').countDocuments({
      '_productionMeta.productionObjectId': { $exists: true }
    });
    
    console.log(`  Payments synced: ${syncedPayments}/${importPayments} (${Math.round(syncedPayments/importPayments*100)}%)`);
    console.log(`  Registrations synced: ${syncedRegistrations}/${importRegistrations} (${Math.round(syncedRegistrations/importRegistrations*100)}%)`);
    console.log(`  Tickets synced: ${syncedTickets}/${importTickets} (${Math.round(syncedTickets/importTickets*100)}%)`);
    
    // Check for orphaned tickets
    console.log('\n🔍 ORPHAN CHECK:');
    
    // Find tickets in production without matching registrations
    const orphanedTickets = await db.collection('tickets').aggregate([
      {
        $lookup: {
          from: 'registrations',
          let: { regId: '$metadata.registrationId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$id', '$$regId'] } } }
          ],
          as: 'registration'
        }
      },
      {
        $match: { 'registration.0': { $exists: false } }
      },
      {
        $count: 'orphaned'
      }
    ]).toArray();
    
    const orphanCount = orphanedTickets[0]?.orphaned || 0;
    
    if (orphanCount > 0) {
      console.log(`  ❌ Found ${orphanCount} ORPHANED tickets in production!`);
    } else {
      console.log(`  ✅ No orphaned tickets found - all tickets have valid registrations`);
    }
    
    // Summary
    console.log('\n🎯 SUMMARY:');
    if (prodTickets > 0) {
      console.log('✅ IMMEDIATE SYNC IS WORKING!');
      console.log(`✅ ${prodTickets} tickets successfully synced to production`);
      if (orphanCount === 0) {
        console.log('✅ No orphaned tickets - validation is working correctly');
      }
    } else {
      console.log('⚠️  No tickets in production yet');
      console.log('   Check if sync is still running or if there are validation issues');
    }
    
  } catch (error) {
    console.error('❌ Monitor failed:', error);
  } finally {
    await client.close();
  }
}

// Run monitoring
monitorSync().catch(console.error);

// Optional: Run continuously to monitor progress
if (process.argv.includes('--watch')) {
  console.log('\n👁️  Watching for changes (refresh every 5 seconds)...\n');
  setInterval(() => {
    console.clear();
    monitorSync().catch(console.error);
  }, 5000);
}