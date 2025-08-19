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

async function deepSearchTicketsViaAttendees() {
  let mongoClient: MongoClient | null = null;
  
  try {
    console.log('🔍 Deep search for tickets via attendees and registrations...');
    console.log(`📋 Target Registration ID: ${TARGET_REGISTRATION_ID}`);
    
    // Connect to MongoDB
    console.log('\n📡 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    console.log('✅ MongoDB connected successfully');
    
    const db = mongoClient.db('lodgetix');
    
    // First, let's check the registrations collection to see if there's a registration record
    console.log('\n🔍 Searching registrations collection...');
    const registrationsCollection = db.collection('registrations');
    
    // Search for registration in MongoDB
    const mongoRegistration = await registrationsCollection.findOne({
      registrationId: TARGET_REGISTRATION_ID
    });
    
    if (mongoRegistration) {
      console.log('✅ Found registration in MongoDB!');
      console.log('Registration details:', JSON.stringify(mongoRegistration, null, 2));
    } else {
      console.log('❌ No registration found in MongoDB registrations collection');
    }
    
    // Check attendees collection for any attendees linked to this registration
    console.log('\n🔍 Searching attendees collection...');
    const attendeesCollection = db.collection('attendees');
    
    const attendees = await attendeesCollection.find({
      registrationId: TARGET_REGISTRATION_ID
    }).toArray();
    
    if (attendees.length > 0) {
      console.log(`✅ Found ${attendees.length} attendee(s) for this registration!`);
      
      const attendeeIds = attendees.map(a => a._id.toString());
      console.log('Attendee IDs:', attendeeIds);
      
      // Now search for tickets using attendee IDs
      console.log('\n🔍 Searching tickets by attendee IDs...');
      const ticketsCollection = db.collection('tickets');
      
      const ticketsByAttendees = await ticketsCollection.find({
        ownerId: { $in: attendeeIds }
      }).toArray();
      
      if (ticketsByAttendees.length > 0) {
        console.log(`✅ Found ${ticketsByAttendees.length} ticket(s) linked to attendees!`);
        
        ticketsByAttendees.forEach((ticket, index) => {
          console.log(`\n${index + 1}. Ticket Details:`);
          console.log(`   MongoDB ID: ${ticket._id}`);
          console.log(`   Ticket Number: ${ticket.ticketNumber}`);
          console.log(`   Event: ${ticket.eventName}`);
          console.log(`   Owner ID: ${ticket.ownerId}`);
          console.log(`   Status: ${ticket.status}`);
          console.log(`   Price: ${ticket.price}`);
        });
        
        // Update Supabase registration with found tickets
        console.log('\n🔄 Updating Supabase registration with found tickets...');
        
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        // Get current registration
        const { data: currentReg, error: fetchError } = await supabase
          .from('registrations')
          .select('registration_data')
          .eq('registration_id', TARGET_REGISTRATION_ID)
          .single();
        
        if (fetchError) {
          console.error('❌ Error fetching current registration:', fetchError.message);
          return;
        }
        
        // Prepare tickets for storage
        const ticketsForStorage = ticketsByAttendees.map(ticket => {
          const { _id, ...cleanTicket } = ticket;
          return {
            ...cleanTicket,
            mongodbId: _id.toString(),
            foundBy: 'attendeeId',
            linkedAt: new Date().toISOString()
          };
        });
        
        // Update registration_data
        const updatedData = {
          ...(currentReg.registration_data || {}),
          tickets: ticketsForStorage,
          attendees: attendees.map(a => ({
            attendeeId: a._id.toString(),
            ...a
          })),
          ticketsLinkedAt: new Date().toISOString(),
          ticketsCount: ticketsForStorage.length,
          attendeesCount: attendees.length
        };
        
        const { error: updateError } = await supabase
          .from('registrations')
          .update({
            registration_data: updatedData,
            updated_at: new Date().toISOString()
          })
          .eq('registration_id', TARGET_REGISTRATION_ID);
        
        if (updateError) {
          console.error('❌ Error updating registration:', updateError.message);
          throw updateError;
        }
        
        console.log('✅ Registration updated successfully with tickets and attendees!');
        
        // Show summary
        console.log('\n📊 Update Summary:');
        console.log(`Tickets added: ${ticketsForStorage.length}`);
        console.log(`Attendees added: ${attendees.length}`);
        
        console.log('\n📄 Sample updated structure:');
        const sampleStructure = {
          tickets: ticketsForStorage.map(t => ({
            mongodbId: t.mongodbId,
            ticketNumber: (t as any).ticketNumber,
            eventName: (t as any).eventName,
            ownerId: (t as any).ownerId,
            status: (t as any).status,
            foundBy: t.foundBy
          })),
          attendees: attendees.map(a => ({
            attendeeId: a._id.toString(),
            firstName: a.firstName,
            lastName: a.lastName,
            email: a.email
          })),
          ticketsCount: ticketsForStorage.length,
          attendeesCount: attendees.length,
          ticketsLinkedAt: updatedData.ticketsLinkedAt
        };
        
        console.log(JSON.stringify(sampleStructure, null, 2));
        
        return {
          success: true,
          ticketsFound: true,
          ticketCount: ticketsForStorage.length,
          attendeeCount: attendees.length,
          tickets: ticketsForStorage
        };
        
      } else {
        console.log('❌ No tickets found for the attendees');
      }
      
    } else {
      console.log('❌ No attendees found for this registration');
    }
    
    // Additional search: look for any tickets with customer/contact IDs from Supabase registration
    console.log('\n🔍 Additional search using Supabase registration data...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: supabaseReg } = await supabase
      .from('registrations')
      .select('registration_data')
      .eq('registration_id', TARGET_REGISTRATION_ID)
      .single();
    
    if (supabaseReg?.registration_data) {
      const searchFields = [
        supabaseReg.registration_data.customerId,
        supabaseReg.registration_data.bookingContactId,
        supabaseReg.registration_data.primaryAttendeeId
      ].filter(Boolean);
      
      console.log('Searching for tickets with IDs:', searchFields);
      
      if (searchFields.length > 0) {
        const ticketsCollection = db.collection('tickets');
        const additionalTickets = await ticketsCollection.find({
          $or: [
            { ownerId: { $in: searchFields } },
            { customerId: { $in: searchFields } },
            { contactId: { $in: searchFields } }
          ]
        }).toArray();
        
        if (additionalTickets.length > 0) {
          console.log(`✅ Found ${additionalTickets.length} additional ticket(s)!`);
          additionalTickets.forEach((ticket, index) => {
            console.log(`${index + 1}. ${ticket.ticketNumber} - ${ticket.eventName} (Owner: ${ticket.ownerId})`);
          });
        } else {
          console.log('❌ No additional tickets found');
        }
      }
    }
    
    return { success: true, ticketsFound: false };
    
  } catch (error) {
    console.error('💥 Error in deepSearchTicketsViaAttendees:', error);
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
    const result = await deepSearchTicketsViaAttendees();
    
    console.log('\n📋 FINAL OPERATION SUMMARY:');
    console.log('='.repeat(50));
    
    if (result?.ticketsFound) {
      console.log(`✅ SUCCESS: Found ${result.ticketCount} ticket(s) and ${result.attendeeCount} attendee(s)`);
      console.log('✅ Registration updated in Supabase with ticket and attendee data');
    } else {
      console.log('❌ No tickets found through any search method');
      console.log('📝 This registration may not have associated tickets in the current MongoDB dataset');
    }
    
  } catch (error) {
    console.error('\n💥 Operation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if called directly
main();