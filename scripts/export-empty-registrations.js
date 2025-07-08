#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function exportEmptyRegistrations() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const registrationsCollection = db.collection('registrations');

    // Find individual registrations with no selected tickets
    console.log('Finding individual registrations with no selected tickets...\n');
    
    const emptyRegistrations = await registrationsCollection.find({
      $and: [
        {
          $or: [
            { registrationType: 'individuals' },
            { registration_type: 'individuals' }
          ]
        },
        {
          $or: [
            { 'registrationData.selectedTickets': { $exists: false } },
            { 'registrationData.selectedTickets': { $eq: [] } },
            { 'registrationData.selectedTickets': { $size: 0 } },
            { 'registration_data.selectedTickets': { $exists: false } },
            { 'registration_data.selectedTickets': { $eq: [] } },
            { 'registration_data.selectedTickets': { $size: 0 } }
          ]
        }
      ]
    }).toArray();

    console.log(`Found ${emptyRegistrations.length} individual registrations with no selected tickets`);

    // Prepare data for export
    const exportData = emptyRegistrations.map((reg, index) => {
      const regData = reg.registrationData || reg.registration_data || {};
      
      return {
        index: index + 1,
        _id: reg._id,
        registrationId: reg.registrationId || reg.registration_id,
        confirmationNumber: reg.confirmationNumber || reg.confirmation_number || 'N/A',
        registrationType: reg.registrationType || reg.registration_type,
        paymentStatus: reg.paymentStatus || reg.payment_status || 'unknown',
        totalAmountPaid: reg.totalAmountPaid?.$numberDecimal || reg.totalAmountPaid || reg.total_amount_paid || 0,
        attendeeCount: reg.attendeeCount || reg.attendee_count || 0,
        createdAt: reg.createdAt || reg.created_at,
        updatedAt: reg.updatedAt || reg.updated_at,
        stripePaymentIntentId: reg.stripePaymentIntentId || reg.stripe_payment_intent_id,
        squarePaymentId: reg.squarePaymentId || reg.square_payment_id,
        functionId: reg.functionId || reg.function_id,
        registrationData: {
          selectedTickets: regData.selectedTickets || [],
          attendees: regData.attendees ? regData.attendees.map(a => ({
            attendeeId: a.attendeeId,
            firstName: a.firstName,
            lastName: a.lastName,
            email: a.email,
            isPrimary: a.isPrimary
          })) : [],
          bookingContact: regData.bookingContact ? {
            firstName: regData.bookingContact.firstName,
            lastName: regData.bookingContact.lastName,
            email: regData.bookingContact.email
          } : null,
          billingContact: regData.billingContact ? {
            firstName: regData.billingContact.firstName,
            lastName: regData.billingContact.lastName,
            email: regData.billingContact.email
          } : null
        }
      };
    });

    // Save to JSON file
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `empty-registrations-${timestamp}.json`;
    const filepath = path.join(__dirname, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
    
    console.log(`\nExported ${emptyRegistrations.length} registrations to: ${filename}`);
    
    // Display summary
    console.log('\nSUMMARY OF EMPTY REGISTRATIONS:');
    console.log('='.repeat(60));
    
    const summary = {
      total: emptyRegistrations.length,
      withPayment: 0,
      withoutPayment: 0,
      withAttendees: 0,
      withoutAttendees: 0,
      byPaymentStatus: {}
    };
    
    emptyRegistrations.forEach(reg => {
      // Count payment status
      const hasPaymentId = reg.stripePaymentIntentId || reg.stripe_payment_intent_id || 
                          reg.squarePaymentId || reg.square_payment_id;
      if (hasPaymentId) {
        summary.withPayment++;
      } else {
        summary.withoutPayment++;
      }
      
      // Count attendees
      const attendeeCount = reg.attendeeCount || reg.attendee_count || 0;
      if (attendeeCount > 0) {
        summary.withAttendees++;
      } else {
        summary.withoutAttendees++;
      }
      
      // Group by payment status
      const status = reg.paymentStatus || reg.payment_status || 'unknown';
      summary.byPaymentStatus[status] = (summary.byPaymentStatus[status] || 0) + 1;
    });
    
    console.log(`Total registrations: ${summary.total}`);
    console.log(`With payment ID: ${summary.withPayment}`);
    console.log(`Without payment ID: ${summary.withoutPayment}`);
    console.log(`With attendees: ${summary.withAttendees}`);
    console.log(`Without attendees: ${summary.withoutAttendees}`);
    console.log('\nBy Payment Status:');
    Object.entries(summary.byPaymentStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Show sample registrations
    console.log('\nSAMPLE REGISTRATIONS (first 5):');
    console.log('-'.repeat(60));
    exportData.slice(0, 5).forEach((reg, i) => {
      console.log(`\n${i + 1}. Registration ${reg.confirmationNumber}`);
      console.log(`   ID: ${reg.registrationId}`);
      console.log(`   Payment Status: ${reg.paymentStatus}`);
      console.log(`   Amount Paid: $${reg.totalAmountPaid}`);
      console.log(`   Attendees: ${reg.attendeeCount}`);
      console.log(`   Created: ${new Date(reg.createdAt).toLocaleDateString('en-AU')}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the export
exportEmptyRegistrations();