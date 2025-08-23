import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

interface FieldIssue {
  type: 'name' | 'value';
  severity: 'critical' | 'high' | 'medium' | 'low';
  field: string;
  issue: string;
  examples?: any[];
  occurrences?: number;
}

async function analyzeFieldNamesVsValues() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔍 FIELD NAMES vs FIELD VALUES ANALYSIS');
  console.log('='.repeat(80));
  console.log('Distinguishing between structural (name) and content (value) issues\n');
  
  const issues: FieldIssue[] = [];
  
  // ============================================================================
  // PART 1: FIELD NAME ISSUES (Structural Problems)
  // ============================================================================
  
  console.log('📝 ANALYZING FIELD NAME ISSUES (Structural)');
  console.log('-'.repeat(40));
  
  // Check for duplicate field concepts with different names
  const registrations = db.collection('registrations');
  const regDocs = await registrations.find({}).limit(100).toArray();
  
  // Track field name variations
  const emailFields = new Set<string>();
  const phoneFields = new Set<string>();
  const addressFields = new Set<string>();
  
  for (const doc of regDocs) {
    if (doc.registrationData?.bookingContact) {
      const contact = doc.registrationData.bookingContact;
      const fields = Object.keys(contact);
      
      // Find email-related fields
      fields.forEach(field => {
        if (field.toLowerCase().includes('email')) emailFields.add(field);
        if (field.toLowerCase().includes('mail')) emailFields.add(field);
        if (field.toLowerCase().includes('phone')) phoneFields.add(field);
        if (field.toLowerCase().includes('mobile')) phoneFields.add(field);
        if (field.toLowerCase().includes('address')) addressFields.add(field);
      });
    }
  }
  
  if (emailFields.size > 1) {
    issues.push({
      type: 'name',
      severity: 'high',
      field: 'email fields',
      issue: `Multiple field names for email: ${Array.from(emailFields).join(', ')}`,
      examples: Array.from(emailFields)
    });
  }
  
  if (phoneFields.size > 1) {
    issues.push({
      type: 'name',
      severity: 'high',
      field: 'phone fields',
      issue: `Multiple field names for phone: ${Array.from(phoneFields).join(', ')}`,
      examples: Array.from(phoneFields)
    });
  }
  
  // Check field presence consistency
  const fieldPresence = new Map<string, number>();
  
  for (const doc of regDocs) {
    const checkFields = (obj: any, prefix = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      Object.keys(obj).forEach(key => {
        if (key === '_id' || key === '_importedAt' || key === '_sourceSystem') return;
        const fullPath = prefix ? `${prefix}.${key}` : key;
        fieldPresence.set(fullPath, (fieldPresence.get(fullPath) || 0) + 1);
      });
    };
    
    checkFields(doc);
  }
  
  // Fields that appear inconsistently (not in all documents)
  const inconsistentFields = Array.from(fieldPresence.entries())
    .filter(([_, count]) => count < regDocs.length * 0.9 && count > regDocs.length * 0.1)
    .map(([field, count]) => ({ field, presence: (count / regDocs.length * 100).toFixed(1) }));
  
  if (inconsistentFields.length > 0) {
    console.log('\n❌ FIELD NAME ISSUE: Inconsistent field presence');
    inconsistentFields.slice(0, 5).forEach(f => {
      console.log(`   - "${f.field}" only present in ${f.presence}% of documents`);
      issues.push({
        type: 'name',
        severity: 'medium',
        field: f.field,
        issue: `Field only present in ${f.presence}% of documents`,
        occurrences: Math.round(parseFloat(f.presence) * regDocs.length / 100)
      });
    });
  }
  
  // ============================================================================
  // PART 2: FIELD VALUE ISSUES (Content Problems)
  // ============================================================================
  
  console.log('\n📊 ANALYZING FIELD VALUE ISSUES (Content)');
  console.log('-'.repeat(40));
  
  // Check for empty/null values
  const emptyValueFields = new Map<string, number>();
  const formatIssues = new Map<string, Set<string>>();
  
  for (const doc of regDocs) {
    const checkValues = (obj: any, prefix = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      Object.entries(obj).forEach(([key, value]) => {
        if (key === '_id' || key === '_importedAt' || key === '_sourceSystem') return;
        const fullPath = prefix ? `${prefix}.${key}` : key;
        
        // Check for empty values
        if (value === null || value === undefined || value === '' || 
            (typeof value === 'string' && value.trim() === '')) {
          emptyValueFields.set(fullPath, (emptyValueFields.get(fullPath) || 0) + 1);
        }
        
        // Check for format inconsistencies
        if (key.toLowerCase().includes('email') && value && typeof value === 'string') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            if (!formatIssues.has(fullPath)) formatIssues.set(fullPath, new Set());
            formatIssues.get(fullPath)!.add(value);
          }
        }
        
        if (key.toLowerCase().includes('phone') && value && typeof value === 'string') {
          // Check for different phone formats
          const formats = new Set<string>();
          if (value.match(/^\d{10}$/)) formats.add('10digits');
          if (value.match(/^\+\d+/)) formats.add('international');
          if (value.match(/^\d{4} \d{3} \d{3}$/)) formats.add('spaced');
          if (value.match(/^04\d{8}$/)) formats.add('australian');
          
          if (!formatIssues.has(fullPath)) formatIssues.set(fullPath, new Set());
          formatIssues.get(fullPath)!.add(formats.size > 0 ? Array.from(formats).join(',') : 'unknown');
        }
        
        if (key.toLowerCase().includes('date') && value) {
          // Check date format consistency
          const formats = new Set<string>();
          if (typeof value === 'string') {
            if (value.match(/^\d{4}-\d{2}-\d{2}/)) formats.add('ISO');
            if (value.match(/^\d{2}\/\d{2}\/\d{4}/)) formats.add('DD/MM/YYYY');
            if (value.match(/^\d{2}-\d{2}-\d{4}/)) formats.add('DD-MM-YYYY');
          } else if (value instanceof Date) {
            formats.add('Date object');
          } else if (typeof value === 'number') {
            formats.add('timestamp');
          }
          
          if (!formatIssues.has(fullPath)) formatIssues.set(fullPath, new Set());
          if (formats.size > 0) {
            formatIssues.get(fullPath)!.add(Array.from(formats).join(','));
          }
        }
      });
    };
    
    checkValues(doc);
    if (doc.registrationData) checkValues(doc.registrationData, 'registrationData');
  }
  
  // Report empty value issues
  console.log('\n🚫 VALUE ISSUE: Empty/Null Values');
  const significantEmptyFields = Array.from(emptyValueFields.entries())
    .filter(([_, count]) => count > regDocs.length * 0.1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  significantEmptyFields.forEach(([field, count]) => {
    const percentage = (count / regDocs.length * 100).toFixed(1);
    console.log(`   - "${field}": empty in ${percentage}% of documents (${count}/${regDocs.length})`);
    
    issues.push({
      type: 'value',
      severity: count > regDocs.length * 0.5 ? 'critical' : 'high',
      field,
      issue: `Empty/null in ${percentage}% of documents`,
      occurrences: count
    });
  });
  
  // Report format inconsistencies
  console.log('\n🔀 VALUE ISSUE: Format Inconsistencies');
  const significantFormatIssues = Array.from(formatIssues.entries())
    .filter(([_, formats]) => formats.size > 1)
    .slice(0, 10);
  
  significantFormatIssues.forEach(([field, formats]) => {
    console.log(`   - "${field}": ${formats.size} different formats found`);
    console.log(`     Formats: ${Array.from(formats).slice(0, 3).join(', ')}`);
    
    issues.push({
      type: 'value',
      severity: 'medium',
      field,
      issue: `${formats.size} different formats found`,
      examples: Array.from(formats).slice(0, 3)
    });
  });
  
  // ============================================================================
  // PART 3: SPECIFIC COLLECTION ANALYSIS
  // ============================================================================
  
  console.log('\n🎯 ANALYZING SPECIFIC COLLECTIONS');
  console.log('-'.repeat(40));
  
  // Analyze organisations collection
  const orgs = await db.collection('organisations').find({}).limit(50).toArray();
  const orgFieldStructures = new Set<string>();
  const orgEmptyFields = new Map<string, number>();
  
  orgs.forEach(org => {
    // Check field structure
    const structure = Object.keys(org).filter(k => k !== '_id').sort().join(',');
    orgFieldStructures.add(structure);
    
    // Check empty values
    Object.entries(org).forEach(([key, value]) => {
      if (value === null || value === '' || value === undefined) {
        orgEmptyFields.set(key, (orgEmptyFields.get(key) || 0) + 1);
      }
    });
  });
  
  console.log('\n📋 Organisations Collection:');
  console.log(`   Field Structures: ${orgFieldStructures.size} different structures (FIELD NAME ISSUE)`);
  
  const topEmptyOrgFields = Array.from(orgEmptyFields.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  console.log('   Top Empty Fields (FIELD VALUE ISSUE):');
  topEmptyOrgFields.forEach(([field, count]) => {
    console.log(`     - ${field}: empty in ${count}/${orgs.length} documents`);
  });
  
  // ============================================================================
  // PART 4: SUMMARY
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 ANALYSIS SUMMARY\n');
  
  const nameIssues = issues.filter(i => i.type === 'name');
  const valueIssues = issues.filter(i => i.type === 'value');
  
  console.log(`FIELD NAME ISSUES (Structural): ${nameIssues.length}`);
  nameIssues.forEach(issue => {
    console.log(`  ❌ ${issue.field}: ${issue.issue}`);
  });
  
  console.log(`\nFIELD VALUE ISSUES (Content): ${valueIssues.length}`);
  valueIssues.forEach(issue => {
    console.log(`  ⚠️ ${issue.field}: ${issue.issue}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('🎯 KEY FINDINGS:\n');
  
  const namePercentage = (nameIssues.length / (nameIssues.length + valueIssues.length) * 100).toFixed(0);
  const valuePercentage = (valueIssues.length / (nameIssues.length + valueIssues.length) * 100).toFixed(0);
  
  console.log(`📝 ${namePercentage}% of issues are FIELD NAME problems (structural)`);
  console.log(`📊 ${valuePercentage}% of issues are FIELD VALUE problems (content)\n`);
  
  if (parseInt(namePercentage) > parseInt(valuePercentage)) {
    console.log('⚡ PRIMARY ISSUE: Field naming and structure inconsistency');
    console.log('   - Multiple names for same data (email vs emailAddress)');
    console.log('   - Fields missing from some documents');
    console.log('   - Different document structures in same collection\n');
    console.log('💡 SOLUTION: Standardize field names and enforce consistent schema');
  } else {
    console.log('⚡ PRIMARY ISSUE: Field value quality and format');
    console.log('   - High percentage of empty/null values');
    console.log('   - Inconsistent formats (phone numbers, dates)');
    console.log('   - Missing required data\n');
    console.log('💡 SOLUTION: Data validation, format standardization, and required field enforcement');
  }
  
  await client.close();
}

analyzeFieldNamesVsValues().catch(console.error);