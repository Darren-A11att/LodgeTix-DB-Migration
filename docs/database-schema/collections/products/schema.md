# Products Collection Schema

## Overview
The products collection represents all purchasable items across the platform including event tickets, merchandise, and add-ons. It serves as the single source of truth for inventory management and product catalog.

## Document Structure

```javascript
{
  _id: ObjectId,
  productId: String,        // Unique identifier (UUID)
  functionId: String,       // Required - links to parent function
  eventId: String,          // Optional - only for event tickets/products
  
  // Product identification
  sku: String,              // Stock keeping unit - unique
  name: String,             // Display name
  description: String,      // Detailed description
  type: String,             // "ticket", "merchandise", "addon", "donation"
  category: String,         // "admission", "apparel", "commemorative", "vip_upgrade"
  
  // Pricing
  price: {
    amount: Decimal128,     // Base price
    currency: String,       // "AUD"
    taxRate: Number,        // 0.10 for 10% GST
    taxIncluded: Boolean,   // Whether tax is included in amount
    cost: Decimal128        // Cost price (for margin calculations)
  },
  
  // Inventory management
  inventory: {
    method: String,         // "allocated", "unlimited"
    totalCapacity: Number,  // Maximum available (null for unlimited)
    soldCount: Number,      // Number sold
    reservedCount: Number,  // Temporarily reserved (in carts)
    availableCount: Number, // Computed: totalCapacity - soldCount - reservedCount
    lastUpdated: Date,      // Last inventory update
    version: Number         // Optimistic locking version
  },
  
  // Product attributes
  attributes: {
    // For event tickets
    sessionInfo: {
      date: Date,           // Event date/time
      duration: Number,     // Duration in minutes
      venue: String,        // Venue name
      room: String          // Specific room/area
    },
    
    // For physical products
    shipping: {
      required: Boolean,    // Needs shipping
      weight: Number,       // Weight in grams
      dimensions: {
        length: Number,     // cm
        width: Number,      // cm
        height: Number      // cm
      },
      shippingClass: String // "standard", "express", "bulky"
    },
    
    // For digital products
    digital: {
      downloadUrl: String,
      expiryDays: Number
    }
  },
  
  // Eligibility and restrictions
  eligibility: {
    rules: [{
      type: String,         // "membership", "rank", "lodge", "jurisdiction"
      operator: String,     // "equals", "includes", "excludes"
      value: String,        // The value to check
      message: String       // Display message if rule not met
    }],
    operator: String        // "AND", "OR" - how to combine rules
  },
  
  // Purchase restrictions
  restrictions: {
    minPerOrder: Number,    // Minimum quantity per order
    maxPerOrder: Number,    // Maximum quantity per order
    maxPerAttendee: Number, // Maximum per unique attendee
    startDate: Date,        // When product becomes available
    endDate: Date,          // When product stops being available
    memberOnly: Boolean     // Requires membership
  },
  
  // Display settings
  display: {
    order: Number,          // Sort order in listings
    featured: Boolean,      // Highlight this product
    hidden: Boolean,        // Hide from public listings
    imageUrl: String,       // Product image
    thumbnailUrl: String,   // Thumbnail image
    badges: [String]        // ["bestseller", "limited", "new"]
  },
  
  // External integrations
  external: {
    stripeProductId: String,
    stripePriceId: String,
    squareCatalogId: String,
    xeroItemCode: String
  },
  
  // Status and lifecycle
  status: String,           // "draft", "active", "inactive", "sold_out", "discontinued"
  statusReason: String,     // Why status changed
  
  // Metadata
  metadata: {
    tags: [String],         // Searchable tags
    customFields: Object,   // Flexible key-value pairs
    source: String,         // Where product was created
    importId: String        // External import reference
  },
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date,
  createdBy: String,        // User ID who created
  updatedBy: String         // User ID who last updated
}
```

## Field Constraints

### Required Fields
- `productId` - Must be unique UUID
- `functionId` - Must reference valid function
- `sku` - Must be unique across collection
- `name` - Cannot be empty
- `type` - Must be valid type
- `price.amount` - Must be >= 0
- `inventory.method` - Must be specified
- `status` - Must be valid status

### Computed Fields
- `inventory.availableCount` - Calculated as totalCapacity - soldCount - reservedCount
- Updated via atomic operations during purchase/reservation

### Business Rules
- If `type` is "ticket", `eventId` should be provided
- If `inventory.method` is "allocated", `totalCapacity` must be > 0
- `reservedCount` items expire after cart timeout (typically 15 minutes)
- Status automatically changes to "sold_out" when availableCount reaches 0

## Indexes
- Unique: `productId`, `sku`
- Compound: `functionId` + `eventId` + `type`
- Single: `status`, `type`, `functionId`
- Text: `name`, `description`, `metadata.tags`

## Relationships
- **Functions** - Parent relationship via `functionId`
- **Events** - Optional relationship via `eventId`
- **Registrations** - Reference products via `items.productId`
- **Financial Transactions** - Reference products in line items

## Transaction Patterns

### Inventory Update
```javascript
// Reserve inventory (add to cart)
db.products.findOneAndUpdate(
  { 
    productId: "...",
    "inventory.availableCount": { $gte: quantity },
    status: "active"
  },
  {
    $inc: {
      "inventory.reservedCount": quantity,
      "inventory.availableCount": -quantity,
      "inventory.version": 1
    },
    $set: { "inventory.lastUpdated": new Date() }
  }
)

// Complete purchase (convert reserved to sold)
db.products.findOneAndUpdate(
  { 
    productId: "...",
    "inventory.reservedCount": { $gte: quantity }
  },
  {
    $inc: {
      "inventory.reservedCount": -quantity,
      "inventory.soldCount": quantity,
      "inventory.version": 1
    },
    $set: { "inventory.lastUpdated": new Date() }
  }
)
```

## Query Patterns

### Common Queries
```javascript
// Get all products for a function
db.products.find({ functionId: "...", status: "active" })

// Get tickets for an event
db.products.find({ 
  functionId: "...", 
  eventId: "...", 
  type: "ticket",
  status: "active"
})

// Get available merchandise
db.products.find({
  functionId: "...",
  type: "merchandise",
  status: "active",
  "inventory.availableCount": { $gt: 0 }
})

// Check eligibility
db.products.find({
  functionId: "...",
  $or: [
    { "eligibility.rules": { $size: 0 } },
    { "eligibility.rules.type": "membership", "eligibility.rules.value": userMembership }
  ]
})
```

## Notes
- Products are separated from Functions/Events for better inventory management
- Supports both event tickets and general merchandise
- Flexible attribute system accommodates different product types
- Optimistic locking via version field prevents overselling
- External IDs support integration with payment/accounting systems