# Catalog Objects Collection Schema

## Overview
The catalog objects collection represents top-level groupings of products in the e-commerce model. Currently focused on "function" type (ticketed events), but designed to support merchandise collections and sponsorship programs in the future.

## Document Structure

```javascript
{
  _id: ObjectId,
  catalogId: String,              // UUID for the catalog object
  name: String,                   // Display name
  description: String,            // Detailed description  
  slug: String,                   // URL-friendly unique identifier
  type: String,                   // "function", "merchandise_collection", "sponsorship_program"
  status: String,                 // "draft", "published", "active", "closed", "archived"
  
  // Organizer information
  organizer: {
    type: String,                 // "organisation" or "contact"
    id: ObjectId,                 // Reference to organisation or contact
    name: String                  // Denormalized for display
  },
  
  createdBy: ObjectId,            // User who created this catalog object
  
  // Catalog dates
  dates: {
    publishedDate: Date,          // When catalog becomes visible
    onSaleDate: Date,             // When products go on sale
    closedDate: Date,             // When sales close
    startDate: Date,              // First product start (computed)
    endDate: Date,                // Last product end (computed)
    createdAt: Date,
    updatedAt: Date
  },
  
  // EMBEDDED PRODUCTS
  products: [{
    productId: String,            // UUID for the product
    name: String,
    description: String,
    category: String,             // "event", "merchandise", "sponsorship", "package"
    slug: String,
    status: String,               // "active", "inactive", "sold_out"
    
    // Flexible attributes based on category
    attributes: {
      // For events
      eventType: String,          // "dinner", "ceremony", "workshop"
      eventStart: Date,
      eventEnd: Date,
      location: {
        location_id: String,
        name: String,
        address: Object
      },
      inclusions: String,
      // For merchandise
      supplier: String,
      sku: String,
      // Common
      images: [String]
    },
    
    // Dependencies and eligibility
    dependencies: [{
      type: String,               // "eligibility", "prerequisite", "bundle"
      productId: String,          // Related product
      criteria: Object            // Flexible criteria object
    }],
    
    // EMBEDDED VARIATIONS (ticket types, sizes, etc)
    variations: [{
      variationId: String,        // UUID for the variation
      name: String,               // "Standard", "VIP", "Early Bird"
      description: String,
      attributes: Object,         // Variation-specific attributes
      
      price: {
        amount: Decimal128,
        currency: String          // "AUD", "NZD", "USD"
      },
      
      // INVENTORY TRACKING
      inventory: {
        method: String,           // "allocated" or "unlimited"
        quantity_total: Number,   // Maximum that can be sold
        quantity_sold: Number,    // Current sold count
        quantity_reserved: Number,// In carts/pending
        quantity_available: Number // total - sold - reserved
      },
      
      status: String              // "active", "inactive", "sold_out"
    }]
  }],
  
  // Computed inventory summary
  inventory: {
    totalCapacity: Number,        // Sum of all variations.quantity_total
    totalSold: Number,            // Sum of all variations.quantity_sold
    totalAvailable: Number,       // Sum of all variations.quantity_available
    totalRevenue: Decimal128      // Sum of (price × quantity_sold)
  },
  
  // Settings
  settings: {
    registration_types: [String], // ["individual", "lodge", "delegation"]
    payment_gateways: [String],   // ["stripe", "square"]
    allow_partial_registrations: Boolean
  }
}
```

## Field Descriptions

### Core Fields
- **catalogId**: Unique UUID identifier for backwards compatibility
- **name**: Human-readable name for the catalog object
- **slug**: URL-friendly identifier (must be unique)
- **type**: Currently only "function" implemented
- **status**: Lifecycle state of the catalog

### Organizer
The entity responsible for this catalog:
- **type**: Either "organisation" (lodge) or "contact" (individual)
- **id**: Reference to the organizer record
- **name**: Denormalized for quick display

### Products Array
Embedded products within this catalog:
- **category**: Type of product (event, merchandise, sponsorship, package)
- **attributes**: Flexible object for category-specific data
- **dependencies**: Rules for product eligibility or bundling

### Variations Array
Different versions of each product:
- **name**: Variation identifier (e.g., "VIP Ticket", "Gold Sponsor")
- **inventory**: Real-time tracking of availability
- **price**: Amount and currency for this variation

### Inventory Object
Real-time inventory tracking:
- **quantity_total**: Maximum capacity
- **quantity_sold**: Atomically updated on purchase
- **quantity_reserved**: Temporarily held in carts
- **quantity_available**: Computed as total - sold - reserved

## Embedded Pattern Rationale

Products and variations are embedded because:
1. **Always accessed together**: When displaying a function, all events/tickets needed
2. **Strong ownership**: Products belong to exactly one catalog
3. **Atomic updates**: Inventory updates need to be atomic
4. **Size limits**: Even large functions stay well under MongoDB's 16MB limit

## Indexes
- `catalogId` - Unique index
- `slug` - Unique index  
- `type, status` - Query optimization
- `products.productId` - Product lookup
- `products.variations.variationId` - Variation lookup
- `dates.startDate, dates.endDate` - Date range queries

## Business Rules

### Inventory Management
1. All inventory updates must be atomic operations
2. Check availability before accepting orders
3. Reserve inventory during checkout (with timeout)
4. Update sold count only after payment success

### Status Transitions
- `draft` → `published` → `active` → `closed` → `archived`
- Cannot skip states
- Some transitions irreversible (e.g., archived)

### Product Categories
- **event**: Ticketed experiences with dates/times
- **merchandise**: Physical goods requiring fulfillment
- **sponsorship**: Sponsorship packages with benefits
- **package**: Bundle of other products

### Price Management
- Prices stored as Decimal128 for precision
- Each variation has independent pricing
- Currency must be consistent within catalog

## Computed Fields

### Catalog Level
```javascript
// Total capacity across all products
totalCapacity: { $sum: "$products.variations.inventory.quantity_total" }

// Total revenue potential
totalRevenue: { 
  $sum: {
    $multiply: [
      "$products.variations.price.amount",
      "$products.variations.inventory.quantity_sold"
    ]
  }
}
```

### Date Computations
```javascript
// Start date = earliest product date
"dates.startDate": { $min: "$products.attributes.eventStart" }

// End date = latest product date  
"dates.endDate": { $max: "$products.attributes.eventEnd" }
```

## Migration from Functions

### Mapping
- Functions → Catalog Objects (type: "function")
- Events → Products (category: "event")
- Event Tickets → Variations
- Event attributes → Product attributes
- Ticket inventory → Variation inventory

### New Capabilities
- Support for non-event products
- Flexible attribute system
- Real-time inventory tracking
- Product dependencies/bundles
- Multi-currency support