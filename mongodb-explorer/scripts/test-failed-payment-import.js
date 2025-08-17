#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function testFailedPaymentImport() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');
    
    const db = client.db('lodgetix');
    
    console.log('🧪 FAILED PAYMENT IMPORT TEST');
    console.log('═══════════════════════════════════════');
    
    // Test 1: Count import_payments by _shouldMoveToProduction flag
    console.log('\n📊 Test 1: Import Payments Analysis');
    console.log('─────────────────────────────────────');
    
    const totalImportPayments = await db.collection('import_payments').countDocuments();
    const shouldMoveTrue = await db.collection('import_payments').countDocuments({ _shouldMoveToProduction: true });
    const shouldMoveFalse = await db.collection('import_payments').countDocuments({ _shouldMoveToProduction: false });
    const noFlag = await db.collection('import_payments').countDocuments({ _shouldMoveToProduction: { $exists: false } });
    
    console.log(`Total import_payments: ${totalImportPayments}`);
    console.log(`✅ _shouldMoveToProduction: true  → ${shouldMoveTrue}`);
    console.log(`❌ _shouldMoveToProduction: false → ${shouldMoveFalse}`);
    console.log(`❓ No _shouldMoveToProduction flag → ${noFlag}`);
    
    // Test 2: Sample failed/refunded payments
    console.log('\n📋 Test 2: Sample Failed/Refunded Payments');
    console.log('────────────────────────────────────────────');
    
    const failedPayments = await db.collection('import_payments')
      .find({ _shouldMoveToProduction: false })
      .limit(10)
      .toArray();
    
    if (failedPayments.length > 0) {
      console.log(`Found ${failedPayments.length} sample failed/refunded payments:`);
      failedPayments.forEach((payment, index) => {
        const id = payment.id || payment._id || 'unknown';
        const amount = payment.amount || 0;
        const status = payment.status || 'unknown';
        const provider = payment.provider || 'unknown';
        console.log(`  ${index + 1}. ID: ${String(id).substring(0, 20)}... | $${amount.toFixed(2)} | ${status} | ${provider}`);
      });
    } else {
      console.log('✅ No failed/refunded payments found in import_payments');
    }
    
    // Test 3: Check import_registrations
    console.log('\n📋 Test 3: Import Registrations Analysis');
    console.log('──────────────────────────────────────────');
    
    const totalImportRegs = await db.collection('import_registrations').countDocuments();
    const regsShouldMoveTrue = await db.collection('import_registrations').countDocuments({ _shouldMoveToProduction: true });
    const regsShouldMoveFalse = await db.collection('import_registrations').countDocuments({ _shouldMoveToProduction: false });
    const regsNoFlag = await db.collection('import_registrations').countDocuments({ _shouldMoveToProduction: { $exists: false } });
    
    console.log(`Total import_registrations: ${totalImportRegs}`);
    console.log(`✅ _shouldMoveToProduction: true  → ${regsShouldMoveTrue}`);
    console.log(`❌ _shouldMoveToProduction: false → ${regsShouldMoveFalse}`);
    console.log(`❓ No _shouldMoveToProduction flag → ${regsNoFlag}`);
    
    // Test 4: Verify failed payments don't exist in production
    console.log('\n🔍 Test 4: Production Collection Verification');
    console.log('───────────────────────────────────────────────');
    
    const productionPayments = await db.collection('payments').countDocuments();
    const productionRegs = await db.collection('registrations').countDocuments();
    
    console.log(`Production payments collection: ${productionPayments} documents`);
    console.log(`Production registrations collection: ${productionRegs} documents`);
    
    // Check if any failed payment IDs exist in production (they shouldn't)
    let failedInProduction = 0;
    if (failedPayments.length > 0) {
      const failedIds = failedPayments.map(p => p.id).filter(id => id);
      if (failedIds.length > 0) {
        failedInProduction = await db.collection('payments').countDocuments({ 
          id: { $in: failedIds } 
        });
      }
    }
    
    console.log(`Failed payments found in production: ${failedInProduction} (should be 0)`);
    
    // Test 5: Overall summary and pass/fail
    console.log('\n📈 Test 5: Summary & Results');
    console.log('──────────────────────────────');
    
    const tests = [
      {
        name: 'Import collections have _shouldMoveToProduction flags',
        passed: (shouldMoveTrue + shouldMoveFalse) > 0,
        detail: `${shouldMoveTrue + shouldMoveFalse} payments flagged`
      },
      {
        name: 'Failed payments exist in import_payments',
        passed: shouldMoveFalse > 0,
        detail: `${shouldMoveFalse} failed payments found`
      },
      {
        name: 'Production-ready payments exist in import_payments',
        passed: shouldMoveTrue > 0,
        detail: `${shouldMoveTrue} production-ready payments found`
      },
      {
        name: 'Failed payments are NOT in production',
        passed: failedInProduction === 0,
        detail: `${failedInProduction} failed payments incorrectly in production`
      },
      {
        name: 'Import/Production collections exist',
        passed: totalImportPayments > 0 && productionPayments >= 0,
        detail: `import: ${totalImportPayments}, production: ${productionPayments}`
      }
    ];
    
    let totalTests = tests.length;
    let passedTests = tests.filter(t => t.passed).length;
    
    console.log('\nTest Results:');
    tests.forEach((test, index) => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${index + 1}. ${status} - ${test.name}`);
      console.log(`     ${test.detail}`);
    });
    
    console.log('\n═══════════════════════════════════════');
    console.log(`🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED - Failed payment import handling is working correctly!');
    } else {
      console.log('⚠️  SOME TESTS FAILED - Review the failed test details above');
    }
    
    console.log('\n📊 Quick Stats:');
    console.log(`   • ${shouldMoveTrue} payments ready for production`);
    console.log(`   • ${shouldMoveFalse} payments correctly excluded (failed/refunded)`);
    console.log(`   • ${productionPayments} payments in production collection`);
    console.log(`   • ${failedInProduction} failed payments incorrectly in production (should be 0)`);
    
  } catch (error) {
    console.error('❌ Error running test:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

testFailedPaymentImport().catch(console.error);