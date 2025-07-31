const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function findSelectedTicketsWithoutTickets() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FINDING REGISTRATIONS WITH SELECTEDTICKETS BUT NO TICKETS ===\n');
    console.log(`Database: ${dbName}\n`);
    
    const registrationsCollection = db.collection('registrations');
    
    // Find registrations with selectedTickets or selected_tickets but no tickets
    const problematicRegistrations = await registrationsCollection.find({
      $and: [
        {
          $or: [
            { 'registrationData.selectedTickets': { $exists: true } },
            { 'registrationData.selected_tickets': { $exists: true } }
          ]
        },
        {
          $or: [
            { 'registrationData.tickets': { $exists: false } },
            { 'registrationData.tickets': { $size: 0 } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${problematicRegistrations.length} registration(s) with selectedTickets/selected_tickets but no tickets array:\n`);
    
    for (const reg of problematicRegistrations) {
      console.log('Registration Details:');
      console.log('===================');
      console.log(`_id: ${reg._id}`);
      console.log(`Confirmation Number: ${reg.confirmationNumber || 'N/A'}`);
      console.log(`Registration ID: ${reg.registrationId || 'N/A'}`);
      console.log(`Registration Type: ${reg.registrationType || 'N/A'}`);
      console.log(`Created: ${reg.createdAt || 'N/A'}`);
      
      // Contact info
      if (reg.registrationData) {
        const contact = reg.registrationData.bookingContact || reg.registrationData.billingDetails;
        if (contact) {
          console.log(`Name: ${contact.firstName} ${contact.lastName}`);
          console.log(`Email: ${contact.emailAddress}`);
        }
        
        // Lodge info if applicable
        if (reg.registrationData.lodgeDetails) {
          console.log(`Lodge: ${reg.registrationData.lodgeDetails.lodgeName || 'N/A'}`);
        }
        
        // Show which field exists
        if (reg.registrationData.selectedTickets) {
          console.log('\n📋 Has selectedTickets:');
          console.log(`   Count: ${reg.registrationData.selectedTickets.length}`);
          // Show first ticket as sample
          if (reg.registrationData.selectedTickets.length > 0) {
            const sample = reg.registrationData.selectedTickets[0];
            console.log(`   Sample ticket: ${sample.ticketName || sample.name || 'No name'} - Qty: ${sample.quantity || 1}`);
          }
        }
        
        if (reg.registrationData.selected_tickets) {
          console.log('\n📋 Has selected_tickets:');
          console.log(`   Count: ${reg.registrationData.selected_tickets.length}`);
          // Show first ticket as sample
          if (reg.registrationData.selected_tickets.length > 0) {
            const sample = reg.registrationData.selected_tickets[0];
            console.log(`   Sample ticket: ${sample.ticketName || sample.name || 'No name'} - Qty: ${sample.quantity || 1}`);
          }
        }
        
        // Check tickets field
        console.log('\n🎫 Tickets field:');
        if (!reg.registrationData.tickets) {
          console.log('   Does not exist');
        } else if (reg.registrationData.tickets.length === 0) {
          console.log('   Exists but is empty');
        }
      }
      
      console.log('\n---\n');
    }
    
    // Summary statistics
    if (problematicRegistrations.length > 0) {
      const withSelectedTickets = problematicRegistrations.filter(r => r.registrationData?.selectedTickets).length;
      const withSelectedTicketsUnderscore = problematicRegistrations.filter(r => r.registrationData?.selected_tickets).length;
      
      console.log('SUMMARY:');
      console.log(`Total problematic registrations: ${problematicRegistrations.length}`);
      console.log(`With 'selectedTickets': ${withSelectedTickets}`);
      console.log(`With 'selected_tickets': ${withSelectedTicketsUnderscore}`);
      
      // Group by registration type
      const byType = {};
      problematicRegistrations.forEach(reg => {
        const type = reg.registrationType || 'unknown';
        byType[type] = (byType[type] || 0) + 1;
      });
      
      console.log('\nBy Registration Type:');
      Object.entries(byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the search
findSelectedTicketsWithoutTickets();