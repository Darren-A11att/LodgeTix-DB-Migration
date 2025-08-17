import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.explorer' });

async function connectToMongoDB() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  console.log('Connected to MongoDB');
  return client;
}

async function examineTicketStructure() {
  const client = await connectToMongoDB();
  
  try {
    const db = client.db('lodgetix');
    
    // Get collections
    const importRegistrations = db.collection('import_registrations');
    const importTickets = db.collection('import_tickets');
    const productionRegistrations = db.collection('registrations');
    const productionTickets = db.collection('tickets');

    console.log('=== EXAMINING COLLECTION STRUCTURES ===\n');

    // Check import registrations
    console.log('--- Import Registrations ---');
    const importRegCount = await importRegistrations.countDocuments();
    console.log(`Total import registrations: ${importRegCount}`);
    
    if (importRegCount > 0) {
      const sampleImportReg = await importRegistrations.findOne();
      console.log('Sample import registration structure:');
      console.log(JSON.stringify(sampleImportReg, null, 2));
      
      // Check for any registrations with tickets
      const regWithTickets = await importRegistrations.findOne({
        $or: [
          { 'registration_data.tickets': { $exists: true } },
          { 'tickets': { $exists: true } },
          { 'ticket_ids': { $exists: true } },
          { 'ticketIds': { $exists: true } }
        ]
      });
      
      if (regWithTickets) {
        console.log('\nRegistration with tickets found:');
        console.log(JSON.stringify(regWithTickets, null, 2));
      } else {
        console.log('\nNo registrations found with ticket fields');
      }
    }

    // Check import tickets
    console.log('\n--- Import Tickets ---');
    const importTicketCount = await importTickets.countDocuments();
    console.log(`Total import tickets: ${importTicketCount}`);
    
    if (importTicketCount > 0) {
      const sampleImportTicket = await importTickets.findOne();
      console.log('Sample import ticket structure:');
      console.log(JSON.stringify(sampleImportTicket, null, 2));
    }

    // Check production registrations
    console.log('\n--- Production Registrations ---');
    const prodRegCount = await productionRegistrations.countDocuments();
    console.log(`Total production registrations: ${prodRegCount}`);
    
    if (prodRegCount > 0) {
      const sampleProdReg = await productionRegistrations.findOne();
      console.log('Sample production registration structure:');
      console.log(JSON.stringify(sampleProdReg, null, 2));
      
      // Check for any registrations with tickets
      const prodRegWithTickets = await productionRegistrations.findOne({
        $or: [
          { 'registration_data.tickets': { $exists: true } },
          { 'tickets': { $exists: true } },
          { 'ticket_ids': { $exists: true } },
          { 'ticketIds': { $exists: true } },
          { 'registration_data.ticket_details': { $exists: true } }
        ]
      });
      
      if (prodRegWithTickets) {
        console.log('\nProduction registration with tickets found:');
        console.log(JSON.stringify(prodRegWithTickets, null, 2));
      } else {
        console.log('\nNo production registrations found with ticket fields');
      }
    }

    // Check production tickets
    console.log('\n--- Production Tickets ---');
    const prodTicketCount = await productionTickets.countDocuments();
    console.log(`Total production tickets: ${prodTicketCount}`);
    
    if (prodTicketCount > 0) {
      const sampleProdTicket = await productionTickets.findOne();
      console.log('Sample production ticket structure:');
      console.log(JSON.stringify(sampleProdTicket, null, 2));
    }

    // Search for any fields that might contain ticket data
    console.log('\n=== SEARCHING FOR TICKET-RELATED FIELDS ===');
    
    // Search import registrations for any ticket-related fields
    const importRegFields = await importRegistrations.aggregate([
      { $project: { 
          allFields: { $objectToArray: "$$ROOT" } 
        }
      },
      { $unwind: "$allFields" },
      { $match: { 
          "allFields.k": { $regex: /ticket/i } 
        }
      },
      { $group: { 
          _id: "$allFields.k",
          count: { $sum: 1 },
          sampleValue: { $first: "$allFields.v" }
        }
      }
    ]).toArray();
    
    console.log('\nImport registrations ticket-related fields:');
    console.log(JSON.stringify(importRegFields, null, 2));

    // Search production registrations for any ticket-related fields
    const prodRegFields = await productionRegistrations.aggregate([
      { $project: { 
          allFields: { $objectToArray: "$$ROOT" } 
        }
      },
      { $unwind: "$allFields" },
      { $match: { 
          "allFields.k": { $regex: /ticket/i } 
        }
      },
      { $group: { 
          _id: "$allFields.k",
          count: { $sum: 1 },
          sampleValue: { $first: "$allFields.v" }
        }
      }
    ]).toArray();
    
    console.log('\nProduction registrations ticket-related fields:');
    console.log(JSON.stringify(prodRegFields, null, 2));

  } catch (error) {
    console.error('Error during examination:', error);
  } finally {
    await client.close();
    console.log('\nMongoDB connection closed');
  }
}

examineTicketStructure().catch(console.error);