import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function consolidatePartnerToGuest() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔄 CONSOLIDATING PARTNER INTO GUEST PRODUCT OPTION');
  console.log('='.repeat(80));
  
  try {
    const productsCollection = db.collection('products');
    const countersCollection = db.collection('counters');
    const formsCollection = db.collection('forms');
    
    // Get the bundle product
    const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
    if (!bundleProduct) {
      throw new Error('Bundle product not found');
    }
    
    console.log('\n📦 Current Product Options:');
    console.log('Registration types:', bundleProduct.options[0].values);
    console.log('Attendee types:', bundleProduct.options[1].values);
    
    // Function to get next SKU number
    async function getNextSkuNumber(): Promise<number> {
      const result = await countersCollection.findOneAndUpdate(
        { _id: 'sku_counter' as any },
        { $inc: { sequence_value: 1 } },
        { returnDocument: 'after' }
      );
      return result?.sequence_value || 1000;
    }
    
    // Define new structure with only mason, guest, member
    const registrationTypes = ['individual', 'lodge', 'grandLodge', 'masonicOrder'];
    const attendeeTypes = ['mason', 'guest', 'member']; // Removed 'partner'
    
    // SKU prefixes
    const skuPrefixes: any = {
      bundle: 'REG'
    };
    
    // Registration type codes
    const regCodes: any = {
      individual: 'IND',
      lodge: 'LOD',
      grandLodge: 'GRL',
      masonicOrder: 'MAS'
    };
    
    // Updated attendee type codes (partner becomes guest)
    const attCodes: any = {
      mason: 'MSN',
      guest: 'GST', // Partners will use guest
      member: 'MBR'
    };
    
    // Generate new variants
    const variants: any[] = [];
    let variantIndex = 1;
    
    // Define pricing matrix (partner prices become guest prices)
    const pricing: any = {
      individual: { mason: 250, guest: 200, member: 200 },
      lodge: { mason: 225, guest: 180, member: 225 },
      grandLodge: { mason: 200, guest: 160, member: 200 },
      masonicOrder: { mason: 200, guest: 160, member: 200 }
    };
    
    for (const regType of registrationTypes) {
      for (const attType of attendeeTypes) {
        // Skip member for non-lodge registrations
        if (attType === 'member' && regType !== 'lodge') continue;
        
        const skuNumber = await getNextSkuNumber();
        const sku = `${skuPrefixes.bundle}-${regCodes[regType]}-${attCodes[attType]}-${skuNumber}`;
        
        const variant = {
          variantId: `${bundleProduct.productId}-${variantIndex}`,
          sku: sku,
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
    
    // Update product options to remove partner
    const updatedOptions = [
      {
        name: 'registration',
        values: ['individual', 'lodge', 'grandLodge', 'masonicOrder'],
        required: true
      },
      {
        name: 'attendee',
        values: ['mason', 'guest', 'member'], // Removed partner
        required: true
      }
    ];
    
    // Update the bundle product
    const updateResult = await productsCollection.updateOne(
      { _id: bundleProduct._id },
      {
        $set: {
          variants: variants,
          options: updatedOptions,
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`\n✅ Updated bundle product with ${variants.length} variants`);
    console.log('\n📊 New Variant Structure:');
    console.log('  Individual: mason, guest');
    console.log('  Lodge: mason, guest, member');
    console.log('  GrandLodge: mason, guest');
    console.log('  MasonicOrder: mason, guest');
    
    // Update forms collection - consolidate partner forms into guest forms
    console.log('\n📝 Updating forms collection...');
    
    // Delete old partner forms
    const deleteResult = await formsCollection.deleteMany({
      attendeeType: 'partner'
    });
    console.log(`✅ Removed ${deleteResult.deletedCount} partner forms`);
    
    // Update guest forms to include partner fields
    const guestForms = await formsCollection.find({ attendeeType: 'guest' }).toArray();
    
    for (const form of guestForms) {
      // Add partner relationship field to guest forms
      const updatedFields = [...form.fields];
      
      // Check if partnerOf field already exists
      const hasPartnerField = updatedFields.some((f: any) => f.name === 'partnerOf');
      
      if (!hasPartnerField) {
        // Add after the basic fields
        const insertIndex = 4; // After firstName, lastName, email, phone
        updatedFields.splice(insertIndex, 0, {
          name: 'isPartner',
          type: 'checkbox',
          required: false,
          label: 'I am a partner of a Mason'
        });
        updatedFields.splice(insertIndex + 1, 0, {
          name: 'partnerOf',
          type: 'text',
          required: false,
          label: 'Partner Of (Mason\'s Name)',
          showIf: { field: 'isPartner', value: true }
        });
      }
      
      await formsCollection.updateOne(
        { _id: form._id },
        {
          $set: {
            fields: updatedFields,
            updatedAt: new Date()
          }
        }
      );
    }
    
    console.log(`✅ Updated ${guestForms.length} guest forms with partner fields`);
    
    // Update the transformation helper function note
    console.log('\n📌 IMPORTANT: Update determineAttendeeType() function:');
    console.log('  Change logic to return "guest" instead of "partner"');
    console.log('  Partner relationship will be captured in formData.partnerOf field');
    
    // Display summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 CONSOLIDATION SUMMARY');
    console.log('-'.repeat(40));
    console.log('\n✅ Product Options Updated:');
    console.log('  - Removed "partner" from attendee types');
    console.log('  - Partners now use "guest" variant');
    console.log('  - Partner relationship captured in formData');
    
    console.log('\n✅ Variants Consolidated:');
    console.log(`  - Total variants: ${variants.length} (down from 13)`);
    console.log('  - All partner variants merged into guest variants');
    console.log('  - Same pricing preserved (guest price = former partner price)');
    
    console.log('\n✅ Forms Updated:');
    console.log('  - Partner forms removed');
    console.log('  - Guest forms enhanced with partner fields');
    console.log('  - Conditional "Partner Of" field added');
    
    console.log('\n💡 Benefits:');
    console.log('  - Simpler product structure');
    console.log('  - Relationship data in appropriate place (formData)');
    console.log('  - Fewer variants to manage');
    console.log('  - Cleaner UI in registration wizard');
    
  } catch (error) {
    console.error('❌ Error consolidating partner to guest:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Always run when this file is executed
consolidatePartnerToGuest()
  .then(() => {
    console.log('\n✅ Consolidation completed!');
  })
  .catch(error => {
    console.error('\n❌ Consolidation failed:', error);
  });