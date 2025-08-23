import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

interface FieldStats {
  present: number;
  empty: number;
  null: number;
  dataTypes: Set<string>;
  sampleValues: any[];
  nestedFields?: Map<string, FieldStats>;
}

async function analyzeRegistrationDataStructure() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔍 DEEP ANALYSIS: registrationData OBJECT STRUCTURE');
  console.log('='.repeat(80));
  
  const registrations = db.collection('registrations');
  const allRegs = await registrations.find({}).toArray();
  
  console.log(`📊 Analyzing ${allRegs.length} registration documents\n`);
  
  // ============================================================================
  // PART 1: OVERALL registrationData ANALYSIS
  // ============================================================================
  
  console.log('📁 TOP-LEVEL: registrationData Object');
  console.log('-'.repeat(40));
  
  // Count how many have registrationData at all
  const hasRegistrationData = allRegs.filter(r => r.registrationData).length;
  const noRegistrationData = allRegs.filter(r => !r.registrationData).length;
  
  console.log(`✅ Has registrationData: ${hasRegistrationData} (${(hasRegistrationData/allRegs.length*100).toFixed(1)}%)`);
  console.log(`❌ Missing registrationData: ${noRegistrationData} (${(noRegistrationData/allRegs.length*100).toFixed(1)}%)`);
  
  // Analyze all top-level fields in registrationData
  const registrationDataFields = new Map<string, FieldStats>();
  
  for (const reg of allRegs) {
    if (!reg.registrationData) continue;
    
    for (const [key, value] of Object.entries(reg.registrationData)) {
      if (!registrationDataFields.has(key)) {
        registrationDataFields.set(key, {
          present: 0,
          empty: 0,
          null: 0,
          dataTypes: new Set(),
          sampleValues: []
        });
      }
      
      const stats = registrationDataFields.get(key)!;
      
      if (value === null) {
        stats.null++;
      } else if (value === '' || (Array.isArray(value) && value.length === 0)) {
        stats.empty++;
      } else {
        stats.present++;
        stats.dataTypes.add(Array.isArray(value) ? 'array' : typeof value);
        if (stats.sampleValues.length < 3 && typeof value !== 'object') {
          stats.sampleValues.push(value);
        }
      }
    }
  }
  
  console.log(`\n📋 Fields found in registrationData (${registrationDataFields.size} unique fields):\n`);
  
  // Sort by frequency
  const sortedFields = Array.from(registrationDataFields.entries())
    .sort((a, b) => (b[1].present + b[1].empty + b[1].null) - (a[1].present + a[1].empty + a[1].null));
  
  for (const [field, stats] of sortedFields) {
    const total = stats.present + stats.empty + stats.null;
    const percentage = (total / hasRegistrationData * 100).toFixed(1);
    const presentPct = (stats.present / total * 100).toFixed(1);
    
    console.log(`  📌 ${field}:`);
    console.log(`     Appears in: ${total}/${hasRegistrationData} documents (${percentage}%)`);
    console.log(`     Has value: ${stats.present} (${presentPct}%)`);
    console.log(`     Empty: ${stats.empty}, Null: ${stats.null}`);
    console.log(`     Types: ${Array.from(stats.dataTypes).join(', ')}`);
    
    if (stats.sampleValues.length > 0) {
      console.log(`     Samples: ${stats.sampleValues.slice(0, 2).join(', ')}`);
    }
    console.log();
  }
  
  // ============================================================================
  // PART 2: ANALYZE NESTED OBJECTS
  // ============================================================================
  
  console.log('='.repeat(80));
  console.log('\n🔍 NESTED OBJECT ANALYSIS\n');
  
  // 2.1 - bookingContact
  console.log('👤 registrationData.bookingContact');
  console.log('-'.repeat(40));
  
  const bookingContactStats = new Map<string, FieldStats>();
  let hasBookingContact = 0;
  
  for (const reg of allRegs) {
    if (!reg.registrationData?.bookingContact) continue;
    hasBookingContact++;
    
    for (const [key, value] of Object.entries(reg.registrationData.bookingContact)) {
      if (!bookingContactStats.has(key)) {
        bookingContactStats.set(key, {
          present: 0,
          empty: 0,
          null: 0,
          dataTypes: new Set(),
          sampleValues: []
        });
      }
      
      const stats = bookingContactStats.get(key)!;
      
      if (value === null || value === undefined) {
        stats.null++;
      } else if (value === '') {
        stats.empty++;
      } else {
        stats.present++;
        stats.dataTypes.add(typeof value);
        if (stats.sampleValues.length < 3) {
          stats.sampleValues.push(value);
        }
      }
    }
  }
  
  console.log(`Found in ${hasBookingContact}/${hasRegistrationData} registrationData objects\n`);
  console.log('Fields in bookingContact:\n');
  
  for (const [field, stats] of bookingContactStats) {
    const total = stats.present + stats.empty + stats.null;
    const valuePct = (stats.present / total * 100).toFixed(1);
    const emptyPct = ((stats.empty + stats.null) / total * 100).toFixed(1);
    
    console.log(`  • ${field}:`);
    console.log(`    Has value: ${valuePct}% | Empty: ${emptyPct}%`);
    
    if (stats.sampleValues.length > 0) {
      console.log(`    Sample: "${stats.sampleValues[0]}"`);
    }
  }
  
  // 2.2 - tickets array
  console.log('\n🎫 registrationData.tickets[]');
  console.log('-'.repeat(40));
  
  let hasTickets = 0;
  let totalTickets = 0;
  const ticketFieldStats = new Map<string, FieldStats>();
  
  for (const reg of allRegs) {
    if (!reg.registrationData?.tickets) continue;
    hasTickets++;
    
    if (Array.isArray(reg.registrationData.tickets)) {
      totalTickets += reg.registrationData.tickets.length;
      
      for (const ticket of reg.registrationData.tickets) {
        for (const [key, value] of Object.entries(ticket)) {
          if (!ticketFieldStats.has(key)) {
            ticketFieldStats.set(key, {
              present: 0,
              empty: 0,
              null: 0,
              dataTypes: new Set(),
              sampleValues: []
            });
          }
          
          const stats = ticketFieldStats.get(key)!;
          
          if (value === null || value === undefined) {
            stats.null++;
          } else if (value === '') {
            stats.empty++;
          } else {
            stats.present++;
            stats.dataTypes.add(typeof value);
            if (stats.sampleValues.length < 3 && typeof value !== 'object') {
              stats.sampleValues.push(value);
            }
          }
        }
      }
    }
  }
  
  console.log(`Found in ${hasTickets}/${hasRegistrationData} registrationData objects`);
  console.log(`Total tickets across all documents: ${totalTickets}`);
  console.log(`Average tickets per registration: ${(totalTickets/hasTickets).toFixed(1)}\n`);
  
  console.log('Fields in tickets:\n');
  for (const [field, stats] of ticketFieldStats) {
    const total = stats.present + stats.empty + stats.null;
    const valuePct = (stats.present / total * 100).toFixed(1);
    
    console.log(`  • ${field}: ${valuePct}% have values`);
    if (stats.sampleValues.length > 0) {
      console.log(`    Sample: ${stats.sampleValues[0]}`);
    }
  }
  
  // 2.3 - attendees array
  console.log('\n👥 registrationData.attendees[]');
  console.log('-'.repeat(40));
  
  let hasAttendees = 0;
  let totalAttendees = 0;
  const attendeeFieldStats = new Map<string, FieldStats>();
  
  for (const reg of allRegs) {
    if (!reg.registrationData?.attendees) continue;
    hasAttendees++;
    
    if (Array.isArray(reg.registrationData.attendees)) {
      totalAttendees += reg.registrationData.attendees.length;
      
      for (const attendee of reg.registrationData.attendees) {
        for (const [key, value] of Object.entries(attendee)) {
          if (!attendeeFieldStats.has(key)) {
            attendeeFieldStats.set(key, {
              present: 0,
              empty: 0,
              null: 0,
              dataTypes: new Set(),
              sampleValues: []
            });
          }
          
          const stats = attendeeFieldStats.get(key)!;
          
          if (value === null || value === undefined) {
            stats.null++;
          } else if (value === '') {
            stats.empty++;
          } else {
            stats.present++;
            stats.dataTypes.add(typeof value);
            if (stats.sampleValues.length < 3 && typeof value !== 'object') {
              stats.sampleValues.push(value);
            }
          }
        }
      }
    }
  }
  
  console.log(`Found in ${hasAttendees}/${hasRegistrationData} registrationData objects`);
  console.log(`Total attendees across all documents: ${totalAttendees}`);
  console.log(`Average attendees per registration: ${(totalAttendees/hasAttendees || 0).toFixed(1)}\n`);
  
  console.log('Fields in attendees:\n');
  for (const [field, stats] of attendeeFieldStats) {
    const total = stats.present + stats.empty + stats.null;
    const valuePct = (stats.present / total * 100).toFixed(1);
    
    console.log(`  • ${field}: ${valuePct}% have values`);
    if (stats.sampleValues.length > 0) {
      console.log(`    Sample: ${stats.sampleValues[0]}`);
    }
  }
  
  // 2.4 - metadata object
  console.log('\n📊 registrationData.metadata');
  console.log('-'.repeat(40));
  
  let hasMetadata = 0;
  const metadataFieldStats = new Map<string, any>();
  
  for (const reg of allRegs) {
    if (!reg.registrationData?.metadata) continue;
    hasMetadata++;
    
    // Analyze metadata and its nested objects
    const analyzeNested = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          analyzeNested(value, fullKey);
        } else {
          if (!metadataFieldStats.has(fullKey)) {
            metadataFieldStats.set(fullKey, { count: 0, samples: [] });
          }
          metadataFieldStats.get(fullKey).count++;
          if (metadataFieldStats.get(fullKey).samples.length < 2) {
            metadataFieldStats.get(fullKey).samples.push(value);
          }
        }
      }
    };
    
    analyzeNested(reg.registrationData.metadata);
  }
  
  console.log(`Found in ${hasMetadata}/${hasRegistrationData} registrationData objects\n`);
  
  if (hasMetadata > 0) {
    console.log('Fields in metadata (including nested):\n');
    for (const [field, data] of metadataFieldStats) {
      console.log(`  • ${field}: found ${data.count} times`);
      if (data.samples.length > 0 && data.samples[0] !== null) {
        console.log(`    Sample: ${JSON.stringify(data.samples[0])}`);
      }
    }
  }
  
  // 2.5 - lodgeDetails object
  console.log('\n🏛️ registrationData.lodgeDetails');
  console.log('-'.repeat(40));
  
  let hasLodgeDetails = 0;
  const lodgeFieldStats = new Map<string, FieldStats>();
  
  for (const reg of allRegs) {
    if (!reg.registrationData?.lodgeDetails) continue;
    hasLodgeDetails++;
    
    for (const [key, value] of Object.entries(reg.registrationData.lodgeDetails)) {
      if (!lodgeFieldStats.has(key)) {
        lodgeFieldStats.set(key, {
          present: 0,
          empty: 0,
          null: 0,
          dataTypes: new Set(),
          sampleValues: []
        });
      }
      
      const stats = lodgeFieldStats.get(key)!;
      
      if (value === null || value === undefined) {
        stats.null++;
      } else if (value === '') {
        stats.empty++;
      } else {
        stats.present++;
        stats.dataTypes.add(typeof value);
        if (stats.sampleValues.length < 3) {
          stats.sampleValues.push(value);
        }
      }
    }
  }
  
  console.log(`Found in ${hasLodgeDetails}/${hasRegistrationData} registrationData objects\n`);
  
  if (hasLodgeDetails > 0) {
    console.log('Fields in lodgeDetails:\n');
    for (const [field, stats] of lodgeFieldStats) {
      const total = stats.present + stats.empty + stats.null;
      const valuePct = (stats.present / total * 100).toFixed(1);
      
      console.log(`  • ${field}: ${valuePct}% have values`);
      if (stats.sampleValues.length > 0) {
        console.log(`    Sample: "${stats.sampleValues[0]}"`);
      }
    }
  }
  
  // ============================================================================
  // PART 3: STRUCTURE VARIATIONS
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('\n🔄 STRUCTURE VARIATIONS ANALYSIS\n');
  
  // Count different structures
  const structures = new Map<string, number>();
  
  for (const reg of allRegs) {
    if (!reg.registrationData) continue;
    
    const structure = {
      hasBookingContact: !!reg.registrationData.bookingContact,
      hasTickets: !!reg.registrationData.tickets,
      hasAttendees: !!reg.registrationData.attendees,
      hasMetadata: !!reg.registrationData.metadata,
      hasLodgeDetails: !!reg.registrationData.lodgeDetails,
      ticketCount: reg.registrationData.tickets?.length || 0,
      attendeeCount: reg.registrationData.attendees?.length || 0
    };
    
    const key = JSON.stringify(structure);
    structures.set(key, (structures.get(key) || 0) + 1);
  }
  
  console.log(`Found ${structures.size} different structural variations:\n`);
  
  let variantNum = 1;
  for (const [structure, count] of structures) {
    const parsed = JSON.parse(structure);
    console.log(`Variant ${variantNum}: ${count} documents (${(count/hasRegistrationData*100).toFixed(1)}%)`);
    console.log(`  - bookingContact: ${parsed.hasBookingContact ? '✅' : '❌'}`);
    console.log(`  - tickets: ${parsed.hasTickets ? `✅ (${parsed.ticketCount} items)` : '❌'}`);
    console.log(`  - attendees: ${parsed.hasAttendees ? `✅ (${parsed.attendeeCount} items)` : '❌'}`);
    console.log(`  - metadata: ${parsed.hasMetadata ? '✅' : '❌'}`);
    console.log(`  - lodgeDetails: ${parsed.hasLodgeDetails ? '✅' : '❌'}`);
    console.log();
    variantNum++;
  }
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  console.log('='.repeat(80));
  console.log('\n🎯 KEY FINDINGS SUMMARY\n');
  
  console.log('1. OVERALL STRUCTURE:');
  console.log(`   - ${hasRegistrationData}/${allRegs.length} have registrationData (${(hasRegistrationData/allRegs.length*100).toFixed(1)}%)`);
  console.log(`   - ${structures.size} different structural variations found\n`);
  
  console.log('2. NESTED OBJECT PRESENCE:');
  console.log(`   - bookingContact: ${hasBookingContact}/${hasRegistrationData} (${(hasBookingContact/hasRegistrationData*100).toFixed(1)}%)`);
  console.log(`   - tickets[]: ${hasTickets}/${hasRegistrationData} (${(hasTickets/hasRegistrationData*100).toFixed(1)}%)`);
  console.log(`   - attendees[]: ${hasAttendees}/${hasRegistrationData} (${(hasAttendees/hasRegistrationData*100).toFixed(1)}%)`);
  console.log(`   - metadata: ${hasMetadata}/${hasRegistrationData} (${(hasMetadata/hasRegistrationData*100).toFixed(1)}%)`);
  console.log(`   - lodgeDetails: ${hasLodgeDetails}/${hasRegistrationData} (${(hasLodgeDetails/hasRegistrationData*100).toFixed(1)}%)\n`);
  
  console.log('3. CRITICAL ISSUES:');
  
  const criticalIssues = [];
  
  if (hasBookingContact < hasRegistrationData * 0.9) {
    criticalIssues.push(`   ⚠️ bookingContact missing in ${hasRegistrationData - hasBookingContact} documents`);
  }
  
  if (structures.size > 5) {
    criticalIssues.push(`   ⚠️ Too many structural variations (${structures.size} different patterns)`);
  }
  
  if (hasMetadata < hasRegistrationData * 0.5 && hasMetadata > 0) {
    criticalIssues.push(`   ⚠️ metadata inconsistently used (only ${(hasMetadata/hasRegistrationData*100).toFixed(1)}%)`);
  }
  
  if (criticalIssues.length > 0) {
    criticalIssues.forEach(issue => console.log(issue));
  } else {
    console.log('   ✅ No critical structural issues found');
  }
  
  await client.close();
}

analyzeRegistrationDataStructure().catch(console.error);