import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '../.env.local') });

async function checkPaymentWithCharges(paymentIntentId: string) {
  const stripe = new Stripe(process.env.STRIPE_ACCOUNT_1_SECRET_KEY!, {
    apiVersion: '2025-07-30.basil'
  });
  
  console.log('='.repeat(80));
  console.log(`🔍 RETRIEVING WITH CHARGES: ${paymentIntentId}`);
  console.log('='.repeat(80));
  
  try {
    // First, retrieve without expansion
    console.log('\n1️⃣ WITHOUT EXPANSION:');
    const paymentIntentBasic = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log(`  Has charges field: ${(paymentIntentBasic as any).charges ? 'YES' : 'NO'}`);
    console.log(`  Charges value: ${JSON.stringify((paymentIntentBasic as any).charges)}`);
    
    // Now retrieve with charges expanded
    console.log('\n2️⃣ WITH CHARGES EXPANDED:');
    const paymentIntentExpanded = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ['charges'] }
    );
    console.log(`  Has charges field: ${(paymentIntentExpanded as any).charges ? 'YES' : 'NO'}`);
    
    if ((paymentIntentExpanded as any).charges) {
      console.log(`  Charges type: ${typeof (paymentIntentExpanded as any).charges}`);
      console.log(`  Has data field: ${'data' in (paymentIntentExpanded as any).charges}`);
      
      if ('data' in (paymentIntentExpanded as any).charges && (paymentIntentExpanded as any).charges.data) {
        console.log(`  Number of charges: ${(paymentIntentExpanded as any).charges.data.length}`);
        
        (paymentIntentExpanded as any).charges.data.forEach((charge: any, i: number) => {
          console.log(`\n  CHARGE ${i + 1}:`);
          console.log(`    ID: ${charge.id}`);
          console.log(`    Amount: $${(charge.amount / 100).toFixed(2)}`);
          console.log(`    Status: ${charge.status}`);
          console.log(`    Refunded: ${charge.refunded}`);
          console.log(`    Card Last4: ${charge.payment_method_details?.card?.last4 || 'N/A'}`);
        });
      }
    }
    
    // Try listing charges separately
    console.log('\n3️⃣ LISTING CHARGES SEPARATELY:');
    const charges = await stripe.charges.list({
      payment_intent: paymentIntentId,
      limit: 10
    });
    
    console.log(`  Found ${charges.data.length} charge(s)`);
    charges.data.forEach((charge, i) => {
      console.log(`\n  CHARGE ${i + 1}:`);
      console.log(`    ID: ${charge.id}`);
      console.log(`    Amount: $${(charge.amount / 100).toFixed(2)}`);
      console.log(`    Status: ${charge.status}`);
      console.log(`    Paid: ${charge.paid}`);
      console.log(`    Refunded: ${charge.refunded}`);
      console.log(`    Amount Refunded: $${(charge.amount_refunded / 100).toFixed(2)}`);
      console.log(`    Card Brand: ${charge.payment_method_details?.card?.brand || 'N/A'}`);
      console.log(`    Card Last4: ${charge.payment_method_details?.card?.last4 || 'N/A'}`);
      console.log(`    Receipt Email: ${charge.receipt_email || 'N/A'}`);
      console.log(`    Customer ID: ${charge.customer || 'N/A'}`);
    });
    
    return paymentIntentExpanded;
    
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
  }
}

// Main execution
async function main() {
  console.log('Testing charge field retrieval methods...\n');
  
  await checkPaymentWithCharges('pi_3RYJFqKBASow5NsW1FnwbG6O');
  console.log('\n' + '='.repeat(80) + '\n');
  await checkPaymentWithCharges('pi_3RYJGnKBASow5NsW1I1PFrGN');
}

main().catch(console.error);