import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

interface ErrorPayment {
  _id: any;
  originalId: string;
  paymentId: string;
  errorType: string;
  errorMessage: string;
  originalData: {
    id: string;
    status: string;
    payment_intent_id?: string;
    amountMoney?: {
      amount: number;
      currency: string;
    };
    totalMoney?: {
      amount: number;
      currency: string;
    };
    referenceId?: string;
    note?: string;
    [key: string]: any;
  };
  metadata: {
    provider: string;
    syncRunId: string;
    source: string;
  };
}

interface Registration {
  _id: any;
  paymentId?: string;
  payment_intent_id?: string;
  referenceId?: string;
  orderId?: string;
  [key: string]: any;
}

interface MatchAnalysis {
  errorPayment: ErrorPayment;
  testDbRegistrations: Registration[];
  matchType: string;
  inImportRegistrations: boolean;
  inRegistrations: boolean;
  importRegistrationIds: any[];
  registrationIds: any[];
}

interface ReportData {
  totalSuccessfulPayments: number;
  matchesInTestDb: number;
  matchesInImportRegistrations: number;
  matchesInRegistrations: number;
  matchAnalyses: MatchAnalysis[];
  discrepancies: Array<{
    type: string;
    description: string;
    paymentId: string;
    details: any;
  }>;
}

async function checkSuccessfulPaymentMatches(): Promise<void> {
  console.log('🔍 Checking successful payments against registrations in test database and lodgetix collections...\n');

  // Database connection strings from .env.explorer
  const baseConnectionString = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net';
  const lodgetixConnectionString = `${baseConnectionString}/lodgetix?retryWrites=true&w=majority&appName=LodgeTix`;
  const testConnectionString = `${baseConnectionString}/test?retryWrites=true&w=majority&appName=LodgeTix`;

  let lodgetixClient: MongoClient | null = null;
  let testClient: MongoClient | null = null;

  try {
    // Connect to both databases
    console.log('📡 Connecting to databases...');
    lodgetixClient = new MongoClient(lodgetixConnectionString);
    testClient = new MongoClient(testConnectionString);
    
    await lodgetixClient.connect();
    await testClient.connect();
    
    console.log('✅ Connected to both databases\n');

    const lodgetixDb = lodgetixClient.db('lodgetix');
    const testDb = testClient.db('test');

    // Step 1: Get all successful payments from error_payments collection
    console.log('1️⃣ Finding successful payments in error_payments collection...');
    
    const errorPaymentsCollection = lodgetixDb.collection('error_payments');
    const successfulPayments = await errorPaymentsCollection.find({
      'originalData.status': 'COMPLETED'
    }).toArray() as ErrorPayment[];

    console.log(`   Found ${successfulPayments.length} successful payments with status 'COMPLETED'\n`);

    if (successfulPayments.length === 0) {
      console.log('🚫 No successful payments found in error_payments collection');
      return;
    }

    // Initialize report data
    const reportData: ReportData = {
      totalSuccessfulPayments: successfulPayments.length,
      matchesInTestDb: 0,
      matchesInImportRegistrations: 0,
      matchesInRegistrations: 0,
      matchAnalyses: [],
      discrepancies: []
    };

    // Step 2: For each payment, check for matches in test database registrations
    console.log('2️⃣ Searching for matching registrations in test database...');
    
    const testRegistrationsCollection = testDb.collection('registrations');
    const importRegistrationsCollection = lodgetixDb.collection('import_registrations');
    const registrationsCollection = lodgetixDb.collection('registrations');

    let processedCount = 0;
    for (const payment of successfulPayments) {
      processedCount++;
      console.log(`   Processing payment ${processedCount}/${successfulPayments.length}: ${payment.paymentId}`);

      const { paymentId, originalData } = payment;
      let testDbMatches: Registration[] = [];
      let matchTypes: string[] = [];

      // Search test database by paymentId
      if (paymentId) {
        const paymentIdMatches = await testRegistrationsCollection.find({
          paymentId: paymentId
        }).toArray() as Registration[];
        
        if (paymentIdMatches.length > 0) {
          testDbMatches = testDbMatches.concat(paymentIdMatches);
          matchTypes.push('paymentId');
        }
      }

      // Search test database by payment_intent_id (for Stripe payments)
      if (originalData?.payment_intent_id) {
        const intentIdMatches = await testRegistrationsCollection.find({
          payment_intent_id: originalData.payment_intent_id
        }).toArray() as Registration[];
        
        if (intentIdMatches.length > 0) {
          testDbMatches = testDbMatches.concat(intentIdMatches);
          matchTypes.push('payment_intent_id');
        }
      }

      // Search test database by originalData.id
      if (originalData?.id) {
        const originalIdMatches = await testRegistrationsCollection.find({
          paymentId: originalData.id
        }).toArray() as Registration[];
        
        if (originalIdMatches.length > 0) {
          testDbMatches = testDbMatches.concat(originalIdMatches);
          matchTypes.push('originalData.id');
        }

        // Also search by payment_intent_id field with originalData.id
        const intentMatches = await testRegistrationsCollection.find({
          payment_intent_id: originalData.id
        }).toArray() as Registration[];
        
        if (intentMatches.length > 0) {
          testDbMatches = testDbMatches.concat(intentMatches);
          matchTypes.push('originalData.id-as-intent');
        }
      }

      // Remove duplicates based on _id
      const uniqueTestMatches = testDbMatches.filter((match, index, self) => 
        index === self.findIndex(m => m._id.toString() === match._id.toString())
      );

      if (uniqueTestMatches.length > 0) {
        reportData.matchesInTestDb++;

        // Step 3: For matches, check if they exist in import_registrations and registrations collections
        console.log(`     Found ${uniqueTestMatches.length} match(es) in test database, checking lodgetix collections...`);

        let importRegistrationIds: any[] = [];
        let registrationIds: any[] = [];

        // Check each test db registration in lodgetix collections
        for (const testReg of uniqueTestMatches) {
          // Check in import_registrations by _id
          const importMatch = await importRegistrationsCollection.findOne({ _id: testReg._id });
          if (importMatch) {
            importRegistrationIds.push(importMatch._id);
          }

          // Check in registrations by _id
          const regMatch = await registrationsCollection.findOne({ _id: testReg._id });
          if (regMatch) {
            registrationIds.push(regMatch._id);
          }

          // Also check by paymentId fields
          if (testReg.paymentId) {
            const importPaymentMatch = await importRegistrationsCollection.findOne({ paymentId: testReg.paymentId });
            if (importPaymentMatch && !importRegistrationIds.some(id => id.toString() === importPaymentMatch._id.toString())) {
              importRegistrationIds.push(importPaymentMatch._id);
            }

            const regPaymentMatch = await registrationsCollection.findOne({ paymentId: testReg.paymentId });
            if (regPaymentMatch && !registrationIds.some(id => id.toString() === regPaymentMatch._id.toString())) {
              registrationIds.push(regPaymentMatch._id);
            }
          }

          // Check by payment_intent_id if available
          if (testReg.payment_intent_id) {
            const importIntentMatch = await importRegistrationsCollection.findOne({ payment_intent_id: testReg.payment_intent_id });
            if (importIntentMatch && !importRegistrationIds.some(id => id.toString() === importIntentMatch._id.toString())) {
              importRegistrationIds.push(importIntentMatch._id);
            }

            const regIntentMatch = await registrationsCollection.findOne({ payment_intent_id: testReg.payment_intent_id });
            if (regIntentMatch && !registrationIds.some(id => id.toString() === regIntentMatch._id.toString())) {
              registrationIds.push(regIntentMatch._id);
            }
          }
        }

        const inImportRegistrations = importRegistrationIds.length > 0;
        const inRegistrations = registrationIds.length > 0;

        if (inImportRegistrations) reportData.matchesInImportRegistrations++;
        if (inRegistrations) reportData.matchesInRegistrations++;

        const matchAnalysis: MatchAnalysis = {
          errorPayment: payment,
          testDbRegistrations: uniqueTestMatches,
          matchType: matchTypes.join(', '),
          inImportRegistrations,
          inRegistrations,
          importRegistrationIds,
          registrationIds
        };

        reportData.matchAnalyses.push(matchAnalysis);

        // Check for discrepancies
        if (inImportRegistrations && !inRegistrations) {
          reportData.discrepancies.push({
            type: 'In import_registrations but not in registrations',
            description: 'Registration exists in import_registrations but not in final registrations collection',
            paymentId: payment.paymentId,
            details: {
              testDbCount: uniqueTestMatches.length,
              importRegistrationIds,
              registrationIds
            }
          });
        }

        if (!inImportRegistrations && inRegistrations) {
          reportData.discrepancies.push({
            type: 'In registrations but not in import_registrations',
            description: 'Registration exists in final registrations but not in import_registrations collection',
            paymentId: payment.paymentId,
            details: {
              testDbCount: uniqueTestMatches.length,
              importRegistrationIds,
              registrationIds
            }
          });
        }

        if (!inImportRegistrations && !inRegistrations) {
          reportData.discrepancies.push({
            type: 'Missing from both lodgetix collections',
            description: 'Registration found in test database but missing from both lodgetix collections',
            paymentId: payment.paymentId,
            details: {
              testDbCount: uniqueTestMatches.length,
              testDbRegistrationIds: uniqueTestMatches.map(r => r._id)
            }
          });
        }
      }
    }

    // Step 4: Generate comprehensive report
    console.log('\n📊 COMPREHENSIVE ANALYSIS REPORT');
    console.log('='.repeat(60));
    console.log(`Total successful payments in error_payments: ${reportData.totalSuccessfulPayments}`);
    console.log(`Payments with matches in test database: ${reportData.matchesInTestDb}`);
    console.log(`  - Also found in import_registrations: ${reportData.matchesInImportRegistrations}`);
    console.log(`  - Also found in registrations: ${reportData.matchesInRegistrations}`);
    console.log(`Payments with no matches in test database: ${reportData.totalSuccessfulPayments - reportData.matchesInTestDb}`);

    if (reportData.matchesInTestDb > 0) {
      const testDbMatchRate = ((reportData.matchesInTestDb / reportData.totalSuccessfulPayments) * 100).toFixed(1);
      const importMatchRate = ((reportData.matchesInImportRegistrations / reportData.matchesInTestDb) * 100).toFixed(1);
      const finalMatchRate = ((reportData.matchesInRegistrations / reportData.matchesInTestDb) * 100).toFixed(1);
      
      console.log(`\n📈 SUCCESS RATES:`);
      console.log(`Test database match rate: ${testDbMatchRate}%`);
      console.log(`Import registrations match rate: ${importMatchRate}% (of test db matches)`);
      console.log(`Final registrations match rate: ${finalMatchRate}% (of test db matches)`);
    }

    // Show detailed match analysis
    if (reportData.matchAnalyses.length > 0) {
      console.log('\n🎯 DETAILED MATCH ANALYSIS:');
      console.log('-'.repeat(40));
      
      reportData.matchAnalyses.forEach((analysis, index) => {
        const payment = analysis.errorPayment;
        const amount = payment.originalData.amountMoney?.amount || payment.originalData.totalMoney?.amount || 0;
        const currency = payment.originalData.amountMoney?.currency || payment.originalData.totalMoney?.currency || 'AUD';
        
        console.log(`\n${index + 1}. Payment ID: ${payment.paymentId}`);
        console.log(`   Provider: ${payment.metadata?.provider || 'unknown'}`);
        console.log(`   Amount: $${(amount / 100).toFixed(2)} ${currency}`);
        console.log(`   Match Type: ${analysis.matchType}`);
        console.log(`   Test DB Registrations: ${analysis.testDbRegistrations.length}`);
        console.log(`   In import_registrations: ${analysis.inImportRegistrations ? 'YES' : 'NO'} (${analysis.importRegistrationIds.length} matches)`);
        console.log(`   In registrations: ${analysis.inRegistrations ? 'YES' : 'NO'} (${analysis.registrationIds.length} matches)`);
      });
    }

    // Show discrepancies
    if (reportData.discrepancies.length > 0) {
      console.log('\n⚠️  DISCREPANCIES FOUND:');
      console.log('-'.repeat(30));
      
      const discrepancyTypes = reportData.discrepancies.reduce((acc, disc) => {
        acc[disc.type] = (acc[disc.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('\nDiscrepancy Summary:');
      Object.entries(discrepancyTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count} cases`);
      });

      console.log('\nDetailed Discrepancies:');
      reportData.discrepancies.forEach((disc, index) => {
        console.log(`\n${index + 1}. ${disc.type}`);
        console.log(`   Payment ID: ${disc.paymentId}`);
        console.log(`   Description: ${disc.description}`);
        console.log(`   Details:`, JSON.stringify(disc.details, null, 4));
      });
    } else {
      console.log('\n✅ No discrepancies found - all matched payments are consistently present across collections');
    }

    // Summary statistics
    console.log('\n📊 FINAL SUMMARY:');
    console.log('-'.repeat(20));
    console.log(`• Total successful payments analyzed: ${reportData.totalSuccessfulPayments}`);
    console.log(`• Successfully matched to test database: ${reportData.matchesInTestDb} (${((reportData.matchesInTestDb / reportData.totalSuccessfulPayments) * 100).toFixed(1)}%)`);
    console.log(`• Present in import_registrations: ${reportData.matchesInImportRegistrations}`);
    console.log(`• Present in final registrations: ${reportData.matchesInRegistrations}`);
    console.log(`• Data consistency issues: ${reportData.discrepancies.length}`);

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    // Close connections
    if (lodgetixClient) {
      await lodgetixClient.close();
      console.log('\n🔌 Disconnected from lodgetix database');
    }
    if (testClient) {
      await testClient.close();
      console.log('🔌 Disconnected from test database');
    }
  }
}

// Run the analysis
checkSuccessfulPaymentMatches()
  .then(() => {
    console.log('\n✅ Analysis completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Analysis failed:', error);
    process.exit(1);
  });

export { checkSuccessfulPaymentMatches };