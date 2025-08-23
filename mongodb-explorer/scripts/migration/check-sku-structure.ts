import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function checkSkuStructure() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('✅ SKU STRUCTURE VERIFICATION');
  console.log('='.repeat(80));
  
  try {
    const productsCollection = db.collection('products');
    const inventoryCollection = db.collection('inventory');
    const countersCollection = db.collection('counters');
    
    // Check counter
    const counter = await countersCollection.findOne({ _id: 'sku_counter' });
    console.log('\n📊 SKU Counter:');
    console.log(`  Current sequence: ${counter?.sequence_value}`);
    
    // Check bundle product SKUs
    const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
    if (bundleProduct) {
      console.log('\n📦 BUNDLE PRODUCT SKUs:');
      console.log(`  Main SKU: ${bundleProduct.sku || 'Not set'}`);
      
      console.log('\n  Variant SKUs (sample):');
      bundleProduct.variants?.slice(0, 5).forEach((v: any, i: number) => {
        console.log(`    ${i + 1}. ${v.sku}`);
        console.log(`       → ${v.options.registration}/${v.options.attendee} - $${v.price}`);
      });
      
      if (bundleProduct.variants?.length > 5) {
        console.log(`    ... and ${bundleProduct.variants.length - 5} more variants`);
      }
    }
    
    // Check event product SKUs
    console.log('\n🎫 EVENT PRODUCT SKUs:');
    const eventProducts = await productsCollection.find({ type: 'product' }).toArray();
    eventProducts.forEach((e: any) => {
      console.log(`  - ${e.sku}: ${e.name}`);
    });
    
    // Check package product SKUs
    console.log('\n📦 PACKAGE PRODUCT SKUs:');
    const packageProducts = await productsCollection.find({ type: 'multiPart' }).toArray();
    packageProducts.forEach((p: any) => {
      console.log(`  - ${p.sku}: ${p.name}`);
    });
    
    // Check inventory SKUs
    console.log('\n🎯 INVENTORY SKUs (sample):');
    const inventoryItems = await inventoryCollection.find().limit(3).toArray();
    inventoryItems.forEach((item: any) => {
      console.log(`  - ${item.sku}: ${item.productName || 'Unknown'}`);
      if (item.productSku) {
        console.log(`    Links to product SKU: ${item.productSku}`);
      }
    });
    
    // Verify uniqueness
    console.log('\n🔐 SKU UNIQUENESS CHECK:');
    
    // Check for duplicate SKUs in products
    const allProductSkus: string[] = [];
    const products = await productsCollection.find().toArray();
    
    products.forEach((p: any) => {
      if (p.sku) allProductSkus.push(p.sku);
      if (p.variants) {
        p.variants.forEach((v: any) => {
          if (v.sku) allProductSkus.push(v.sku);
        });
      }
    });
    
    const uniqueSkus = new Set(allProductSkus);
    const hasDuplicates = allProductSkus.length !== uniqueSkus.size;
    
    if (hasDuplicates) {
      console.log('  ❌ Duplicate SKUs found!');
    } else {
      console.log('  ✅ All SKUs are unique');
      console.log(`  Total unique SKUs: ${uniqueSkus.size}`);
    }
    
    // SKU format guide
    console.log('\n📋 SKU FORMAT GUIDE:');
    console.log('  REG-XXX-YYY-#### : Registration bundles');
    console.log('    XXX = Registration type (IND/LOD/GRL/MAS)');
    console.log('    YYY = Attendee type (MSN/PTR/GST/MBR)');
    console.log('  EVT-XXX-#### : Event products');
    console.log('    XXX = First 3 letters of event name');
    console.log('  PKG-XXX-#### : Package products');
    console.log('    XXX = First 3 letters of package name');
    console.log('  INV-[ProductSKU] : Inventory items');
    
    console.log('\n✅ SKU structure verification complete!');
    
  } catch (error) {
    console.error('❌ Error checking SKU structure:', error);
  } finally {
    await client.close();
  }
}

// Always run when this file is executed
checkSkuStructure()
  .then(() => {
    console.log('\n✅ Check completed!');
  })
  .catch(error => {
    console.error('\n❌ Check failed:', error);
  });