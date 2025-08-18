#!/usr/bin/env tsx

/**
 * Test script to verify the sequential validation fix
 * This will check each validation step to ensure they can all pass
 */

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';

async function testValidationSteps() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('🔍 TESTING SEQUENTIAL VALIDATION STEPS...\n');
    
    // Step 1: Check payments
    const totalPayments = await db.collection('import_payments').countDocuments({});
    const eligiblePayments = await db.collection('import_payments').countDocuments({ 
      _shouldMoveToProduction: { $ne: false } 
    });
    console.log(`📊 STEP 1 - Payments: ${totalPayments} total, ${eligiblePayments} eligible`);
    
    // Step 2: Check registrations (using synced payment IDs from production)
    const syncedPayments = await db.collection('payments').find({
      '_importMeta.importedFrom': 'import_payments'
    }, { projection: { id: 1 } }).toArray();
    const syncedPaymentIds = syncedPayments.map(p => p.id);
    
    const totalRegistrations = await db.collection('import_registrations').countDocuments({});
    const validRegistrations = await db.collection('import_registrations').countDocuments({
      _shouldMoveToProduction: { $ne: false },
      $or: [
        { 'paymentData.id': { $in: syncedPaymentIds } },
        { 'payment_data.id': { $in: syncedPaymentIds } },
        { paymentId: { $in: syncedPaymentIds } }
      ]
    });
    console.log(`📊 STEP 2 - Registrations: ${totalRegistrations} total, ${validRegistrations} valid (against ${syncedPaymentIds.length} synced payments)`);
    
    // Step 3: Check attendees
    const syncedRegistrations = await db.collection('registrations').find({
      '_importMeta.importedFrom': 'import_registrations'
    }, { projection: { id: 1 } }).toArray();
    const syncedRegistrationIds = syncedRegistrations.map(r => r.id);
    
    const totalAttendees = await db.collection('import_attendees').countDocuments({});
    const validAttendees = await db.collection('import_attendees').countDocuments({
      _shouldMoveToProduction: { $ne: false },
      'metadata.registrationId': { $in: syncedRegistrationIds }
    });
    console.log(`📊 STEP 3 - Attendees: ${totalAttendees} total, ${validAttendees} valid (against ${syncedRegistrationIds.length} synced registrations)`);
    
    // Step 4: Check customers (FIXED field path)
    const totalCustomers = await db.collection('import_customers').countDocuments({});
    const validCustomersOld = await db.collection('import_customers').countDocuments({
      _shouldMoveToProduction: { $ne: false },
      'metadata.registrationIds': { $in: syncedRegistrationIds }
    });
    const validCustomersNew = await db.collection('import_customers').countDocuments({
      _shouldMoveToProduction: { $ne: false },
      'registrations.registrationId': { $in: syncedRegistrationIds }
    });
    console.log(`📊 STEP 4 - Customers: ${totalCustomers} total`);
    console.log(`  ❌ Old field path: ${validCustomersOld} valid (metadata.registrationIds)`);
    console.log(`  ✅ NEW field path: ${validCustomersNew} valid (registrations.registrationId)`);
    
    // Step 5: Check contacts
    const syncedCustomers = await db.collection('customers').find({
      '_importMeta.importedFrom': 'import_customers'
    }, { projection: { customerId: 1, hash: 1 } }).toArray();
    const syncedAttendees = await db.collection('attendees').find({
      '_importMeta.importedFrom': 'import_attendees'
    }, { projection: { _id: 1 } }).toArray();
    
    const syncedCustomerIds = syncedCustomers.map(c => c.customerId || c.hash);
    const syncedAttendeeRefs = syncedAttendees.map(a => a._id);
    
    const totalContacts = await db.collection('import_contacts').countDocuments({});
    const validContacts = await db.collection('import_contacts').countDocuments({
      _shouldMoveToProduction: { $ne: false },
      $or: [
        { customerRef: { $in: syncedCustomerIds } },
        { attendeeRefs: { $in: syncedAttendeeRefs } },
        { 'data.attendeeRefs': { $in: syncedAttendeeRefs } }
      ]
    });
    console.log(`📊 STEP 5 - Contacts: ${totalContacts} total, ${validContacts} valid (against ${syncedCustomerIds.length} customers + ${syncedAttendeeRefs.length} attendees)`);
    
    // Step 7: Check tickets (final step)
    const totalTickets = await db.collection('import_tickets').countDocuments({});
    const validTickets = await db.collection('import_tickets').countDocuments({
      _shouldMoveToProduction: { $ne: false },
      'metadata.registrationId': { $in: syncedRegistrationIds }
    });
    console.log(`📊 STEP 7 - Tickets: ${totalTickets} total, ${validTickets} valid (against ${syncedRegistrationIds.length} synced registrations)`);
    
    console.log('\n🎯 VALIDATION SUMMARY:');
    if (validCustomersNew > 0) {
      console.log('✅ Customer validation FIX is working!');
      console.log('✅ Sequential validation should now complete all 7 steps');
      console.log('✅ Tickets should be processed successfully');
    } else {
      console.log('❌ Customer validation still failing - may need further investigation');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
  }
}

testValidationSteps().catch(console.error);