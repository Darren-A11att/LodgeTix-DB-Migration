const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');

// MongoDB connection
const uri = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';
const dbName = 'LodgeTix-migration-test-1';
const client = new MongoClient(uri);

async function analyzeIndividualStandardFormat() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    const registrations = db.collection('registrations');
    
    // Get all individual registrations
    const individuals = await registrations.find({ 
      registrationType: { $in: ['individual', 'individuals'] } 
    }).toArray();
    
    console.log(`\n=== INDIVIDUAL REGISTRATIONS STANDARD FORMAT ANALYSIS ===`);
    console.log(`Total Individual Registrations: ${individuals.length}\n`);
    
    // Part 1: Define the STANDARD FORMAT based on most common pattern
    console.log('PART 1: STANDARD TOP-LEVEL FORMAT');
    console.log('=================================\n');
    
    // Get the most common registration (pattern 1 from previous analysis)
    const standardExample = await registrations.findOne({ 
      registrationType: 'individuals',
      'registrationData.attendees': { $size: 1 }
    });
    
    console.log('Standard Top-Level Fields (Always Present):');
    const standardTopLevel = [
      '_id', 'registrationId', 'registrationType', 'status', 'registrationDate',
      'eventId', 'functionId', 'organisationId', 'organisationName', 'organisationNumber',
      'customerId', 'authUserId', 'bookingContactId', 'primaryAttendeeId',
      'confirmationNumber', 'confirmationGeneratedAt', 'confirmationPdfUrl',
      'agreeToTerms', 'createdAt', 'updatedAt', 'connectedAccountId',
      'paymentStatus', 'primaryAttendee', 'attendeeCount',
      'totalAmountPaid', 'totalPricePaid', 'subtotal',
      'platformFeeAmount', 'platformFeeId', 'includesProcessingFee',
      'stripePaymentIntentId', 'stripeFee',
      'squarePaymentId', 'squareFee',
      'registrationData'
    ];
    
    console.log(`Total: ${standardTopLevel.length} fields\n`);
    
    // Part 2: Analyze registrationData standard structure
    console.log('\nPART 2: STANDARD REGISTRATION DATA STRUCTURE');
    console.log('============================================\n');
    
    const regDataStructures = new Map();
    
    individuals.forEach(reg => {
      if (reg.registrationData) {
        const fields = Object.keys(reg.registrationData).sort();
        const key = fields.join('|');
        if (!regDataStructures.has(key)) {
          regDataStructures.set(key, { count: 0, fields, example: reg._id });
        }
        regDataStructures.get(key).count++;
      }
    });
    
    const mostCommonRegData = Array.from(regDataStructures.values())
      .sort((a, b) => b.count - a.count)[0];
    
    console.log('Standard registrationData fields:');
    console.log(mostCommonRegData.fields.join(', '));
    console.log(`\nUsed by: ${mostCommonRegData.count}/${individuals.length} registrations\n`);
    
    // Part 3: Analyze ATTENDEE structure variations
    console.log('\nPART 3: ATTENDEE STRUCTURE ANALYSIS');
    console.log('===================================\n');
    
    const attendeeStructures = new Map();
    const attendeeFieldFrequency = new Map();
    
    individuals.forEach(reg => {
      if (reg.registrationData && reg.registrationData.attendees) {
        reg.registrationData.attendees.forEach(attendee => {
          const fields = Object.keys(attendee).sort();
          const key = fields.join('|');
          
          // Track structure
          if (!attendeeStructures.has(key)) {
            attendeeStructures.set(key, { 
              count: 0, 
              fields, 
              fieldCount: fields.length,
              exampleRegId: reg._id 
            });
          }
          attendeeStructures.get(key).count++;
          
          // Track field frequency
          fields.forEach(field => {
            attendeeFieldFrequency.set(field, (attendeeFieldFrequency.get(field) || 0) + 1);
          });
        });
      }
    });
    
    // Determine standard attendee fields (present in >90% of attendees)
    const totalAttendees = Array.from(attendeeStructures.values())
      .reduce((sum, s) => sum + s.count, 0);
    
    const standardAttendeeFields = [];
    const optionalAttendeeFields = [];
    const rareAttendeeFields = [];
    
    attendeeFieldFrequency.forEach((count, field) => {
      const percentage = (count / totalAttendees) * 100;
      if (percentage > 90) {
        standardAttendeeFields.push({ field, percentage: percentage.toFixed(1) });
      } else if (percentage > 10) {
        optionalAttendeeFields.push({ field, percentage: percentage.toFixed(1) });
      } else {
        rareAttendeeFields.push({ field, percentage: percentage.toFixed(1) });
      }
    });
    
    console.log('STANDARD Attendee Fields (>90% of attendees):');
    standardAttendeeFields
      .sort((a, b) => b.percentage - a.percentage)
      .forEach(f => console.log(`  ${f.field}: ${f.percentage}%`));
    
    console.log('\nOPTIONAL Attendee Fields (10-90% of attendees):');
    optionalAttendeeFields
      .sort((a, b) => b.percentage - a.percentage)
      .forEach(f => console.log(`  ${f.field}: ${f.percentage}%`));
    
    console.log('\nRARE Attendee Fields (<10% of attendees):');
    rareAttendeeFields
      .sort((a, b) => b.percentage - a.percentage)
      .forEach(f => console.log(`  ${f.field}: ${f.percentage}%`));
    
    // Show attendee structure variations
    console.log('\n\nATTENDEE STRUCTURE VARIATIONS:');
    console.log('------------------------------');
    
    Array.from(attendeeStructures.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .forEach((structure, idx) => {
        console.log(`\nVariation ${idx + 1} (${structure.count} attendees, ${structure.fieldCount} fields):`);
        
        // Show what's different from standard
        const extraFields = structure.fields.filter(f => 
          !standardAttendeeFields.find(sf => sf.field === f)
        );
        const missingFields = standardAttendeeFields
          .map(sf => sf.field)
          .filter(f => !structure.fields.includes(f));
        
        if (missingFields.length > 0) {
          console.log(`  Missing standard fields: ${missingFields.join(', ')}`);
        }
        if (extraFields.length > 0) {
          console.log(`  Additional fields: ${extraFields.join(', ')}`);
        }
        console.log(`  Example registration: ${structure.exampleRegId}`);
      });
    
    // Part 4: Analyze TICKET structure variations
    console.log('\n\nPART 4: TICKET STRUCTURE ANALYSIS');
    console.log('=================================\n');
    
    const ticketStructures = new Map();
    const ticketFieldFrequency = new Map();
    let totalTickets = 0;
    
    individuals.forEach(reg => {
      if (reg.registrationData && reg.registrationData.tickets) {
        Object.values(reg.registrationData.tickets).forEach(ticket => {
          if (typeof ticket === 'object' && ticket !== null) {
            totalTickets++;
            const fields = Object.keys(ticket).sort();
            const key = fields.join('|');
            
            // Track structure
            if (!ticketStructures.has(key)) {
              ticketStructures.set(key, { 
                count: 0, 
                fields, 
                exampleRegId: reg._id,
                exampleTicket: ticket
              });
            }
            ticketStructures.get(key).count++;
            
            // Track field frequency
            fields.forEach(field => {
              ticketFieldFrequency.set(field, (ticketFieldFrequency.get(field) || 0) + 1);
            });
          }
        });
      }
    });
    
    console.log(`Total tickets analyzed: ${totalTickets}`);
    
    // Determine standard ticket fields
    const standardTicketFields = [];
    const optionalTicketFields = [];
    
    ticketFieldFrequency.forEach((count, field) => {
      const percentage = (count / totalTickets) * 100;
      if (percentage > 90) {
        standardTicketFields.push({ field, percentage: percentage.toFixed(1) });
      } else {
        optionalTicketFields.push({ field, percentage: percentage.toFixed(1) });
      }
    });
    
    console.log('\nSTANDARD Ticket Fields (>90% of tickets):');
    standardTicketFields
      .sort((a, b) => b.percentage - a.percentage)
      .forEach(f => console.log(`  ${f.field}: ${f.percentage}%`));
    
    if (optionalTicketFields.length > 0) {
      console.log('\nOPTIONAL Ticket Fields (<90% of tickets):');
      optionalTicketFields
        .sort((a, b) => b.percentage - a.percentage)
        .forEach(f => console.log(`  ${f.field}: ${f.percentage}%`));
    }
    
    // Show ticket structure variations
    console.log('\n\nTICKET STRUCTURE VARIATIONS:');
    console.log('----------------------------');
    
    Array.from(ticketStructures.values())
      .sort((a, b) => b.count - a.count)
      .forEach((structure, idx) => {
        console.log(`\nVariation ${idx + 1} (${structure.count} tickets):`);
        console.log(`  Fields: ${structure.fields.join(', ')}`);
        console.log(`  Example: ${JSON.stringify(structure.exampleTicket, null, 2)}`);
      });
    
    // Part 5: Other variations in registrationData
    console.log('\n\nPART 5: OTHER REGISTRATION DATA VARIATIONS');
    console.log('==========================================\n');
    
    // Check for other array fields
    const otherArrayFields = new Set();
    const objectFields = new Set();
    
    individuals.forEach(reg => {
      if (reg.registrationData) {
        Object.entries(reg.registrationData).forEach(([key, value]) => {
          if (Array.isArray(value) && key !== 'attendees') {
            otherArrayFields.add(key);
          } else if (typeof value === 'object' && value !== null && key !== 'tickets' && key !== 'bookingContact' && key !== 'metadata') {
            objectFields.add(key);
          }
        });
      }
    });
    
    if (otherArrayFields.size > 0) {
      console.log('Other array fields found:');
      otherArrayFields.forEach(field => {
        const count = individuals.filter(r => 
          r.registrationData && Array.isArray(r.registrationData[field])
        ).length;
        console.log(`  ${field}: ${count} registrations`);
      });
    }
    
    if (objectFields.size > 0) {
      console.log('\nOther object fields found:');
      objectFields.forEach(field => {
        const count = individuals.filter(r => 
          r.registrationData && typeof r.registrationData[field] === 'object'
        ).length;
        console.log(`  ${field}: ${count} registrations`);
      });
    }
    
    // Generate summary report
    const report = {
      standardFormat: {
        topLevelFields: standardTopLevel,
        registrationDataFields: mostCommonRegData.fields,
        attendeeFields: {
          standard: standardAttendeeFields.map(f => f.field),
          optional: optionalAttendeeFields.map(f => f.field),
          rare: rareAttendeeFields.map(f => f.field)
        },
        ticketFields: {
          standard: standardTicketFields.map(f => f.field),
          optional: optionalTicketFields.map(f => f.field)
        }
      },
      variations: {
        attendeeStructures: Array.from(attendeeStructures.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        ticketStructures: Array.from(ticketStructures.values())
          .sort((a, b) => b.count - a.count),
        registrationDataPatterns: Array.from(regDataStructures.values())
          .sort((a, b) => b.count - a.count)
      },
      summary: {
        totalRegistrations: individuals.length,
        totalAttendees,
        totalTickets,
        uniqueAttendeeStructures: attendeeStructures.size,
        uniqueTicketStructures: ticketStructures.size,
        uniqueRegDataPatterns: regDataStructures.size
      }
    };
    
    const outputPath = path.join(__dirname, '../outputs/individual-standard-format-analysis.json');
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log(`\nDetailed report saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error analyzing individual standard format:', error);
  } finally {
    await client.close();
  }
}

// Run the analysis
analyzeIndividualStandardFormat().catch(console.error);