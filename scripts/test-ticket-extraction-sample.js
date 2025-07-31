const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testTicketExtractionSample() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== TESTING TICKET EXTRACTION WITH SAMPLE DATA ===\n');
    
    const registrationsCollection = db.collection('registrations');
    
    // Get Ross Mylonas registrations as our test case
    const testRegistrations = await registrationsCollection.find({
      'registrationData.bookingContact.emailAddress': 'rmylonas@hotmail.com'
    }).limit(1).toArray();
    
    if (testRegistrations.length === 0) {
      console.log('No test registrations found');
      return;
    }
    
    const testReg = testRegistrations[0];
    console.log('Test Registration:');
    console.log(`Confirmation: ${testReg.confirmationNumber}`);
    console.log(`Registration ID: ${testReg.registrationId}`);
    console.log(`Status: ${testReg.status}`);
    console.log(`Tickets: ${testReg.registrationData?.tickets?.length || 0}`);
    
    console.log('\nCurrent ticket structure:');
    if (testReg.registrationData?.tickets) {
      testReg.registrationData.tickets.forEach((ticket, idx) => {
        console.log(`\nTicket ${idx + 1}:`);
        console.log(`  Event Ticket ID: ${ticket.eventTicketId}`);
        console.log(`  Status: ${ticket.status}`);
        console.log(`  Price: ${ticket.price}`);
        console.log(`  Owner: ${ticket.ownerType} - ${ticket.ownerId}`);
        console.log(`  Fields present: ${Object.keys(ticket).join(', ')}`);
      });
    }
    
    console.log('\n\nPROPOSED TICKET DOCUMENT STRUCTURE:');
    
    // Show what the extracted ticket would look like
    if (testReg.registrationData?.tickets?.[0]) {
      const sampleTicket = testReg.registrationData.tickets[0];
      const proposedStructure = {
        _id: 'ObjectId("new-generated-id")',
        eventTicketId: sampleTicket.eventTicketId,
        eventName: '[Would be looked up from eventTickets]',
        price: parseFloat(sampleTicket.price || 0),
        quantity: sampleTicket.quantity || 1,
        ownerType: sampleTicket.ownerType || 'attendee',
        ownerId: sampleTicket.ownerId,
        status: sampleTicket.status || 'sold',
        isPackage: sampleTicket.isPackage || false,
        attributes: [],
        details: {
          registrationId: testReg.registrationId,
          bookingContactId: testReg.registrationData.bookingContact?.contactId || null,
          confirmationNumber: testReg.confirmationNumber,
          registrationType: testReg.registrationType,
          invoice: {
            invoiceNumber: testReg.customerInvoiceNumber || null,
            invoiceId: testReg.invoiceId || null
          },
          originalTicketId: sampleTicket.id || null,
          eventTicketId: sampleTicket.eventTicketId,
          attendeeId: sampleTicket.attendeeId || null
        },
        createdAt: testReg.createdAt,
        modifiedAt: new Date(),
        lastModificationId: 'ObjectId("history-entry-id")',
        modificationHistory: [
          {
            id: 'ObjectId("history-entry-id")',
            type: 'creation',
            changes: [{
              field: 'status',
              from: null,
              to: sampleTicket.status || 'sold'
            }],
            description: 'Ticket extracted from registration during migration',
            timestamp: new Date(),
            userId: 'system-migration',
            source: 'ticket-extraction-script'
          }
        ]
      };
      
      console.log(JSON.stringify(proposedStructure, null, 2));
    }
    
    console.log('\n\nAFTER EXTRACTION, REGISTRATION WOULD HAVE:');
    console.log('registrationData.tickets: [');
    console.log('  { _id: ObjectId("ref-to-ticket-1") },');
    console.log('  { _id: ObjectId("ref-to-ticket-2") },');
    console.log('  // ... just ObjectId references');
    console.log(']');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the test
testTicketExtractionSample();