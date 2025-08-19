import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.lodgetix.io';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Supabase credentials not configured');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const registrationId = '691bbbe7-cb53-4350-99a6-e9554bf59fd9';
  const paymentId = 'pi_3RYJFqKBASow5NsW1FnwbG6O';
  
  console.log('='.repeat(80));
  console.log('🔍 CHECKING REGISTRATION IN SUPABASE');
  console.log('='.repeat(80));
  console.log(`\nRegistration ID: ${registrationId}`);
  console.log(`Payment ID: ${paymentId}`);
  
  // Search by registration_id
  console.log('\n1️⃣ Searching by registration_id...');
  const { data: regByRegId, error: err1 } = await supabase
    .from('registrations')
    .select('*')
    .eq('registration_id', registrationId)
    .single();
  
  if (regByRegId) {
    console.log('✅ Found registration!');
    console.log(`  Status: ${regByRegId.status}`);
    console.log(`  Payment Intent: ${regByRegId.stripe_payment_intent_id}`);
    console.log(`  Created: ${regByRegId.created_at}`);
    console.log(`  Event ID: ${regByRegId.event_id}`);
    
    if (regByRegId.stripe_payment_intent_id === paymentId) {
      console.log(`  ✅ Payment ID MATCHES!`);
    } else {
      console.log(`  ⚠️ Payment ID MISMATCH!`);
      console.log(`     Expected: ${paymentId}`);
      console.log(`     Found: ${regByRegId.stripe_payment_intent_id}`);
    }
  } else {
    console.log(`❌ Not found by registration_id: ${err1 ? err1.message : 'No data'}`);
  }
  
  // Search by payment intent ID
  console.log('\n2️⃣ Searching by stripe_payment_intent_id...');
  const { data: regByPayment, error: err2 } = await supabase
    .from('registrations')
    .select('*')
    .eq('stripe_payment_intent_id', paymentId)
    .single();
  
  if (regByPayment) {
    console.log('✅ Found registration by payment ID!');
    console.log(`  Registration ID: ${regByPayment.registration_id}`);
    console.log(`  Status: ${regByPayment.status}`);
    console.log(`  Created: ${regByPayment.created_at}`);
    console.log(`  Event ID: ${regByPayment.event_id}`);
  } else {
    console.log(`❌ Not found by payment ID: ${err2 ? err2.message : 'No data'}`);
  }
  
  // Search all registrations for this UUID anywhere
  console.log('\n3️⃣ Searching all registrations for UUID...');
  const { data: allRegs, error: err3 } = await supabase
    .from('registrations')
    .select('*')
    .limit(1000);
  
  if (allRegs) {
    const found = allRegs.filter(r => {
      const str = JSON.stringify(r);
      return str.includes(registrationId) || str.includes(paymentId);
    });
    
    if (found.length > 0) {
      console.log(`✅ Found ${found.length} registration(s) containing our IDs:`);
      found.forEach(reg => {
        console.log(`\n  Registration: ${reg.registration_id}`);
        console.log(`    Status: ${reg.status}`);
        console.log(`    Payment: ${reg.stripe_payment_intent_id}`);
        console.log(`    Created: ${reg.created_at}`);
      });
    } else {
      console.log('❌ No registrations found containing our IDs');
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY:');
  console.log('Payment pi_3RYJFqKBASow5NsW1FnwbG6O ($264.56) is NOT a test payment');
  console.log('It has a linked registration ID in MongoDB: 691bbbe7-cb53-4350-99a6-e9554bf59fd9');
  console.log('This registration needs to be checked in Supabase');
  console.log('='.repeat(80));
}

main().catch(console.error);