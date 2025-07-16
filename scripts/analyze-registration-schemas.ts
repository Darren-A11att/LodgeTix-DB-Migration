import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface FieldAnalysis {
  path: string;
  count: number;
  percentage: number;
  types: Set<string>;
  registrationTypes: Record<string, number>;
  sampleValues: any[];
}

interface SchemaPattern {
  registrationType: string;
  count: number;
  commonFields: string[];
  uniqueFields: string[];
}

function getNestedPaths(obj: any, prefix: string = ''): Map<string, any> {
  const paths = new Map<string, any>();
  
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    
    if (value === null || value === undefined) {
      paths.set(path, null);
    } else if (Array.isArray(value)) {
      paths.set(path, 'array');
      // Also analyze first item if array is not empty
      if (value.length > 0 && typeof value[0] === 'object') {
        const arrayPaths = getNestedPaths(value[0], `${path}[0]`);
        arrayPaths.forEach((val, key) => paths.set(key, val));
      }
    } else if (typeof value === 'object' && !(value instanceof Date)) {
      paths.set(path, 'object');
      // Recursively get nested paths
      const nestedPaths = getNestedPaths(value, path);
      nestedPaths.forEach((val, key) => paths.set(key, val));
    } else {
      paths.set(path, value);
    }
  }
  
  return paths;
}

function analyzeRegistrationSchemas() {
  console.log('Loading registrations from file...');
  const registrationsPath = join(__dirname, 'registrations.json');
  const registrations = JSON.parse(readFileSync(registrationsPath, 'utf-8'));
  
  console.log(`Analyzing ${registrations.length} registrations...`);
  
  // Track field occurrences
  const fieldAnalysis = new Map<string, FieldAnalysis>();
  const registrationTypePatterns = new Map<string, Set<string>>();
  
  // Analyze each registration
  registrations.forEach((registration: any) => {
    const registrationType = registration.registrationType || 'unknown';
    const paths = getNestedPaths(registration);
    
    // Track fields for this registration type
    if (!registrationTypePatterns.has(registrationType)) {
      registrationTypePatterns.set(registrationType, new Set<string>());
    }
    const typePattern = registrationTypePatterns.get(registrationType)!;
    
    // Analyze each path
    paths.forEach((value, path) => {
      typePattern.add(path);
      
      if (!fieldAnalysis.has(path)) {
        fieldAnalysis.set(path, {
          path,
          count: 0,
          percentage: 0,
          types: new Set<string>(),
          registrationTypes: {},
          sampleValues: []
        });
      }
      
      const analysis = fieldAnalysis.get(path)!;
      analysis.count++;
      
      // Track data types
      if (value === null) {
        analysis.types.add('null');
      } else if (value === 'array') {
        analysis.types.add('array');
      } else if (value === 'object') {
        analysis.types.add('object');
      } else {
        analysis.types.add(typeof value);
      }
      
      // Track by registration type
      analysis.registrationTypes[registrationType] = (analysis.registrationTypes[registrationType] || 0) + 1;
      
      // Collect sample values (limit to 5)
      if (analysis.sampleValues.length < 5 && value !== null && value !== 'object' && value !== 'array') {
        analysis.sampleValues.push(value);
      }
    });
  });
  
  // Calculate percentages
  fieldAnalysis.forEach(analysis => {
    analysis.percentage = (analysis.count / registrations.length) * 100;
  });
  
  // Generate schema patterns by registration type
  const schemaPatterns: SchemaPattern[] = [];
  registrationTypePatterns.forEach((fields, type) => {
    const typeCount = registrations.filter((r: any) => (r.registrationType || 'unknown') === type).length;
    
    // Find common fields (present in >90% of this type)
    const commonFields = Array.from(fields).filter(field => {
      const analysis = fieldAnalysis.get(field)!;
      const fieldTypeCount = analysis.registrationTypes[type] || 0;
      return (fieldTypeCount / typeCount) > 0.9;
    }).sort();
    
    // Find unique fields (only in this type)
    const uniqueFields = Array.from(fields).filter(field => {
      const analysis = fieldAnalysis.get(field)!;
      return Object.keys(analysis.registrationTypes).length === 1;
    }).sort();
    
    schemaPatterns.push({
      registrationType: type,
      count: typeCount,
      commonFields,
      uniqueFields
    });
  });
  
  // Sort schema patterns by count
  schemaPatterns.sort((a, b) => b.count - a.count);
  
  // Convert field analysis to array and sort by frequency
  const fieldReport = Array.from(fieldAnalysis.values())
    .sort((a, b) => b.count - a.count)
    .map(analysis => ({
      ...analysis,
      types: Array.from(analysis.types),
      registrationTypesBreakdown: Object.entries(analysis.registrationTypes)
        .sort(([, a], [, b]) => b - a)
        .map(([type, count]) => `${type}: ${count}`)
    }));
  
  // Generate reports
  const report = {
    summary: {
      totalRegistrations: registrations.length,
      totalUniqueFields: fieldAnalysis.size,
      registrationTypes: Object.entries(
        registrations.reduce((acc: any, reg: any) => {
          const type = reg.registrationType || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {})
      ).sort(([, a], [, b]) => (b as number) - (a as number))
    },
    schemaPatterns,
    fieldFrequency: fieldReport.slice(0, 100), // Top 100 fields
    mostCommonSchema: findMostCommonSchema(registrations, fieldAnalysis),
    coreFields: fieldReport.filter(f => f.percentage > 90),
    rareFields: fieldReport.filter(f => f.percentage < 10).slice(0, 50)
  };
  
  // Save detailed report
  const reportPath = join(__dirname, 'registration-schema-analysis.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);
  
  // Save field frequency CSV for easy viewing
  const csvPath = join(__dirname, 'field-frequency.csv');
  const csv = [
    'Path,Count,Percentage,Types,Registration Types',
    ...fieldReport.map(f => 
      `"${f.path}",${f.count},${f.percentage.toFixed(2)}%,"${f.types.join(', ')}","${f.registrationTypesBreakdown.slice(0, 3).join('; ')}"`
    )
  ].join('\n');
  writeFileSync(csvPath, csv);
  console.log(`Field frequency CSV saved to: ${csvPath}`);
  
  // Print summary
  console.log('\n=== ANALYSIS SUMMARY ===');
  console.log(`Total registrations: ${report.summary.totalRegistrations}`);
  console.log(`Total unique fields: ${report.summary.totalUniqueFields}`);
  console.log(`\nRegistration types:`);
  report.summary.registrationTypes.forEach(([type, count]: [string, any]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  console.log('\n=== MOST COMMON FIELDS (>90% presence) ===');
  report.coreFields.slice(0, 20).forEach(field => {
    console.log(`  ${field.path}: ${field.percentage.toFixed(1)}% (${field.count})`);
  });
  
  console.log('\n=== SCHEMA PATTERNS BY TYPE ===');
  schemaPatterns.slice(0, 5).forEach(pattern => {
    console.log(`\n${pattern.registrationType} (${pattern.count} registrations):`);
    console.log(`  Common fields (>90%): ${pattern.commonFields.length}`);
    if (pattern.uniqueFields.length > 0) {
      console.log(`  Unique fields: ${pattern.uniqueFields.slice(0, 5).join(', ')}${pattern.uniqueFields.length > 5 ? '...' : ''}`);
    }
  });
}

function findMostCommonSchema(registrations: any[], fieldAnalysis: Map<string, FieldAnalysis>) {
  // Find the most common set of fields
  const schemaFingerprints = new Map<string, number>();
  
  registrations.forEach(reg => {
    const paths = Array.from(getNestedPaths(reg).keys()).sort();
    const fingerprint = paths.join('|');
    schemaFingerprints.set(fingerprint, (schemaFingerprints.get(fingerprint) || 0) + 1);
  });
  
  // Find most common fingerprint
  let mostCommon = { fingerprint: '', count: 0, fields: [] as string[] };
  schemaFingerprints.forEach((count, fingerprint) => {
    if (count > mostCommon.count) {
      mostCommon = {
        fingerprint,
        count,
        fields: fingerprint.split('|')
      };
    }
  });
  
  return {
    count: mostCommon.count,
    percentage: (mostCommon.count / registrations.length) * 100,
    fieldCount: mostCommon.fields.length,
    fields: mostCommon.fields.slice(0, 50) // First 50 fields
  };
}

// Run the analysis
analyzeRegistrationSchemas();