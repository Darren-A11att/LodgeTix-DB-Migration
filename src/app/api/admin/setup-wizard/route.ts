import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'lodgetix_commerce';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

interface WizardData {
  function: {
    name: string;
    handle: string;
    description: string;
    venue: string;
    startDate: string;
    endDate: string;
    organizer: string;
    organizerEmail: string;
  };
  events: Array<{
    id: string;
    name: string;
    date: string;
    time: string;
    description: string;
    maxAttendees: number;
  }>;
  tickets: Array<{
    id: string;
    eventId: string;
    name: string;
    price: number;
    quantity: number;
    description: string;
    earlyBird: boolean;
    earlyBirdPrice?: number;
    earlyBirdEndDate?: string;
  }>;
  packages: Array<{
    id: string;
    name: string;
    tickets: Array<{ eventId: string; ticketId: string; quantity: number }>;
    price: number;
    savings: number;
    description: string;
  }>;
}

export async function POST(request: NextRequest) {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const data: WizardData = await request.json();
    
    console.log('Processing wizard data:', {
      function: data.function.name,
      events: data.events.length,
      tickets: data.tickets.length,
      packages: data.packages.length
    });

    const createdRecords = {
      collection: null as any,
      vendor: null as any,
      products: [] as any[],
      variants: [] as any[],
      bundles: [] as any[],
      inventory: [] as any[],
      location: null as any
    };

    // Step 1: Create Vendor (if organizer provided)
    if (data.function.organizer) {
      const vendor = {
        name: data.function.organizer,
        handle: data.function.organizer.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        email: data.function.organizerEmail,
        status: 'active',
        commission_rate: 10,
        payout_schedule: 'monthly',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const vendorResult = await db.collection('vendors').insertOne(vendor);
      createdRecords.vendor = { ...vendor, _id: vendorResult.insertedId };
      console.log('Created vendor:', vendor.name);
    }

    // Step 2: Create Product Collection (maps to function)
    const collection = {
      handle: data.function.handle,
      title: data.function.name,
      metadata: {
        description: data.function.description,
        venue: data.function.venue,
        start_date: data.function.startDate,
        end_date: data.function.endDate,
        organizer: data.function.organizer,
        organizer_email: data.function.organizerEmail,
        lodgetix_function_id: `func_${Date.now()}`
      },
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const collectionResult = await db.collection('product_collections').insertOne(collection);
    createdRecords.collection = { ...collection, _id: collectionResult.insertedId };
    console.log('Created collection:', collection.title);

    // Step 3: Create Stock Location for venue
    const location = {
      name: data.function.venue || 'Main Venue',
      address: {
        address_1: data.function.venue,
        city: '',
        country_code: 'ZA'
      },
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const locationResult = await db.collection('stock_locations').insertOne(location);
    createdRecords.location = { ...location, _id: locationResult.insertedId };
    console.log('Created stock location:', location.name);

    // Step 4: Create Products (maps to events) with Variants (maps to tickets)
    for (const event of data.events) {
      const eventHandle = `${data.function.handle}-${event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      
      // Get tickets for this event
      const eventTickets = data.tickets.filter(t => t.eventId === event.id);
      
      // Create product variants from tickets
      const variants = eventTickets.map((ticket, index) => ({
        id: `var_${Date.now()}_${index}`,
        title: ticket.name,
        sku: `${eventHandle.toUpperCase()}-${ticket.name.replace(/[^A-Z0-9]+/g, '-').toUpperCase()}`,
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
        vendor_id: createdRecords.vendor?._id?.toString(),
        
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
          lodgetix_function_id: collection.metadata.lodgetix_function_id
        },
        
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const productResult = await db.collection('products').insertOne(product);
      createdRecords.products.push({ ...product, _id: productResult.insertedId });
      console.log('Created product:', product.title, 'with', variants.length, 'variants');
      
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
        
        const itemResult = await db.collection('inventory_items').insertOne(inventoryItem);
        
        // Create inventory level
        const inventoryLevel = {
          inventory_item_id: itemResult.insertedId.toString(),
          location_id: locationResult.insertedId.toString(),
          stocked_quantity: variant.inventory_quantity,
          reserved_quantity: 0,
          incoming_quantity: 0,
          metadata: {
            sku: variant.sku
          },
          created_at: new Date(),
          updated_at: new Date()
        };
        
        await db.collection('inventory_levels').insertOne(inventoryLevel);
        createdRecords.inventory.push({ item: inventoryItem, level: inventoryLevel });
      }
      
      createdRecords.variants.push(...variants);
    }

    // Step 5: Create Bundle Products (maps to packages)
    for (const pkg of data.packages) {
      if (pkg.tickets.length === 0) continue;
      
      const bundleHandle = `${data.function.handle}-${pkg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      
      // Map package tickets to bundle items
      const bundleItems = pkg.tickets.map(item => {
        const ticket = data.tickets.find(t => t.id === item.ticketId);
        const event = data.events.find(e => e.id === item.eventId);
        const product = createdRecords.products.find(p => 
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
      }).filter(item => item.product_id && item.variant_id);
      
      if (bundleItems.length > 0) {
        const bundleProduct = {
          handle: bundleHandle,
          title: pkg.name,
          description: pkg.description,
          status: 'published',
          type: 'bundle',
          collection_id: collectionResult.insertedId.toString(),
          vendor_id: createdRecords.vendor?._id?.toString(),
          
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
            lodgetix_function_id: collection.metadata.lodgetix_function_id
          },
          
          created_at: new Date(),
          updated_at: new Date()
        };
        
        const bundleResult = await db.collection('products').insertOne(bundleProduct);
        createdRecords.bundles.push({ ...bundleProduct, _id: bundleResult.insertedId });
        console.log('Created bundle product:', bundleProduct.title);
      }
    }

    // Create summary
    const summary = {
      success: true,
      message: `Successfully created function "${data.function.name}"`,
      created: {
        collection: createdRecords.collection._id,
        vendor: createdRecords.vendor?._id,
        products: createdRecords.products.length,
        variants: createdRecords.variants.length,
        bundles: createdRecords.bundles.length,
        inventory_items: createdRecords.inventory.length,
        location: createdRecords.location._id
      },
      details: {
        collection: {
          id: createdRecords.collection._id,
          handle: createdRecords.collection.handle,
          title: createdRecords.collection.title
        },
        products: createdRecords.products.map(p => ({
          id: p._id,
          handle: p.handle,
          title: p.title,
          variants: p.variants.length
        })),
        bundles: createdRecords.bundles.map(b => ({
          id: b._id,
          handle: b.handle,
          title: b.title,
          items: b.bundle_items.length
        }))
      }
    };

    console.log('Wizard completion summary:', summary);
    
    return NextResponse.json(summary);
    
  } catch (error) {
    console.error('Error processing setup wizard:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create function setup',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}