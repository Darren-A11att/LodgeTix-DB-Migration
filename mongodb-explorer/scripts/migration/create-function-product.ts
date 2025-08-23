import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { 
  Product, 
  ProductVariant, 
  BundledProduct,
  generateAllVariants,
  RegistrationFormMapping
} from './ecommerce-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function createFunctionRegistrationProduct() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🎯 CREATING GRAND PROCLAMATION 2025 REGISTRATION PRODUCT');
  console.log('='.repeat(80));
  
  try {
    // Step 1: Read function details
    console.log('\n📖 Step 1: Reading Grand Proclamation 2025 function...');
    const functionsCollection = db.collection('functions');
    const grandProclamation = await functionsCollection.findOne({
      title: { $regex: /grand proclamation/i }
    });
    
    if (!grandProclamation) {
      console.log('⚠️  Grand Proclamation function not found, using default values');
    } else {
      console.log(`✅ Found function: ${grandProclamation.title}`);
    }
    
    // Step 2: Read all events
    console.log('\n📖 Step 2: Reading events for bundling...');
    const eventsCollection = db.collection('events');
    const events = await eventsCollection.find({}).toArray();
    console.log(`✅ Found ${events.length} events to bundle`);
    
    // Step 3: Create the main product
    console.log('\n🏗️ Step 3: Creating bundle product structure...');
    
    const productId = grandProclamation?._id?.toString() || uuidv4();
    
    const functionProduct: Product = {
      productId,
      name: 'Grand Proclamation 2025 Registration',
      description: grandProclamation?.description || 'Annual Grand Proclamation registration including all events',
      type: 'bundle',
      status: 'available',
      display: true,
      price: 0, // Price will be calculated from variants
      
      // Define options
      options: [
        {
          name: 'registration',
          values: ['individual', 'lodge', 'grandLodge', 'masonicOrder'],
          required: true
        },
        {
          name: 'attendee',
          values: ['mason', 'partner', 'guest'],
          required: true
        }
      ],
      
      // Variants will be generated
      variants: [],
      
      // Bundle all events
      bundledProducts: events.map(event => ({
        productId: event._id.toString(),
        isOptional: true, // Events are optional within the registration
        quantity: 1,
        displayName: event.title
      })),
      
      // Metadata
      sourceId: grandProclamation?._id?.toString(),
      sourceType: 'function',
      imageUrl: grandProclamation?.imageUrl,
      tags: ['registration', 'grand-proclamation', '2025'],
      category: 'registration',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Step 4: Generate all variants
    console.log('\n🔄 Step 4: Generating all variant combinations...');
    const variants = generateAllVariants(functionProduct);
    
    // Add custom pricing and registration forms for each variant
    variants.forEach(variant => {
      const [registrationType, attendeeType] = Object.values(variant.options);
      
      // Set pricing based on registration and attendee type
      variant.price = calculateVariantPrice(registrationType, attendeeType);
      
      // Add registration form mapping
      variant.customObject = {
        registrationForm: `form_${registrationType}_${attendeeType}`,
        registrationType,
        attendeeType
      };
      
      console.log(`  ✅ Created variant: ${variant.name} - $${variant.price}`);
    });
    
    functionProduct.variants = variants;
    
    // Step 5: Create registration form mappings
    console.log('\n📝 Step 5: Creating registration form mappings...');
    const formMappings: RegistrationFormMapping[] = [];
    
    variants.forEach(variant => {
      const [registrationType, attendeeType] = Object.values(variant.options);
      
      const formMapping: RegistrationFormMapping = {
        formId: variant.customObject?.registrationForm || '',
        variantId: variant.variantId,
        registrationType: registrationType as any,
        attendeeType: attendeeType as any,
        formTitle: `${registrationType} ${attendeeType} Registration Form`,
        formDescription: `Registration form for ${registrationType} ${attendeeType} attendees`,
        fields: getFormFields(registrationType, attendeeType),
        submitButtonText: 'Complete Registration',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      formMappings.push(formMapping);
    });
    
    // Step 6: Save to database
    console.log('\n💾 Step 6: Saving to MongoDB...');
    
    // Create products collection if it doesn't exist
    const productsCollection = db.collection('products');
    
    // Check if product already exists
    const existingProduct = await productsCollection.findOne({ productId });
    if (existingProduct) {
      console.log('⚠️  Product already exists, updating...');
      await productsCollection.replaceOne(
        { productId },
        functionProduct
      );
    } else {
      await productsCollection.insertOne(functionProduct);
    }
    console.log('✅ Product saved to products collection');
    
    // Save form mappings
    const formsCollection = db.collection('registrationFormMappings');
    if (formMappings.length > 0) {
      // Clear existing mappings for this product
      await formsCollection.deleteMany({ 
        variantId: { $in: variants.map(v => v.variantId) }
      });
      
      await formsCollection.insertMany(formMappings);
      console.log(`✅ Created ${formMappings.length} registration form mappings`);
    }
    
    // Step 7: Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 PRODUCT CREATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Product: ${functionProduct.name}`);
    console.log(`   ID: ${functionProduct.productId}`);
    console.log(`   Type: ${functionProduct.type}`);
    console.log(`   Status: ${functionProduct.status}`);
    console.log(`   Variants: ${functionProduct.variants.length}`);
    console.log(`   Bundled Events: ${functionProduct.bundledProducts?.length || 0}`);
    
    console.log('\n📋 Variants Created:');
    variants.forEach((v, i) => {
      console.log(`   ${i + 1}. ${v.name}`);
      console.log(`      SKU: ${v.sku}`);
      console.log(`      Price: $${v.price}`);
      console.log(`      Form: ${v.customObject?.registrationForm}`);
    });
    
    console.log('\n🎁 Bundled Events:');
    functionProduct.bundledProducts?.forEach((bp, i) => {
      console.log(`   ${i + 1}. ${bp.displayName} (${bp.isOptional ? 'Optional' : 'Required'})`);
    });
    
    return functionProduct;
    
  } catch (error) {
    console.error('❌ Error creating product:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Helper function to calculate variant pricing
function calculateVariantPrice(registrationType: string, attendeeType: string): number {
  const basePrices: Record<string, number> = {
    individual_mason: 250,
    individual_partner: 200,
    individual_guest: 200,
    lodge_mason: 225,
    lodge_partner: 180,
    lodge_guest: 180,
    grandLodge_mason: 200,
    grandLodge_partner: 160,
    grandLodge_guest: 160,
    masonicOrder_mason: 200,
    masonicOrder_partner: 160,
    masonicOrder_guest: 160
  };
  
  const key = `${registrationType}_${attendeeType}`;
  return basePrices[key] || 250;
}

// Helper function to get form fields based on variant
function getFormFields(registrationType: string, attendeeType: string): any[] {
  const baseFields = [
    { fieldName: 'firstName', fieldType: 'text', required: true },
    { fieldName: 'lastName', fieldType: 'text', required: true },
    { fieldName: 'email', fieldType: 'email', required: true },
    { fieldName: 'phone', fieldType: 'tel', required: true }
  ];
  
  const masonFields = [
    { fieldName: 'lodgeNumber', fieldType: 'text', required: true },
    { fieldName: 'lodgeName', fieldType: 'text', required: true },
    { fieldName: 'rank', fieldType: 'select', required: true },
    { fieldName: 'yearInitiated', fieldType: 'number', required: false }
  ];
  
  const partnerFields = [
    { fieldName: 'linkedMasonName', fieldType: 'text', required: true },
    { fieldName: 'relationship', fieldType: 'select', required: true }
  ];
  
  const guestFields = [
    { fieldName: 'invitedBy', fieldType: 'text', required: true },
    { fieldName: 'relationship', fieldType: 'text', required: false }
  ];
  
  const organizationFields = [
    { fieldName: 'organizationName', fieldType: 'text', required: true },
    { fieldName: 'organizationRole', fieldType: 'text', required: true },
    { fieldName: 'organizationId', fieldType: 'text', required: false }
  ];
  
  // Build field list based on variant
  let fields = [...baseFields];
  
  // Add attendee type specific fields
  if (attendeeType === 'mason') {
    fields = [...fields, ...masonFields];
  } else if (attendeeType === 'partner') {
    fields = [...fields, ...partnerFields];
  } else if (attendeeType === 'guest') {
    fields = [...fields, ...guestFields];
  }
  
  // Add organization fields for non-individual registrations
  if (registrationType !== 'individual') {
    fields = [...fields, ...organizationFields];
  }
  
  // Add common optional fields
  fields.push(
    { fieldName: 'dietaryRequirements', fieldType: 'textarea', required: false },
    { fieldName: 'specialNeeds', fieldType: 'textarea', required: false },
    { fieldName: 'notes', fieldType: 'textarea', required: false }
  );
  
  return fields;
}

// Export for testing
export { createFunctionRegistrationProduct };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createFunctionRegistrationProduct()
    .then(() => {
      console.log('\n✅ Function registration product created successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Failed to create product:', error);
      process.exit(1);
    });
}