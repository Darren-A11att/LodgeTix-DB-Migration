import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'lodgetix_commerce';

async function testCommerceStructure() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log('🧪 Testing New Commerce Structure\n');
    
    // Create payment gateways
    const stripeGateways = [
      {
        name: 'Stripe Platform Account',
        code: 'stripe-platform',
        provider: 'stripe',
        account_type: 'platform',
        supported_payment_methods: ['card'],
        configuration: {
          stripe_account_id: 'acct_platform',
          test_mode: false
        },
        is_active: true,
        is_default: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Stripe Connect Account 1',
        code: 'stripe-connect-1',
        provider: 'stripe',
        account_type: 'connect',
        vendor_id: 'vendor_lodge_1',
        supported_payment_methods: ['card'],
        configuration: {
          stripe_account_id: 'acct_connect1',
          test_mode: false
        },
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Stripe Connect Account 2',
        code: 'stripe-connect-2',
        provider: 'stripe',
        account_type: 'connect',
        vendor_id: 'vendor_lodge_2',
        supported_payment_methods: ['card'],
        configuration: {
          stripe_account_id: 'acct_connect2',
          test_mode: false
        },
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    
    const squareGateway = {
      name: 'Square Account',
      code: 'square-main',
      provider: 'square',
      account_type: 'merchant',
      supported_payment_methods: ['card', 'cash'],
      configuration: {
        square_location_id: 'location_123',
        test_mode: false
      },
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Clear existing test data
    await db.collection('payment_gateways').deleteMany({ code: { $in: ['stripe-platform', 'stripe-connect-1', 'stripe-connect-2', 'square-main'] } });
    await db.collection('product_collections').deleteMany({ handle: 'annual-ball-2024' });
    await db.collection('products').deleteMany({ handle: { $in: ['annual-ball-2024-tickets', 'couples-package-2024'] } });
    
    // Insert gateways
    const gatewayResult = await db.collection('payment_gateways').insertMany([...stripeGateways, squareGateway]);
    console.log(`✓ Created ${gatewayResult.insertedCount} payment gateways`);
    
    // Create a vendor
    const vendor = {
      name: 'Grand Lodge Events',
      handle: 'grand-lodge-events',
      email: 'events@grandlodge.org',
      status: 'active',
      commission_rate: 10,
      payout_schedule: 'monthly',
      payment_gateway_ids: ['stripe-connect-1'],
      organisation_id: 'org_123',
      lodge_id: 'lodge_456',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await db.collection('vendors').deleteOne({ handle: 'grand-lodge-events' });
    const vendorResult = await db.collection('vendors').insertOne(vendor);
    console.log('✓ Created vendor: Grand Lodge Events');
    
    // Create a product collection (maps to LodgeTix function)
    const collection = {
      handle: 'annual-ball-2024',
      title: 'Annual Ball 2024',
      metadata: {
        lodgetix_function_id: 'function_123',
        venue: 'Grand Hotel',
        date: '2024-12-31'
      },
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const collectionResult = await db.collection('product_collections').insertOne(collection);
    console.log('✓ Created product collection: Annual Ball 2024');
    
    // Create a product with variants (maps to LodgeTix event)
    const product = {
      handle: 'annual-ball-2024-tickets',
      title: 'Annual Ball 2024 Tickets',
      description: 'Join us for our prestigious Annual Ball',
      status: 'published',
      type: 'variant',
      collection_id: collectionResult.insertedId.toString(),
      vendor_id: vendorResult.insertedId.toString(),
      
      // Product options (for attendee details)
      options: [
        {
          id: 'opt_name',
          title: 'Attendee Name',
          product_id: 'prod_ball_2024'
        },
        {
          id: 'opt_dietary',
          title: 'Dietary Requirements',
          product_id: 'prod_ball_2024'
        },
        {
          id: 'opt_table',
          title: 'Table Preference',
          product_id: 'prod_ball_2024'
        }
      ],
      
      // Variants (maps to LodgeTix eventTickets)
      variants: [
        {
          id: 'var_std',
          title: 'Standard Ticket',
          product_id: 'prod_ball_2024',
          sku: 'BALL-2024-STD',
          inventory_quantity: 100,
          manage_inventory: true,
          allow_backorder: false,
          prices: [
            {
              amount: 150000, // R1,500.00 in cents
              currency_code: 'ZAR',
              includes_tax: true
            }
          ],
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'var_vip',
          title: 'VIP Ticket',
          product_id: 'prod_ball_2024',
          sku: 'BALL-2024-VIP',
          inventory_quantity: 20,
          manage_inventory: true,
          allow_backorder: false,
          prices: [
            {
              amount: 300000, // R3,000.00 in cents
              currency_code: 'ZAR',
              includes_tax: true
            }
          ],
          created_at: new Date(),
          updated_at: new Date()
        }
      ],
      
      lodgetix_mapping: {
        event_id: 'event_456',
        function_id: 'function_123'
      },
      
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const productResult = await db.collection('products').insertOne(product);
    console.log('✓ Created product with 2 variants: Annual Ball 2024 Tickets');
    
    // Create a bundle product (maps to LodgeTix package)
    const bundleProduct = {
      handle: 'couples-package-2024',
      title: 'Couples Package - Annual Ball 2024',
      description: 'Special package for couples attending together - 10% discount',
      status: 'published',
      type: 'bundle',
      collection_id: collectionResult.insertedId.toString(),
      vendor_id: vendorResult.insertedId.toString(),
      
      bundle_items: [
        {
          product_id: productResult.insertedId.toString(),
          variant_id: 'var_std',
          quantity: 2,
          is_optional: false
        }
      ],
      
      prices: [
        {
          amount: 270000, // R2,700.00 (10% discount on 2x R1,500)
          currency_code: 'ZAR',
          includes_tax: true
        }
      ],
      
      lodgetix_mapping: {
        function_id: 'function_123',
        event_id: 'event_456'
      },
      
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const bundleResult = await db.collection('products').insertOne(bundleProduct);
    console.log('✓ Created bundle product: Couples Package');
    
    // Create stock location
    const stockLocation = {
      name: 'Main Venue',
      address: {
        address_1: '123 Lodge Street',
        city: 'Cape Town',
        country_code: 'ZA',
        postal_code: '8001'
      },
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await db.collection('stock_locations').deleteOne({ name: 'Main Venue' });
    const locationResult = await db.collection('stock_locations').insertOne(stockLocation);
    console.log('✓ Created stock location: Main Venue');
    
    // Create inventory items and levels
    for (const variant of product.variants) {
      const inventoryItem = {
        sku: variant.sku,
        requires_shipping: false,
        metadata: {
          product_id: productResult.insertedId.toString(),
          variant_id: variant.id
        },
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const itemResult = await db.collection('inventory_items').insertOne(inventoryItem);
      
      const inventoryLevel = {
        inventory_item_id: itemResult.insertedId.toString(),
        location_id: locationResult.insertedId.toString(),
        stocked_quantity: variant.inventory_quantity,
        reserved_quantity: 0,
        incoming_quantity: 0,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      await db.collection('inventory_levels').insertOne(inventoryLevel);
    }
    console.log('✓ Created inventory items and levels');
    
    // Create a sample payment record
    const payment = {
      amount: {
        amount: 150000,
        currency_code: 'ZAR',
        includes_tax: true
      },
      currency_code: 'ZAR',
      payment_method: 'card',
      gateway_id: 'stripe-connect-1',
      status: 'captured',
      customer_id: 'cust_789',
      captured_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await db.collection('payments').insertOne(payment);
    console.log('✓ Created sample payment record');
    
    console.log('\n✅ Commerce structure test completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- 4 Payment Gateways (3 Stripe, 1 Square)');
    console.log('- 1 Vendor (Grand Lodge Events)');
    console.log('- 1 Product Collection (Annual Ball 2024)');
    console.log('- 1 Product with 2 Variants (Standard & VIP tickets)');
    console.log('- 1 Bundle Product (Couples Package)');
    console.log('- 1 Stock Location');
    console.log('- 2 Inventory Items with levels');
    console.log('- 1 Sample Payment');
    
    console.log('\n🔗 Mapping Structure:');
    console.log('- LodgeTix Function → Product Collection');
    console.log('- LodgeTix Event → Product (with variants)');
    console.log('- LodgeTix EventTicket → Product Variant');
    console.log('- LodgeTix Package → Bundle Product');
    console.log('- LodgeTix Registration → Order');
    console.log('- LodgeTix Attendee → Order Line Item with Options');
    
  } catch (error) {
    console.error('❌ Error testing commerce structure:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the test
testCommerceStructure();