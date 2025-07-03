# Products Collection - Indexes

## Unique Indexes

```javascript
// Unique product identifier
db.products.createIndex(
  { "productId": 1 },
  { 
    unique: true,
    name: "productId_unique"
  }
)

// Unique SKU across all products
db.products.createIndex(
  { "sku": 1 },
  { 
    unique: true,
    name: "sku_unique"
  }
)
```

## Query Optimization Indexes

```javascript
// Primary query pattern: products by function
db.products.createIndex(
  { "functionId": 1, "status": 1, "type": 1 },
  { 
    name: "function_status_type"
  }
)

// Event-specific products (tickets)
db.products.createIndex(
  { "functionId": 1, "eventId": 1, "type": 1, "status": 1 },
  { 
    name: "function_event_type_status"
  }
)

// Active products with availability
db.products.createIndex(
  { "status": 1, "inventory.availableCount": 1 },
  { 
    name: "status_availability"
  }
)

// Products by type
db.products.createIndex(
  { "type": 1, "status": 1 },
  { 
    name: "type_status"
  }
)

// Featured products
db.products.createIndex(
  { "functionId": 1, "display.featured": 1, "display.order": 1 },
  { 
    name: "function_featured_order",
    partialFilterExpression: { "display.featured": true }
  }
)
```

## Text Search Index

```javascript
// Full text search on product details
db.products.createIndex(
  { 
    "name": "text", 
    "description": "text", 
    "metadata.tags": "text" 
  },
  { 
    name: "product_text_search",
    weights: {
      "name": 10,
      "metadata.tags": 5,
      "description": 1
    }
  }
)
```

## External Integration Indexes

```javascript
// Stripe integration
db.products.createIndex(
  { "external.stripeProductId": 1 },
  { 
    sparse: true,
    name: "stripe_product_id"
  }
)

db.products.createIndex(
  { "external.stripePriceId": 1 },
  { 
    sparse: true,
    name: "stripe_price_id"
  }
)

// Square integration
db.products.createIndex(
  { "external.squareCatalogId": 1 },
  { 
    sparse: true,
    name: "square_catalog_id"
  }
)
```

## Inventory Management Indexes

```javascript
// Products needing restock
db.products.createIndex(
  { 
    "inventory.method": 1,
    "inventory.availableCount": 1,
    "status": 1
  },
  { 
    name: "inventory_monitoring"
  }
)

// Reserved items (for cart cleanup)
db.products.createIndex(
  { "inventory.reservedCount": 1, "inventory.lastUpdated": 1 },
  { 
    name: "reserved_timeout",
    partialFilterExpression: { "inventory.reservedCount": { $gt: 0 } }
  }
)
```

## Date-based Indexes

```javascript
// Product availability windows
db.products.createIndex(
  { "restrictions.startDate": 1, "restrictions.endDate": 1, "status": 1 },
  { 
    name: "availability_window"
  }
)

// Recently updated products
db.products.createIndex(
  { "updatedAt": -1 },
  { 
    name: "updated_recent"
  }
)
```

## Compound Index for Eligibility Queries

```javascript
// Eligibility rule lookups
db.products.createIndex(
  { 
    "functionId": 1,
    "eligibility.rules.type": 1,
    "eligibility.rules.value": 1,
    "status": 1
  },
  { 
    name: "function_eligibility"
  }
)
```

## Performance Notes

1. The `function_status_type` index serves most common queries
2. Partial indexes on featured and reserved items reduce index size
3. Sparse indexes on external IDs only index documents with those fields
4. Text index enables product search functionality
5. Consider index hints for complex eligibility queries

## Index Maintenance

```javascript
// Analyze index usage
db.products.aggregate([
  { $indexStats: {} },
  { $sort: { "accesses.ops": -1 } }
])

// Validate all indexes
db.products.validate({ full: true })

// Rebuild indexes if needed
db.products.reIndex()
```