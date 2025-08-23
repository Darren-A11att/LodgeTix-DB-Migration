import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

class MigrationTester {
  private db: any;
  private results: TestResult[] = [];
  
  constructor(db: any) {
    this.db = db;
  }
  
  async runAllTests(): Promise<void> {
    console.log('🧪 RUNNING MIGRATION VALIDATION TESTS');
    console.log('='.repeat(80));
    
    // Test 1: Document count preservation
    await this.testDocumentCounts();
    
    // Test 2: Required fields presence
    await this.testRequiredFields();
    
    // Test 3: Field value preservation
    await this.testFieldValuePreservation();
    
    // Test 4: Type consistency
    await this.testTypeConsistency();
    
    // Test 5: Nested object structure
    await this.testNestedObjectStructure();
    
    // Test 6: Data integrity
    await this.testDataIntegrity();
    
    // Test 7: Cross-reference validation
    await this.testCrossReferences();
    
    // Print results
    this.printResults();
  }
  
  async testDocumentCounts(): Promise<void> {
    console.log('\n📊 Test 1: Document Count Preservation');
    console.log('-'.repeat(40));
    
    const collections = ['attendees', 'registrations'];
    
    for (const collName of collections) {
      try {
        const oldColl = this.db.collection(collName);
        const newColl = this.db.collection(`new_${collName}`);
        
        const oldCount = await oldColl.countDocuments();
        const newCount = await newColl.countDocuments();
        
        const passed = oldCount === newCount;
        
        this.results.push({
          testName: `Document count for ${collName}`,
          passed,
          message: passed ? 
            `✅ Count preserved: ${oldCount} documents` : 
            `❌ Count mismatch: ${oldCount} → ${newCount}`,
          details: { oldCount, newCount }
        });
        
        console.log(`   ${collName}: ${oldCount} → ${newCount} ${passed ? '✅' : '❌'}`);
        
      } catch (err: any) {
        this.results.push({
          testName: `Document count for ${collName}`,
          passed: false,
          message: `Error: ${err.message}`
        });
      }
    }
  }
  
  async testRequiredFields(): Promise<void> {
    console.log('\n📋 Test 2: Required Fields Presence');
    console.log('-'.repeat(40));
    
    // Test attendees required fields
    const newAttendees = this.db.collection('new_attendees');
    const attendeeSample = await newAttendees.find({}).limit(100).toArray();
    
    const requiredAttendeeFields = ['attendeeId', 'firstName', 'lastName', 'type'];
    let missingFields = 0;
    
    for (const doc of attendeeSample) {
      for (const field of requiredAttendeeFields) {
        if (!doc[field]) {
          missingFields++;
          console.log(`   ⚠️ Missing ${field} in attendee ${doc._id}`);
        }
      }
    }
    
    this.results.push({
      testName: 'Required fields in attendees',
      passed: missingFields === 0,
      message: missingFields === 0 ? 
        '✅ All required fields present' : 
        `❌ ${missingFields} missing required fields`,
      details: { missingFields, sampleSize: attendeeSample.length }
    });
    
    console.log(`   Attendees: ${missingFields === 0 ? '✅ All required fields present' : `❌ ${missingFields} missing`}`);
  }
  
  async testFieldValuePreservation(): Promise<void> {
    console.log('\n🔍 Test 3: Field Value Preservation');
    console.log('-'.repeat(40));
    
    // Sample 10 random documents and verify key fields preserved
    const oldAttendees = this.db.collection('attendees');
    const newAttendees = this.db.collection('new_attendees');
    
    const samples = await oldAttendees.find({}).limit(10).toArray();
    let preservedCount = 0;
    let totalChecks = 0;
    
    for (const oldDoc of samples) {
      const newDoc = await newAttendees.findOne({ _originalId: oldDoc._id });
      
      if (!newDoc) {
        console.log(`   ❌ Could not find migrated doc for ${oldDoc._id}`);
        continue;
      }
      
      // Check name preservation
      const nameChecks = [
        { old: oldDoc.firstName || oldDoc.first_name, new: newDoc.firstName, field: 'firstName' },
        { old: oldDoc.lastName || oldDoc.last_name, new: newDoc.lastName, field: 'lastName' }
      ];
      
      for (const check of nameChecks) {
        totalChecks++;
        if (check.old && check.old === check.new) {
          preservedCount++;
        } else if (check.old) {
          console.log(`   ⚠️ Value changed for ${check.field}: "${check.old}" → "${check.new}"`);
        }
      }
      
      // Check email preservation (if exists)
      if (oldDoc.email || oldDoc.emailAddress) {
        totalChecks++;
        const oldEmail = oldDoc.email || oldDoc.emailAddress;
        const newEmail = newDoc.contactInfo?.email;
        
        if (oldEmail === newEmail) {
          preservedCount++;
        } else {
          console.log(`   ⚠️ Email changed: "${oldEmail}" → "${newEmail}"`);
        }
      }
    }
    
    const preservationRate = totalChecks > 0 ? 
      (preservedCount / totalChecks * 100).toFixed(1) : '0';
    
    this.results.push({
      testName: 'Field value preservation',
      passed: preservedCount === totalChecks,
      message: `${preservationRate}% of values preserved (${preservedCount}/${totalChecks})`,
      details: { preservedCount, totalChecks }
    });
    
    console.log(`   Value preservation: ${preservationRate}% ${preservedCount === totalChecks ? '✅' : '⚠️'}`);
  }
  
  async testTypeConsistency(): Promise<void> {
    console.log('\n🎯 Test 4: Type Consistency');
    console.log('-'.repeat(40));
    
    const newAttendees = this.db.collection('new_attendees');
    
    // Check type distribution
    const typeCounts = await newAttendees.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]).toArray();
    
    const validTypes = ['mason', 'partner', 'guest'];
    let invalidTypes = 0;
    
    for (const typeDoc of typeCounts) {
      if (!validTypes.includes(typeDoc._id)) {
        invalidTypes++;
        console.log(`   ❌ Invalid type found: ${typeDoc._id}`);
      } else {
        console.log(`   ${typeDoc._id}: ${typeDoc.count} attendees`);
      }
    }
    
    // Check type-specific data consistency
    const masons = await newAttendees.find({ type: 'mason' }).limit(10).toArray();
    let masonDataIssues = 0;
    
    for (const mason of masons) {
      if (!mason.masonData) {
        masonDataIssues++;
        console.log(`   ⚠️ Mason ${mason._id} missing masonData`);
      }
    }
    
    this.results.push({
      testName: 'Type consistency',
      passed: invalidTypes === 0 && masonDataIssues === 0,
      message: invalidTypes === 0 ? 
        '✅ All types valid' : 
        `❌ ${invalidTypes} invalid types, ${masonDataIssues} data issues`,
      details: { typeCounts, invalidTypes, masonDataIssues }
    });
  }
  
  async testNestedObjectStructure(): Promise<void> {
    console.log('\n📦 Test 5: Nested Object Structure');
    console.log('-'.repeat(40));
    
    const newAttendees = this.db.collection('new_attendees');
    
    // Check structure of nested objects
    const samples = await newAttendees.find({}).limit(50).toArray();
    let structureIssues = 0;
    
    for (const doc of samples) {
      // Check contactInfo structure
      if (doc.contactInfo && typeof doc.contactInfo !== 'object') {
        structureIssues++;
        console.log(`   ❌ contactInfo not an object in ${doc._id}`);
      }
      
      // Check type-specific data
      if (doc.type === 'mason' && doc.masonData) {
        if (typeof doc.masonData !== 'object') {
          structureIssues++;
          console.log(`   ❌ masonData not an object in ${doc._id}`);
        }
      }
      
      if (doc.type === 'partner' && doc.partnerData) {
        if (typeof doc.partnerData !== 'object') {
          structureIssues++;
          console.log(`   ❌ partnerData not an object in ${doc._id}`);
        }
      }
    }
    
    this.results.push({
      testName: 'Nested object structure',
      passed: structureIssues === 0,
      message: structureIssues === 0 ? 
        '✅ All nested objects properly structured' : 
        `❌ ${structureIssues} structure issues found`,
      details: { structureIssues, sampleSize: samples.length }
    });
    
    console.log(`   Structure validation: ${structureIssues === 0 ? '✅ Valid' : `❌ ${structureIssues} issues`}`);
  }
  
  async testDataIntegrity(): Promise<void> {
    console.log('\n🔒 Test 6: Data Integrity');
    console.log('-'.repeat(40));
    
    const newAttendees = this.db.collection('new_attendees');
    
    // Check for data integrity issues
    const integrityChecks = [
      {
        name: 'Email format',
        pipeline: [
          { $match: { 'contactInfo.email': { $exists: true } } },
          { $match: { 
            'contactInfo.email': { 
              $not: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
            } 
          }},
          { $count: 'invalid' }
        ]
      },
      {
        name: 'Duplicate attendeeIds',
        pipeline: [
          { $group: { _id: '$attendeeId', count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
          { $count: 'duplicates' }
        ]
      },
      {
        name: 'Year initiated range',
        pipeline: [
          { $match: { 'masonData.yearInitiated': { $exists: true } } },
          { $match: { 
            $or: [
              { 'masonData.yearInitiated': { $lt: 1900 } },
              { 'masonData.yearInitiated': { $gt: new Date().getFullYear() } }
            ]
          }},
          { $count: 'invalid' }
        ]
      }
    ];
    
    let totalIssues = 0;
    
    for (const check of integrityChecks) {
      const result = await newAttendees.aggregate(check.pipeline).toArray();
      const issueCount = result[0]?.invalid || result[0]?.duplicates || 0;
      
      if (issueCount > 0) {
        totalIssues += issueCount;
        console.log(`   ⚠️ ${check.name}: ${issueCount} issues`);
      } else {
        console.log(`   ✅ ${check.name}: No issues`);
      }
    }
    
    this.results.push({
      testName: 'Data integrity',
      passed: totalIssues === 0,
      message: totalIssues === 0 ? 
        '✅ All integrity checks passed' : 
        `⚠️ ${totalIssues} integrity issues found`,
      details: { totalIssues }
    });
  }
  
  async testCrossReferences(): Promise<void> {
    console.log('\n🔗 Test 7: Cross-Reference Validation');
    console.log('-'.repeat(40));
    
    const newAttendees = this.db.collection('new_attendees');
    
    // Check partner links
    const partners = await newAttendees.find({ 
      type: 'partner',
      'partnerData.linkedMasonId': { $exists: true }
    }).limit(10).toArray();
    
    let validLinks = 0;
    let invalidLinks = 0;
    
    for (const partner of partners) {
      const linkedId = partner.partnerData?.linkedMasonId;
      if (linkedId) {
        const linkedMason = await newAttendees.findOne({ 
          attendeeId: linkedId,
          type: 'mason'
        });
        
        if (linkedMason) {
          validLinks++;
        } else {
          invalidLinks++;
          console.log(`   ⚠️ Partner ${partner.attendeeId} links to non-existent mason ${linkedId}`);
        }
      }
    }
    
    this.results.push({
      testName: 'Cross-reference validation',
      passed: invalidLinks === 0,
      message: `${validLinks} valid links, ${invalidLinks} invalid links`,
      details: { validLinks, invalidLinks }
    });
    
    console.log(`   Partner links: ${validLinks} valid, ${invalidLinks} invalid ${invalidLinks === 0 ? '✅' : '⚠️'}`);
  }
  
  printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(80));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    console.log(`\nTests Run: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${(passed / total * 100).toFixed(1)}%\n`);
    
    console.log('Individual Results:');
    console.log('-'.repeat(40));
    
    for (const result of this.results) {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.testName}`);
      console.log(`   ${result.message}`);
    }
    
    // Overall verdict
    console.log('\n' + '='.repeat(80));
    console.log('🎯 MIGRATION VALIDATION VERDICT');
    console.log('-'.repeat(40));
    
    if (passed === total) {
      console.log('✅ PERFECT - All tests passed!');
      console.log('Migration completed successfully with 100% validation.');
    } else if (passed >= total * 0.9) {
      console.log('✅ EXCELLENT - Over 90% tests passed');
      console.log('Minor issues detected but migration is largely successful.');
    } else if (passed >= total * 0.7) {
      console.log('⚠️ GOOD - Over 70% tests passed');
      console.log('Some issues need attention before production use.');
    } else {
      console.log('❌ NEEDS WORK - Less than 70% tests passed');
      console.log('Significant issues detected. Review and fix before proceeding.');
    }
  }
}

async function runTests() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  const tester = new MigrationTester(db);
  await tester.runAllTests();
  
  await client.close();
}

// Export for use in other scripts
export { MigrationTester };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}