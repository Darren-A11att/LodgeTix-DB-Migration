import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testTicketOwnershipSync() {
  const uri = process.env.MONGODB_URI_LODGETIX_SYNC;
  if (!uri) {
    console.error('❌ MONGODB_URI_LODGETIX_SYNC not found in environment variables');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('lodgetix_sync');

    // Check a sample customer to verify customerId field
    const sampleCustomer = await db.collection('import_customers').findOne({});
    if (sampleCustomer) {
      console.log('\n📋 Sample Customer Structure:');
      console.log('  - customerId (UUID):', sampleCustomer.customerId);
      console.log('  - firstName:', sampleCustomer.firstName);
      console.log('  - lastName:', sampleCustomer.lastName);
      console.log('  - businessName:', sampleCustomer.businessName);
      console.log('  - customerType:', sampleCustomer.customerType);
    }

    // Check a sample ticket to verify new structure
    const sampleTicket = await db.collection('import_tickets').findOne({});
    if (sampleTicket) {
      console.log('\n🎫 Sample Ticket Structure:');
      console.log('  - ticketId:', sampleTicket.ticketId);
      
      if (sampleTicket.ticketOwner) {
        console.log('  - ticketOwner:');
        console.log('    - ownerId (customerId):', sampleTicket.ticketOwner.ownerId);
        console.log('    - ownerType:', sampleTicket.ticketOwner.ownerType);
        console.log('    - customerBusinessName:', sampleTicket.ticketOwner.customerBusinessName);
        console.log('    - customerName:', sampleTicket.ticketOwner.customerName);
      } else {
        console.log('  - ticketOwner: NOT FOUND (old structure)');
      }

      if (sampleTicket.ticketHolder) {
        console.log('  - ticketHolder:');
        console.log('    - attendeeId:', sampleTicket.ticketHolder.attendeeId || '(empty - unassigned)');
        console.log('    - holderStatus:', sampleTicket.ticketHolder.holderStatus);
        console.log('    - updatedDate:', sampleTicket.ticketHolder.updatedDate);
      } else {
        console.log('  - ticketHolder: NOT FOUND (old structure)');
      }

      // Check for old structure
      if (sampleTicket.ownerType || sampleTicket.ownerId) {
        console.log('\n  ⚠️ Old structure still present:');
        console.log('    - ownerType:', sampleTicket.ownerType);
        console.log('    - ownerId:', sampleTicket.ownerId);
      }
    }

    // Check a sample attendee to verify clean IDs
    const sampleAttendee = await db.collection('import_attendees').findOne({});
    if (sampleAttendee) {
      console.log('\n👤 Sample Attendee Structure:');
      console.log('  - attendeeId:', sampleAttendee.attendeeId);
      console.log('  - Has "import_" prefix?:', sampleAttendee.attendeeId?.includes('import_'));
    }

    // Count tickets by ownership type
    const ticketsWithNewStructure = await db.collection('import_tickets').countDocuments({ ticketOwner: { $exists: true } });
    const ticketsWithOldStructure = await db.collection('import_tickets').countDocuments({ ownerType: { $exists: true } });
    
    console.log('\n📊 Ticket Structure Summary:');
    console.log('  - Tickets with new structure (ticketOwner):', ticketsWithNewStructure);
    console.log('  - Tickets with old structure (ownerType):', ticketsWithOldStructure);

    // Check registration metadata for customerUUID
    const sampleRegistration = await db.collection('import_registrations').findOne({ 'metadata.customerUUID': { $exists: true } });
    if (sampleRegistration) {
      console.log('\n📝 Registration with Customer UUID:');
      console.log('  - Registration ID:', sampleRegistration.id);
      console.log('  - Customer UUID:', sampleRegistration.metadata?.customerUUID);
    } else {
      console.log('\n⚠️ No registrations found with customerUUID in metadata');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Connection closed');
  }
}

// Run the test
testTicketOwnershipSync().catch(console.error);