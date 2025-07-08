#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function analyzeNamingConventions() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Analyzing Registration Naming Conventions\n');

    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const coll = db.collection('registrations');

    // Get the new registration
    const newReg = await coll.findOne({ _id: new ObjectId('686c7afcf17c9cbb6cdef069') });

    if (newReg) {
      console.log('New Registration (IND-671599JU) field naming:');
      console.log('============================================');
      console.log('Root level fields:');
      console.log('- registration_id:', newReg.registration_id);
      console.log('- registration_type:', newReg.registration_type); 
      console.log('- total_amount_paid:', newReg.total_amount_paid);
      console.log('- attendee_count:', newReg.attendee_count);
      console.log('- stripe_payment_intent_id:', newReg.stripe_payment_intent_id);
      console.log('- created_at:', newReg.created_at);
      console.log('- updated_at:', newReg.updated_at);

      if (newReg.registration_data) {
        console.log('\nregistration_data contents:');
        const regData = newReg.registration_data;
        
        // Check for different ticket field names
        console.log('- selected_tickets:', Array.isArray(regData.selected_tickets) ? `${regData.selected_tickets.length} items` : 'not found');
        console.log('- selectedTickets:', Array.isArray(regData.selectedTickets) ? `${regData.selectedTickets.length} items` : 'not found');
        console.log('- event_tickets:', Array.isArray(regData.event_tickets) ? `${regData.event_tickets.length} items` : 'not found');
        console.log('- eventTickets:', Array.isArray(regData.eventTickets) ? `${regData.eventTickets.length} items` : 'not found');
        console.log('- tickets:', Array.isArray(regData.tickets) ? `${regData.tickets.length} items` : 'not found');
        console.log('- attendees:', Array.isArray(regData.attendees) ? `${regData.attendees.length} items` : 'not found');

        // Check ticket field structure
        const ticketArray = regData.selected_tickets || regData.selectedTickets || regData.event_tickets || regData.eventTickets || regData.tickets;
        if (ticketArray && ticketArray[0]) {
          console.log('\nFirst ticket item fields:');
          Object.entries(ticketArray[0]).forEach(([key, value]) => {
            console.log(`  - ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
          });
        }
      }
    }

    // Compare with a camelCase registration
    console.log('\n\nOlder Registration (camelCase example):');
    console.log('=======================================');
    const oldReg = await coll.findOne({ confirmationNumber: 'IND-936321XI' });
    if (oldReg) {
      console.log('Root level fields:');
      console.log('- registrationId:', oldReg.registrationId);
      console.log('- registrationType:', oldReg.registrationType);
      console.log('- totalAmountPaid:', oldReg.totalAmountPaid?.$numberDecimal || oldReg.totalAmountPaid);
      console.log('- attendeeCount:', oldReg.attendeeCount);
      console.log('- stripePaymentIntentId:', oldReg.stripePaymentIntentId);
      console.log('- createdAt:', oldReg.createdAt);
      console.log('- updatedAt:', oldReg.updatedAt);
    }

    // Check overall distribution
    console.log('\n\nNaming Convention Distribution:');
    console.log('==============================');
    
    // Sample registrations to check patterns
    const sample = await coll.aggregate([
      { $sample: { size: 100 } },
      {
        $project: {
          hasSnakeCase: {
            $or: [
              { $ifNull: ['$registration_id', false] },
              { $ifNull: ['$registration_type', false] },
              { $ifNull: ['$total_amount_paid', false] }
            ]
          },
          hasCamelCase: {
            $or: [
              { $ifNull: ['$registrationId', false] },
              { $ifNull: ['$registrationType', false] },
              { $ifNull: ['$totalAmountPaid', false] }
            ]
          },
          hasInsertedFromSupabase: { $ifNull: ['$insertedFromSupabase', false] },
          hasSupabaseSync: { $ifNull: ['$supabaseSync', false] }
        }
      },
      {
        $group: {
          _id: null,
          snakeCaseCount: { $sum: { $cond: ['$hasSnakeCase', 1, 0] } },
          camelCaseCount: { $sum: { $cond: ['$hasCamelCase', 1, 0] } },
          fromSupabaseCount: { $sum: { $cond: ['$hasInsertedFromSupabase', 1, 0] } },
          supabaseSyncCount: { $sum: { $cond: ['$hasSupabaseSync', 1, 0] } }
        }
      }
    ]).toArray();

    if (sample.length > 0) {
      const stats = sample[0];
      console.log(`Sample of 100 registrations:`);
      console.log(`- Using snake_case: ${stats.snakeCaseCount}`);
      console.log(`- Using camelCase: ${stats.camelCaseCount}`);
      console.log(`- Marked as from Supabase: ${stats.fromSupabaseCount}`);
      console.log(`- Has supabaseSync field: ${stats.supabaseSyncCount}`);
    }

    // Check ticket field naming within registrationData
    console.log('\n\nTicket Field Naming Patterns:');
    console.log('============================');
    
    const ticketPatterns = await coll.aggregate([
      { $match: { 'registrationData.selectedTickets': { $exists: true } } },
      { $unwind: '$registrationData.selectedTickets' },
      { $limit: 10 },
      {
        $project: {
          hasEventTicketId: { $ifNull: ['$registrationData.selectedTickets.eventTicketId', false] },
          hasEvent_ticket_id: { $ifNull: ['$registrationData.selectedTickets.event_ticket_id', false] },
          hasTicketDefinitionId: { $ifNull: ['$registrationData.selectedTickets.ticketDefinitionId', false] }
        }
      }
    ]).toArray();

    if (ticketPatterns.length > 0) {
      let eventTicketId = 0, event_ticket_id = 0, ticketDefinitionId = 0;
      ticketPatterns.forEach(doc => {
        if (doc.hasEventTicketId) eventTicketId++;
        if (doc.hasEvent_ticket_id) event_ticket_id++;
        if (doc.hasTicketDefinitionId) ticketDefinitionId++;
      });
      console.log(`In selectedTickets array:`);
      console.log(`- Using 'eventTicketId': ${eventTicketId}`);
      console.log(`- Using 'event_ticket_id': ${event_ticket_id}`);
      console.log(`- Using 'ticketDefinitionId': ${ticketDefinitionId}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nAnalysis complete');
  }
}

// Run the analysis
analyzeNamingConventions();