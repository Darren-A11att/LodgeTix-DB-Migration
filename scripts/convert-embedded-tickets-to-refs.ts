import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.explorer' });

interface TicketData {
  _id?: ObjectId;
  ticket_id?: string;
  type?: string;
  name?: string;
  price?: number;
  [key: string]: any;
}

interface RegistrationData {
  _id: ObjectId;
  registration_data: {
    tickets?: (TicketData | ObjectId)[];
    [key: string]: any;
  };
  [key: string]: any;
}

interface ConversionStats {
  registrationsProcessed: number;
  ticketReferencesCreated: number;
  ticketsFoundInCollection: number;
  ticketsCreatedNew: number;
  errorCount: number;
}

async function connectToMongoDB() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  console.log('Connected to MongoDB');
  return client;
}

async function findOrCreateTicket(ticketData: TicketData, ticketsCollection: any): Promise<ObjectId> {
  // Try to find existing ticket by ticket_id first
  if (ticketData.ticket_id) {
    const existingTicket = await ticketsCollection.findOne({ ticket_id: ticketData.ticket_id });
    if (existingTicket) {
      return existingTicket._id;
    }
  }

  // Try to find by name and type if no ticket_id
  if (ticketData.name && ticketData.type) {
    const existingTicket = await ticketsCollection.findOne({ 
      name: ticketData.name, 
      type: ticketData.type 
    });
    if (existingTicket) {
      return existingTicket._id;
    }
  }

  // Create new ticket if not found
  const result = await ticketsCollection.insertOne(ticketData);
  return result.insertedId;
}

async function convertRegistrationTickets(
  registrationsCollection: any, 
  ticketsCollection: any, 
  collectionName: string
): Promise<ConversionStats> {
  const stats: ConversionStats = {
    registrationsProcessed: 0,
    ticketReferencesCreated: 0,
    ticketsFoundInCollection: 0,
    ticketsCreatedNew: 0,
    errorCount: 0
  };

  console.log(`\n=== Converting ${collectionName} ===`);

  // First, let's examine the current structure
  const sampleRegistration = await registrationsCollection.findOne({
    'registration_data.tickets': { $exists: true, $ne: [] }
  });

  if (!sampleRegistration) {
    console.log(`No registrations found with tickets in ${collectionName}`);
    return stats;
  }

  console.log(`Sample registration structure:`, JSON.stringify(sampleRegistration.registration_data.tickets?.[0], null, 2));

  // Find all registrations with embedded ticket objects
  const registrationsWithTickets = await registrationsCollection.find({
    'registration_data.tickets': { 
      $exists: true, 
      $ne: [],
      $elemMatch: { $type: 'object' } // Find arrays containing objects (not just ObjectIds)
    }
  }).toArray();

  console.log(`Found ${registrationsWithTickets.length} registrations with embedded tickets`);

  for (const registration of registrationsWithTickets) {
    try {
      const tickets = registration.registration_data.tickets || [];
      const newTicketRefs: ObjectId[] = [];

      for (const ticket of tickets) {
        // Skip if already an ObjectId
        if (ticket instanceof ObjectId || typeof ticket === 'string') {
          try {
            newTicketRefs.push(new ObjectId(ticket));
            continue;
          } catch (e) {
            console.log(`Invalid ObjectId: ${ticket}, treating as embedded object`);
          }
        }

        // Process embedded ticket object
        if (typeof ticket === 'object' && ticket !== null) {
          try {
            const ticketId = await findOrCreateTicket(ticket, ticketsCollection);
            newTicketRefs.push(ticketId);
            stats.ticketReferencesCreated++;
            
            // Check if this was a new ticket or existing
            const isNewTicket = !ticket._id;
            if (isNewTicket) {
              stats.ticketsCreatedNew++;
            } else {
              stats.ticketsFoundInCollection++;
            }
          } catch (error) {
            console.error(`Error processing ticket:`, error);
            stats.errorCount++;
          }
        }
      }

      // Update the registration with ObjectId references
      if (newTicketRefs.length > 0) {
        await registrationsCollection.updateOne(
          { _id: registration._id },
          { 
            $set: { 
              'registration_data.tickets': newTicketRefs 
            }
          }
        );
        stats.registrationsProcessed++;
      }

    } catch (error) {
      console.error(`Error processing registration ${registration._id}:`, error);
      stats.errorCount++;
    }
  }

  return stats;
}

async function verifyConversion(registrationsCollection: any, ticketsCollection: any, collectionName: string) {
  console.log(`\n=== Verifying ${collectionName} Conversion ===`);

  // Check for remaining embedded objects
  const remainingEmbedded = await registrationsCollection.countDocuments({
    'registration_data.tickets': { 
      $elemMatch: { $type: 'object' }
    }
  });

  console.log(`Remaining embedded ticket objects: ${remainingEmbedded}`);

  // Sample a converted registration
  const convertedSample = await registrationsCollection.findOne({
    'registration_data.tickets': { $exists: true, $ne: [] }
  });

  if (convertedSample) {
    console.log(`Sample converted registration tickets:`, convertedSample.registration_data.tickets);

    // Verify we can look up the tickets
    if (convertedSample.registration_data.tickets?.length > 0) {
      const firstTicketId = convertedSample.registration_data.tickets[0];
      const ticketLookup = await ticketsCollection.findOne({ _id: firstTicketId });
      console.log(`Ticket lookup successful:`, !!ticketLookup);
      if (ticketLookup) {
        console.log(`Sample ticket:`, JSON.stringify({
          _id: ticketLookup._id,
          ticket_id: ticketLookup.ticket_id,
          name: ticketLookup.name,
          type: ticketLookup.type
        }, null, 2));
      }
    }
  }
}

async function main() {
  const client = await connectToMongoDB();
  
  try {
    const db = client.db('lodgetix');
    
    // Get collections
    const importRegistrations = db.collection('import_registrations');
    const importTickets = db.collection('import_tickets');
    const productionRegistrations = db.collection('registrations');
    const productionTickets = db.collection('tickets');

    console.log('Starting ticket conversion process...');

    // Convert import registrations
    const importStats = await convertRegistrationTickets(
      importRegistrations, 
      importTickets, 
      'import_registrations'
    );

    // Convert production registrations  
    const productionStats = await convertRegistrationTickets(
      productionRegistrations, 
      productionTickets, 
      'production registrations'
    );

    // Verify conversions
    await verifyConversion(importRegistrations, importTickets, 'import_registrations');
    await verifyConversion(productionRegistrations, productionTickets, 'production registrations');

    // Summary report
    console.log('\n=== CONVERSION SUMMARY ===');
    console.log('Import Registrations:');
    console.log(`  - Registrations converted: ${importStats.registrationsProcessed}`);
    console.log(`  - Ticket references created: ${importStats.ticketReferencesCreated}`);
    console.log(`  - Existing tickets found: ${importStats.ticketsFoundInCollection}`);
    console.log(`  - New tickets created: ${importStats.ticketsCreatedNew}`);
    console.log(`  - Errors: ${importStats.errorCount}`);

    console.log('\nProduction Registrations:');
    console.log(`  - Registrations converted: ${productionStats.registrationsProcessed}`);
    console.log(`  - Ticket references created: ${productionStats.ticketReferencesCreated}`);
    console.log(`  - Existing tickets found: ${productionStats.ticketsFoundInCollection}`);
    console.log(`  - New tickets created: ${productionStats.ticketsCreatedNew}`);
    console.log(`  - Errors: ${productionStats.errorCount}`);

    console.log('\nTotal Summary:');
    console.log(`  - Total registrations converted: ${importStats.registrationsProcessed + productionStats.registrationsProcessed}`);
    console.log(`  - Total ticket references created: ${importStats.ticketReferencesCreated + productionStats.ticketReferencesCreated}`);
    console.log(`  - Total tickets found: ${importStats.ticketsFoundInCollection + productionStats.ticketsFoundInCollection}`);
    console.log(`  - Total new tickets created: ${importStats.ticketsCreatedNew + productionStats.ticketsCreatedNew}`);
    console.log(`  - Total errors: ${importStats.errorCount + productionStats.errorCount}`);

  } catch (error) {
    console.error('Error during conversion:', error);
  } finally {
    await client.close();
    console.log('\nMongoDB connection closed');
  }
}

main().catch(console.error);