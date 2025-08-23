import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// Your proposed unified schema
interface ProposedAttendee {
  attendeeId: string;
  firstName: string;
  lastName: string;
  type: 'mason' | 'partner' | 'guest';
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  masonData?: {
    lodgeNumber?: string;
    rank?: string;
    yearInitiated?: number;
    membershipStatus?: string;
  };
  partnerData?: {
    relationship?: string;
    linkedMasonId?: string;
  };
  guestData?: {
    invitedBy?: string;
    relationship?: string;
  };
}

async function evaluateProposedSchema() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔍 EVALUATING PROPOSED UNIFIED ATTENDEE SCHEMA');
  console.log('='.repeat(80));
  console.log('\n📋 PROPOSED STRUCTURE:');
  console.log('  - Common fields: attendeeId, firstName, lastName, type');
  console.log('  - Optional: contactInfo object');
  console.log('  - Type-specific: masonData, partnerData, guestData\n');
  console.log('='.repeat(80));
  
  const registrations = db.collection('registrations');
  const allRegs = await registrations.find({ 'registrationData.attendees': { $exists: true } }).toArray();
  
  console.log(`\n📊 Analyzing ${allRegs.length} registrations with attendees\n`);
  
  // ============================================================================
  // ANALYZE HOW CURRENT DATA MAPS TO PROPOSED SCHEMA
  // ============================================================================
  
  let totalAttendees = 0;
  let successfulMappings = 0;
  let partialMappings = 0;
  let failedMappings = 0;
  
  const mappingIssues: string[] = [];
  const fieldCoverage = new Map<string, number>();
  const typeDistribution = new Map<string, number>();
  
  // Track what fields from current data would map where
  const currentToProposedMapping = new Map<string, string>();
  const unmappedFields = new Set<string>();
  
  for (const reg of allRegs) {
    if (!reg.registrationData?.attendees || !Array.isArray(reg.registrationData.attendees)) continue;
    
    for (const attendee of reg.registrationData.attendees) {
      totalAttendees++;
      
      // Try to map current attendee to proposed schema
      const mapped: Partial<ProposedAttendee> = {};
      let mappingQuality = 'success';
      
      // Map attendeeId
      if (attendee.id || attendee.attendeeId || attendee._id) {
        mapped.attendeeId = attendee.id || attendee.attendeeId || attendee._id;
        fieldCoverage.set('attendeeId', (fieldCoverage.get('attendeeId') || 0) + 1);
      } else {
        mappingQuality = 'partial';
        mappingIssues.push('Missing attendeeId');
      }
      
      // Map names
      if (attendee.firstName || attendee.first_name || attendee.fname) {
        mapped.firstName = attendee.firstName || attendee.first_name || attendee.fname;
        fieldCoverage.set('firstName', (fieldCoverage.get('firstName') || 0) + 1);
      } else {
        mappingQuality = 'partial';
      }
      
      if (attendee.lastName || attendee.last_name || attendee.lname || attendee.surname) {
        mapped.lastName = attendee.lastName || attendee.last_name || attendee.lname || attendee.surname;
        fieldCoverage.set('lastName', (fieldCoverage.get('lastName') || 0) + 1);
      } else {
        mappingQuality = 'partial';
      }
      
      // Determine type
      let attendeeType: 'mason' | 'partner' | 'guest' = 'guest'; // default
      
      if (attendee.attendeeType === 'primary' || attendee.isPrimary || 
          attendee.lodgeNumber || attendee.rank || attendee.membershipStatus) {
        attendeeType = 'mason';
      } else if (attendee.attendeeType === 'partner' || attendee.isPartner || 
                 attendee.relationship === 'partner' || attendee.relationship === 'spouse') {
        attendeeType = 'partner';
      } else if (attendee.attendeeType === 'guest' || attendee.relationship === 'guest') {
        attendeeType = 'guest';
      }
      
      mapped.type = attendeeType;
      typeDistribution.set(attendeeType, (typeDistribution.get(attendeeType) || 0) + 1);
      fieldCoverage.set('type', (fieldCoverage.get('type') || 0) + 1);
      
      // Map contact info
      if (attendee.email || attendee.phone || attendee.address || 
          attendee.mobile || attendee.emailAddress) {
        mapped.contactInfo = {
          email: attendee.email || attendee.emailAddress,
          phone: attendee.phone || attendee.mobile || attendee.mobileNumber,
          address: attendee.address || attendee.streetAddress
        };
        fieldCoverage.set('contactInfo', (fieldCoverage.get('contactInfo') || 0) + 1);
      }
      
      // Map type-specific data
      if (attendeeType === 'mason') {
        mapped.masonData = {
          lodgeNumber: attendee.lodgeNumber || attendee.lodge_number,
          rank: attendee.rank || attendee.masonic_rank,
          yearInitiated: attendee.yearInitiated || attendee.year_initiated,
          membershipStatus: attendee.membershipStatus || attendee.membership_status
        };
        fieldCoverage.set('masonData', (fieldCoverage.get('masonData') || 0) + 1);
      } else if (attendeeType === 'partner') {
        mapped.partnerData = {
          relationship: attendee.relationship,
          linkedMasonId: attendee.linkedMasonId || attendee.primaryAttendeeId
        };
        fieldCoverage.set('partnerData', (fieldCoverage.get('partnerData') || 0) + 1);
      } else if (attendeeType === 'guest') {
        mapped.guestData = {
          invitedBy: attendee.invitedBy || attendee.invited_by,
          relationship: attendee.relationship
        };
        fieldCoverage.set('guestData', (fieldCoverage.get('guestData') || 0) + 1);
      }
      
      // Check for unmapped fields
      const proposedFields = new Set([
        'attendeeId', 'firstName', 'lastName', 'type',
        'email', 'phone', 'address', 'emailAddress', 'mobile', 'mobileNumber',
        'lodgeNumber', 'lodge_number', 'rank', 'masonic_rank',
        'yearInitiated', 'year_initiated', 'membershipStatus', 'membership_status',
        'relationship', 'linkedMasonId', 'primaryAttendeeId',
        'invitedBy', 'invited_by', 'attendeeType', 'isPrimary', 'isPartner',
        'id', '_id', 'first_name', 'fname', 'last_name', 'lname', 'surname',
        'streetAddress'
      ]);
      
      Object.keys(attendee).forEach(field => {
        if (!proposedFields.has(field) && !field.startsWith('_')) {
          unmappedFields.add(field);
        }
      });
      
      // Count mapping quality
      if (mappingQuality === 'success' && mapped.attendeeId && mapped.firstName && mapped.lastName) {
        successfulMappings++;
      } else if (mapped.firstName || mapped.lastName) {
        partialMappings++;
      } else {
        failedMappings++;
      }
    }
  }
  
  // ============================================================================
  // REPORT MAPPING SUCCESS
  // ============================================================================
  
  console.log('📊 MAPPING RESULTS');
  console.log('-'.repeat(40));
  
  const successRate = (successfulMappings / totalAttendees * 100).toFixed(1);
  const partialRate = (partialMappings / totalAttendees * 100).toFixed(1);
  const failureRate = (failedMappings / totalAttendees * 100).toFixed(1);
  
  console.log(`\nTotal attendees analyzed: ${totalAttendees}`);
  console.log(`✅ Successful mappings: ${successfulMappings} (${successRate}%)`);
  console.log(`⚠️  Partial mappings: ${partialMappings} (${partialRate}%)`);
  console.log(`❌ Failed mappings: ${failedMappings} (${failureRate}%)\n`);
  
  // ============================================================================
  // FIELD COVERAGE ANALYSIS
  // ============================================================================
  
  console.log('📋 FIELD COVERAGE IN PROPOSED SCHEMA');
  console.log('-'.repeat(40));
  
  for (const [field, count] of fieldCoverage) {
    const percentage = (count / totalAttendees * 100).toFixed(1);
    console.log(`${field}: ${count}/${totalAttendees} (${percentage}%)`);
  }
  
  // ============================================================================
  // TYPE DISTRIBUTION
  // ============================================================================
  
  console.log('\n👥 ATTENDEE TYPE DISTRIBUTION');
  console.log('-'.repeat(40));
  
  for (const [type, count] of typeDistribution) {
    const percentage = (count / totalAttendees * 100).toFixed(1);
    console.log(`${type}: ${count} (${percentage}%)`);
  }
  
  // ============================================================================
  // UNMAPPED FIELDS
  // ============================================================================
  
  if (unmappedFields.size > 0) {
    console.log('\n⚠️ FIELDS NOT COVERED BY PROPOSED SCHEMA');
    console.log('-'.repeat(40));
    
    const sortedUnmapped = Array.from(unmappedFields).sort();
    console.log('\nFields that would be lost:');
    sortedUnmapped.forEach(field => {
      console.log(`  • ${field}`);
    });
  }
  
  // ============================================================================
  // BENEFITS ANALYSIS
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ BENEFITS OF PROPOSED SCHEMA\n');
  
  console.log('1. CONSISTENCY:');
  console.log('   - Single structure for all attendees (vs current 28 variations)');
  console.log('   - Predictable field locations');
  console.log('   - Type-safe discriminated unions\n');
  
  console.log('2. QUERYABILITY:');
  console.log('   - Can query all attendees by type easily');
  console.log('   - Contact info in consistent location');
  console.log('   - Mason-specific data isolated\n');
  
  console.log('3. MAINTAINABILITY:');
  console.log('   - Clear separation of concerns');
  console.log('   - Easier to add new attendee types');
  console.log('   - Simpler validation logic\n');
  
  console.log('4. RELATIONSHIPS:');
  console.log('   - Partners can link to masons via linkedMasonId');
  console.log('   - Guests can track who invited them');
  console.log('   - Clear relationship mapping\n');
  
  // ============================================================================
  // MIGRATION COMPLEXITY
  // ============================================================================
  
  console.log('='.repeat(80));
  console.log('\n🔧 MIGRATION COMPLEXITY ASSESSMENT\n');
  
  const complexityScore = unmappedFields.size > 10 ? 'HIGH' : 
                          unmappedFields.size > 5 ? 'MEDIUM' : 'LOW';
  
  console.log(`Complexity: ${complexityScore}`);
  console.log(`  - Unmapped fields: ${unmappedFields.size}`);
  console.log(`  - Success rate: ${successRate}%`);
  console.log(`  - Data loss risk: ${unmappedFields.size > 0 ? 'YES' : 'NO'}\n`);
  
  // ============================================================================
  // RECOMMENDATIONS
  // ============================================================================
  
  console.log('='.repeat(80));
  console.log('\n💡 RECOMMENDATIONS\n');
  
  console.log('1. IMPLEMENTATION APPROACH:');
  console.log('   ✅ The proposed schema would solve the 28-variation problem');
  console.log('   ✅ It provides clear type discrimination');
  console.log('   ✅ Success rate is reasonable at ' + successRate + '%\n');
  
  console.log('2. SUGGESTED ADDITIONS:');
  
  if (unmappedFields.has('ticketId') || unmappedFields.has('ticket_id')) {
    console.log('   • Add ticketId to link attendee to their ticket');
  }
  
  if (unmappedFields.has('seatNumber') || unmappedFields.has('seat_number')) {
    console.log('   • Add seatNumber for event seating');
  }
  
  if (unmappedFields.has('dietaryRequirements') || unmappedFields.has('dietary_requirements')) {
    console.log('   • Add dietaryRequirements to contactInfo or separate object');
  }
  
  if (unmappedFields.has('registeredAt') || unmappedFields.has('created_at')) {
    console.log('   • Add timestamps (registeredAt, updatedAt)');
  }
  
  console.log('\n3. MIGRATION STRATEGY:');
  console.log('   Step 1: Create migration script with field mapping');
  console.log('   Step 2: Run in test environment first');
  console.log('   Step 3: Validate all attendees map correctly');
  console.log('   Step 4: Store unmapped fields in metadata object');
  console.log('   Step 5: Deploy with rollback capability\n');
  
  console.log('4. VALIDATION RULES:');
  console.log('   • attendeeId: Required, unique within registration');
  console.log('   • firstName + lastName: Required');
  console.log('   • type: Required, enum validation');
  console.log('   • masonData: Required when type="mason"');
  console.log('   • partnerData: Required when type="partner"');
  console.log('   • guestData: Optional for type="guest"\n');
  
  // ============================================================================
  // FINAL VERDICT
  // ============================================================================
  
  console.log('='.repeat(80));
  console.log('\n🎯 FINAL VERDICT\n');
  
  if (parseFloat(successRate) > 80) {
    console.log('✅ STRONGLY RECOMMENDED');
    console.log('\nThe proposed schema would:');
    console.log('• Reduce 28 structural variations to 1');
    console.log('• Maintain ' + successRate + '% data compatibility');
    console.log('• Provide clear type-based querying');
    console.log('• Enable better relationship tracking');
    console.log('• Simplify future development\n');
    
    console.log('Minor adjustments needed:');
    if (unmappedFields.size > 0) {
      console.log(`• Handle ${unmappedFields.size} unmapped fields (store in metadata)`);
    }
    console.log('• Add unique constraint on attendeeId');
    console.log('• Consider adding ticketId for ticket linkage');
  } else {
    console.log('⚠️ RECOMMENDED WITH MODIFICATIONS');
    console.log(`\nCurrent success rate (${successRate}%) indicates data quality issues.`);
    console.log('Fix data quality first, then implement schema.');
  }
  
  await client.close();
}

evaluateProposedSchema().catch(console.error);