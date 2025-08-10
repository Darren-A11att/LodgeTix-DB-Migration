import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'lodgetix_commerce';

export async function createCommerceIndexes(db: Db): Promise<void> {
  console.log('Creating commerce indexes...');
  
  // Product indexes
  await db.collection('products').createIndexes([
    { key: { handle: 1 }, unique: true, sparse: true },
    { key: { status: 1 } },
    { key: { type: 1 } },
    { key: { vendor_id: 1 } },
    { key: { collection_id: 1 } },
    { key: { category_ids: 1 } },
    { key: { tags: 1 } },
    { key: { 'lodgetix_mapping.function_id': 1 } },
    { key: { 'lodgetix_mapping.event_id': 1 } },
    { key: { created_at: -1 } }
  ]);
  console.log('✓ Product indexes created');
  
  // Product Collection indexes
  await db.collection('product_collections').createIndexes([
    { key: { handle: 1 }, unique: true, sparse: true },
    { key: { created_at: -1 } }
  ]);
  console.log('✓ Product Collection indexes created');
  
  // Product Category indexes
  await db.collection('product_categories').createIndexes([
    { key: { handle: 1 }, unique: true, sparse: true },
    { key: { parent_category_id: 1 } },
    { key: { rank: 1 } }
  ]);
  console.log('✓ Product Category indexes created');
  
  // Product Variant indexes
  await db.collection('product_variants').createIndexes([
    { key: { product_id: 1 } },
    { key: { sku: 1 }, unique: true, sparse: true },
    { key: { barcode: 1 }, sparse: true },
    { key: { inventory_quantity: 1 } }
  ]);
  console.log('✓ Product Variant indexes created');
  
  // Payment Gateway indexes
  await db.collection('payment_gateways').createIndexes([
    { key: { code: 1 }, unique: true, sparse: true },
    { key: { provider: 1 } },
    { key: { account_type: 1 } },
    { key: { vendor_id: 1 } },
    { key: { is_active: 1 } },
    { key: { is_default: 1 } }
  ]);
  console.log('✓ Payment Gateway indexes created');
  
  // Payment Gateway Account indexes
  await db.collection('payment_gateway_accounts').createIndexes([
    { key: { gateway_id: 1 } },
    { key: { account_identifier: 1 }, unique: true, sparse: true },
    { key: { vendor_id: 1 } },
    { key: { is_active: 1 } }
  ]);
  console.log('✓ Payment Gateway Account indexes created');
  
  // Payment indexes
  await db.collection('payments').createIndexes([
    { key: { order_id: 1 } },
    { key: { cart_id: 1 } },
    { key: { customer_id: 1 } },
    { key: { status: 1 } },
    { key: { gateway_id: 1 } },
    { key: { provider_id: 1 }, sparse: true },
    { key: { created_at: -1 } }
  ]);
  console.log('✓ Payment indexes created');
  
  // Inventory Item indexes
  await db.collection('inventory_items').createIndexes([
    { key: { sku: 1 }, sparse: true },
    { key: { created_at: -1 } }
  ]);
  console.log('✓ Inventory Item indexes created');
  
  // Inventory Level indexes
  await db.collection('inventory_levels').createIndexes([
    { key: { inventory_item_id: 1, location_id: 1 }, unique: true, sparse: true },
    { key: { location_id: 1 } },
    { key: { stocked_quantity: 1 } }
  ]);
  console.log('✓ Inventory Level indexes created');
  
  // Reservation Item indexes
  await db.collection('reservation_items').createIndexes([
    { key: { inventory_item_id: 1 } },
    { key: { location_id: 1 } },
    { key: { line_item_id: 1 }, sparse: true },
    { key: { created_at: -1 } }
  ]);
  console.log('✓ Reservation Item indexes created');
  
  // Stock Location indexes
  await db.collection('stock_locations').createIndexes([
    { key: { name: 1 } },
    { key: { created_at: -1 } }
  ]);
  console.log('✓ Stock Location indexes created');
  
  // Vendor indexes
  await db.collection('vendors').createIndexes([
    { key: { handle: 1 }, unique: true, sparse: true },
    { key: { email: 1 }, sparse: true },
    { key: { status: 1 } },
    { key: { organisation_id: 1 }, sparse: true },
    { key: { lodge_id: 1 }, sparse: true },
    { key: { created_at: -1 } }
  ]);
  console.log('✓ Vendor indexes created');
  
  // Vendor User indexes
  await db.collection('vendor_users').createIndexes([
    { key: { vendor_id: 1, user_id: 1 }, unique: true, sparse: true },
    { key: { user_id: 1 } },
    { key: { role: 1 } },
    { key: { is_active: 1 } }
  ]);
  console.log('✓ Vendor User indexes created');
  
  console.log('\n✅ All commerce indexes created successfully');
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    await createCommerceIndexes(db);
    
  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default createCommerceIndexes;