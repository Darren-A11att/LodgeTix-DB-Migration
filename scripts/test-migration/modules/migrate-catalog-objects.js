const { ObjectId, Decimal128 } = require('mongodb');
const { writeDocument, logError, logWarning } = require('../utils/helpers');
const crypto = require('crypto');

async function migrateCatalogObjects(db, migrationState) {
  try {
    const functions = await db.collection('functions').find({}).toArray();
    const events = await db.collection('events').find({}).toArray();
    const eventTickets = await db.collection('eventTickets').find({}).toArray();
    const packages = await db.collection('packages').find({}).toArray();
    
    console.log(`Found ${functions.length} functions to migrate`);
    console.log(`Found ${events.length} events to migrate`);
    console.log(`Found ${eventTickets.length} event tickets to migrate`);
    console.log(`Found ${packages.length} packages to migrate`);
    
    // Debug: Log some sample data
    if (events.length > 0) {
      console.log('Sample event:', JSON.stringify(events[0], null, 2));
    }
    if (eventTickets.length > 0) {
      console.log('Sample eventTicket:', JSON.stringify(eventTickets[0], null, 2));
    }
    
    // Group events, tickets, and packages by function
    const eventsByFunction = {};
    const ticketsByEvent = {};
    const packagesByFunction = {};
    
    events.forEach(event => {
      const funcId = event.function_id || event.functionId;
      if (!eventsByFunction[funcId]) {
        eventsByFunction[funcId] = [];
      }
      eventsByFunction[funcId].push(event);
    });
    
    eventTickets.forEach(ticket => {
      const evtId = ticket.event_id || ticket.eventId;
      if (!ticketsByEvent[evtId]) {
        ticketsByEvent[evtId] = [];
      }
      ticketsByEvent[evtId].push(ticket);
    });
    
    packages.forEach(pkg => {
      const funcId = pkg.function_id || pkg.functionId;
      if (!packagesByFunction[funcId]) {
        packagesByFunction[funcId] = [];
      }
      packagesByFunction[funcId].push(pkg);
    });
    
    // Process each function
    for (const func of functions) {
      try {
        // Initialize inventory tracking for this catalog BEFORE transformation
        const catalogId = func._id;
        if (!migrationState.inventoryUpdates.has(catalogId.toString())) {
          migrationState.inventoryUpdates.set(catalogId.toString(), new Map());
        }
        
        const catalogObject = await transformFunctionToCatalog(
          func, 
          eventsByFunction[func.function_id || func.functionId] || [], 
          ticketsByEvent,
          packagesByFunction[func.function_id || func.functionId] || [],
          migrationState
        );
        
        // Store mapping
        migrationState.functionToCatalog.set(func.function_id || func.functionId, catalogObject._id);
        
        // Write catalog object
        await writeDocument('catalog-objects', catalogObject._id, catalogObject);
        
        // IMPORTANT: After creating the catalog, ensure ALL products and variations are mapped
        // This handles cases where tickets reference events that weren't in the events collection
        for (const product of catalogObject.products) {
          // Ensure product mapping exists
          if (!migrationState.eventToProduct.has(product.productId)) {
            migrationState.eventToProduct.set(product.productId, {
              catalogId: catalogObject._id.toString(),
              productId: product.productId
            });
          }
          
          // Ensure all variation mappings exist
          for (const variation of product.variations) {
            if (variation.variationId) {
              const key = variation.variationId;
              if (!migrationState.ticketToVariation.has(key)) {
                migrationState.ticketToVariation.set(key, {
                  catalogId: catalogObject._id.toString(),
                  productId: product.productId,
                  variationId: variation.variationId
                });
              }
            }
          }
        }
        
      } catch (error) {
        await logError('CATALOG_MIGRATION', error, { 
          functionId: func.function_id || func.functionId,
          functionName: func.name 
        });
      }
    }
    
    console.log(`Successfully migrated ${migrationState.stats['catalog-objects']} catalog objects`);
    
  } catch (error) {
    await logError('CATALOG_MIGRATION_FATAL', error);
    throw error;
  }
}

async function transformFunctionToCatalog(func, events, ticketsByEvent, packages, migrationState) {
  // Use function's existing ObjectId
  const catalogId = func._id;
  
  // Transform events to products
  const products = [];
  
  // Process regular events first
  for (const event of events) {
    const eventTickets = ticketsByEvent[event.event_id || event.eventId] || [];
    
    // Transform event to product
    const product = {
      productId: event.eventId || event.event_id, // Use existing event ID
      name: event.title || event.name || 'Unnamed Event',
      description: event.description || '',
      category: 'event',
      slug: event.slug || generateSlug(event.title || event.name),
      status: event.published ? 'active' : 'inactive',
      
      attributes: {
        eventType: event.type || 'general',
        eventStart: event.event_start || event.eventStart || func.dates?.start_date || func.dates?.startDate,
        eventEnd: event.event_end || event.eventEnd || func.dates?.end_date || func.dates?.endDate,
        location: event.location || func.location || {},
        inclusions: event.event_includes || event.eventIncludes || '',
        images: event.image_url || event.imageUrl ? [event.image_url || event.imageUrl] : []
      },
      
      dependencies: [],
      
      // Transform tickets to variations
      variations: eventTickets.map(ticket => {
        const ticketId = ticket.eventTicketId || ticket.event_ticket_id || ticket.ticket_id || ticket.ticketId;
        console.log(`Creating variation for ticket ${ticketId} with name: ${ticket.name}`);  // Debug
        
        // Store mapping - use the ticket ID as the key since that's what attendee tickets reference
        migrationState.ticketToVariation.set(ticketId, {
          catalogId: catalogId.toString(),
          productId: event.eventId || event.event_id,
          variationId: ticketId
        });
        
        // Initialize inventory for this variation
        const inventoryKey = `${event.eventId || event.event_id}:${ticketId}`;
        migrationState.inventoryUpdates.get(catalogId.toString()).set(inventoryKey, {
          quantity_sold: 0,
          quantity_reserved: 0
        });
        
        return {
          variationId: ticketId, // Use existing ticket ID
          name: ticket.name || 'Standard Ticket',
          description: ticket.description || '',
          attributes: {},
          
          price: {
            amount: Decimal128.fromString(String(ticket.price || 0)),
            currency: 'AUD'
          },
          
          inventory: {
            method: ticket.inventory_method || ticket.inventoryMethod || 'allocated',
            quantity_total: ticket.capacity || 100,
            quantity_sold: 0, // Will be updated during registration migration
            quantity_reserved: 0,
            quantity_available: ticket.capacity || 100
          },
          
          status: ticket.active ? 'active' : 'inactive'
        };
      })
    };
    
    // Store event to product mapping
    migrationState.eventToProduct.set(event.eventId || event.event_id, {
      catalogId: catalogId.toString(),
      productId: event.eventId || event.event_id
    });
    
    products.push(product);
  }
  
  // Process packages - store them as mappings, not products
  for (const pkg of packages) {
    // Parse included items to understand what the package contains
    const includedItems = parsePackageIncludedItems(pkg.included_items || pkg.includedItems);
    
    // Store package mapping with details about what it contains
    migrationState.packageMappings = migrationState.packageMappings || new Map();
    migrationState.packageMappings.set(pkg.packageId || pkg.package_id, {
      packageId: pkg.packageId || pkg.package_id,
      name: pkg.name || 'Package',
      description: pkg.description || '',
      price: pkg.packagePrice || pkg.package_price || 0,
      includedItems: includedItems,
      registrationTypes: pkg.registrationTypes || pkg.registration_types || [],
      functionId: pkg.functionId || pkg.function_id
    });
  }
  
  // Calculate catalog dates
  const allEventDates = products.flatMap(p => [
    p.attributes.eventStart,
    p.attributes.eventEnd
  ]).filter(Boolean);
  
  const startDate = allEventDates.length > 0 
    ? new Date(Math.min(...allEventDates.map(d => new Date(d).getTime())))
    : func.dates?.start_date || func.dates?.startDate;
    
  const endDate = allEventDates.length > 0
    ? new Date(Math.max(...allEventDates.map(d => new Date(d).getTime())))
    : func.dates?.end_date || func.dates?.endDate;
  
  // Create catalog object
  return {
    _id: catalogId,
    catalogId: func.function_id || func.functionId, // Preserve original UUID
    name: func.name || 'Unnamed Function',
    description: func.description || '',
    slug: func.slug || generateSlug(func.name),
    type: 'function',
    status: determineStatus(func, products),
    
    organizer: {
      type: 'organisation',
      id: func.organiser_id || func.organiserId || null,
      name: func.organiser_name || func.organiserName || ''
    },
    
    createdBy: func.created_by || func.createdBy || null,
    
    dates: {
      publishedDate: func.dates?.published_date || func.dates?.publishedDate || new Date(),
      onSaleDate: func.dates?.on_sale_date || func.dates?.onSaleDate || new Date(),
      closedDate: func.dates?.closed_date || func.dates?.closedDate || null,
      startDate: startDate,
      endDate: endDate,
      createdAt: func.created_at || func.createdAt || new Date(),
      updatedAt: func.updated_at || func.updatedAt || new Date()
    },
    
    products: products,
    
    inventory: {
      totalCapacity: products.reduce((sum, p) => 
        sum + p.variations.reduce((vSum, v) => vSum + (v.inventory.quantity_total || 0), 0), 0
      ),
      totalSold: 0, // Will be updated during migration
      totalAvailable: products.reduce((sum, p) => 
        sum + p.variations.reduce((vSum, v) => vSum + (v.inventory.quantity_available || 0), 0), 0
      ),
      totalRevenue: Decimal128.fromString('0')
    },
    
    settings: {
      registration_types: func.registration_types || func.registrationTypes || ['individual', 'lodge'],
      payment_gateways: func.payment_gateways || func.paymentGateways || ['stripe'],
      allow_partial_registrations: func.allow_partial_registrations || func.allowPartialRegistrations || false
    }
  };
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parsePackageIncludedItems(items) {
  if (!items) return [];
  
  // If already an array, return it
  if (Array.isArray(items)) {
    return items;
  }
  
  // Parse PostgreSQL array format like {"(fd12d7f0-f346-49bf-b1eb-0682ad226216,10)"}
  if (typeof items === 'string') {
    const cleaned = items.replace(/[{}"]/g, '');
    if (!cleaned) return [];
    
    const parsedItems = [];
    const parts = cleaned.match(/\([^)]+\)/g) || [];
    
    parts.forEach(part => {
      const [variationId, quantity] = part.replace(/[()]/g, '').split(',');
      if (variationId && quantity) {
        parsedItems.push({
          variationId: variationId.trim(),
          quantity: parseInt(quantity.trim(), 10) || 1
        });
      }
    });
    
    return parsedItems;
  }
  
  return [];
}

function determineStatus(func, products) {
  // Determine catalog status based on function and product data
  if (func.status === 'archived' || func.archived) return 'archived';
  if (func.status === 'closed' || func.closed) return 'closed';
  
  const hasActiveProducts = products.some(p => 
    p.status === 'active' && p.variations.some(v => v.status === 'active')
  );
  
  if (!hasActiveProducts) return 'draft';
  
  const now = new Date();
  const startDate = func.dates?.start_date || func.dates?.startDate ? new Date(func.dates?.start_date || func.dates.startDate) : null;
  
  if (startDate && startDate < now) return 'closed';
  
  return 'active';
}

/**
 * Transform a package into a product for the catalog
 */
async function transformPackageToProduct(pkg, migrationState, catalogId) {
  // Parse included items - can be either PostgreSQL array format or already parsed array
  const parseIncludedItems = (items) => {
    if (!items) return [];
    
    // If already an array, return it
    if (Array.isArray(items)) {
      return items;
    }
    
    // Otherwise parse PostgreSQL array format like {"(fd12d7f0-f346-49bf-b1eb-0682ad226216,10)"}
    if (typeof items === 'string') {
      // Remove outer braces and quotes
      const cleaned = items.replace(/[{}"]/g, '');
      if (!cleaned) return [];
      
      // Split by commas that are not inside parentheses
      const parsedItems = [];
      const parts = cleaned.match(/\([^)]+\)/g) || [];
      
      parts.forEach(part => {
        // Remove parentheses and split
        const [variationId, quantity] = part.replace(/[()]/g, '').split(',');
        if (variationId && quantity) {
          parsedItems.push({
            variationId: variationId.trim(),
            quantity: parseInt(quantity.trim(), 10) || 1
          });
        }
      });
      
      return parsedItems;
    }
    
    return [];
  };
  
  const includedItems = parseIncludedItems(pkg.included_items || pkg.includedItems);
  
  // Create package variation
  const packageVariation = {
    variationId: pkg.packageId || pkg.package_id,
    name: pkg.name || 'Package',
    description: pkg.description || '',
    attributes: {
      includedItems: includedItems,
      quantity: pkg.quantity || 1
    },
    
    price: {
      amount: Decimal128.fromString(String(pkg.packagePrice || pkg.package_price || 0)),
      currency: 'AUD'
    },
    
    // Packages typically have limited inventory
    inventory: {
      method: 'allocated',
      quantity_total: pkg.available_quantity || pkg.availableQuantity || 100,
      quantity_sold: 0,
      quantity_reserved: 0,
      quantity_available: pkg.available_quantity || pkg.availableQuantity || 100
    },
    
    status: 'active'
  };
  
  // Store package mapping for later use
  migrationState.ticketToVariation.set(pkg.packageId || pkg.package_id, {
    catalogId: catalogId.toString(),
    productId: pkg.packageId || pkg.package_id,
    variationId: pkg.packageId || pkg.package_id,
    isPackage: true,
    includedItems: includedItems
  });
  
  // Initialize inventory tracking for the package
  if (catalogId && migrationState.inventoryUpdates.has(catalogId.toString())) {
    const inventoryKey = `${pkg.packageId || pkg.package_id}:${pkg.packageId || pkg.package_id}`;
    migrationState.inventoryUpdates.get(catalogId.toString()).set(inventoryKey, {
      quantity_sold: 0,
      quantity_reserved: 0
    });
  }
  
  return {
    productId: pkg.packageId || pkg.package_id,
    name: pkg.name || 'Unnamed Package',
    description: pkg.description || '',
    category: 'package',
    slug: generateSlug(pkg.name),
    status: 'active',
    
    attributes: {
      originalPrice: pkg.originalPrice || pkg.original_price,
      discount: pkg.originalPrice ? 
        ((parseFloat(pkg.originalPrice) - parseFloat(pkg.packagePrice || pkg.package_price || 0)) / parseFloat(pkg.originalPrice) * 100).toFixed(2) + '%' : 
        '0%',
      registrationTypes: pkg.registrationTypes || pkg.registration_types || [],
      eligibilityCriteria: pkg.eligibilityCriteria || pkg.eligibility_criteria || '',
      includedItemsSummary: includedItems.map(item => `${item.quantity}x ${item.variationId}`).join(', ')
    },
    
    dependencies: includedItems.map(item => ({
      productId: migrationState.ticketToVariation.get(item.variationId)?.productId || null,
      variationId: item.variationId,
      quantity: item.quantity,
      type: 'included'
    })),
    
    variations: [packageVariation]
  };
}

module.exports = migrateCatalogObjects;