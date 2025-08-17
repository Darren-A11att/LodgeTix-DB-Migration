import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.explorer' });

interface SelectedTicket {
  id: string;
  price: number;
  isPackage: boolean;
  attendeeId: string;
  eventTicketId: string;
}

interface RegistrationData {
  _id: ObjectId;
  registrationData: {
    selectedTickets?: (SelectedTicket | ObjectId)[];
    [key: string]: any;
  };
  [key: string]: any;
}

interface ConversionStats {
  registrationsProcessed: number;
  ticketReferencesCreated: number;
  ticketsFoundInCollection: number;
  ticketsNotFound: number;
  errorCount: number;
}

async function connectToMongoDB() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  console.log('Connected to MongoDB');
  return client;
}

async function findTicketByOriginalId(originalTicketId: string, ticketsCollection: any): Promise<ObjectId | null> {
  // Try to find by originalTicketId first
  let ticket = await ticketsCollection.findOne({ originalTicketId: originalTicketId });
  
  if (ticket) {
    return ticket._id;
  }

  // Try to find by ticketId
  ticket = await ticketsCollection.findOne({ ticketId: originalTicketId });
  
  if (ticket) {
    return ticket._id;
  }

  return null;
}

async function convertSelectedTicketsToRefs(
  registrationsCollection: any, 
  ticketsCollection: any, 
  collectionName: string
): Promise<ConversionStats> {
  const stats: ConversionStats = {
    registrationsProcessed: 0,
    ticketReferencesCreated: 0,
    ticketsFoundInCollection: 0,
    ticketsNotFound: 0,
    errorCount: 0
  };

  console.log(`\n=== Converting ${collectionName} ===`);

  // Find all registrations with selectedTickets arrays containing objects
  const registrationsWithSelectedTickets = await registrationsCollection.find({
    'registrationData.selectedTickets': { 
      $exists: true, 
      $ne: [],
      $elemMatch: { $type: 'object' } // Find arrays containing objects (not just ObjectIds)
    }
  }).toArray();

  console.log(`Found ${registrationsWithSelectedTickets.length} registrations with selectedTickets objects`);

  if (registrationsWithSelectedTickets.length === 0) {
    // Check if there are any registrations with selectedTickets at all
    const anyWithSelectedTickets = await registrationsCollection.countDocuments({
      'registrationData.selectedTickets': { $exists: true, $ne: [] }
    });
    console.log(`Total registrations with any selectedTickets: ${anyWithSelectedTickets}`);
    
    if (anyWithSelectedTickets > 0) {
      const sample = await registrationsCollection.findOne({
        'registrationData.selectedTickets': { $exists: true, $ne: [] }
      });
      console.log(`Sample selectedTickets structure:`, JSON.stringify(sample.registrationData.selectedTickets?.[0], null, 2));
    }
    
    return stats;
  }

  for (const registration of registrationsWithSelectedTickets) {
    try {
      const selectedTickets = registration.registrationData.selectedTickets || [];
      const newTicketRefs: ObjectId[] = [];

      console.log(`\nProcessing registration ${registration.registrationId} with ${selectedTickets.length} selected tickets`);

      for (const selectedTicket of selectedTickets) {
        // Skip if already an ObjectId
        if (selectedTicket instanceof ObjectId || 
            (typeof selectedTicket === 'string' && ObjectId.isValid(selectedTicket))) {
          try {
            newTicketRefs.push(new ObjectId(selectedTicket));
            continue;
          } catch (e) {
            console.log(`Invalid ObjectId: ${selectedTicket}, treating as object`);
          }
        }

        // Process selectedTicket object
        if (typeof selectedTicket === 'object' && selectedTicket !== null) {
          try {
            // The selectedTicket.id is the original ticket ID we need to find
            const ticketObjectId = await findTicketByOriginalId(selectedTicket.id, ticketsCollection);
            
            if (ticketObjectId) {
              newTicketRefs.push(ticketObjectId);
              stats.ticketReferencesCreated++;
              stats.ticketsFoundInCollection++;
              console.log(`  ✓ Found ticket ${selectedTicket.id} -> ${ticketObjectId}`);
            } else {
              console.log(`  ✗ Ticket not found: ${selectedTicket.id}`);
              stats.ticketsNotFound++;
            }
          } catch (error) {
            console.error(`  Error processing selectedTicket:`, error);
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
              'registrationData.selectedTickets': newTicketRefs 
            }
          }
        );
        stats.registrationsProcessed++;
        console.log(`  ✓ Updated registration with ${newTicketRefs.length} ticket references`);
      } else {
        console.log(`  ⚠ No valid ticket references found for registration`);
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

  // Check for remaining selectedTicket objects
  const remainingObjects = await registrationsCollection.countDocuments({
    'registrationData.selectedTickets': { 
      $elemMatch: { $type: 'object' }
    }
  });

  console.log(`Remaining selectedTickets objects: ${remainingObjects}`);

  // Sample a converted registration
  const convertedSample = await registrationsCollection.findOne({
    'registrationData.selectedTickets': { $exists: true, $ne: [] }
  });

  if (convertedSample) {
    console.log(`Sample converted selectedTickets:`, convertedSample.registrationData.selectedTickets);

    // Verify we can look up the tickets
    if (convertedSample.registrationData.selectedTickets?.length > 0) {
      const firstTicketId = convertedSample.registrationData.selectedTickets[0];
      const ticketLookup = await ticketsCollection.findOne({ _id: firstTicketId });
      console.log(`Ticket lookup successful:`, !!ticketLookup);
      if (ticketLookup) {
        console.log(`Sample ticket lookup result:`, JSON.stringify({
          _id: ticketLookup._id,
          ticketId: ticketLookup.ticketId,
          originalTicketId: ticketLookup.originalTicketId,
          eventName: ticketLookup.eventName,
          ownerId: ticketLookup.ownerId
        }, null, 2));
      }
    }
  }

  // Check total counts
  const totalRegistrationsWithTickets = await registrationsCollection.countDocuments({
    'registrationData.selectedTickets': { $exists: true, $ne: [] }
  });
  console.log(`Total registrations with selectedTickets: ${totalRegistrationsWithTickets}`);
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

    console.log('Starting selectedTickets conversion process...');

    // Convert import registrations
    const importStats = await convertSelectedTicketsToRefs(
      importRegistrations, 
      importTickets, 
      'import_registrations'
    );

    // Convert production registrations  
    const productionStats = await convertSelectedTicketsToRefs(
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
    console.log(`  - Tickets found in collection: ${importStats.ticketsFoundInCollection}`);
    console.log(`  - Tickets not found: ${importStats.ticketsNotFound}`);
    console.log(`  - Errors: ${importStats.errorCount}`);

    console.log('\nProduction Registrations:');
    console.log(`  - Registrations converted: ${productionStats.registrationsProcessed}`);
    console.log(`  - Ticket references created: ${productionStats.ticketReferencesCreated}`);
    console.log(`  - Tickets found in collection: ${productionStats.ticketsFoundInCollection}`);
    console.log(`  - Tickets not found: ${productionStats.ticketsNotFound}`);
    console.log(`  - Errors: ${productionStats.errorCount}`);

    console.log('\nTotal Summary:');
    console.log(`  - Total registrations converted: ${importStats.registrationsProcessed + productionStats.registrationsProcessed}`);
    console.log(`  - Total ticket references created: ${importStats.ticketReferencesCreated + productionStats.ticketReferencesCreated}`);
    console.log(`  - Total tickets found: ${importStats.ticketsFoundInCollection + productionStats.ticketsFoundInCollection}`);
    console.log(`  - Total tickets not found: ${importStats.ticketsNotFound + productionStats.ticketsNotFound}`);
    console.log(`  - Total errors: ${importStats.errorCount + productionStats.errorCount}`);

  } catch (error) {
    console.error('Error during conversion:', error);
  } finally {
    await client.close();
    console.log('\nMongoDB connection closed');
  }
}

main().catch(console.error);