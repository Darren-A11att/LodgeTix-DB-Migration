#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function exportEmptyRegistrationsFull() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const registrationsCollection = db.collection('registrations');

    // First, get all individual registrations
    const allIndividualRegs = await registrationsCollection.find({
      $or: [
        { registrationType: 'individuals' },
        { registration_type: 'individuals' }
      ]
    }).toArray();

    console.log(`Total individual registrations: ${allIndividualRegs.length}`);

    // Filter for those that truly have no selected tickets
    const emptyRegistrations = allIndividualRegs.filter(reg => {
      const regData = reg.registrationData || reg.registration_data;
      
      // Check if registrationData exists and has selectedTickets
      if (!regData) {
        return true; // No registration data at all
      }
      
      // Check if selectedTickets exists and has content
      if (!regData.selectedTickets || 
          regData.selectedTickets.length === 0) {
        return true; // No selected tickets or empty array
      }
      
      return false; // Has selected tickets
    });

    console.log(`Found ${emptyRegistrations.length} individual registrations with truly no selected tickets`);

    // Export the full documents
    const exportData = {
      exportDate: new Date().toISOString(),
      description: "Individual registrations with no selected tickets",
      totalCount: emptyRegistrations.length,
      registrations: emptyRegistrations
    };

    // Save to JSON file
    const filename = `19-empty-registrations-full-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(__dirname, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
    
    console.log(`\nExported ${emptyRegistrations.length} full registration documents to: ${filename}`);
    
    // Display summary
    console.log('\nSUMMARY:');
    console.log('='.repeat(60));
    
    emptyRegistrations.forEach((reg, index) => {
      const confirmationNumber = reg.confirmationNumber || reg.confirmation_number || 'N/A';
      const paymentStatus = reg.paymentStatus || reg.payment_status || 'unknown';
      const totalAmount = reg.totalAmountPaid?.$numberDecimal || reg.totalAmountPaid || reg.total_amount_paid || 0;
      const attendeeCount = reg.attendeeCount || reg.attendee_count || 0;
      
      console.log(`${index + 1}. ${confirmationNumber} - Status: ${paymentStatus}, Amount: $${totalAmount}, Attendees: ${attendeeCount}`);
    });

    console.log('\nFile size:', (fs.statSync(filepath).size / 1024).toFixed(2), 'KB');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the export
exportEmptyRegistrationsFull();