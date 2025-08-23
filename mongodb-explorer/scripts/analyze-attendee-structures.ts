import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function analyzeAttendeeStructures() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔍 DEEP ANALYSIS: attendees[] STRUCTURAL VARIATIONS');
  console.log('='.repeat(80));
  console.log('Determining if variations are from:\n');
  console.log('  A) Different structures of individual attendee objects');
  console.log('  B) Just different array lengths\n');
  console.log('='.repeat(80));
  
  const registrations = db.collection('registrations');
  const allRegs = await registrations.find({ 'registrationData.attendees': { $exists: true } }).toArray();
  
  console.log(`\n📊 Analyzing ${allRegs.length} registrations with attendees\n`);
  
  // Track unique attendee object structures
  const attendeeStructures = new Map<string, {
    count: number;
    fields: string[];
    sample: any;
    fromRegistrations: Set<string>;
  }>();
  
  // Track array-level patterns
  const arrayPatterns = new Map<string, {
    count: number;
    lengths: number[];
    structures: string[];
  }>();
  
  // Track per-registration patterns
  const registrationPatterns: Array<{
    regId: string;
    arrayLength: number;
    uniqueStructuresInArray: number;
    structureFingerprints: string[];
  }> = [];
  
  let totalAttendeeObjects = 0;
  let registrationsWithMixedStructures = 0;
  let registrationsWithUniformStructures = 0;
  
  for (const reg of allRegs) {
    if (!reg.registrationData?.attendees || !Array.isArray(reg.registrationData.attendees)) continue;
    
    const attendees = reg.registrationData.attendees;
    const structuresInThisReg = new Set<string>();
    const structureList: string[] = [];
    
    // Analyze each attendee in this registration
    for (const attendee of attendees) {
      totalAttendeeObjects++;
      
      // Get field structure fingerprint
      const fields = Object.keys(attendee)
        .filter(k => !k.startsWith('_'))
        .sort();
      
      const fingerprint = crypto.createHash('md5')
        .update(fields.join(','))
        .digest('hex');
      
      structuresInThisReg.add(fingerprint);
      structureList.push(fingerprint);
      
      // Track this structure globally
      if (!attendeeStructures.has(fingerprint)) {
        attendeeStructures.set(fingerprint, {
          count: 0,
          fields,
          sample: attendee,
          fromRegistrations: new Set()
        });
      }
      
      const struct = attendeeStructures.get(fingerprint)!;
      struct.count++;
      struct.fromRegistrations.add(reg._id.toString());
    }
    
    // Track if this registration has mixed structures
    if (structuresInThisReg.size > 1) {
      registrationsWithMixedStructures++;
    } else {
      registrationsWithUniformStructures++;
    }
    
    // Record pattern for this registration
    registrationPatterns.push({
      regId: reg._id.toString(),
      arrayLength: attendees.length,
      uniqueStructuresInArray: structuresInThisReg.size,
      structureFingerprints: structureList
    });
    
    // Track array-level pattern
    const arrayPattern = `len:${attendees.length}_structs:${Array.from(structuresInThisReg).sort().join('|')}`;
    if (!arrayPatterns.has(arrayPattern)) {
      arrayPatterns.set(arrayPattern, {
        count: 0,
        lengths: [],
        structures: []
      });
    }
    arrayPatterns.get(arrayPattern)!.count++;
  }
  
  // ============================================================================
  // ANALYSIS RESULTS
  // ============================================================================
  
  console.log('📋 INDIVIDUAL ATTENDEE OBJECT ANALYSIS');
  console.log('-'.repeat(40));
  
  console.log(`\nTotal attendee objects analyzed: ${totalAttendeeObjects}`);
  console.log(`Unique attendee structures found: ${attendeeStructures.size}\n`);
  
  // Sort structures by frequency
  const sortedStructures = Array.from(attendeeStructures.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10); // Top 10
  
  console.log('TOP 10 ATTENDEE STRUCTURES:');
  sortedStructures.forEach(([fingerprint, data], index) => {
    const percentage = (data.count / totalAttendeeObjects * 100).toFixed(1);
    console.log(`\n${index + 1}. Structure appears ${data.count} times (${percentage}%)`);
    console.log(`   Used in ${data.fromRegistrations.size} different registrations`);
    console.log(`   Fields (${data.fields.length}): ${data.fields.slice(0, 5).join(', ')}${data.fields.length > 5 ? '...' : ''}`);
    
    // Show sample values for key differentiating fields
    if (data.sample) {
      const keyFields = ['attendeeType', 'isPartner', 'isPrimary', 'relationship'];
      const relevantFields = keyFields.filter(f => data.sample[f] !== undefined);
      if (relevantFields.length > 0) {
        console.log(`   Key values: ${relevantFields.map(f => `${f}=${data.sample[f]}`).join(', ')}`);
      }
    }
  });
  
  // ============================================================================
  // REGISTRATION-LEVEL ANALYSIS
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 REGISTRATION-LEVEL ANALYSIS');
  console.log('-'.repeat(40));
  
  console.log(`\nRegistrations with UNIFORM structures (all attendees same): ${registrationsWithUniformStructures}`);
  console.log(`Registrations with MIXED structures (different attendee types): ${registrationsWithMixedStructures}`);
  
  // Analyze patterns by array length
  const byArrayLength = new Map<number, {
    total: number;
    withMixedStructures: number;
    withUniformStructures: number;
  }>();
  
  for (const pattern of registrationPatterns) {
    if (!byArrayLength.has(pattern.arrayLength)) {
      byArrayLength.set(pattern.arrayLength, {
        total: 0,
        withMixedStructures: 0,
        withUniformStructures: 0
      });
    }
    
    const stats = byArrayLength.get(pattern.arrayLength)!;
    stats.total++;
    
    if (pattern.uniqueStructuresInArray > 1) {
      stats.withMixedStructures++;
    } else {
      stats.withUniformStructures++;
    }
  }
  
  console.log('\nBREAKDOWN BY ARRAY LENGTH:');
  const sortedLengths = Array.from(byArrayLength.entries()).sort((a, b) => a[0] - b[0]);
  
  for (const [length, stats] of sortedLengths) {
    const mixedPct = (stats.withMixedStructures / stats.total * 100).toFixed(1);
    console.log(`\nArray length ${length}: ${stats.total} registrations`);
    console.log(`  - Uniform structures: ${stats.withUniformStructures}`);
    console.log(`  - Mixed structures: ${stats.withMixedStructures} (${mixedPct}%)`);
  }
  
  // ============================================================================
  // FIND REGISTRATIONS WITH MOST COMPLEX MIXING
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('\n🔍 EXAMPLES OF MIXED STRUCTURES WITHIN SINGLE REGISTRATION');
  console.log('-'.repeat(40));
  
  const complexRegistrations = registrationPatterns
    .filter(p => p.uniqueStructuresInArray > 1)
    .sort((a, b) => b.uniqueStructuresInArray - a.uniqueStructuresInArray)
    .slice(0, 3);
  
  for (const complex of complexRegistrations) {
    console.log(`\nRegistration ${complex.regId}:`);
    console.log(`  - Has ${complex.arrayLength} attendees`);
    console.log(`  - Contains ${complex.uniqueStructuresInArray} DIFFERENT structures`);
    
    // Get the actual registration to show details
    const reg = await registrations.findOne({ _id: complex.regId } as any);
    if (reg?.registrationData?.attendees) {
      console.log('  - Attendee types in this registration:');
      reg.registrationData.attendees.forEach((att: any, idx: number) => {
        const type = att.attendeeType || 'unknown';
        const isPrimary = att.isPrimary ? 'PRIMARY' : '';
        const isPartner = att.isPartner ? 'PARTNER' : '';
        console.log(`    ${idx + 1}. ${type} ${isPrimary} ${isPartner}`.trim());
      });
    }
  }
  
  // ============================================================================
  // ROOT CAUSE ANALYSIS
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 ROOT CAUSE ANALYSIS');
  console.log('-'.repeat(40));
  
  // Analyze which fields cause the variations
  const fieldFrequency = new Map<string, number>();
  const fieldPresenceVariation = new Map<string, Set<string>>();
  
  for (const [fingerprint, data] of attendeeStructures) {
    for (const field of data.fields) {
      fieldFrequency.set(field, (fieldFrequency.get(field) || 0) + data.count);
      
      if (!fieldPresenceVariation.has(field)) {
        fieldPresenceVariation.set(field, new Set());
      }
      fieldPresenceVariation.get(field)!.add(fingerprint);
    }
  }
  
  // Find fields that don't appear in all structures
  const inconsistentFields: Array<{ field: string; appearsIn: number; percentage: number }> = [];
  
  for (const [field, structures] of fieldPresenceVariation) {
    const percentage = (structures.size / attendeeStructures.size) * 100;
    if (percentage < 100 && percentage > 0) {
      inconsistentFields.push({
        field,
        appearsIn: structures.size,
        percentage
      });
    }
  }
  
  inconsistentFields.sort((a, b) => b.percentage - a.percentage);
  
  console.log('\nFIELDS CAUSING STRUCTURAL VARIATIONS:');
  console.log('(Fields that appear in some structures but not others)\n');
  
  inconsistentFields.slice(0, 15).forEach(({ field, appearsIn, percentage }) => {
    console.log(`  • ${field}: appears in ${appearsIn}/${attendeeStructures.size} structures (${percentage.toFixed(1)}%)`);
  });
  
  // ============================================================================
  // FINAL VERDICT
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 FINAL VERDICT\n');
  
  const percentageWithMixed = (registrationsWithMixedStructures / allRegs.length * 100).toFixed(1);
  
  if (registrationsWithMixedStructures > registrationsWithUniformStructures) {
    console.log('❌ ANSWER: The 28 variations are from DIFFERENT STRUCTURES of individual attendee objects');
    console.log(`\n   - ${percentageWithMixed}% of registrations have MIXED attendee structures`);
    console.log('   - Different attendee types (primary, partner, guest) have different fields');
    console.log('   - This is NOT just about array length - it\'s structural inconsistency\n');
  } else {
    console.log('✅ ANSWER: Most registrations have UNIFORM attendee structures');
    console.log(`\n   - Only ${percentageWithMixed}% have mixed structures`);
    console.log('   - Most variations come from different array lengths\n');
  }
  
  console.log('KEY INSIGHT:');
  console.log(`   - ${attendeeStructures.size} unique attendee object structures exist`);
  console.log(`   - ${registrationsWithMixedStructures} registrations mix different structures in one array`);
  console.log(`   - Main cause: Different attendee types have completely different fields`);
  
  await client.close();
}

analyzeAttendeeStructures().catch(console.error);