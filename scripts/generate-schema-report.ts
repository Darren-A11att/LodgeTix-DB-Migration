import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface RegistrationAnalysis {
  summary: {
    totalRegistrations: number;
    totalUniqueFields: number;
    registrationTypes: Array<[string, number]>;
  };
  schemaPatterns: Array<{
    registrationType: string;
    count: number;
    commonFields: string[];
    uniqueFields: string[];
  }>;
  fieldFrequency: Array<{
    path: string;
    count: number;
    percentage: number;
    types: string[];
    registrationTypesBreakdown: string[];
  }>;
  mostCommonSchema: {
    count: number;
    percentage: number;
    fieldCount: number;
    fields: string[];
  };
  coreFields: Array<{
    path: string;
    count: number;
    percentage: number;
  }>;
}

function generateSchemaReport() {
  console.log('Loading analysis results...');
  const analysisPath = join(__dirname, 'registration-schema-analysis.json');
  const analysis: RegistrationAnalysis = JSON.parse(readFileSync(analysisPath, 'utf-8'));
  
  // Generate markdown report
  let report = `# Registration Schema Analysis Report
Generated: ${new Date().toISOString()}

## Executive Summary

- **Total Registrations**: ${analysis.summary.totalRegistrations}
- **Total Unique Fields**: ${analysis.summary.totalUniqueFields}
- **Registration Types**: ${analysis.summary.registrationTypes.map(([type, count]) => `${type} (${count})`).join(', ')}

## Most Common Schema Structure

The most common schema pattern appears in **${analysis.mostCommonSchema.count} registrations (${analysis.mostCommonSchema.percentage.toFixed(1)}%)** and contains **${analysis.mostCommonSchema.fieldCount} fields**.

## Core Fields (Present in >90% of registrations)

These fields form the core structure that is consistent across almost all registrations:

| Field Path | Presence | Count |
|------------|----------|-------|
`;

  analysis.coreFields.slice(0, 30).forEach(field => {
    report += `| \`${field.path}\` | ${field.percentage.toFixed(1)}% | ${field.count} |\n`;
  });

  report += `\n## Schema Patterns by Registration Type\n\n`;

  // Detailed patterns for each type
  analysis.schemaPatterns.forEach(pattern => {
    report += `### ${pattern.registrationType} (${pattern.count} registrations)\n\n`;
    report += `**Common Fields (>90% presence)**: ${pattern.commonFields.length} fields\n\n`;
    
    if (pattern.uniqueFields.length > 0) {
      report += `**Unique Fields (only in this type)**:\n`;
      pattern.uniqueFields.slice(0, 10).forEach(field => {
        report += `- \`${field}\`\n`;
      });
      if (pattern.uniqueFields.length > 10) {
        report += `- ... and ${pattern.uniqueFields.length - 10} more\n`;
      }
      report += '\n';
    }
  });

  // Nested structure analysis
  report += `## Nested Structure Analysis\n\n`;
  report += `### Key Nested Objects\n\n`;

  const nestedObjects = analysis.fieldFrequency
    .filter(f => f.path.includes('.') && !f.path.includes('[') && f.types.includes('object'))
    .slice(0, 20);

  report += `| Object Path | Presence | Registration Types |\n`;
  report += `|-------------|----------|-------------------|\n`;
  nestedObjects.forEach(field => {
    report += `| \`${field.path}\` | ${field.percentage.toFixed(1)}% | ${field.registrationTypesBreakdown[0]} |\n`;
  });

  // Array fields analysis
  report += `\n### Array Fields\n\n`;
  const arrayFields = analysis.fieldFrequency
    .filter(f => f.types.includes('array'))
    .slice(0, 10);

  report += `| Array Path | Presence | Description |\n`;
  report += `|------------|----------|-------------|\n`;
  arrayFields.forEach(field => {
    const description = field.path.includes('attendees') ? 'Attendee information' :
                       field.path.includes('tickets') ? 'Ticket details' :
                       field.path.includes('auditLog') ? 'Audit trail' :
                       'Other array data';
    report += `| \`${field.path}\` | ${field.percentage.toFixed(1)}% | ${description} |\n`;
  });

  // Field variations and inconsistencies
  report += `\n## Field Variations and Potential Issues\n\n`;
  
  // Find similar field names that might be duplicates
  const fieldNames = analysis.fieldFrequency.map(f => f.path);
  const potentialDuplicates: string[][] = [];
  
  fieldNames.forEach((field1, i) => {
    fieldNames.slice(i + 1).forEach(field2 => {
      const base1 = field1.split('.').pop() || '';
      const base2 = field2.split('.').pop() || '';
      
      // Check for similar names (e.g., email vs emailAddress)
      if (base1 !== base2 && 
          (base1.includes(base2) || base2.includes(base1)) &&
          Math.abs(base1.length - base2.length) <= 10) {
        potentialDuplicates.push([field1, field2]);
      }
    });
  });

  if (potentialDuplicates.length > 0) {
    report += `### Potential Field Duplicates\n\n`;
    report += `These fields have similar names and might represent the same data:\n\n`;
    potentialDuplicates.slice(0, 10).forEach(([field1, field2]) => {
      const freq1 = analysis.fieldFrequency.find(f => f.path === field1);
      const freq2 = analysis.fieldFrequency.find(f => f.path === field2);
      if (freq1 && freq2) {
        report += `- \`${field1}\` (${freq1.percentage.toFixed(1)}%) vs \`${field2}\` (${freq2.percentage.toFixed(1)}%)\n`;
      }
    });
  }

  // Registration type specific insights
  report += `\n## Registration Type Specific Insights\n\n`;
  
  const individualFields = analysis.fieldFrequency
    .filter(f => f.registrationTypesBreakdown.some(b => b.startsWith('individuals:')))
    .filter(f => !f.registrationTypesBreakdown.some(b => b.startsWith('lodge:')));
    
  const lodgeFields = analysis.fieldFrequency
    .filter(f => f.registrationTypesBreakdown.some(b => b.startsWith('lodge:')))
    .filter(f => !f.registrationTypesBreakdown.some(b => b.startsWith('individuals:')));

  report += `### Individual Registration Specific Fields\n\n`;
  report += `Fields that only appear in individual registrations:\n\n`;
  individualFields.slice(0, 15).forEach(field => {
    report += `- \`${field.path}\` (${field.percentage.toFixed(1)}%)\n`;
  });

  report += `\n### Lodge Registration Specific Fields\n\n`;
  report += `Fields that only appear in lodge registrations:\n\n`;
  lodgeFields.slice(0, 15).forEach(field => {
    report += `- \`${field.path}\` (${field.percentage.toFixed(1)}%)\n`;
  });

  // Recommendations
  report += `\n## Recommendations\n\n`;
  report += `Based on the schema analysis:\n\n`;
  report += `1. **Core Schema**: The core fields present in 100% of registrations should form the base schema\n`;
  report += `2. **Type-Specific Extensions**: Use inheritance or composition for type-specific fields\n`;
  report += `3. **Field Standardization**: Consider standardizing similar fields (e.g., email vs emailAddress)\n`;
  report += `4. **Nested Structure**: The deeply nested structure (registrationData.bookingContact.*, registrationData.attendees[*]) suggests a hierarchical data model\n`;
  report += `5. **Array Handling**: Attendees and tickets are the primary array fields that need special handling\n`;

  // Save the report
  const reportPath = join(__dirname, 'registration-schema-report.md');
  writeFileSync(reportPath, report);
  console.log(`\nMarkdown report saved to: ${reportPath}`);
  
  // Also generate a simplified JSON summary
  const summary = {
    coreSchema: analysis.coreFields.map(f => f.path),
    typeSpecificSchemas: {
      individuals: analysis.schemaPatterns.find(p => p.registrationType === 'individuals')?.commonFields || [],
      lodge: analysis.schemaPatterns.find(p => p.registrationType === 'lodge')?.commonFields || []
    },
    arrayFields: arrayFields.map(f => f.path),
    nestedStructures: {
      registrationData: analysis.fieldFrequency
        .filter(f => f.path.startsWith('registrationData.') && !f.path.includes('['))
        .map(f => f.path)
        .slice(0, 20)
    }
  };
  
  const summaryPath = join(__dirname, 'schema-summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Schema summary saved to: ${summaryPath}`);
}

// Run the report generation
generateSchemaReport();