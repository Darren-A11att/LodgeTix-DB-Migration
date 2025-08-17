#!/usr/bin/env tsx

import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
const envPath = join(__dirname, '..', '.env.explorer');
dotenv.config({ path: envPath });

// Configuration
const MONGODB_URI = process.env.MONGODB_URI!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TARGET_REGISTRATION_ID = '49cd6734-a145-4f7e-9c63-fe976d414cad';

async function analyzeRegistrationAndFindTickets() {
  let mongoClient: MongoClient | null = null;
  
  try {
    console.log('🔍 Analyzing registration and searching for related tickets...');
    console.log(`📋 Target Registration ID: ${TARGET_REGISTRATION_ID}`);
    
    // Connect to Supabase first to get registration details
    console.log('\n📡 Connecting to Supabase...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: registration, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('registration_id', TARGET_REGISTRATION_ID)
      .single();
    
    if (error || !registration) {
      console.log(`❌ Registration not found in Supabase: ${error?.message}`);
      return;
    }
    
    console.log('✅ Registration found in Supabase!');
    console.log('\n📊 Registration details:');
    console.log(`Registration ID: ${registration.registration_id}`);
    console.log(`Event ID: ${registration.registration_data?.eventId}`);
    console.log(`Customer ID: ${registration.registration_data?.customerId}`);
    console.log(`Primary Attendee ID: ${registration.registration_data?.primaryAttendeeId}`);
    console.log(`Invoice ID: ${registration.registration_data?.invoiceId}`);
    console.log(`Payment ID: ${registration.registration_data?.paymentId}`);
    console.log(`Organisation ID: ${registration.registration_data?.organisationId}`);
    console.log(`Booking Contact ID: ${registration.registration_data?.bookingContactId}`);
    
    // Connect to MongoDB
    console.log('\n📡 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    console.log('✅ MongoDB connected successfully');
    
    const db = mongoClient.db('lodgetix');
    const ticketsCollection = db.collection('tickets');
    
    // Search for tickets using various registration-related fields
    const searchCriteria = [];
    
    if (registration.registration_data?.eventId) {
      searchCriteria.push({ field: 'eventId', value: registration.registration_data.eventId });
    }
    
    if (registration.registration_data?.customerId) {
      searchCriteria.push({ field: 'ownerId', value: registration.registration_data.customerId });
    }
    
    if (registration.registration_data?.primaryAttendeeId) {
      searchCriteria.push({ field: 'ownerId', value: registration.registration_data.primaryAttendeeId });
    }
    
    if (registration.registration_data?.invoiceId) {
      searchCriteria.push({ field: 'invoiceId', value: registration.registration_data.invoiceId });
    }
    
    if (registration.registration_data?.paymentId) {
      searchCriteria.push({ field: 'paymentId', value: registration.registration_data.paymentId });
    }
    
    // Also search by registration ID in various possible fields
    searchCriteria.push({ field: 'registrationId', value: TARGET_REGISTRATION_ID });
    searchCriteria.push({ field: 'ownerId', value: TARGET_REGISTRATION_ID });
    
    console.log('\n🔍 Searching for tickets using multiple criteria...');
    
    const foundTickets = [];
    
    for (const criteria of searchCriteria) {
      console.log(`\n🔍 Searching by ${criteria.field}: ${criteria.value}`);
      
      const tickets = await ticketsCollection.find({
        [criteria.field]: criteria.value
      }).toArray();
      
      if (tickets.length > 0) {
        console.log(`✅ Found ${tickets.length} ticket(s) matching ${criteria.field}`);
        tickets.forEach((ticket, index) => {
          console.log(`  ${index + 1}. Ticket ID: ${ticket._id}`);
          console.log(`     Ticket Number: ${ticket.ticketNumber}`);
          console.log(`     Event: ${ticket.eventName}`);
          console.log(`     Owner ID: ${ticket.ownerId}`);
          console.log(`     Status: ${ticket.status}`);
        });
        foundTickets.push(...tickets.map(t => ({ ...t, foundBy: criteria.field })));
      } else {
        console.log(`❌ No tickets found for ${criteria.field}: ${criteria.value}`);
      }
    }
    
    // If we found tickets, update the registration
    if (foundTickets.length > 0) {
      console.log(`\n🎯 Found ${foundTickets.length} total ticket(s) related to this registration!`);
      
      // Remove duplicates based on _id
      const uniqueTickets = foundTickets.reduce((acc, ticket) => {
        const existing = acc.find(t => t._id.toString() === ticket._id.toString());
        if (!existing) {
          acc.push(ticket);
        }
        return acc;
      }, []);
      
      console.log(`📊 Unique tickets after deduplication: ${uniqueTickets.length}`);
      
      // Prepare tickets for storage (remove MongoDB _id and add metadata)
      const ticketsForStorage = uniqueTickets.map(ticket => {
        const { _id, foundBy, ...cleanTicket } = ticket;
        return {
          ...cleanTicket,
          mongodbId: _id.toString(),
          foundBy: foundBy,
          linkedAt: new Date().toISOString()
        };
      });
      
      // Update registration_data in Supabase
      const currentData = registration.registration_data || {};
      const updatedData = {
        ...currentData,
        tickets: ticketsForStorage,
        ticketsLinkedAt: new Date().toISOString(),
        ticketsCount: ticketsForStorage.length
      };
      
      console.log('\n🔄 Updating registration_data in Supabase...');
      const { data: updateResult, error: updateError } = await supabase
        .from('registrations')
        .update({
          registration_data: updatedData,
          updated_at: new Date().toISOString()
        })
        .eq('registration_id', TARGET_REGISTRATION_ID)
        .select();
      
      if (updateError) {
        console.error('❌ Error updating registration:', updateError.message);
        throw updateError;
      }
      
      console.log('✅ Registration updated successfully!');
      
      // Show sample of updated structure
      console.log('\n📊 Updated Registration Data Structure:');
      const sampleStructure = {
        ...Object.fromEntries(Object.entries(currentData).slice(0, 5)),
        tickets: ticketsForStorage.map(t => ({
          mongodbId: t.mongodbId,
          ticketNumber: t.ticketNumber,
          eventName: t.eventName,
          status: t.status,
          foundBy: t.foundBy,
          '...': 'additional ticket fields'
        })),
        ticketsLinkedAt: updatedData.ticketsLinkedAt,
        ticketsCount: updatedData.ticketsCount,
        '...': 'other existing fields'
      };
      
      console.log(JSON.stringify(sampleStructure, null, 2));
      
      return {
        ticketsFound: true,
        ticketCount: uniqueTickets.length,
        tickets: ticketsForStorage,
        registrationUpdated: true,
        updatedData: sampleStructure
      };
      
    } else {
      console.log('\n❌ No tickets found related to this registration');
      
      // Still add an empty tickets array to indicate we've searched
      const currentData = registration.registration_data || {};
      const updatedData = {
        ...currentData,
        tickets: [],
        ticketsSearchedAt: new Date().toISOString(),
        ticketsCount: 0
      };
      
      console.log('\n🔄 Updating registration to mark as searched...');
      const { error: updateError } = await supabase
        .from('registrations')
        .update({
          registration_data: updatedData,
          updated_at: new Date().toISOString()
        })
        .eq('registration_id', TARGET_REGISTRATION_ID);
      
      if (updateError) {
        console.error('❌ Error updating registration:', updateError.message);
      } else {
        console.log('✅ Registration marked as searched');
      }
      
      return {
        ticketsFound: false,
        ticketCount: 0,
        tickets: [],
        registrationUpdated: true,
        searchCriteriaUsed: searchCriteria
      };
    }
    
  } catch (error) {
    console.error('💥 Error in analyzeRegistrationAndFindTickets:', error);
    throw error;
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log('\n🔌 MongoDB connection closed');
    }
  }
}

// Main execution
async function main() {
  try {
    const result = await analyzeRegistrationAndFindTickets();
    
    console.log('\n📋 OPERATION SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Tickets Found: ${result?.ticketsFound ? '✅ YES' : '❌ NO'}`);
    
    if (result?.ticketsFound) {
      console.log(`Ticket Count: ${result.ticketCount}`);
      console.log(`Registration Updated: ${result.registrationUpdated ? '✅ YES' : '❌ NO'}`);
    }
    
    if (result?.ticketsFound && result.registrationUpdated) {
      console.log('\n🎉 Operation completed successfully!');
      console.log('The ticket document(s) have been added to the registration_data JSONB column');
    } else if (result?.registrationUpdated && !result?.ticketsFound) {
      console.log('\n📝 Registration marked as searched - no related tickets found');
    }
    
  } catch (error) {
    console.error('\n💥 Operation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if called directly
main();