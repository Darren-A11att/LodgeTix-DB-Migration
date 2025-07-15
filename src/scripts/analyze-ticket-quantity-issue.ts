import { MongoClient } from 'mongodb';
import { config } from '../config/environment';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Analyze individual registrations with tickets having quantity > 1
 * These need to be expanded into individual tickets with quantity = 1
 */
async function analyzeTicketQuantityIssue() {
  const mongoClient = new MongoClient(config.mongodb.uri);
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(config.mongodb.database);
    const registrationsCollection = db.collection('registrations');
    
    console.log('=== ANALYZING TICKET QUANTITY ISSUE ===\n');
    
    // Find individual registrations with tickets having quantity > 1
    const problematicRegistrations = await registrationsCollection.find({
      registrationType: { $in: ['individuals', 'individual'] },
      $or: [
        { 'registrationData.tickets': { 
          $elemMatch: { quantity: { $gt: 1 } } 
        }},
        { 'registration_data.tickets': { 
          $elemMatch: { quantity: { $gt: 1 } } 
        }}
      ]
    }).toArray();
    
    console.log(`Found ${problematicRegistrations.length} individual registrations with tickets having quantity > 1\n`);
    
    // Analyze the extent of the problem
    let totalTicketsAffected = 0;
    let totalQuantity = 0;
    let totalExpectedTickets = 0;
    
    const sampleRegistrations: any[] = [];
    
    for (const reg of problematicRegistrations) {
      const regData = reg.registrationData || reg.registration_data;
      const tickets = regData?.tickets || [];
      
      let regTicketsAffected = 0;
      let regTotalQuantity = 0;
      let regExpectedTickets = 0;
      
      tickets.forEach((ticket: any) => {
        if (ticket.quantity > 1) {
          regTicketsAffected++;
          regTotalQuantity += ticket.quantity;
          regExpectedTickets += ticket.quantity; // Each should be expanded to this many tickets
        } else {
          regExpectedTickets += 1; // Already correct
        }
      });
      
      totalTicketsAffected += regTicketsAffected;
      totalQuantity += regTotalQuantity;
      totalExpectedTickets += regExpectedTickets;
      
      // Collect sample registrations for detailed analysis
      if (sampleRegistrations.length < 5) {
        sampleRegistrations.push({
          registrationId: reg.registrationId,
          confirmationNumber: reg.confirmationNumber,
          attendeeCount: reg.attendeeCount || regData?.attendees?.length || 0,
          currentTicketCount: tickets.length,
          ticketsWithHighQuantity: regTicketsAffected,
          totalQuantity: regTotalQuantity,
          expectedTicketCount: regExpectedTickets,
          tickets: tickets.map((t: any) => ({
            eventTicketId: t.eventTicketId,
            name: t.name,
            quantity: t.quantity,
            ownerId: t.ownerId
          }))
        });
      }
    }
    
    console.log('=== SUMMARY ===');
    console.log(`Total registrations affected: ${problematicRegistrations.length}`);
    console.log(`Total tickets with quantity > 1: ${totalTicketsAffected}`);
    console.log(`Total quantity across all tickets: ${totalQuantity}`);
    console.log(`Expected total individual tickets after fix: ${totalExpectedTickets}`);
    console.log(`Current total tickets: ${problematicRegistrations.reduce((sum, reg) => {
      const tickets = (reg.registrationData || reg.registration_data)?.tickets || [];
      return sum + tickets.length;
    }, 0)}`);
    
    console.log('\n=== SAMPLE AFFECTED REGISTRATIONS ===\n');
    
    for (const sample of sampleRegistrations) {
      console.log(`Registration: ${sample.confirmationNumber} (${sample.registrationId})`);
      console.log(`  Attendee count: ${sample.attendeeCount}`);
      console.log(`  Current ticket count: ${sample.currentTicketCount}`);
      console.log(`  Expected ticket count: ${sample.expectedTicketCount}`);
      console.log(`  Tickets with quantity > 1:`);
      
      sample.tickets.forEach((ticket: any) => {
        if (ticket.quantity > 1) {
          console.log(`    - ${ticket.name}: quantity=${ticket.quantity} (should be ${ticket.quantity} tickets with quantity=1 each)`);
        }
      });
      console.log();
    }
    
    // Check a specific example in detail
    const exampleReg = await registrationsCollection.findOne({
      registrationId: "b49542ec-cbf2-43fe-95bb-b93edcd466f2"
    });
    
    if (exampleReg) {
      console.log('=== DETAILED EXAMPLE: b49542ec-cbf2-43fe-95bb-b93edcd466f2 ===');
      const regData = exampleReg.registrationData || exampleReg.registration_data;
      console.log(`Confirmation: ${exampleReg.confirmationNumber}`);
      console.log(`Attendee count: ${exampleReg.attendeeCount || regData?.attendees?.length || 0}`);
      console.log(`Current tickets:`);
      console.log(JSON.stringify(regData?.tickets, null, 2));
    }
    
    // Check for patterns
    console.log('\n=== PATTERNS ANALYSIS ===');
    
    const byTicketCount = new Map<number, number>();
    const byQuantity = new Map<number, number>();
    
    problematicRegistrations.forEach(reg => {
      const tickets = (reg.registrationData || reg.registration_data)?.tickets || [];
      const count = tickets.length;
      byTicketCount.set(count, (byTicketCount.get(count) || 0) + 1);
      
      tickets.forEach((ticket: any) => {
        if (ticket.quantity > 1) {
          byQuantity.set(ticket.quantity, (byQuantity.get(ticket.quantity) || 0) + 1);
        }
      });
    });
    
    console.log('\nRegistrations by ticket count:');
    Array.from(byTicketCount.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([count, regs]) => {
        console.log(`  ${count} tickets: ${regs} registrations`);
      });
    
    console.log('\nTickets by quantity value:');
    Array.from(byQuantity.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([quantity, count]) => {
        console.log(`  Quantity ${quantity}: ${count} tickets`);
      });
    
    // Save results to JSON
    const outputDir = path.join(process.cwd(), 'script-outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `ticket-quantity-analysis-${timestamp}.json`);
    
    const analysisResults = {
      timestamp: new Date().toISOString(),
      summary: {
        totalAffectedRegistrations: problematicRegistrations.length,
        totalTicketsWithHighQuantity: totalTicketsAffected,
        totalQuantityAcrossAllTickets: totalQuantity,
        expectedTotalTicketsAfterFix: totalExpectedTickets,
        currentTotalTickets: problematicRegistrations.reduce((sum, reg) => {
          const tickets = (reg.registrationData || reg.registration_data)?.tickets || [];
          return sum + tickets.length;
        }, 0)
      },
      patterns: {
        byTicketCount: Object.fromEntries(byTicketCount),
        byQuantityValue: Object.fromEntries(byQuantity)
      },
      sampleRegistrations: sampleRegistrations,
      affectedRegistrationIds: problematicRegistrations.map(r => ({
        registrationId: r.registrationId,
        confirmationNumber: r.confirmationNumber,
        ticketCount: ((r.registrationData || r.registration_data)?.tickets || []).length,
        ticketsWithHighQuantity: ((r.registrationData || r.registration_data)?.tickets || [])
          .filter((t: any) => t.quantity > 1).length
      }))
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(analysisResults, null, 2));
    console.log(`\n✅ Analysis results saved to: ${outputFile}`);
    
    return { 
      registrations: problematicRegistrations,
      analysisResults 
    };
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the analysis
if (require.main === module) {
  analyzeTicketQuantityIssue().catch(console.error);
}

export { analyzeTicketQuantityIssue };