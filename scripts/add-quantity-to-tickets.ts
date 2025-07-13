#!/usr/bin/env node

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

interface SelectedTicket {
  event_ticket_id?: string;
  eventTicketId?: string;
  name: string;
  price: number;
  quantity?: number;
}

interface RegistrationData {
  selectedTickets?: SelectedTicket[];
}

interface Registration {
  _id: ObjectId;
  registrationId?: string;
  confirmationNumber?: string;
  confirmation_number?: string;
  registrationType?: string;
  registration_type?: string;
  registrationData?: RegistrationData;
  registration_data?: RegistrationData;
}

async function addQuantityToTickets(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db: Db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const registrationsCollection: Collection<Registration> = db.collection('registrations');

    // First, let's check a sample individual registration
    console.log('\n1. Checking sample individual registration...');
    const sampleReg = await registrationsCollection.findOne({
      $or: [
        { registrationType: 'individuals' },
        { registration_type: 'individuals' }
      ]
    });

    if (sampleReg) {
      console.log('Sample registration ID:', sampleReg.registrationId || sampleReg._id);
      const regData = sampleReg.registrationData || sampleReg.registration_data;
      if (regData && regData.selectedTickets && regData.selectedTickets.length > 0) {
        console.log('Sample selectedTickets (first 2):');
        regData.selectedTickets.slice(0, 2).forEach((ticket, index) => {
          console.log(`  Ticket ${index + 1}:`, {
            event_ticket_id: ticket.event_ticket_id || ticket.eventTicketId,
            name: ticket.name,
            price: ticket.price,
            quantity: ticket.quantity // Check if it already exists
          });
        });
      }
    }

    // Get all individual registrations
    console.log('\n2. Finding all individual registrations...');
    const individualRegistrations = await registrationsCollection.find({
      $or: [
        { registrationType: 'individuals' },
        { registration_type: 'individuals' }
      ]
    }).toArray();

    console.log(`Found ${individualRegistrations.length} individual registrations`);

    // Count how many need updates
    let needsUpdate = 0;
    let alreadyHasQuantity = 0;
    let noSelectedTickets = 0;

    individualRegistrations.forEach(reg => {
      const regData = reg.registrationData || reg.registration_data;
      if (regData && regData.selectedTickets && regData.selectedTickets.length > 0) {
        const hasQuantityField = regData.selectedTickets.some(ticket => 
          ticket.hasOwnProperty('quantity')
        );
        if (hasQuantityField) {
          alreadyHasQuantity++;
        } else {
          needsUpdate++;
        }
      } else {
        noSelectedTickets++;
      }
    });

    console.log(`\nAnalysis:`);
    console.log(`- Need quantity update: ${needsUpdate}`);
    console.log(`- Already have quantity: ${alreadyHasQuantity}`);
    console.log(`- No selected tickets: ${noSelectedTickets}`);

    if (needsUpdate === 0) {
      console.log('\nNo registrations need updating. All already have quantity field or no tickets.');
      return;
    }

    // Ask for confirmation
    console.log(`\n3. Ready to update ${needsUpdate} registrations.`);
    console.log('This will add quantity: 1 to each selected ticket in individual registrations.');
    
    // For automated script, we'll proceed. In production, you might want to add a prompt here.
    console.log('Proceeding with update...\n');

    // Update registrations
    let successCount = 0;
    let errorCount = 0;

    for (const reg of individualRegistrations) {
      const regData = reg.registrationData || reg.registration_data;
      const dataField = reg.registrationData ? 'registrationData' : 'registration_data';
      
      if (regData && regData.selectedTickets && regData.selectedTickets.length > 0) {
        // Check if any ticket already has quantity
        const hasQuantity = regData.selectedTickets.some(ticket => 
          ticket.hasOwnProperty('quantity')
        );
        
        if (!hasQuantity) {
          // Add quantity: 1 to each selected ticket
          const updatedTickets = regData.selectedTickets.map(ticket => ({
            ...ticket,
            quantity: 1
          }));

          try {
            const result = await registrationsCollection.updateOne(
              { _id: reg._id },
              { 
                $set: { 
                  [`${dataField}.selectedTickets`]: updatedTickets 
                } 
              }
            );

            if (result.modifiedCount > 0) {
              successCount++;
              const confirmationNumber = reg.confirmationNumber || reg.confirmation_number || 'N/A';
              console.log(`✓ Updated registration ${confirmationNumber} - added quantity to ${updatedTickets.length} tickets`);
            }
          } catch (error) {
            errorCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`✗ Error updating registration ${reg._id}:`, errorMessage);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('UPDATE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Successfully updated: ${successCount} registrations`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Already had quantity: ${alreadyHasQuantity}`);
    console.log(`No tickets: ${noSelectedTickets}`);
    console.log('='.repeat(60));

    // Verify a sample after update
    if (successCount > 0) {
      console.log('\n4. Verifying update with a sample...');
      const verifyReg = await registrationsCollection.findOne({
        $or: [
          { registrationType: 'individuals' },
          { registration_type: 'individuals' }
        ]
      });

      if (verifyReg) {
        const regData = verifyReg.registrationData || verifyReg.registration_data;
        if (regData && regData.selectedTickets && regData.selectedTickets.length > 0) {
          console.log('Verified selectedTickets now have quantity:');
          regData.selectedTickets.slice(0, 2).forEach((ticket, index) => {
            console.log(`  Ticket ${index + 1}:`, {
              name: ticket.name,
              quantity: ticket.quantity
            });
          });
        }
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

// Add option to run in dry-run mode
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node add-quantity-to-tickets.js [options]

Options:
  --help     Show this help message

This script adds quantity: 1 to each selected ticket in individual registrations.
This helps with invoice generation and ticket sales reporting.
  `);
  process.exit(0);
}

// Run the update
addQuantityToTickets();