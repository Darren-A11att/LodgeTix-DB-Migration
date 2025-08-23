import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

interface FieldAnalysis {
  field: string;
  count: number;
  percentage: number;
  types: Set<string>;
  sampleValues: any[];
  byAttendeeType: Record<string, number>;
}

async function analyzeAttendeeSchemas() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('📊 ANALYZING ATTENDEE SCHEMAS');
  console.log('='.repeat(80));
  
  try {
    const attendeesCollection = db.collection('old_attendees');
    const registrationsCollection = db.collection('old_registrations');
    
    // Get all attendees
    const allAttendees = await attendeesCollection.find({}).toArray();
    console.log(`\n📦 Total Attendees: ${allAttendees.length}`);
    
    // Analyze field frequencies
    const fieldAnalysis: Map<string, FieldAnalysis> = new Map();
    const attendeeTypes: Record<string, number> = {};
    
    // Analyze each attendee
    for (const attendee of allAttendees) {
      // Determine attendee type
      const type = determineType(attendee);
      attendeeTypes[type] = (attendeeTypes[type] || 0) + 1;
      
      // Analyze fields
      analyzeObject(attendee, '', fieldAnalysis, type, allAttendees.length);
    }
    
    // Also analyze registrationData.attendees
    console.log('\n📋 Analyzing Registration Data Attendees...');
    const registrations = await registrationsCollection.find({
      'registrationData.attendees': { $exists: true }
    }).toArray();
    
    let regAttendeeCount = 0;
    const regFieldAnalysis: Map<string, FieldAnalysis> = new Map();
    
    for (const reg of registrations) {
      if (reg.registrationData?.attendees && Array.isArray(reg.registrationData.attendees)) {
        for (const attendee of reg.registrationData.attendees) {
          regAttendeeCount++;
          const type = determineType(attendee);
          analyzeObject(attendee, '', regFieldAnalysis, type, 1); // Will normalize later
        }
      }
    }
    
    // Normalize registration field analysis
    for (const [field, analysis] of regFieldAnalysis) {
      analysis.percentage = (analysis.count / regAttendeeCount) * 100;
    }
    
    // Print results
    console.log('\n' + '='.repeat(80));
    console.log('📊 ATTENDEE TYPE DISTRIBUTION');
    console.log('-'.repeat(40));
    for (const [type, count] of Object.entries(attendeeTypes)) {
      console.log(`  ${type}: ${count} (${((count/allAttendees.length)*100).toFixed(1)}%)`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMMON FIELDS (>90% presence)');
    console.log('-'.repeat(40));
    const commonFields = Array.from(fieldAnalysis.entries())
      .filter(([_, analysis]) => analysis.percentage > 90)
      .sort((a, b) => b[1].percentage - a[1].percentage);
    
    for (const [field, analysis] of commonFields) {
      console.log(`\n  ${field}: ${analysis.percentage.toFixed(1)}%`);
      console.log(`    Types: ${Array.from(analysis.types).join(', ')}`);
      if (analysis.sampleValues.length > 0) {
        console.log(`    Sample: ${JSON.stringify(analysis.sampleValues[0])}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 TYPE-SPECIFIC FIELDS');
    console.log('-'.repeat(40));
    
    // Mason-specific fields
    console.log('\n🔨 Mason-Specific Fields:');
    const masonFields = Array.from(fieldAnalysis.entries())
      .filter(([_, analysis]) => {
        const masonRatio = (analysis.byAttendeeType['mason'] || 0) / attendeeTypes['mason'];
        const otherRatio = (analysis.count - (analysis.byAttendeeType['mason'] || 0)) / 
                          (allAttendees.length - attendeeTypes['mason']);
        return masonRatio > 0.5 && masonRatio > otherRatio * 2;
      });
    
    for (const [field, analysis] of masonFields.slice(0, 10)) {
      const masonPercentage = ((analysis.byAttendeeType['mason'] || 0) / attendeeTypes['mason'] * 100);
      console.log(`  ${field}: ${masonPercentage.toFixed(1)}% of masons have this`);
    }
    
    // Partner-specific fields
    console.log('\n💑 Partner/Relationship Fields:');
    const partnerFields = Array.from(fieldAnalysis.entries())
      .filter(([field, _]) => field.includes('partner') || field.includes('Partner') || 
                              field.includes('relationship'));
    
    for (const [field, analysis] of partnerFields) {
      console.log(`  ${field}: ${analysis.percentage.toFixed(1)}% overall`);
      const samples = analysis.sampleValues.filter(v => v && v !== '').slice(0, 3);
      if (samples.length > 0) {
        console.log(`    Samples: ${JSON.stringify(samples)}`);
      }
    }
    
    // Contact fields
    console.log('\n📞 Contact Fields:');
    const contactFields = Array.from(fieldAnalysis.entries())
      .filter(([field, _]) => field.includes('email') || field.includes('phone') || 
                              field.includes('mobile') || field.includes('contact'));
    
    for (const [field, analysis] of contactFields.slice(0, 10)) {
      console.log(`  ${field}: ${analysis.percentage.toFixed(1)}%`);
    }
    
    // Special requirements
    console.log('\n🍽️ Special Requirements Fields:');
    const specialFields = Array.from(fieldAnalysis.entries())
      .filter(([field, _]) => field.includes('dietary') || field.includes('special') || 
                              field.includes('accessibility') || field.includes('requirements'));
    
    for (const [field, analysis] of specialFields) {
      console.log(`  ${field}: ${analysis.percentage.toFixed(1)}%`);
      const nonEmptyValues = analysis.sampleValues.filter(v => v && v !== '').slice(0, 3);
      if (nonEmptyValues.length > 0) {
        console.log(`    Samples: ${JSON.stringify(nonEmptyValues)}`);
      }
    }
    
    // Lodge-specific fields
    console.log('\n🏛️ Lodge-Related Fields:');
    const lodgeFields = Array.from(fieldAnalysis.entries())
      .filter(([field, _]) => field.includes('lodge') || field.includes('Lodge') || 
                              field.includes('rank') || field.includes('grand'));
    
    for (const [field, analysis] of lodgeFields.slice(0, 15)) {
      console.log(`  ${field}: ${analysis.percentage.toFixed(1)}%`);
    }
    
    // Compare with registrationData.attendees structure
    console.log('\n' + '='.repeat(80));
    console.log('📊 REGISTRATION DATA ATTENDEES STRUCTURE');
    console.log('-'.repeat(40));
    console.log(`\nTotal attendees in registrationData: ${regAttendeeCount}`);
    
    const regCommonFields = Array.from(regFieldAnalysis.entries())
      .filter(([_, analysis]) => analysis.percentage > 50)
      .sort((a, b) => b[1].percentage - a[1].percentage);
    
    console.log('\nMost common fields in registrationData.attendees:');
    for (const [field, analysis] of regCommonFields.slice(0, 20)) {
      console.log(`  ${field}: ${analysis.percentage.toFixed(1)}%`);
    }
    
    // Generate schema recommendations
    console.log('\n' + '='.repeat(80));
    console.log('📋 RECOMMENDED FORM SCHEMAS');
    console.log('-'.repeat(40));
    
    console.log('\n✅ MASON FORM SCHEMA:');
    console.log('  Required: firstName, lastName, email, lodgeName, lodgeNumber, rank');
    console.log('  Optional: title, phone, dietary, specialNeeds, grandLodge');
    
    console.log('\n✅ GUEST FORM SCHEMA:');
    console.log('  Required: firstName, lastName, email');
    console.log('  Optional: title, phone, dietary, specialNeeds, isPartner, partnerOf');
    
    console.log('\n✅ LODGE FORM SCHEMA:');
    console.log('  Lodge Details: lodgeName, lodgeNumber, address, city, state, postcode');
    console.log('  Representative: name, email, phone');
    console.log('  Attendees Array with: firstName, lastName, type, rank (if mason)');
    
  } catch (error) {
    console.error('❌ Error analyzing schemas:', error);
  } finally {
    await client.close();
  }
}

function determineType(attendee: any): string {
  if (attendee.attendeeType) return attendee.attendeeType;
  if (attendee.type) return attendee.type;
  if (attendee.rank || attendee.lodgeNumber) return 'mason';
  if (attendee.isPartner || attendee.partner) return 'partner';
  return 'guest';
}

function analyzeObject(
  obj: any, 
  prefix: string, 
  fieldAnalysis: Map<string, FieldAnalysis>,
  attendeeType: string,
  totalCount: number
) {
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_id' || key === '__v') continue;
    
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    
    if (!fieldAnalysis.has(fieldPath)) {
      fieldAnalysis.set(fieldPath, {
        field: fieldPath,
        count: 0,
        percentage: 0,
        types: new Set(),
        sampleValues: [],
        byAttendeeType: {}
      });
    }
    
    const analysis = fieldAnalysis.get(fieldPath)!;
    analysis.count++;
    analysis.percentage = (analysis.count / totalCount) * 100;
    analysis.types.add(typeof value);
    analysis.byAttendeeType[attendeeType] = (analysis.byAttendeeType[attendeeType] || 0) + 1;
    
    if (analysis.sampleValues.length < 5 && value !== null && value !== undefined) {
      analysis.sampleValues.push(value);
    }
    
    // Don't recurse into arrays or deep objects for this analysis
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && prefix.split('.').length < 2) {
      analyzeObject(value, fieldPath, fieldAnalysis, attendeeType, totalCount);
    }
  }
}

// Always run when this file is executed
analyzeAttendeeSchemas()
  .then(() => {
    console.log('\n✅ Analysis completed!');
  })
  .catch(error => {
    console.error('\n❌ Analysis failed:', error);
  });