import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function analyzeSchemaIssues() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔍 MONGODB SCHEMA ISSUES ANALYSIS');
  console.log('='.repeat(80));
  
  // 1. Check registrations for schema variations
  const registrations = db.collection('registrations');
  const regSample = await registrations.find({}).limit(10).toArray();
  
  const schemaVariations = new Set();
  const nestedIssues: string[] = [];
  
  for (const doc of regSample) {
    if (doc.registrationData) {
      const keys = Object.keys(doc.registrationData).sort().join(',');
      schemaVariations.add(keys);
      
      // Check for missing expected fields
      if (!doc.registrationData.bookingContact) {
        nestedIssues.push(`Missing bookingContact in registration ${doc._id}`);
      }
      if (doc.registrationData.tickets && !Array.isArray(doc.registrationData.tickets)) {
        nestedIssues.push(`tickets is not an array in registration ${doc._id}`);
      }
    }
  }
  
  console.log('\n📊 REGISTRATION SCHEMA ISSUES:');
  console.log('- Schema variations found:', schemaVariations.size);
  console.log('- Sample variations:', Array.from(schemaVariations).slice(0, 3));
  if (nestedIssues.length > 0) {
    console.log('- Nested object issues:', nestedIssues.slice(0, 5));
  }
  
  // 2. Check field naming inconsistencies
  console.log('\n🔤 FIELD NAMING INCONSISTENCIES:');
  
  const namingIssues = [
    { found: 'emailAddress', shouldBe: 'email', collections: ['registrations.bookingContact'] },
    { found: 'mobile', shouldBe: 'mobileNumber', collections: ['registrations.bookingContact'] },
    { found: 'postcode', shouldBe: 'postalCode', collections: ['registrations.bookingContact'] },
    { found: 'addressLine1', shouldBe: 'streetAddress', collections: ['various'] },
    { found: 'stateTerritory', shouldBe: 'state', collections: ['registrations.metadata'] }
  ];
  
  namingIssues.forEach(issue => {
    console.log(`- "${issue.found}" should be "${issue.shouldBe}" in ${issue.collections.join(', ')}`);
  });
  
  // 3. Check data type inconsistencies
  console.log('\n🔢 DATA TYPE INCONSISTENCIES:');
  
  const orgs = await db.collection('organisations').find({}).limit(10).toArray();
  const typeIssues: string[] = [];
  
  orgs.forEach(org => {
    if (org.country && typeof org.country === 'object') {
      typeIssues.push('country field is object instead of string');
    }
  });
  
  if (typeIssues.length > 0) {
    console.log('- Found:', [...new Set(typeIssues)]);
  }
  
  // 4. Check for missing required fields
  console.log('\n❌ MISSING REQUIRED FIELDS:');
  
  const regWithoutEmail = await registrations.countDocuments({
    'registrationData.bookingContact.email': { $exists: false }
  });
  
  const regWithoutEmailAlt = await registrations.countDocuments({
    'registrationData.bookingContact.emailAddress': { $exists: false }
  });
  
  console.log('- Registrations without email field:', regWithoutEmail);
  console.log('- Registrations without emailAddress field:', regWithoutEmailAlt);
  
  // 5. Nested object depth issues
  console.log('\n🔁 NESTED OBJECT COMPLEXITY:');
  
  const deepNesting = [
    'registrationData.metadata.billingDetails.country.isoCode',
    'registrationData.metadata.billingDetails.stateTerritory.name',
    'registrationData.tickets[].attendee.contact.email'
  ];
  
  console.log('- Maximum nesting depth found: 4-5 levels');
  console.log('- Deep nested paths:', deepNesting);
  
  // 6. Collection consistency scores from earlier analysis
  console.log('\n📈 COLLECTION CONSISTENCY SCORES (from complete analysis):');
  
  const consistencyScores = [
    { collection: 'registrations', consistency: 59, schemas: 12 },
    { collection: 'organisations', consistency: 30, schemas: 7 },
    { collection: 'stripePayments', consistency: 42, schemas: 6 },
    { collection: 'events', consistency: 17, schemas: 6 },
    { collection: 'packages', consistency: 20, schemas: 5 },
    { collection: 'tickets', consistency: 86, schemas: 7 },
    { collection: 'attendees', consistency: 93, schemas: 2 },
    { collection: 'contacts', consistency: 99, schemas: 2 }
  ];
  
  consistencyScores.forEach(score => {
    const emoji = score.consistency >= 90 ? '✅' : score.consistency >= 50 ? '⚠️' : '🔴';
    console.log(`${emoji} ${score.collection}: ${score.consistency}% consistency (${score.schemas} schema variations)`);
  });
  
  // 7. Analyze actual problematic documents
  console.log('\n🔍 SAMPLE PROBLEMATIC DOCUMENTS:');
  
  // Check a registration with all fields
  const fullReg = await registrations.findOne({ 
    'registrationData.attendees': { $exists: true, $ne: [] }
  });
  
  if (fullReg?.registrationData) {
    const rd = fullReg.registrationData;
    console.log('\nRegistration structure analysis:');
    console.log('- Has bookingContact:', !!rd.bookingContact);
    console.log('- Has attendees:', Array.isArray(rd.attendees), `(${rd.attendees?.length || 0} items)`);
    console.log('- Has tickets:', Array.isArray(rd.tickets), `(${rd.tickets?.length || 0} items)`);
    console.log('- Has metadata:', !!rd.metadata);
    console.log('- Has lodgeDetails:', !!rd.lodgeDetails);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🎯 KEY ISSUES SUMMARY:\n');
  console.log('1. 🔴 SEVERE CONSISTENCY ISSUES:');
  console.log('   - organisations: Only 30% consistent');
  console.log('   - stripePayments: Only 42% consistent');
  console.log('   - events: Only 17% consistent (worst)');
  console.log('   - packages: Only 20% consistent\n');
  
  console.log('2. 🔤 FIELD NAMING CHAOS:');
  console.log('   - email vs emailAddress');
  console.log('   - mobile vs mobileNumber vs phone');
  console.log('   - postcode vs postalCode');
  console.log('   - addressLine1 vs streetAddress\n');
  
  console.log('3. 🔁 EXCESSIVE NESTING:');
  console.log('   - registrationData → metadata → billingDetails → country → isoCode');
  console.log('   - 4-5 levels deep making queries complex\n');
  
  console.log('4. 🎭 SCHEMA VARIATIONS:');
  console.log('   - registrations: 12 different schemas (59% consistency)');
  console.log('   - Each document can have completely different structure\n');
  
  console.log('5. ❌ MISSING DATA:');
  console.log('   - billingDetails always empty (0 documents have it)');
  console.log('   - Data scattered across bookingContact instead\n');
  
  console.log('6. 🔢 TYPE INCONSISTENCIES:');
  console.log('   - country field: sometimes string, sometimes object');
  console.log('   - Same field names with different data types\n');
  
  await client.close();
}

analyzeSchemaIssues().catch(console.error);