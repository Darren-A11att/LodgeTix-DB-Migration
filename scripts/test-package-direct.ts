import { MongoClient } from 'mongodb';

async function testPackageExpansionDirect() {
  const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('=== DIRECT PACKAGE EXPANSION TEST ===\n');
    
    // Test registration with package
    const registrationId = '43f3fa8b-e605-44cf-af81-d4250eaa276f';
    const expectedPackageId = '88567b9c-9675-4ee2-b572-eace1c580eb4';
    
    console.log('Testing registration:', registrationId);
    console.log('Expected package ID:', expectedPackageId);
    
    // Get the registration
    const registration = await db.collection('registrations').findOne({ id: registrationId });
    
    if (!registration) {
      console.log('❌ Registration not found');
      return;
    }
    
    // Extract tickets from registration
    const ticketsData = registration.registration_data?.selectedTickets || 
                       registration.registration_data?.tickets || 
                       registration.registrationData?.selectedTickets || 
                       registration.registrationData?.tickets || [];
    
    console.log('\n=== ANALYZING REGISTRATION DATA ===');
    console.log('Total tickets in registration:', ticketsData.length);
    
    // Analyze ticket structure
    const ticketAnalysis = new Map<string, any>();
    
    ticketsData.forEach((ticket: any, idx: number) => {
      const eventTicketId = ticket.eventTicketId;
      const ticketId = ticket.ticketId || ticket.id;
      const attendeeId = ticket.attendeeId;
      const isPackage = ticket.isPackage;
      const packageId = ticket.packageId;
      
      console.log(`\nTicket ${idx + 1}:`);
      console.log(`  ticketId: ${ticketId}`);
      console.log(`  eventTicketId: ${eventTicketId}`);
      console.log(`  attendeeId: ${attendeeId}`);
      console.log(`  isPackage: ${isPackage}`);
      console.log(`  packageId: ${packageId || 'not set'}`);
      
      // Check if this looks like it was already expanded
      if (ticketId && ticketId.includes(expectedPackageId)) {
        console.log(`  📦 This ticket appears to be from package expansion (ticketId contains packageId)`);
      }
      
      // Check if eventTicketId matches the expected packageId
      if (eventTicketId === expectedPackageId) {
        console.log(`  🎯 eventTicketId MATCHES expected packageId - this IS the package ticket!`);
      }
      
      // Group by attendee
      if (!ticketAnalysis.has(attendeeId)) {
        ticketAnalysis.set(attendeeId, []);
      }
      ticketAnalysis.get(attendeeId)!.push({
        ticketId,
        eventTicketId,
        isPackage,
        packageId,
        isFromExpansion: ticketId && ticketId.includes(expectedPackageId)
      });
    });
    
    console.log('\n=== TICKETS BY ATTENDEE ===');
    for (const [attendeeId, tickets] of ticketAnalysis) {
      console.log(`\nAttendee: ${attendeeId}`);
      console.log(`  Total tickets: ${tickets.length}`);
      
      const packageTickets = tickets.filter((t: any) => t.isPackage === true);
      const expandedTickets = tickets.filter((t: any) => t.isFromExpansion);
      const regularTickets = tickets.filter((t: any) => !t.isPackage && !t.isFromExpansion);
      
      console.log(`  Package tickets (isPackage=true): ${packageTickets.length}`);
      console.log(`  Expanded tickets (from package): ${expandedTickets.length}`);
      console.log(`  Regular tickets: ${regularTickets.length}`);
      
      if (packageTickets.length > 0) {
        console.log('\n  Package tickets:');
        packageTickets.forEach((t: any) => {
          console.log(`    - eventTicketId: ${t.eventTicketId}`);
        });
      }
      
      if (expandedTickets.length > 0) {
        console.log('\n  Tickets that appear to be from package expansion:');
        expandedTickets.forEach((t: any) => {
          console.log(`    - ${t.eventTicketId} (ticketId: ${t.ticketId})`);
        });
      }
    }
    
    // Check package data
    console.log('\n=== PACKAGE DATA VERIFICATION ===');
    const packageDoc = await db.collection('packages').findOne({ packageId: expectedPackageId });
    
    if (packageDoc) {
      console.log('✅ Package found in packages collection');
      console.log('  Included items:', packageDoc.includedItems?.length || 0);
      
      // Check if all included items have corresponding tickets
      if (packageDoc.includedItems) {
        console.log('\n  Checking if all package items are represented:');
        packageDoc.includedItems.forEach((item: any) => {
          const hasTicket = ticketsData.some((t: any) => t.eventTicketId === item.eventTicketId);
          console.log(`    ${item.eventTicketId}: ${hasTicket ? '✅ Found' : '❌ Missing'}`);
        });
      }
    } else {
      console.log('❌ Package NOT found in packages collection');
    }
    
    // Diagnosis
    console.log('\n=== DIAGNOSIS ===');
    
    const hasPackageTickets = ticketsData.some((t: any) => t.isPackage === true);
    const hasExpandedTickets = ticketsData.some((t: any) => 
      t.ticketId && t.ticketId.includes(expectedPackageId)
    );
    
    if (!hasPackageTickets && hasExpandedTickets) {
      console.log('✅ Package appears to have been already expanded:');
      console.log('   - No tickets with isPackage=true found');
      console.log('   - Found tickets with packageId in their ticketId');
      console.log('   - This suggests package was already processed');
    } else if (hasPackageTickets && !hasExpandedTickets) {
      console.log('⚠️ Package has NOT been expanded:');
      console.log('   - Found tickets with isPackage=true');
      console.log('   - No expanded tickets found');
      console.log('   - Package expansion needs to run');
    } else if (hasPackageTickets && hasExpandedTickets) {
      console.log('⚠️ Inconsistent state:');
      console.log('   - Both package tickets AND expanded tickets exist');
      console.log('   - Package ticket should have been removed after expansion');
    } else {
      console.log('ℹ️ No package tickets found - all tickets appear to be individual');
    }
    
    // Test the expansion logic
    console.log('\n=== TESTING EXPANSION LOGIC ===');
    
    // Find any package ticket (one with isPackage=true OR eventTicketId matching packageId)
    let packageTicket = ticketsData.find((t: any) => t.isPackage === true);
    
    if (!packageTicket) {
      // Check if any ticket has eventTicketId matching the packageId
      packageTicket = ticketsData.find((t: any) => t.eventTicketId === expectedPackageId);
      if (packageTicket) {
        console.log('Found ticket where eventTicketId matches packageId - treating as package');
      }
    }
    
    if (packageTicket) {
      console.log('\nPackage ticket to expand:');
      console.log('  eventTicketId:', packageTicket.eventTicketId);
      console.log('  ticketId:', packageTicket.ticketId || packageTicket.id);
      console.log('  attendeeId:', packageTicket.attendeeId);
      console.log('  isPackage:', packageTicket.isPackage);
      
      // CRITICAL: For package tickets, eventTicketId IS the packageId
      const packageIdToLookup = packageTicket.eventTicketId;
      console.log('\n🔑 Using eventTicketId as packageId for lookup:', packageIdToLookup);
      
      const packageForExpansion = await db.collection('packages').findOne({ 
        packageId: packageIdToLookup 
      });
      
      if (packageForExpansion) {
        console.log('✅ Successfully found package using eventTicketId as packageId!');
        console.log('  Package will expand into', packageForExpansion.includedItems?.length || 0, 'tickets');
      } else {
        console.log('❌ Could not find package using eventTicketId as packageId');
      }
    } else {
      console.log('No package ticket found to test expansion');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await client.close();
  }
}

// Run the test
testPackageExpansionDirect().catch(console.error);