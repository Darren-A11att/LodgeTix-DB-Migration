import { MongoClient } from 'mongodb';

async function checkPackageExpansion() {
  const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    // 1. Check the package
    const packageId = '88567b9c-9675-4ee2-b572-eace1c580eb4';
    const registrationId = '43f3fa8b-e605-44cf-af81-d4250eaa276f';
    
    console.log('=== PACKAGE INVESTIGATION ===\n');
    
    // Get package details
    const pkg = await db.collection('packages').findOne({ packageId: packageId });
    
    if (pkg) {
      console.log('✅ Package found:', packageId);
      console.log('Package name:', pkg.name);
      console.log('Number of includedItems:', pkg.includedItems ? pkg.includedItems.length : 0);
      
      if (pkg.includedItems) {
        console.log('\n📦 Included items in package:');
        pkg.includedItems.forEach((item: any, idx: number) => {
          console.log(`  ${idx + 1}. ${item.name || 'No name'}`);
          console.log(`     - eventTicketId: ${item.eventTicketId}`);
          console.log(`     - price: $${item.price || 0}`);
          console.log(`     - quantity: ${item.quantity || 1}`);
        });
      }
    } else {
      console.log('❌ Package not found');
    }
    
    // 2. Check the registration
    console.log('\n=== REGISTRATION INVESTIGATION ===\n');
    
    const registration = await db.collection('registrations').findOne({ id: registrationId });
    
    if (registration) {
      console.log('✅ Registration found:', registrationId);
      
      // Check tickets in registration_data
      const ticketsData = registration.registration_data?.selectedTickets || 
                         registration.registration_data?.tickets || 
                         registration.registrationData?.selectedTickets || 
                         registration.registrationData?.tickets || [];
      
      console.log('Number of tickets in registration_data:', ticketsData.length);
      
      // Show all tickets in registration
      console.log('\n📋 All tickets in registration_data:');
      ticketsData.forEach((ticket: any, idx: number) => {
        console.log(`  ${idx + 1}. Ticket:`);
        console.log(`     - isPackage: ${ticket.isPackage}`);
        console.log(`     - packageId: ${ticket.packageId || 'none'}`);
        console.log(`     - eventTicketId: ${ticket.eventTicketId || 'none'}`);
        console.log(`     - ticketId: ${ticket.ticketId || ticket.id || 'none'}`);
        console.log(`     - attendeeId: ${ticket.attendeeId || 'none'}`);
        console.log(`     - price: $${ticket.price || 0}`);
      });
      
      // Check for package ticket
      const packageTicket = ticketsData.find((t: any) => t.isPackage === true || t.packageId === packageId);
      if (packageTicket) {
        console.log('\n📦 Package ticket detected:');
        console.log('  - isPackage:', packageTicket.isPackage);
        console.log('  - packageId:', packageTicket.packageId);
        console.log('  - eventTicketId:', packageTicket.eventTicketId);
        console.log('  - attendeeId:', packageTicket.attendeeId);
      }
    } else {
      console.log('❌ Registration not found');
    }
    
    // 3. Check imported tickets
    console.log('\n=== IMPORTED TICKETS INVESTIGATION ===\n');
    
    const importedTickets = await db.collection('import_tickets').find({ 
      'data.originalRegistrationId': registrationId 
    }).toArray();
    
    console.log('Total tickets imported for this registration:', importedTickets.length);
    
    if (importedTickets.length > 0) {
      console.log('\n📋 Imported tickets:');
      importedTickets.forEach((ticket: any, idx: number) => {
        console.log(`  ${idx + 1}. ${ticket.data.eventName}`);
        console.log(`     - ticketId: ${ticket.data.ticketId}`);
        console.log(`     - eventTicketId: ${ticket.data.eventTicketId}`);
        console.log(`     - isFromPackage: ${ticket.data.isFromPackage}`);
        console.log(`     - parentPackageId: ${ticket.data.parentPackageId}`);
        console.log(`     - price: $${ticket.data.price}`);
      });
      
      // Check which items from the package were NOT created
      if (pkg && pkg.includedItems) {
        console.log('\n⚠️ MISSING TICKETS ANALYSIS:');
        const createdEventTicketIds = importedTickets.map((t: any) => t.data.eventTicketId);
        
        pkg.includedItems.forEach((item: any) => {
          if (!createdEventTicketIds.includes(item.eventTicketId)) {
            console.log(`  ❌ MISSING: ${item.name} (${item.eventTicketId})`);
          } else {
            console.log(`  ✅ Created: ${item.name} (${item.eventTicketId})`);
          }
        });
      }
    }
    
    // 4. Check production tickets collection
    console.log('\n=== PRODUCTION TICKETS INVESTIGATION ===\n');
    
    const productionTickets = await db.collection('tickets').find({ 
      originalRegistrationId: registrationId 
    }).toArray();
    
    console.log('Total tickets in production for this registration:', productionTickets.length);
    
    if (productionTickets.length > 0) {
      console.log('\n📋 Production tickets:');
      productionTickets.forEach((ticket: any, idx: number) => {
        console.log(`  ${idx + 1}. ${ticket.eventName}`);
        console.log(`     - ticketId: ${ticket.ticketId}`);
        console.log(`     - eventTicketId: ${ticket.eventTicketId}`);
        console.log(`     - isFromPackage: ${ticket.isFromPackage}`);
        console.log(`     - parentPackageId: ${ticket.parentPackageId}`);
      });
      
      // Check which items from the package were created
      if (pkg && pkg.includedItems) {
        console.log('\n⚠️ TICKET CREATION ANALYSIS:');
        const createdEventTicketIds = productionTickets.map((t: any) => t.eventTicketId);
        
        pkg.includedItems.forEach((item: any) => {
          if (!createdEventTicketIds.includes(item.eventTicketId)) {
            console.log(`  ❌ MISSING: ${item.name} (${item.eventTicketId})`);
          } else {
            console.log(`  ✅ Created: ${item.name} (${item.eventTicketId})`);
          }
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkPackageExpansion().catch(console.error);