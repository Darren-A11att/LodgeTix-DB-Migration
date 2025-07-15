const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });
const { roundToTwoDecimals } = require('./number-helpers');

async function importNonTestRegistrations() {
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db(process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1');
  
  // Get all pending imports
  const pendingImports = await db.collection('registration_imports').find({}).toArray();
  
  console.log('Total pending imports:', pendingImports.length);
  
  let imported = 0;
  let skipped = 0;
  
  for (const imp of pendingImports) {
    // Check if any attendee has "TEST" in their name
    const attendees = imp.registrationData?.attendees || [];
    const hasTestName = attendees.some(a => 
      (a.firstName && a.firstName.toUpperCase().includes('TEST')) ||
      (a.lastName && a.lastName.toUpperCase().includes('TEST'))
    );
    
    if (hasTestName) {
      const name = attendees[0] ? `${attendees[0].firstName} ${attendees[0].lastName}` : 'Unknown';
      console.log(`Skipping TEST registration: ${name} (${imp.registrationId})`);
      skipped++;
      continue;
    }
    
    // Import the registration
    const { _id, pendingSince, attemptedPaymentIds, lastCheckDate, checkCount, reason, ...registration } = imp;
    
    // Transform tickets if needed
    let registrationToImport = { ...registration };
    
    // Keep confirmationNumber as null if missing - it will be generated when payment is matched
    // This allows multiple registrations without confirmation numbers
    
    // Ensure totalAmountPaid is properly formatted
    if (registration.totalAmountPaid) {
      registrationToImport.totalAmountPaid = roundToTwoDecimals(registration.totalAmountPaid);
    }
    
    // Add import metadata and audit log
    registrationToImport.importedAt = new Date();
    registrationToImport.importedFrom = 'registration_imports';
    registrationToImport.paymentVerificationNeeded = true;
    registrationToImport.importNote = 'Imported without payment verification - payment IDs missing';
    registrationToImport.previouslyPendingSince = pendingSince;
    
    // Add audit log
    registrationToImport.auditLog = [{
      timestamp: new Date(),
      action: 'manual_import_without_payment',
      description: 'Manually imported from registration_imports without payment verification',
      details: {
        originalReason: reason,
        checkCount: checkCount,
        paymentStatus: registration.paymentStatus,
        totalAmountPaid: registrationToImport.totalAmountPaid,
        hasPaymentIds: false,
        importedBy: 'manual_import_script'
      }
    }];
    
    // Transform tickets if they have selectedTickets
    const regData = registrationToImport.registrationData || registrationToImport.registration_data;
    if (regData?.selectedTickets && regData.selectedTickets.length > 0) {
      const transformedTickets = [];
      
      regData.selectedTickets.forEach((selectedTicket) => {
        const eventTicketId = selectedTicket.event_ticket_id || 
                             selectedTicket.eventTicketId || 
                             selectedTicket.ticketDefinitionId;
        
        if (eventTicketId) {
          transformedTickets.push({
            eventTicketId: eventTicketId,
            name: selectedTicket.name || 'Unknown Ticket',
            price: roundToTwoDecimals(selectedTicket.price || 0),
            quantity: selectedTicket.quantity || 1,
            ownerType: 'attendee',
            ownerId: selectedTicket.attendeeId || registration.registrationId
          });
        }
      });
      
      if (registrationToImport.registrationData) {
        registrationToImport.registrationData.tickets = transformedTickets;
        delete registrationToImport.registrationData.selectedTickets;
      } else if (registrationToImport.registration_data) {
        registrationToImport.registration_data.tickets = transformedTickets;
        delete registrationToImport.registration_data.selectedTickets;
      }
      
      // Add transformation to audit log
      registrationToImport.auditLog.push({
        timestamp: new Date(),
        action: 'transform_tickets',
        description: 'Transformed selectedTickets to tickets during import',
        details: {
          ticketsTransformed: transformedTickets.length
        }
      });
    }
    
    // Use replaceOne with upsert to avoid duplicate key errors
    const result = await db.collection('registrations').replaceOne(
      { registrationId: registrationToImport.registrationId },
      registrationToImport,
      { upsert: true }
    );
    
    // Only remove from registration_imports if actually inserted/updated
    if (result.modifiedCount > 0 || result.upsertedCount > 0) {
      await db.collection('registration_imports').deleteOne({ _id });
    }
    
    const attendeeName = attendees[0] ? `${attendees[0].firstName} ${attendees[0].lastName}` : 'No name';
    console.log(`Imported: ${attendeeName} (${imp.registrationId})`);
    imported++;
  }
  
  console.log('\n=== IMPORT COMPLETE ===');
  console.log(`Total processed: ${pendingImports.length}`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (TEST): ${skipped}`);
  
  // Check remaining
  const remaining = await db.collection('registration_imports').countDocuments();
  console.log(`\nRemaining in registration_imports: ${remaining}`);
  
  // Show new total
  const totalRegistrations = await db.collection('registrations').countDocuments();
  console.log(`Total registrations: ${totalRegistrations}`);
  
  await client.close();
}

importNonTestRegistrations().catch(console.error);