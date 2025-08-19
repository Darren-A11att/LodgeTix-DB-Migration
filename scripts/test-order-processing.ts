#!/usr/bin/env tsx

/**
 * Test script for order processing functionality
 * Verifies that registrations are correctly transformed into orders with tax calculations
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';
import { processOrdersFromRegistrations } from '../src/services/sync/order-processor';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testOrderProcessing() {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment variables');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('lodgetix');

    // Check collections
    console.log('\n📊 Collection Statistics:');
    
    const registrationsCount = await db.collection('import_registrations').countDocuments();
    console.log(`  import_registrations: ${registrationsCount}`);
    
    const customersCount = await db.collection('customers').countDocuments();
    console.log(`  customers: ${customersCount}`);
    
    const ordersCount = await db.collection('orders').countDocuments();
    console.log(`  orders: ${ordersCount}`);

    // Get a sample registration to test
    console.log('\n🔍 Finding sample registration...');
    const sampleRegistration = await db.collection('import_registrations')
      .findOne({ 
        paymentStatus: 'paid',
        'registrationData.tickets': { $exists: true, $ne: [] }
      });

    if (sampleRegistration) {
      console.log(`\n📝 Sample Registration:`);
      console.log(`  ID: ${sampleRegistration.registrationId}`);
      console.log(`  Name: ${sampleRegistration.firstName} ${sampleRegistration.lastName}`);
      console.log(`  Email: ${sampleRegistration.email}`);
      console.log(`  Tickets: ${sampleRegistration.registrationData?.tickets?.length || 0}`);
      
      // Calculate expected totals
      const tickets = sampleRegistration.registrationData?.tickets || [];
      const subtotal = tickets.reduce((sum: number, t: any) => sum + (t.price || 0), 0);
      const fees = sampleRegistration.fees || 0;
      const total = subtotal + fees;
      const gstAmount = total / 11; // 10% GST inclusive
      
      console.log(`\n💰 Expected Order Totals:`);
      console.log(`  Subtotal: $${subtotal.toFixed(2)}`);
      console.log(`  Fees: $${fees.toFixed(2)}`);
      console.log(`  GST (10% inc): $${gstAmount.toFixed(2)}`);
      console.log(`  Total: $${total.toFixed(2)}`);
    }

    // Test order processing with a small batch
    console.log('\n🚀 Testing order processing with first 5 registrations...');
    
    const testRegistrations = await db.collection('import_registrations')
      .find({ paymentStatus: 'paid' })
      .limit(5)
      .toArray();

    if (testRegistrations.length > 0) {
      const { ordersCreated, ordersSkipped, errors } = await processOrdersFromRegistrations(
        testRegistrations,
        db
      );

      console.log('\n📊 Test Results:');
      console.log(`  Orders created: ${ordersCreated}`);
      console.log(`  Orders skipped: ${ordersSkipped}`);
      console.log(`  Errors: ${errors.length}`);

      if (errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        errors.forEach(err => {
          console.log(`  - Registration ${err.registrationId}: ${err.error}`);
        });
      }

      // Verify an order was created correctly
      if (ordersCreated > 0) {
        const createdOrder = await db.collection('orders').findOne({}, { sort: { createdAt: -1 } });
        
        if (createdOrder) {
          console.log('\n✅ Sample Created Order:');
          console.log(`  Order ID: ${createdOrder.orderId}`);
          console.log(`  Customer ID: ${createdOrder.customerId}`);
          console.log(`  Items: ${createdOrder.orderedItems?.length || 0}`);
          console.log(`  Subtotal: $${createdOrder.subtotal?.toFixed(2)}`);
          console.log(`  GST: $${createdOrder.taxCalculation?.gstAmount?.toFixed(2)}`);
          console.log(`  Total: $${createdOrder.totalAmount?.toFixed(2)}`);
          console.log(`  Status: ${createdOrder.status}`);
          console.log(`  Payment Status: ${createdOrder.paymentStatus}`);
        }
      }
    } else {
      console.log('⚠️ No paid registrations found for testing');
    }

    // Final statistics
    console.log('\n📈 Final Collection Counts:');
    const finalOrdersCount = await db.collection('orders').countDocuments();
    console.log(`  Orders in database: ${finalOrdersCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Connection closed');
  }
}

// Run the test
testOrderProcessing().catch(console.error);