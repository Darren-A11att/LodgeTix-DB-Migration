// @ts-nocheck
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Dynamic import for Stripe SDK (ESM module)
async function getStripeClient(secretKey) {
  try {
    const { default: Stripe } = await import('stripe');
    return new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia'
    });
  } catch (error) {
    console.error('Failed to import Stripe SDK:', error.message);
    throw error;
  }
}

// Get all configured Stripe accounts from environment
function getStripeAccounts() {
  const accounts = [];
  
  // Check for up to 10 accounts
  for (let i = 1; i <= 10; i++) {
    const nameKey = `STRIPE_ACCOUNT_${i}_NAME`;
    const secretKey = `STRIPE_ACCOUNT_${i}_SECRET_KEY`;
    
    if (process.env[secretKey] && process.env[secretKey] !== 'your_stripe_secret_key_here') {
      accounts.push({
        accountNumber: i,
        name: process.env[nameKey] || `Account ${i}`,
        secretKey: process.env[secretKey],
        webhookSecret: process.env[`STRIPE_ACCOUNT_${i}_WEBHOOK_SECRET`]
      });
    }
  }
  
  // Also check for legacy single account configuration
  if (accounts.length === 0 && process.env.STRIPE_SECRET_KEY && 
      process.env.STRIPE_SECRET_KEY !== 'your_stripe_secret_key_here') {
    console.log('⚠️  Found legacy single account configuration. Consider migrating to multi-account format.');
    accounts.push({
      accountNumber: 1,
      name: 'Legacy Account',
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    });
  }
  
  return accounts;
}

async function testStripeAccount(account, accountIndex) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔌 Testing Stripe Account ${accountIndex}: ${account.name}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    const stripe = await getStripeClient(account.secretKey);
    
    // Test 1: Get account details
    console.log('1. Fetching account details...');
    let accountDetails;
    try {
      accountDetails = await stripe.accounts.retrieve();
      console.log('✅ Connected to Stripe successfully!');
      console.log(`   Account ID: ${accountDetails.id}`);
      console.log(`   Business Name: ${accountDetails.business_profile?.name || 'Not set'}`);
      console.log(`   Email: ${accountDetails.email}`);
      console.log(`   Country: ${accountDetails.country}`);
      console.log(`   Charges Enabled: ${accountDetails.charges_enabled}`);
      console.log(`   Mode: ${accountDetails.id.startsWith('acct_') ? 'Live' : 'Test'}`);
    } catch (error) {
      console.error('❌ Failed to get account details:', error.message);
      return false;
    }
    
    // Test 2: List recent payments
    console.log('\n2. Checking recent payments...');
    try {
      const payments = await stripe.paymentIntents.list({
        limit: 5,
        expand: ['data.customer']
      });
      
      if (payments.data.length === 0) {
        console.log('   No payments found');
      } else {
        console.log(`   Found ${payments.data.length} recent payments:`);
        let totalAmount = 0;
        payments.data.forEach((payment, index) => {
          console.log(`\n   Payment ${index + 1}:`);
          console.log(`   - ID: ${payment.id}`);
          console.log(`   - Amount: $${(payment.amount / 100).toFixed(2)} ${payment.currency.toUpperCase()}`);
          console.log(`   - Status: ${payment.status}`);
          console.log(`   - Created: ${new Date(payment.created * 1000).toISOString()}`);
          console.log(`   - Customer: ${payment.receipt_email || payment.customer?.email || 'No email'}`);
          if (payment.status === 'succeeded') {
            totalAmount += payment.amount;
          }
        });
        console.log(`\n   Total succeeded amount: $${(totalAmount / 100).toFixed(2)}`);
      }
    } catch (error) {
      console.error('❌ Failed to list payments:', error.message);
    }
    
    // Test 3: Check for connected accounts (Stripe Connect)
    console.log('\n3. Checking connected accounts...');
    try {
      const accounts = await stripe.accounts.list({ limit: 5 });
      
      if (accounts.data.length === 0) {
        console.log('   No connected accounts found');
      } else {
        console.log(`   Found ${accounts.data.length} connected accounts:`);
        accounts.data.forEach((connectedAccount, index) => {
          console.log(`\n   Account ${index + 1}:`);
          console.log(`   - ID: ${connectedAccount.id}`);
          console.log(`   - Type: ${connectedAccount.type}`);
          console.log(`   - Business: ${connectedAccount.business_profile?.name || 'Not set'}`);
          console.log(`   - Email: ${connectedAccount.email}`);
          console.log(`   - Charges Enabled: ${connectedAccount.charges_enabled}`);
          console.log(`   - Payouts Enabled: ${connectedAccount.payouts_enabled}`);
        });
      }
    } catch (error) {
      console.error('❌ Failed to list connected accounts:', error.message);
    }
    
    // Test 4: Check webhook endpoint (if configured)
    if (account.webhookSecret && account.webhookSecret !== 'your_stripe_webhook_secret_here') {
      console.log('\n4. Checking webhook endpoints...');
      try {
        const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
        
        if (webhooks.data.length === 0) {
          console.log('   No webhook endpoints configured');
        } else {
          console.log(`   Found ${webhooks.data.length} webhook endpoints:`);
          webhooks.data.forEach((webhook, index) => {
            console.log(`\n   Webhook ${index + 1}:`);
            console.log(`   - URL: ${webhook.url}`);
            console.log(`   - Status: ${webhook.status}`);
            console.log(`   - Events: ${webhook.enabled_events.slice(0, 3).join(', ')}${webhook.enabled_events.length > 3 ? '...' : ''}`);
          });
        }
      } catch (error) {
        console.error('❌ Failed to list webhooks:', error.message);
      }
    } else {
      console.log('\n4. Webhook secret not configured for this account');
    }
    
    // Test 5: Payment statistics
    console.log('\n5. Getting payment statistics (last 30 days)...');
    try {
      const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      const stats = {
        total: 0,
        succeeded: 0,
        failed: 0,
        pending: 0,
        amount: 0
      };
      
      let hasMore = true;
      let startingAfter = null;
      
      while (hasMore) {
        const batch = await stripe.paymentIntents.list({
          limit: 100,
          created: { gte: thirtyDaysAgo },
          ...(startingAfter && { starting_after: startingAfter })
        });
        
        batch.data.forEach(payment => {
          stats.total++;
          if (payment.status === 'succeeded') {
            stats.succeeded++;
            stats.amount += payment.amount;
          } else if (payment.status === 'failed' || payment.status === 'canceled') {
            stats.failed++;
          } else {
            stats.pending++;
          }
        });
        
        hasMore = batch.has_more;
        if (hasMore && batch.data.length > 0) {
          startingAfter = batch.data[batch.data.length - 1].id;
        }
      }
      
      console.log(`   Total payments: ${stats.total}`);
      console.log(`   - Succeeded: ${stats.succeeded}`);
      console.log(`   - Failed/Canceled: ${stats.failed}`);
      console.log(`   - Pending/Other: ${stats.pending}`);
      console.log(`   Total amount: $${(stats.amount / 100).toFixed(2)}`);
      
    } catch (error) {
      console.error('❌ Failed to get payment statistics:', error.message);
    }
    
    console.log(`\n✅ ${account.name} test completed successfully!`);
    return true;
    
  } catch (error) {
    console.error(`\n❌ ${account.name} connection test failed:`, error.message);
    return false;
  }
}

async function testAllStripeConnections() {
  console.log('🔍 Stripe Multi-Account Connection Test\n');
  
  const accounts = getStripeAccounts();
  
  if (accounts.length === 0) {
    console.error('❌ No Stripe accounts configured in .env.local');
    console.log('\nPlease add your Stripe accounts to .env.local:');
    console.log('STRIPE_ACCOUNT_1_NAME=Your Account Name');
    console.log('STRIPE_ACCOUNT_1_SECRET_KEY=sk_test_... or sk_live_...');
    console.log('STRIPE_ACCOUNT_1_WEBHOOK_SECRET=whsec_... (optional)');
    console.log('\nYou can add up to 10 accounts (STRIPE_ACCOUNT_1 through STRIPE_ACCOUNT_10)\n');
    return;
  }
  
  console.log(`Found ${accounts.length} Stripe account(s) configured:`);
  accounts.forEach((acc, idx) => console.log(`  ${idx + 1}. ${acc.name}`));
  
  let successCount = 0;
  let failCount = 0;
  
  // Test each account
  for (let i = 0; i < accounts.length; i++) {
    const success = await testStripeAccount(accounts[i], i + 1);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 OVERALL TEST SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  console.log(`Total accounts tested: ${accounts.length}`);
  console.log(`✅ Successful: ${successCount}`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount}`);
  }
  
  console.log('\nNext steps:');
  console.log('1. Run "npm run sync:stripe" to sync all Stripe account payments');
  console.log('2. Run "npm run sync:stripe-connect" to sync all connected account payments');
  console.log('3. Run "npm run sync" to sync all payment providers (Square + Stripe)\n');
  
  if (failCount > 0) {
    console.log('⚠️  Please fix the failed accounts before running sync scripts.\n');
  }
}

// Run the test
testAllStripeConnections()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
