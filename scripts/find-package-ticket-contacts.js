#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function findPackageTicketContacts() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    // Find all registrations with package tickets (eventTicketId: null, isPackage: true)
    console.log('\n=== FINDING REGISTRATIONS WITH PACKAGE TICKETS ===');
    
    const registrations = await db.collection('registrations').find({
      $or: [
        { 'registrationData.tickets': { $elemMatch: { eventTicketId: null, price: 0 } } },
        { 'registration_data.tickets': { $elemMatch: { eventTicketId: null, price: 0 } } }
      ]
    }).toArray();
    
    console.log(`Found ${registrations.length} registrations with package tickets`);
    
    // Extract contact details
    console.log('\n=== BOOKING/BILLING CONTACT DETAILS ===');
    
    registrations.forEach((reg, index) => {
      console.log(`\n${index + 1}. Registration: ${reg.confirmationNumber} (${reg.registrationType})`);
      console.log(`   Registration ID: ${reg.registrationId || reg.registration_id}`);
      
      const regData = reg.registrationData || reg.registration_data;
      
      // Count package tickets
      const packageTickets = regData.tickets.filter(t => t.eventTicketId === null);
      console.log(`   Package tickets: ${packageTickets.length}`);
      
      // Show ticket details
      if (packageTickets.length > 0) {
        const sampleTicket = packageTickets[0];
        console.log(`   Ticket info: ${sampleTicket.name || 'Unknown'}, Qty: ${sampleTicket.quantity || 1}`);
        if (sampleTicket.ticketDefinitionId) {
          console.log(`   Ticket Definition ID: ${sampleTicket.ticketDefinitionId}`);
        }
      }
      
      // Booking contact from registrationData
      if (regData.bookingContact) {
        console.log('\n   Booking Contact:');
        console.log(`   - Name: ${regData.bookingContact.title || ''} ${regData.bookingContact.firstName} ${regData.bookingContact.lastName}`);
        console.log(`   - Email: ${regData.bookingContact.email}`);
        console.log(`   - Mobile: ${regData.bookingContact.mobile}`);
        console.log(`   - Rank: ${regData.bookingContact.rank || 'N/A'}`);
      }
      
      // Billing details from metadata
      if (regData.metadata && regData.metadata.billingDetails) {
        const billing = regData.metadata.billingDetails;
        console.log('\n   Billing Details:');
        console.log(`   - Name: ${billing.firstName} ${billing.lastName}`);
        console.log(`   - Email: ${billing.emailAddress}`);
        console.log(`   - Mobile: ${billing.mobileNumber}`);
        console.log(`   - Business: ${billing.businessName || 'N/A'}`);
        console.log(`   - Address: ${billing.addressLine1}`);
        console.log(`   - Location: ${billing.suburb}, ${billing.stateTerritory?.name || ''} ${billing.postcode}`);
      }
      
      // Lodge details if it's a lodge registration
      if (reg.registrationType === 'lodge' && regData.lodgeDetails) {
        console.log('\n   Lodge Details:');
        console.log(`   - Lodge Name: ${regData.lodgeDetails.lodgeName}`);
        console.log(`   - Lodge ID: ${regData.lodgeDetails.lodgeId}`);
        console.log(`   - Organisation: ${reg.organisationName || 'N/A'}`);
      }
      
      // Package details
      if (regData.packageId) {
        console.log(`\n   Package ID: ${regData.packageId}`);
      }
      
      console.log('\n   ' + '-'.repeat(80));
    });
    
    // Summary by lodge/organisation
    console.log('\n=== SUMMARY BY ORGANISATION ===');
    const orgSummary = {};
    
    registrations.forEach(reg => {
      const orgName = reg.organisationName || 'Individual';
      if (!orgSummary[orgName]) {
        orgSummary[orgName] = {
          count: 0,
          contacts: new Set(),
          confirmationNumbers: []
        };
      }
      
      orgSummary[orgName].count++;
      orgSummary[orgName].confirmationNumbers.push(reg.confirmationNumber);
      
      const regData = reg.registrationData || reg.registration_data;
      if (regData.bookingContact) {
        orgSummary[orgName].contacts.add(
          `${regData.bookingContact.firstName} ${regData.bookingContact.lastName} (${regData.bookingContact.email})`
        );
      }
    });
    
    Object.entries(orgSummary)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([org, data]) => {
        console.log(`\n${org}:`);
        console.log(`  Registrations: ${data.count}`);
        console.log(`  Confirmation Numbers: ${data.confirmationNumbers.join(', ')}`);
        console.log(`  Contacts:`);
        data.contacts.forEach(contact => {
          console.log(`    - ${contact}`);
        });
      });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the search
findPackageTicketContacts();