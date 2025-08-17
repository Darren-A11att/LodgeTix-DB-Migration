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

interface TicketDocument {
  _id: any;
  registrationId?: string;
  [key: string]: any;
}

interface RegistrationData {
  [key: string]: any;
}

async function findTicketAndUpdateRegistration() {
  let mongoClient: MongoClient | null = null;
  
  try {
    console.log('🔍 Starting ticket search and registration update process...');
    console.log(`📋 Target Registration ID: ${TARGET_REGISTRATION_ID}`);
    
    // Connect to MongoDB
    console.log('\n📡 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    console.log('✅ MongoDB connected successfully');
    
    // Connect to Supabase
    console.log('\n📡 Connecting to Supabase...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('✅ Supabase client initialized');
    
    // Get the database and collection
    const db = mongoClient.db('lodgetix');
    const ticketsCollection = db.collection('tickets');
    
    // Search for ticket with matching registrationId
    console.log('\n🔍 Searching for ticket with registrationId...');
    const ticket: TicketDocument | null = await ticketsCollection.findOne({
      registrationId: TARGET_REGISTRATION_ID
    });
    
    if (!ticket) {
      console.log('❌ No ticket found with the specified registrationId');
      return {
        ticketFound: false,
        ticket: null,
        registrationUpdated: false,
        updatedData: null
      };
    }
    
    console.log('✅ Ticket found!');
    console.log(`📄 Ticket ID: ${ticket._id}`);
    console.log(`📋 Registration ID: ${ticket.registrationId}`);
    console.log('📊 Ticket Document Preview:');
    
    // Display key ticket fields (excluding sensitive data)
    const ticketPreview = {
      _id: ticket._id,
      registrationId: ticket.registrationId,
      // Add other relevant fields you want to display
      ...(ticket.eventId && { eventId: ticket.eventId }),
      ...(ticket.ticketTypeId && { ticketTypeId: ticket.ticketTypeId }),
      ...(ticket.price && { price: ticket.price }),
      ...(ticket.status && { status: ticket.status }),
      ...(ticket.createdAt && { createdAt: ticket.createdAt }),
      ...(ticket.updatedAt && { updatedAt: ticket.updatedAt })
    };
    console.log(JSON.stringify(ticketPreview, null, 2));
    
    // Get current registration from Supabase
    console.log('\n📋 Fetching current registration from Supabase...');
    const { data: currentRegistration, error: fetchError } = await supabase
      .from('registrations')
      .select('registration_id, registration_data')
      .eq('registration_id', TARGET_REGISTRATION_ID)
      .single();
    
    if (fetchError) {
      console.error('❌ Error fetching registration:', fetchError.message);
      throw fetchError;
    }
    
    if (!currentRegistration) {
      console.log('❌ No registration found in Supabase with the specified ID');
      return {
        ticketFound: true,
        ticket: ticketPreview,
        registrationUpdated: false,
        error: 'Registration not found in Supabase'
      };
    }
    
    console.log('✅ Current registration found in Supabase');
    
    // Prepare updated registration data
    const currentData: RegistrationData = currentRegistration.registration_data || {};
    
    // Create a clean ticket object (without MongoDB _id)
    const cleanTicket = { ...ticket };
    delete cleanTicket._id;
    
    // Add ticket to registration data
    const updatedData: RegistrationData = {
      ...currentData,
      ticket: cleanTicket
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
      ...currentData,
      ticket: {
        registrationId: cleanTicket.registrationId,
        eventId: cleanTicket.eventId || 'N/A',
        ticketTypeId: cleanTicket.ticketTypeId || 'N/A',
        price: cleanTicket.price || 'N/A',
        status: cleanTicket.status || 'N/A',
        '...': 'additional ticket fields'
      }
    };
    console.log(JSON.stringify(sampleStructure, null, 2));
    
    return {
      ticketFound: true,
      ticket: ticketPreview,
      registrationUpdated: true,
      updatedData: sampleStructure,
      fullTicketData: cleanTicket
    };
    
  } catch (error) {
    console.error('💥 Error in findTicketAndUpdateRegistration:', error);
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
    const result = await findTicketAndUpdateRegistration();
    
    console.log('\n📋 OPERATION SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Ticket Found: ${result.ticketFound ? '✅ YES' : '❌ NO'}`);
    
    if (result.ticketFound) {
      console.log(`Registration Updated: ${result.registrationUpdated ? '✅ YES' : '❌ NO'}`);
    }
    
    if (result.ticketFound && result.registrationUpdated) {
      console.log('\n🎉 Operation completed successfully!');
      console.log('The ticket document has been added to the registration_data JSONB column');
    }
    
  } catch (error) {
    console.error('\n💥 Operation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if called directly
main();

export { findTicketAndUpdateRegistration };