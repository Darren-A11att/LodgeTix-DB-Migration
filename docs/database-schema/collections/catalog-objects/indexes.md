# Catalog Objects Collection - Indexes

## Primary Indexes

### 1. Unique Catalog ID
```javascript
db.catalogObjects.createIndex(
  { "catalogId": 1 },
  { 
    unique: true,
    name: "catalogId_unique"
  }
)
```
**Purpose**: Ensure catalog ID uniqueness (UUID)

### 2. Unique Slug
```javascript
db.catalogObjects.createIndex(
  { "slug": 1 },
  { 
    unique: true,
    name: "slug_unique"
  }
)
```
**Purpose**: URL-friendly unique identifier for SEO

## Query Optimization Indexes

### 3. Type and Status
```javascript
db.catalogObjects.createIndex(
  { "type": 1, "status": 1 },
  { 
    name: "type_status"
  }
)
```
**Purpose**: Filter catalogs by type and status

### 4. Active Catalogs
```javascript
db.catalogObjects.createIndex(
  { 
    "dates.onSaleDate": 1,
    "dates.closedDate": 1,
    "status": 1
  },
  { 
    name: "active_catalogs",
    partialFilterExpression: { 
      "status": { $in: ["published", "active"] }
    }
  }
)
```
**Purpose**: Find currently sellable catalogs

### 5. Organizer Lookup
```javascript
db.catalogObjects.createIndex(
  { "organizer.id": 1 },
  { 
    name: "organizer_lookup"
  }
)
```
**Purpose**: Find all catalogs by organizer

## Product and Inventory Indexes

### 6. Product Lookup
```javascript
db.catalogObjects.createIndex(
  { "products.productId": 1 },
  { 
    name: "product_lookup"
  }
)
```
**Purpose**: Direct access to products by ID

### 7. Variation Lookup
```javascript
db.catalogObjects.createIndex(
  { "products.variations.variationId": 1 },
  { 
    name: "variation_lookup"
  }
)
```
**Purpose**: Direct access to variations for inventory updates

### 8. Available Inventory
```javascript
db.catalogObjects.createIndex(
  { 
    "products.variations.inventory.quantity_available": 1,
    "status": 1
  },
  { 
    name: "available_inventory",
    partialFilterExpression: {
      "products.variations.inventory.quantity_available": { $gt: 0 },
      "status": "active"
    }
  }
)
```
**Purpose**: Find products with available inventory

## Date-based Indexes

### 9. Upcoming Functions
```javascript
db.catalogObjects.createIndex(
  { 
    "dates.startDate": 1,
    "type": 1
  },
  { 
    name: "upcoming_functions",
    partialFilterExpression: {
      "type": "function",
      "dates.startDate": { $gte: new Date() }
    }
  }
)
```
**Purpose**: List upcoming events/functions

### 10. Recently Updated
```javascript
db.catalogObjects.createIndex(
  { "dates.updatedAt": -1 },
  { 
    name: "recent_updates"
  }
)
```
**Purpose**: Track recent catalog changes

## Marketing Indexes

### 11. Promotional Codes
```javascript
db.catalogObjects.createIndex(
  { "marketing.promotional_codes.code": 1 },
  { 
    sparse: true,
    name: "promo_codes"
  }
)
```
**Purpose**: Validate promotional codes at checkout

### 12. Tags Search
```javascript
db.catalogObjects.createIndex(
  { "metadata.tags": 1 },
  { 
    name: "tag_search"
  }
)
```
**Purpose**: Filter catalogs by tags

## Compound Indexes for Complex Queries

### 13. Category Product Search
```javascript
db.catalogObjects.createIndex(
  { 
    "type": 1,
    "products.category": 1,
    "status": 1
  },
  { 
    name: "category_search"
  }
)
```
**Purpose**: Find specific product categories within catalog types

### 14. Price Range Search
```javascript
db.catalogObjects.createIndex(
  { 
    "products.variations.price.amount": 1,
    "products.variations.price.currency": 1,
    "status": 1
  },
  { 
    name: "price_range",
    partialFilterExpression: {
      "status": { $in: ["active", "published"] }
    }
  }
)
```
**Purpose**: Filter products by price range

## Text Search Index

### 15. Full-Text Search
```javascript
db.catalogObjects.createIndex(
  { 
    "name": "text",
    "description": "text",
    "products.name": "text",
    "products.description": "text"
  },
  { 
    name: "catalog_text_search",
    weights: {
      "name": 10,
      "products.name": 5,
      "description": 3,
      "products.description": 1
    }
  }
)
```
**Purpose**: Enable text search across catalog content

## Performance Indexes

### 16. Inventory Summary Updates
```javascript
db.catalogObjects.createIndex(
  { 
    "_id": 1,
    "inventorySummary.lastUpdated": 1
  },
  { 
    name: "inventory_summary_updates"
  }
)
```
**Purpose**: Efficiently update inventory summaries

## Index Maintenance

### Monitor Index Usage
```javascript
db.catalogObjects.aggregate([
  { $indexStats: {} },
  { $sort: { "accesses.ops": -1 } }
])
```

### Identify Slow Queries
```javascript
db.catalogObjects.find({
  "type": "function",
  "status": "active",
  "products.variations.inventory.quantity_available": { $gt: 0 }
}).explain("executionStats")
```

### Rebuild Indexes
```javascript
// Rebuild specific index
db.catalogObjects.dropIndex("variation_lookup")
db.catalogObjects.createIndex(
  { "products.variations.variationId": 1 },
  { name: "variation_lookup" }
)
```

## Index Strategy

1. **Primary Lookups**: UUID-based lookups for API operations
2. **Inventory Operations**: Optimized for atomic updates
3. **Discovery**: Support browsing and search operations
4. **Analytics**: Date-based indexes for reporting
5. **Partial Indexes**: Reduce size for conditional queries

## Critical Performance Notes

1. **Variation Updates**: The variation_lookup index is critical for inventory updates
2. **Active Catalogs**: Partial index reduces query scope significantly
3. **Text Search**: Weighted to prioritize catalog names over descriptions
4. **Compound Indexes**: Order matters - most selective field first