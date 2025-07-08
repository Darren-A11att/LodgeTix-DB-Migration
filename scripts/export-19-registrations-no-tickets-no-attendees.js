#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function exportThe19Registrations() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const registrationsCollection = db.collection('registrations');

    // Get all individual registrations
    const allRegs = await registrationsCollection.find({
      registrationType: 'individuals'
    }).toArray();
    
    // Filter for registrations with no tickets AND no attendees
    const emptyRegistrations = [];
    
    allRegs.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      const attendeeCount = reg.attendeeCount || reg.attendee_count || 0;
      
      // Check if has no selected tickets
      const hasNoTickets = !regData || !regData.selectedTickets || regData.selectedTickets.length === 0;
      
      // Check if has no attendees
      if (hasNoTickets && attendeeCount === 0) {
        emptyRegistrations.push(reg);
      }
    });

    console.log(`Found ${emptyRegistrations.length} registrations with no tickets and no attendees`);

    // Sort by confirmation number for consistent ordering
    emptyRegistrations.sort((a, b) => {
      const confA = a.confirmationNumber || a.confirmation_number || '';
      const confB = b.confirmationNumber || b.confirmation_number || '';
      return confA.localeCompare(confB);
    });

    // Export the full documents
    const exportData = {
      exportDate: new Date().toISOString(),
      description: "Individual registrations with no selected tickets and no attendees",
      totalCount: emptyRegistrations.length,
      registrations: emptyRegistrations
    };

    // Save to JSON file
    const filename = `19-registrations-no-tickets-no-attendees-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(__dirname, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
    
    console.log(`\nExported ${emptyRegistrations.length} full registration documents to: ${filename}`);
    
    // Display summary
    console.log('\nSUMMARY OF THE 19 REGISTRATIONS:');
    console.log('='.repeat(80));
    console.log('# | Confirmation Number | Payment Status | Amount Paid | Payment ID Type');
    console.log('-'.repeat(80));
    
    emptyRegistrations.forEach((reg, index) => {
      const confirmationNumber = reg.confirmationNumber || reg.confirmation_number || 'N/A';
      const paymentStatus = reg.paymentStatus || reg.payment_status || 'unknown';
      const totalAmount = reg.totalAmountPaid?.$numberDecimal || reg.totalAmountPaid || reg.total_amount_paid || 0;
      
      let paymentType = 'None';
      if (reg.stripePaymentIntentId || reg.stripe_payment_intent_id) {
        paymentType = 'Stripe';
      } else if (reg.squarePaymentId || reg.square_payment_id) {
        paymentType = 'Square';
      }
      
      console.log(
        `${(index + 1).toString().padStart(2)} | ` +
        `${confirmationNumber.padEnd(18)} | ` +
        `${paymentStatus.padEnd(14)} | ` +
        `$${totalAmount.toString().padStart(9)} | ` +
        paymentType
      );
    });
    
    console.log('='.repeat(80));
    console.log('\nFile size:', (fs.statSync(filepath).size / 1024).toFixed(2), 'KB');
    
    // Additional insights
    const insights = {
      withStripePayment: emptyRegistrations.filter(r => r.stripePaymentIntentId || r.stripe_payment_intent_id).length,
      withSquarePayment: emptyRegistrations.filter(r => r.squarePaymentId || r.square_payment_id).length,
      withoutPaymentId: emptyRegistrations.filter(r => 
        !(r.stripePaymentIntentId || r.stripe_payment_intent_id || r.squarePaymentId || r.square_payment_id)
      ).length,
      totalRevenue: emptyRegistrations.reduce((sum, r) => {
        const amount = parseFloat(r.totalAmountPaid?.$numberDecimal || r.totalAmountPaid || r.total_amount_paid || 0);
        return sum + amount;
      }, 0)
    };
    
    console.log('\nINSIGHTS:');
    console.log(`- With Stripe payment: ${insights.withStripePayment}`);
    console.log(`- With Square payment: ${insights.withSquarePayment}`);
    console.log(`- Without payment ID: ${insights.withoutPaymentId}`);
    console.log(`- Total revenue from these registrations: $${insights.totalRevenue.toFixed(2)}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the export
exportThe19Registrations();