import * as fs from 'fs';
import * as path from 'path';
import { MongoClient, ObjectId } from 'mongodb';

interface VerifiedReport {
  generatedAt: string;
  verifiedAt?: string;
  verificationNote?: string;
  summary: {
    totalChecked: number;
    validMatches: number;
    falseMatches: number;
    missingRegistrations: number;
    byMatchMethod: Record<string, number>;
  };
  falseMatches: Array<{
    paymentId: string;
    paymentIdValue: string;
    registrationId: string;
    matchMethod: string;
    matchConfidence: number;
    issue: string;
    paymentDetails: any;
    registrationDetails: any;
  }>;
}

async function applyMatchFixes(verifiedReportFile?: string) {
  const reportsDir = path.join(process.cwd(), 'payment-match-reports');
  
  // Find verified report
  if (!verifiedReportFile) {
    const files = fs.readdirSync(reportsDir)
      .filter(f => f.includes('-verified.json'))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      console.error('❌ No verified reports found. Please run review-false-matches.ts first.');
      return;
    }
    
    verifiedReportFile = path.join(reportsDir, files[0]);
    console.log(`📄 Using verified report: ${files[0]}\n`);
  }
  
  // Load the verified report
  const reportContent = fs.readFileSync(verifiedReportFile, 'utf-8');
  const report: VerifiedReport = JSON.parse(reportContent);
  
  if (!report.verifiedAt) {
    console.error('❌ This report has not been verified. Please run review-false-matches.ts first.');
    return;
  }
  
  console.log('🔧 APPLYING PAYMENT MATCH FIXES');
  console.log('=' + '='.repeat(80));
  console.log(`Report generated: ${report.generatedAt}`);
  console.log(`Verified at: ${report.verifiedAt}`);
  console.log(`False matches to fix: ${report.falseMatches.length}`);
  
  const proceed = await confirmAction(
    `\nThis will clear ${report.falseMatches.length} false matches. Continue? (yes/no): `
  );
  
  if (!proceed) {
    console.log('❌ Operation cancelled.');
    return;
  }
  
  // Connect to database
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('lodgetix-reconcile');
    const payments = db.collection('payments');
    const registrations = db.collection('registrations');
    
    console.log('\nStep 1: Clearing false matches...');
    
    let cleared = 0;
    let errors = 0;
    const clearedPaymentIds: string[] = [];
    
    for (const falseMatch of report.falseMatches) {
      try {
        const result = await payments.updateOne(
          { _id: new ObjectId(falseMatch.paymentId) },
          {
            $unset: {
              matchedRegistrationId: '',
              matchMethod: '',
              matchedAt: '',
              matchedBy: '',
              matchDetails: '',
              matchConfidence: ''
            },
            $set: {
              previousMatchCleared: true,
              matchClearedAt: new Date(),
              matchClearedReason: falseMatch.issue,
              previousMatchedRegistrationId: falseMatch.registrationId,
              previousMatchMethod: falseMatch.matchMethod,
              previousMatchConfidence: falseMatch.matchConfidence
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          cleared++;
          clearedPaymentIds.push(falseMatch.paymentId);
          console.log(`✅ Cleared match for payment ${falseMatch.paymentId}`);
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error clearing payment ${falseMatch.paymentId}:`, error);
      }
    }
    
    console.log(`\nCleared ${cleared} false matches (${errors} errors)`);
    
    // Step 2: Re-match with strict criteria
    const rematch = await confirmAction(
      '\nDo you want to re-match these payments with strict criteria? (yes/no): '
    );
    
    if (rematch) {
      console.log('\nStep 2: Re-matching with strict criteria...');
      
      let newMatches = 0;
      
      for (const paymentId of clearedPaymentIds) {
        const payment = await payments.findOne({ _id: new ObjectId(paymentId) });
        if (!payment) continue;
        
        // Extract payment IDs
        const paymentIds = [];
        if (payment.paymentId) paymentIds.push({ id: payment.paymentId, field: 'paymentId' });
        if (payment.transactionId) paymentIds.push({ id: payment.transactionId, field: 'transactionId' });
        if (payment.originalData?.['Payment ID']) paymentIds.push({ id: payment.originalData['Payment ID'], field: 'Payment ID' });
        if (payment.originalData?.['PaymentIntent ID']) paymentIds.push({ id: payment.originalData['PaymentIntent ID'], field: 'PaymentIntent ID' });
        
        // Try to find matching registration
        for (const { id: paymentIdValue, field } of paymentIds) {
          const query = {
            $or: [
              { stripePaymentIntentId: paymentIdValue },
              { squarePaymentId: paymentIdValue },
              { 'registrationData.stripePaymentIntentId': paymentIdValue },
              { 'registrationData.squarePaymentId': paymentIdValue },
              { 'registrationData.stripe_payment_intent_id': paymentIdValue },
              { 'registrationData.square_payment_id': paymentIdValue },
              { 'paymentInfo.stripe_payment_intent_id': paymentIdValue },
              { 'paymentInfo.square_payment_id': paymentIdValue },
              { 'paymentData.transactionId': paymentIdValue },
              { 'paymentData.paymentId': paymentIdValue }
            ]
          };
          
          const registration = await registrations.findOne(query);
          
          if (registration) {
            // Find which field matched
            let matchedField = '';
            if (registration.stripePaymentIntentId === paymentIdValue) matchedField = 'stripePaymentIntentId';
            else if (registration.squarePaymentId === paymentIdValue) matchedField = 'squarePaymentId';
            else if (registration.registrationData?.stripePaymentIntentId === paymentIdValue) matchedField = 'registrationData.stripePaymentIntentId';
            else if (registration.registrationData?.squarePaymentId === paymentIdValue) matchedField = 'registrationData.squarePaymentId';
            else if (registration.registrationData?.stripe_payment_intent_id === paymentIdValue) matchedField = 'registrationData.stripe_payment_intent_id';
            else if (registration.registrationData?.square_payment_id === paymentIdValue) matchedField = 'registrationData.square_payment_id';
            else if (registration.paymentInfo?.stripe_payment_intent_id === paymentIdValue) matchedField = 'paymentInfo.stripe_payment_intent_id';
            else if (registration.paymentInfo?.square_payment_id === paymentIdValue) matchedField = 'paymentInfo.square_payment_id';
            else if (registration.paymentData?.transactionId === paymentIdValue) matchedField = 'paymentData.transactionId';
            else if (registration.paymentData?.paymentId === paymentIdValue) matchedField = 'paymentData.paymentId';
            
            await payments.updateOne(
              { _id: new ObjectId(paymentId) },
              {
                $set: {
                  matchedRegistrationId: registration._id.toString(),
                  matchMethod: 'strict_paymentId',
                  matchedAt: new Date(),
                  matchedBy: 'apply_fixes_script',
                  matchConfidence: 100,
                  matchDetails: [{
                    fieldName: 'paymentId',
                    paymentValue: paymentIdValue,
                    registrationValue: paymentIdValue,
                    paymentPath: field,
                    registrationPath: matchedField,
                    points: 100,
                    isMatch: true
                  }]
                }
              }
            );
            
            console.log(`✅ NEW MATCH: Payment ${paymentId} → Registration ${registration._id}`);
            newMatches++;
            break;
          }
        }
      }
      
      console.log(`\nCreated ${newMatches} new strict matches`);
    }
    
    // Generate fix report
    const fixReport = {
      originalReport: path.basename(verifiedReportFile),
      fixAppliedAt: new Date().toISOString(),
      results: {
        falseMatchesCleared: cleared,
        errors,
        newMatchesCreated: rematch ? newMatches : 0
      }
    };
    
    const fixReportPath = verifiedReportFile.replace('-verified.json', '-fixed.json');
    fs.writeFileSync(fixReportPath, JSON.stringify(fixReport, null, 2));
    
    console.log('\n' + '='.repeat(80));
    console.log('FIX APPLICATION COMPLETE');
    console.log('=' + '='.repeat(80));
    console.log(`False matches cleared: ${cleared}`);
    console.log(`Errors encountered: ${errors}`);
    if (rematch) {
      console.log(`New matches created: ${newMatches}`);
    }
    console.log(`\n📄 Fix report saved to: ${path.basename(fixReportPath)}`);
    
  } finally {
    await client.close();
  }
}

function confirmAction(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question(prompt, (answer: string) => {
      readline.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Run with optional specific verified report file
const reportFile = process.argv[2];
applyMatchFixes(reportFile).catch(console.error);