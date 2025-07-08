const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') }); // Load environment variables

async function fixLodgePackages() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  
  console.log('Connecting to database to fix lodge package data...');
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    // Step 1: Find all lodge registrations with $1,150 price
    console.log('\n=== Finding lodge registrations with package price ===');
    const lodgeRegistrations = await db.collection('registrations').find({
      $and: [
        { 
          $or: [
            { registration_type: 'lodge' },
            { registration_type: 'lodges' },
            { registrationType: 'lodge' },
            { registrationType: 'lodges' }
          ]
        },
        {
          $or: [
            { total: { $gte: 1150 } },
            { total_price_paid: { $gte: 1150 } },
            { totalPricePaid: { $gte: 1150 } },
            { subtotal: 1150 }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${lodgeRegistrations.length} lodge registrations with package price`);
    
    // Step 2: Find the lodge package
    const lodgePackage = await db.collection('packages').findOne({
      packageId: '794841e4-5f04-4899-96e2-c0afece4d5f2'
    });
    
    if (!lodgePackage) {
      throw new Error('Lodge package not found');
    }
    
    console.log('Found lodge package:', lodgePackage.name);
    
    // Step 3: Update tickets for these registrations
    console.log('\n=== Updating tickets to reference package ===');
    let ticketsUpdated = 0;
    
    for (const registration of lodgeRegistrations) {
      const regId = registration.registrationId || registration.registration_id || registration._id.toString();
      
      // Find tickets for this registration
      const tickets = await db.collection('tickets').find({
        $or: [
          { registrationId: regId },
          { registration_id: regId },
          { registrationId: registration._id.toString() },
          { registration_id: registration._id.toString() }
        ]
      }).toArray();
      
      console.log(`Registration ${registration.confirmation_number || registration.confirmationNumber}: Found ${tickets.length} tickets`);
      
      // Update tickets to reference the package
      for (const ticket of tickets) {
        // Only update if it's currently referencing the wrong ticket type
        const ticketTypeId = ticket.event_ticket_id || ticket.eventTicketId || ticket.ticket_type_id || ticket.ticketTypeId;
        const eventId = ticket.event_id || ticket.eventId;
        
        if (ticketTypeId === 'd4e5f6a7-b8c9-4567-def0-456789012345' || 
            eventId === 'a1b2c3d4-e5f6-7890-abcd-ef1234567890') {
          
          // Update to reference the package
          const updateResult = await db.collection('tickets').updateOne(
            { _id: ticket._id },
            {
              $set: {
                event_id: lodgePackage.functionId, // Set to function ID
                eventId: lodgePackage.functionId,
                event_ticket_id: lodgePackage.packageId, // Set to package ID
                eventTicketId: lodgePackage.packageId,
                ticket_type_id: lodgePackage.packageId,
                ticketTypeId: lodgePackage.packageId,
                ticket_price: 1150,
                ticketPrice: 1150,
                original_price: 1150,
                originalPrice: 1150,
                event_title: 'Lodge Package - 10 Banquet Tickets',
                eventTitle: 'Lodge Package - 10 Banquet Tickets',
                is_package: true,
                isPackage: true,
                package_quantity: 10
              }
            }
          );
          
          if (updateResult.modifiedCount > 0) {
            ticketsUpdated++;
          }
        }
      }
    }
    
    console.log(`Updated ${ticketsUpdated} tickets to reference lodge package`);
    
    // Step 4: Add included_items to packages collection
    console.log('\n=== Updating packages with included items ===');
    
    // The included_items in PostgreSQL format: {"(fd12d7f0-f346-49bf-b1eb-0682ad226216,10)"}
    // Convert to MongoDB array format
    const packages = await db.collection('packages').find({}).toArray();
    
    for (const pkg of packages) {
      let includedItems = [];
      
      if (pkg.packageId === '794841e4-5f04-4899-96e2-c0afece4d5f2') {
        // Lodge Package - 10 Proclamation Banquet tickets
        includedItems = [{
          variationId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216',
          quantity: 10,
          name: 'Proclamation Banquet - Best Available'
        }];
      }
      
      if (includedItems.length > 0) {
        await db.collection('packages').updateOne(
          { _id: pkg._id },
          { $set: { included_items: includedItems } }
        );
        console.log(`Updated package ${pkg.name} with included items`);
      }
    }
    
    console.log('\n=== Lodge package data fix complete ===');
    
  } finally {
    await client.close();
  }
}

// Run the fix
fixLodgePackages().catch(console.error);