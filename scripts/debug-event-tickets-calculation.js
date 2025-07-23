const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function debugEventTicketsCalculation() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== DEBUG EVENT TICKETS CALCULATION ===\n');
    console.log(`Database: ${dbName}\n`);
    
    // 1. Get all registrations (like the API does)
    const registrations = await db.collection('registrations').find({}).toArray();
    console.log(`Total registrations: ${registrations.length}\n`);
    
    // 2. Initialize counter like the API does
    const eventTicketData = {
      'fd12d7f0-f346-49bf-b1eb-0682ad226216': {
        name: 'Proclamation Banquet - Best Available',
        registrationCount: 0,
        totalAttendees: 0,
        registrationsByType: { individuals: 0, lodges: 0, delegations: 0 }
      }
    };
    
    // 3. Process each registration (matching API logic)
    let debugLog = [];
    
    registrations.forEach(registration => {
      const regData = registration.registrationData;
      if (regData && regData.tickets && Array.isArray(regData.tickets)) {
        regData.tickets.forEach(ticket => {
          const eventTicketId = ticket.eventTicketId;
          
          if (eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216') {
            const quantity = ticket.quantity || 1;
            const regType = (registration.registrationType || '').toLowerCase();
            
            eventTicketData[eventTicketId].registrationCount++;
            eventTicketData[eventTicketId].totalAttendees += quantity;
            
            if (regType === 'lodge') {
              eventTicketData[eventTicketId].registrationsByType.lodges += quantity;
              
              // Log specific lodge registrations
              if (registration.confirmationNumber === 'LDG-102908JR' || 
                  registration.confirmationNumber === 'LDG-862926IO') {
                debugLog.push({
                  confirmation: registration.confirmationNumber,
                  type: regType,
                  quantity: quantity,
                  lodgeName: regData.lodgeDetails?.lodgeName
                });
              }
            } else if (regType === 'individuals' || regType === 'individual') {
              eventTicketData[eventTicketId].registrationsByType.individuals += quantity;
            }
          }
        });
      }
    });
    
    // 4. Show results
    const banquetData = eventTicketData['fd12d7f0-f346-49bf-b1eb-0682ad226216'];
    console.log('PROCLAMATION BANQUET CALCULATION RESULTS:');
    console.log(`  Registration Count: ${banquetData.registrationCount}`);
    console.log(`  Total Attendees: ${banquetData.totalAttendees}`);
    console.log(`  Individuals: ${banquetData.registrationsByType.individuals}`);
    console.log(`  Lodges: ${banquetData.registrationsByType.lodges}`);
    console.log(`  Delegations: ${banquetData.registrationsByType.delegations}\n`);
    
    // 5. Show Troy and Ionic specifically
    console.log('TROY AND IONIC REGISTRATIONS:');
    debugLog.forEach(log => {
      console.log(`  ${log.confirmation}: ${log.quantity} tickets (${log.lodgeName})`);
    });
    
    // 6. Check if there are any registrations with NaN quantity
    console.log('\nCHECKING FOR DATA ISSUES:');
    let nanCount = 0;
    registrations.forEach(reg => {
      if (reg.registrationData?.tickets) {
        reg.registrationData.tickets.forEach(ticket => {
          if (ticket.eventTicketId === 'fd12d7f0-f346-49bf-b1eb-0682ad226216') {
            if (isNaN(ticket.quantity)) {
              nanCount++;
              console.log(`  ${reg.confirmationNumber}: quantity is NaN`);
            }
          }
        });
      }
    });
    console.log(`  Registrations with NaN quantity: ${nanCount}`);
    
    // 7. Compare with what the API shows
    console.log('\nAPI SHOWS:');
    console.log('  Total Attendees: 418');
    console.log('  Lodges: 322');
    console.log('\nDIFFERENCE:');
    console.log(`  Calculated: ${banquetData.totalAttendees} vs API: 418 (diff: ${banquetData.totalAttendees - 418})`);
    console.log(`  Lodge calc: ${banquetData.registrationsByType.lodges} vs API: 322 (diff: ${banquetData.registrationsByType.lodges - 322})`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run debug
debugEventTicketsCalculation();