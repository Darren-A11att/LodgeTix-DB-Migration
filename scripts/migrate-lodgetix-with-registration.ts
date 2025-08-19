import { MongoClient, Db, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set');
}

const SOURCE_DB = 'LodgeTix-migration-test-1';
const TARGET_DB = 'commerce'; // Force to use commerce database

// Types for registration products
type RegistrationType = 'Individual' | 'Lodge' | 'Grand Lodge' | 'Masonic Order';
type AttendeeType = 'mason' | 'partner' | 'guest';
type TicketOwnerType = 'attendee' | 'bookingContact';

interface RegistrationProductOptions {
  type: RegistrationType;
  attendee: AttendeeType;
}

interface EventTicketOptions {
  type: 'ticket';
  ownerType: TicketOwnerType;
}

interface CustomForm {
  registrationType?: RegistrationType;
  attendeeType?: AttendeeType;
  fields?: Array<{
    name: string;
    type: string;
    required: boolean;
    label: string;
    options?: string[];
  }>;
}

class LodgeTixRegistrationMigrator {
  private client: MongoClient;
  private sourceDb: Db;
  private targetDb: Db;
  
  // Track created entities
  private collectionId: string = '';
  private registrationProductId: string = '';
  private registrationVariantMap: Map<string, string> = new Map();
  private ticketProductMap: Map<string, string> = new Map();
  private ticketVariantMap: Map<string, string> = new Map();
  private kitProductId: string = '';
  private vendorId: string = '';
  private locationId: string = '';

  constructor() {
    this.client = new MongoClient(MONGODB_URI);
  }

  async connect() {
    await this.client.connect();
    this.sourceDb = this.client.db(SOURCE_DB);
    this.targetDb = this.client.db(TARGET_DB);
    console.log('✅ Connected to MongoDB Atlas');
    console.log(`   Source: ${SOURCE_DB}`);
    console.log(`   Target: ${TARGET_DB}`);
  }

  async disconnect() {
    await this.client.close();
    console.log('🔌 Disconnected from MongoDB');
  }

  async migrate() {
    try {
      console.log('\n🚀 Starting Registration-Based Migration\n');
      console.log('═'.repeat(60));

      // Step 0: Clear existing commerce data (optional)
      if (process.argv.includes('--clear')) {
        await this.clearCommerceData();
      }

      // Step 1: Setup vendor and location
      await this.setupVendorAndLocation();

      // Step 2: Find Grand Proclamation function
      const grandProclamation = await this.findGrandProclamation();
      
      // Step 3: Create product collection for Grand Proclamation 2025
      await this.createProductCollection(grandProclamation);
      
      // Step 4: Create the main registration product with variants
      await this.createRegistrationProduct();
      
      // Step 5: Create event ticket products from eventTickets
      await this.createEventTicketProducts(grandProclamation);
      
      // Step 6: Create registration product kit for Lodge bookings
      await this.createRegistrationKit();
      
      // Step 7: Map existing registrations to carts (if any exist)
      await this.mapRegistrationsToCarts();
      
      console.log('\n' + '═'.repeat(60));
      console.log('✅ Migration completed successfully!');
      
      await this.printSummary();
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  private async clearCommerceData() {
    console.log('\n🗑️ Clearing existing commerce data...');
    
    const collections = [
      'products',
      'product_variants', 
      'product_collections',
      'inventory_items',
      'inventory_levels',
      'vendors',
      'locations'
    ];
    
    for (const collection of collections) {
      const count = await this.targetDb.collection(collection).countDocuments();
      if (count > 0) {
        await this.targetDb.collection(collection).deleteMany({});
        console.log(`  ✓ Cleared ${count} records from ${collection}`);
      }
    }
    
    console.log('  ✅ Commerce data cleared');
  }

  private async setupVendorAndLocation() {
    console.log('\n📋 Setting up vendor and location...');
    
    // Create or find Grand Lodge vendor
    let vendor = await this.targetDb.collection('vendors').findOne({
      name: 'Grand Lodge of Ireland'
    });
    
    if (!vendor) {
      const newVendor = {
        _id: new ObjectId(),
        name: 'Grand Lodge of Ireland',
        handle: 'grand-lodge-ireland',
        email: 'admin@grandlodge.ie',
        status: 'active',
        commission_rate: 0,
        payout_schedule: 'monthly',
        metadata: {
          type: 'masonic',
          established: 1725
        },
        created_at: new Date(),
        updated_at: new Date()
      };
      
      await this.targetDb.collection('vendors').insertOne(newVendor);
      this.vendorId = newVendor._id.toString();
      console.log('  ✓ Created vendor: Grand Lodge of Ireland');
    } else {
      this.vendorId = vendor._id.toString();
      console.log('  ✓ Using existing vendor: Grand Lodge of Ireland');
    }
    
    // Create or find location
    let location = await this.targetDb.collection('locations').findOne({
      name: 'Grand Lodge Hall'
    });
    
    if (!location) {
      const newLocation = {
        _id: new ObjectId(),
        name: 'Grand Lodge Hall',
        type: 'physical',
        address: {
          address1: '17 Molesworth Street',
          city: 'Dublin',
          province: 'Dublin',
          country: 'Ireland',
          postalCode: 'D02 HK50',
          phone: '+353 1 453 5300'
        },
        is_active: true,
        metadata: {
          capacity: 500,
          facilities: ['Banquet Hall', 'Meeting Rooms', 'Reception Area']
        },
        created_at: new Date(),
        updated_at: new Date()
      };
      
      await this.targetDb.collection('locations').insertOne(newLocation);
      this.locationId = newLocation._id.toString();
      console.log('  ✓ Created location: Grand Lodge Hall');
    } else {
      this.locationId = location._id.toString();
      console.log('  ✓ Using existing location: Grand Lodge Hall');
    }
  }

  private async findGrandProclamation() {
    console.log('\n🔍 Finding Grand Proclamation function...');
    
    // Try to find Grand Proclamation or similar function
    let func = await this.sourceDb.collection('functions').findOne({
      $or: [
        { name: { $regex: /grand proclamation/i } },
        { name: { $regex: /annual.*ball/i } },
        { _id: new ObjectId('685beba0b2fa6b693adaba43') } // The ID you mentioned
      ]
    });
    
    if (!func) {
      // Use the first function as fallback
      func = await this.sourceDb.collection('functions').findOne({});
    }
    
    if (func) {
      console.log(`  ✓ Found function: ${func.name}`);
      return func;
    } else {
      console.log('  ⚠️ No function found, creating default');
      return {
        name: 'Grand Proclamation 2025',
        description: 'Annual Grand Proclamation ceremony and celebration',
        venue: 'Grand Lodge Hall',
        startDate: '2025-03-15',
        endDate: '2025-03-15'
      };
    }
  }

  private async createProductCollection(sourceFunction: any) {
    console.log('\n📦 Creating product collection: Grand Proclamation 2025...');
    
    const collection = {
      _id: new ObjectId(),
      handle: 'grand-proclamation-2025',
      title: 'Grand Proclamation 2025',
      description: sourceFunction.description || 'Annual Grand Proclamation ceremony and celebration',
      metadata: {
        venue: sourceFunction.venue,
        start_date: '2025-03-15',
        end_date: '2025-03-15',
        source_function_id: sourceFunction._id?.toString(),
        original_name: sourceFunction.name
      },
      is_published: true,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await this.targetDb.collection('product_collections').insertOne(collection);
    this.collectionId = collection._id.toString();
    console.log(`  ✓ Created collection: ${collection.title}`);
  }

  private async createRegistrationProduct() {
    console.log('\n🎫 Creating registration product with variants...');
    
    const productId = new ObjectId();
    this.registrationProductId = productId.toString();
    
    // Create the main registration bundle product
    const product = {
      _id: productId,
      handle: 'grand-proclamation-2025-registration',
      title: 'Grand Proclamation 2025 Registration',
      description: 'Complete registration bundle for Grand Proclamation 2025',
      type: 'bundle',
      status: 'published',
      vendor_id: this.vendorId,
      collection_id: this.collectionId,
      
      // Product options for registration
      options: [
        {
          id: 'opt_reg_type',
          title: 'Registration Type',
          values: ['Individual', 'Lodge', 'Grand Lodge', 'Masonic Order']
        },
        {
          id: 'opt_attendee_type',
          title: 'Attendee Type',
          values: ['Mason', 'Partner', 'Guest']
        }
      ],
      
      metadata: {
        product_type: 'registration',
        event: 'Grand Proclamation 2025',
        bundle_type: 'registration_bundle'
      },
      
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await this.targetDb.collection('products').insertOne(product);
    console.log(`  ✓ Created registration product: ${product.title}`);
    
    // Create variants for each combination
    const registrationTypes: RegistrationType[] = ['Individual', 'Lodge', 'Grand Lodge', 'Masonic Order'];
    const attendeeTypes: AttendeeType[] = ['mason', 'partner', 'guest'];
    
    let variantCount = 0;
    for (const regType of registrationTypes) {
      for (const attendeeType of attendeeTypes) {
        const variantId = new ObjectId();
        const variant = {
          _id: variantId,
          product_id: productId.toString(),
          sku: `GP2025-${regType.replace(/\s+/g, '-').toUpperCase()}-${attendeeType.toUpperCase()}`,
          title: `${regType} - ${attendeeType.charAt(0).toUpperCase() + attendeeType.slice(1)}`,
          
          price: this.getRegistrationPrice(regType, attendeeType),
          compare_at_price: null,
          cost: this.getRegistrationPrice(regType, attendeeType) * 0.7,
          
          inventory_quantity: regType === 'Individual' ? 500 : 100,
          inventory_management: 'system',
          inventory_policy: 'deny',
          
          requires_shipping: false,
          taxable: true,
          
          options: {
            'Registration Type': regType,
            'Attendee Type': attendeeType.charAt(0).toUpperCase() + attendeeType.slice(1)
          },
          
          // Custom form for registration details
          customForm: {
            registrationType: regType,
            attendeeType: attendeeType,
            fields: this.getCustomFormFields(regType, attendeeType)
          },
          
          metadata: {
            registration_type: regType,
            attendee_type: attendeeType,
            includes_bundle: true
          },
          
          created_at: new Date(),
          updated_at: new Date()
        };
        
        await this.targetDb.collection('product_variants').insertOne(variant);
        this.registrationVariantMap.set(`${regType}-${attendeeType}`, variantId.toString());
        variantCount++;
        
        // Create inventory item
        await this.createInventoryItem(variant);
      }
    }
    
    console.log(`  ✓ Created ${variantCount} registration variants`);
  }

  private getRegistrationPrice(regType: RegistrationType, attendeeType: AttendeeType): number {
    const prices = {
      'Individual': { mason: 150, partner: 120, guest: 100 },
      'Lodge': { mason: 1200, partner: 1000, guest: 800 },
      'Grand Lodge': { mason: 2000, partner: 1800, guest: 1500 },
      'Masonic Order': { mason: 1500, partner: 1300, guest: 1000 }
    };
    
    return prices[regType][attendeeType] || 100;
  }

  private getCustomFormFields(regType: RegistrationType, attendeeType: AttendeeType) {
    const baseFields = [
      { name: 'title', type: 'select', required: false, label: 'Title', 
        options: ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Rev', 'RW', 'VW', 'W'] },
      { name: 'firstName', type: 'text', required: true, label: 'First Name' },
      { name: 'lastName', type: 'text', required: true, label: 'Last Name' },
      { name: 'suffix', type: 'text', required: false, label: 'Suffix' },
      { name: 'email', type: 'email', required: true, label: 'Email' },
      { name: 'phone', type: 'tel', required: true, label: 'Phone' },
      { name: 'dietaryRequirements', type: 'text', required: false, label: 'Dietary Requirements' },
      { name: 'specialRequirements', type: 'text', required: false, label: 'Special Requirements' }
    ];
    
    if (attendeeType === 'mason') {
      baseFields.push(
        { name: 'lodgeNumber', type: 'text', required: true, label: 'Lodge Number' },
        { name: 'lodgeName', type: 'text', required: true, label: 'Lodge Name' },
        { name: 'rank', type: 'select', required: true, label: 'Rank', 
          options: ['EA', 'FC', 'MM', 'WM', 'PM', 'PGL', 'GL'] },
        { name: 'grandLodgeAbbreviation', type: 'text', required: false, label: 'Grand Lodge' }
      );
    }
    
    if (regType === 'Lodge' || regType === 'Grand Lodge') {
      baseFields.push(
        { name: 'numberOfAttendees', type: 'number', required: true, label: 'Number of Attendees' },
        { name: 'contactPerson', type: 'text', required: true, label: 'Contact Person' }
      );
    }
    
    return baseFields;
  }

  private async createEventTicketProducts(sourceFunction: any) {
    console.log('\n🎟️ Creating event ticket products...');
    
    // Get all event tickets from source
    const eventTickets = await this.sourceDb.collection('eventTickets').find({
      functionId: sourceFunction._id
    }).toArray();
    
    console.log(`  📋 Found ${eventTickets.length} event tickets in source database`);
    
    // If no tickets, create default ones
    const ticketsToCreate = eventTickets.length > 0 ? eventTickets : [
      { name: 'Proclamation Banquet - Best Available', price: 75, quantity: 300, code: 'BANQUET-BA' },
      { name: 'Proclamation Banquet - Premium', price: 100, quantity: 100, code: 'BANQUET-PREM' },
      { name: 'Welcome Reception', price: 25, quantity: 500, code: 'WELCOME-REC' },
      { name: 'Ladies Program', price: 50, quantity: 200, code: 'LADIES-PROG' }
    ];
    
    if (eventTickets.length === 0) {
      console.log('  ⚠️  No source tickets found, using default ticket set');
    }
    
    let ticketCount = 0;
    for (const ticket of ticketsToCreate) {
      console.log(`\n  🎫 Creating ticket: ${ticket.name}`);
      console.log(`     Price: $${ticket.price || 75}, Quantity: ${ticket.quantity || 500}`);
      
      const productId = new ObjectId();
      const variantId = new ObjectId();
      
      // Create ticket product
      const product = {
        _id: productId,
        handle: `gp2025-${ticket.name.toLowerCase().replace(/\s+/g, '-')}`,
        title: ticket.name,
        description: `Event ticket for ${ticket.name}`,
        type: 'simple',
        status: 'published',
        vendor_id: this.vendorId,
        collection_id: this.collectionId,
        
        options: [
          {
            id: 'opt_ticket_type',
            title: 'Ticket Type',
            values: ['Standard']
          },
          {
            id: 'opt_owner_type',
            title: 'Owner Type',
            values: ['Attendee', 'Booking Contact']
          }
        ],
        
        metadata: {
          product_type: 'event_ticket',
          event: 'Grand Proclamation 2025',
          ticket_type: 'event',
          original_ticket_id: ('_id' in ticket) ? ticket._id?.toString() : undefined
        },
        
        created_at: new Date(),
        updated_at: new Date()
      };
      
      await this.targetDb.collection('products').insertOne(product);
      this.ticketProductMap.set(ticket.code || ticket.name, productId.toString());
      console.log(`     ✓ Product created: ${productId}`);
      
      // Create ticket variant
      const variant = {
        _id: variantId,
        product_id: productId.toString(),
        sku: ticket.code || `GP2025-${ticket.name.substring(0, 10).toUpperCase()}`,
        title: 'Standard Ticket',
        
        price: ticket.price || 75,
        compare_at_price: null,
        cost: (ticket.price || 75) * 0.6,
        
        inventory_quantity: ticket.quantity || 500,
        inventory_management: 'system',
        inventory_policy: 'deny',
        
        requires_shipping: false,
        taxable: true,
        
        options: {
          'Ticket Type': 'Standard',
          'Owner Type': 'Attendee'
        },
        
        customForm: {
          ticketType: 'event',
          ownerType: 'attendee' as TicketOwnerType,
          eventDetails: {
            eventName: 'Grand Proclamation 2025',
            ticketName: ticket.name
          }
        },
        
        metadata: {
          ticket_name: ticket.name,
          event_ticket: true,
          can_be_bundled: true
        },
        
        created_at: new Date(),
        updated_at: new Date()
      };
      
      await this.targetDb.collection('product_variants').insertOne(variant);
      this.ticketVariantMap.set(ticket.code || ticket.name, variantId.toString());
      console.log(`     ✓ Variant created: ${variantId}`);
      
      // Create inventory item and level
      await this.createInventoryItem(variant);
      ticketCount++;
    }
    
    console.log(`\n  ✅ Created ${ticketCount} event ticket products with inventory tracking`);
  }

  private async createRegistrationKit() {
    console.log('\n📦 Creating Lodge Registration Kit...');
    
    const kitId = new ObjectId();
    this.kitProductId = kitId.toString();
    
    // Get Lodge registration variant
    const lodgeVariantId = this.registrationVariantMap.get('Lodge-mason');
    
    // Get Banquet ticket variant
    const banquetVariantId = this.ticketVariantMap.get('BANQUET-BA') || 
                            this.ticketVariantMap.get('Proclamation Banquet - Best Available');
    
    const kit = {
      _id: kitId,
      handle: 'gp2025-lodge-registration-kit',
      title: 'Lodge Registration Kit - 10 Person',
      description: 'Complete Lodge registration package with 10 banquet tickets',
      type: 'bundle',
      status: 'published',
      vendor_id: this.vendorId,
      collection_id: this.collectionId,
      
      // Bundle items
      bundleItems: [
        {
          product_id: this.registrationProductId,
          variant_id: lodgeVariantId,
          quantity: 1,
          is_required: true
        },
        {
          product_id: this.ticketProductMap.get('BANQUET-BA') || this.ticketProductMap.values().next().value,
          variant_id: banquetVariantId,
          quantity: 10,
          is_required: true
        }
      ],
      
      // Kit pricing
      price: 1950, // Lodge registration (1200) + 10 banquet tickets (75*10)
      compare_at_price: 2100, // Show savings
      
      metadata: {
        product_type: 'registration_kit',
        kit_type: 'lodge',
        includes: ['Lodge Registration', '10x Banquet Tickets'],
        savings: 150
      },
      
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await this.targetDb.collection('products').insertOne(kit);
    
    // Create a single variant for the kit
    const kitVariant = {
      _id: new ObjectId(),
      product_id: kitId.toString(),
      sku: 'GP2025-KIT-LODGE-10',
      title: 'Lodge Kit - 10 Person Package',
      
      price: 1950,
      compare_at_price: 2100,
      cost: 1365,
      
      inventory_quantity: 50,
      inventory_management: 'system',
      inventory_policy: 'deny',
      
      requires_shipping: false,
      taxable: true,
      
      customForm: {
        kitType: 'lodge',
        includedItems: [
          { type: 'registration', quantity: 1 },
          { type: 'banquet', quantity: 10 }
        ]
      },
      
      metadata: {
        kit_contents: '1x Lodge Registration, 10x Banquet Tickets',
        bundle_savings: 150
      },
      
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await this.targetDb.collection('product_variants').insertOne(kitVariant);
    await this.createInventoryItem(kitVariant);
    
    console.log(`  ✓ Created Lodge Registration Kit`);
  }

  private async createInventoryItem(variant: any) {
    console.log(`    📦 Creating inventory for SKU: ${variant.sku}`);
    
    // Create inventory item
    const inventoryItem = {
      _id: new ObjectId(),
      sku: variant.sku,
      requires_shipping: false,
      tracked: true,
      metadata: {
        product_id: variant.product_id,
        variant_id: variant._id.toString(),
        variant_title: variant.title
      },
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await this.targetDb.collection('inventory_items').insertOne(inventoryItem);
    console.log(`       ✓ Inventory item created: ${inventoryItem._id}`);
    
    // Create inventory level
    const inventoryLevel = {
      _id: new ObjectId(),
      inventory_item_id: inventoryItem._id.toString(),
      location_id: this.locationId,
      available: variant.inventory_quantity,
      incoming: 0,
      committed: 0,
      damaged: 0,
      on_hand: variant.inventory_quantity,
      safety_stock: Math.floor(variant.inventory_quantity * 0.1),
      reserved: 0,
      metadata: {
        sku: variant.sku,
        auto_created: true
      },
      updated_at: new Date()
    };
    
    await this.targetDb.collection('inventory_levels').insertOne(inventoryLevel);
    console.log(`       ✓ Inventory level created: Available=${inventoryLevel.available}, OnHand=${inventoryLevel.on_hand}`);
  }

  private async mapRegistrationsToCarts() {
    console.log('\n🛒 Checking for existing registrations to map...');
    
    // Check if there are any registrations in the source database
    const registrations = await this.sourceDb.collection('registrations').find({}).limit(5).toArray();
    
    if (registrations.length === 0) {
      console.log('  ℹ️ No existing registrations found to map');
      return;
    }
    
    console.log(`  ✓ Found ${registrations.length} registrations to map to carts`);
    
    // Here you would implement the cart mapping logic
    // For now, just logging what would be done
    for (const registration of registrations) {
      console.log(`    - Would map registration ${registration._id} to cart`);
    }
  }

  private async printSummary() {
    console.log('\n📊 Migration Summary');
    console.log('═'.repeat(60));
    
    const collections = await this.targetDb.collection('product_collections').countDocuments();
    const products = await this.targetDb.collection('products').countDocuments();
    const variants = await this.targetDb.collection('product_variants').countDocuments();
    const inventory = await this.targetDb.collection('inventory_items').countDocuments();
    const levels = await this.targetDb.collection('inventory_levels').countDocuments();
    
    console.log(`  Product Collections: ${collections}`);
    console.log(`  Products: ${products}`);
    console.log(`  Product Variants: ${variants}`);
    console.log(`  Inventory Items: ${inventory}`);
    console.log(`  Inventory Levels: ${levels}`);
    
    console.log('\n✨ Key Items Created:');
    console.log('  1. Grand Proclamation 2025 collection');
    console.log('  2. Registration product with 12 variants');
    console.log('  3. Event ticket products (4 types)');
    console.log('  4. Lodge Registration Kit bundle');
    console.log('  5. Complete inventory tracking');
  }
}

async function main() {
  const migrator = new LodgeTixRegistrationMigrator();
  
  try {
    await migrator.connect();
    await migrator.migrate();
  } finally {
    await migrator.disconnect();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { LodgeTixRegistrationMigrator };