#!/usr/bin/env npx tsx

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment
const envPath = path.join(__dirname, '..', '.env.explorer');
console.log(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

interface ErrorPayment {
  _id?: any;
  paymentId?: string;
  stripe_payment_intent_id?: string;
  stripe_payment_id?: string;
  square_payment_id?: string;
  id?: string;
  payment_id?: string;
  [key: string]: any;
}

interface Registration {
  _id?: any;
  paymentId?: string;
  payment_id?: string;
  stripePaymentIntentId?: string;
  stripe_payment_intent_id?: string;
  square_payment_id?: string;
  [key: string]: any;
}

interface MatchResult {
  registrationId: string;
  registrationPaymentId: string;
  errorPaymentId: string;
  matchType: 'paymentId' | 'stripe_payment_intent' | 'stripe_payment_id' | 'square_payment_id';
  registrationData: Registration;
  errorPaymentData: ErrorPayment;
}

async function checkTestDatabaseRegistrationMatches() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI not found in environment variables');
  }

  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('🔗 Connected to MongoDB');
    
    // Connect to both databases
    const lodgetixDb = client.db('lodgetix');
    const testDb = client.db('LodgeTix-migration-test-1');
    
    console.log('\n📊 CHECKING TEST DATABASE REGISTRATION MATCHES');
    console.log('='.repeat(60));
    
    // Step 1: Get all error_payments from lodgetix database
    console.log('\n1️⃣ Getting error_payments from lodgetix database...');
    const errorPaymentsCollection = lodgetixDb.collection<ErrorPayment>('error_payments');
    const errorPayments = await errorPaymentsCollection.find().toArray();
    console.log(`   Found ${errorPayments.length} error_payments`);
    
    // Step 2: Get all registrations from test database
    console.log('\n2️⃣ Getting registrations from LodgeTix-migration-test-1 database...');
    const registrationsCollection = testDb.collection<Registration>('registrations');
    const registrations = await registrationsCollection.find().toArray();
    console.log(`   Found ${registrations.length} registrations`);
    
    // Step 3: Create payment ID sets from error_payments for quick lookup
    console.log('\n3️⃣ Building payment ID lookup sets...');
    const errorPaymentIds = new Set<string>();
    const stripePaymentIntentIds = new Set<string>();
    const stripePaymentIds = new Set<string>();
    const squarePaymentIds = new Set<string>();
    
    errorPayments.forEach(errorPayment => {
      // Collect all possible payment ID fields
      if (errorPayment.paymentId) errorPaymentIds.add(errorPayment.paymentId);
      if (errorPayment.payment_id) errorPaymentIds.add(errorPayment.payment_id);
      if (errorPayment.id) errorPaymentIds.add(errorPayment.id);
      
      // Stripe payment intent IDs
      if (errorPayment.stripe_payment_intent_id) stripePaymentIntentIds.add(errorPayment.stripe_payment_intent_id);
      
      // Stripe payment IDs
      if (errorPayment.stripe_payment_id) stripePaymentIds.add(errorPayment.stripe_payment_id);
      
      // Square payment IDs
      if (errorPayment.square_payment_id) squarePaymentIds.add(errorPayment.square_payment_id);
    });
    
    console.log(`   - Error payment IDs: ${errorPaymentIds.size}`);
    console.log(`   - Stripe payment intent IDs: ${stripePaymentIntentIds.size}`);
    console.log(`   - Stripe payment IDs: ${stripePaymentIds.size}`);
    console.log(`   - Square payment IDs: ${squarePaymentIds.size}`);
    
    // Step 4: Check each registration for matches
    console.log('\n4️⃣ Checking registrations for payment ID matches...');
    const matches: MatchResult[] = [];
    let processedCount = 0;
    
    for (const registration of registrations) {
      processedCount++;
      if (processedCount % 100 === 0) {
        console.log(`   Processed ${processedCount}/${registrations.length} registrations...`);
      }
      
      const regId = registration._id?.toString() || 'unknown';
      
      // Check paymentId matches
      const paymentIdFields = [registration.paymentId, registration.payment_id].filter(Boolean);
      for (const paymentId of paymentIdFields) {
        if (errorPaymentIds.has(paymentId)) {
          const matchingErrorPayment = errorPayments.find(ep => 
            ep.paymentId === paymentId || ep.payment_id === paymentId || ep.id === paymentId
          );
          if (matchingErrorPayment) {
            matches.push({
              registrationId: regId,
              registrationPaymentId: paymentId,
              errorPaymentId: matchingErrorPayment._id?.toString() || 'unknown',
              matchType: 'paymentId',
              registrationData: registration,
              errorPaymentData: matchingErrorPayment
            });
          }
        }
      }
      
      // Check Stripe payment intent matches
      const stripeIntentFields = [registration.stripePaymentIntentId, registration.stripe_payment_intent_id].filter(Boolean);
      for (const stripeIntentId of stripeIntentFields) {
        if (stripePaymentIntentIds.has(stripeIntentId)) {
          const matchingErrorPayment = errorPayments.find(ep => ep.stripe_payment_intent_id === stripeIntentId);
          if (matchingErrorPayment) {
            matches.push({
              registrationId: regId,
              registrationPaymentId: stripeIntentId,
              errorPaymentId: matchingErrorPayment._id?.toString() || 'unknown',
              matchType: 'stripe_payment_intent',
              registrationData: registration,
              errorPaymentData: matchingErrorPayment
            });
          }
        }
      }
      
      // Check Square payment ID matches  
      if (registration.square_payment_id && squarePaymentIds.has(registration.square_payment_id)) {
        const matchingErrorPayment = errorPayments.find(ep => ep.square_payment_id === registration.square_payment_id);
        if (matchingErrorPayment) {
          matches.push({
            registrationId: regId,
            registrationPaymentId: registration.square_payment_id,
            errorPaymentId: matchingErrorPayment._id?.toString() || 'unknown',
            matchType: 'square_payment_id',
            registrationData: registration,
            errorPaymentData: matchingErrorPayment
          });
        }
      }
    }
    
    // Step 5: Report results
    console.log('\n📈 RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`📊 Total registrations in test database: ${registrations.length}`);
    console.log(`🔍 Total error_payments checked: ${errorPayments.length}`);
    console.log(`✅ Number of matches found: ${matches.length}`);
    
    if (matches.length > 0) {
      console.log('\n📋 MATCH DETAILS:');
      console.log('='.repeat(60));
      
      matches.forEach((match, index) => {
        console.log(`\n🎯 Match ${index + 1}:`);
        console.log(`   Registration ID: ${match.registrationId}`);
        console.log(`   Payment ID: ${match.registrationPaymentId}`);
        console.log(`   Match Type: ${match.matchType}`);
        console.log(`   Error Payment ID: ${match.errorPaymentId}`);
        
        // Show relevant data fields
        const regData = match.registrationData;
        const errorData = match.errorPaymentData;
        
        console.log(`   Registration Data:`);
        if (regData.paymentId) console.log(`     - paymentId: ${regData.paymentId}`);
        if (regData.payment_id) console.log(`     - payment_id: ${regData.payment_id}`);
        if (regData.stripePaymentIntentId) console.log(`     - stripePaymentIntentId: ${regData.stripePaymentIntentId}`);
        if (regData.stripe_payment_intent_id) console.log(`     - stripe_payment_intent_id: ${regData.stripe_payment_intent_id}`);
        if (regData.square_payment_id) console.log(`     - square_payment_id: ${regData.square_payment_id}`);
        if (regData.amount) console.log(`     - amount: ${regData.amount}`);
        if (regData.total) console.log(`     - total: ${regData.total}`);
        
        console.log(`   Error Payment Data:`);
        if (errorData.paymentId) console.log(`     - paymentId: ${errorData.paymentId}`);
        if (errorData.payment_id) console.log(`     - payment_id: ${errorData.payment_id}`);
        if (errorData.id) console.log(`     - id: ${errorData.id}`);
        if (errorData.stripe_payment_intent_id) console.log(`     - stripe_payment_intent_id: ${errorData.stripe_payment_intent_id}`);
        if (errorData.stripe_payment_id) console.log(`     - stripe_payment_id: ${errorData.stripe_payment_id}`);
        if (errorData.square_payment_id) console.log(`     - square_payment_id: ${errorData.square_payment_id}`);
        if (errorData.amount) console.log(`     - amount: ${errorData.amount}`);
        if (errorData.total) console.log(`     - total: ${errorData.total}`);
      });
      
      // Group matches by type
      console.log('\n📊 MATCHES BY TYPE:');
      console.log('='.repeat(60));
      const matchesByType = matches.reduce((acc, match) => {
        acc[match.matchType] = (acc[match.matchType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(matchesByType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} matches`);
      });
    }
    
    // Step 6: Calculate unmatched payments
    console.log('\n🔍 UNMATCHED ERROR PAYMENTS:');
    console.log('='.repeat(60));
    
    const matchedErrorPaymentIds = new Set(matches.map(m => m.errorPaymentId));
    const unmatchedErrorPayments = errorPayments.filter(ep => 
      !matchedErrorPaymentIds.has(ep._id?.toString() || 'unknown')
    );
    
    console.log(`📊 Total error_payments: ${errorPayments.length}`);
    console.log(`✅ Matched error_payments: ${matchedErrorPaymentIds.size}`);
    console.log(`❌ Unmatched error_payments: ${unmatchedErrorPayments.length}`);
    
    if (unmatchedErrorPayments.length > 0) {
      console.log('\n📋 UNMATCHED ERROR PAYMENTS DETAILS:');
      unmatchedErrorPayments.slice(0, 10).forEach((errorPayment, index) => {
        console.log(`\n   Unmatched ${index + 1}:`);
        console.log(`     ID: ${errorPayment._id?.toString()}`);
        if (errorPayment.paymentId) console.log(`     paymentId: ${errorPayment.paymentId}`);
        if (errorPayment.payment_id) console.log(`     payment_id: ${errorPayment.payment_id}`);
        if (errorPayment.id) console.log(`     id: ${errorPayment.id}`);
        if (errorPayment.stripe_payment_intent_id) console.log(`     stripe_payment_intent_id: ${errorPayment.stripe_payment_intent_id}`);
        if (errorPayment.stripe_payment_id) console.log(`     stripe_payment_id: ${errorPayment.stripe_payment_id}`);
        if (errorPayment.square_payment_id) console.log(`     square_payment_id: ${errorPayment.square_payment_id}`);
        if (errorPayment.amount) console.log(`     amount: ${errorPayment.amount}`);
        if (errorPayment.total) console.log(`     total: ${errorPayment.total}`);
      });
      
      if (unmatchedErrorPayments.length > 10) {
        console.log(`\n   ... and ${unmatchedErrorPayments.length - 10} more unmatched error_payments`);
      }
    }
    
    console.log('\n🎉 Analysis complete!');
    
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkTestDatabaseRegistrationMatches().catch(console.error);