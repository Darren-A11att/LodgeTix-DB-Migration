# Functions Collection Schema

## Overview
The functions collection represents ticketed experiences (conferences, ceremonies, dinners) that contain multiple events. It serves as the product catalog for what can be purchased.

## Document Structure

```javascript
{
  _id: ObjectId,
  functionId: String,       // Unique identifier (e.g., "gp-2025")
  name: String,             // Display name
  description: String,      // Detailed description
  slug: String,             // URL-friendly unique identifier
  
  // Function dates
  dates: {
    publishedDate: Date,    // When function becomes visible
    onSaleDate: Date,       // When tickets go on sale
    closedDate: Date,       // When sales close
    startDate: Date,        // First event start (computed)
    endDate: Date,          // Last event end (computed)
    createdAt: Date,
    updatedAt: Date
  },
  
  // Events within this function
  events: [{
    event_id: String,       // Unique event identifier
    name: String,
    type: String,           // "dinner", "ceremony", "meeting", "social"
    slug: String,
    
    // Event details
    details: {
      subtitle: String,
      description: String,
      hero_image: String,   // URL to hero image
      inclusions: String,   // What's included
      importantDetails: String
    },
    
    // Location information
    location: {
      location_id: String,
      name: String,
      description: String,
      room_area: String,
      address: {
        addressLine1: String,
        addressLine2: String,
        suburb: String,
        postcode: String,
        state_territory: String,
        country: String
      },
      details: {
        parking: String,
        public_transport: String,
        google_maps_embed_url: String,
        features: String,
        dress_code: String
      },
      images: [String]      // Array of image URLs
    },
    
    // Eligibility criteria
    eligibility: {
      criteria: [{
        index: Number,
        key: String,
        value: String
      }]
    },
    
    // Products available for this event
    products: [{
      _id: ObjectId,
      sku: String,          // Stock keeping unit
      name: String,
      type: String,         // "ticket", "addon", "upgrade"
      description: String,
      status: String,       // "active", "inactive", "sold_out"
      
      // Pricing
      price: {
        amount: Decimal128,
        currency: String,   // "AUD"
        tax_rate: Number,   // 0.10 for 10% GST
        tax_included: Boolean
      },
      
      // Inventory management
      inventory: {
        tracking_method: String,  // "allocated", "unlimited"
        max: Number,             // Maximum available
        allocated: {
          sold: Number,          // Tickets sold
          reserved: Number,      // Temporarily reserved
          available: Number      // Remaining available
        },
        lastUpdated: Date,
        version: Number          // For optimistic locking
      },
      
      // Additional product settings
      restrictions: {
        min_per_order: Number,
        max_per_order: Number,
        membership_required: Boolean
      }
    }],
    
    // Event timing
    dates: {
      eventStart: Date,
      eventEnd: Date
    },
    
    // Event settings
    settings: {
      published: Boolean,
      featured: Boolean,
      capacity_management: {
        enforce_limits: Boolean,
        allow_waitlist: Boolean,
        reservation_timeout_minutes: Number
      }
    }
  }],
  
  // Non-event products (merchandise, etc.)
  merchandise: [{
    _id: ObjectId,
    sku: String,
    name: String,
    type: String,           // "merchandise", "donation"
    description: String,
    price: {
      amount: Decimal128,
      currency: String,
      tax_rate: Number,
      tax_included: Boolean
    },
    inventory: {
      tracking_method: String,
      max: Number,
      allocated: {
        sold: Number,
        reserved: Number,
        available: Number
      }
    },
    shipping: {
      weight_grams: Number,
      dimensions_cm: {
        length: Number,
        width: Number,
        height: Number
      },
      requires_shipping: Boolean
    }
  }],
  
  // Organiser information
  organiser: {
    name: String,
    contact: {
      email: String,
      phone: String
    },
    logo_url: String
  },
  
  // Venue information
  venue: {
    primary_location_id: String,
    locations: [String]     // All location IDs used
  },
  
  // Financial summary (computed from financial transactions)
  financial_summary: {
    currency: String,
    projections: {
      expected_revenue: Decimal128,
      expected_attendance: Number,
      break_even_point: Number
    },
    actuals: {
      total_registrations: Number,
      total_tickets_sold: Number,
      gross_revenue: Decimal128,
      net_revenue: Decimal128,
      processing_fees: Decimal128,
      tax_collected: Decimal128,
      refunds_issued: Decimal128,
      lastUpdated: Date
    },
    // References to financial transactions
    transactionCount: Number,
    firstTransactionDate: Date,
    lastTransactionDate: Date
  },
  
  // Function settings
  settings: {
    registration_types: [String],    // ["individual", "lodge", "delegation"]
    payment_gateways: [String],      // ["stripe", "square"]
    allow_partial_registrations: Boolean,
    require_attendee_details: String,  // "immediate", "later", "optional"
    bulk_discount_rules: [{
      type: String,                  // "lodge", "delegation"
      min_quantity: Number,
      discount_percentage: Number,
      discount_amount: Decimal128
    }],
    cancellation_policy: {
      allowed: Boolean,
      cutoff_date: Date,
      refund_percentage: Number
    }
  },
  
  // Additional features
  features: {
    accommodation: {
      enabled: Boolean,
      partner: String,
      booking_url: String
    },
    tourism: {
      enabled: Boolean,
      packages: [{
        name: String,
        description: String,
        price: Decimal128,
        url: String
      }]
    },
    sponsorship: {
      enabled: Boolean,
      tiers: [{
        name: String,
        amount: Decimal128,
        benefits: [String],
        logo_placement: [String],
        available_slots: Number,
        sold_slots: Number
      }]
    }
  },
  
  // SEO and marketing
  marketing: {
    meta_title: String,
    meta_description: String,
    keywords: [String],
    social_image: String,
    promotional_code: String
  },
  
  // Metadata
  metadata: {
    tags: [String],
    created_by: String,      // User email or ID
    version: Number,         // Document version
    last_modified_by: String,
    import_source: String,   // If imported from another system
    legacy_id: String        // ID from previous system
  }
}
```

## Field Constraints

### Required Fields
- `functionId` - Must be unique across collection
- `name` - Cannot be empty
- `slug` - Must be unique, lowercase, alphanumeric with hyphens
- `dates.startDate` - Must be before endDate
- `dates.endDate` - Must be after startDate
- `events` - Must have at least one event

### Computed Fields
- `dates.startDate` - Calculated from earliest event start time
- `dates.endDate` - Calculated from latest event end time
- `financial_summary.actuals` - Aggregated from financial transactions collection
- `events.products.inventory.allocated` - Updated via transactions when tickets are sold

## Relationships
- **Registrations** reference this collection via `functionId`
- **Financial Transactions** reference this collection via `reference.functionId`
- **Tickets** reference products within events via `product.productId`
- **Attendees** reference this collection via `registration.functionId`

## Patterns Used

### Embedded Pattern
Events and products are embedded within functions because:
- They are always accessed together
- They have a strong ownership relationship
- The total size remains well within MongoDB's 16MB document limit

### Computed Pattern
Financial summaries and inventory levels use computed values that are updated via:
- Change streams monitoring the financial transactions collection
- Atomic updates during ticket purchase transactions
- Scheduled aggregation jobs for financial summaries

### Attribute Pattern
The `features` object allows for flexible feature configuration without schema changes.

## Transaction Requirements
Updates to inventory must use MongoDB transactions to ensure:
- No overselling of limited capacity events
- Atomic updates across multiple products
- Consistent state between inventory and ticket creation