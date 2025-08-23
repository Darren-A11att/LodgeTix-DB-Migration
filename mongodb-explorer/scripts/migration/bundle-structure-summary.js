const { MongoClient, ObjectId } = require('mongodb');
const { config } = require('dotenv');
const path = require('path');

// Load environment variables from parent directory
config({ path: path.join(__dirname, '../../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'lodgetix';

async function showBundleStructureSummary() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('=== BUNDLE PRODUCT STRUCTURE SUMMARY ===\n');
    
    const db = client.db(DATABASE_NAME);
    const productsCollection = db.collection('products');
    
    // Get the bundle product
    const bundleProducts = await productsCollection.find({ type: 'bundle' }).toArray();
    
    if (bundleProducts.length === 0) {
      console.log('❌ No bundle products found');
      return;
    }
    
    for (const bundle of bundleProducts) {
      console.log(`📦 Bundle Product: ${bundle.name}`);
      console.log(`   ID: ${bundle._id}`);
      console.log(`   Price: $${bundle.price}`);
      console.log(`   Status: ${bundle.status}`);
      console.log(`   Description: ${bundle.description}\n`);
      
      console.log('🔗 bundledProducts Structure:');
      
      if (!bundle.bundledProducts || bundle.bundledProducts.length === 0) {
        console.log('   ❌ No bundledProducts array');
      } else {
        console.log(`   Array Length: ${bundle.bundledProducts.length}`);
        
        for (let i = 0; i < bundle.bundledProducts.length; i++) {
          const bp = bundle.bundledProducts[i];
          console.log(`\n   [${i}] bundledProduct:`);
          console.log(`       productId: "${bp.productId}" (${bp.productId ? '✅' : '❌'})`);
          console.log(`       isOptional: ${bp.isOptional} (${typeof bp.isOptional === 'boolean' ? '✅' : '❌'})`);
          console.log(`       quantity: ${bp.quantity} (${bp.quantity ? '✅' : '❌'})`);
          console.log(`       displayName: "${bp.displayName}" (${bp.displayName ? '✅' : '❌'})`);
          
          // Verify referenced product exists
          try {
            const referencedProduct = await productsCollection.findOne({ 
              _id: new ObjectId(bp.productId) 
            });
            if (referencedProduct) {
              console.log(`       → References: "${referencedProduct.name}" ($${referencedProduct.price}) ✅`);
            } else {
              console.log(`       → Referenced product not found ❌`);
            }
          } catch (error) {
            console.log(`       → Invalid productId format ❌`);
          }
        }
      }
      
      console.log('\n' + '='.repeat(60) + '\n');
      
      // Show the complete JSON structure
      console.log('📋 Complete Bundle Product JSON:');
      console.log(JSON.stringify(bundle, null, 2));
      
      console.log('\n' + '='.repeat(60) + '\n');
      
      // Show validation results
      console.log('✅ Validation Results:');
      const validation = validateBundleStructure(bundle);
      
      for (const result of validation.checks) {
        console.log(`   ${result.status} ${result.field}: ${result.message}`);
      }
      
      console.log(`\n   Overall Status: ${validation.isValid ? '✅ VALID' : '❌ INVALID'}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

function validateBundleStructure(bundle) {
  const checks = [];
  let isValid = true;
  
  // Check basic bundle fields
  checks.push({
    field: 'name',
    status: bundle.name ? '✅' : '❌',
    message: bundle.name ? `"${bundle.name}"` : 'Missing name'
  });
  
  checks.push({
    field: 'type',
    status: bundle.type === 'bundle' ? '✅' : '❌',
    message: bundle.type === 'bundle' ? '"bundle"' : `Expected "bundle", got "${bundle.type}"`
  });
  
  checks.push({
    field: 'bundledProducts',
    status: Array.isArray(bundle.bundledProducts) ? '✅' : '❌',
    message: Array.isArray(bundle.bundledProducts) ? 
      `Array with ${bundle.bundledProducts.length} items` : 
      'Not an array or missing'
  });
  
  if (Array.isArray(bundle.bundledProducts)) {
    bundle.bundledProducts.forEach((bp, index) => {
      const prefix = `bundledProducts[${index}]`;
      
      checks.push({
        field: `${prefix}.productId`,
        status: bp.productId ? '✅' : '❌',
        message: bp.productId ? 'Present' : 'Missing'
      });
      
      checks.push({
        field: `${prefix}.isOptional`,
        status: typeof bp.isOptional === 'boolean' ? '✅' : '❌',
        message: typeof bp.isOptional === 'boolean' ? `${bp.isOptional}` : 'Not a boolean'
      });
      
      checks.push({
        field: `${prefix}.quantity`,
        status: typeof bp.quantity === 'number' && bp.quantity > 0 ? '✅' : '❌',
        message: typeof bp.quantity === 'number' && bp.quantity > 0 ? 
          `${bp.quantity}` : 'Not a positive number'
      });
      
      checks.push({
        field: `${prefix}.displayName`,
        status: bp.displayName ? '✅' : '❌',
        message: bp.displayName ? `"${bp.displayName}"` : 'Missing'
      });
    });
  }
  
  // Check if any validation failed
  isValid = checks.every(check => check.status === '✅');
  
  return { isValid, checks };
}

showBundleStructureSummary().catch(console.error);