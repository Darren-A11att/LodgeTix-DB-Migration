import { MongoClient, Db, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const LODGETIX_DB = process.env.LODGETIX_SOURCE_DB || 'LodgeTix-migration-test-1';
const COMMERCE_DB = process.env.MONGODB_DB || 'commerce';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

interface MigrationStats {
  functions: number;
  events: number;
  tickets: number;
  packages: number;
  collections: number;
  products: number;
  variants: number;
  bundles: number;
  errors: string[];
}

class LodgeTixToCommerceMigrator {
  private client: MongoClient;
  private lodgetixDb: Db;
  private commerceDb: Db;
  private stats: MigrationStats = {
    functions: 0,
    events: 0,
    tickets: 0,
    packages: 0,
    collections: 0,
    products: 0,
    variants: 0,
    bundles: 0,
    errors: []
  };

  constructor() {
    this.client = new MongoClient(MONGODB_URI);
  }

  async connect() {
    await this.client.connect();
    this.lodgetixDb = this.client.db(LODGETIX_DB);
    this.commerceDb = this.client.db(COMMERCE_DB);
    console.log('✅ Connected to MongoDB');
    console.log(`   Source: ${LODGETIX_DB}`);
    console.log(`   Target: ${COMMERCE_DB}`);
  }

  async disconnect() {
    await this.client.close();
    console.log('🔌 Disconnected from MongoDB');
  }

  // Generate URL-friendly handle from name
  private generateHandle(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // Generate SKU from event and ticket names
  private generateSKU(eventName: string, ticketName: string): string {
    const eventPart = eventName.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const ticketPart = ticketName.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${eventPart}-${ticketPart}-${Date.now().toString().slice(-6)}`;
  }

  // Simulate the setup wizard API call
  private async callSetupWizardAPI(wizardData: any): Promise<any> {
    try {
      // Instead of making an HTTP call, we'll directly execute the logic
      // that the API endpoint would perform
      
      const result = {
        collection: null as any,
        vendor: null as any,
        products: [] as any[],
        variants: [] as any[],
        bundles: [] as any[],
        inventory: [] as any[],
        location: null as any
      };

      // 1. Create or find vendor (organizer)
      if (wizardData.function.organizer) {
        const existingVendor = await this.commerceDb.collection('vendors').findOne({
          name: wizardData.function.organizer
        });

        if (existingVendor) {
          result.vendor = existingVendor;
        } else {
          const vendor = {
            name: wizardData.function.organizer,
            handle: this.generateHandle(wizardData.function.organizer),
            email: wizardData.function.organizerEmail,
            status: 'active',
            commission_rate: 10,
            payout_schedule: 'monthly',
            created_at: new Date(),
            updated_at: new Date()
          };
          
          const vendorResult = await this.commerceDb.collection('vendors').insertOne(vendor);
          result.vendor = { ...vendor, _id: vendorResult.insertedId };
        }
      }

      // 2. Create product collection (function)
      const collection = {
        handle: wizardData.function.handle,
        title: wizardData.function.name,
        metadata: {
          description: wizardData.function.description,
          venue: wizardData.function.venue,
          start_date: wizardData.function.startDate,
          end_date: wizardData.function.endDate,
          organizer: wizardData.function.organizer,
          organizer_email: wizardData.function.organizerEmail,
          lodgetix_function_id: wizardData.function.originalId
        },
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const collectionResult = await this.commerceDb.collection('product_collections').insertOne(collection);
      result.collection = { ...collection, _id: collectionResult.insertedId };

      // 3. Create stock location (venue)
      const existingLocation = await this.commerceDb.collection('stock_locations').findOne({
        name: wizardData.function.venue
      });

      if (existingLocation) {
        result.location = existingLocation;
      } else {
        const location = {
          name: wizardData.function.venue || 'Main Venue',
          address: {
            address_1: wizardData.function.venue,
            city: '',
            country_code: 'ZA'
          },
          created_at: new Date(),
          updated_at: new Date()
        };
        
        const locationResult = await this.commerceDb.collection('stock_locations').insertOne(location);
        result.location = { ...location, _id: locationResult.insertedId };
      }

      // 4. Create products (events) with variants (tickets)
      for (const event of wizardData.events) {
        const eventHandle = `${wizardData.function.handle}-${this.generateHandle(event.name)}`;
        
        // Get tickets for this event
        const eventTickets = wizardData.tickets.filter((t: any) => t.eventId === event.id);
        
        // Create product variants from tickets
        const variants = eventTickets.map((ticket: any, index: number) => ({
          id: `var_${Date.now()}_${index}`,
          title: ticket.name,
          sku: this.generateSKU(event.name, ticket.name),
          inventory_quantity: ticket.quantity,
          manage_inventory: true,
          allow_backorder: false,
          prices: [
            {
              amount: ticket.price * 100, // Convert to cents
              currency_code: 'AUD',
              includes_tax: true
            }
          ],
          metadata: {
            original_ticket_id: ticket.id,
            description: ticket.description,
            early_bird: ticket.earlyBird,
            early_bird_price: ticket.earlyBirdPrice ? ticket.earlyBirdPrice * 100 : null,
            early_bird_end_date: ticket.earlyBirdEndDate
          },
          created_at: new Date(),
          updated_at: new Date()
        }));
        
        // Create product for event
        const product = {
          handle: eventHandle,
          title: event.name,
          description: event.description,
          status: 'published',
          type: 'variant',
          collection_id: collectionResult.insertedId.toString(),
          vendor_id: result.vendor?._id?.toString(),
          
          // Product options for attendee details
          options: [
            {
              id: 'opt_name',
              title: 'Attendee Name',
              product_id: eventHandle
            },
            {
              id: 'opt_email',
              title: 'Attendee Email',
              product_id: eventHandle
            },
            {
              id: 'opt_dietary',
              title: 'Dietary Requirements',
              product_id: eventHandle
            },
            {
              id: 'opt_special',
              title: 'Special Requirements',
              product_id: eventHandle
            }
          ],
          
          variants: variants,
          
          metadata: {
            event_date: event.date,
            event_time: event.time,
            max_attendees: event.maxAttendees,
            lodgetix_event_id: event.id,
            lodgetix_function_id: wizardData.function.originalId
          },
          
          created_at: new Date(),
          updated_at: new Date()
        };
        
        const productResult = await this.commerceDb.collection('products').insertOne(product);
        result.products.push({ ...product, _id: productResult.insertedId });
        
        // Create inventory items and levels for each variant
        for (const variant of variants) {
          const inventoryItem = {
            sku: variant.sku,
            requires_shipping: false,
            metadata: {
              product_id: productResult.insertedId.toString(),
              variant_id: variant.id,
              product_name: product.title,
              variant_name: variant.title
            },
            created_at: new Date(),
            updated_at: new Date()
          };
          
          const itemResult = await this.commerceDb.collection('inventory_items').insertOne(inventoryItem);
          
          // Create inventory level
          const inventoryLevel = {
            inventory_item_id: itemResult.insertedId.toString(),
            location_id: result.location._id.toString(),
            stocked_quantity: variant.inventory_quantity,
            reserved_quantity: 0,
            incoming_quantity: 0,
            metadata: {
              sku: variant.sku
            },
            created_at: new Date(),
            updated_at: new Date()
          };
          
          await this.commerceDb.collection('inventory_levels').insertOne(inventoryLevel);
          result.inventory.push({ item: inventoryItem, level: inventoryLevel });
        }
        
        result.variants.push(...variants);
      }

      // 5. Create bundle products (packages)
      for (const pkg of wizardData.packages) {
        if (pkg.tickets.length === 0) continue;
        
        const bundleHandle = `${wizardData.function.handle}-${this.generateHandle(pkg.name)}`;
        
        // Map package tickets to bundle items
        const bundleItems = pkg.tickets.map((item: any) => {
          const ticket = wizardData.tickets.find((t: any) => t.id === item.ticketId);
          const event = wizardData.events.find((e: any) => e.id === item.eventId);
          const product = result.products.find(p => 
            p.metadata.lodgetix_event_id === item.eventId
          );
          const variant = product?.variants.find((v: any) => 
            v.metadata.original_ticket_id === item.ticketId
          );
          
          return {
            product_id: product?._id?.toString(),
            variant_id: variant?.id,
            quantity: item.quantity,
            is_optional: false,
            metadata: {
              event_name: event?.name,
              ticket_name: ticket?.name
            }
          };
        }).filter((item: any) => item.product_id && item.variant_id);
        
        if (bundleItems.length > 0) {
          const bundleProduct = {
            handle: bundleHandle,
            title: pkg.name,
            description: pkg.description,
            status: 'published',
            type: 'bundle',
            collection_id: collectionResult.insertedId.toString(),
            vendor_id: result.vendor?._id?.toString(),
            
            bundle_items: bundleItems,
            
            prices: [
              {
                amount: pkg.price * 100, // Convert to cents
                currency_code: 'AUD',
                includes_tax: true
              }
            ],
            
            metadata: {
              savings_amount: pkg.savings * 100,
              lodgetix_package_id: pkg.id,
              lodgetix_function_id: wizardData.function.originalId
            },
            
            created_at: new Date(),
            updated_at: new Date()
          };
          
          const bundleResult = await this.commerceDb.collection('products').insertOne(bundleProduct);
          result.bundles.push({ ...bundleProduct, _id: bundleResult.insertedId });
        }
      }

      return {
        success: true,
        message: `Migrated function "${wizardData.function.name}"`,
        created: {
          collection: result.collection._id,
          vendor: result.vendor?._id,
          products: result.products.length,
          variants: result.variants.length,
          bundles: result.bundles.length,
          inventory_items: result.inventory.length,
          location: result.location._id
        }
      };
      
    } catch (error) {
      console.error('Error in wizard simulation:', error);
      throw error;
    }
  }

  // Main migration function
  async migrate() {
    console.log('\n🚀 Starting LodgeTix to Commerce Migration\n');
    console.log('═'.repeat(60));

    try {
      // Get all functions from LodgeTix
      const functions = await this.lodgetixDb.collection('functions').find({}).toArray();
      console.log(`\n📋 Found ${functions.length} functions to migrate`);
      
      this.stats.functions = functions.length;

      // Process each function
      for (const func of functions) {
        console.log(`\n📦 Processing function: ${func.name}`);
        
        try {
          // Get related events
          const events = await this.lodgetixDb.collection('events')
            .find({ functionId: func._id.toString() })
            .toArray();
          
          console.log(`   📅 Found ${events.length} events`);
          this.stats.events += events.length;

          // Get all tickets for these events
          const eventIds = events.map(e => e._id.toString());
          const tickets = await this.lodgetixDb.collection('eventTickets')
            .find({ eventId: { $in: eventIds } })
            .toArray();
          
          console.log(`   🎫 Found ${tickets.length} ticket types`);
          this.stats.tickets += tickets.length;

          // Get packages for this function
          const packages = await this.lodgetixDb.collection('packages')
            .find({ functionId: func._id.toString() })
            .toArray();
          
          console.log(`   📦 Found ${packages.length} packages`);
          this.stats.packages += packages.length;

          // Transform data to wizard format
          const wizardData = {
            function: {
              originalId: func._id.toString(),
              name: func.name,
              handle: this.generateHandle(func.name),
              description: func.description || '',
              venue: func.venue || 'TBD',
              startDate: func.startDate,
              endDate: func.endDate,
              organizer: func.organizer || 'Default Organizer',
              organizerEmail: func.organizerEmail || 'events@lodgetix.com'
            },
            events: events.map(event => ({
              id: event._id.toString(),
              name: event.name,
              date: event.date,
              time: event.time || '00:00',
              description: event.description || '',
              maxAttendees: event.maxAttendees || 100
            })),
            tickets: tickets.map(ticket => ({
              id: ticket._id.toString(),
              eventId: ticket.eventId,
              name: ticket.name,
              price: ticket.price || 0,
              quantity: ticket.quantity || 100,
              description: ticket.description || '',
              earlyBird: ticket.earlyBird || false,
              earlyBirdPrice: ticket.earlyBirdPrice,
              earlyBirdEndDate: ticket.earlyBirdEndDate
            })),
            packages: packages.map(pkg => ({
              id: pkg._id.toString(),
              name: pkg.name,
              tickets: pkg.tickets || [],
              price: pkg.price || 0,
              savings: pkg.savings || 0,
              description: pkg.description || ''
            }))
          };

          // Call the simulated wizard API
          const result = await this.callSetupWizardAPI(wizardData);
          
          if (result.success) {
            console.log(`   ✅ Successfully migrated: ${result.message}`);
            console.log(`      - Collection: ${result.created.collection}`);
            console.log(`      - Products: ${result.created.products}`);
            console.log(`      - Variants: ${result.created.variants}`);
            console.log(`      - Bundles: ${result.created.bundles}`);
            console.log(`      - Inventory Items: ${result.created.inventory_items}`);
            
            this.stats.collections++;
            this.stats.products += result.created.products;
            this.stats.variants += result.created.variants;
            this.stats.bundles += result.created.bundles;
          }
          
        } catch (error: any) {
          console.error(`   ❌ Error migrating function ${func.name}:`, error.message);
          this.stats.errors.push(`Function "${func.name}": ${error.message}`);
        }
      }

      console.log('\n' + '═'.repeat(60));
      console.log('\n📊 Migration Summary:\n');
      console.log(`   Functions processed: ${this.stats.functions}`);
      console.log(`   Events processed: ${this.stats.events}`);
      console.log(`   Tickets processed: ${this.stats.tickets}`);
      console.log(`   Packages processed: ${this.stats.packages}`);
      console.log('\n   Commerce records created:');
      console.log(`   - Collections: ${this.stats.collections}`);
      console.log(`   - Products: ${this.stats.products}`);
      console.log(`   - Variants: ${this.stats.variants}`);
      console.log(`   - Bundles: ${this.stats.bundles}`);
      
      if (this.stats.errors.length > 0) {
        console.log('\n⚠️  Errors encountered:');
        this.stats.errors.forEach(err => console.log(`   - ${err}`));
      }

      console.log('\n✅ Migration completed!');

    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      throw error;
    }
  }

  // Clear existing commerce data (optional)
  async clearCommerceData() {
    console.log('\n🗑️  Clearing existing commerce data...');
    
    const collections = [
      'product_collections',
      'products',
      'vendors',
      'inventory_items',
      'inventory_levels',
      'stock_locations'
    ];
    
    for (const collection of collections) {
      const result = await this.commerceDb.collection(collection).deleteMany({});
      console.log(`   Cleared ${result.deletedCount} documents from ${collection}`);
    }
    
    console.log('   ✅ Commerce data cleared\n');
  }
}

// Main execution
async function main() {
  const migrator = new LodgeTixToCommerceMigrator();
  
  try {
    // Connect to databases
    await migrator.connect();
    
    // Ask if we should clear existing data
    const args = process.argv.slice(2);
    if (args.includes('--clear')) {
      await migrator.clearCommerceData();
    }
    
    // Run migration
    await migrator.migrate();
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await migrator.disconnect();
  }
}

// Run the migration
if (require.main === module) {
  main().catch(console.error);
}

export { LodgeTixToCommerceMigrator };