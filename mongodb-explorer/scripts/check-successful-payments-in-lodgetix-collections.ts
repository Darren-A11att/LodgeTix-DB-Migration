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
    orderId?: string;
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

interface MatchResult {
  errorPayment: ErrorPayment;
  importMatches: Registration[];
  finalMatches: Registration[];
  matchTypes: {
    import: string[];
    final: string[];
  };
}

async function checkSuccessfulPaymentsInLodgetixCollections(): Promise<void> {
  console.log('🔍 Checking successful payments against lodgetix import_registrations and registrations collections...\n');

  // Database connection string
  const lodgetixConnectionString = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix';

  let lodgetixClient: MongoClient | null = null;

  try {
    // Connect to database
    console.log('📡 Connecting to lodgetix database...');
    lodgetixClient = new MongoClient(lodgetixConnectionString);
    await lodgetixClient.connect();
    console.log('✅ Connected to lodgetix database\n');

    const lodgetixDb = lodgetixClient.db('lodgetix');

    // Step 1: Get all successful payments from error_payments collection
    console.log('1️⃣ Finding successful payments in error_payments collection...');
    
    const errorPaymentsCollection = lodgetixDb.collection('error_payments');
    const successfulPayments = await errorPaymentsCollection.find({
      'originalData.status': 'COMPLETED'
    }).toArray() as ErrorPayment[];

    console.log(`   Found ${successfulPayments.length} successful payments\n`);

    if (successfulPayments.length === 0) {
      console.log('🚫 No successful payments found in error_payments collection');
      return;
    }

    // Collections to search
    const importRegistrationsCollection = lodgetixDb.collection('import_registrations');
    const registrationsCollection = lodgetixDb.collection('registrations');

    // Initialize results tracking
    const matchResults: MatchResult[] = [];
    let totalImportMatches = 0;
    let totalFinalMatches = 0;

    // Step 2: For each payment, search for matches in both collections
    console.log('2️⃣ Searching for matches in lodgetix collections...');
    
    let processedCount = 0;
    for (const payment of successfulPayments) {
      processedCount++;
      console.log(`   Processing payment ${processedCount}/${successfulPayments.length}: ${payment.paymentId}`);

      const { paymentId, originalData } = payment;
      
      // Build search criteria
      const searchCriteria = [];
      
      // Add paymentId
      if (paymentId) {
        searchCriteria.push({ paymentId: paymentId });
      }
      
      // Add originalData.id
      if (originalData?.id) {
        searchCriteria.push({ paymentId: originalData.id });
        searchCriteria.push({ payment_intent_id: originalData.id });
      }
      
      // Add payment_intent_id for Stripe
      if (originalData?.payment_intent_id) {
        searchCriteria.push({ payment_intent_id: originalData.payment_intent_id });
      }
      
      // Add referenceId
      if (originalData?.referenceId) {
        searchCriteria.push({ referenceId: originalData.referenceId });
      }
      
      // Add orderId
      if (originalData?.orderId) {
        searchCriteria.push({ orderId: originalData.orderId });
      }

      if (searchCriteria.length === 0) {
        console.log(`     No searchable criteria for payment ${paymentId}`);
        continue;
      }

      const searchQuery = { $or: searchCriteria };

      // Search import_registrations
      const importMatches = await importRegistrationsCollection.find(searchQuery).toArray() as Registration[];
      
      // Search registrations
      const finalMatches = await registrationsCollection.find(searchQuery).toArray() as Registration[];

      // Determine match types
      const importMatchTypes: string[] = [];
      const finalMatchTypes: string[] = [];

      if (importMatches.length > 0) {
        totalImportMatches++;
        
        // Determine which fields matched for import collection
        for (const match of importMatches) {
          if (paymentId && match.paymentId === paymentId) {
            if (!importMatchTypes.includes('paymentId')) importMatchTypes.push('paymentId');
          }
          if (originalData?.id && (match.paymentId === originalData.id || match.payment_intent_id === originalData.id)) {
            if (!importMatchTypes.includes('originalData.id')) importMatchTypes.push('originalData.id');
          }
          if (originalData?.payment_intent_id && match.payment_intent_id === originalData.payment_intent_id) {
            if (!importMatchTypes.includes('payment_intent_id')) importMatchTypes.push('payment_intent_id');
          }
          if (originalData?.referenceId && match.referenceId === originalData.referenceId) {
            if (!importMatchTypes.includes('referenceId')) importMatchTypes.push('referenceId');
          }
          if (originalData?.orderId && match.orderId === originalData.orderId) {
            if (!importMatchTypes.includes('orderId')) importMatchTypes.push('orderId');
          }
        }
      }

      if (finalMatches.length > 0) {
        totalFinalMatches++;
        
        // Determine which fields matched for final collection
        for (const match of finalMatches) {
          if (paymentId && match.paymentId === paymentId) {
            if (!finalMatchTypes.includes('paymentId')) finalMatchTypes.push('paymentId');
          }
          if (originalData?.id && (match.paymentId === originalData.id || match.payment_intent_id === originalData.id)) {
            if (!finalMatchTypes.includes('originalData.id')) finalMatchTypes.push('originalData.id');
          }
          if (originalData?.payment_intent_id && match.payment_intent_id === originalData.payment_intent_id) {
            if (!finalMatchTypes.includes('payment_intent_id')) finalMatchTypes.push('payment_intent_id');
          }
          if (originalData?.referenceId && match.referenceId === originalData.referenceId) {
            if (!finalMatchTypes.includes('referenceId')) finalMatchTypes.push('referenceId');
          }
          if (originalData?.orderId && match.orderId === originalData.orderId) {
            if (!finalMatchTypes.includes('orderId')) finalMatchTypes.push('orderId');
          }
        }
      }

      if (importMatches.length > 0 || finalMatches.length > 0) {
        console.log(`     ✅ Found matches: ${importMatches.length} in import_registrations, ${finalMatches.length} in registrations`);
        
        matchResults.push({
          errorPayment: payment,
          importMatches,
          finalMatches,
          matchTypes: {
            import: importMatchTypes,
            final: finalMatchTypes
          }
        });
      } else {
        console.log(`     ❌ No matches found`);
      }
    }

    // Step 3: Generate comprehensive report
    console.log('\n📊 COMPREHENSIVE ANALYSIS REPORT');
    console.log('='.repeat(60));
    console.log(`Total successful payments in error_payments: ${successfulPayments.length}`);
    console.log(`Payments with matches in import_registrations: ${totalImportMatches}`);
    console.log(`Payments with matches in registrations: ${totalFinalMatches}`);
    console.log(`Payments with no matches in either collection: ${successfulPayments.length - Math.max(totalImportMatches, totalFinalMatches)}`);

    if (matchResults.length > 0) {
      const importMatchRate = ((totalImportMatches / successfulPayments.length) * 100).toFixed(1);
      const finalMatchRate = ((totalFinalMatches / successfulPayments.length) * 100).toFixed(1);
      
      console.log(`\n📈 SUCCESS RATES:`);
      console.log(`Import registrations match rate: ${importMatchRate}%`);
      console.log(`Final registrations match rate: ${finalMatchRate}%`);
    }

    // Step 4: Detailed match analysis
    if (matchResults.length > 0) {
      console.log('\n🎯 DETAILED MATCH ANALYSIS:');
      console.log('-'.repeat(40));
      
      matchResults.forEach((result, index) => {
        const payment = result.errorPayment;
        const amount = payment.originalData.amountMoney?.amount || payment.originalData.totalMoney?.amount || 0;
        const currency = payment.originalData.amountMoney?.currency || payment.originalData.totalMoney?.currency || 'AUD';
        
        console.log(`\n${index + 1}. Payment ID: ${payment.paymentId}`);
        console.log(`   Provider: ${payment.metadata?.provider || 'unknown'}`);
        console.log(`   Amount: $${(amount / 100).toFixed(2)} ${currency}`);
        console.log(`   Reference ID: ${payment.originalData?.referenceId || 'N/A'}`);
        console.log(`   Order ID: ${payment.originalData?.orderId || 'N/A'}`);
        
        console.log(`   Import Registrations: ${result.importMatches.length} match(es)`);
        if (result.importMatches.length > 0) {
          console.log(`     Match Types: ${result.matchTypes.import.join(', ')}`);
          result.importMatches.forEach((match, idx) => {
            console.log(`     ${idx + 1}. ID: ${match._id}, paymentId: ${match.paymentId || 'N/A'}, referenceId: ${match.referenceId || 'N/A'}`);
          });
        }
        
        console.log(`   Final Registrations: ${result.finalMatches.length} match(es)`);
        if (result.finalMatches.length > 0) {
          console.log(`     Match Types: ${result.matchTypes.final.join(', ')}`);
          result.finalMatches.forEach((match, idx) => {
            console.log(`     ${idx + 1}. ID: ${match._id}, paymentId: ${match.paymentId || 'N/A'}, referenceId: ${match.referenceId || 'N/A'}`);
          });
        }
      });
    }

    // Step 5: Discrepancy analysis
    console.log('\n⚠️  DISCREPANCY ANALYSIS:');
    console.log('-'.repeat(30));
    
    let inImportNotFinal = 0;
    let inFinalNotImport = 0;
    let inBoth = 0;
    
    const discrepancies: Array<{
      type: string;
      paymentId: string;
      description: string;
    }> = [];

    matchResults.forEach((result) => {
      const hasImport = result.importMatches.length > 0;
      const hasFinal = result.finalMatches.length > 0;
      
      if (hasImport && hasFinal) {
        inBoth++;
      } else if (hasImport && !hasFinal) {
        inImportNotFinal++;
        discrepancies.push({
          type: 'In import_registrations only',
          paymentId: result.errorPayment.paymentId,
          description: 'Payment found in import_registrations but not in final registrations collection'
        });
      } else if (!hasImport && hasFinal) {
        inFinalNotImport++;
        discrepancies.push({
          type: 'In registrations only',
          paymentId: result.errorPayment.paymentId,
          description: 'Payment found in final registrations but not in import_registrations collection'
        });
      }
    });

    console.log(`Payments in both collections: ${inBoth}`);
    console.log(`Payments in import_registrations only: ${inImportNotFinal}`);
    console.log(`Payments in registrations only: ${inFinalNotImport}`);

    if (discrepancies.length > 0) {
      console.log('\nDiscrepancy Details:');
      discrepancies.forEach((disc, index) => {
        console.log(`${index + 1}. ${disc.type}`);
        console.log(`   Payment ID: ${disc.paymentId}`);
        console.log(`   Description: ${disc.description}`);
      });
    } else if (matchResults.length > 0) {
      console.log('\n✅ All matched payments are consistently present in both collections');
    }

    // Step 6: Summary by provider
    console.log('\n📊 PROVIDER BREAKDOWN:');
    console.log('-'.repeat(25));
    
    const stripePayments = successfulPayments.filter(p => p.metadata?.provider === 'stripe');
    const squarePayments = successfulPayments.filter(p => p.metadata?.provider === 'square');
    
    const stripeMatches = matchResults.filter(r => r.errorPayment.metadata?.provider === 'stripe').length;
    const squareMatches = matchResults.filter(r => r.errorPayment.metadata?.provider === 'square').length;
    
    console.log(`Stripe payments: ${stripePayments.length} total, ${stripeMatches} matched (${stripePayments.length > 0 ? ((stripeMatches / stripePayments.length) * 100).toFixed(1) : 0}%)`);
    console.log(`Square payments: ${squarePayments.length} total, ${squareMatches} matched (${squarePayments.length > 0 ? ((squareMatches / squarePayments.length) * 100).toFixed(1) : 0}%)`);

    // Final summary
    console.log('\n📊 FINAL SUMMARY:');
    console.log('-'.repeat(20));
    console.log(`• Total successful payments analyzed: ${successfulPayments.length}`);
    console.log(`• Found in import_registrations: ${totalImportMatches} (${((totalImportMatches / successfulPayments.length) * 100).toFixed(1)}%)`);
    console.log(`• Found in final registrations: ${totalFinalMatches} (${((totalFinalMatches / successfulPayments.length) * 100).toFixed(1)}%)`);
    console.log(`• Data consistency issues: ${discrepancies.length}`);
    console.log(`• Test database registrations: 0 (empty)`);

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    // Close connection
    if (lodgetixClient) {
      await lodgetixClient.close();
      console.log('\n🔌 Disconnected from lodgetix database');
    }
  }
}

// Run the analysis
checkSuccessfulPaymentsInLodgetixCollections()
  .then(() => {
    console.log('\n✅ Analysis completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Analysis failed:', error);
    process.exit(1);
  });

export { checkSuccessfulPaymentsInLodgetixCollections };