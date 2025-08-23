import { MongoClient, Db } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

interface FieldPattern {
  namePattern: RegExp;
  valuePattern?: RegExp;
  validator?: (value: any) => boolean;
  category: string;
  subcategory: string;
  sensitivity: 'public' | 'private' | 'sensitive' | 'critical';
  compliance: string[];
  description: string;
}

interface ClassificationResult {
  fieldName: string;
  sampleValue: any;
  category: string;
  subcategory: string;
  confidence: number;
  sensitivity: string;
  compliance: string[];
  description: string;
  patterns: string[];
  dataType: string;
  collection: string;
}

interface SemanticGroup {
  name: string;
  fields: ClassificationResult[];
  description: string;
  businessDomain: string;
  governance: string[];
}

class CombinedFieldValueClassifier {
  private patterns: FieldPattern[] = [
    // Personal Identity
    {
      namePattern: /(^|_)(email|mail|e_mail)($|_)/i,
      valuePattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      category: 'Personal Identity',
      subcategory: 'Email Address',
      sensitivity: 'sensitive',
      compliance: ['PII', 'GDPR'],
      description: 'Email address field'
    },
    {
      namePattern: /(^|_)(phone|mobile|tel|cell)($|_)/i,
      valuePattern: /^[\+]?[1-9][\d]{0,15}$|^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,
      category: 'Personal Identity',
      subcategory: 'Phone Number',
      sensitivity: 'sensitive',
      compliance: ['PII', 'GDPR'],
      description: 'Phone number field'
    },
    {
      namePattern: /(^|_)(ssn|social_security|social_security_number)($|_)/i,
      valuePattern: /^\d{3}-?\d{2}-?\d{4}$/,
      category: 'Personal Identity',
      subcategory: 'SSN',
      sensitivity: 'critical',
      compliance: ['PII', 'GDPR', 'HIPAA'],
      description: 'Social Security Number'
    },
    {
      namePattern: /(^|_)(first_name|firstname|fname|given_name)($|_)/i,
      validator: (value) => typeof value === 'string' && value.length > 0 && value.length < 50,
      category: 'Personal Identity',
      subcategory: 'First Name',
      sensitivity: 'sensitive',
      compliance: ['PII', 'GDPR'],
      description: 'First name field'
    },
    {
      namePattern: /(^|_)(last_name|lastname|lname|family_name|surname)($|_)/i,
      validator: (value) => typeof value === 'string' && value.length > 0 && value.length < 50,
      category: 'Personal Identity',
      subcategory: 'Last Name',
      sensitivity: 'sensitive',
      compliance: ['PII', 'GDPR'],
      description: 'Last name field'
    },
    {
      namePattern: /(^|_)(dob|date_of_birth|birth_date|birthday)($|_)/i,
      valuePattern: /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/,
      category: 'Personal Identity',
      subcategory: 'Date of Birth',
      sensitivity: 'sensitive',
      compliance: ['PII', 'GDPR', 'HIPAA'],
      description: 'Date of birth field'
    },

    // Address Information
    {
      namePattern: /(^|_)(address|street|addr|street_address)($|_)/i,
      validator: (value) => typeof value === 'string' && value.length > 5,
      category: 'Address',
      subcategory: 'Street Address',
      sensitivity: 'sensitive',
      compliance: ['PII', 'GDPR'],
      description: 'Street address field'
    },
    {
      namePattern: /(^|_)(city)($|_)/i,
      validator: (value) => typeof value === 'string' && value.length > 1 && value.length < 100,
      category: 'Address',
      subcategory: 'City',
      sensitivity: 'private',
      compliance: ['PII'],
      description: 'City field'
    },
    {
      namePattern: /(^|_)(state|province|region)($|_)/i,
      validator: (value) => typeof value === 'string' && value.length >= 2 && value.length <= 50,
      category: 'Address',
      subcategory: 'State/Province',
      sensitivity: 'private',
      compliance: ['PII'],
      description: 'State or province field'
    },
    {
      namePattern: /(^|_)(zip|postal|zipcode|postcode|postal_code)($|_)/i,
      valuePattern: /^\d{5}(-\d{4})?$|^[A-Z]\d[A-Z] \d[A-Z]\d$/,
      category: 'Address',
      subcategory: 'Postal Code',
      sensitivity: 'private',
      compliance: ['PII'],
      description: 'Postal code field'
    },
    {
      namePattern: /(^|_)(country)($|_)/i,
      validator: (value) => typeof value === 'string' && (value.length === 2 || value.length === 3 || value.length > 3),
      category: 'Address',
      subcategory: 'Country',
      sensitivity: 'private',
      compliance: [],
      description: 'Country field'
    },

    // Financial Information
    {
      namePattern: /(^|_)(credit_card|card_number|cc_number|card_num)($|_)/i,
      valuePattern: /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,
      category: 'Financial',
      subcategory: 'Credit Card',
      sensitivity: 'critical',
      compliance: ['PCI', 'PII'],
      description: 'Credit card number'
    },
    {
      namePattern: /(^|_)(amount|price|cost|total|subtotal|fee|charge)($|_)/i,
      validator: (value) => typeof value === 'number' || (typeof value === 'string' && /^\$?\d+\.?\d*$/.test(value)),
      category: 'Financial',
      subcategory: 'Monetary Amount',
      sensitivity: 'private',
      compliance: [],
      description: 'Monetary amount field'
    },
    {
      namePattern: /(^|_)(currency|curr)($|_)/i,
      valuePattern: /^[A-Z]{3}$|^\$|^€|^£|^¥/,
      category: 'Financial',
      subcategory: 'Currency',
      sensitivity: 'public',
      compliance: [],
      description: 'Currency field'
    },
    {
      namePattern: /(^|_)(account|acc|account_number|bank_account)($|_)/i,
      valuePattern: /^\d{8,17}$/,
      category: 'Financial',
      subcategory: 'Account Number',
      sensitivity: 'critical',
      compliance: ['PII', 'PCI'],
      description: 'Bank account number'
    },

    // Identification Numbers
    {
      namePattern: /(^|_)(id|_id|uuid|guid)$/i,
      validator: (value) => typeof value === 'string' && (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
        /^[0-9a-f]{24}$/i.test(value) ||
        /^\d+$/.test(value)
      ),
      category: 'System',
      subcategory: 'Identifier',
      sensitivity: 'private',
      compliance: [],
      description: 'System identifier'
    },
    {
      namePattern: /(^|_)(user_id|customer_id|client_id|member_id)($|_)/i,
      validator: (value) => typeof value === 'string' || typeof value === 'number',
      category: 'System',
      subcategory: 'User Reference',
      sensitivity: 'private',
      compliance: [],
      description: 'User reference identifier'
    },

    // Date and Time
    {
      namePattern: /(^|_)(created|updated|modified|timestamp|date|time)($|_)/i,
      validator: (value) => {
        if (value instanceof Date) return true;
        if (typeof value === 'string') {
          const date = new Date(value);
          return !isNaN(date.getTime());
        }
        if (typeof value === 'number' && value > 1000000000) return true; // Unix timestamp
        return false;
      },
      category: 'Temporal',
      subcategory: 'Timestamp',
      sensitivity: 'private',
      compliance: [],
      description: 'Date/time field'
    },

    // Health Information
    {
      namePattern: /(^|_)(medical|health|diagnosis|treatment|prescription|medication)($|_)/i,
      validator: (value) => typeof value === 'string' && value.length > 0,
      category: 'Health',
      subcategory: 'Medical Information',
      sensitivity: 'critical',
      compliance: ['PHI', 'HIPAA', 'GDPR'],
      description: 'Health-related information'
    },

    // Authentication
    {
      namePattern: /(^|_)(password|pwd|pass|hash|salt|token|secret|key)($|_)/i,
      validator: (value) => typeof value === 'string' && value.length > 0,
      category: 'Authentication',
      subcategory: 'Credential',
      sensitivity: 'critical',
      compliance: ['Security'],
      description: 'Authentication credential'
    },

    // Communication
    {
      namePattern: /(^|_)(message|comment|note|description|content|text|body)($|_)/i,
      validator: (value) => typeof value === 'string' && value.length > 0,
      category: 'Communication',
      subcategory: 'Text Content',
      sensitivity: 'private',
      compliance: [],
      description: 'Text content field'
    },

    // Business Data
    {
      namePattern: /(^|_)(company|organization|org|business|employer)($|_)/i,
      validator: (value) => typeof value === 'string' && value.length > 0,
      category: 'Business',
      subcategory: 'Organization',
      sensitivity: 'private',
      compliance: [],
      description: 'Organization name'
    },
    {
      namePattern: /(^|_)(job|title|position|role|occupation)($|_)/i,
      validator: (value) => typeof value === 'string' && value.length > 0,
      category: 'Business',
      subcategory: 'Job Title',
      sensitivity: 'private',
      compliance: [],
      description: 'Job or role title'
    }
  ];

  private client: MongoClient;
  private db: Db;

  constructor() {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
    this.client = new MongoClient(mongoUri);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db('supabase');
    console.log('Connected to MongoDB');
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  private classifyField(fieldName: string, sampleValue: any, collection: string): ClassificationResult {
    let bestMatch: FieldPattern | null = null;
    let bestScore = 0;
    const matchedPatterns: string[] = [];

    for (const pattern of this.patterns) {
      let score = 0;
      
      // Check field name pattern
      if (pattern.namePattern.test(fieldName)) {
        score += 60; // Base score for name match
        matchedPatterns.push(`name:${pattern.namePattern.source}`);

        // Check value pattern if available
        if (pattern.valuePattern && typeof sampleValue === 'string') {
          if (pattern.valuePattern.test(sampleValue)) {
            score += 30; // Additional score for value pattern match
            matchedPatterns.push(`value:${pattern.valuePattern.source}`);
          }
        }

        // Check custom validator if available
        if (pattern.validator && pattern.validator(sampleValue)) {
          score += 30; // Additional score for validator match
          matchedPatterns.push('validator:custom');
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = pattern;
        }
      }
    }

    // Default classification if no pattern matches
    if (!bestMatch) {
      bestMatch = {
        namePattern: /.*/,
        category: 'Unknown',
        subcategory: 'Unclassified',
        sensitivity: 'private',
        compliance: [],
        description: 'Unclassified field'
      };
      bestScore = 10;
    }

    const dataType = this.inferDataType(sampleValue);
    const confidence = Math.min(bestScore / 100, 1.0);

    return {
      fieldName,
      sampleValue,
      category: bestMatch.category,
      subcategory: bestMatch.subcategory,
      confidence,
      sensitivity: bestMatch.sensitivity,
      compliance: bestMatch.compliance,
      description: bestMatch.description,
      patterns: matchedPatterns,
      dataType,
      collection
    };
  }

  private inferDataType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'float';
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'uuid';
      if (/^[0-9a-f]{24}$/i.test(value)) return 'objectid';
      return 'string';
    }
    if (value instanceof Date) return 'date';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  }

  private createSemanticGroups(classifications: ClassificationResult[]): SemanticGroup[] {
    const groups = new Map<string, ClassificationResult[]>();

    classifications.forEach(classification => {
      const key = classification.category;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(classification);
    });

    return Array.from(groups.entries()).map(([category, fields]) => {
      const businessDomains = this.inferBusinessDomain(category, fields);
      const governance = this.generateGovernanceRecommendations(category, fields);

      return {
        name: category,
        fields,
        description: this.getCategoryDescription(category),
        businessDomain: businessDomains,
        governance
      };
    });
  }

  private inferBusinessDomain(category: string, fields: ClassificationResult[]): string {
    const domainMapping: { [key: string]: string } = {
      'Personal Identity': 'Customer Management',
      'Address': 'Location Services',
      'Financial': 'Payment Processing',
      'Health': 'Healthcare',
      'Authentication': 'Security',
      'Communication': 'Content Management',
      'Business': 'Enterprise Data',
      'System': 'Technical Infrastructure',
      'Temporal': 'Audit & Logging'
    };

    return domainMapping[category] || 'General Business';
  }

  private generateGovernanceRecommendations(category: string, fields: ClassificationResult[]): string[] {
    const recommendations: string[] = [];
    const sensitivityLevels = fields.map(f => f.sensitivity);
    const complianceRequirements = [...new Set(fields.flatMap(f => f.compliance))];

    if (sensitivityLevels.includes('critical')) {
      recommendations.push('Implement encryption at rest and in transit');
      recommendations.push('Restrict access to authorized personnel only');
      recommendations.push('Enable audit logging for all access');
    }

    if (sensitivityLevels.includes('sensitive')) {
      recommendations.push('Apply data masking for non-production environments');
      recommendations.push('Implement role-based access controls');
    }

    if (complianceRequirements.includes('PII')) {
      recommendations.push('Implement data retention policies');
      recommendations.push('Provide data subject access rights');
    }

    if (complianceRequirements.includes('GDPR')) {
      recommendations.push('Enable right to be forgotten functionality');
      recommendations.push('Implement consent management');
    }

    if (complianceRequirements.includes('PCI')) {
      recommendations.push('Follow PCI DSS compliance requirements');
      recommendations.push('Implement tokenization where possible');
    }

    if (complianceRequirements.includes('HIPAA')) {
      recommendations.push('Apply HIPAA security safeguards');
      recommendations.push('Implement business associate agreements');
    }

    return recommendations;
  }

  private getCategoryDescription(category: string): string {
    const descriptions: { [key: string]: string } = {
      'Personal Identity': 'Fields containing personally identifiable information about individuals',
      'Address': 'Location and address-related information',
      'Financial': 'Monetary amounts, payment methods, and financial data',
      'Health': 'Health and medical information protected under HIPAA',
      'Authentication': 'Passwords, tokens, and other authentication credentials',
      'Communication': 'Messages, comments, and text content',
      'Business': 'Organization and business-related information',
      'System': 'System identifiers and technical metadata',
      'Temporal': 'Date, time, and timestamp information',
      'Unknown': 'Fields that could not be automatically classified'
    };

    return descriptions[category] || 'Miscellaneous fields';
  }

  async analyzeAllCollections(): Promise<{
    classifications: ClassificationResult[];
    semanticGroups: SemanticGroup[];
    summary: any;
  }> {
    const collections = await this.db.listCollections().toArray();
    const allClassifications: ClassificationResult[] = [];

    console.log(`\nAnalyzing ${collections.length} collections...`);

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`\nProcessing collection: ${collectionName}`);

      try {
        const collection = this.db.collection(collectionName);
        const sampleDoc = await collection.findOne();

        if (!sampleDoc) {
          console.log(`  Collection ${collectionName} is empty, skipping...`);
          continue;
        }

        const fields = this.extractFields(sampleDoc);
        console.log(`  Found ${fields.length} fields`);

        for (const field of fields) {
          const classification = this.classifyField(field.name, field.value, collectionName);
          allClassifications.push(classification);
        }
      } catch (error) {
        console.error(`  Error processing collection ${collectionName}:`, error);
      }
    }

    const semanticGroups = this.createSemanticGroups(allClassifications);
    const summary = this.generateSummary(allClassifications, semanticGroups);

    return { classifications: allClassifications, semanticGroups, summary };
  }

  private extractFields(doc: any, prefix: string = ''): { name: string; value: any }[] {
    const fields: { name: string; value: any }[] = [];

    for (const [key, value] of Object.entries(doc)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Nested object - recurse
        fields.push(...this.extractFields(value, fullKey));
      } else {
        // Regular field
        fields.push({ name: fullKey, value });
      }
    }

    return fields;
  }

  private generateSummary(classifications: ClassificationResult[], semanticGroups: SemanticGroup[]): any {
    const totalFields = classifications.length;
    const categoryCounts = semanticGroups.reduce((acc, group) => {
      acc[group.name] = group.fields.length;
      return acc;
    }, {} as { [key: string]: number });

    const sensitivityCounts = classifications.reduce((acc, c) => {
      acc[c.sensitivity] = (acc[c.sensitivity] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const complianceRequirements = [...new Set(classifications.flatMap(c => c.compliance))];

    const highConfidenceFields = classifications.filter(c => c.confidence >= 0.8).length;
    const lowConfidenceFields = classifications.filter(c => c.confidence < 0.5).length;

    const collectionCounts = classifications.reduce((acc, c) => {
      acc[c.collection] = (acc[c.collection] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return {
      totalFields,
      totalCollections: Object.keys(collectionCounts).length,
      categoryCounts,
      sensitivityCounts,
      complianceRequirements,
      confidenceAnalysis: {
        highConfidence: highConfidenceFields,
        lowConfidence: lowConfidenceFields,
        averageConfidence: classifications.reduce((sum, c) => sum + c.confidence, 0) / totalFields
      },
      collectionCounts,
      topRisks: this.identifyTopRisks(classifications),
      recommendations: this.generateGlobalRecommendations(semanticGroups)
    };
  }

  private identifyTopRisks(classifications: ClassificationResult[]): string[] {
    const risks: string[] = [];
    
    const criticalFields = classifications.filter(c => c.sensitivity === 'critical');
    if (criticalFields.length > 0) {
      risks.push(`${criticalFields.length} critical fields require immediate attention`);
    }

    const piiFields = classifications.filter(c => c.compliance.includes('PII'));
    if (piiFields.length > 0) {
      risks.push(`${piiFields.length} PII fields need privacy protection`);
    }

    const pciFields = classifications.filter(c => c.compliance.includes('PCI'));
    if (pciFields.length > 0) {
      risks.push(`${pciFields.length} PCI fields require payment data security`);
    }

    const lowConfidenceFields = classifications.filter(c => c.confidence < 0.5);
    if (lowConfidenceFields.length > 0) {
      risks.push(`${lowConfidenceFields.length} fields need manual classification review`);
    }

    return risks;
  }

  private generateGlobalRecommendations(semanticGroups: SemanticGroup[]): string[] {
    const recommendations = new Set<string>();

    semanticGroups.forEach(group => {
      group.governance.forEach(rec => recommendations.add(rec));
    });

    return Array.from(recommendations);
  }

  async saveResults(results: any): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(__dirname, `../classification-results-${timestamp}.json`);
    const mdPath = path.join(__dirname, `../classification-report-${timestamp}.md`);

    // Save JSON results
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${jsonPath}`);

    // Generate and save Markdown report
    const markdown = this.generateMarkdownReport(results);
    fs.writeFileSync(mdPath, markdown);
    console.log(`Report saved to: ${mdPath}`);
  }

  private generateMarkdownReport(results: any): string {
    const { classifications, semanticGroups, summary } = results;
    
    return `# MongoDB Field Classification Report

Generated on: ${new Date().toISOString()}

## Executive Summary

- **Total Fields Analyzed**: ${summary.totalFields}
- **Collections Processed**: ${summary.totalCollections}
- **Average Confidence**: ${(summary.confidenceAnalysis.averageConfidence * 100).toFixed(1)}%
- **High Risk Fields**: ${summary.sensitivityCounts.critical || 0}

## Risk Assessment

### Top Risks Identified:
${summary.topRisks.map((risk: string) => `- ${risk}`).join('\n')}

### Sensitivity Distribution:
${Object.entries(summary.sensitivityCounts).map(([level, count]) => `- **${level}**: ${count} fields`).join('\n')}

### Compliance Requirements:
${summary.complianceRequirements.map((req: string) => `- ${req}`).join('\n')}

## Semantic Groups Analysis

${semanticGroups.map((group: any) => `
### ${group.name} (${group.fields.length} fields)

**Business Domain**: ${group.businessDomain}

**Description**: ${group.description}

**Fields**:
${group.fields.map((field: any) => `- \`${field.fieldName}\` (${field.collection}) - ${field.subcategory} [${field.sensitivity}] (${(field.confidence * 100).toFixed(0)}%)`).join('\n')}

**Governance Recommendations**:
${group.governance.map((rec: string) => `- ${rec}`).join('\n')}
`).join('\n')}

## Global Recommendations

${summary.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

## Detailed Classifications

${classifications.map((c: any) => `
### ${c.fieldName} (${c.collection})

- **Category**: ${c.category} > ${c.subcategory}
- **Confidence**: ${(c.confidence * 100).toFixed(1)}%
- **Sensitivity**: ${c.sensitivity}
- **Compliance**: ${c.compliance.join(', ') || 'None'}
- **Data Type**: ${c.dataType}
- **Sample Value**: \`${JSON.stringify(c.sampleValue)}\`
- **Matched Patterns**: ${c.patterns.join(', ') || 'None'}
- **Description**: ${c.description}
`).join('\n')}

---
*This report was generated by the Combined Field+Value Classifier*
`;
  }
}

async function main() {
  const classifier = new CombinedFieldValueClassifier();
  
  try {
    console.log('Combined Field+Value Classifier for MongoDB');
    console.log('==========================================');
    
    await classifier.connect();
    const results = await classifier.analyzeAllCollections();
    await classifier.saveResults(results);
    
    console.log('\n📊 Classification Summary:');
    console.log(`✅ Total fields classified: ${results.summary.totalFields}`);
    console.log(`🏢 Collections processed: ${results.summary.totalCollections}`);
    console.log(`📈 Average confidence: ${(results.summary.confidenceAnalysis.averageConfidence * 100).toFixed(1)}%`);
    console.log(`⚠️  High-risk fields: ${results.summary.sensitivityCounts.critical || 0}`);
    console.log(`🛡️  Compliance requirements: ${results.summary.complianceRequirements.join(', ')}`);
    
  } catch (error) {
    console.error('Error running classifier:', error);
  } finally {
    await classifier.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { CombinedFieldValueClassifier };