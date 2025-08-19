import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { CheckoutRepository, createCheckout, createCustomer, createPaymentIntent, validateCheckout } from '../src/models/checkout';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testCheckoutSchema() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const checkoutRepo = new CheckoutRepository(db);
    
    console.log('\n========================================');
    console.log('CHECKOUT SCHEMA TEST');
    console.log('========================================\n');
    
    // Test 1: Create a person checkout
    console.log('Test 1: Creating a person checkout...');
    const personCustomer = createCustomer({
      type: 'person',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      email: 'john.doe@example.com',
      addressLine1: '123 Main Street',
      addressLine2: 'Apt 4B',
      suburb: 'Manhattan',
      state: 'NY',
      postCode: '10001',
      country: 'USA'
    });

    const paymentIntent1 = createPaymentIntent({
      provider: 'stripe',
      status: 'pending',
      subtotal: 299.99,
      platformFee: 8.99,
      merchantFee: 6.00
    });

    const personCheckout = await checkoutRepo.create({
      customer: personCustomer,
      supplierId: 'vendor-123',
      cartId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      paymentIntent: paymentIntent1,
      status: 'started'
    });
    
    console.log('✅ Person checkout created:', personCheckout.checkoutId);
    console.log('   Customer:', personCustomer.firstName, personCustomer.lastName);
    console.log('   Payment total: $', paymentIntent1.totalAmount.toFixed(2));
    console.log('   Fees breakdown:');
    console.log('     - Platform: $', paymentIntent1.fees.platformFee.toFixed(2));
    console.log('     - Merchant: $', paymentIntent1.fees.merchantFee.toFixed(2));
    console.log('     - Total fees: $', paymentIntent1.fees.totalFees.toFixed(2));
    
    // Test 2: Create a business checkout
    console.log('\nTest 2: Creating a business checkout...');
    const businessCustomer = createCustomer({
      type: 'business',
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+1987654321',
      email: 'jane@company.com',
      addressLine1: '456 Business Plaza',
      suburb: 'Brooklyn',
      state: 'NY',
      postCode: '11201',
      country: 'USA',
      businessName: 'Smith Enterprises LLC',
      businessNumber: 'EIN-12-3456789'
    });

    const paymentIntent2 = createPaymentIntent({
      provider: 'square',
      status: 'processing',
      subtotal: 1500.00,
      platformFee: 45.00,
      merchantFee: 30.00,
      data: [{ transactionId: 'sq_123456', timestamp: new Date().toISOString() }]
    });

    const businessCheckout = await checkoutRepo.create({
      customer: businessCustomer,
      supplierId: 'vendor-456',
      cartId: '550e8400-e29b-41d4-a716-446655440000',
      paymentIntent: paymentIntent2
    });
    
    console.log('✅ Business checkout created:', businessCheckout.checkoutId);
    console.log('   Business:', businessCustomer.businessName);
    console.log('   Business Number:', businessCustomer.businessNumber);
    console.log('   Payment total: $', paymentIntent2.totalAmount.toFixed(2));
    
    // Test 3: Test validation
    console.log('\nTest 3: Testing validation...');
    
    // Invalid checkout (missing required fields, wrong calculations)
    const invalidCheckout = {
      checkoutId: 'not-a-uuid',
      status: 'invalid-status' as any,
      createdAt: 'not-a-date' as any,
      customer: {
        customerId: 'not-a-uuid',
        type: 'invalid-type' as any,
        firstName: '',
        lastName: '',
        phone: '',
        email: 'not-an-email',
        addressLine1: '',
        suburb: '',
        state: '',
        postCode: '',
        country: ''
      },
      supplierId: '',
      cartId: 'not-a-uuid',
      paymentIntent: {
        id: '',
        provider: '',
        data: 'not-an-array' as any,
        status: '',
        subtotal: -100,
        fees: {
          platformFee: 10,
          merchantFee: 5,
          totalFees: 20 // Should be 15
        },
        totalAmount: 0 // Should be subtotal + totalFees
      }
    };
    
    const validation = validateCheckout(invalidCheckout);
    console.log('❌ Invalid checkout validation:', validation.valid ? 'PASSED' : 'FAILED (as expected)');
    if (!validation.valid) {
      console.log('   Sample errors:', validation.errors.slice(0, 4).join(', '));
      console.log('   Total errors found:', validation.errors.length);
    }
    
    // Test 4: Update operations
    console.log('\nTest 4: Testing update operations...');
    
    // Update checkout status
    const completedCheckout = await checkoutRepo.updateStatus(personCheckout.checkoutId, 'completed');
    console.log('✅ Updated checkout status to completed');
    console.log('   New status:', completedCheckout?.status);
    
    // Update payment intent
    const updatedPaymentIntent = createPaymentIntent({
      id: paymentIntent1.id,
      provider: 'stripe',
      status: 'succeeded',
      subtotal: 299.99,
      platformFee: 8.99,
      merchantFee: 6.00,
      data: [{ chargeId: 'ch_123456789', captured: true }]
    });
    
    const checkoutWithUpdatedPayment = await checkoutRepo.updatePaymentIntent(
      personCheckout.checkoutId,
      updatedPaymentIntent
    );
    console.log('✅ Updated payment intent');
    console.log('   Payment status:', checkoutWithUpdatedPayment?.paymentIntent.status);
    
    // Test 5: Find operations
    console.log('\nTest 5: Testing find operations...');
    
    const customerCheckouts = await checkoutRepo.findByCustomerId(personCustomer.customerId);
    console.log('✅ Found', customerCheckouts.length, 'checkouts for customer');
    
    const emailCheckouts = await checkoutRepo.findByEmail('john.doe@example.com');
    console.log('✅ Found', emailCheckouts.length, 'checkouts by email');
    
    const supplierCheckouts = await checkoutRepo.findBySupplierId('vendor-123');
    console.log('✅ Found', supplierCheckouts.length, 'checkouts for supplier');
    
    const completedCheckouts = await checkoutRepo.findByStatus('completed');
    console.log('✅ Found', completedCheckouts.length, 'completed checkouts');
    
    const paymentCheckout = await checkoutRepo.findByPaymentIntentId(paymentIntent1.id);
    console.log('✅ Found checkout by payment intent:', paymentCheckout?.checkoutId ? 'Yes' : 'No');
    
    // Test 6: Analytics
    console.log('\nTest 6: Testing analytics...');
    
    const stats = await checkoutRepo.getCheckoutStats();
    console.log('✅ Checkout statistics:');
    console.log('   Total checkouts:', stats.total);
    console.log('   Completed:', stats.completed);
    console.log('   Abandoned:', stats.abandoned);
    console.log('   Failed:', stats.failed);
    console.log('   Started:', stats.started);
    console.log('   Completion rate:', stats.completionRate.toFixed(2) + '%');
    console.log('   Average value: $', stats.averageValue.toFixed(2));
    
    // Test 7: Abandoned checkout management
    console.log('\nTest 7: Testing abandoned checkout management...');
    
    // Create an old checkout
    const oldCheckout = await checkoutRepo.create({
      customer: createCustomer({
        type: 'person',
        firstName: 'Abandoned',
        lastName: 'User',
        phone: '+1111111111',
        email: 'abandoned@example.com',
        addressLine1: '789 Lost Street',
        suburb: 'Queens',
        state: 'NY',
        postCode: '11375',
        country: 'USA'
      }),
      supplierId: 'vendor-789',
      cartId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      paymentIntent: createPaymentIntent({
        provider: 'stripe',
        status: 'pending',
        subtotal: 99.99,
        platformFee: 3.00,
        merchantFee: 2.00
      }),
      status: 'started'
    });
    
    // Manually update createdAt to be 25 hours ago
    await db.collection('checkout').updateOne(
      { checkoutId: oldCheckout.checkoutId },
      { $set: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } }
    );
    
    const abandonedCount = await checkoutRepo.markAbandonedCheckouts(24);
    console.log('✅ Marked', abandonedCount, 'checkout(s) as abandoned');
    
    const abandonedCheckout = await checkoutRepo.findByCheckoutId(oldCheckout.checkoutId);
    console.log('   Old checkout status:', abandonedCheckout?.status);
    
    // Test 8: Show schema structure
    console.log('\n========================================');
    console.log('CHECKOUT SCHEMA STRUCTURE');
    console.log('========================================');
    console.log('\nRequired fields:');
    console.log('  - checkoutId: string (UUID v4)');
    console.log('  - status: "started" | "abandoned" | "failed" | "completed"');
    console.log('  - createdAt: Date');
    console.log('  - customer: Customer object');
    console.log('  - supplierId: string');
    console.log('  - cartId: string (UUID v4)');
    console.log('  - paymentIntent: PaymentIntent object');
    
    console.log('\nCustomer structure:');
    console.log('  - customerId: string (UUID v4)');
    console.log('  - type: "person" | "business"');
    console.log('  - firstName, lastName, phone, email: string');
    console.log('  - addressLine1, addressLine2?, suburb, state, postCode, country: string');
    console.log('  - businessName?, businessNumber?: string (required for business type)');
    
    console.log('\nPaymentIntent structure:');
    console.log('  - id: string');
    console.log('  - provider: string');
    console.log('  - data: array');
    console.log('  - status: string');
    console.log('  - subtotal: number');
    console.log('  - fees: {platformFee, merchantFee, totalFees}');
    console.log('  - totalAmount: number (computed: subtotal + totalFees)');
    
    console.log('\nComputed validations:');
    console.log('  - fees.totalFees = platformFee + merchantFee');
    console.log('  - paymentIntent.totalAmount = subtotal + totalFees');
    console.log('  - Business customers must have businessName and businessNumber');
    
    console.log('\n✅ All tests completed successfully!');
    
    // Cleanup - delete test checkouts
    console.log('\nCleaning up test data...');
    await checkoutRepo.delete(personCheckout.checkoutId);
    await checkoutRepo.delete(businessCheckout.checkoutId);
    await checkoutRepo.delete(abandonedCheckout!.checkoutId);
    console.log('✅ Test checkouts deleted');
    
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run the test
if (require.main === module) {
  testCheckoutSchema()
    .then(() => {
      console.log('\n✅ Checkout schema test complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Checkout schema test failed:', error);
      process.exit(1);
    });
}

export default testCheckoutSchema;