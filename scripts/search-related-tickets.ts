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

async function searchRelatedTickets() {
  let mongoClient: MongoClient | null = null;
  
  try {
    console.log('🔍 Starting comprehensive ticket search...');
    console.log(`📋 Target Registration ID: ${TARGET_REGISTRATION_ID}`);
    
    // Connect to MongoDB
    console.log('\n📡 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    console.log('✅ MongoDB connected successfully');
    
    const db = mongoClient.db('lodgetix');
    const ticketsCollection = db.collection('tickets');
    
    // First, check if tickets collection exists and has documents
    console.log('\n📊 Checking tickets collection...');
    const collectionStats = await db.stats();
    console.log(`Database: ${db.databaseName}`);
    
    const collections = await db.listCollections().toArray();
    console.log('\n📁 Available collections:');
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    const hasTicketsCollection = collections.some(col => col.name === 'tickets');
    
    if (!hasTicketsCollection) {
      console.log('❌ No "tickets" collection found');
      return;
    }
    
    const ticketCount = await ticketsCollection.countDocuments();
    console.log(`\n📊 Total tickets in collection: ${ticketCount}`);
    
    if (ticketCount === 0) {
      console.log('❌ No tickets found in collection');
      return;
    }
    
    // Check for exact match first
    console.log('\n🔍 Searching for exact registrationId match...');
    const exactMatch = await ticketsCollection.findOne({
      registrationId: TARGET_REGISTRATION_ID
    });
    
    if (exactMatch) {
      console.log('✅ Found exact match!');
      console.log(JSON.stringify(exactMatch, null, 2));
      return exactMatch;
    }
    
    // Check for partial matches or similar patterns
    console.log('\n🔍 Searching for partial registrationId matches...');
    const partialMatches = await ticketsCollection.find({
      registrationId: { $regex: TARGET_REGISTRATION_ID.substring(0, 8), $options: 'i' }
    }).limit(10).toArray();
    
    if (partialMatches.length > 0) {
      console.log(`✅ Found ${partialMatches.length} partial matches:`);
      partialMatches.forEach((ticket, index) => {
        console.log(`\n${index + 1}. Ticket ID: ${ticket._id}`);
        console.log(`   Registration ID: ${ticket.registrationId}`);
      });
    }
    
    // Check for any tickets with registrationId field
    console.log('\n🔍 Searching for any tickets with registrationId field...');
    const ticketsWithRegId = await ticketsCollection.find({
      registrationId: { $exists: true, $ne: null }
    }).limit(10).toArray();
    
    if (ticketsWithRegId.length > 0) {
      console.log(`✅ Found ${ticketsWithRegId.length} tickets with registrationId:`);
      ticketsWithRegId.forEach((ticket, index) => {
        console.log(`\n${index + 1}. Ticket ID: ${ticket._id}`);
        console.log(`   Registration ID: ${ticket.registrationId}`);
      });
    }
    
    // Get sample of ticket structure
    console.log('\n📄 Sample ticket structure:');
    const sampleTicket = await ticketsCollection.findOne({});
    if (sampleTicket) {
      const sampleFields = Object.keys(sampleTicket);
      console.log('Available fields in tickets:');
      sampleFields.forEach(field => console.log(`  - ${field}`));
      
      // Show a few key fields
      console.log('\nSample ticket data:');
      console.log(JSON.stringify({
        _id: sampleTicket._id,
        ...Object.fromEntries(
          Object.entries(sampleTicket).slice(1, 6) // Show first 5 fields after _id
        )
      }, null, 2));
    }
    
    // Check if registration exists in Supabase
    console.log('\n📋 Checking if registration exists in Supabase...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: registration, error } = await supabase
      .from('registrations')
      .select('registration_id, registration_data')
      .eq('registration_id', TARGET_REGISTRATION_ID)
      .single();
    
    if (error) {
      console.log(`❌ Registration not found in Supabase: ${error.message}`);
    } else {
      console.log('✅ Registration found in Supabase!');
      console.log(`Registration ID: ${registration.registration_id}`);
      console.log('Current registration_data keys:', Object.keys(registration.registration_data || {}));
    }
    
  } catch (error) {
    console.error('💥 Error in searchRelatedTickets:', error);
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
    await searchRelatedTickets();
  } catch (error) {
    console.error('\n💥 Operation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if called directly
main();