import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { 
  Product,
  ProductVariant,
  Inventory,
  generateVariantSKU,
  generateVariantName
} from './ecommerce-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

interface ConversionResult {
  productsCreated: number;
  inventoryCreated: number;
  errors: string[];
}

async function convertEventsToProducts(): Promise<ConversionResult> {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🎯 CONVERTING EVENTS TO PRODUCTS');
  console.log('='.repeat(80));
  
  const result: ConversionResult = {
    productsCreated: 0,
    inventoryCreated: 0,
    errors: []
  };
  
  try {
    // Step 1: Read all events
    console.log('\n📖 Step 1: Reading events from old_events...');
    const eventsCollection = db.collection('old_events');
    const events = await eventsCollection.find({}).toArray();
    console.log(`✅ Found ${events.length} events to convert`);
    
    // Step 2: Read all event tickets for inventory
    console.log('\n📖 Step 2: Reading event tickets from old_eventTickets...');
    const eventTicketsCollection = db.collection('old_eventTickets');
    const eventTickets = await eventTicketsCollection.find({}).toArray();
    console.log(`✅ Found ${eventTickets.length} event ticket types`);
    
    // Group tickets by event
    const ticketsByEvent = new Map<string, any[]>();
    eventTickets.forEach(ticket => {
      const eventId = ticket.eventId?.toString();
      if (eventId) {
        if (!ticketsByEvent.has(eventId)) {
          ticketsByEvent.set(eventId, []);
        }
        ticketsByEvent.get(eventId)!.push(ticket);
      }
    });
    
    // Collections for new data
    const productsCollection = db.collection('products');
    const inventoryCollection = db.collection('inventory');
    
    // Step 3: Convert each event to a product
    console.log('\n🔄 Step 3: Converting events to products...\n');
    
    for (const event of events) {
      try {
        const eventId = event._id.toString();
        console.log(`📦 Converting: ${event.title}`);
        
        // Get ticket types for this event
        const eventTicketTypes = ticketsByEvent.get(eventId) || [];
        
        // Create product from event
        const product: Product = {
          productId: eventId,
          name: event.title,
          description: event.description,
          type: 'product',
          status: determineEventStatus(event, eventTicketTypes),
          display: false, // Events are accessed through bundle
          price: 0, // Price comes from variants
          
          // Create options from ticket types
          options: eventTicketTypes.length > 0 ? [
            {
              name: 'ticket',
              values: eventTicketTypes.map(t => t.name || t.ticketType || 'General'),
              required: true
            }
          ] : [],
          
          // Create variants for each ticket type
          variants: [],
          
          // Metadata
          sourceId: eventId,
          sourceType: 'event',
          imageUrl: event.imageUrl,
          tags: ['event', event.type?.toLowerCase()].filter(Boolean),
          category: 'event',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Generate variants for each ticket type
        if (eventTicketTypes.length > 0) {
          product.variants = eventTicketTypes.map((ticket, index) => {
            const ticketName = ticket.name || ticket.ticketType || 'General';
            const variant: ProductVariant = {
              variantId: `${eventId}-${index + 1}`,
              sku: `EVENT-${eventId}-${ticketName.toUpperCase().replace(/\s+/g, '-')}`,
              name: `${event.title} - ${ticketName}`,
              price: ticket.price || 0,
              options: { ticket: ticketName },
              inventoryItemId: ticket._id.toString(),
              defaultQuantity: 1,
              status: ticket.soldOut ? 'sold_out' : 'available',
              stock: {
                available: ticket.availableTickets || (event.maxAttendees || 100),
                reserved: 0,
                sold: ticket.soldTickets || 0
              }
            };
            return variant;
          });
        } else {
          // Create a single default variant if no ticket types exist
          const variant: ProductVariant = {
            variantId: `${eventId}-default`,
            sku: `EVENT-${eventId}-GENERAL`,
            name: event.title,
            price: 0,
            options: {},
            defaultQuantity: 1,
            status: 'available',
            stock: {
              available: event.maxAttendees || 100,
              reserved: 0,
              sold: 0
            }
          };
          product.variants = [variant];
        }
        
        // Save product
        await productsCollection.replaceOne(
          { productId: product.productId },
          product,
          { upsert: true }
        );
        result.productsCreated++;
        console.log(`  ✅ Created product with ${product.variants.length} variants`);
        
        // Step 4: Create inventory items for each variant
        for (const variant of product.variants) {
          const inventory: Inventory = {
            inventoryId: uuidv4(),
            productId: product.productId,
            variantId: variant.variantId,
            
            // Stock levels
            total: variant.stock?.available || 100,
            available: variant.stock?.available || 100,
            reserved: variant.stock?.reserved || 0,
            sold: variant.stock?.sold || 0,
            
            // Thresholds
            lowStockThreshold: 10,
            outOfStockThreshold: 0,
            
            // Event tracking
            eventId: eventId,
            ticketType: variant.options.ticket || 'General',
            
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          await inventoryCollection.replaceOne(
            { productId: inventory.productId, variantId: inventory.variantId },
            inventory,
            { upsert: true }
          );
          result.inventoryCreated++;
        }
        
        console.log(`  ✅ Created ${product.variants.length} inventory items`);
        
      } catch (error: any) {
        const errorMsg = `Failed to convert event ${event.title}: ${error.message}`;
        console.error(`  ❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }
    
    // Step 5: Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 CONVERSION SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Products Created: ${result.productsCreated}`);
    console.log(`✅ Inventory Items Created: ${result.inventoryCreated}`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️ Errors (${result.errors.length}):`);
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    // Verify products
    const productCount = await productsCollection.countDocuments({ type: 'product' });
    const inventoryCount = await inventoryCollection.countDocuments({});
    
    console.log('\n📋 Database Verification:');
    console.log(`  Products collection: ${productCount} product-type items`);
    console.log(`  Inventory collection: ${inventoryCount} items`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Fatal error during conversion:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Helper function to determine event status
function determineEventStatus(event: any, tickets: any[]): 'available' | 'sold_out' | 'closed' {
  // Check if event has passed (you might need to adjust this based on your date fields)
  if (event.eventDate && new Date(event.eventDate) < new Date()) {
    return 'closed';
  }
  
  // Check if all tickets are sold out
  if (tickets.length > 0 && tickets.every(t => t.soldOut)) {
    return 'sold_out';
  }
  
  // Check max attendees
  if (event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
    return 'sold_out';
  }
  
  return 'available';
}

// Export for testing
export { convertEventsToProducts };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  convertEventsToProducts()
    .then(result => {
      console.log('\n✅ Event conversion completed successfully!');
      console.log(`   ${result.productsCreated} products created`);
      console.log(`   ${result.inventoryCreated} inventory items created`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Event conversion failed:', error);
      process.exit(1);
    });
}