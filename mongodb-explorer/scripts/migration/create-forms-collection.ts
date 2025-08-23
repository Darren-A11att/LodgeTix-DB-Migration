import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

// Form field types
type FieldType = 'text' | 'email' | 'tel' | 'select' | 'checkbox' | 'radio' | 'textarea' | 'number' | 'date' | 'hidden' | 'array' | 'object';

interface FormField {
  name: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[] | { value: string; label: string }[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  defaultValue?: any;
  showIf?: string; // Conditional display logic
  helpText?: string;
}

interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  order: number;
}

interface FormSchema {
  formId: string;
  formName: string;
  formType: 'individual' | 'organization';
  attendeeType?: 'mason' | 'guest';
  organizationType?: 'lodge' | 'grandLodge' | 'masonicOrder';
  description: string;
  sections: FormSection[];
  variantIds: string[]; // Product variants this form applies to
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

async function createFormsCollection() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('📋 CREATING FORMS COLLECTION');
  console.log('='.repeat(80));
  
  try {
    // Drop existing forms collection if it exists
    const collections = await db.listCollections().toArray();
    if (collections.some(c => c.name === 'forms')) {
      await db.collection('forms').drop();
      console.log('✅ Dropped existing forms collection');
    }
    
    // Create forms collection
    const formsCollection = db.collection<FormSchema>('forms');
    
    // Get product variants to link forms
    const productsCollection = db.collection('products');
    const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
    
    if (!bundleProduct) {
      throw new Error('Bundle product not found. Please run product generation first.');
    }
    
    // Helper to find variant IDs
    const findVariantIds = (registrationType: string, attendeeType: string): string[] => {
      return bundleProduct.variants
        .filter((v: any) => 
          v.options.registration === registrationType && 
          v.options.attendee === attendeeType
        )
        .map((v: any) => v.variantId);
    };
    
    // Create form schemas
    const forms: FormSchema[] = [];
    
    // 1. INDIVIDUAL MASON FORM
    forms.push({
      formId: 'form_individual_mason',
      formName: 'Individual Mason Registration',
      formType: 'individual',
      attendeeType: 'mason',
      description: 'Registration form for individual Freemasons attending the Grand Proclamation',
      sections: [
        {
          id: 'personal_info',
          title: 'Personal Information',
          description: 'Your personal details',
          order: 1,
          fields: [
            {
              name: 'title',
              type: 'select',
              label: 'Title',
              required: false,
              options: ['Mr', 'Mrs', 'Ms', 'Dr', 'Rev', 'W Bro', 'Bro', 'RW Bro', 'VW Bro', 'MW Bro'],
              placeholder: 'Select title'
            },
            {
              name: 'firstName',
              type: 'text',
              label: 'First Name',
              required: true,
              placeholder: 'Enter your first name',
              validation: {
                minLength: 1,
                maxLength: 100
              }
            },
            {
              name: 'lastName',
              type: 'text',
              label: 'Last Name',
              required: true,
              placeholder: 'Enter your last name',
              validation: {
                minLength: 1,
                maxLength: 100
              }
            },
            {
              name: 'suffix',
              type: 'text',
              label: 'Suffix',
              required: false,
              placeholder: 'Jr., Sr., III, etc.',
              validation: {
                maxLength: 20
              }
            },
            {
              name: 'postNominals',
              type: 'text',
              label: 'Post-Nominals',
              required: false,
              placeholder: 'PDGM, PGM, etc.',
              helpText: 'Masonic titles and honors after your name'
            }
          ]
        },
        {
          id: 'contact_info',
          title: 'Contact Information',
          description: 'How we can reach you',
          order: 2,
          fields: [
            {
              name: 'email',
              type: 'email',
              label: 'Email Address',
              required: true,
              placeholder: 'your.email@example.com',
              validation: {
                pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
              }
            },
            {
              name: 'phone',
              type: 'tel',
              label: 'Phone Number',
              required: false,
              placeholder: '+61 400 000 000',
              validation: {
                pattern: '^[+]?[0-9\\s()-]+$'
              }
            }
          ]
        },
        {
          id: 'masonic_info',
          title: 'Masonic Information',
          description: 'Your Masonic affiliation',
          order: 3,
          fields: [
            {
              name: 'lodgeName',
              type: 'text',
              label: 'Lodge Name',
              required: true,
              placeholder: 'Enter your lodge name'
            },
            {
              name: 'lodgeNumber',
              type: 'text',
              label: 'Lodge Number',
              required: true,
              placeholder: 'Enter your lodge number'
            },
            {
              name: 'rank',
              type: 'select',
              label: 'Masonic Rank',
              required: true,
              options: [
                { value: 'EA', label: 'Entered Apprentice' },
                { value: 'FC', label: 'Fellow Craft' },
                { value: 'MM', label: 'Master Mason' },
                { value: 'WM', label: 'Worshipful Master' },
                { value: 'PM', label: 'Past Master' },
                { value: 'GL', label: 'Grand Lodge Officer' }
              ],
              placeholder: 'Select your rank'
            },
            {
              name: 'grandLodge',
              type: 'text',
              label: 'Grand Lodge',
              required: false,
              placeholder: 'Your Grand Lodge jurisdiction',
              defaultValue: 'United Grand Lodge of Victoria'
            }
          ]
        },
        {
          id: 'special_requirements',
          title: 'Special Requirements',
          description: 'Dietary and accessibility needs',
          order: 4,
          fields: [
            {
              name: 'dietaryRequirements',
              type: 'textarea',
              label: 'Dietary Requirements',
              required: false,
              placeholder: 'Please list any dietary requirements or allergies',
              validation: {
                maxLength: 500
              }
            },
            {
              name: 'specialNeeds',
              type: 'textarea',
              label: 'Accessibility Requirements',
              required: false,
              placeholder: 'Please list any accessibility or special needs',
              validation: {
                maxLength: 500
              }
            }
          ]
        }
      ],
      variantIds: findVariantIds('individual', 'mason'),
      active: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // 2. INDIVIDUAL GUEST FORM
    forms.push({
      formId: 'form_individual_guest',
      formName: 'Individual Guest Registration',
      formType: 'individual',
      attendeeType: 'guest',
      description: 'Registration form for guests and partners attending the Grand Proclamation',
      sections: [
        {
          id: 'personal_info',
          title: 'Personal Information',
          description: 'Your personal details',
          order: 1,
          fields: [
            {
              name: 'title',
              type: 'select',
              label: 'Title',
              required: false,
              options: ['Mr', 'Mrs', 'Ms', 'Dr', 'Rev', 'Prof'],
              placeholder: 'Select title'
            },
            {
              name: 'firstName',
              type: 'text',
              label: 'First Name',
              required: true,
              placeholder: 'Enter your first name',
              validation: {
                minLength: 1,
                maxLength: 100
              }
            },
            {
              name: 'lastName',
              type: 'text',
              label: 'Last Name',
              required: true,
              placeholder: 'Enter your last name',
              validation: {
                minLength: 1,
                maxLength: 100
              }
            },
            {
              name: 'suffix',
              type: 'text',
              label: 'Suffix',
              required: false,
              placeholder: 'Jr., Sr., III, etc.',
              validation: {
                maxLength: 20
              }
            }
          ]
        },
        {
          id: 'contact_info',
          title: 'Contact Information',
          description: 'How we can reach you',
          order: 2,
          fields: [
            {
              name: 'email',
              type: 'email',
              label: 'Email Address',
              required: true,
              placeholder: 'your.email@example.com',
              validation: {
                pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
              }
            },
            {
              name: 'phone',
              type: 'tel',
              label: 'Phone Number',
              required: false,
              placeholder: '+61 400 000 000',
              validation: {
                pattern: '^[+]?[0-9\\s()-]+$'
              }
            }
          ]
        },
        {
          id: 'relationship_info',
          title: 'Relationship Information',
          description: 'Your connection to the event',
          order: 3,
          fields: [
            {
              name: 'relationship',
              type: 'array',
              label: 'Relationships',
              required: false,
              helpText: 'Are you attending as someone\'s partner or guest?'
            }
          ]
        },
        {
          id: 'special_requirements',
          title: 'Special Requirements',
          description: 'Dietary and accessibility needs',
          order: 4,
          fields: [
            {
              name: 'dietaryRequirements',
              type: 'textarea',
              label: 'Dietary Requirements',
              required: false,
              placeholder: 'Please list any dietary requirements or allergies',
              validation: {
                maxLength: 500
              }
            },
            {
              name: 'specialNeeds',
              type: 'textarea',
              label: 'Accessibility Requirements',
              required: false,
              placeholder: 'Please list any accessibility or special needs',
              validation: {
                maxLength: 500
              }
            }
          ]
        }
      ],
      variantIds: findVariantIds('individual', 'guest'),
      active: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // 3. LODGE FORM
    forms.push({
      formId: 'form_lodge',
      formName: 'Lodge Registration',
      formType: 'organization',
      organizationType: 'lodge',
      description: 'Registration form for lodges registering multiple attendees',
      sections: [
        {
          id: 'lodge_details',
          title: 'Lodge Information',
          description: 'Details about your lodge',
          order: 1,
          fields: [
            {
              name: 'lodgeName',
              type: 'text',
              label: 'Lodge Name',
              required: true,
              placeholder: 'Enter your lodge name'
            },
            {
              name: 'lodgeNumber',
              type: 'text',
              label: 'Lodge Number',
              required: true,
              placeholder: 'Enter your lodge number'
            },
            {
              name: 'lodgeAddress',
              type: 'text',
              label: 'Lodge Address',
              required: false,
              placeholder: 'Street address'
            },
            {
              name: 'lodgeCity',
              type: 'text',
              label: 'City',
              required: false,
              placeholder: 'City'
            },
            {
              name: 'lodgeState',
              type: 'text',
              label: 'State',
              required: false,
              placeholder: 'State or Province'
            },
            {
              name: 'lodgePostcode',
              type: 'text',
              label: 'Postcode',
              required: false,
              placeholder: 'Postcode or ZIP'
            }
          ]
        },
        {
          id: 'representative_info',
          title: 'Lodge Representative',
          description: 'Primary contact for this registration',
          order: 2,
          fields: [
            {
              name: 'representativeFirstName',
              type: 'text',
              label: 'Representative First Name',
              required: true,
              placeholder: 'First name'
            },
            {
              name: 'representativeLastName',
              type: 'text',
              label: 'Representative Last Name',
              required: true,
              placeholder: 'Last name'
            },
            {
              name: 'representativeEmail',
              type: 'email',
              label: 'Representative Email',
              required: true,
              placeholder: 'email@example.com'
            },
            {
              name: 'representativePhone',
              type: 'tel',
              label: 'Representative Phone',
              required: true,
              placeholder: '+61 400 000 000'
            }
          ]
        },
        {
          id: 'attendees_list',
          title: 'Lodge Attendees',
          description: 'List of members attending from your lodge',
          order: 3,
          fields: [
            {
              name: 'attendees',
              type: 'array',
              label: 'Attendees',
              required: true,
              helpText: 'Add details for each attendee from your lodge'
            }
          ]
        }
      ],
      variantIds: [
        ...findVariantIds('lodge', 'mason'),
        ...findVariantIds('lodge', 'guest'),
        ...findVariantIds('lodge', 'member')
      ],
      active: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // 4. GRAND LODGE FORM
    forms.push({
      formId: 'form_grand_lodge',
      formName: 'Grand Lodge Registration',
      formType: 'organization',
      organizationType: 'grandLodge',
      description: 'Registration form for Grand Lodge delegations',
      sections: [
        {
          id: 'grand_lodge_details',
          title: 'Grand Lodge Information',
          description: 'Details about your Grand Lodge',
          order: 1,
          fields: [
            {
              name: 'grandLodgeName',
              type: 'text',
              label: 'Grand Lodge Name',
              required: true,
              placeholder: 'Enter your Grand Lodge name'
            },
            {
              name: 'grandLodgeJurisdiction',
              type: 'text',
              label: 'Jurisdiction',
              required: true,
              placeholder: 'Jurisdiction or Territory'
            },
            {
              name: 'grandLodgeCountry',
              type: 'text',
              label: 'Country',
              required: true,
              placeholder: 'Country'
            }
          ]
        },
        {
          id: 'delegation_leader',
          title: 'Delegation Leader',
          description: 'Primary contact for this delegation',
          order: 2,
          fields: [
            {
              name: 'leaderTitle',
              type: 'text',
              label: 'Leader Title',
              required: true,
              placeholder: 'MW Bro, RW Bro, etc.'
            },
            {
              name: 'leaderFirstName',
              type: 'text',
              label: 'Leader First Name',
              required: true,
              placeholder: 'First name'
            },
            {
              name: 'leaderLastName',
              type: 'text',
              label: 'Leader Last Name',
              required: true,
              placeholder: 'Last name'
            },
            {
              name: 'leaderEmail',
              type: 'email',
              label: 'Leader Email',
              required: true,
              placeholder: 'email@example.com'
            },
            {
              name: 'leaderPhone',
              type: 'tel',
              label: 'Leader Phone',
              required: true,
              placeholder: 'Phone number with country code'
            }
          ]
        },
        {
          id: 'delegation_members',
          title: 'Delegation Members',
          description: 'List of Grand Lodge officers and guests',
          order: 3,
          fields: [
            {
              name: 'attendees',
              type: 'array',
              label: 'Delegation Members',
              required: true,
              helpText: 'Add details for each member of your delegation'
            }
          ]
        }
      ],
      variantIds: [
        ...findVariantIds('grandLodge', 'mason'),
        ...findVariantIds('grandLodge', 'guest'),
        ...findVariantIds('grandLodge', 'member')
      ],
      active: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // 5. MASONIC ORDER FORM
    forms.push({
      formId: 'form_masonic_order',
      formName: 'Masonic Order Registration',
      formType: 'organization',
      organizationType: 'masonicOrder',
      description: 'Registration form for Masonic Orders and affiliated bodies',
      sections: [
        {
          id: 'order_details',
          title: 'Order Information',
          description: 'Details about your Masonic Order',
          order: 1,
          fields: [
            {
              name: 'orderName',
              type: 'text',
              label: 'Order Name',
              required: true,
              placeholder: 'Name of the Masonic Order'
            },
            {
              name: 'orderType',
              type: 'select',
              label: 'Order Type',
              required: true,
              options: [
                'Royal Arch',
                'Mark Master',
                'Knights Templar',
                'Scottish Rite',
                'Shrine',
                'Order of the Eastern Star',
                'Other'
              ],
              placeholder: 'Select order type'
            },
            {
              name: 'chapterName',
              type: 'text',
              label: 'Chapter/Body Name',
              required: false,
              placeholder: 'Local chapter or body name'
            }
          ]
        },
        {
          id: 'order_representative',
          title: 'Order Representative',
          description: 'Primary contact for this registration',
          order: 2,
          fields: [
            {
              name: 'repTitle',
              type: 'text',
              label: 'Representative Title',
              required: true,
              placeholder: 'Official title'
            },
            {
              name: 'repFirstName',
              type: 'text',
              label: 'Representative First Name',
              required: true,
              placeholder: 'First name'
            },
            {
              name: 'repLastName',
              type: 'text',
              label: 'Representative Last Name',
              required: true,
              placeholder: 'Last name'
            },
            {
              name: 'repEmail',
              type: 'email',
              label: 'Representative Email',
              required: true,
              placeholder: 'email@example.com'
            },
            {
              name: 'repPhone',
              type: 'tel',
              label: 'Representative Phone',
              required: true,
              placeholder: 'Phone number'
            }
          ]
        },
        {
          id: 'order_members',
          title: 'Order Members',
          description: 'List of members attending from your order',
          order: 3,
          fields: [
            {
              name: 'attendees',
              type: 'array',
              label: 'Order Members',
              required: true,
              helpText: 'Add details for each member attending'
            }
          ]
        }
      ],
      variantIds: [
        ...findVariantIds('masonicOrder', 'mason'),
        ...findVariantIds('masonicOrder', 'guest'),
        ...findVariantIds('masonicOrder', 'member')
      ],
      active: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Insert all forms
    const result = await formsCollection.insertMany(forms);
    console.log(`\n✅ Created ${result.insertedCount} form schemas`);
    
    // Create indexes
    await formsCollection.createIndex({ formId: 1 }, { unique: true });
    await formsCollection.createIndex({ variantIds: 1 });
    await formsCollection.createIndex({ active: 1 });
    console.log('✅ Created indexes on forms collection');
    
    // Display summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 FORMS COLLECTION SUMMARY');
    console.log('-'.repeat(40));
    
    for (const form of forms) {
      console.log(`\n📋 ${form.formName}:`);
      console.log(`   Form ID: ${form.formId}`);
      console.log(`   Type: ${form.formType} (${form.attendeeType || form.organizationType})`);
      console.log(`   Sections: ${form.sections.length}`);
      const totalFields = form.sections.reduce((sum, section) => sum + section.fields.length, 0);
      console.log(`   Total Fields: ${totalFields}`);
      console.log(`   Linked Variants: ${form.variantIds.length}`);
    }
    
    // Show variant mapping
    console.log('\n' + '='.repeat(80));
    console.log('🔗 VARIANT TO FORM MAPPING');
    console.log('-'.repeat(40));
    
    const variantMapping = new Map<string, string>();
    for (const form of forms) {
      for (const variantId of form.variantIds) {
        const variant = bundleProduct.variants.find((v: any) => v.variantId === variantId);
        if (variant) {
          console.log(`\n${variant.name}:`);
          console.log(`   Variant ID: ${variantId}`);
          console.log(`   Form: ${form.formName}`);
          console.log(`   SKU: ${variant.sku}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('💡 FORMS COLLECTION STRUCTURE');
    console.log('-'.repeat(40));
    console.log('\n✅ Forms are schema definitions, not submissions');
    console.log('✅ Each form maps to specific product variants');
    console.log('✅ FormData in carts/orders will store actual values');
    console.log('✅ Relationship arrays handle partner connections');
    console.log('✅ Array fields (attendees) allow dynamic lists');
    
  } catch (error) {
    console.error('❌ Error creating forms collection:', error);
  } finally {
    await client.close();
  }
}

// Run the script
createFormsCollection()
  .then(() => {
    console.log('\n✅ Forms collection created successfully!');
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
  });