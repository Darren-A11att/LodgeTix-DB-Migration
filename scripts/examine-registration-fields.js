#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function examineRegistrationFields() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const registrationsCollection = db.collection('registrations');

    // Get the new registration
    const newReg = await registrationsCollection.findOne({
      $or: [
        { confirmationNumber: 'IND-671599JU' },
        { _id: new ObjectId('686c7afcf17c9cbb6cdef069') }
      ]
    });

    if (!newReg) {
      console.log('Registration IND-671599JU not found');
      return;
    }

    console.log('New Registration IND-671599JU Structure:');
    console.log('=========================================');
    console.log('MongoDB ID:', newReg._id);
    console.log('Registration ID:', newReg.registrationId || newReg.registration_id || 'Not found');
    console.log('Confirmation Number:', newReg.confirmationNumber || newReg.confirmation_number);
    console.log('Type:', newReg.registrationType || newReg.registration_type);
    console.log('Attendee Count:', newReg.attendeeCount || newReg.attendee_count || 'Not set');
    console.log('Total Amount Paid:', newReg.totalAmountPaid?.$numberDecimal || newReg.totalAmountPaid || newReg.total_amount_paid);
    
    console.log('\nField Names at Root Level:');
    const rootFields = Object.keys(newReg).filter(key => !key.startsWith('_') && key !== 'registrationData');
    rootFields.forEach(key => {
      console.log(`  - ${key}`);
    });

    if (newReg.registrationData) {
      console.log('\nregistrationData fields:');
      Object.keys(newReg.registrationData).forEach(key => {
        if (key === 'selectedTickets' || key === 'tickets' || key === 'eventTickets') {
          const tickets = newReg.registrationData[key];
          console.log(`  - ${key}: ${Array.isArray(tickets) ? tickets.length + ' items' : typeof tickets}`);
          if (Array.isArray(tickets) && tickets.length > 0) {
            console.log(`    First item fields: ${Object.keys(tickets[0]).join(', ')}`);
          }
        } else if (key === 'attendees') {
          const attendees = newReg.registrationData.attendees;
          console.log(`  - attendees: ${attendees?.length || 0} items`);
          if (attendees && attendees.length > 0) {
            console.log(`    Attendee names: ${attendees.map(a => `${a.firstName} ${a.lastName}`).join(', ')}`);
          }
        } else {
          console.log(`  - ${key}: ${typeof newReg.registrationData[key]}`);
        }
      });

      // Examine ticket structure in detail
      if (newReg.registrationData.selectedTickets && newReg.registrationData.selectedTickets[0]) {
        console.log('\nselectedTickets[0] detailed structure:');
        const ticket = newReg.registrationData.selectedTickets[0];
        Object.entries(ticket).forEach(([key, value]) => {
          console.log(`  - ${key}: ${value}`);
        });
      }

      if (newReg.registrationData.eventTickets && newReg.registrationData.eventTickets[0]) {
        console.log('\neventTickets[0] detailed structure:');
        const ticket = newReg.registrationData.eventTickets[0];
        Object.entries(ticket).forEach(([key, value]) => {
          console.log(`  - ${key}: ${value}`);
        });
      }
    }

    // Now compare with other registrations to find naming patterns
    console.log('\n\nComparing with other registrations:');
    console.log('====================================');

    // Sample different types of registrations
    const samples = await registrationsCollection.aggregate([
      { $sample: { size: 10 } },
      { 
        $project: {
          confirmationNumber: 1,
          registrationType: 1,
          'registrationData.selectedTickets': { $slice: ['$registrationData.selectedTickets', 1] },
          'registrationData.eventTickets': { $slice: ['$registrationData.eventTickets', 1] },
          'registrationData.tickets': { $slice: ['$registrationData.tickets', 1] },
          hasSelectedTickets: { $gt: [{ $size: { $ifNull: ['$registrationData.selectedTickets', []] } }, 0] },
          hasEventTickets: { $gt: [{ $size: { $ifNull: ['$registrationData.eventTickets', []] } }, 0] },
          hasTickets: { $gt: [{ $size: { $ifNull: ['$registrationData.tickets', []] } }, 0] }
        }
      }
    ]).toArray();

    let withSelectedTickets = 0;
    let withEventTickets = 0;
    let withTickets = 0;
    const ticketFieldVariations = new Set();

    samples.forEach(reg => {
      if (reg.hasSelectedTickets) withSelectedTickets++;
      if (reg.hasEventTickets) withEventTickets++;
      if (reg.hasTickets) withTickets++;

      // Check ticket field naming within tickets
      if (reg.registrationData?.selectedTickets?.[0]) {
        const ticketFields = Object.keys(reg.registrationData.selectedTickets[0]);
        ticketFieldVariations.add(`selectedTickets: ${ticketFields.join(', ')}`);
      }
      if (reg.registrationData?.eventTickets?.[0]) {
        const ticketFields = Object.keys(reg.registrationData.eventTickets[0]);
        ticketFieldVariations.add(`eventTickets: ${ticketFields.join(', ')}`);
      }
      if (reg.registrationData?.tickets?.[0]) {
        const ticketFields = Object.keys(reg.registrationData.tickets[0]);
        ticketFieldVariations.add(`tickets: ${ticketFields.join(', ')}`);
      }
    });

    console.log(`\nTicket array naming in sample of ${samples.length} registrations:`);
    console.log(`  - Using 'selectedTickets': ${withSelectedTickets}`);
    console.log(`  - Using 'eventTickets': ${withEventTickets}`);
    console.log(`  - Using 'tickets': ${withTickets}`);

    console.log('\nField variations found in ticket objects:');
    ticketFieldVariations.forEach(variation => {
      console.log(`  - ${variation}`);
    });

    // Check for eventTicketId vs event_ticket_id naming
    const ticketIdNaming = await registrationsCollection.aggregate([
      { $unwind: '$registrationData.selectedTickets' },
      { 
        $group: {
          _id: null,
          hasEventTicketId: { $sum: { $cond: [{ $ifNull: ['$registrationData.selectedTickets.eventTicketId', false] }, 1, 0] } },
          hasEvent_ticket_id: { $sum: { $cond: [{ $ifNull: ['$registrationData.selectedTickets.event_ticket_id', false] }, 1, 0] } },
          total: { $sum: 1 }
        }
      }
    ]).toArray();

    if (ticketIdNaming.length > 0) {
      console.log('\nTicket ID field naming in selectedTickets:');
      console.log(`  - Using 'eventTicketId': ${ticketIdNaming[0].hasEventTicketId}`);
      console.log(`  - Using 'event_ticket_id': ${ticketIdNaming[0].hasEvent_ticket_id}`);
      console.log(`  - Total tickets checked: ${ticketIdNaming[0].total}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the examination
examineRegistrationFields();