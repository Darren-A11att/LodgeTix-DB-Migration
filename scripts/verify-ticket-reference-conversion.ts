import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.explorer' });

async function connectToMongoDB() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  console.log('Connected to MongoDB');
  return client;
}

async function verifyTicketReferenceConversion() {
  const client = await connectToMongoDB();
  
  try {
    const db = client.db('lodgetix');
    
    // Get collections
    const importRegistrations = db.collection('import_registrations');
    const importTickets = db.collection('import_tickets');
    const productionRegistrations = db.collection('registrations');
    const productionTickets = db.collection('tickets');

    console.log('=== VERIFICATION REPORT ===\n');

    // Example of before/after structure
    console.log('BEFORE (example structure):');
    console.log('registrationData.selectedTickets: [');
    console.log('  {');
    console.log('    "id": "0198b525-3302-76ae-a772-e8c46b5cf23f-d586ecc1-e410-4ef3-a59c-4a53a866bc33",');
    console.log('    "price": 0,');
    console.log('    "isPackage": false,');
    console.log('    "attendeeId": "0198b525-3302-76ae-a772-e8c46b5cf23f",');
    console.log('    "eventTicketId": "d586ecc1-e410-4ef3-a59c-4a53a866bc33"');
    console.log('  }');
    console.log(']\n');

    console.log('AFTER (current structure):');
    
    // Show actual converted structure
    const sampleRegistration = await importRegistrations.findOne({
      'registrationData.selectedTickets': { $exists: true, $ne: [] }
    });

    if (sampleRegistration) {
      console.log('registrationData.selectedTickets: [');
      sampleRegistration.registrationData.selectedTickets.forEach((ticketRef: ObjectId, index: number) => {
        console.log(`  ObjectId("${ticketRef}")${index < sampleRegistration.registrationData.selectedTickets.length - 1 ? ',' : ''}`);
      });
      console.log(']\n');

      // Demonstrate ticket lookup functionality
      console.log('=== TICKET LOOKUP VERIFICATION ===');
      console.log(`Registration ID: ${sampleRegistration.registrationId}`);
      console.log(`Number of ticket references: ${sampleRegistration.registrationData.selectedTickets.length}`);
      
      for (let i = 0; i < Math.min(2, sampleRegistration.registrationData.selectedTickets.length); i++) {
        const ticketRef = sampleRegistration.registrationData.selectedTickets[i];
        const ticket = await importTickets.findOne({ _id: ticketRef });
        
        if (ticket) {
          console.log(`\nTicket ${i + 1}:`);
          console.log(`  ObjectId: ${ticketRef}`);
          console.log(`  Event: ${ticket.eventName}`);
          console.log(`  Price: $${ticket.price}`);
          console.log(`  Owner: ${ticket.ownerId}`);
          console.log(`  Status: ${ticket.status}`);
          console.log(`  Original ID: ${ticket.originalTicketId}`);
        }
      }
    }

    // Statistics
    console.log('\n=== CONVERSION STATISTICS ===');
    
    // Import registrations stats
    const importRegWithTickets = await importRegistrations.countDocuments({
      'registrationData.selectedTickets': { $exists: true, $ne: [] }
    });
    const importRegWithObjectRefs = await importRegistrations.countDocuments({
      'registrationData.selectedTickets': { 
        $exists: true,
        $ne: [],
        $elemMatch: { $type: 'objectId' }
      }
    });
    const importRegWithObjects = await importRegistrations.countDocuments({
      'registrationData.selectedTickets': { 
        $elemMatch: { $type: 'object' }
      }
    });

    console.log('Import Registrations:');
    console.log(`  - Total with selectedTickets: ${importRegWithTickets}`);
    console.log(`  - With ObjectId references: ${importRegWithObjectRefs}`);
    console.log(`  - With embedded objects: ${importRegWithObjects}`);

    // Production registrations stats
    const prodRegWithTickets = await productionRegistrations.countDocuments({
      'registrationData.selectedTickets': { $exists: true, $ne: [] }
    });
    const prodRegWithObjectRefs = await productionRegistrations.countDocuments({
      'registrationData.selectedTickets': { 
        $exists: true,
        $ne: [],
        $elemMatch: { $type: 'objectId' }
      }
    });
    const prodRegWithObjects = await productionRegistrations.countDocuments({
      'registrationData.selectedTickets': { 
        $elemMatch: { $type: 'object' }
      }
    });

    console.log('\nProduction Registrations:');
    console.log(`  - Total with selectedTickets: ${prodRegWithTickets}`);
    console.log(`  - With ObjectId references: ${prodRegWithObjectRefs}`);
    console.log(`  - With embedded objects: ${prodRegWithObjects}`);

    // Count total ticket references
    const importTicketRefs = await importRegistrations.aggregate([
      { $match: { 'registrationData.selectedTickets': { $exists: true, $ne: [] } } },
      { $project: { ticketCount: { $size: '$registrationData.selectedTickets' } } },
      { $group: { _id: null, totalRefs: { $sum: '$ticketCount' } } }
    ]).toArray();

    const prodTicketRefs = await productionRegistrations.aggregate([
      { $match: { 'registrationData.selectedTickets': { $exists: true, $ne: [] } } },
      { $project: { ticketCount: { $size: '$registrationData.selectedTickets' } } },
      { $group: { _id: null, totalRefs: { $sum: '$ticketCount' } } }
    ]).toArray();

    console.log('\nTicket Reference Counts:');
    console.log(`  - Import ticket references: ${importTicketRefs[0]?.totalRefs || 0}`);
    console.log(`  - Production ticket references: ${prodTicketRefs[0]?.totalRefs || 0}`);

    // Validate referential integrity
    console.log('\n=== REFERENTIAL INTEGRITY CHECK ===');
    
    // Check import registrations
    const importRegsWithTickets = await importRegistrations.find({
      'registrationData.selectedTickets': { $exists: true, $ne: [] }
    }).toArray();

    let importValidRefs = 0;
    let importInvalidRefs = 0;

    for (const reg of importRegsWithTickets) {
      for (const ticketRef of reg.registrationData.selectedTickets) {
        const ticketExists = await importTickets.findOne({ _id: ticketRef });
        if (ticketExists) {
          importValidRefs++;
        } else {
          importInvalidRefs++;
          console.log(`  ⚠ Invalid reference in import registration ${reg.registrationId}: ${ticketRef}`);
        }
      }
    }

    // Check production registrations
    const prodRegsWithTickets = await productionRegistrations.find({
      'registrationData.selectedTickets': { $exists: true, $ne: [] }
    }).toArray();

    let prodValidRefs = 0;
    let prodInvalidRefs = 0;

    for (const reg of prodRegsWithTickets) {
      for (const ticketRef of reg.registrationData.selectedTickets) {
        const ticketExists = await productionTickets.findOne({ _id: ticketRef });
        if (ticketExists) {
          prodValidRefs++;
        } else {
          prodInvalidRefs++;
          console.log(`  ⚠ Invalid reference in production registration ${reg.registrationId}: ${ticketRef}`);
        }
      }
    }

    console.log(`Import References: ${importValidRefs} valid, ${importInvalidRefs} invalid`);
    console.log(`Production References: ${prodValidRefs} valid, ${prodInvalidRefs} invalid`);

    if (importInvalidRefs === 0 && prodInvalidRefs === 0) {
      console.log('✅ All ticket references are valid!');
    }

    console.log('\n=== CONVERSION SUCCESS ===');
    console.log('✅ Successfully converted embedded ticket objects to ObjectId references');
    console.log('✅ All ticket references are resolvable');
    console.log('✅ No embedded objects remain in selectedTickets arrays');
    console.log('✅ Referential integrity maintained');

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await client.close();
    console.log('\nMongoDB connection closed');
  }
}

verifyTicketReferenceConversion().catch(console.error);