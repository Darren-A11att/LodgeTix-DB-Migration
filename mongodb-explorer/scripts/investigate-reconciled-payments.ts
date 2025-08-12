import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const MONGODB_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/';
const DATABASE_NAME = 'LodgeTix-migration-test-1';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.lodgetix.io';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const failedPaymentIds = [
  'pi_3RYJFqKBASow5NsW1FnwbG6O',
  'pi_3RW8isKBASow5NsW1aVRgXZx', 
  'pi_3RW69fKBASow5NsW1TTIQGKJ',
  'pi_3RVhHvKBASow5NsW1sDbGAl9',
  'pi_3Rapg5HDfNBUEWUu1SerjCaa',
  'pi_3RapOPHDfNBUEWUu08fAWXeJ',
  'pi_3Ragt2HDfNBUEWUu05xBICiy',
  'pi_3RZInfHDfNBUEWUu0BQQrnLx'
];

async function deepSearchForRegistrationId(doc: any): string | null {
  // Search all possible fields for registration IDs
  const fieldsToCheck = [
    'linkedRegistrationId',
    'matchedRegistrationId',
    'registrationId', 
    'registration_id',
    'originalData.registration_id',
    'metadata.registration_id',
    'metadata.registrationId',
    'data.registration_id',
    'data.registrationId',
    'registration.id',
    'matched_registration_id',
    'linked_registration_id'
  ];

  for (const fieldPath of fieldsToCheck) {
    const value = getNestedValue(doc, fieldPath);
    if (value) {
      return value;
    }
  }

  // Deep search in metadata
  if (doc.metadata && typeof doc.metadata === 'object') {
    const metadataStr = JSON.stringify(doc.metadata);
    // Look for UUID patterns that might be registration IDs
    const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
    const matches = metadataStr.match(uuidPattern);
    if (matches && matches.length > 0) {
      console.log(`   Found potential registration UUID in metadata: ${matches[0]}`);
      return matches[0];
    }
  }

  // Check originalData
  if (doc.originalData && typeof doc.originalData === 'object') {
    const originalStr = JSON.stringify(doc.originalData);
    if (originalStr.includes('registration')) {
      console.log(`   Found 'registration' reference in originalData`);
      // Extract any UUID
      const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
      const matches = originalStr.match(uuidPattern);
      if (matches && matches.length > 0) {
        return matches[0];
      }
    }
  }

  return null;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

async function main() {
  console.log('🔍 Investigating Manual Reconciliation in MongoDB\n');
  console.log('='.repeat(80));

  const client = new MongoClient(MONGODB_URI);
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY!);

  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection('payments');

    console.log(`Connected to: ${DATABASE_NAME}`);
    console.log(`Searching in: payments collection\n`);

    for (const paymentId of failedPaymentIds) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Payment: ${paymentId}`);
      console.log('='.repeat(60));

      // Search with multiple strategies
      const queries = [
        { stripePaymentIntentId: paymentId },
        { stripe_payment_intent_id: paymentId },
        { paymentId: paymentId },
        { payment_id: paymentId },
        { 'metadata.stripe_payment_intent_id': paymentId },
        { 'originalData.id': paymentId }
      ];

      let found = false;
      for (const query of queries) {
        const doc = await collection.findOne(query);
        
        if (doc) {
          found = true;
          console.log(`✅ Found in MongoDB with query: ${JSON.stringify(query)}`);
          console.log(`   _id: ${doc._id}`);
          console.log(`   Status: ${doc.status || 'N/A'}`);
          console.log(`   Amount: ${doc.amount} ${doc.currency || ''}`);
          
          // Look for registration ID
          const registrationId = await deepSearchForRegistrationId(doc);
          
          if (registrationId) {
            console.log(`\n📌 Found Registration ID: ${registrationId}`);
            
            // Check if this registration exists in Supabase
            console.log(`   Checking Supabase for registration...`);
            
            // Try to find the registration using registration_id column
            const { data: registration, error } = await supabase
              .from('registrations')
              .select('*')
              .eq('registration_id', registrationId)
              .single();

            if (registration) {
              console.log(`   ✅ Registration EXISTS in Supabase!`);
              console.log(`      Status: ${registration.status}`);
              console.log(`      stripe_payment_intent_id: ${registration.stripe_payment_intent_id}`);
              console.log(`      Created: ${registration.created_at}`);
              
              // Check if payment IDs match
              if (registration.stripe_payment_intent_id === paymentId) {
                console.log(`   ✅ Payment IDs MATCH!`);
              } else {
                console.log(`   ⚠️  Payment ID MISMATCH!`);
                console.log(`      Expected: ${paymentId}`);
                console.log(`      Found: ${registration.stripe_payment_intent_id}`);
                
                // This is the root cause - registration exists but with different payment ID
                if (registration.stripe_payment_intent_id) {
                  // Check what payment this registration is linked to
                  console.log(`\n   🔄 Checking what payment this registration is linked to...`);
                  const linkedPayment = await collection.findOne({
                    $or: [
                      { stripePaymentIntentId: registration.stripe_payment_intent_id },
                      { stripe_payment_intent_id: registration.stripe_payment_intent_id },
                      { paymentId: registration.stripe_payment_intent_id }
                    ]
                  });
                  
                  if (linkedPayment) {
                    console.log(`      Registration is linked to different payment: ${registration.stripe_payment_intent_id}`);
                    console.log(`      That payment's status: ${linkedPayment.status}`);
                  } else {
                    console.log(`      Registration's payment (${registration.stripe_payment_intent_id}) not found in MongoDB`);
                  }
                }
              }
            } else {
              console.log(`   ❌ Registration NOT found in Supabase`);
              if (error) {
                console.log(`      Error: ${error.message}`);
              }
            }
          } else {
            console.log(`   ⚠️  No registration ID found in payment document`);
            
            // Show document structure for debugging
            console.log(`\n   Document structure:`);
            console.log(`      Top-level keys: ${Object.keys(doc).join(', ')}`);
            
            if (doc.metadata) {
              console.log(`      Metadata keys: ${Object.keys(doc.metadata).join(', ')}`);
              // Show metadata content
              console.log(`      Metadata: ${JSON.stringify(doc.metadata, null, 2).substring(0, 500)}`);
            }
            
            if (doc.originalData) {
              console.log(`      OriginalData keys: ${Object.keys(doc.originalData).slice(0, 10).join(', ')}...`);
            }
          }
          
          break;
        }
      }
      
      if (!found) {
        console.log(`❌ Payment NOT found in MongoDB - needs to be imported from Stripe`);
      }
      
      // ALWAYS check if any registration in Supabase has this payment ID
      console.log(`\n🔍 Searching Supabase for registrations with payment ID: ${paymentId}`);
      const { data: registrations, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('stripe_payment_intent_id', paymentId);
      
      if (registrations && registrations.length > 0) {
        console.log(`   ✅ Found ${registrations.length} registration(s) in Supabase with this payment ID!`);
        for (const reg of registrations) {
          console.log(`      Registration ID: ${reg.registration_id}`);
          console.log(`      Status: ${reg.status}`);
          console.log(`      Created: ${reg.created_at}`);
          console.log(`      Event ID: ${reg.event_id}`);
        }
      } else {
        console.log(`   ❌ No registrations in Supabase have this payment ID`);
        if (error) {
          console.log(`      Error: ${error.message}`);
        }
      }
    }

    // Summary analysis
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 SUMMARY ANALYSIS');
    console.log('='.repeat(80) + '\n');

    console.log('Root Cause Patterns Identified:\n');
    console.log('1. MISSING_FROM_MONGODB: Payment was never imported from Stripe');
    console.log('2. NO_REGISTRATION_LINK: Payment exists but has no registration ID stored');
    console.log('3. REGISTRATION_DELETED: Payment has registration ID but registration not in Supabase');
    console.log('4. PAYMENT_ID_MISMATCH: Registration exists but linked to different payment ID');
    console.log('5. ORPHANED_PAYMENT: Payment succeeded but registration was never created');

    console.log('\nRecommendations:\n');
    console.log('1. For MISSING_FROM_MONGODB: Import these payments from Stripe API');
    console.log('2. For NO_REGISTRATION_LINK: These may be direct charges without registrations');
    console.log('3. For REGISTRATION_DELETED: Investigate why registrations were removed');
    console.log('4. For PAYMENT_ID_MISMATCH: Update registration stripe_payment_intent_id to correct value');
    console.log('5. For ORPHANED_PAYMENT: Create missing registrations or mark as non-registration payments');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);