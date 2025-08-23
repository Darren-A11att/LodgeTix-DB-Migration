import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function analyzeLodgeSchemas() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🏛️ ANALYZING LODGE/ORGANIZATION SCHEMAS');
  console.log('='.repeat(80));
  
  try {
    const registrationsCollection = db.collection('old_registrations');
    
    // Get different registration types
    const lodgeRegs = await registrationsCollection.find({
      registrationType: { $in: ['lodge', 'lodges', 'delegation'] }
    }).toArray();
    
    const grandLodgeRegs = await registrationsCollection.find({
      registrationType: 'grandLodge'
    }).toArray();
    
    const masonicOrderRegs = await registrationsCollection.find({
      registrationType: 'masonicOrder'
    }).toArray();
    
    console.log(`\n📊 Registration Type Counts:`);
    console.log(`  Lodge/Delegation: ${lodgeRegs.length}`);
    console.log(`  Grand Lodge: ${grandLodgeRegs.length}`);
    console.log(`  Masonic Order: ${masonicOrderRegs.length}`);
    
    // Analyze lodge registration structure
    console.log('\n' + '='.repeat(80));
    console.log('📋 LODGE REGISTRATION STRUCTURE');
    console.log('-'.repeat(40));
    
    if (lodgeRegs.length > 0) {
      const lodgeFields = new Map<string, number>();
      
      for (const reg of lodgeRegs) {
        if (reg.registrationData) {
          analyzeFields(reg.registrationData, '', lodgeFields);
        }
      }
      
      console.log('\nCommon Lodge Registration Fields:');
      const sortedFields = Array.from(lodgeFields.entries())
        .sort((a, b) => b[1] - a[1])
        .filter(([field]) => !field.includes('attendees.'))
        .slice(0, 30);
      
      for (const [field, count] of sortedFields) {
        const percentage = (count / lodgeRegs.length * 100).toFixed(1);
        console.log(`  ${field}: ${percentage}%`);
      }
      
      // Sample lodge registration data
      console.log('\n📝 Sample Lodge Registration Data:');
      const sampleLodge = lodgeRegs[0];
      if (sampleLodge?.registrationData) {
        const data = sampleLodge.registrationData;
        console.log(`  Lodge Name: ${data.lodgeName || data.lodge?.name || 'N/A'}`);
        console.log(`  Lodge Number: ${data.lodgeNumber || data.lodge?.number || 'N/A'}`);
        console.log(`  Booking Contact:`, data.bookingContact ? {
          name: `${data.bookingContact.firstName} ${data.bookingContact.lastName}`,
          email: data.bookingContact.email,
          phone: data.bookingContact.phone
        } : 'N/A');
        console.log(`  Attendee Count: ${data.attendees?.length || 0}`);
        
        if (data.attendees && data.attendees.length > 0) {
          console.log('\n  Sample Attendee Structure:');
          const sampleAttendee = data.attendees[0];
          console.log('    Fields:', Object.keys(sampleAttendee).join(', '));
        }
      }
    }
    
    // Analyze attendee structure within lodge registrations
    console.log('\n' + '='.repeat(80));
    console.log('📋 ATTENDEE STRUCTURE IN LODGE REGISTRATIONS');
    console.log('-'.repeat(40));
    
    const attendeeFields = new Map<string, number>();
    let totalAttendees = 0;
    
    for (const reg of lodgeRegs) {
      if (reg.registrationData?.attendees && Array.isArray(reg.registrationData.attendees)) {
        for (const attendee of reg.registrationData.attendees) {
          totalAttendees++;
          for (const field of Object.keys(attendee)) {
            attendeeFields.set(field, (attendeeFields.get(field) || 0) + 1);
          }
        }
      }
    }
    
    if (totalAttendees > 0) {
      console.log(`\nTotal attendees in lodge registrations: ${totalAttendees}`);
      console.log('\nCommon Attendee Fields:');
      const sortedAttendeeFields = Array.from(attendeeFields.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
      
      for (const [field, count] of sortedAttendeeFields) {
        const percentage = (count / totalAttendees * 100).toFixed(1);
        console.log(`  ${field}: ${percentage}%`);
      }
    }
    
    // Extract relationship patterns
    console.log('\n' + '='.repeat(80));
    console.log('💑 RELATIONSHIP PATTERNS');
    console.log('-'.repeat(40));
    
    const relationships = new Map<string, any[]>();
    
    // From all registrations
    const allRegs = await registrationsCollection.find({}).toArray();
    
    for (const reg of allRegs) {
      if (reg.registrationData?.attendees) {
        for (const attendee of reg.registrationData.attendees) {
          if (attendee.relationship && attendee.relationship !== '') {
            if (!relationships.has(attendee.relationship)) {
              relationships.set(attendee.relationship, []);
            }
            relationships.get(attendee.relationship)!.push({
              partnerOf: attendee.partnerOf,
              isPartner: attendee.isPartner,
              partner: attendee.partner
            });
          }
        }
      }
    }
    
    console.log('\nRelationship Types Found:');
    for (const [type, examples] of relationships) {
      console.log(`  ${type}: ${examples.length} occurrences`);
      if (examples.length > 0 && examples[0].partnerOf) {
        console.log(`    Example: partnerOf=${examples[0].partnerOf}`);
      }
    }
    
    // Generate recommended schemas
    console.log('\n' + '='.repeat(80));
    console.log('📋 RECOMMENDED FORM SCHEMAS');
    console.log('-'.repeat(40));
    
    console.log('\n✅ INDIVIDUAL MASON FORM:');
    console.log(JSON.stringify({
      formId: 'form_individual_mason',
      formType: 'individual',
      attendeeType: 'mason',
      fields: {
        title: { type: 'select', required: false, options: ['Mr', 'Mrs', 'Ms', 'Dr', 'Rev', 'W Bro', 'Bro'] },
        firstName: { type: 'text', required: true },
        lastName: { type: 'text', required: true },
        suffix: { type: 'text', required: false },
        email: { type: 'email', required: true },
        phone: { type: 'tel', required: false },
        lodgeName: { type: 'text', required: true },
        lodgeNumber: { type: 'text', required: true },
        rank: { type: 'select', required: true, options: ['EA', 'FC', 'MM', 'WM', 'PM', 'GL'] },
        grandLodge: { type: 'text', required: false },
        postNominals: { type: 'text', required: false },
        dietaryRequirements: { type: 'text', required: false },
        specialNeeds: { type: 'text', required: false }
      }
    }, null, 2));
    
    console.log('\n✅ INDIVIDUAL GUEST FORM:');
    console.log(JSON.stringify({
      formId: 'form_individual_guest',
      formType: 'individual',
      attendeeType: 'guest',
      fields: {
        title: { type: 'select', required: false, options: ['Mr', 'Mrs', 'Ms', 'Dr'] },
        firstName: { type: 'text', required: true },
        lastName: { type: 'text', required: true },
        suffix: { type: 'text', required: false },
        email: { type: 'email', required: true },
        phone: { type: 'tel', required: false },
        relationship: {
          type: 'object',
          fields: {
            isPartner: { type: 'boolean', default: false },
            partnerOf: { type: 'text', required: false },
            partnerId: { type: 'hidden', required: false },
            relationshipType: { type: 'select', options: ['Wife', 'Husband', 'Partner', 'Guest'] }
          }
        },
        dietaryRequirements: { type: 'text', required: false },
        specialNeeds: { type: 'text', required: false }
      }
    }, null, 2));
    
    console.log('\n✅ LODGE FORM:');
    console.log(JSON.stringify({
      formId: 'form_lodge',
      formType: 'organization',
      organizationType: 'lodge',
      sections: {
        lodgeDetails: {
          lodgeName: { type: 'text', required: true },
          lodgeNumber: { type: 'text', required: true },
          lodgeAddress: { type: 'text', required: false },
          lodgeCity: { type: 'text', required: false },
          lodgeState: { type: 'text', required: false },
          lodgePostcode: { type: 'text', required: false }
        },
        representative: {
          firstName: { type: 'text', required: true },
          lastName: { type: 'text', required: true },
          email: { type: 'email', required: true },
          phone: { type: 'tel', required: true }
        },
        attendees: {
          type: 'array',
          itemSchema: {
            attendeeId: { type: 'uuid', auto: true },
            type: { type: 'select', options: ['mason', 'guest'], required: true },
            title: { type: 'text', required: false },
            firstName: { type: 'text', required: true },
            lastName: { type: 'text', required: true },
            suffix: { type: 'text', required: false },
            rank: { type: 'text', required: false, showIf: "type === 'mason'" },
            relationship: { type: 'object', required: false },
            contact: {
              preference: { type: 'select', options: ['directly', 'bookingContact'], default: 'bookingContact' },
              mobile: { type: 'tel', required: false },
              email: { type: 'email', required: false }
            },
            dietaryRequirements: { type: 'text', required: false },
            specialNeeds: { type: 'text', required: false }
          }
        }
      }
    }, null, 2));
    
  } catch (error) {
    console.error('❌ Error analyzing lodge schemas:', error);
  } finally {
    await client.close();
  }
}

function analyzeFields(obj: any, prefix: string, fieldMap: Map<string, number>) {
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_id' || key === '__v') continue;
    
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    fieldMap.set(fieldPath, (fieldMap.get(fieldPath) || 0) + 1);
    
    // Don't recurse into arrays
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && 
        prefix.split('.').length < 2) {
      analyzeFields(value, fieldPath, fieldMap);
    }
  }
}

// Always run when this file is executed
analyzeLodgeSchemas()
  .then(() => {
    console.log('\n✅ Analysis completed!');
  })
  .catch(error => {
    console.error('\n❌ Analysis failed:', error);
  });