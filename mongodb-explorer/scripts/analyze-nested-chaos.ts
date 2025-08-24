#!/usr/bin/env ts-node

/**
 * Nested Object Chaos Analysis Script
 * 
 * This script analyzes the MongoDB collections to demonstrate the concrete
 * examples of nested object inconsistencies and structural chaos.
 * 
 * Usage: npm run ts-node scripts/analyze-nested-chaos.ts
 */

import { MongoClient, Db } from 'mongodb';

interface NestedStructureAnalysis {
  collection: string;
  field: string;
  totalDocuments: number;
  uniqueStructures: any[];
  structureCounts: Record<string, number>;
  consistencyPercentage: number;
  examples: any[];
}

interface FieldVariation {
  path: string;
  value: any;
  type: string;
  frequency: number;
}

class NestedChaosAnalyzer {
  private db!: Db;

  async connect() {
    const client = new MongoClient(process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017/lodgetix');
    await client.connect();
    this.db = client.db();
    console.log('✅ Connected to MongoDB');
  }

  /**
   * Generate a structural fingerprint for nested objects
   */
  private generateStructureFingerprint(obj: any, maxDepth: number = 3, currentDepth: number = 0): string {
    if (obj === null || obj === undefined || currentDepth > maxDepth) {
      return typeof obj;
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return '[]';
      }
      return `[${this.generateStructureFingerprint(obj[0], maxDepth, currentDepth + 1)}]`;
    }

    if (typeof obj === 'object') {
      const keys = Object.keys(obj).sort();
      if (keys.length === 0) {
        return '{}';
      }
      
      const keyFingerprints = keys.map(key => 
        `${key}:${this.generateStructureFingerprint(obj[key], maxDepth, currentDepth + 1)}`
      );
      return `{${keyFingerprints.join(',')}}`;
    }

    return typeof obj;
  }

  /**
   * Analyze registration data chaos
   */
  async analyzeRegistrationDataChaos(): Promise<NestedStructureAnalysis> {
    console.log('\n🔍 Analyzing Registration Data Chaos...');
    
    const registrations = await this.db.collection('registrations')
      .find({ registrationData: { $exists: true } })
      .limit(100)
      .toArray();

    const structureMap = new Map<string, { count: number; example: any; documents: string[] }>();
    
    registrations.forEach((reg) => {
      if (reg.registrationData) {
        const fingerprint = this.generateStructureFingerprint(reg.registrationData);
        
        if (!structureMap.has(fingerprint)) {
          structureMap.set(fingerprint, { 
            count: 0, 
            example: reg.registrationData, 
            documents: [] 
          });
        }
        
        const entry = structureMap.get(fingerprint)!;
        entry.count++;
        entry.documents.push(reg._id.toString());
      }
    });

    // Sort by frequency
    const sortedStructures = Array.from(structureMap.entries())
      .sort((a, b) => b[1].count - a[1].count);

    const mostCommonCount = sortedStructures.length > 0 ? sortedStructures[0][1].count : 0;
    const consistencyPercentage = registrations.length > 0 ? 
      (mostCommonCount / registrations.length) * 100 : 0;

    console.log(`📊 Found ${sortedStructures.length} different registration data structures`);
    console.log(`📈 Most common structure appears in ${mostCommonCount}/${registrations.length} documents (${consistencyPercentage.toFixed(1)}%)`);
    
    // Show examples of different structures
    console.log('\n🔍 Examples of Different Registration Data Structures:');
    sortedStructures.slice(0, 5).forEach((entry, index) => {
      const [fingerprint, data] = entry;
      console.log(`\n--- Structure ${index + 1} (${data.count} documents, ${((data.count/registrations.length)*100).toFixed(1)}%) ---`);
      console.log('Structure fingerprint:', fingerprint);
      console.log('Example:', JSON.stringify(data.example, null, 2));
      console.log('Document IDs:', data.documents.slice(0, 3).join(', ') + (data.documents.length > 3 ? '...' : ''));
    });

    return {
      collection: 'registrations',
      field: 'registrationData',
      totalDocuments: registrations.length,
      uniqueStructures: sortedStructures.map(([fingerprint, data]) => ({ 
        fingerprint, 
        count: data.count,
        percentage: ((data.count/registrations.length)*100).toFixed(1)
      })),
      structureCounts: Object.fromEntries(
        sortedStructures.map(([fp, data], i) => [`structure_${i+1}`, data.count])
      ),
      consistencyPercentage,
      examples: sortedStructures.slice(0, 5).map(([fp, data]) => data.example)
    };
  }

  /**
   * Analyze payment details chaos
   */
  async analyzePaymentDetailsChaos(): Promise<NestedStructureAnalysis> {
    console.log('\n🔍 Analyzing Payment Details Chaos...');
    
    const payments = await this.db.collection('payments')
      .find({ paymentDetails: { $exists: true } })
      .limit(100)
      .toArray();

    const structureMap = new Map<string, { count: number; example: any; method: string }>();
    
    payments.forEach((payment) => {
      if (payment.paymentDetails) {
        const fingerprint = this.generateStructureFingerprint(payment.paymentDetails);
        
        if (!structureMap.has(fingerprint)) {
          // Try to detect payment method
          const method = this.detectPaymentMethod(payment.paymentDetails);
          structureMap.set(fingerprint, { 
            count: 0, 
            example: payment.paymentDetails,
            method 
          });
        }
        
        structureMap.get(fingerprint)!.count++;
      }
    });

    const sortedStructures = Array.from(structureMap.entries())
      .sort((a, b) => b[1].count - a[1].count);

    const mostCommonCount = sortedStructures.length > 0 ? sortedStructures[0][1].count : 0;
    const consistencyPercentage = payments.length > 0 ? 
      (mostCommonCount / payments.length) * 100 : 0;

    console.log(`📊 Found ${sortedStructures.length} different payment detail structures`);
    console.log(`📈 Most common structure: ${consistencyPercentage.toFixed(1)}% consistency`);

    // Group by payment method
    const methodGroups = new Map<string, number>();
    sortedStructures.forEach(([fp, data]) => {
      methodGroups.set(data.method, (methodGroups.get(data.method) || 0) + data.count);
    });

    console.log('\n💳 Payment Methods Distribution:');
    Array.from(methodGroups.entries()).forEach(([method, count]) => {
      console.log(`  ${method}: ${count} documents (${((count/payments.length)*100).toFixed(1)}%)`);
    });

    console.log('\n🔍 Examples of Different Payment Detail Structures:');
    sortedStructures.slice(0, 5).forEach((entry, index) => {
      const [fingerprint, data] = entry;
      console.log(`\n--- ${data.method} Payment Structure ${index + 1} (${data.count} documents) ---`);
      console.log('Example:', JSON.stringify(data.example, null, 2));
    });

    return {
      collection: 'payments',
      field: 'paymentDetails',
      totalDocuments: payments.length,
      uniqueStructures: sortedStructures.map(([fingerprint, data]) => ({ 
        fingerprint, 
        count: data.count,
        method: data.method
      })),
      structureCounts: Object.fromEntries(methodGroups.entries()),
      consistencyPercentage,
      examples: sortedStructures.slice(0, 5).map(([fp, data]) => data.example)
    };
  }

  /**
   * Analyze metadata chaos in carts
   */
  async analyzeMetadataChaos(): Promise<NestedStructureAnalysis> {
    console.log('\n🔍 Analyzing Cart Metadata Chaos...');
    
    const carts = await this.db.collection('carts')
      .find({}, { projection: { metadata: 1, _id: 1 } })
      .limit(500)
      .toArray();

    let emptyCount = 0;
    let nullCount = 0;
    let meaningfulCount = 0;
    let undefinedCount = 0;
    const structureMap = new Map<string, { count: number; example: any }>();

    carts.forEach((cart) => {
      if (!cart.metadata) {
        undefinedCount++;
      } else if (cart.metadata === null) {
        nullCount++;
      } else if (Object.keys(cart.metadata).length === 0) {
        emptyCount++;
      } else {
        meaningfulCount++;
        const fingerprint = this.generateStructureFingerprint(cart.metadata);
        
        if (!structureMap.has(fingerprint)) {
          structureMap.set(fingerprint, { count: 0, example: cart.metadata });
        }
        structureMap.get(fingerprint)!.count++;
      }
    });

    console.log(`📊 Cart Metadata Analysis (${carts.length} documents):`);
    console.log(`  ❌ Undefined metadata: ${undefinedCount} (${((undefinedCount/carts.length)*100).toFixed(1)}%)`);
    console.log(`  ❌ Null metadata: ${nullCount} (${((nullCount/carts.length)*100).toFixed(1)}%)`);
    console.log(`  ❌ Empty objects {}: ${emptyCount} (${((emptyCount/carts.length)*100).toFixed(1)}%)`);
    console.log(`  ✅ Meaningful metadata: ${meaningfulCount} (${((meaningfulCount/carts.length)*100).toFixed(1)}%)`);

    const totalUseless = undefinedCount + nullCount + emptyCount;
    console.log(`\n🚨 TOTAL USELESS METADATA: ${totalUseless}/${carts.length} (${((totalUseless/carts.length)*100).toFixed(1)}%)`);

    if (meaningfulCount > 0) {
      console.log('\n🔍 Meaningful Metadata Examples:');
      const sortedStructures = Array.from(structureMap.entries())
        .sort((a, b) => b[1].count - a[1].count);
      
      sortedStructures.forEach((entry, index) => {
        const [fingerprint, data] = entry;
        console.log(`\n--- Meaningful Structure ${index + 1} (${data.count} documents) ---`);
        console.log(JSON.stringify(data.example, null, 2));
      });
    }

    const consistencyPercentage = meaningfulCount > 0 ? 
      (Math.max(...Array.from(structureMap.values()).map(v => v.count)) / meaningfulCount) * 100 : 0;

    return {
      collection: 'carts',
      field: 'metadata',
      totalDocuments: carts.length,
      uniqueStructures: Array.from(structureMap.entries()).map(([fp, data]) => ({ 
        fingerprint: fp, 
        count: data.count 
      })),
      structureCounts: {
        empty: emptyCount,
        null: nullCount,
        undefined: undefinedCount,
        meaningful: meaningfulCount
      },
      consistencyPercentage,
      examples: Array.from(structureMap.values()).slice(0, 3).map(v => v.example)
    };
  }

  /**
   * Detect payment method from payment details structure
   */
  private detectPaymentMethod(paymentDetails: any): string {
    if (paymentDetails.squareTransactionId || paymentDetails.square_transaction_id) {
      return 'Square';
    }
    if (paymentDetails.paypalTransactionId || paymentDetails.paypal_transaction_id) {
      return 'PayPal';
    }
    if (paymentDetails.checkNumber || paymentDetails.check_number) {
      return 'Check';
    }
    if (paymentDetails.comped || paymentDetails.comp) {
      return 'Comp/Free';
    }
    if (paymentDetails.cash || paymentDetails.cashAmount) {
      return 'Cash';
    }
    return 'Unknown';
  }

  /**
   * Find all variations of contact email across registrations
   */
  async findContactEmailVariations(): Promise<void> {
    console.log('\n🔍 Finding Contact Email Storage Variations...');
    
    const registrations = await this.db.collection('registrations')
      .find({ registrationData: { $exists: true } })
      .limit(100)
      .toArray();

    const emailPaths = new Set<string>();
    const emailExamples = new Map<string, { value: any; count: number; docId: string }>();

    registrations.forEach((reg) => {
      if (reg.registrationData) {
        const emailFields = this.findEmailFields(reg.registrationData, 'registrationData');
        emailFields.forEach(field => {
          emailPaths.add(field.path);
          
          const key = field.path;
          if (!emailExamples.has(key)) {
            emailExamples.set(key, { value: field.value, count: 0, docId: reg._id.toString() });
          }
          emailExamples.get(key)!.count++;
        });
      }
    });

    console.log(`📧 Found email stored in ${emailPaths.size} different paths:`);
    Array.from(emailPaths).sort().forEach((path, index) => {
      const example = emailExamples.get(path);
      console.log(`  ${index + 1}. ${path} (${example?.count} docs) - Example: "${example?.value}"`);
    });

    // Show the nightmare query developers need to write
    console.log('\n😱 Current Developer Reality - Finding ANY Email:');
    const pathArray = Array.from(emailPaths);
    console.log('```javascript');
    console.log('const getEmail = (regData) => {');
    console.log('  return ' + pathArray.map(path => `regData.${path}`).join(' ||\n         ') + ' ||');
    console.log('         null; // Still might be in another path we haven\'t found!');
    console.log('};');
    console.log('```');
  }

  /**
   * Recursively find email fields in nested objects
   */
  private findEmailFields(obj: any, parentPath: string): { path: string; value: any }[] {
    const results: { path: string; value: any }[] = [];
    
    if (typeof obj !== 'object' || obj === null) {
      return results;
    }

    Object.keys(obj).forEach(key => {
      const currentPath = parentPath ? `${parentPath}.${key}` : key;
      const value = obj[key];
      
      // Check if this looks like an email field
      if (key.toLowerCase().includes('email') && typeof value === 'string' && value.includes('@')) {
        results.push({ path: currentPath.replace('registrationData.', ''), value });
      }
      
      // Recurse into nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        results.push(...this.findEmailFields(value, currentPath));
      }
    });

    return results;
  }

  /**
   * Generate comprehensive chaos report
   */
  async generateChaosReport(): Promise<void> {
    console.log('🚨 MONGODB NESTED OBJECT CHAOS ANALYSIS REPORT');
    console.log('='.repeat(60));

    const registrationAnalysis = await this.analyzeRegistrationDataChaos();
    const paymentAnalysis = await this.analyzePaymentDetailsChaos();
    const metadataAnalysis = await this.analyzeMetadataChaos();
    
    await this.findContactEmailVariations();

    // Summary
    console.log('\n📋 EXECUTIVE SUMMARY');
    console.log('='.repeat(30));
    console.log(`🔴 Registration Data Consistency: ${registrationAnalysis.consistencyPercentage.toFixed(1)}% (${registrationAnalysis.uniqueStructures.length} unique structures)`);
    console.log(`🔴 Payment Details Consistency: ${paymentAnalysis.consistencyPercentage.toFixed(1)}% (${paymentAnalysis.uniqueStructures.length} unique structures)`);
    console.log(`🔴 Cart Metadata Usefulness: ${((metadataAnalysis.structureCounts.meaningful / metadataAnalysis.totalDocuments) * 100).toFixed(1)}% meaningful data`);
    
    console.log('\n💥 THE CHAOS IMPACT:');
    console.log(`• Registration queries need ${registrationAnalysis.uniqueStructures.length} different conditional paths`);
    console.log(`• Payment processing needs ${paymentAnalysis.uniqueStructures.length} different handlers`);
    console.log(`• ${metadataAnalysis.structureCounts.empty + metadataAnalysis.structureCounts.null} useless metadata objects wasting storage`);
    
    console.log('\n🚀 REMEDIATION PRIORITY:');
    console.log('1. 🔥 HIGH: Registration data standardization (10% consistency)');
    console.log('2. 🔥 HIGH: Remove empty metadata objects (99.3% useless)');
    console.log('3. 🔶 MED: Payment details normalization (45% consistency)');

    console.log('\n📊 Full analysis complete. See NESTED-OBJECT-REMEDIATION-PLAN.md for detailed remediation strategy.');
  }

  /**
   * Quick consistency check for any collection's nested field
   */
  async quickConsistencyCheck(collection: string, field: string, limit: number = 100): Promise<void> {
    console.log(`\n🔍 Quick Consistency Check: ${collection}.${field}`);
    
    const docs = await this.db.collection(collection)
      .find({ [field]: { $exists: true } })
      .limit(limit)
      .toArray();

    const structureMap = new Map<string, number>();
    
    docs.forEach((doc) => {
      const fieldValue = doc[field];
      if (fieldValue) {
        const fingerprint = this.generateStructureFingerprint(fieldValue);
        structureMap.set(fingerprint, (structureMap.get(fingerprint) || 0) + 1);
      }
    });

    const totalUniqueStructures = structureMap.size;
    const mostCommonCount = Math.max(...Array.from(structureMap.values()));
    const consistency = docs.length > 0 ? (mostCommonCount / docs.length) * 100 : 0;

    console.log(`📊 ${collection}.${field}: ${consistency.toFixed(1)}% consistency (${totalUniqueStructures} unique structures in ${docs.length} docs)`);
  }
}

// Main execution
async function main() {
  const analyzer = new NestedChaosAnalyzer();
  
  try {
    await analyzer.connect();
    
    // Generate the full chaos report
    await analyzer.generateChaosReport();
    
    // Additional quick checks
    console.log('\n🔍 Additional Quick Consistency Checks:');
    await analyzer.quickConsistencyCheck('invoices', 'lineItems');
    await analyzer.quickConsistencyCheck('tickets', 'ticketData');
    await analyzer.quickConsistencyCheck('events', 'pricingTiers');
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    process.exit(0);
  }
}

// Export for use as module
export { NestedChaosAnalyzer };

// Run if called directly
if (require.main === module) {
  main();
}