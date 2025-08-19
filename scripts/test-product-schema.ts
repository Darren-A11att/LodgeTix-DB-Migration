import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ProductRepository, createProduct, generateVariantsFromOptions, validateProduct } from '../src/models/product';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function testProductSchema() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    const productRepo = new ProductRepository(db);
    
    console.log('\n========================================');
    console.log('PRODUCT SCHEMA TEST');
    console.log('========================================\n');
    
    // Test 1: Create a simple product
    console.log('Test 1: Creating a simple product...');
    const simpleProduct = await productRepo.create({
      name: 'Basic T-Shirt',
      status: 'active',
      type: 'physical',
      description: 'A comfortable cotton t-shirt',
      createdAt: new Date(),
      lastModifiedAt: new Date()
    });
    console.log('✅ Simple product created:', simpleProduct.productId);
    
    // Test 2: Create a product with options and variants
    console.log('\nTest 2: Creating a product with options and variants...');
    const options = [
      { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
      { name: 'Color', values: ['Black', 'White', 'Blue'] }
    ];
    
    // Generate variants from options
    const generatedVariants = generateVariantsFromOptions(
      options.map(opt => ({ id: `opt-${opt.name.toLowerCase()}`, ...opt })),
      29.99
    );
    
    const complexProduct = await productRepo.create({
      name: 'Premium T-Shirt',
      status: 'active',
      type: 'physical',
      description: 'Premium quality t-shirt with multiple options',
      options: options.map(opt => ({
        id: `opt-${opt.name.toLowerCase()}`,
        name: opt.name,
        values: opt.values
      })),
      variants: generatedVariants.map((v, i) => ({
        ...v,
        id: `var-${i + 1}`
      })),
      collection: [
        { id: 'col-1', name: 'Summer Collection 2024' },
        { id: 'col-2', name: 'Best Sellers' }
      ],
      category: [
        { id: 'cat-1', name: 'Apparel', parent: null },
        { id: 'cat-2', name: 'T-Shirts', parent: 'cat-1' }
      ],
      images: [
        { id: 'img-1', url: 'https://example.com/tshirt-1.jpg', alternateText: 'Front view' },
        { id: 'img-2', url: 'https://example.com/tshirt-2.jpg', alternateText: 'Back view' }
      ],
      createdAt: new Date(),
      lastModifiedAt: new Date()
    });
    
    console.log('✅ Complex product created:', complexProduct.productId);
    console.log('   Generated', complexProduct.variants?.length, 'variants from options');
    
    // Test 3: Validate product structure
    console.log('\nTest 3: Testing validation...');
    
    // Invalid product (missing required fields)
    const invalidProduct = {
      name: 'Invalid Product'
      // Missing status, type, and productId
    };
    
    const validation = validateProduct(invalidProduct);
    console.log('❌ Invalid product validation:', validation.valid ? 'PASSED' : 'FAILED (as expected)');
    if (!validation.valid) {
      console.log('   Errors:', validation.errors.slice(0, 3).join(', '));
    }
    
    // Test 4: Find products by various criteria
    console.log('\nTest 4: Finding products...');
    
    const activeProducts = await productRepo.findByStatus('active');
    console.log('✅ Found', activeProducts.length, 'active products');
    
    const productById = await productRepo.findByProductId(simpleProduct.productId);
    console.log('✅ Found product by ID:', productById?.name);
    
    // Test 5: Update a product
    console.log('\nTest 5: Updating a product...');
    const updated = await productRepo.update(simpleProduct.productId, {
      status: 'inactive',
      description: 'Updated description - product discontinued'
    });
    console.log('✅ Product updated:', updated?.status);
    
    // Test 6: Show product structure
    console.log('\n========================================');
    console.log('PRODUCT SCHEMA STRUCTURE');
    console.log('========================================');
    console.log('\nRequired fields:');
    console.log('  - productId: string (UUID v4, unique)');
    console.log('  - name: string');
    console.log('  - status: string');
    console.log('  - type: string');
    
    console.log('\nOptional fields:');
    console.log('  - description: string | null');
    console.log('  - options: Array<{id, name, values[]}>');
    console.log('  - variants: Array<{id, name, price, inventoryItem?, inventoryAvailable?}>');
    console.log('  - collection: Array<{id, name}>');
    console.log('  - category: Array<{id, name, parent?}>');
    console.log('  - images: Array<{id, url, alternateText?}>');
    
    console.log('\n✅ All tests completed successfully!');
    
    // Cleanup - delete test products
    console.log('\nCleaning up test data...');
    await productRepo.delete(simpleProduct.productId);
    await productRepo.delete(complexProduct.productId);
    console.log('✅ Test products deleted');
    
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run the test
if (require.main === module) {
  testProductSchema()
    .then(() => {
      console.log('\n✅ Product schema test complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Product schema test failed:', error);
      process.exit(1);
    });
}

export default testProductSchema;