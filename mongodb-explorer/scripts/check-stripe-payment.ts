import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
// Also load parent env if exists
dotenv.config({ path: path.join(process.cwd(), '../.env.local') });

async function checkPayment(paymentIntentId: string) {
  console.log('='.repeat(80));
  console.log(`🔍 CHECKING STRIPE PAYMENT: ${paymentIntentId}`);
  console.log('='.repeat(80));
  
  // Check all three Stripe accounts
  const stripeAccounts = [
    {
      name: process.env.STRIPE_ACCOUNT_1_NAME || 'DA-LODGETIX',
      key: process.env.STRIPE_ACCOUNT_1_SECRET_KEY
    },
    {
      name: process.env.STRIPE_ACCOUNT_2_NAME || 'WS-LODGETIX',
      key: process.env.STRIPE_ACCOUNT_2_SECRET_KEY
    },
    {
      name: process.env.STRIPE_ACCOUNT_3_NAME || 'LodgeTix-MSW',
      key: process.env.STRIPE_ACCOUNT_3_SECRET_KEY
    }
  ];
  
  for (const account of stripeAccounts) {
    if (!account.key) {
      console.log(`\n❌ ${account.name}: No API key configured`);
      continue;
    }
    
    console.log(`\n🔍 Checking ${account.name}...`);
    
    try {
      const stripe = new Stripe(account.key, {
        apiVersion: '2025-07-30.basil'
      });
      
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      console.log(`✅ FOUND in ${account.name}!`);
      console.log('\n📋 PAYMENT DETAILS:');
      console.log(`  ID: ${paymentIntent.id}`);
      console.log(`  Status: ${paymentIntent.status}`);
      console.log(`  Amount: $${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}`);
      console.log(`  Created: ${new Date(paymentIntent.created * 1000).toISOString()}`);
      
      // Check if refunded
      if ((paymentIntent as any).charges && (paymentIntent as any).charges.data.length > 0) {
        const charge = (paymentIntent as any).charges.data[0];
        console.log('\n💳 CHARGE DETAILS:');
        console.log(`  Charge ID: ${charge.id}`);
        console.log(`  Refunded: ${charge.refunded ? '✅ YES' : '❌ NO'}`);
        console.log(`  Amount Refunded: $${(charge.amount_refunded / 100).toFixed(2)}`);
        
        if (charge.payment_method_details?.card) {
          console.log(`  Card Brand: ${charge.payment_method_details.card.brand}`);
          console.log(`  Card Last4: ${charge.payment_method_details.card.last4}`);
        }
        
        if (charge.receipt_email) {
          console.log(`  Receipt Email: ${charge.receipt_email}`);
        }
        
        if (charge.billing_details?.email) {
          console.log(`  Billing Email: ${charge.billing_details.email}`);
        }
      }
      
      // Check metadata
      if (paymentIntent.metadata && Object.keys(paymentIntent.metadata).length > 0) {
        console.log('\n📦 METADATA:');
        Object.entries(paymentIntent.metadata).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      }
      
      // Customer information
      if (paymentIntent.customer) {
        console.log(`\n👤 CUSTOMER ID: ${paymentIntent.customer}`);
        
        try {
          const customer = await stripe.customers.retrieve(paymentIntent.customer as string);
          if (customer && !('deleted' in customer)) {
            console.log(`  Email: ${customer.email || 'N/A'}`);
            console.log(`  Name: ${customer.name || 'N/A'}`);
          }
        } catch (custError) {
          console.log(`  Could not retrieve customer details`);
        }
      }
      
      console.log('\n' + '='.repeat(80));
      console.log('SUMMARY:');
      if (paymentIntent.status === 'succeeded' && 
          (!(paymentIntent as any).charges?.data[0]?.refunded)) {
        console.log('✅ Payment is VALID - succeeded and not refunded');
      } else if ((paymentIntent as any).charges?.data[0]?.refunded) {
        console.log('❌ Payment was REFUNDED');
      } else {
        console.log(`⚠️ Payment status: ${paymentIntent.status}`);
      }
      console.log('='.repeat(80));
      
      return paymentIntent;
      
    } catch (error: any) {
      if (error.statusCode === 404) {
        console.log(`  Not found in ${account.name}`);
      } else {
        console.log(`  Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n❌ Payment not found in any Stripe account');
}

// Main execution
async function main() {
  const paymentId = 'pi_3RYJGnKBASow5NsW1I1PFrGN';
  
  console.log('Checking Stripe payment that the registration actually points to...\n');
  await checkPayment(paymentId);
  
  console.log('\n\nNow checking the original payment for comparison...\n');
  await checkPayment('pi_3RYJFqKBASow5NsW1FnwbG6O');
}

main().catch(console.error);