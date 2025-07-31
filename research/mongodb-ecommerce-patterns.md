# MongoDB E-Commerce Patterns: Comprehensive Guide

## Table of Contents
1. [Shopping Cart Patterns](#1-shopping-cart-patterns)
2. [Order Lifecycle Management](#2-order-lifecycle-management)
3. [Inventory Management](#3-inventory-management)
4. [Product Catalog Structure](#4-product-catalog-structure)
5. [Pricing and Promotions](#5-pricing-and-promotions)
6. [Multi-Tenancy Patterns](#6-multi-tenancy-patterns)
7. [Search and Filtering](#7-search-and-filtering-optimization)
8. [Recommendation Engine](#8-recommendation-engine-data-structures)
9. [Review and Rating Systems](#9-review-and-rating-systems)
10. [Abandoned Cart Recovery](#10-abandoned-cart-recovery-patterns)

---

## 1. Shopping Cart Patterns

### Pattern Options

#### A. Embedded Approach
```javascript
// User document with embedded cart
{
  _id: ObjectId("userId"),
  email: "customer@example.com",
  shoppingCartItems: [
    {
      productId: ObjectId("productId"),
      quantity: 2,
      price: 29.99,
      addedAt: ISODate("2024-01-15")
    }
  ]
}
```

**Pros:**
- Atomic operations at document level
- Better read performance for cart with user data
- Simpler queries

**Cons:**
- 16MB BSON document size limit
- Can grow large with many shoppers
- Difficult to analyze cart patterns across users

#### B. Referenced Approach with Double Bookkeeping
```javascript
// Separate cart collection
{
  _id: "session_or_user_id",
  userId: ObjectId("userId"),
  status: "active",
  createdAt: ISODate("2024-01-15"),
  updatedAt: ISODate("2024-01-15"),
  expiresAt: ISODate("2024-01-15T12:30:00Z"),
  items: [
    {
      productId: ObjectId("productId"),
      quantity: 2,
      priceAtTime: 29.99,
      reserved: true
    }
  ],
  total: 59.98
}

// Product inventory with reservations
{
  _id: ObjectId("productId"),
  sku: "PROD-001",
  availableQty: 100,
  reservations: [
    {
      cartId: "session_id",
      quantity: 2,
      expiresAt: ISODate("2024-01-15T12:30:00Z")
    }
  ]
}
```

**Pros:**
- No document size limitations
- Better for analytics
- Supports product reservations
- Can handle cart expiration

**Cons:**
- Requires multiple queries
- More complex implementation
- Needs background job for cleanup

### Recommended Hybrid Approach (2024 Best Practice)

```javascript
// Cart with minimal embedded product info
{
  _id: "cart_id",
  userId: ObjectId("userId"),
  status: "active",
  items: [
    {
      productId: ObjectId("productId"),
      // Embed only display data
      productName: "Product Name",
      productImage: "image_url",
      quantity: 2,
      priceAtTime: 29.99,
      currentPrice: 32.99,  // For price change detection
      reservationId: ObjectId("reservationId")
    }
  ],
  metadata: {
    source: "web",
    abandonedEmailSent: false,
    createdAt: ISODate("2024-01-15"),
    updatedAt: ISODate("2024-01-15")
  }
}
```

**Implementation Notes:**
- Use references for product relationships
- Embed minimal data for display
- Implement atomic operations for updates
- Add indexes: `db.carts.createIndex({"items.productId": 1, "status": 1})`

---

## 2. Order Lifecycle Management

### Order State Machine Pattern

```javascript
// Order document with state tracking
{
  _id: ObjectId("orderId"),
  orderNumber: "ORD-2024-0001",
  customerId: ObjectId("customerId"),
  
  // State management
  status: "processing",
  statusHistory: [
    {
      status: "pending",
      timestamp: ISODate("2024-01-15T10:00:00Z"),
      updatedBy: "system"
    },
    {
      status: "payment_verified",
      timestamp: ISODate("2024-01-15T10:01:00Z"),
      updatedBy: "payment_service"
    },
    {
      status: "processing",
      timestamp: ISODate("2024-01-15T10:02:00Z"),
      updatedBy: "fulfillment_service"
    }
  ],
  
  // Order details
  items: [
    {
      productId: ObjectId("productId"),
      sku: "SKU-001",
      name: "Product Name",
      quantity: 2,
      unitPrice: 29.99,
      totalPrice: 59.98,
      fulfillmentStatus: "pending"
    }
  ],
  
  // Financial data
  pricing: {
    subtotal: 59.98,
    tax: 5.40,
    shipping: 9.99,
    discount: 5.00,
    total: 70.37
  },
  
  // Shipping information
  shipping: {
    method: "standard",
    address: { /* address subdocument */ },
    trackingNumber: "TRACK123",
    estimatedDelivery: ISODate("2024-01-20")
  },
  
  // Payment information
  payment: {
    method: "credit_card",
    transactionId: "stripe_pi_xxx",
    status: "captured"
  },
  
  // Timestamps
  timestamps: {
    placed: ISODate("2024-01-15T10:00:00Z"),
    paid: ISODate("2024-01-15T10:01:00Z"),
    fulfilled: null,
    delivered: null
  }
}
```

### ACID Transaction Pattern for Order Processing

```javascript
// Using MongoDB transactions for order creation
async function createOrder(cartId, paymentInfo) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // 1. Create order
    const order = await Order.create([orderData], { session });
    
    // 2. Update inventory
    await Product.bulkWrite(
      inventoryUpdates,
      { session }
    );
    
    // 3. Process payment
    const payment = await processPayment(paymentInfo, { session });
    
    // 4. Clear cart
    await Cart.findByIdAndUpdate(
      cartId,
      { status: 'converted', orderId: order._id },
      { session }
    );
    
    await session.commitTransaction();
    return order;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### Event-Driven Architecture Pattern

```javascript
// Order events collection for microservices
{
  _id: ObjectId(),
  orderId: ObjectId("orderId"),
  eventType: "order.status.changed",
  eventData: {
    previousStatus: "pending",
    newStatus: "processing",
    reason: "payment_confirmed"
  },
  timestamp: ISODate("2024-01-15T10:02:00Z"),
  processed: false,
  processingAttempts: 0
}
```

**Implementation Notes:**
- Use Change Streams for real-time event processing
- Implement idempotent event handlers
- Store events for audit trail and replay capability

---

## 3. Inventory Management

### Real-Time Inventory Tracking Pattern

```javascript
// Product inventory document
{
  _id: ObjectId("productId"),
  sku: "SKU-001",
  
  // Stock levels by location
  inventory: [
    {
      locationId: ObjectId("warehouse1"),
      locationName: "Main Warehouse",
      available: 500,
      reserved: 20,
      onHand: 520,
      reorderPoint: 100,
      reorderQuantity: 500
    },
    {
      locationId: ObjectId("store1"),
      locationName: "Store #1",
      available: 50,
      reserved: 5,
      onHand: 55,
      reorderPoint: 20,
      reorderQuantity: 50
    }
  ],
  
  // Active reservations
  reservations: [
    {
      _id: ObjectId("reservationId"),
      type: "cart",  // cart, order
      referenceId: "cart_123",
      locationId: ObjectId("warehouse1"),
      quantity: 2,
      expiresAt: ISODate("2024-01-15T12:00:00Z")
    }
  ],
  
  // Inventory movements
  movements: [
    {
      type: "inbound",
      quantity: 100,
      locationId: ObjectId("warehouse1"),
      reference: "PO-2024-001",
      timestamp: ISODate("2024-01-10")
    }
  ]
}
```

### Optimistic Inventory Update Pattern

```javascript
// Atomic inventory update with optimistic locking
async function reserveInventory(productId, quantity, cartId) {
  const result = await Product.findOneAndUpdate(
    {
      _id: productId,
      "inventory.available": { $gte: quantity }
    },
    {
      $inc: { 
        "inventory.$.available": -quantity,
        "inventory.$.reserved": quantity
      },
      $push: {
        reservations: {
          _id: new ObjectId(),
          type: "cart",
          referenceId: cartId,
          quantity: quantity,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
        }
      }
    },
    {
      new: true,
      runValidators: true
    }
  );
  
  if (!result) {
    throw new Error("Insufficient inventory");
  }
  
  return result;
}
```

### Event-Driven Inventory Management

```javascript
// Inventory event document
{
  _id: ObjectId(),
  eventType: "inventory.movement",
  productId: ObjectId("productId"),
  locationId: ObjectId("locationId"),
  movement: {
    type: "adjustment",  // sale, return, adjustment, transfer
    quantity: -5,
    reason: "damaged",
    reference: "ADJ-2024-001"
  },
  timestamp: ISODate("2024-01-15T10:00:00Z"),
  userId: ObjectId("userId")
}
```

**Implementation Notes:**
- Use Change Streams for real-time inventory updates
- Implement background job for reservation cleanup
- Create compound indexes for location-based queries
- Consider sharding by productId for scale

---

## 4. Product Catalog Structure

### Flexible Product Schema

```javascript
// Base product document
{
  _id: ObjectId("productId"),
  sku: "PARENT-SKU",
  type: "configurable",  // simple, configurable, bundle
  
  // Basic information
  name: "Product Name",
  slug: "product-name",
  description: "Product description",
  brand: "Brand Name",
  
  // Categories (multiple hierarchy support)
  categories: [
    {
      _id: ObjectId("categoryId"),
      name: "Electronics",
      path: "electronics",
      level: 0
    },
    {
      _id: ObjectId("subcategoryId"),
      name: "Laptops",
      path: "electronics/laptops",
      level: 1
    }
  ],
  
  // Flexible attributes using Polymorphic Pattern
  attributes: {
    color: ["Black", "Silver"],
    size: ["13-inch", "15-inch"],
    processor: "Intel i7",
    ram: "16GB",
    storage: "512GB SSD",
    // Can add any attribute without schema changes
    customAttribute: "value"
  },
  
  // Search and filter optimization
  searchTags: ["laptop", "computer", "intel", "portable"],
  
  // Variants for configurable products
  variants: [
    {
      sku: "VARIANT-001",
      attributes: {
        color: "Black",
        size: "13-inch"
      },
      pricing: {
        regular: 1299.99,
        sale: 999.99,
        cost: 750.00
      },
      inventory: {
        trackInventory: true,
        qty: 50
      },
      images: ["variant1.jpg"]
    }
  ],
  
  // Media
  images: [
    {
      url: "main-image.jpg",
      alt: "Product main image",
      position: 1,
      tags: ["main", "listing"]
    }
  ],
  
  // SEO
  seo: {
    metaTitle: "Product Name - Best Deal",
    metaDescription: "Buy Product Name...",
    metaKeywords: ["product", "keywords"]
  },
  
  // Status and visibility
  status: "active",
  visibility: ["catalog", "search"],
  
  // Timestamps
  createdAt: ISODate("2024-01-01"),
  updatedAt: ISODate("2024-01-15")
}
```

### Product Relations Pattern

```javascript
// Related products collection
{
  _id: ObjectId(),
  productId: ObjectId("productId"),
  relationType: "cross-sell",  // up-sell, cross-sell, related
  relatedProducts: [
    {
      productId: ObjectId("relatedProductId"),
      position: 1,
      reason: "frequently_bought_together"
    }
  ]
}
```

### Bundle Products Pattern

```javascript
// Bundle product structure
{
  _id: ObjectId("bundleId"),
  type: "bundle",
  name: "Laptop Complete Setup",
  
  // Bundle components
  bundleItems: [
    {
      productId: ObjectId("laptopId"),
      sku: "LAPTOP-001",
      quantity: 1,
      priceContribution: 900.00,
      required: true
    },
    {
      productId: ObjectId("mouseId"),
      sku: "MOUSE-001",
      quantity: 1,
      priceContribution: 50.00,
      required: false
    }
  ],
  
  // Bundle pricing
  pricing: {
    bundlePrice: 899.99,
    savingsAmount: 50.01,
    savingsPercent: 5.3
  }
}
```

**Implementation Notes:**
- Use compound indexes for category + attributes filtering
- Implement faceted search with aggregation pipeline
- Consider separate collection for frequently changing data (prices, inventory)
- Use Atlas Search for full-text search capabilities

---

## 5. Pricing and Promotions

### Dynamic Pricing Model

```javascript
// Price rules collection
{
  _id: ObjectId("priceRuleId"),
  name: "VIP Customer Pricing",
  priority: 10,
  
  // Conditions
  conditions: {
    customerGroups: ["vip", "wholesale"],
    minQuantity: 1,
    dateRange: {
      start: ISODate("2024-01-01"),
      end: ISODate("2024-12-31")
    }
  },
  
  // Actions
  actions: {
    type: "percentage_discount",
    value: 15,
    appliesTo: "subtotal"
  },
  
  // Scope
  scope: {
    products: ["all"],  // or specific product IDs
    categories: ["electronics"],
    brands: ["Apple", "Samsung"]
  }
}
```

### Promotion/Coupon System

```javascript
// Promotion document
{
  _id: ObjectId("promotionId"),
  code: "SUMMER2024",
  name: "Summer Sale 2024",
  type: "coupon",  // automatic, coupon
  status: "active",
  
  // Usage limits
  usage: {
    limitPerCoupon: 1000,
    limitPerCustomer: 1,
    used: 245
  },
  
  // Conditions
  conditions: {
    minPurchase: 100.00,
    validFrom: ISODate("2024-06-01"),
    validTo: ISODate("2024-08-31"),
    customerSegments: ["new", "returning"],
    paymentMethods: ["credit_card", "paypal"]
  },
  
  // Benefits
  benefits: {
    type: "tiered_discount",
    tiers: [
      {
        minAmount: 100,
        discount: { type: "percentage", value: 10 }
      },
      {
        minAmount: 200,
        discount: { type: "percentage", value: 15 }
      },
      {
        minAmount: 500,
        discount: { type: "fixed", value: 100 }
      }
    ]
  },
  
  // Exclusions
  exclusions: {
    products: [ObjectId("excludedProductId")],
    categories: ["clearance"],
    brands: ["LuxuryBrand"]
  },
  
  // Stacking rules
  stackable: {
    withOtherCoupons: false,
    withSaleItems: true,
    priority: 1
  }
}
```

### Buy X Get Y Promotions

```javascript
// BOGO promotion structure
{
  _id: ObjectId("bogoPromoId"),
  name: "Buy 2 Get 1 Free",
  type: "buy_x_get_y",
  
  trigger: {
    products: [ObjectId("productA"), ObjectId("productB")],
    quantity: 2,
    aggregationType: "any"  // any, all
  },
  
  reward: {
    products: [ObjectId("productC")],
    quantity: 1,
    discountType: "percentage",
    discountValue: 100,  // 100% off = free
    maxRewardQty: 1
  }
}
```

### Price History Tracking

```javascript
// Price history for analytics
{
  _id: ObjectId(),
  productId: ObjectId("productId"),
  sku: "SKU-001",
  priceChanges: [
    {
      regular: 129.99,
      sale: 99.99,
      cost: 75.00,
      currency: "USD",
      effectiveFrom: ISODate("2024-01-01"),
      effectiveTo: ISODate("2024-01-31"),
      reason: "January Sale",
      changedBy: ObjectId("userId")
    }
  ]
}
```

**Implementation Notes:**
- Calculate prices in real-time using aggregation pipeline
- Cache calculated prices in Redis for performance
- Use priority system for conflicting promotions
- Implement promotion usage tracking for limits

---

## 6. Multi-Tenancy Patterns

### Pattern A: Shared Database, Shared Collections

```javascript
// All tenants in same collections with tenantId
{
  _id: ObjectId(),
  tenantId: "tenant_123",  // Required field
  type: "product",
  name: "Product Name",
  // ... other fields
}

// Query pattern - always include tenantId
db.products.find({ tenantId: "tenant_123", category: "electronics" });

// Index strategy
db.products.createIndex({ tenantId: 1, category: 1 });
```

**Pros:**
- Simple implementation
- Cost-effective for many small tenants
- Easy to maintain

**Cons:**
- Security managed at application level
- Potential noisy neighbor issues
- Limited customization per tenant

### Pattern B: Database per Tenant

```javascript
// Tenant configuration collection (in shared admin DB)
{
  _id: "tenant_123",
  name: "Acme Corp",
  database: "tenant_123_db",
  settings: {
    timezone: "America/New_York",
    currency: "USD",
    features: ["advanced_analytics", "multi_warehouse"]
  },
  subscription: {
    plan: "enterprise",
    limits: {
      products: 100000,
      orders: 1000000,
      users: 500
    }
  }
}

// Connection routing
function getTenantConnection(tenantId) {
  const config = await TenantConfig.findById(tenantId);
  return mongoose.createConnection(
    `mongodb://host/${config.database}`
  );
}
```

**Pros:**
- Strong data isolation
- Per-tenant backup/restore
- Custom indexes per tenant
- Better security with RBAC

**Cons:**
- Higher operational overhead
- Connection pool management
- 10,000 collections soft limit per cluster

### Pattern C: Hybrid Approach

```javascript
// Shared data in common database
// Common product catalog
{
  _id: ObjectId("productId"),
  type: "master_product",
  name: "Generic Product",
  basePrice: 100.00,
  sharedSpecs: { /* specs */ }
}

// Tenant-specific data in tenant database
// Tenant's product customization
{
  _id: ObjectId(),
  tenantId: "tenant_123",
  masterProductId: ObjectId("productId"),
  customName: "Tenant's Product Name",
  customPrice: 95.00,
  tenantSpecificFields: { /* custom fields */ }
}
```

### Multi-Tenant Schema Validation

```javascript
// Tenant-specific schema validation
db.runCommand({
  collMod: "products",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["tenantId", "name", "price"],
      properties: {
        tenantId: {
          bsonType: "string",
          description: "Tenant identifier - required"
        },
        // Allow additional properties for flexibility
        additionalProperties: true
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});
```

**Implementation Notes:**
- Use connection pooling strategies for database-per-tenant
- Implement tenant context middleware
- Consider sharding by tenantId for horizontal scaling
- Monitor resource usage per tenant

---

## 7. Search and Filtering Optimization

### Atlas Search Configuration

```javascript
// Atlas Search index definition
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "name": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "description": {
        "type": "string",
        "analyzer": "lucene.english"
      },
      "categories": {
        "type": "string",
        "analyzer": "lucene.keyword"
      },
      "attributes": {
        "type": "document",
        "dynamic": true
      },
      "price": {
        "type": "number"
      },
      "searchTags": {
        "type": "string",
        "analyzer": "lucene.standard"
      }
    }
  }
}
```

### Faceted Search Implementation

```javascript
// Faceted search aggregation pipeline
async function facetedSearch(searchTerm, filters = {}) {
  const pipeline = [
    // Search stage
    {
      $search: {
        index: "product_search",
        compound: {
          must: [
            {
              text: {
                query: searchTerm,
                path: ["name", "description", "searchTags"]
              }
            }
          ],
          filter: buildFilters(filters)
        }
      }
    },
    
    // Facets stage - 100x faster in 2024
    {
      $facet: {
        // Results
        results: [
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          {
            $project: {
              name: 1,
              price: 1,
              image: 1,
              score: { $meta: "searchScore" }
            }
          }
        ],
        
        // Category facets
        categories: [
          { $unwind: "$categories" },
          { $group: {
            _id: "$categories.name",
            count: { $sum: 1 }
          }},
          { $sort: { count: -1 } },
          { $limit: 10 }
        ],
        
        // Price range facets
        priceRanges: [
          {
            $bucket: {
              groupBy: "$price",
              boundaries: [0, 50, 100, 200, 500, 1000, 10000],
              default: "Other",
              output: { count: { $sum: 1 } }
            }
          }
        ],
        
        // Brand facets
        brands: [
          { $group: {
            _id: "$brand",
            count: { $sum: 1 }
          }},
          { $sort: { count: -1 } },
          { $limit: 20 }
        ],
        
        // Total count
        totalCount: [
          { $count: "total" }
        ]
      }
    }
  ];
  
  return await Product.aggregate(pipeline);
}
```

### Auto-Complete Implementation

```javascript
// Autocomplete search index
{
  "mappings": {
    "fields": {
      "name": {
        "type": "autocomplete",
        "analyzer": "lucene.standard",
        "maxGrams": 15,
        "minGrams": 2
      },
      "searchSuggestions": {
        "type": "autocomplete",
        "analyzer": "lucene.keyword"
      }
    }
  }
}

// Autocomplete query
async function autocomplete(prefix) {
  return await Product.aggregate([
    {
      $search: {
        index: "autocomplete_index",
        autocomplete: {
          query: prefix,
          path: "name",
          fuzzy: {
            maxEdits: 1
          }
        }
      }
    },
    {
      $limit: 10
    },
    {
      $project: {
        name: 1,
        category: 1,
        score: { $meta: "searchScore" }
      }
    }
  ]);
}
```

### Performance Optimization Strategies

```javascript
// Compound indexes for filtering
db.products.createIndex({
  "status": 1,
  "categories._id": 1,
  "price": 1,
  "createdAt": -1
});

// Text index for basic search (fallback)
db.products.createIndex({
  name: "text",
  description: "text",
  searchTags: "text"
});

// Wildcard index for dynamic attributes
db.products.createIndex({ "attributes.$**": 1 });
```

**Implementation Notes:**
- Use Atlas Search for complex search requirements
- Implement search result caching
- Consider search query analytics for optimization
- Use aggregation pipeline for complex filtering

---

## 8. Recommendation Engine Data Structures

### User Behavior Tracking

```javascript
// User interaction events
{
  _id: ObjectId(),
  userId: ObjectId("userId"),
  sessionId: "session_123",
  eventType: "product_view",  // view, add_to_cart, purchase, rating
  productId: ObjectId("productId"),
  
  // Context data
  context: {
    category: "electronics",
    price: 599.99,
    brand: "Samsung",
    searchQuery: "laptop",
    referrer: "search_results"
  },
  
  // Event metadata
  timestamp: ISODate("2024-01-15T10:30:00Z"),
  deviceType: "mobile",
  location: {
    country: "US",
    region: "CA"
  }
}
```

### Collaborative Filtering Data

```javascript
// User-product interactions matrix
{
  _id: ObjectId(),
  userId: ObjectId("userId"),
  productInteractions: [
    {
      productId: ObjectId("productId1"),
      score: 4.5,  // Could be rating, purchase weight, view count
      interactionTypes: ["view", "purchase", "rating"],
      lastInteraction: ISODate("2024-01-15")
    }
  ],
  
  // User similarity scores (pre-computed)
  similarUsers: [
    {
      userId: ObjectId("similarUserId"),
      similarity: 0.85,
      sharedInteractions: 15
    }
  ]
}
```

### Product Similarity with Vector Embeddings

```javascript
// Product with vector embeddings
{
  _id: ObjectId("productId"),
  name: "Product Name",
  
  // Traditional attributes
  attributes: {
    category: "electronics",
    brand: "Apple",
    price: 999.99
  },
  
  // Vector embeddings from AI model
  embeddings: {
    textEmbedding: [0.123, -0.456, 0.789, ...], // 1536 dimensions
    imageEmbedding: [0.234, 0.567, -0.890, ...], // 512 dimensions
    model: "voyage-3-large",
    generatedAt: ISODate("2024-01-15")
  }
}

// Vector search for similar products
async function findSimilarProducts(productId, limit = 10) {
  const product = await Product.findById(productId);
  
  return await Product.aggregate([
    {
      $vectorSearch: {
        index: "product_embeddings",
        path: "embeddings.textEmbedding",
        queryVector: product.embeddings.textEmbedding,
        numCandidates: 100,
        limit: limit
      }
    },
    {
      $project: {
        name: 1,
        price: 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ]);
}
```

### Real-Time Recommendation Generation

```javascript
// Recommendation cache/results
{
  _id: ObjectId(),
  userId: ObjectId("userId"),
  recommendationType: "homepage",  // homepage, cart, product_detail
  
  recommendations: [
    {
      productId: ObjectId("productId"),
      score: 0.95,
      reasons: ["frequently_bought_together", "similar_users_purchased"],
      position: 1
    }
  ],
  
  metadata: {
    generatedAt: ISODate("2024-01-15T10:00:00Z"),
    expiresAt: ISODate("2024-01-15T11:00:00Z"),
    algorithm: "hybrid_cf_content",
    performance: {
      clickThrough: 0.15,
      conversion: 0.05
    }
  }
}
```

### Recommendation Algorithm Patterns

```javascript
// Hybrid recommendation system
class RecommendationEngine {
  async getRecommendations(userId, context) {
    const user = await User.findById(userId);
    
    // 1. Collaborative filtering
    const cfRecommendations = await this.collaborativeFiltering(user);
    
    // 2. Content-based filtering
    const cbRecommendations = await this.contentBasedFiltering(user);
    
    // 3. Trending products
    const trending = await this.getTrendingProducts(context);
    
    // 4. Personalized search using vectors
    const vectorRecommendations = await this.vectorSearch(user.preferences);
    
    // 5. Combine and rank
    return this.hybridRanking({
      collaborative: { items: cfRecommendations, weight: 0.4 },
      contentBased: { items: cbRecommendations, weight: 0.3 },
      trending: { items: trending, weight: 0.2 },
      vector: { items: vectorRecommendations, weight: 0.1 }
    });
  }
}
```

**Implementation Notes:**
- Pre-compute recommendations during off-peak hours
- Use Change Streams to update recommendations in real-time
- Implement A/B testing for algorithm optimization
- Cache recommendations with appropriate TTL

---

## 9. Review and Rating Systems

### Review Document Structure

```javascript
// Reviews collection
{
  _id: ObjectId("reviewId"),
  productId: ObjectId("productId"),
  userId: ObjectId("userId"),
  orderId: ObjectId("orderId"),  // Verified purchase
  
  // Rating details
  rating: {
    overall: 4.5,
    aspects: {
      quality: 5,
      value: 4,
      shipping: 4,
      customerService: 5
    }
  },
  
  // Review content
  title: "Great product!",
  content: "Detailed review text...",
  pros: ["Good quality", "Fast shipping"],
  cons: ["Slightly expensive"],
  
  // Media
  images: [
    {
      url: "review-image1.jpg",
      caption: "Product in use"
    }
  ],
  
  // Verification and moderation
  verified: true,
  status: "approved",  // pending, approved, rejected
  moderationNotes: "Passed automated checks",
  
  // Engagement metrics
  helpful: {
    yes: 45,
    no: 5,
    voters: [ObjectId("userId1"), ObjectId("userId2")]
  },
  
  // Response from seller
  sellerResponse: {
    content: "Thank you for your feedback!",
    respondedAt: ISODate("2024-01-16"),
    respondedBy: ObjectId("sellerId")
  },
  
  // Timestamps
  createdAt: ISODate("2024-01-15"),
  updatedAt: ISODate("2024-01-15")
}
```

### Aggregated Ratings on Products

```javascript
// Product document with embedded rating summary
{
  _id: ObjectId("productId"),
  name: "Product Name",
  
  // Aggregated ratings (denormalized for performance)
  ratings: {
    average: 4.3,
    count: 1523,
    distribution: {
      5: 834,   // 5-star count
      4: 423,   // 4-star count
      3: 156,   // 3-star count
      2: 78,    // 2-star count
      1: 32     // 1-star count
    },
    
    // Aspect-based ratings
    aspects: {
      quality: { avg: 4.5, count: 1200 },
      value: { avg: 4.1, count: 1100 },
      shipping: { avg: 4.4, count: 1300 }
    },
    
    // Recent reviews sample (embedded)
    recentReviews: [
      {
        reviewId: ObjectId("reviewId"),
        userId: ObjectId("userId"),
        rating: 5,
        title: "Excellent!",
        excerpt: "First 100 chars...",
        createdAt: ISODate("2024-01-15")
      }
      // Keep last 5-10 reviews
    ],
    
    // For weighted average calculation
    weightedScore: 4.25,  // Considering recency, verified purchases, etc.
    lastCalculated: ISODate("2024-01-15T12:00:00Z")
  }
}
```

### Review Aggregation Pipeline

```javascript
// Calculate product ratings
async function updateProductRatings(productId) {
  const pipeline = [
    // Match approved reviews for product
    {
      $match: {
        productId: productId,
        status: "approved"
      }
    },
    
    // Calculate aggregations
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating.overall" },
        totalCount: { $sum: 1 },
        distribution: {
          $push: "$rating.overall"
        },
        aspectQuality: { $avg: "$rating.aspects.quality" },
        aspectValue: { $avg: "$rating.aspects.value" },
        verifiedCount: {
          $sum: { $cond: ["$verified", 1, 0] }
        }
      }
    },
    
    // Calculate distribution
    {
      $project: {
        average: { $round: ["$averageRating", 1] },
        count: "$totalCount",
        distribution: {
          5: {
            $size: {
              $filter: {
                input: "$distribution",
                cond: { $eq: ["$$this", 5] }
              }
            }
          },
          // Repeat for 4, 3, 2, 1
        },
        verifiedPercentage: {
          $multiply: [
            { $divide: ["$verifiedCount", "$totalCount"] },
            100
          ]
        }
      }
    }
  ];
  
  const [result] = await Review.aggregate(pipeline);
  
  // Update product with calculated ratings
  await Product.findByIdAndUpdate(productId, {
    ratings: result,
    "ratings.lastCalculated": new Date()
  });
}
```

### Review Moderation System

```javascript
// Moderation queue document
{
  _id: ObjectId(),
  reviewId: ObjectId("reviewId"),
  priority: "high",  // Based on product importance, user history
  
  // Automated checks
  automatedChecks: {
    profanity: { passed: false, score: 0.8 },
    spam: { passed: true, score: 0.1 },
    sentiment: { score: -0.6, label: "negative" },
    authenticity: { score: 0.9 }
  },
  
  // Manual moderation
  assignedTo: ObjectId("moderatorId"),
  status: "pending",
  decision: null,
  notes: "",
  
  timestamps: {
    queued: ISODate("2024-01-15T10:00:00Z"),
    assigned: ISODate("2024-01-15T10:05:00Z"),
    completed: null
  }
}
```

**Implementation Notes:**
- Use weighted averages for more accurate ratings
- Implement caching for rating calculations
- Consider separate collection for high-volume reviews
- Use text analysis for review insights

---

## 10. Abandoned Cart Recovery Patterns

### Cart Tracking and Expiration

```javascript
// Enhanced cart with abandonment tracking
{
  _id: "cart_session_id",
  userId: ObjectId("userId"),  // null for guest
  email: "customer@example.com",  // For guest checkout
  
  // Cart status tracking
  status: "active",  // active, abandoned, recovered, converted
  
  // Items with reservation
  items: [
    {
      productId: ObjectId("productId"),
      quantity: 2,
      price: 49.99,
      addedAt: ISODate("2024-01-15T09:00:00Z"),
      reservationId: ObjectId("reservationId"),
      reservationExpiry: ISODate("2024-01-15T09:30:00Z")
    }
  ],
  
  // Abandonment tracking
  abandonment: {
    detectedAt: ISODate("2024-01-15T09:15:00Z"),
    emailsSent: [
      {
        type: "reminder_1h",
        sentAt: ISODate("2024-01-15T10:15:00Z"),
        opened: true,
        clicked: false
      }
    ],
    recoveryAttempts: 1,
    recoveryValue: 0  // Will be set if recovered
  },
  
  // User behavior
  behavior: {
    viewCount: 5,
    lastViewedAt: ISODate("2024-01-15T09:10:00Z"),
    timeSpentSeconds: 300,
    device: "mobile",
    source: "email_campaign",
    exitPage: "/checkout/shipping"
  },
  
  // Timestamps
  createdAt: ISODate("2024-01-15T09:00:00Z"),
  updatedAt: ISODate("2024-01-15T09:10:00Z"),
  expiresAt: ISODate("2024-01-15T09:30:00Z")
}
```

### Cart Recovery Workflow

```javascript
// Abandonment detection job
async function detectAbandonedCarts() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
  const abandonedCarts = await Cart.updateMany(
    {
      status: "active",
      updatedAt: { $lt: thirtyMinutesAgo },
      "items.0": { $exists: true }  // Has items
    },
    {
      $set: {
        status: "abandoned",
        "abandonment.detectedAt": new Date()
      }
    }
  );
  
  // Trigger recovery workflow
  const carts = await Cart.find({
    status: "abandoned",
    "abandonment.emailsSent": { $size: 0 }
  });
  
  for (const cart of carts) {
    await triggerRecoveryEmail(cart);
  }
}

// Recovery email scheduler
async function scheduleRecoveryEmails(cartId) {
  const delays = [
    { hours: 1, template: "cart_reminder_1h", discount: 0 },
    { hours: 24, template: "cart_reminder_24h", discount: 10 },
    { hours: 72, template: "cart_reminder_72h", discount: 15 }
  ];
  
  for (const delay of delays) {
    await EmailQueue.create({
      cartId: cartId,
      template: delay.template,
      sendAt: new Date(Date.now() + delay.hours * 60 * 60 * 1000),
      data: {
        discountPercent: delay.discount,
        expiresIn: 48  // hours
      }
    });
  }
}
```

### Inventory Release Pattern

```javascript
// Background job to release expired reservations
async function releaseExpiredReservations() {
  const now = new Date();
  
  // Find expired reservations
  const expiredReservations = await Product.aggregate([
    { $unwind: "$reservations" },
    {
      $match: {
        "reservations.expiresAt": { $lt: now }
      }
    },
    {
      $project: {
        productId: "$_id",
        reservation: "$reservations"
      }
    }
  ]);
  
  // Bulk update to release inventory
  const bulkOps = expiredReservations.map(({ productId, reservation }) => ({
    updateOne: {
      filter: {
        _id: productId,
        "reservations._id": reservation._id
      },
      update: {
        $pull: { reservations: { _id: reservation._id } },
        $inc: {
          "inventory.available": reservation.quantity,
          "inventory.reserved": -reservation.quantity
        }
      }
    }
  }));
  
  await Product.bulkWrite(bulkOps);
  
  // Update cart status
  await Cart.updateMany(
    {
      "items.reservationId": {
        $in: expiredReservations.map(r => r.reservation._id)
      }
    },
    { $set: { status: "expired" } }
  );
}
```

### Recovery Analytics

```javascript
// Cart recovery metrics
{
  _id: ObjectId(),
  date: ISODate("2024-01-15"),
  metrics: {
    totalAbandoned: 150,
    totalRecovered: 45,
    recoveryRate: 30.0,
    
    // By recovery method
    byMethod: {
      email_1h: { sent: 150, recovered: 20, revenue: 4500.00 },
      email_24h: { sent: 130, recovered: 15, revenue: 3200.00 },
      email_72h: { sent: 115, recovered: 10, revenue: 2100.00 }
    },
    
    // By exit point
    byExitPoint: {
      "/cart": 45,
      "/checkout/shipping": 60,
      "/checkout/payment": 45
    },
    
    // Revenue impact
    revenue: {
      abandoned: 35000.00,
      recovered: 9800.00,
      recoveryValue: 28.0  // percentage
    }
  }
}
```

### Personalized Recovery Strategies

```javascript
// Customer segment-based recovery
{
  _id: ObjectId(),
  segmentId: "high_value_customer",
  
  recoveryStrategy: {
    // Timing
    delays: [
      { hours: 0.5, action: "in_app_notification" },
      { hours: 2, action: "email_personalized" },
      { hours: 48, action: "sms_with_discount" }
    ],
    
    // Incentives
    incentives: {
      firstReminder: { type: "free_shipping" },
      secondReminder: { type: "percentage", value: 10 },
      finalReminder: { type: "percentage", value: 20 }
    },
    
    // Content personalization
    messaging: {
      urgency: "low",  // Don't pressure high-value customers
      personalization: "high",
      includeRecommendations: true
    }
  }
}
```

**Implementation Notes:**
- Use TTL indexes for automatic cart cleanup
- Implement rate limiting for recovery emails
- Track recovery attribution accurately
- Consider SMS and push notifications for recovery
- A/B test recovery strategies by segment

---

## Best Practices Summary

### General MongoDB E-commerce Guidelines

1. **Schema Design**
   - Design for your queries, not for data normalization
   - Use embedding for data accessed together
   - Use references for frequently updated data
   - Consider document size limits (16MB)

2. **Performance Optimization**
   - Create compound indexes for common query patterns
   - Use projection to return only needed fields
   - Implement caching for frequently accessed data
   - Use aggregation pipelines efficiently

3. **Scalability**
   - Plan sharding strategy early (by tenantId, productId, etc.)
   - Use read replicas for analytics queries
   - Implement proper connection pooling
   - Monitor and optimize slow queries

4. **Data Consistency**
   - Use transactions for critical operations
   - Implement idempotent operations
   - Use optimistic locking where appropriate
   - Design for eventual consistency where possible

5. **Security**
   - Implement field-level encryption for sensitive data
   - Use role-based access control (RBAC)
   - Audit sensitive operations
   - Validate data at multiple levels

## Conclusion

These patterns represent current best practices for building scalable, performant e-commerce applications with MongoDB in 2024. The key is choosing the right pattern for your specific use case and requirements, considering factors like:

- Scale requirements
- Performance needs
- Consistency requirements
- Development complexity
- Operational overhead

Remember that these patterns can be combined and adapted based on your specific needs. Start simple and evolve your schema as your application grows.