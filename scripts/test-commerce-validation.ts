import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'lodgetix_commerce';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

async function testCommerceValidation() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    
    console.log('\n🧪 Testing Commerce Validation Rules\n');
    
    // Test 1: Valid product
    console.log('Test 1: Inserting valid product...');
    try {
      const validProduct = {
        name: 'Test Product',
        description: 'A test product',
        status: 'active',
        type: 'physical',
        pricing_type: 'fixed',
        price: 29.99,
        cost: 15.00,
        sku: 'TEST-001',
        inventory_tracking: true,
        stock_quantity: 100,
        allow_backorder: false,
        shipping_class: 'standard',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await db.collection('products').insertOne(validProduct);
      console.log('✅ Valid product inserted successfully:', result.insertedId);
    } catch (error: any) {
      console.error('❌ Failed to insert valid product:', error.message);
    }
    
    // Test 2: Invalid product status
    console.log('\nTest 2: Inserting product with invalid status...');
    try {
      const invalidProduct = {
        name: 'Invalid Product',
        status: 'invalid_status', // Invalid enum value
        type: 'physical',
        pricing_type: 'fixed',
        price: 29.99,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await db.collection('products').insertOne(invalidProduct);
      console.log('⚠️  Product with invalid status inserted (validation warning):', result.insertedId);
    } catch (error: any) {
      console.error('❌ Failed to insert product with invalid status:', error.message);
    }
    
    // Test 3: Product with negative price
    console.log('\nTest 3: Inserting product with negative price...');
    try {
      const negativePrice = {
        name: 'Negative Price Product',
        status: 'active',
        type: 'physical',
        pricing_type: 'fixed',
        price: -10, // Invalid: negative price
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await db.collection('products').insertOne(negativePrice);
      console.log('⚠️  Product with negative price inserted (validation warning):', result.insertedId);
    } catch (error: any) {
      console.error('❌ Failed to insert product with negative price:', error.message);
    }
    
    // Test 4: Valid vendor
    console.log('\nTest 4: Inserting valid vendor...');
    try {
      const validVendor = {
        name: 'Test Vendor',
        email: 'vendor@example.com',
        status: 'active',
        type: 'business',
        commission_rate: 15,
        payment_terms: 'net_30',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await db.collection('vendors').insertOne(validVendor);
      console.log('✅ Valid vendor inserted successfully:', result.insertedId);
    } catch (error: any) {
      console.error('❌ Failed to insert valid vendor:', error.message);
    }
    
    // Test 5: Vendor with invalid commission rate
    console.log('\nTest 5: Inserting vendor with commission > 100%...');
    try {
      const invalidCommission = {
        name: 'High Commission Vendor',
        email: 'high@example.com',
        status: 'active',
        type: 'business',
        commission_rate: 150, // Invalid: > 100
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await db.collection('vendors').insertOne(invalidCommission);
      console.log('⚠️  Vendor with invalid commission inserted (validation warning):', result.insertedId);
    } catch (error: any) {
      console.error('❌ Failed to insert vendor with invalid commission:', error.message);
    }
    
    // Test 6: Valid order
    console.log('\nTest 6: Inserting valid order...');
    try {
      const validOrder = {
        order_number: 'ORD-2025-001',
        customer_id: 'cust_123',
        status: 'pending',
        payment_status: 'unpaid',
        fulfillment_status: 'unfulfilled',
        currency: 'USD',
        subtotal: 100,
        tax_total: 10,
        shipping_total: 5,
        discount_total: 0,
        total: 115,
        items: [],
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await db.collection('orders').insertOne(validOrder);
      console.log('✅ Valid order inserted successfully:', result.insertedId);
    } catch (error: any) {
      console.error('❌ Failed to insert valid order:', error.message);
    }
    
    console.log('\n✅ Validation tests completed!');
    console.log('Note: With validationLevel: "moderate" and validationAction: "warn",');
    console.log('invalid documents are still inserted but warnings are logged.');
    
  } catch (error) {
    console.error('Error testing validation:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run if executed directly
if (require.main === module) {
  testCommerceValidation().catch(console.error);
}

export default testCommerceValidation;