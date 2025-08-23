import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = 'supabase';

if (!MONGODB_URI) {
  console.error('❌ Missing MONGODB_URI environment variable');
  process.exit(1);
}

interface FieldAnalysis {
  field: string;
  occurrences: number;
  sampleValues: any[];
  dataTypes: Set<string>;
  nullCount: number;
  uniqueValues: number;
}

interface CustomerDataPattern {
  source: string;
  path: string;
  documentsWithData: number;
  fieldsFound: Map<string, FieldAnalysis>;
  sampleDocument?: any;
}

class CustomerDataAnalyzer {
  private client: MongoClient;
  private db: Db;
  private patterns: CustomerDataPattern[] = [];

  constructor() {
    this.client = new MongoClient(MONGODB_URI);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(DATABASE_NAME);
    console.log(`Connected to MongoDB database: ${DATABASE_NAME}`);
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  private analyzeObject(obj: any): Map<string, FieldAnalysis> {
    const fields = new Map<string, FieldAnalysis>();
    
    if (!obj || typeof obj !== 'object') return fields;
    
    for (const [key, value] of Object.entries(obj)) {
      if (!fields.has(key)) {
        fields.set(key, {
          field: key,
          occurrences: 0,
          sampleValues: [],
          dataTypes: new Set(),
          nullCount: 0,
          uniqueValues: 0
        });
      }
      
      const analysis = fields.get(key)!;
      analysis.occurrences++;
      
      if (value === null || value === undefined) {
        analysis.nullCount++;
        analysis.dataTypes.add('null');
      } else {
        analysis.dataTypes.add(typeof value);
        if (analysis.sampleValues.length < 5 && value !== null) {
          analysis.sampleValues.push(value);
        }
      }
    }
    
    return fields;
  }

  async analyzeRegistrations(): Promise<void> {
    console.log('\n=== Analyzing Registration Customer Data ===');
    
    const registrations = this.db.collection('registrations');
    const cursor = registrations.find({});
    
    // Track booking contacts and billing details
    const bookingContactPattern: CustomerDataPattern = {
      source: 'registrations',
      path: 'registrationData.bookingContact',
      documentsWithData: 0,
      fieldsFound: new Map()
    };
    
    const billingDetailsPattern: CustomerDataPattern = {
      source: 'registrations',
      path: 'registrationData.billingDetails',
      documentsWithData: 0,
      fieldsFound: new Map()
    };
    
    let processed = 0;
    const totalDocs = await registrations.countDocuments();
    
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) break;
      
      // Analyze bookingContact
      if (doc.registrationData?.bookingContact) {
        bookingContactPattern.documentsWithData++;
        if (!bookingContactPattern.sampleDocument) {
          bookingContactPattern.sampleDocument = doc.registrationData.bookingContact;
        }
        
        const fields = this.analyzeObject(doc.registrationData.bookingContact);
        fields.forEach((analysis, key) => {
          if (!bookingContactPattern.fieldsFound.has(key)) {
            bookingContactPattern.fieldsFound.set(key, {
              ...analysis,
              occurrences: 0,
              sampleValues: [],
              dataTypes: new Set(),
              nullCount: 0,
              uniqueValues: 0
            });
          }
          
          const existing = bookingContactPattern.fieldsFound.get(key)!;
          existing.occurrences += analysis.occurrences;
          existing.nullCount += analysis.nullCount;
          analysis.dataTypes.forEach(t => existing.dataTypes.add(t));
          analysis.sampleValues.forEach(v => {
            if (existing.sampleValues.length < 5 && !existing.sampleValues.includes(v)) {
              existing.sampleValues.push(v);
            }
          });
        });
      }
      
      // Analyze billingDetails
      if (doc.registrationData?.billingDetails) {
        billingDetailsPattern.documentsWithData++;
        if (!billingDetailsPattern.sampleDocument) {
          billingDetailsPattern.sampleDocument = doc.registrationData.billingDetails;
        }
        
        const fields = this.analyzeObject(doc.registrationData.billingDetails);
        fields.forEach((analysis, key) => {
          if (!billingDetailsPattern.fieldsFound.has(key)) {
            billingDetailsPattern.fieldsFound.set(key, {
              ...analysis,
              occurrences: 0,
              sampleValues: [],
              dataTypes: new Set(),
              nullCount: 0,
              uniqueValues: 0
            });
          }
          
          const existing = billingDetailsPattern.fieldsFound.get(key)!;
          existing.occurrences += analysis.occurrences;
          existing.nullCount += analysis.nullCount;
          analysis.dataTypes.forEach(t => existing.dataTypes.add(t));
          analysis.sampleValues.forEach(v => {
            if (existing.sampleValues.length < 5 && !existing.sampleValues.includes(v)) {
              existing.sampleValues.push(v);
            }
          });
        });
      }
      
      processed++;
      if (processed % 100 === 0) {
        console.log(`  Processed ${processed}/${totalDocs} registrations...`);
      }
    }
    
    await cursor.close();
    
    this.patterns.push(bookingContactPattern, billingDetailsPattern);
    
    console.log(`✅ Analyzed ${processed} registration documents`);
    console.log(`  - Documents with bookingContact: ${bookingContactPattern.documentsWithData}`);
    console.log(`  - Documents with billingDetails: ${billingDetailsPattern.documentsWithData}`);
  }

  async analyzeCustomersCollection(): Promise<void> {
    console.log('\n=== Analyzing Customers Collection ===');
    
    const customers = this.db.collection('customers');
    const cursor = customers.find({});
    
    const customerPattern: CustomerDataPattern = {
      source: 'customers',
      path: 'root',
      documentsWithData: 0,
      fieldsFound: new Map()
    };
    
    let processed = 0;
    const totalDocs = await customers.countDocuments();
    
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) break;
      
      customerPattern.documentsWithData++;
      if (!customerPattern.sampleDocument) {
        customerPattern.sampleDocument = doc;
      }
      
      const fields = this.analyzeObject(doc);
      fields.forEach((analysis, key) => {
        if (key === '_id' || key === '_importedAt' || key === '_sourceSystem') return;
        
        if (!customerPattern.fieldsFound.has(key)) {
          customerPattern.fieldsFound.set(key, {
            ...analysis,
            occurrences: 0,
            sampleValues: [],
            dataTypes: new Set(),
            nullCount: 0,
            uniqueValues: 0
          });
        }
        
        const existing = customerPattern.fieldsFound.get(key)!;
        existing.occurrences += analysis.occurrences;
        existing.nullCount += analysis.nullCount;
        analysis.dataTypes.forEach(t => existing.dataTypes.add(t));
        analysis.sampleValues.forEach(v => {
          if (existing.sampleValues.length < 5 && !existing.sampleValues.includes(v)) {
            existing.sampleValues.push(v);
          }
        });
      });
      
      processed++;
      if (processed % 100 === 0) {
        console.log(`  Processed ${processed}/${totalDocs} customers...`);
      }
    }
    
    await cursor.close();
    
    this.patterns.push(customerPattern);
    
    console.log(`✅ Analyzed ${processed} customer documents`);
  }

  async analyzePaymentCustomerData(): Promise<void> {
    console.log('\n=== Analyzing Payment Customer Data ===');
    
    // Analyze Square Payments
    const squarePayments = this.db.collection('squarePayments');
    const squareCursor = squarePayments.find({});
    
    const squarePattern: CustomerDataPattern = {
      source: 'squarePayments',
      path: 'buyerEmailAddress + cardDetails',
      documentsWithData: 0,
      fieldsFound: new Map()
    };
    
    while (await squareCursor.hasNext()) {
      const doc = await squareCursor.next();
      if (!doc) break;
      
      if (doc.buyerEmailAddress || doc.cardDetails?.card?.cardholderName) {
        squarePattern.documentsWithData++;
        
        // Extract customer-related fields
        const customerData: any = {};
        if (doc.buyerEmailAddress) customerData.email = doc.buyerEmailAddress;
        if (doc.cardDetails?.card?.cardholderName) customerData.cardholderName = doc.cardDetails.card.cardholderName;
        
        if (!squarePattern.sampleDocument) {
          squarePattern.sampleDocument = customerData;
        }
        
        const fields = this.analyzeObject(customerData);
        fields.forEach((analysis, key) => {
          if (!squarePattern.fieldsFound.has(key)) {
            squarePattern.fieldsFound.set(key, analysis);
          } else {
            const existing = squarePattern.fieldsFound.get(key)!;
            existing.occurrences += analysis.occurrences;
            existing.nullCount += analysis.nullCount;
            analysis.dataTypes.forEach(t => existing.dataTypes.add(t));
          }
        });
      }
    }
    
    await squareCursor.close();
    this.patterns.push(squarePattern);
    
    console.log(`✅ Analyzed square payment customer data`);
    console.log(`  - Documents with customer data: ${squarePattern.documentsWithData}`);
  }

  generateReport(): string {
    let report = '# Customer Data Variations Analysis\n\n';
    report += `**Generated**: ${new Date().toISOString()}\n`;
    report += `**Database**: ${DATABASE_NAME}\n\n`;
    
    report += '## Summary\n\n';
    
    // Summary of all patterns found
    for (const pattern of this.patterns) {
      report += `### ${pattern.source} - ${pattern.path}\n`;
      report += `- Documents with data: ${pattern.documentsWithData}\n`;
      report += `- Unique fields found: ${pattern.fieldsFound.size}\n\n`;
    }
    
    report += '## Detailed Field Analysis\n\n';
    
    // Field mapping across sources
    const allFields = new Map<string, string[]>();
    
    for (const pattern of this.patterns) {
      pattern.fieldsFound.forEach((analysis, field) => {
        if (!allFields.has(field)) {
          allFields.set(field, []);
        }
        allFields.get(field)!.push(`${pattern.source}.${pattern.path}`);
      });
    }
    
    report += '### Field Occurrence Across Sources\n\n';
    report += '| Field | Sources | Data Types | Sample Values |\n';
    report += '|-------|---------|------------|---------------|\n';
    
    const sortedFields = Array.from(allFields.entries())
      .sort((a, b) => b[1].length - a[1].length);
    
    for (const [field, sources] of sortedFields) {
      const dataTypes = new Set<string>();
      const sampleValues = new Set<any>();
      
      for (const pattern of this.patterns) {
        const analysis = pattern.fieldsFound.get(field);
        if (analysis) {
          analysis.dataTypes.forEach(t => dataTypes.add(t));
          analysis.sampleValues.forEach(v => {
            if (sampleValues.size < 3) {
              sampleValues.add(JSON.stringify(v).substring(0, 30));
            }
          });
        }
      }
      
      report += `| ${field} | ${sources.length} sources | ${Array.from(dataTypes).join(', ')} | ${Array.from(sampleValues).join(', ')} |\n`;
    }
    
    report += '\n## Proposed Unified Customer Schema\n\n';
    report += '```typescript\n';
    report += 'interface UnifiedCustomer {\n';
    report += '  // Identity\n';
    report += '  customerId: string;           // Primary key\n';
    report += '  email: string;                // Required, unique\n';
    report += '  \n';
    report += '  // Personal Information\n';
    report += '  firstName?: string;\n';
    report += '  lastName?: string;\n';
    report += '  title?: string;\n';
    report += '  suffix?: string;\n';
    report += '  \n';
    report += '  // Contact Information\n';
    report += '  phone?: string;\n';
    report += '  mobileNumber?: string;\n';
    report += '  contactPreference?: string;\n';
    report += '  \n';
    report += '  // Business Information\n';
    report += '  businessName?: string;\n';
    report += '  organisationId?: string;\n';
    report += '  organisationName?: string;\n';
    report += '  \n';
    report += '  // Address Information\n';
    report += '  billingAddress?: {\n';
    report += '    streetAddress: string;\n';
    report += '    city: string;\n';
    report += '    state?: string;\n';
    report += '    postalCode: string;\n';
    report += '    country: string;\n';
    report += '  };\n';
    report += '  \n';
    report += '  // Masonic Information\n';
    report += '  lodgeId?: string;\n';
    report += '  lodgeName?: string;\n';
    report += '  lodgeNumber?: string;\n';
    report += '  grandLodgeId?: string;\n';
    report += '  membershipId?: string;\n';
    report += '  \n';
    report += '  // Metadata\n';
    report += '  createdAt: Date;\n';
    report += '  updatedAt: Date;\n';
    report += '  source: string;               // Where this customer came from\n';
    report += '  sourceIds: {                  // References to original records\n';
    report += '    [key: string]: string;\n';
    report += '  };\n';
    report += '}\n';
    report += '```\n\n';
    
    report += '## Field Mapping Strategy\n\n';
    
    // Show sample documents for comparison
    report += '### Sample Documents Comparison\n\n';
    
    for (const pattern of this.patterns) {
      if (pattern.sampleDocument) {
        report += `#### ${pattern.source} - ${pattern.path}\n`;
        report += '```json\n';
        report += JSON.stringify(pattern.sampleDocument, null, 2);
        report += '\n```\n\n';
      }
    }
    
    report += '## Migration Recommendations\n\n';
    report += '1. **Create unified customers collection** with standardized schema\n';
    report += '2. **Map fields** from various sources to unified schema\n';
    report += '3. **Deduplicate** based on email address\n';
    report += '4. **Maintain references** to original source documents\n';
    report += '5. **Validate and clean** data during migration\n';
    
    return report;
  }

  async run(): Promise<void> {
    try {
      await this.connect();
      
      await this.analyzeRegistrations();
      await this.analyzeCustomersCollection();
      await this.analyzePaymentCustomerData();
      
      const report = this.generateReport();
      
      // Save report
      const reportPath = path.join(__dirname, '../docs/CUSTOMER-VARIATIONS-ANALYSIS.md');
      fs.writeFileSync(reportPath, report);
      
      console.log('\n✅ Analysis complete!');
      console.log(`📄 Report saved to: ${reportPath}`);
      
      // Print summary
      console.log('\n=== SUMMARY ===');
      for (const pattern of this.patterns) {
        console.log(`${pattern.source}.${pattern.path}: ${pattern.documentsWithData} docs, ${pattern.fieldsFound.size} fields`);
      }
      
    } catch (error) {
      console.error('Error during analysis:', error);
    } finally {
      await this.disconnect();
    }
  }
}

// Run the analyzer
async function main() {
  console.log('Starting Customer Data Variations Analysis...');
  console.log('Analyzing bookingContact, billingDetails, and customer data across collections...\n');
  
  const analyzer = new CustomerDataAnalyzer();
  await analyzer.run();
}

main().catch(console.error);

export { CustomerDataAnalyzer };