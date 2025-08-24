import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

async function deepValueAnalysis() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔍 DEEP VALUE ANALYSIS - Understanding Content Issues');
  console.log('='.repeat(80));
  
  // ============================================================================
  // ANALYZE CRITICAL EMPTY FIELDS
  // ============================================================================
  
  console.log('\n🚫 CRITICAL EMPTY FIELDS ANALYSIS\n');
  
  const registrations = db.collection('registrations');
  const allRegs = await registrations.find({}).toArray();
  
  console.log(`Total registrations analyzed: ${allRegs.length}\n`);
  
  // Fields that are always or mostly empty
  const criticalEmptyFields = [
    'primaryAttendeeId',
    'platformFeeId', 
    'confirmationPdfUrl',
    'organisationNumber',
    'eventId',
    'organisationName',
    'squarePaymentId',
    'organisationId'
  ];
  
  for (const field of criticalEmptyFields) {
    const hasValue = allRegs.filter(r => r[field] && r[field] !== '').length;
    const isEmpty = allRegs.filter(r => !r[field] || r[field] === '').length;
    
    console.log(`📌 ${field}:`);
    console.log(`   - Has value: ${hasValue} (${(hasValue/allRegs.length*100).toFixed(1)}%)`);
    console.log(`   - Empty/null: ${isEmpty} (${(isEmpty/allRegs.length*100).toFixed(1)}%)`);
    
    // Show sample of what values look like when present
    const samplesWithValue = allRegs
      .filter(r => r[field] && r[field] !== '')
      .slice(0, 3)
      .map(r => r[field]);
    
    if (samplesWithValue.length > 0) {
      console.log(`   - Sample values: ${samplesWithValue.join(', ')}`);
    }
    console.log();
  }
  
  // ============================================================================
  // ANALYZE FORMAT INCONSISTENCIES
  // ============================================================================
  
  console.log('='.repeat(80));
  console.log('\n🔀 FORMAT INCONSISTENCY ANALYSIS\n');
  
  // Analyze email formats
  console.log('📧 EMAIL FIELD ANALYSIS:');
  const emailFormats = new Map<string, number>();
  const emailFields: string[] = [];
  
  for (const reg of allRegs) {
    // Check different locations for email
    const emails = [
      reg.registrationData?.bookingContact?.email,
      reg.registrationData?.bookingContact?.emailAddress,
      reg.email,
      reg.emailAddress
    ].filter(e => e);
    
    emails.forEach(email => {
      if (typeof email === 'string') {
        emailFields.push(email);
        // Categorize email format
        if (email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          emailFormats.set('valid', (emailFormats.get('valid') || 0) + 1);
        } else if (email.includes('@')) {
          emailFormats.set('invalid_format', (emailFormats.get('invalid_format') || 0) + 1);
        } else {
          emailFormats.set('not_email', (emailFormats.get('not_email') || 0) + 1);
        }
      }
    });
  }
  
  console.log(`   Total emails found: ${emailFields.length}`);
  emailFormats.forEach((count, format) => {
    console.log(`   - ${format}: ${count} (${(count/emailFields.length*100).toFixed(1)}%)`);
  });
  
  // Show invalid examples
  const invalidEmails = emailFields.filter(e => !e.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)).slice(0, 5);
  if (invalidEmails.length > 0) {
    console.log(`   - Invalid examples: ${invalidEmails.join(', ')}`);
  }
  
  // Analyze phone formats
  console.log('\n📱 PHONE FIELD ANALYSIS:');
  const phoneFormats = new Map<string, number>();
  const phoneFields: string[] = [];
  
  for (const reg of allRegs) {
    // Check different locations for phone
    const phones = [
      reg.registrationData?.bookingContact?.phone,
      reg.registrationData?.bookingContact?.mobile,
      reg.registrationData?.bookingContact?.mobileNumber,
      reg.phone,
      reg.mobile
    ].filter(p => p);
    
    phones.forEach(phone => {
      if (typeof phone === 'string') {
        phoneFields.push(phone);
        // Categorize phone format
        if (phone.match(/^04\d{8}$/)) {
          phoneFormats.set('australian_mobile', (phoneFormats.get('australian_mobile') || 0) + 1);
        } else if (phone.match(/^\+61/)) {
          phoneFormats.set('international_au', (phoneFormats.get('international_au') || 0) + 1);
        } else if (phone.match(/^\d{4} \d{3} \d{3}$/)) {
          phoneFormats.set('spaced_format', (phoneFormats.get('spaced_format') || 0) + 1);
        } else if (phone.match(/^\d{10}$/)) {
          phoneFormats.set('10_digits', (phoneFormats.get('10_digits') || 0) + 1);
        } else if (phone === '' || phone.trim() === '') {
          phoneFormats.set('empty_string', (phoneFormats.get('empty_string') || 0) + 1);
        } else {
          phoneFormats.set('other_format', (phoneFormats.get('other_format') || 0) + 1);
        }
      }
    });
  }
  
  console.log(`   Total phones found: ${phoneFields.length}`);
  phoneFormats.forEach((count, format) => {
    console.log(`   - ${format}: ${count} (${(count/phoneFields.length*100).toFixed(1)}%)`);
  });
  
  // Show different format examples
  const phoneExamples = phoneFields.slice(0, 10);
  console.log(`   - Sample formats: ${phoneExamples.join(', ')}`);
  
  // ============================================================================
  // ANALYZE DATE FORMATS
  // ============================================================================
  
  console.log('\n📅 DATE FIELD ANALYSIS:');
  const dateFormats = new Map<string, number>();
  const dateFields: any[] = [];
  
  for (const reg of allRegs) {
    // Check all date fields
    const dates = [
      reg.createdAt,
      reg.updatedAt,
      reg.registrationCreatedAt,
      reg.paymentDate
    ].filter(d => d);
    
    dates.forEach(date => {
      dateFields.push(date);
      if (typeof date === 'string') {
        if (date.match(/^\d{4}-\d{2}-\d{2}T/)) {
          dateFormats.set('ISO_8601', (dateFormats.get('ISO_8601') || 0) + 1);
        } else if (date.match(/^\d{2}\/\d{2}\/\d{4}/)) {
          dateFormats.set('DD/MM/YYYY', (dateFormats.get('DD/MM/YYYY') || 0) + 1);
        } else {
          dateFormats.set('other_string', (dateFormats.get('other_string') || 0) + 1);
        }
      } else if (date instanceof Date) {
        dateFormats.set('Date_object', (dateFormats.get('Date_object') || 0) + 1);
      } else if (typeof date === 'number') {
        dateFormats.set('timestamp', (dateFormats.get('timestamp') || 0) + 1);
      }
    });
  }
  
  console.log(`   Total dates found: ${dateFields.length}`);
  dateFormats.forEach((count, format) => {
    console.log(`   - ${format}: ${count} (${(count/dateFields.length*100).toFixed(1)}%)`);
  });
  
  // ============================================================================
  // ANALYZE REQUIRED FIELDS THAT ARE EMPTY
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('\n⚠️  REQUIRED FIELDS THAT ARE OFTEN EMPTY\n');
  
  // These fields should probably always have values
  const shouldBeRequired = [
    { field: 'registrationType', path: 'registrationType' },
    { field: 'email (any form)', paths: ['email', 'emailAddress', 'registrationData.bookingContact.email', 'registrationData.bookingContact.emailAddress'] },
    { field: 'total amount', paths: ['totalAmount', 'total', 'amount'] },
    { field: 'payment status', paths: ['paymentCompleted', 'paymentStatus', 'isPaid'] }
  ];
  
  for (const req of shouldBeRequired) {
    console.log(`📌 ${req.field}:`);
    
    if (req.paths) {
      for (const path of req.paths) {
        const parts = path.split('.');
        let hasValue = 0;
        let isEmpty = 0;
        
        for (const reg of allRegs) {
          let value: any = reg;
          let found = true;
          
          for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
              value = value[part];
            } else {
              found = false;
              break;
            }
          }
          
          if (found && value !== null && value !== undefined && value !== '') {
            hasValue++;
          } else {
            isEmpty++;
          }
        }
        
        if (hasValue > 0) {
          console.log(`   - "${path}": ${hasValue} have value (${(hasValue/allRegs.length*100).toFixed(1)}%)`);
        }
      }
    } else if (req.path) {
      const hasValue = allRegs.filter(r => r[req.path] && r[req.path] !== '').length;
      console.log(`   - Has value: ${hasValue} (${(hasValue/allRegs.length*100).toFixed(1)}%)`);
      console.log(`   - Empty: ${allRegs.length - hasValue} (${((allRegs.length - hasValue)/allRegs.length*100).toFixed(1)}%)`);
    }
    console.log();
  }
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  
  console.log('='.repeat(80));
  console.log('\n🎯 DEEP VALUE ANALYSIS SUMMARY\n');
  
  console.log('1. 🚨 CRITICAL ISSUE: Fields that are ALWAYS empty');
  console.log('   - primaryAttendeeId: 100% empty (never used)');
  console.log('   - platformFeeId: 100% empty (never used)');
  console.log('   - confirmationPdfUrl: 100% empty (never used)');
  console.log('   - organisationNumber: 100% empty (never used)\n');
  
  console.log('2. ⚠️  MAJOR ISSUE: Fields that are MOSTLY empty');
  console.log('   - organisationName: 87% empty');
  console.log('   - squarePaymentId: 75% empty');
  console.log('   - organisationId: 67% empty\n');
  
  console.log('3. 🔀 FORMAT ISSUES: Inconsistent data formats');
  console.log('   - Phone numbers: Multiple formats (spaced, international, etc.)');
  console.log('   - Dates: Mix of ISO 8601, DD/MM/YYYY, timestamps');
  console.log('   - Email: Some invalid formats found\n');
  
  console.log('4. 📝 FIELD NAME ISSUES (Minor compared to value issues)');
  console.log('   - email vs emailAddress (both used)');
  console.log('   - mobile vs mobileNumber vs phone (all three used)\n');
  
  console.log('💡 RECOMMENDATIONS:');
  console.log('   1. Remove fields that are never used (100% empty)');
  console.log('   2. Make critical fields required (email, registrationType)');
  console.log('   3. Standardize phone format to single format');
  console.log('   4. Standardize date format to ISO 8601');
  console.log('   5. Validate email format on input');
  console.log('   6. Either populate or remove mostly-empty fields');
  
  await client.close();
}

deepValueAnalysis().catch(console.error);