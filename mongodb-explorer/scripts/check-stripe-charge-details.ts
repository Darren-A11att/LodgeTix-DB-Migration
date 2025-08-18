import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '../.env.local') });

async function checkPaymentCharges(paymentIntentId: string) {
  const stripe = new Stripe(process.env.STRIPE_ACCOUNT_1_SECRET_KEY!, {
    apiVersion: '2025-07-30.basil'
  });
  
  console.log('='.repeat(80));
  console.log(`🔍 DETAILED CHARGE INFORMATION FOR: ${paymentIntentId}`);
  console.log('='.repeat(80));
  
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['charges.data.balance_transaction']
    });
    
    console.log('\n📋 PAYMENT INTENT STRUCTURE:');
    console.log(`  ID: ${paymentIntent.id}`);
    console.log(`  Status: ${paymentIntent.status}`);
    console.log(`  Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
    console.log(`  Has charges field: ${(paymentIntent as any).charges ? 'YES' : 'NO'}`);
    
    if ((paymentIntent as any).charges) {
      console.log(`\n💳 CHARGES OBJECT:`);
      console.log(`  Type: ${typeof (paymentIntent as any).charges}`);
      console.log(`  Is array: ${Array.isArray((paymentIntent as any).charges)}`);
      console.log(`  Has 'data' field: ${'data' in (paymentIntent as any).charges}`);
      console.log(`  Number of charges: ${(paymentIntent as any).charges.data.length}`);
      
      if ((paymentIntent as any).charges.data.length > 0) {
        (paymentIntent as any).charges.data.forEach((charge: any, index: number) => {
          console.log(`\n  CHARGE #${index + 1}:`);
          console.log(`    Charge ID: ${charge.id}`);
          console.log(`    Amount: $${(charge.amount / 100).toFixed(2)}`);
          console.log(`    Currency: ${charge.currency}`);
          console.log(`    Status: ${charge.status}`);
          console.log(`    Captured: ${charge.captured}`);
          console.log(`    Paid: ${charge.paid}`);
          console.log(`    Refunded: ${charge.refunded}`);
          console.log(`    Amount Refunded: $${(charge.amount_refunded / 100).toFixed(2)}`);
          console.log(`    Created: ${new Date(charge.created * 1000).toISOString()}`);
          
          if (charge.payment_method_details?.card) {
            console.log(`\n    CARD DETAILS:`);
            console.log(`      Brand: ${charge.payment_method_details.card.brand}`);
            console.log(`      Last4: ${charge.payment_method_details.card.last4}`);
            console.log(`      Exp Month: ${charge.payment_method_details.card.exp_month}`);
            console.log(`      Exp Year: ${charge.payment_method_details.card.exp_year}`);
            console.log(`      Funding: ${charge.payment_method_details.card.funding}`);
            console.log(`      Network: ${charge.payment_method_details.card.network}`);
          }
          
          if (charge.billing_details) {
            console.log(`\n    BILLING DETAILS:`);
            console.log(`      Email: ${charge.billing_details.email || 'N/A'}`);
            console.log(`      Name: ${charge.billing_details.name || 'N/A'}`);
            console.log(`      Phone: ${charge.billing_details.phone || 'N/A'}`);
          }
          
          if (charge.outcome) {
            console.log(`\n    OUTCOME:`);
            console.log(`      Network Status: ${charge.outcome.network_status}`);
            console.log(`      Risk Level: ${charge.outcome.risk_level}`);
            console.log(`      Risk Score: ${charge.outcome.risk_score}`);
            console.log(`      Seller Message: ${charge.outcome.seller_message}`);
            console.log(`      Type: ${charge.outcome.type}`);
          }
        });
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('RAW CHARGES FIELD VALUE:');
    console.log(JSON.stringify((paymentIntent as any).charges, null, 2));
    console.log('='.repeat(80));
    
    return paymentIntent;
    
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
  }
}

// Main execution
async function main() {
  console.log('Checking the charge field structure for both payments...\n');
  
  await checkPaymentCharges('pi_3RYJFqKBASow5NsW1FnwbG6O');
  console.log('\n\n');
  await checkPaymentCharges('pi_3RYJGnKBASow5NsW1I1PFrGN');
}

main().catch(console.error);