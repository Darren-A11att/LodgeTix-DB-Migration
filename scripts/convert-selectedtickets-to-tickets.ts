#!/usr/bin/env node

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

interface EventTicket {
  eventTicketId?: string;
  event_ticket_id?: string;
  name: string;
  price?: {
    $numberDecimal?: string;
  } | number;
  description?: string;
}

interface TicketInfo {
  name: string;
  price: number;
  description: string;
}

interface SelectedTicket {
  eventTicketsId?: string;
  eventTicketId?: string;
  quantity?: number;
  name?: string;
}

interface ConvertedTicket {
  id: string;
  price: number;
  isPackage: boolean;
  attendeeId: string;
  eventTicketId: string;
  name: string;
  quantity: number;
}

interface RegistrationData {
  selectedTickets?: SelectedTicket[];
  tickets?: ConvertedTicket[];
}

interface Registration {
  _id: ObjectId;
  confirmationNumber?: string;
  registrationId?: string;
  registration_id?: string;
  primaryAttendeeId?: string;
  registrationData?: RegistrationData;
  registration_data?: RegistrationData;
}

interface ConversionStats {
  convertedCount: number;
  skippedCount: number;
  errorCount: number;
}

async function convertSelectedTicketsToTickets(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db: Db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    // Get event tickets for mapping
    const eventTickets: EventTicket[] = await db.collection('eventTickets').find({}).toArray();
    const ticketMap = new Map<string, TicketInfo>();
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      if (ticketId) {
        ticketMap.set(ticketId, {
          name: ticket.name,
          price: parseFloat((ticket.price as any)?.$numberDecimal || ticket.price || 0),
          description: ticket.description || ''
        });
      }
    });
    
    console.log('\n=== FINDING REGISTRATIONS WITH selectedTickets ===');
    
    // Find all registrations with selectedTickets
    const registrations: Registration[] = await db.collection('registrations').find({
      $or: [
        { 'registrationData.selectedTickets': { $exists: true, $ne: [] } },
        { 'registration_data.selectedTickets': { $exists: true, $ne: [] } }
      ]
    }).toArray();
    
    console.log(`Found ${registrations.length} registrations with selectedTickets`);
    
    // Check how many already have tickets array
    const withBothArrays = registrations.filter(reg => {
      const regData = reg.registrationData || reg.registration_data;
      return regData?.tickets && regData.tickets.length > 0;
    });
    
    console.log(`Registrations that already have tickets array: ${withBothArrays.length}`);
    console.log(`Registrations that need conversion: ${registrations.length - withBothArrays.length}`);
    
    console.log('\n=== CONVERSION PLAN ===');
    console.log('This script will:');
    console.log('1. Convert selectedTickets array to tickets array format');
    console.log('2. Handle eventTicketsId (with s) to eventTicketId (without s)');
    console.log('3. Add price, name, and proper structure for each ticket');
    console.log('4. Remove the selectedTickets array after conversion');
    console.log('5. Skip registrations that already have a tickets array');
    
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const stats: ConversionStats = {
      convertedCount: 0,
      skippedCount: 0,
      errorCount: 0
    };
    
    for (const registration of registrations) {
      try {
        const regData = registration.registrationData || registration.registration_data;
        
        // Skip if already has tickets array
        if (regData?.tickets && regData.tickets.length > 0) {
          stats.skippedCount++;
          continue;
        }
        
        if (regData && regData.selectedTickets && regData.selectedTickets.length > 0) {
          // Convert selectedTickets to tickets format
          const tickets: ConvertedTicket[] = [];
          
          regData.selectedTickets.forEach(selectedTicket => {
            // Handle both eventTicketsId (with s) and eventTicketId (without s)
            const eventTicketId = selectedTicket.eventTicketsId || selectedTicket.eventTicketId;
            const ticketInfo = eventTicketId ? ticketMap.get(eventTicketId) : undefined;
            const quantity = selectedTicket.quantity || 1;
            
            // Create ticket entries based on quantity
            for (let i = 0; i < quantity; i++) {
              tickets.push({
                id: `${registration.registrationId || registration.registration_id}-${eventTicketId}-${i}`,
                price: ticketInfo?.price || 0,
                isPackage: false,
                attendeeId: registration.primaryAttendeeId || registration.registrationId || registration.registration_id || '',
                eventTicketId: eventTicketId || '',
                name: ticketInfo?.name || selectedTicket.name || 'Unknown Ticket',
                quantity: 1
              });
            }
          });
          
          // Update the registration
          const updatePath = registration.registrationData ? 'registrationData' : 'registration_data';
          
          await db.collection('registrations').updateOne(
            { _id: registration._id },
            { 
              $set: { 
                [`${updatePath}.tickets`]: tickets 
              },
              $unset: {
                [`${updatePath}.selectedTickets`]: ""
              }
            }
          );
          
          stats.convertedCount++;
          
          if (stats.convertedCount <= 5) {
            console.log(`\nConverted registration ${registration.confirmationNumber}:`);
            console.log(`  Created ${tickets.length} ticket entries`);
            const summary: Record<string, number> = {};
            tickets.forEach(t => {
              const key = `${t.name} ($${t.price})`;
              summary[key] = (summary[key] || 0) + 1;
            });
            Object.entries(summary).forEach(([name, count]) => {
              console.log(`  - ${name}: ${count} tickets`);
            });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error converting registration ${registration._id}:`, errorMessage);
        stats.errorCount++;
      }
    }
    
    console.log('\n=== CONVERSION COMPLETE ===');
    console.log(`Total registrations processed: ${registrations.length}`);
    console.log(`Successfully converted: ${stats.convertedCount}`);
    console.log(`Skipped (already had tickets): ${stats.skippedCount}`);
    console.log(`Errors: ${stats.errorCount}`);
    
    // Verify the conversion
    console.log('\n=== VERIFICATION ===');
    
    // Check remaining selectedTickets
    const remainingSelectedTickets = await db.collection('registrations').countDocuments({
      $or: [
        { 'registrationData.selectedTickets': { $exists: true } },
        { 'registration_data.selectedTickets': { $exists: true } }
      ]
    });
    
    console.log(`Remaining registrations with selectedTickets: ${remainingSelectedTickets}`);
    
    // Show a sample converted registration
    if (stats.convertedCount > 0) {
      const convertedReg: Registration | null = await db.collection('registrations').findOne({
        $and: [
          { _id: registrations[0]._id },
          {
            $or: [
              { 'registrationData.tickets': { $exists: true } },
              { 'registration_data.tickets': { $exists: true } }
            ]
          }
        ]
      });
      
      if (convertedReg) {
        const regData = convertedReg.registrationData || convertedReg.registration_data;
        console.log('\nSample converted registration:');
        console.log(`Confirmation: ${convertedReg.confirmationNumber}`);
        console.log(`Tickets array (first 3):`, JSON.stringify(regData?.tickets?.slice(0, 3), null, 2));
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the conversion
convertSelectedTicketsToTickets();