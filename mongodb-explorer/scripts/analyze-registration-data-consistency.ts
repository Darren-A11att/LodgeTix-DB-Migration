import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

interface ConsistencyReport {
  objectName: string;
  presence: {
    count: number;
    percentage: number;
  };
  consistency: {
    uniqueSchemas: number;
    mostCommonSchema: {
      count: number;
      percentage: number;
      fields: string[];
    };
    schemaVariations: Array<{
      fields: string[];
      count: number;
      percentage: number;
    }>;
  };
  fieldConsistency: {
    alwaysPresent: string[];
    usuallyPresent: string[];
    rarelyPresent: string[];
    neverUsed: string[];
  };
  valueConsistency: {
    fieldsAlwaysPopulated: string[];
    fieldsUsuallyEmpty: string[];
    fieldsWithMixedFormats: string[];
  };
}

async function analyzeRegistrationDataConsistency() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔍 REGISTRATION DATA OBJECT CONSISTENCY ANALYSIS');
  console.log('='.repeat(80));
  
  const registrations = db.collection('registrations');
  const allRegs = await registrations.find({}).toArray();
  const totalDocs = allRegs.length;
  
  console.log(`📊 Analyzing ${totalDocs} registration documents\n`);
  
  // Helper function to get schema fingerprint
  const getSchemaFingerprint = (obj: any): string => {
    if (!obj) return 'null';
    if (Array.isArray(obj)) return 'array';
    if (typeof obj !== 'object') return 'primitive';
    
    const fields = Object.keys(obj)
      .filter(k => !k.startsWith('_'))
      .sort();
    
    return crypto.createHash('md5').update(fields.join(',')).digest('hex');
  };
  
  // Helper function to analyze an object type
  const analyzeObjectConsistency = (
    objectName: string,
    objectPath: string,
    isArray: boolean = false
  ): ConsistencyReport => {
    let presentCount = 0;
    const schemas = new Map<string, { count: number; fields: string[]; sample: any }>();
    const fieldPresence = new Map<string, number>();
    const fieldEmptiness = new Map<string, number>();
    const fieldFormats = new Map<string, Set<string>>();
    
    for (const reg of allRegs) {
      // Navigate to the object
      const pathParts = objectPath.split('.');
      let obj: any = reg;
      for (const part of pathParts) {
        obj = obj?.[part];
      }
      
      if (!obj) continue;
      presentCount++;
      
      if (isArray && Array.isArray(obj)) {
        // For arrays, analyze the structure of elements
        for (const item of obj) {
          const fingerprint = getSchemaFingerprint(item);
          const fields = Object.keys(item).filter(k => !k.startsWith('_')).sort();
          
          if (!schemas.has(fingerprint)) {
            schemas.set(fingerprint, { count: 0, fields, sample: item });
          }
          schemas.get(fingerprint)!.count++;
          
          // Track field presence and values
          for (const [key, value] of Object.entries(item)) {
            if (key.startsWith('_')) continue;
            
            fieldPresence.set(key, (fieldPresence.get(key) || 0) + 1);
            
            if (value === null || value === undefined || value === '') {
              fieldEmptiness.set(key, (fieldEmptiness.get(key) || 0) + 1);
            }
            
            // Track format variations
            if (value !== null && value !== undefined) {
              if (!fieldFormats.has(key)) fieldFormats.set(key, new Set());
              
              let format = typeof value;
              if (typeof value === 'string') {
                if (value.match(/^\d{4}-\d{2}-\d{2}/)) format = 'date-iso';
                else if (value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) format = 'email';
                else if (value.match(/^\d{10}$/)) format = 'phone-10digit';
                else if (value.match(/^\d{4} \d{3} \d{3}$/)) format = 'phone-spaced';
                else if (value.match(/^\+\d+/)) format = 'phone-intl';
                else if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) format = 'uuid';
              }
              
              fieldFormats.get(key)!.add(format);
            }
          }
        }
      } else if (!isArray && typeof obj === 'object') {
        // For regular objects
        const fingerprint = getSchemaFingerprint(obj);
        const fields = Object.keys(obj).filter(k => !k.startsWith('_')).sort();
        
        if (!schemas.has(fingerprint)) {
          schemas.set(fingerprint, { count: 0, fields, sample: obj });
        }
        schemas.get(fingerprint)!.count++;
        
        // Track field presence and values
        for (const [key, value] of Object.entries(obj)) {
          if (key.startsWith('_')) continue;
          
          fieldPresence.set(key, (fieldPresence.get(key) || 0) + 1);
          
          if (value === null || value === undefined || value === '') {
            fieldEmptiness.set(key, (fieldEmptiness.get(key) || 0) + 1);
          }
          
          // Track format variations
          if (value !== null && value !== undefined) {
            if (!fieldFormats.has(key)) fieldFormats.set(key, new Set());
            
            let format = typeof value;
            if (typeof value === 'string') {
              if (value.match(/^\d{4}-\d{2}-\d{2}/)) format = 'date-iso';
              else if (value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) format = 'email';
              else if (value.match(/^\d{10}$/)) format = 'phone-10digit';
              else if (value.match(/^\d{4} \d{3} \d{3}$/)) format = 'phone-spaced';
              else if (value.match(/^\+\d+/)) format = 'phone-intl';
              else if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) format = 'uuid';
            }
            
            fieldFormats.get(key)!.add(format);
          }
        }
      }
    }
    
    // Sort schemas by frequency
    const sortedSchemas = Array.from(schemas.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([_, data]) => ({
        fields: data.fields,
        count: data.count,
        percentage: (data.count / presentCount * 100)
      }));
    
    // Categorize fields by presence
    const alwaysPresent: string[] = [];
    const usuallyPresent: string[] = [];
    const rarelyPresent: string[] = [];
    const neverUsed: string[] = [];
    
    for (const [field, count] of fieldPresence) {
      const percentage = count / presentCount * 100;
      if (percentage >= 95) alwaysPresent.push(field);
      else if (percentage >= 50) usuallyPresent.push(field);
      else if (percentage > 0) rarelyPresent.push(field);
    }
    
    // Find fields that are always empty
    const fieldsAlwaysPopulated: string[] = [];
    const fieldsUsuallyEmpty: string[] = [];
    
    for (const [field, presenceCount] of fieldPresence) {
      const emptyCount = fieldEmptiness.get(field) || 0;
      const populatedPercentage = ((presenceCount - emptyCount) / presenceCount) * 100;
      
      if (populatedPercentage >= 95) fieldsAlwaysPopulated.push(field);
      else if (populatedPercentage <= 20) fieldsUsuallyEmpty.push(field);
    }
    
    // Find fields with mixed formats
    const fieldsWithMixedFormats: string[] = [];
    for (const [field, formats] of fieldFormats) {
      if (formats.size > 1) {
        fieldsWithMixedFormats.push(`${field} (${Array.from(formats).join(', ')})`);
      }
    }
    
    return {
      objectName,
      presence: {
        count: presentCount,
        percentage: (presentCount / totalDocs * 100)
      },
      consistency: {
        uniqueSchemas: schemas.size,
        mostCommonSchema: sortedSchemas[0] || { count: 0, percentage: 0, fields: [] },
        schemaVariations: sortedSchemas.slice(0, 5) // Top 5 variations
      },
      fieldConsistency: {
        alwaysPresent,
        usuallyPresent,
        rarelyPresent,
        neverUsed
      },
      valueConsistency: {
        fieldsAlwaysPopulated,
        fieldsUsuallyEmpty,
        fieldsWithMixedFormats
      }
    };
  };
  
  // Analyze each nested object
  const reports: ConsistencyReport[] = [];
  
  // 1. bookingContact
  reports.push(analyzeObjectConsistency('bookingContact', 'registrationData.bookingContact'));
  
  // 2. tickets array
  reports.push(analyzeObjectConsistency('tickets[]', 'registrationData.tickets', true));
  
  // 3. attendees array
  reports.push(analyzeObjectConsistency('attendees[]', 'registrationData.attendees', true));
  
  // 4. metadata
  reports.push(analyzeObjectConsistency('metadata', 'registrationData.metadata'));
  
  // 5. lodgeDetails
  reports.push(analyzeObjectConsistency('lodgeDetails', 'registrationData.lodgeDetails'));
  
  // ============================================================================
  // PRINT DETAILED REPORT
  // ============================================================================
  
  console.log('📋 CONSISTENCY REPORT FOR EACH NESTED OBJECT\n');
  console.log('='.repeat(80));
  
  for (const report of reports) {
    console.log(`\n📦 ${report.objectName.toUpperCase()}`);
    console.log('-'.repeat(40));
    
    // Presence
    console.log(`\n📊 PRESENCE:`);
    console.log(`   Appears in: ${report.presence.count}/${totalDocs} documents (${report.presence.percentage.toFixed(1)}%)`);
    
    // Schema consistency
    console.log(`\n🔄 SCHEMA CONSISTENCY:`);
    console.log(`   Unique schemas: ${report.consistency.uniqueSchemas}`);
    
    if (report.consistency.uniqueSchemas === 1) {
      console.log(`   ✅ PERFECT CONSISTENCY - All instances have identical structure`);
    } else if (report.consistency.uniqueSchemas <= 3) {
      console.log(`   ⚠️  GOOD CONSISTENCY - Only ${report.consistency.uniqueSchemas} variations`);
    } else if (report.consistency.uniqueSchemas <= 10) {
      console.log(`   ⚠️  MODERATE CONSISTENCY - ${report.consistency.uniqueSchemas} variations`);
    } else {
      console.log(`   🔴 POOR CONSISTENCY - ${report.consistency.uniqueSchemas} variations!`);
    }
    
    if (report.consistency.mostCommonSchema.count > 0) {
      console.log(`   Most common schema: ${report.consistency.mostCommonSchema.percentage.toFixed(1)}% of instances`);
      console.log(`   Fields: ${report.consistency.mostCommonSchema.fields.slice(0, 5).join(', ')}${report.consistency.mostCommonSchema.fields.length > 5 ? '...' : ''}`);
    }
    
    // Schema variations
    if (report.consistency.schemaVariations.length > 1) {
      console.log(`\n   Schema Variations:`);
      report.consistency.schemaVariations.slice(0, 3).forEach((variation, index) => {
        console.log(`   ${index + 1}. ${variation.percentage.toFixed(1)}% - ${variation.fields.length} fields`);
      });
    }
    
    // Field consistency
    console.log(`\n📝 FIELD CONSISTENCY:`);
    if (report.fieldConsistency.alwaysPresent.length > 0) {
      console.log(`   Always present (≥95%): ${report.fieldConsistency.alwaysPresent.slice(0, 5).join(', ')}`);
    }
    if (report.fieldConsistency.usuallyPresent.length > 0) {
      console.log(`   Usually present (50-94%): ${report.fieldConsistency.usuallyPresent.slice(0, 5).join(', ')}`);
    }
    if (report.fieldConsistency.rarelyPresent.length > 0) {
      console.log(`   Rarely present (<50%): ${report.fieldConsistency.rarelyPresent.slice(0, 5).join(', ')}`);
    }
    
    // Value consistency
    console.log(`\n💾 VALUE CONSISTENCY:`);
    if (report.valueConsistency.fieldsAlwaysPopulated.length > 0) {
      console.log(`   Always populated: ${report.valueConsistency.fieldsAlwaysPopulated.slice(0, 5).join(', ')}`);
    }
    if (report.valueConsistency.fieldsUsuallyEmpty.length > 0) {
      console.log(`   Usually empty: ${report.valueConsistency.fieldsUsuallyEmpty.slice(0, 5).join(', ')}`);
    }
    if (report.valueConsistency.fieldsWithMixedFormats.length > 0) {
      console.log(`   Mixed formats: ${report.valueConsistency.fieldsWithMixedFormats.slice(0, 3).join(', ')}`);
    }
  }
  
  // ============================================================================
  // OVERALL SUMMARY
  // ============================================================================
  
  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 OVERALL CONSISTENCY SUMMARY\n');
  
  // Sort by consistency
  const byConsistency = [...reports].sort((a, b) => {
    const aScore = (a.consistency.mostCommonSchema.percentage || 0);
    const bScore = (b.consistency.mostCommonSchema.percentage || 0);
    return bScore - aScore;
  });
  
  console.log('📊 CONSISTENCY RANKING (Best to Worst):');
  byConsistency.forEach((report, index) => {
    const emoji = report.consistency.uniqueSchemas === 1 ? '✅' :
                  report.consistency.uniqueSchemas <= 3 ? '⚠️' :
                  report.consistency.uniqueSchemas <= 10 ? '⚠️' : '🔴';
    
    console.log(`${index + 1}. ${emoji} ${report.objectName}:`);
    console.log(`   - Presence: ${report.presence.percentage.toFixed(1)}%`);
    console.log(`   - Schema variations: ${report.consistency.uniqueSchemas}`);
    console.log(`   - Most common schema: ${report.consistency.mostCommonSchema.percentage.toFixed(1)}%`);
  });
  
  // Reliability assessment
  console.log('\n📈 RELIABILITY ASSESSMENT:');
  
  for (const report of reports) {
    let reliability = 'UNRELIABLE';
    let reason = '';
    
    if (report.presence.percentage >= 90 && report.consistency.uniqueSchemas <= 3) {
      reliability = 'HIGHLY RELIABLE';
      reason = 'present in most documents with consistent structure';
    } else if (report.presence.percentage >= 80 && report.consistency.uniqueSchemas <= 5) {
      reliability = 'RELIABLE';
      reason = 'good presence and acceptable consistency';
    } else if (report.presence.percentage >= 50 && report.consistency.uniqueSchemas <= 10) {
      reliability = 'MODERATELY RELIABLE';
      reason = 'decent presence but some structure variations';
    } else if (report.presence.percentage < 10) {
      reliability = 'RARELY USED';
      reason = `only in ${report.presence.percentage.toFixed(1)}% of documents`;
    } else {
      reason = 'low presence or too many variations';
    }
    
    console.log(`\n${report.objectName}: ${reliability}`);
    console.log(`   Reason: ${reason}`);
  }
  
  // Critical issues
  console.log('\n⚠️  CRITICAL ISSUES:');
  
  const issues: string[] = [];
  
  for (const report of reports) {
    if (report.consistency.uniqueSchemas > 10) {
      issues.push(`${report.objectName} has ${report.consistency.uniqueSchemas} schema variations (too many!)`);
    }
    if (report.presence.percentage > 0 && report.presence.percentage < 50) {
      issues.push(`${report.objectName} appears randomly in only ${report.presence.percentage.toFixed(1)}% of documents`);
    }
    if (report.valueConsistency.fieldsWithMixedFormats.length > 5) {
      issues.push(`${report.objectName} has ${report.valueConsistency.fieldsWithMixedFormats.length} fields with format inconsistencies`);
    }
  }
  
  if (issues.length > 0) {
    issues.forEach(issue => console.log(`   • ${issue}`));
  } else {
    console.log('   ✅ No critical consistency issues found');
  }
  
  await client.close();
}

analyzeRegistrationDataConsistency().catch(console.error);