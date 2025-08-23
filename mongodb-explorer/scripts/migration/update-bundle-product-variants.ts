import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function updateBundleProductVariants() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔄 UPDATING BUNDLE PRODUCT VARIANTS & FORMS');
  console.log('='.repeat(80));
  
  try {
    const productsCollection = db.collection('products');
    const formsCollection = db.collection('forms');
    
    // Step 1: Update the bundle product with all variants including member
    console.log('\n📦 Updating bundle product variants...');
    
    const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
    if (!bundleProduct) {
      throw new Error('Bundle product not found');
    }
    
    // Define all registration and attendee types
    const registrationTypes = ['individual', 'lodge', 'grandLodge', 'masonicOrder'];
    const attendeeTypes = ['mason', 'partner', 'guest', 'member'];
    
    // Generate all variant combinations
    const variants: any[] = [];
    let variantIndex = 1;
    
    // Define pricing matrix
    const pricing: any = {
      individual: { mason: 250, partner: 200, guest: 200, member: 200 },
      lodge: { mason: 225, partner: 180, guest: 180, member: 225 },
      grandLodge: { mason: 200, partner: 160, guest: 160, member: 200 },
      masonicOrder: { mason: 200, partner: 160, guest: 160, member: 200 }
    };
    
    // SKU prefixes for attendee types
    const skuPrefixes: any = {
      mason: 'MAS',
      partner: 'PAR',
      guest: 'GUE',
      member: 'MEM'
    };
    
    // Registration type SKU codes
    const regSkuCodes: any = {
      individual: 'IND',
      lodge: 'LOD',
      grandLodge: 'GRA',
      masonicOrder: 'MAS'
    };
    
    for (const regType of registrationTypes) {
      for (const attType of attendeeTypes) {
        // Skip member for non-lodge registrations
        if (attType === 'member' && regType !== 'lodge') continue;
        // Skip guest/partner for certain combinations if needed
        
        const variant = {
          variantId: `${bundleProduct.productId}-${variantIndex}`,
          sku: `${bundleProduct.productId}-${skuPrefixes[attType]}-${regSkuCodes[regType]}`,
          name: `Grand Proclamation 2025 Registration (${regType} - ${attType})`,
          price: pricing[regType][attType] || 200,
          options: {
            registration: regType,
            attendee: attType
          },
          status: 'available',
          defaultQuantity: 1,
          customObject: {
            registrationForm: `form_${regType}_${attType}`,
            registrationType: regType,
            attendeeType: attType
          }
        };
        
        variants.push(variant);
        variantIndex++;
      }
    }
    
    // Update bundled products with isOptional and selected properties
    const bundledProducts = [
      {
        productId: '68a466d4ea54206b6fb3cd7b',
        isOptional: true,
        selected: false, // Default not selected
        quantity: 1,
        displayName: 'Grand Proclamation Banquet'
      },
      {
        productId: '68a466d4ea54206b6fb3cd7c',
        isOptional: true,
        selected: false,
        quantity: 1,
        displayName: 'Meet & Greet Cocktail Party'
      },
      {
        productId: '68a466d4ea54206b6fb3cd7d',
        isOptional: true,
        selected: false,
        quantity: 1,
        displayName: 'Farewell Cruise Luncheon'
      },
      {
        productId: '68a466d4ea54206b6fb3cd7e',
        isOptional: false, // Ceremony might be required
        selected: true,
        quantity: 1,
        displayName: 'Grand Proclamation Ceremony'
      },
      {
        productId: '68a466d4ea54206b6fb3cd7f',
        isOptional: true,
        selected: false,
        quantity: 1,
        displayName: 'Quarterly Communication'
      },
      {
        productId: '68a466d4ea54206b6fb3cd80',
        isOptional: true,
        selected: false,
        quantity: 1,
        displayName: 'Ladies Brunch'
      }
    ];
    
    // Update product options to include member
    const updatedOptions = [
      {
        name: 'registration',
        values: ['individual', 'lodge', 'grandLodge', 'masonicOrder'],
        required: true
      },
      {
        name: 'attendee',
        values: ['mason', 'partner', 'guest', 'member'],
        required: true
      }
    ];
    
    // Update the bundle product
    const updateResult = await productsCollection.updateOne(
      { _id: bundleProduct._id },
      {
        $set: {
          variants: variants,
          bundledProducts: bundledProducts,
          options: updatedOptions,
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`✅ Updated bundle product with ${variants.length} variants`);
    
    // Step 2: Create forms collection with form documents
    console.log('\n📝 Creating forms collection...');
    
    // Drop existing forms collection if it exists
    try {
      await db.collection('forms').drop();
      console.log('✅ Dropped existing forms collection');
    } catch (e) {
      // Collection doesn't exist, that's fine
    }
    
    // Create form documents for each variant
    const forms: any[] = [];
    
    for (const variant of variants) {
      const form = {
        formId: variant.customObject.registrationForm,
        name: `${variant.customObject.registrationType} ${variant.customObject.attendeeType} Registration Form`,
        type: 'registration',
        registrationType: variant.customObject.registrationType,
        attendeeType: variant.customObject.attendeeType,
        fields: getFormFields(variant.customObject.registrationType, variant.customObject.attendeeType),
        validationRules: getValidationRules(variant.customObject.registrationType, variant.customObject.attendeeType),
        displayOrder: forms.length + 1,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      forms.push(form);
    }
    
    if (forms.length > 0) {
      const insertResult = await formsCollection.insertMany(forms);
      console.log(`✅ Created ${insertResult.insertedCount} form documents`);
    }
    
    // Step 3: Update inventory links for event products
    console.log('\n🎫 Linking event tickets as inventory...');
    
    const eventsCollection = db.collection('products');
    const inventoryCollection = db.collection('inventory');
    
    // Create inventory items from event tickets
    const eventProducts = await eventsCollection.find({ type: 'product' }).toArray();
    
    for (const event of eventProducts) {
      // Check if inventory item exists
      const existingInventory = await inventoryCollection.findOne({ 
        productId: event.productId 
      });
      
      if (!existingInventory) {
        const inventoryItem = {
          inventoryId: `inv_${event.productId}`,
          productId: event.productId,
          productName: event.name,
          sku: `EVT-${event.productId.substring(0, 8).toUpperCase()}`,
          trackInventory: true,
          quantity: {
            available: event.capacity || 100,
            reserved: 0,
            sold: 0
          },
          lowStockThreshold: 10,
          allowBackorder: false,
          location: 'main',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await inventoryCollection.insertOne(inventoryItem);
        console.log(`✅ Created inventory for ${event.name}`);
      }
    }
    
    console.log('\n✅ Bundle product variant update completed!');
    
  } catch (error) {
    console.error('❌ Error updating bundle product:', error);
    throw error;
  } finally {
    await client.close();
  }
}

function getFormFields(registrationType: string, attendeeType: string): any[] {
  const commonFields = [
    { name: 'firstName', type: 'text', required: true, label: 'First Name' },
    { name: 'lastName', type: 'text', required: true, label: 'Last Name' },
    { name: 'email', type: 'email', required: true, label: 'Email' },
    { name: 'phone', type: 'tel', required: false, label: 'Phone' }
  ];
  
  const masonFields = [
    { name: 'lodgeName', type: 'text', required: true, label: 'Lodge Name' },
    { name: 'lodgeNumber', type: 'text', required: true, label: 'Lodge Number' },
    { name: 'rank', type: 'select', required: true, label: 'Rank', 
      options: ['EA', 'FC', 'MM', 'WM', 'PM', 'GL'] },
    { name: 'grandLodge', type: 'text', required: false, label: 'Grand Lodge' }
  ];
  
  const dietaryFields = [
    { name: 'dietary', type: 'select', required: false, label: 'Dietary Requirements',
      options: ['None', 'Vegetarian', 'Vegan', 'Gluten Free', 'Halal', 'Kosher', 'Other'] },
    { name: 'dietaryOther', type: 'text', required: false, label: 'Other Dietary Requirements',
      showIf: { field: 'dietary', value: 'Other' } }
  ];
  
  const accessibilityFields = [
    { name: 'accessibility', type: 'checkbox', required: false, label: 'Wheelchair Access Required' },
    { name: 'specialNeeds', type: 'textarea', required: false, label: 'Special Requirements' }
  ];
  
  const lodgeFields = [
    { name: 'lodgeName', type: 'text', required: true, label: 'Lodge Name' },
    { name: 'lodgeNumber', type: 'text', required: true, label: 'Lodge Number' },
    { name: 'lodgeAddress', type: 'text', required: true, label: 'Lodge Address' },
    { name: 'lodgeCity', type: 'text', required: true, label: 'City' },
    { name: 'lodgeState', type: 'text', required: true, label: 'State' },
    { name: 'lodgePostcode', type: 'text', required: true, label: 'Postcode' },
    { name: 'representativeName', type: 'text', required: true, label: 'Representative Name' },
    { name: 'representativeEmail', type: 'email', required: true, label: 'Representative Email' },
    { name: 'representativePhone', type: 'tel', required: true, label: 'Representative Phone' }
  ];
  
  // Build fields based on registration and attendee type
  let fields: any[] = [];
  
  if (registrationType === 'lodge' && attendeeType === 'mason') {
    // Lodge registration form
    fields = [...lodgeFields];
  } else {
    // Individual attendee forms
    fields = [...commonFields];
    
    if (attendeeType === 'mason' || attendeeType === 'member') {
      fields.push(...masonFields);
    }
    
    if (attendeeType === 'partner') {
      fields.push({ name: 'partnerOf', type: 'text', required: false, label: 'Partner Of' });
    }
    
    fields.push(...dietaryFields);
    fields.push(...accessibilityFields);
  }
  
  return fields;
}

function getValidationRules(registrationType: string, attendeeType: string): any {
  const rules: any = {
    email: {
      pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      message: 'Please enter a valid email address'
    },
    phone: {
      pattern: '^[0-9+\\s()-]+$',
      message: 'Please enter a valid phone number'
    }
  };
  
  if (registrationType === 'lodge') {
    rules.lodgeNumber = {
      pattern: '^[0-9]+$',
      message: 'Lodge number must be numeric'
    };
    rules.lodgePostcode = {
      pattern: '^[0-9]{4}$',
      message: 'Please enter a valid 4-digit postcode'
    };
  }
  
  return rules;
}

// Always run when this file is executed
updateBundleProductVariants()
  .then(() => {
    console.log('\n✅ Update completed!');
  })
  .catch(error => {
    console.error('\n❌ Update failed:', error);
  });