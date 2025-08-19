import { MongoClient, ObjectId } from 'mongodb';

async function testDualReferences() {
  const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('=== DUAL REFERENCE TEST (ObjectIds + Business IDs) ===\n');
    
    const registrationId = '43f3fa8b-e605-44cf-af81-d4250eaa276f';
    console.log('Testing registration:', registrationId);
    console.log('');
    
    // Get the registration from import_registrations
    const registration = await db.collection('import_registrations').findOne({ id: registrationId });
    
    if (!registration) {
      console.log('❌ Registration not found in import_registrations');
      console.log('Creating test data...\n');
      
      // Create a simple test registration
      await db.collection('import_registrations').insertOne({
        id: registrationId,
        registrationData: {
          bookingContactRef: 'customer-123'
        },
        metadata: {}
      });
    }
    
    console.log('=== REGISTRATION REFERENCES ===');
    const metadata = registration?.metadata || {};
    
    // Check for BOTH types of references
    console.log('\n📋 TICKET REFERENCES:');
    console.log('  Business IDs (extractedTicketIds):', metadata.extractedTicketIds?.length || 0);
    console.log('  ObjectIds (extractedTicketRefs):', metadata.extractedTicketRefs?.length || 0);
    
    if (metadata.extractedTicketRefs && metadata.extractedTicketRefs.length > 0) {
      console.log('\n  Sample Ticket References:');
      const sampleTicket = metadata.extractedTicketRefs[0];
      const ticketId = metadata.extractedTicketIds?.[0];
      console.log(`    Business ID: ${ticketId}`);
      console.log(`    ObjectId: ${sampleTicket}`);
      console.log(`    ObjectId Type: ${sampleTicket.constructor.name}`);
    }
    
    console.log('\n👥 ATTENDEE REFERENCES:');
    console.log('  Business IDs (extractedAttendeeIds):', metadata.extractedAttendeeIds?.length || 0);
    console.log('  ObjectIds (extractedAttendeeRefs):', metadata.extractedAttendeeRefs?.length || 0);
    
    if (metadata.extractedAttendeeRefs && metadata.extractedAttendeeRefs.length > 0) {
      console.log('\n  Sample Attendee References:');
      const sampleAttendee = metadata.extractedAttendeeRefs[0];
      const attendeeId = metadata.extractedAttendeeIds?.[0];
      console.log(`    Business ID: ${attendeeId}`);
      console.log(`    ObjectId: ${sampleAttendee}`);
      console.log(`    ObjectId Type: ${sampleAttendee.constructor.name}`);
    }
    
    console.log('\n🏢 CUSTOMER REFERENCES:');
    console.log('  Business ID (extractedCustomerId):', metadata.extractedCustomerId || 'NOT SET');
    console.log('  ObjectId (extractedCustomerRef):', metadata.extractedCustomerRef || 'NOT SET');
    if (metadata.extractedCustomerRef) {
      console.log(`  ObjectId Type: ${metadata.extractedCustomerRef.constructor.name}`);
    }
    
    // Test backward references in tickets
    console.log('\n=== BACKWARD REFERENCES IN TICKETS ===');
    if (metadata.extractedTicketIds && metadata.extractedTicketIds.length > 0) {
      const sampleTicketId = metadata.extractedTicketIds[0];
      const ticket = await db.collection('import_tickets').findOne({ ticketId: sampleTicketId });
      
      if (ticket) {
        console.log(`\nTicket: ${sampleTicketId}`);
        console.log('  Registration References:');
        console.log(`    Business ID: ${ticket.metadata?.registrationId || 'NOT SET'}`);
        console.log(`    ObjectId: ${ticket.metadata?.registrationRef || 'NOT SET'}`);
        
        console.log('  Attendee References:');
        console.log(`    Business ID: ${ticket.metadata?.attendeeId || 'NOT SET'}`);
        console.log(`    ObjectId: ${ticket.metadata?.attendeeRef || 'NOT SET'}`);
        
        console.log('  Customer References:');
        console.log(`    Business ID: ${ticket.metadata?.customerId || 'NOT SET'}`);
        console.log(`    ObjectId: ${ticket.metadata?.customerRef || 'NOT SET'}`);
      } else {
        console.log(`  Ticket ${sampleTicketId} not found`);
      }
    }
    
    // Test backward references in attendees
    console.log('\n=== BACKWARD REFERENCES IN ATTENDEES ===');
    if (metadata.extractedAttendeeIds && metadata.extractedAttendeeIds.length > 0) {
      const sampleAttendeeId = metadata.extractedAttendeeIds[0];
      const attendee = await db.collection('import_attendees').findOne({ attendeeId: sampleAttendeeId });
      
      if (attendee) {
        console.log(`\nAttendee: ${sampleAttendeeId}`);
        console.log('  Registration References:');
        console.log(`    Business ID: ${attendee.metadata?.registrationId || 'NOT SET'}`);
        console.log(`    ObjectId: ${attendee.metadata?.registrationRef || 'NOT SET'}`);
        
        console.log('  Ticket References:');
        console.log(`    Business IDs: ${attendee.metadata?.associatedTicketIds?.length || 0} tickets`);
        console.log(`    ObjectIds: ${attendee.metadata?.associatedTicketRefs?.length || 0} tickets`);
        
        console.log('  Customer References:');
        console.log(`    Business ID: ${attendee.metadata?.customerId || 'NOT SET'}`);
        console.log(`    ObjectId: ${attendee.metadata?.customerRef || 'NOT SET'}`);
      } else {
        console.log(`  Attendee ${sampleAttendeeId} not found`);
      }
    }
    
    // Test using ObjectId references for lookups
    console.log('\n=== TESTING OBJECTID LOOKUPS ===');
    if (metadata.extractedTicketRefs && metadata.extractedTicketRefs.length > 0) {
      const ticketRef = metadata.extractedTicketRefs[0];
      console.log(`\nLooking up ticket by ObjectId: ${ticketRef}`);
      
      // Convert string to ObjectId if needed
      const objectId = typeof ticketRef === 'string' ? new ObjectId(ticketRef) : ticketRef;
      const ticketByRef = await db.collection('import_tickets').findOne({ _id: objectId });
      
      if (ticketByRef) {
        console.log(`  ✅ Found ticket by ObjectId: ${ticketByRef.data?.ticketId || ticketByRef.ticketId}`);
        console.log(`     Event: ${ticketByRef.data?.eventName || 'N/A'}`);
      } else {
        console.log(`  ❌ Could not find ticket by ObjectId`);
      }
    }
    
    if (metadata.extractedAttendeeRefs && metadata.extractedAttendeeRefs.length > 0) {
      const attendeeRef = metadata.extractedAttendeeRefs[0];
      console.log(`\nLooking up attendee by ObjectId: ${attendeeRef}`);
      
      // Convert string to ObjectId if needed
      const objectId = typeof attendeeRef === 'string' ? new ObjectId(attendeeRef) : attendeeRef;
      const attendeeByRef = await db.collection('import_attendees').findOne({ _id: objectId });
      
      if (attendeeByRef) {
        console.log(`  ✅ Found attendee by ObjectId: ${attendeeByRef.data?.attendeeId || attendeeByRef.attendeeId}`);
        console.log(`     Name: ${attendeeByRef.data?.firstName} ${attendeeByRef.data?.lastName}`);
      } else {
        console.log(`  ❌ Could not find attendee by ObjectId`);
      }
    }
    
    // Final assessment
    console.log('\n=== DUAL REFERENCE ASSESSMENT ===');
    const hasBusinessIds = 
      (metadata.extractedTicketIds?.length > 0) &&
      (metadata.extractedAttendeeIds?.length > 0) &&
      metadata.extractedCustomerId;
    
    const hasObjectIds = 
      (metadata.extractedTicketRefs?.length > 0) &&
      (metadata.extractedAttendeeRefs?.length > 0) &&
      metadata.extractedCustomerRef;
    
    if (hasBusinessIds && hasObjectIds) {
      console.log('✅ DUAL REFERENCE SYSTEM FULLY IMPLEMENTED');
      console.log('   - All business IDs are stored for stable references');
      console.log('   - All ObjectIds are stored for efficient lookups');
      console.log('   - Both forward and backward references are in place');
    } else if (hasBusinessIds && !hasObjectIds) {
      console.log('⚠️ ONLY BUSINESS IDS IMPLEMENTED');
      console.log('   - Business IDs are present');
      console.log('   - ObjectIds are missing');
      console.log('   - Need to store ObjectIds for efficient lookups');
    } else if (!hasBusinessIds && hasObjectIds) {
      console.log('⚠️ ONLY OBJECTIDS IMPLEMENTED');
      console.log('   - ObjectIds are present');
      console.log('   - Business IDs are missing');
      console.log('   - Need to store business IDs for stable references');
    } else {
      console.log('❌ REFERENCE SYSTEM NOT IMPLEMENTED');
      console.log('   - Neither business IDs nor ObjectIds are properly stored');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await client.close();
  }
}

// Run the test
testDualReferences().catch(console.error);