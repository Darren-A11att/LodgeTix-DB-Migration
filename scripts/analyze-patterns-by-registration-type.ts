import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { promises as fs } from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface RegistrationDataStructure {
  type?: string;
  hasAttendees?: boolean;
  attendeeCount?: number;
  hasLodgeDetails?: boolean;
  hasTableCount?: boolean;
  hasTickets?: boolean;
  hasSelectedTickets?: boolean;
  hasBookingContact?: boolean;
  hasBillingContact?: boolean;
  topLevelFieldCount?: number;
}

interface PatternInfo {
  count: number;
  fields: string[];
  exampleId: ObjectId;
  registrationDataStructure: RegistrationDataStructure;
  hasInvoice: boolean;
  hasMatching: boolean;
  hasUpdateTracking: boolean;
}

interface RegistrationData {
  attendees?: any[];
  lodgeDetails?: any;
  tableCount?: number;
  tickets?: any;
  selectedTickets?: any[];
  bookingContact?: any;
  billingContact?: any;
}

interface Registration {
  _id: ObjectId;
  registrationType?: string;
  registrationData?: RegistrationData;
  invoiceId?: string;
  matchedPaymentId?: string;
  lastPriceUpdate?: Date;
  __v?: number;
  [key: string]: any;
}

interface RegistrationTypeCount {
  _id: string | null;
  count: number;
  exampleIds: ObjectId[];
}

interface ReportPattern {
  patternNumber: number;
  count: number;
  fieldCount: number;
  coreFieldCount: number;
  hasInvoice: boolean;
  hasMatching: boolean;
  hasUpdateTracking: boolean;
  registrationDataStructure: RegistrationDataStructure;
}

interface Report {
  summary: {
    totalIndividualPatterns: number;
    totalLodgePatterns: number;
    totalIndividualRegistrations: number;
    totalLodgeRegistrations: number;
  };
  individualPatterns: ReportPattern[];
  lodgePatterns: ReportPattern[];
  fieldDifferences: {
    uniqueToIndividuals: string[];
    uniqueToLodges: string[];
    commonFieldsCount: number;
  };
}

async function analyzePatternsByRegistrationType(): Promise<void> {
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
    
    // First, let's understand how registration types are identified
    console.log('\n=== REGISTRATION TYPE ANALYSIS ===\n');
    
    // Check registrationType field values
    const registrationTypes: RegistrationTypeCount[] = await registrations.aggregate([
      {
        $group: {
          _id: '$registrationType',
          count: { $sum: 1 },
          exampleIds: { $push: '$_id' }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('Registration Types Found:');
    registrationTypes.forEach(type => {
      console.log(`  ${type._id || 'null'}: ${type.count} registrations`);
    });
    
    // Now analyze patterns for each type
    const individualPatterns = new Map<string, PatternInfo>();
    const lodgePatterns = new Map<string, PatternInfo>();
    
    // Get all registrations and analyze their structure by type
    const cursor = registrations.find({});
    
    while (await cursor.hasNext()) {
      const reg = await cursor.next();
      if (!reg) continue;
      
      // Determine if this is individual or lodge
      const isLodge = reg.registrationType === 'lodge' || 
                     reg.registrationType === 'lodges' ||
                     (reg.registrationData && reg.registrationData.lodgeDetails) ||
                     (reg.registrationData && reg.registrationData.tableCount);
      
      const isIndividual = reg.registrationType === 'individual' || 
                          reg.registrationType === 'individuals' ||
                          (reg.registrationData && reg.registrationData.attendees && reg.registrationData.attendees.length > 0);
      
      // Create structure signature (excluding payment-specific fields)
      const structure = getStructureSignature(reg, true);
      const structureKey = JSON.stringify(structure);
      
      // Categorize the pattern
      if (isLodge) {
        if (!lodgePatterns.has(structureKey)) {
          lodgePatterns.set(structureKey, {
            count: 0,
            fields: structure,
            exampleId: reg._id,
            registrationDataStructure: analyzeRegistrationDataStructure(reg.registrationData),
            hasInvoice: !!reg.invoiceId,
            hasMatching: !!reg.matchedPaymentId,
            hasUpdateTracking: !!reg.lastPriceUpdate
          });
        }
        lodgePatterns.get(structureKey)!.count++;
      } else if (isIndividual) {
        if (!individualPatterns.has(structureKey)) {
          individualPatterns.set(structureKey, {
            count: 0,
            fields: structure,
            exampleId: reg._id,
            registrationDataStructure: analyzeRegistrationDataStructure(reg.registrationData),
            hasInvoice: !!reg.invoiceId,
            hasMatching: !!reg.matchedPaymentId,
            hasUpdateTracking: !!reg.lastPriceUpdate
          });
        }
        individualPatterns.get(structureKey)!.count++;
      }
    }
    
    // Analyze and report findings
    console.log('\n=== STRUCTURAL PATTERNS BY REGISTRATION TYPE ===\n');
    
    console.log(`1. INDIVIDUAL REGISTRATIONS:`);
    console.log(`   Total unique patterns: ${individualPatterns.size}`);
    
    const sortedIndividualPatterns = Array.from(individualPatterns.values()).sort((a, b) => b.count - a.count);
    sortedIndividualPatterns.forEach((pattern, idx) => {
      console.log(`\n   Pattern ${idx + 1} (${pattern.count} registrations):`);
      console.log(`     - Core fields: ${pattern.fields.filter(f => !isPaymentField(f)).length}`);
      console.log(`     - Has invoice fields: ${pattern.hasInvoice}`);
      console.log(`     - Has matching fields: ${pattern.hasMatching}`);
      console.log(`     - Has update tracking: ${pattern.hasUpdateTracking}`);
      console.log(`     - Registration data structure: ${JSON.stringify(pattern.registrationDataStructure)}`);
    });
    
    console.log(`\n2. LODGE REGISTRATIONS:`);
    console.log(`   Total unique patterns: ${lodgePatterns.size}`);
    
    const sortedLodgePatterns = Array.from(lodgePatterns.values()).sort((a, b) => b.count - a.count);
    sortedLodgePatterns.forEach((pattern, idx) => {
      console.log(`\n   Pattern ${idx + 1} (${pattern.count} registrations):`);
      console.log(`     - Core fields: ${pattern.fields.filter(f => !isPaymentField(f)).length}`);
      console.log(`     - Has invoice fields: ${pattern.hasInvoice}`);
      console.log(`     - Has matching fields: ${pattern.hasMatching}`);
      console.log(`     - Has update tracking: ${pattern.hasUpdateTracking}`);
      console.log(`     - Registration data structure: ${JSON.stringify(pattern.registrationDataStructure)}`);
    });
    
    // Find fields unique to each type
    console.log('\n=== FIELDS UNIQUE TO EACH TYPE ===\n');
    
    const individualFields = new Set<string>();
    const lodgeFields = new Set<string>();
    
    sortedIndividualPatterns.forEach(pattern => {
      pattern.fields.forEach(field => individualFields.add(field));
    });
    
    sortedLodgePatterns.forEach(pattern => {
      pattern.fields.forEach(field => lodgeFields.add(field));
    });
    
    const uniqueToIndividuals = Array.from(individualFields).filter(f => !lodgeFields.has(f) && !isPaymentField(f));
    const uniqueToLodges = Array.from(lodgeFields).filter(f => !individualFields.has(f) && !isPaymentField(f));
    const commonFields = Array.from(individualFields).filter(f => lodgeFields.has(f) && !isPaymentField(f));
    
    console.log('Fields unique to INDIVIDUAL registrations:');
    uniqueToIndividuals.forEach(field => console.log(`  - ${field}`));
    
    console.log('\nFields unique to LODGE registrations:');
    uniqueToLodges.forEach(field => console.log(`  - ${field}`));
    
    console.log('\nCommon fields (appearing in both types):');
    console.log(`  Total: ${commonFields.length} fields`);
    
    // Analyze registrationData differences
    console.log('\n=== REGISTRATION DATA STRUCTURE DIFFERENCES ===\n');
    
    const individualRegData = await registrations.findOne({ 
      registrationType: { $in: ['individual', 'individuals'] },
      'registrationData.attendees': { $exists: true }
    });
    
    const lodgeRegData = await registrations.findOne({ 
      registrationType: { $in: ['lodge', 'lodges'] },
      'registrationData.lodgeDetails': { $exists: true }
    });
    
    if (individualRegData) {
      console.log('INDIVIDUAL Registration Data Structure:');
      console.log('  Top-level fields:', Object.keys(individualRegData.registrationData || {}));
      if (individualRegData.registrationData && individualRegData.registrationData.attendees && individualRegData.registrationData.attendees[0]) {
        console.log('  Attendee fields:', Object.keys(individualRegData.registrationData.attendees[0]));
      }
    }
    
    if (lodgeRegData) {
      console.log('\nLODGE Registration Data Structure:');
      console.log('  Top-level fields:', Object.keys(lodgeRegData.registrationData || {}));
      if (lodgeRegData.registrationData && lodgeRegData.registrationData.lodgeDetails) {
        console.log('  Lodge details:', Object.keys(lodgeRegData.registrationData.lodgeDetails));
      }
    }
    
    // Create summary report
    const report: Report = {
      summary: {
        totalIndividualPatterns: individualPatterns.size,
        totalLodgePatterns: lodgePatterns.size,
        totalIndividualRegistrations: Array.from(individualPatterns.values()).reduce((sum, p) => sum + p.count, 0),
        totalLodgeRegistrations: Array.from(lodgePatterns.values()).reduce((sum, p) => sum + p.count, 0)
      },
      individualPatterns: sortedIndividualPatterns.map((p, idx) => ({
        patternNumber: idx + 1,
        count: p.count,
        fieldCount: p.fields.length,
        coreFieldCount: p.fields.filter(f => !isPaymentField(f)).length,
        hasInvoice: p.hasInvoice,
        hasMatching: p.hasMatching,
        hasUpdateTracking: p.hasUpdateTracking,
        registrationDataStructure: p.registrationDataStructure
      })),
      lodgePatterns: sortedLodgePatterns.map((p, idx) => ({
        patternNumber: idx + 1,
        count: p.count,
        fieldCount: p.fields.length,
        coreFieldCount: p.fields.filter(f => !isPaymentField(f)).length,
        hasInvoice: p.hasInvoice,
        hasMatching: p.hasMatching,
        hasUpdateTracking: p.hasUpdateTracking,
        registrationDataStructure: p.registrationDataStructure
      })),
      fieldDifferences: {
        uniqueToIndividuals,
        uniqueToLodges,
        commonFieldsCount: commonFields.length
      }
    };
    
    const outputPath = path.join(__dirname, '../outputs/registration-patterns-by-type.json');
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log(`\nDetailed report saved to: ${outputPath}`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error analyzing patterns by registration type:', errorMessage);
  } finally {
    await client.close();
  }
}

function getStructureSignature(obj: Registration, excludePaymentFields: boolean = false): string[] {
  let keys = Object.keys(obj).sort();
  keys = keys.filter(key => key !== '_id' && key !== '__v');
  
  if (excludePaymentFields) {
    keys = keys.filter(key => !isPaymentField(key));
  }
  
  return keys;
}

function isPaymentField(field: string): boolean {
  const paymentFields = [
    'stripePaymentIntentId', 'stripeFee', 'stripeCustomerId',
    'squarePaymentId', 'squareFee', 'square_payment_id', 'square_customer_id',
    'paymentMethod', 'paymentProcessor'
  ];
  return paymentFields.includes(field);
}

function analyzeRegistrationDataStructure(regData?: RegistrationData): RegistrationDataStructure {
  if (!regData) return { type: 'empty' };
  
  return {
    hasAttendees: !!regData.attendees,
    attendeeCount: regData.attendees ? regData.attendees.length : 0,
    hasLodgeDetails: !!regData.lodgeDetails,
    hasTableCount: !!regData.tableCount,
    hasTickets: !!regData.tickets,
    hasSelectedTickets: !!regData.selectedTickets,
    hasBookingContact: !!regData.bookingContact,
    hasBillingContact: !!regData.billingContact,
    topLevelFieldCount: Object.keys(regData).length
  };
}

// Run the analysis
analyzePatternsByRegistrationType().catch(console.error);