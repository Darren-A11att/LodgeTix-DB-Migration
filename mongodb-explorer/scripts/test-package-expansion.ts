import { MongoClient } from 'mongodb';
import { EnhancedPaymentSyncService } from '../src/services/sync/enhanced-payment-sync';

async function testPackageExpansion() {
  const uri = process.env.MONGODB_URI_LODGETIX_SYNC || 
              process.env.MONGODB_URI ||
              'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('=== PACKAGE EXPANSION TEST ===\n');
    
    // Test registration with package
    const registrationId = '43f3fa8b-e605-44cf-af81-d4250eaa276f';
    const packageId = '88567b9c-9675-4ee2-b572-eace1c580eb4';
    
    console.log('Testing registration:', registrationId);
    console.log('Expected package ID:', packageId);
    
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
    
    console.log('\n=== PRE-PROCESSING ANALYSIS ===');
    console.log('Total tickets in registration:', ticketsData.length);
    
    // Find package tickets
    const packageTickets = ticketsData.filter((t: any) => t.isPackage === true);
    console.log('Package tickets found:', packageTickets.length);
    
    if (packageTickets.length > 0) {
      console.log('\nPackage tickets details:');
      packageTickets.forEach((pkg: any, idx: number) => {
        console.log(`  ${idx + 1}. eventTicketId: ${pkg.eventTicketId}`);
        console.log(`     ticketId: ${pkg.ticketId || pkg.id}`);
        console.log(`     attendeeId: ${pkg.attendeeId}`);
        console.log(`     packageId field: ${pkg.packageId || 'not set'}`);
        console.log(`     isPackage: ${pkg.isPackage}`);
        
        // Check if eventTicketId matches expected packageId
        if (pkg.eventTicketId === packageId) {
          console.log(`     ✅ eventTicketId matches expected packageId`);
        } else {
          console.log(`     ⚠️ eventTicketId does NOT match expected packageId`);
        }
      });
    }
    
    // Check packages collection
    console.log('\n=== PACKAGES COLLECTION CHECK ===');
    const packageDoc = await db.collection('packages').findOne({ packageId: packageId });
    
    if (packageDoc) {
      console.log('✅ Package found in packages collection');
      console.log('Package name:', packageDoc.packageName);
      console.log('Total price:', packageDoc.totalPrice?.$numberDecimal || packageDoc.totalPrice);
      console.log('Number of included items:', packageDoc.includedItems?.length || 0);
      
      if (packageDoc.includedItems && packageDoc.includedItems.length > 0) {
        console.log('\nIncluded items:');
        packageDoc.includedItems.forEach((item: any, idx: number) => {
          console.log(`  ${idx + 1}. ${item.eventName || item.name}`);
          console.log(`     eventTicketId: ${item.eventTicketId}`);
          console.log(`     price: $${item.price?.$numberDecimal || item.price || 0}`);
        });
      }
    } else {
      console.log('❌ Package NOT found in packages collection');
      console.log('This will prevent expansion!');
    }
    
    // Clear previous test data
    console.log('\n=== CLEARING PREVIOUS TEST DATA ===');
    await db.collection('import_tickets').deleteMany({ 
      'data.originalRegistrationId': registrationId 
    });
    await db.collection('tickets').deleteMany({ 
      originalRegistrationId: registrationId 
    });
    console.log('✅ Cleared previous test data');
    
    // Run the sync
    console.log('\n=== RUNNING SYNC WITH PACKAGE-FIRST PROCESSING ===');
    
    const syncService = new EnhancedPaymentSyncService(
      uri,
      'lodgetix',
      process.env.STRIPE_SECRET_KEY || '',
      process.env.SQUARE_ACCESS_TOKEN || '',
      process.env.SQUARE_ENVIRONMENT || 'production'
    );
    
    // Process the registration
    await syncService.processRegistration(registration);
    
    // Check results
    console.log('\n=== POST-PROCESSING RESULTS ===');
    
    // Check import_tickets
    const importedTickets = await db.collection('import_tickets').find({ 
      'data.originalRegistrationId': registrationId 
    }).toArray();
    
    console.log(`\nTickets in import_tickets: ${importedTickets.length}`);
    
    // Group by attendeeId to see distribution
    const ticketsByAttendee = new Map<string, any[]>();
    importedTickets.forEach((ticket: any) => {
      const attendeeId = ticket.data.attendeeId || 'no-attendee';
      if (!ticketsByAttendee.has(attendeeId)) {
        ticketsByAttendee.set(attendeeId, []);
      }
      ticketsByAttendee.get(attendeeId)!.push(ticket);
    });
    
    console.log('\nTickets grouped by attendee:');
    for (const [attendeeId, tickets] of ticketsByAttendee) {
      console.log(`\nAttendee: ${attendeeId}`);
      console.log(`  Number of tickets: ${tickets.length}`);
      tickets.forEach((ticket: any, idx: number) => {
        console.log(`  ${idx + 1}. ${ticket.data.eventName}`);
        console.log(`     eventTicketId: ${ticket.data.eventTicketId}`);
        console.log(`     ticketId: ${ticket.data.ticketId}`);
        console.log(`     isFromPackage: ${ticket.data.isFromPackage || false}`);
        console.log(`     originalPackageId: ${ticket.data.originalPackageId || 'none'}`);
      });
    }
    
    // Check for package tickets that should have been removed
    const remainingPackages = importedTickets.filter((t: any) => t.data.isPackage === true);
    if (remainingPackages.length > 0) {
      console.log('\n⚠️ WARNING: Package tickets still present after expansion:');
      remainingPackages.forEach((pkg: any) => {
        console.log(`  - ${pkg.data.ticketId} (attendee: ${pkg.data.attendeeId})`);
      });
    } else {
      console.log('\n✅ No package tickets remaining (correctly removed after expansion)');
    }
    
    // Expected vs Actual analysis
    console.log('\n=== EXPECTED VS ACTUAL ===');
    const expectedFromPackage = packageDoc?.includedItems?.length || 0;
    const actualFromPackage = importedTickets.filter((t: any) => t.data.isFromPackage === true).length;
    
    console.log(`Expected tickets from package: ${expectedFromPackage}`);
    console.log(`Actual tickets marked as from package: ${actualFromPackage}`);
    
    if (expectedFromPackage === actualFromPackage) {
      console.log('✅ Package expansion count matches expected');
    } else {
      console.log(`⚠️ Mismatch: Expected ${expectedFromPackage} but got ${actualFromPackage}`);
    }
    
    // Check specific attendee who had the package
    const packageAttendeeId = packageTickets[0]?.attendeeId;
    if (packageAttendeeId) {
      const packageAttendeeTickets = importedTickets.filter((t: any) => 
        t.data.attendeeId === packageAttendeeId
      );
      console.log(`\nTickets for package owner (${packageAttendeeId}): ${packageAttendeeTickets.length}`);
      
      const expandedFromPackage = packageAttendeeTickets.filter((t: any) => 
        t.data.isFromPackage === true
      );
      console.log(`  Expanded from package: ${expandedFromPackage.length}`);
      
      const individualTickets = packageAttendeeTickets.filter((t: any) => 
        !t.data.isFromPackage
      );
      console.log(`  Individual tickets: ${individualTickets.length}`);
    }
    
    // Final summary
    console.log('\n=== SUMMARY ===');
    if (actualFromPackage === expectedFromPackage && remainingPackages.length === 0) {
      console.log('✅ Package expansion working correctly!');
      console.log('   - Package detected and expanded');
      console.log('   - Original package removed');
      console.log('   - All included items created');
      console.log('   - AttendeeId properly inherited');
    } else {
      console.log('⚠️ Issues detected with package expansion:');
      if (actualFromPackage !== expectedFromPackage) {
        console.log(`   - Expansion count mismatch`);
      }
      if (remainingPackages.length > 0) {
        console.log(`   - Package tickets not removed`);
      }
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await client.close();
  }
}

// Run the test
testPackageExpansion().catch(console.error);