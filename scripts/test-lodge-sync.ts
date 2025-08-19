import dotenv from 'dotenv';
import path from 'path';
import { EnhancedPaymentSync } from '../src/services/sync/enhanced-payment-sync';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testLodgeSync() {
  console.log('Testing lodge registration sync...\n');
  
  const sync = new EnhancedPaymentSync({
    mongodb: {
      uri: process.env.MONGODB_URI!
    },
    supabase: {
      url: process.env.SUPABASE_URL!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
    },
    square: {
      accessToken: process.env.SQUARE_ACCESS_TOKEN!,
      environment: 'production' as const
    },
    stripeAccounts: []
  });

  try {
    // Test with the specific lodge registration from the example
    const testRegistrationId = '1408e014-4560-4206-96d5-6fd708eb0ddd';
    
    console.log(`Testing with lodge registration: ${testRegistrationId}`);
    console.log('This will process the registration and show how customer/ticket data is created.\n');
    
    // Run sync for just this registration
    await sync.syncSingleRegistration(testRegistrationId);
    
    console.log('\n✅ Lodge registration sync test complete');
    console.log('Check the sync logs for detailed processing information.');
    
  } catch (error) {
    console.error('Error during lodge sync test:', error);
  } finally {
    await sync.close();
  }
}

testLodgeSync().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});