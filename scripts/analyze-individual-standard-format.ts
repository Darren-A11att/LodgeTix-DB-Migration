import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { promises as fs } from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface FieldFrequency {
  field: string;
  percentage: string;
}

interface StructureVariation {
  count: number;
  fields: string[];
  fieldCount: number;
  exampleRegId: ObjectId;
}

interface TicketStructure {
  count: number;
  fields: string[];
  exampleRegId: ObjectId;
  exampleTicket: any;
}

interface Attendee {
  [key: string]: any;
}

interface RegistrationData {
  attendees?: Attendee[];
  tickets?: { [key: string]: any };
  bookingContact?: any;
  metadata?: any;
  [key: string]: any;
}

interface Registration {
  _id: ObjectId;
  registrationId?: string;
  registrationType?: string;
  status?: string;
  registrationDate?: Date;
  eventId?: string;
  functionId?: string;
  organisationId?: string;
  organisationName?: string;
  organisationNumber?: string;
  customerId?: string;
  authUserId?: string;
  bookingContactId?: string;
  primaryAttendeeId?: string;
  confirmationNumber?: string;
  confirmationGeneratedAt?: Date;
  confirmationPdfUrl?: string;
  agreeToTerms?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  connectedAccountId?: string;
  paymentStatus?: string;
  primaryAttendee?: any;
  attendeeCount?: number;
  totalAmountPaid?: number;
  totalPricePaid?: number;
  subtotal?: number;
  platformFeeAmount?: number;
  platformFeeId?: string;
  includesProcessingFee?: boolean;
  stripePaymentIntentId?: string;
  stripeFee?: number;
  squarePaymentId?: string;
  squareFee?: number;
  registrationData?: RegistrationData;
}

interface StandardFormat {
  topLevelFields: string[];
  registrationDataFields: string[];
  attendeeFields: {
    standard: string[];
    optional: string[];
    rare: string[];
  };
  ticketFields: {
    standard: string[];
    optional: string[];
  };
}

interface Report {
  standardFormat: StandardFormat;
  variations: {
    attendeeStructures: StructureVariation[];
    ticketStructures: TicketStructure[];
    registrationDataPatterns: any[];
  };
  summary: {
    totalRegistrations: number;
    totalAttendees: number;
    totalTickets: number;
    uniqueAttendeeStructures: number;
    uniqueTicketStructures: number;
    uniqueRegDataPatterns: number;
  };
}

async function analyzeIndividualStandardFormat(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db: Db = client.db(dbName);
    const registrations: Collection<Registration> = db.collection('registrations');
    
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
    
    const regDataStructures = new Map<string, { count: number; fields: string[]; example: ObjectId }>();
    
    individuals.forEach(reg => {
      if (reg.registrationData) {
        const fields = Object.keys(reg.registrationData).sort();
        const key = fields.join('|');
        if (!regDataStructures.has(key)) {
          regDataStructures.set(key, { count: 0, fields, example: reg._id });
        }
        regDataStructures.get(key)!.count++;
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
    
    const attendeeStructures = new Map<string, StructureVariation>();
    const attendeeFieldFrequency = new Map<string, number>();
    
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
          attendeeStructures.get(key)!.count++;
          
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
    
    const standardAttendeeFields: FieldFrequency[] = [];
    const optionalAttendeeFields: FieldFrequency[] = [];
    const rareAttendeeFields: FieldFrequency[] = [];
    
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
      .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage))
      .forEach(f => console.log(`  ${f.field}: ${f.percentage}%`));
    
    console.log('\nOPTIONAL Attendee Fields (10-90% of attendees):');
    optionalAttendeeFields
      .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage))
      .forEach(f => console.log(`  ${f.field}: ${f.percentage}%`));
    
    console.log('\nRARE Attendee Fields (<10% of attendees):');
    rareAttendeeFields
      .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage))
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
    
    const ticketStructures = new Map<string, TicketStructure>();
    const ticketFieldFrequency = new Map<string, number>();
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
            ticketStructures.get(key)!.count++;
            
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
    const standardTicketFields: FieldFrequency[] = [];
    const optionalTicketFields: FieldFrequency[] = [];
    
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
      .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage))
      .forEach(f => console.log(`  ${f.field}: ${f.percentage}%`));
    
    if (optionalTicketFields.length > 0) {
      console.log('\nOPTIONAL Ticket Fields (<90% of tickets):');
      optionalTicketFields
        .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage))
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
    const otherArrayFields = new Set<string>();
    const objectFields = new Set<string>();
    
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
    const report: Report = {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error analyzing individual standard format:', errorMessage);
  } finally {
    await client.close();
  }
}

// Run the analysis
analyzeIndividualStandardFormat().catch(console.error);