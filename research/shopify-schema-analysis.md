# Shopify Schema Analysis for MongoDB Patterns

## Overview

This document analyzes Shopify's API and data models for e-commerce patterns, with a focus on translating these concepts to MongoDB schema design. The analysis is based on Shopify's 2025 API updates and best practices.

## 1. Order Management Structure

### Shopify Pattern
- **Central Order Object**: Orders serve as the primary hub connecting customer info, products, payments, and fulfillment
- **90-Day API Access**: Default access to recent orders with optional extended historical access
- **Lifecycle Management**: Orders track complete purchase journey from checkout to fulfillment
- **GraphQL-First**: Orders query supports pagination, sorting, and filtering

### MongoDB Translation
```javascript
// Orders Collection
{
  _id: ObjectId(),
  orderNumber: "1001",
  customerId: ObjectId(), // Reference to customers collection
  status: "pending", // pending, processing, shipped, delivered, cancelled
  
  // Financial Details
  currency: "USD",
  subtotal: NumberDecimal("100.00"),
  totalDiscounts: NumberDecimal("10.00"),
  totalTax: NumberDecimal("8.50"),
  totalAmount: NumberDecimal("98.50"),
  
  // Line Items (Embedded)
  lineItems: [{
    productId: ObjectId(),
    variantId: ObjectId(),
    sku: "PROD-001-M",
    title: "Product Name",
    quantity: 2,
    price: NumberDecimal("50.00"),
    discount: NumberDecimal("5.00"),
    tax: NumberDecimal("4.25"),
    total: NumberDecimal("94.25")
  }],
  
  // Shipping Details (Embedded)
  shippingAddress: {
    street1: "123 Main St",
    street2: "Apt 4",
    city: "New York",
    state: "NY",
    postalCode: "10001",
    country: "US"
  },
  
  // Metadata
  createdAt: ISODate("2025-01-15T10:00:00Z"),
  updatedAt: ISODate("2025-01-15T10:00:00Z"),
  
  // Custom Fields (Metafields equivalent)
  customData: {
    giftMessage: "Happy Birthday!",
    internalNotes: "Priority customer"
  }
}
```

### Key Principles
- Embed line items for atomic operations and single-read performance
- Use decimal types for financial calculations
- Include computed totals for query efficiency
- Support custom data through flexible sub-documents

## 2. Product and Variant Modeling

### Shopify Pattern
- **2048 Variant Limit**: Increased from 100 to 2048 variants per product (2025)
- **Separate Objects**: Variants treated as first-class objects
- **Three Options Limit**: Maximum 3 product options (e.g., size, color, material)
- **Bulk Operations**: productSet mutation for efficient bulk updates

### MongoDB Translation
```javascript
// Products Collection
{
  _id: ObjectId(),
  handle: "premium-t-shirt",
  title: "Premium T-Shirt",
  vendor: "Acme Clothing",
  productType: "Apparel",
  status: "active",
  
  // Options Definition
  options: [
    { name: "Size", position: 1, values: ["S", "M", "L", "XL"] },
    { name: "Color", position: 2, values: ["Red", "Blue", "Green"] },
    { name: "Material", position: 3, values: ["Cotton", "Polyester"] }
  ],
  
  // SEO and Marketing
  seo: {
    title: "Premium T-Shirt | Acme Clothing",
    description: "High-quality premium t-shirt...",
    keywords: ["t-shirt", "premium", "clothing"]
  },
  
  // Media
  images: [{
    url: "https://cdn.example.com/image1.jpg",
    altText: "Premium T-Shirt Front View",
    position: 1
  }],
  
  createdAt: ISODate("2025-01-01T00:00:00Z"),
  updatedAt: ISODate("2025-01-15T10:00:00Z")
}

// Product Variants Collection (Separate for 2048+ variant support)
{
  _id: ObjectId(),
  productId: ObjectId(), // Reference to products
  sku: "TSHIRT-M-RED-COTTON",
  title: "Medium / Red / Cotton",
  
  // Option Values
  options: {
    size: "M",
    color: "Red",
    material: "Cotton"
  },
  
  // Pricing
  price: NumberDecimal("29.99"),
  compareAtPrice: NumberDecimal("39.99"),
  
  // Inventory
  inventoryQuantity: 150,
  inventoryPolicy: "continue", // continue, deny
  trackInventory: true,
  
  // Physical Properties
  weight: { value: 200, unit: "g" },
  dimensions: {
    length: { value: 30, unit: "cm" },
    width: { value: 20, unit: "cm" },
    height: { value: 2, unit: "cm" }
  },
  
  // Status
  available: true,
  barcode: "123456789",
  
  createdAt: ISODate("2025-01-01T00:00:00Z")
}
```

### Key Principles
- Separate collections for products and variants to support high variant counts
- Use compound indexes on variant options for efficient filtering
- Store denormalized variant title for display purposes
- Support flexible option structures

## 3. Customer and Address Management

### Shopify Pattern
- **Customer Account API**: GraphQL-only API for customer self-management
- **Secure Authentication**: Robust auth system for customer data access
- **Address Validation**: Built-in validation for addresses
- **Multiple Addresses**: Support for multiple shipping/billing addresses

### MongoDB Translation
```javascript
// Customers Collection
{
  _id: "customer@email.com", // Email as _id for uniqueness
  customerId: ObjectId(), // Internal ID
  
  // Authentication
  hashedPassword: "bcrypt_hash_here",
  passwordUpdatedAt: ISODate("2025-01-01T00:00:00Z"),
  
  // Profile
  profile: {
    firstName: "John",
    lastName: "Doe",
    phone: "+1234567890",
    dateOfBirth: ISODate("1990-01-01T00:00:00Z"),
    acceptsMarketing: true
  },
  
  // Addresses (Embedded for customer convenience)
  addresses: [{
    _id: ObjectId(),
    type: "shipping", // shipping, billing
    isDefault: true,
    
    // Address Fields
    company: "Acme Corp",
    street1: "123 Main St",
    street2: "Suite 100",
    city: "New York",
    state: "NY",
    postalCode: "10001",
    country: "US",
    
    // Contact
    firstName: "John",
    lastName: "Doe",
    phone: "+1234567890",
    
    // Validation
    validated: true,
    validatedAt: ISODate("2025-01-10T00:00:00Z")
  }],
  
  // Customer Groups/Tags
  tags: ["vip", "wholesale"],
  
  // Analytics
  stats: {
    totalOrders: 45,
    totalSpent: NumberDecimal("5420.50"),
    averageOrderValue: NumberDecimal("120.46"),
    lastOrderDate: ISODate("2025-01-10T00:00:00Z")
  },
  
  // Metadata
  createdAt: ISODate("2024-01-01T00:00:00Z"),
  updatedAt: ISODate("2025-01-15T00:00:00Z"),
  
  // Custom Fields
  metafields: {
    loyaltyTier: "gold",
    preferredDelivery: "express"
  }
}
```

### Key Principles
- Use email as unique identifier for customer lookup
- Embed addresses for single-read customer profiles
- Include computed statistics for quick access
- Support flexible metadata through metafields

## 4. Inventory Tracking Patterns

### Shopify Pattern
- **Multi-Location Support**: Track inventory across multiple locations
- **Advanced States**: Available, reserved, incoming, damaged inventory states
- **Real-Time Updates**: Critical for preventing overselling
- **90-Day History**: Limited historical data access

### MongoDB Translation
```javascript
// Inventory Items Collection
{
  _id: ObjectId(),
  sku: "TSHIRT-M-RED-COTTON",
  variantId: ObjectId(), // Reference to variant
  
  // Tracking Configuration
  trackQuantity: true,
  requiresShipping: true,
  
  // Cost Information
  cost: NumberDecimal("15.00"),
  countryCodeOfOrigin: "CN",
  
  createdAt: ISODate("2025-01-01T00:00:00Z")
}

// Inventory Levels Collection (Per Location)
{
  _id: ObjectId(),
  inventoryItemId: ObjectId(),
  locationId: ObjectId(),
  
  // Quantities by State
  quantities: {
    available: 150,
    reserved: 10,
    incoming: 50,
    damaged: 2,
    quality_control: 5
  },
  
  // Computed Total
  totalQuantity: 217,
  
  // Last Activity
  lastMovement: {
    type: "adjustment", // sale, return, adjustment, transfer
    quantity: -5,
    reason: "damaged_in_transit",
    timestamp: ISODate("2025-01-15T09:00:00Z"),
    userId: ObjectId()
  },
  
  updatedAt: ISODate("2025-01-15T09:00:00Z")
}

// Inventory History Collection (For Audit Trail)
{
  _id: ObjectId(),
  inventoryItemId: ObjectId(),
  locationId: ObjectId(),
  
  movement: {
    type: "sale",
    orderId: ObjectId(),
    quantity: -2,
    fromState: "available",
    toState: "sold",
    
    // Snapshot After Movement
    snapshot: {
      available: 148,
      reserved: 10,
      total: 158
    }
  },
  
  createdAt: ISODate("2025-01-15T08:30:00Z"),
  createdBy: ObjectId() // User or system
}
```

### Key Principles
- Separate levels by location for scalability
- Track multiple inventory states
- Maintain history for audit and analytics
- Use atomic operations for quantity updates

## 5. Discount and Pricing Structures

### Shopify Pattern
- **Function API**: Unified schema for discount functions
- **Three Discount Classes**: Product, order, and shipping discounts
- **25 Function Limit**: Maximum concurrent discount functions
- **Combination Rules**: Complex stacking and exclusion logic

### MongoDB Translation
```javascript
// Discounts Collection
{
  _id: ObjectId(),
  code: "SUMMER2025", // null for automatic discounts
  title: "Summer Sale 2025",
  status: "active",
  
  // Discount Type and Value
  discountType: "percentage", // percentage, fixed_amount, bogo, shipping
  value: 20, // 20% off
  
  // Application Rules
  appliesTo: {
    type: "specific_products", // all, specific_products, specific_collections
    productIds: [ObjectId(), ObjectId()],
    collectionIds: []
  },
  
  // Minimum Requirements
  minimumRequirements: {
    type: "subtotal", // subtotal, quantity, none
    subtotal: NumberDecimal("50.00"),
    quantity: null
  },
  
  // Customer Eligibility
  customerEligibility: {
    type: "all", // all, specific_customers, customer_groups
    customerIds: [],
    customerGroups: []
  },
  
  // Usage Limits
  usageLimits: {
    totalUses: 1000,
    perCustomer: 1,
    currentUses: 245
  },
  
  // Combination Rules
  combinesWith: {
    orderDiscounts: false,
    productDiscounts: true,
    shippingDiscounts: false
  },
  
  // Date Range
  startsAt: ISODate("2025-06-01T00:00:00Z"),
  endsAt: ISODate("2025-08-31T23:59:59Z"),
  
  createdAt: ISODate("2025-01-01T00:00:00Z")
}

// Price Rules Collection (Dynamic Pricing)
{
  _id: ObjectId(),
  title: "VIP Customer Pricing",
  priority: 1, // Lower number = higher priority
  
  // Conditions
  conditions: [{
    type: "customer_tag",
    operator: "contains",
    value: "vip"
  }],
  
  // Actions
  actions: [{
    type: "percentage_discount",
    target: "line_item",
    value: 15,
    allocation: "across" // across, each
  }],
  
  // Validity
  active: true,
  startsAt: ISODate("2025-01-01T00:00:00Z"),
  endsAt: null // No end date
}
```

### Key Principles
- Support multiple discount types and calculations
- Implement combination logic for stacking
- Track usage for limit enforcement
- Use priority system for rule conflicts

## 6. Fulfillment and Shipping Patterns

### Shopify Pattern
- **Fulfillment Orders API**: Separate API for fulfillment workflow
- **Multi-Location Fulfillment**: Route orders to optimal locations
- **Multiple Tracking Numbers**: Support split shipments
- **Automated Workflows**: Integration with 3PL and carriers

### MongoDB Translation
```javascript
// Fulfillment Orders Collection
{
  _id: ObjectId(),
  orderId: ObjectId(),
  status: "open", // open, in_progress, fulfilled, cancelled
  
  // Location Assignment
  assignedLocationId: ObjectId(),
  
  // Line Items to Fulfill
  lineItems: [{
    orderLineItemId: ObjectId(),
    quantity: 2,
    fulfillableQuantity: 2,
    fulfilledQuantity: 0
  }],
  
  // Shipping Details
  shippingMethod: {
    code: "express",
    title: "Express Shipping",
    carrier: "FedEx",
    estimatedDays: 2
  },
  
  // Destination
  destination: {
    // Copy of shipping address
  },
  
  createdAt: ISODate("2025-01-15T10:00:00Z"),
  requestedFulfillmentAt: ISODate("2025-01-16T00:00:00Z")
}

// Fulfillments Collection
{
  _id: ObjectId(),
  fulfillmentOrderId: ObjectId(),
  orderId: ObjectId(),
  status: "success", // pending, success, cancelled, error
  
  // Tracking Information
  tracking: [{
    number: "1234567890",
    url: "https://tracking.fedex.com/1234567890",
    company: "FedEx",
    
    // Tracking Events
    events: [{
      status: "in_transit",
      message: "Package in transit",
      location: "Memphis, TN",
      timestamp: ISODate("2025-01-16T14:00:00Z")
    }]
  }],
  
  // Fulfilled Items
  lineItems: [{
    fulfillmentOrderLineItemId: ObjectId(),
    quantity: 2
  }],
  
  // Service Details
  service: {
    provider: "fedex",
    type: "express",
    estimatedDelivery: ISODate("2025-01-18T00:00:00Z")
  },
  
  // Timestamps
  createdAt: ISODate("2025-01-16T10:00:00Z"),
  shippedAt: ISODate("2025-01-16T12:00:00Z"),
  deliveredAt: null
}
```

### Key Principles
- Separate fulfillment orders from order fulfillments
- Support multiple tracking numbers per fulfillment
- Track fulfillment events for visibility
- Enable location-based routing logic

## 7. Multi-Channel Commerce Patterns

### Shopify Pattern
- **Unified Commerce OS**: Single customer ID across all channels
- **Channel Attribution**: Track sales source and attribution
- **Real-Time Sync**: Consistent data across channels
- **Centralized Inventory**: Single inventory pool for all channels

### MongoDB Translation
```javascript
// Sales Channels Collection
{
  _id: ObjectId(),
  name: "Online Store",
  type: "online_store", // online_store, pos, marketplace, social
  status: "active",
  
  // Channel Configuration
  config: {
    domain: "shop.example.com",
    currency: "USD",
    taxIncluded: false
  },
  
  // API Credentials (Encrypted)
  credentials: {
    apiKey: "encrypted_key",
    secretKey: "encrypted_secret"
  }
}

// Channel Orders Collection (Extended Order)
{
  _id: ObjectId(),
  orderId: ObjectId(), // Reference to main order
  channelId: ObjectId(),
  
  // Channel-Specific Data
  channelOrderId: "AMZ-123456", // External order ID
  channelStatus: "shipped",
  
  // Channel Fees
  channelFees: {
    commission: NumberDecimal("15.00"),
    fulfillment: NumberDecimal("5.00"),
    other: NumberDecimal("2.50")
  },
  
  // Attribution
  attribution: {
    source: "amazon",
    campaign: "prime_day_2025",
    clickId: "xyz123"
  },
  
  // Sync Status
  lastSyncedAt: ISODate("2025-01-15T10:00:00Z"),
  syncErrors: []
}

// Unified Customer Profile
{
  _id: ObjectId(),
  customerId: ObjectId(),
  
  // Channel Profiles
  channels: [{
    channelId: ObjectId(),
    externalId: "AMZ-CUST-123",
    username: "johndoe123",
    createdAt: ISODate("2024-01-01T00:00:00Z"),
    
    // Channel-Specific Data
    metadata: {
      primeStatus: true,
      sellerRating: 4.8
    }
  }],
  
  // Unified Analytics
  analytics: {
    totalChannels: 3,
    preferredChannel: ObjectId(), // Most used channel
    crossChannelOrders: 15,
    
    // Channel Breakdown
    channelStats: [{
      channelId: ObjectId(),
      orders: 45,
      revenue: NumberDecimal("5420.50"),
      lastOrderDate: ISODate("2025-01-10T00:00:00Z")
    }]
  }
}
```

### Key Principles
- Maintain unified customer view across channels
- Track channel-specific fees and attribution
- Support external ID mapping
- Enable cross-channel analytics

## 8. Tax Calculation Patterns

### Shopify Pattern
- **Shopify Tax**: Automated tax calculation service
- **Location-Based**: Calculate based on customer location
- **Tax Exemptions**: Support for VAT exemptions and special cases
- **Inclusive/Exclusive**: Flexible tax display options

### MongoDB Translation
```javascript
// Tax Configuration Collection
{
  _id: ObjectId(),
  region: "US", // Country or region code
  
  // Tax Rules
  rules: [{
    type: "sales_tax",
    name: "NY State Tax",
    
    // Conditions
    conditions: {
      state: "NY",
      productTypes: ["all"] // or specific types
    },
    
    // Rate
    rate: 0.08, // 8%
    
    // Exemptions
    exemptions: [{
      type: "product_type",
      value: "food_grocery",
      rate: 0 // Tax exempt
    }]
  }],
  
  // Display Settings
  display: {
    includeInPrice: false,
    showBreakdown: true
  },
  
  updatedAt: ISODate("2025-01-01T00:00:00Z")
}

// Tax Calculations (Embedded in Orders)
{
  // Within Order document
  taxCalculations: [{
    taxRuleId: ObjectId(),
    name: "NY State Tax",
    rate: 0.08,
    
    // Line Item Taxes
    lineItems: [{
      lineItemId: ObjectId(),
      taxableAmount: NumberDecimal("50.00"),
      taxAmount: NumberDecimal("4.00")
    }],
    
    // Shipping Tax
    shipping: {
      taxableAmount: NumberDecimal("10.00"),
      taxAmount: NumberDecimal("0.80")
    },
    
    // Total
    totalTax: NumberDecimal("4.80")
  }],
  
  // Summary
  taxSummary: {
    subtotal: NumberDecimal("60.00"),
    totalTax: NumberDecimal("4.80"),
    total: NumberDecimal("64.80"),
    
    // By Jurisdiction
    byJurisdiction: [{
      name: "NY State Tax",
      amount: NumberDecimal("4.80")
    }]
  }
}

// Customer Tax Exemptions
{
  _id: ObjectId(),
  customerId: ObjectId(),
  
  exemptions: [{
    type: "vat_exempt",
    number: "EU123456789",
    jurisdiction: "EU",
    validFrom: ISODate("2025-01-01T00:00:00Z"),
    validTo: ISODate("2025-12-31T23:59:59Z"),
    verified: true
  }]
}
```

### Key Principles
- Support complex tax rules and exemptions
- Calculate taxes at line item level
- Track tax by jurisdiction
- Handle customer-specific exemptions

## 9. Analytics and Reporting Structures

### Shopify Pattern
- **Real-Time Analytics**: Up-to-the-minute data updates
- **ShopifyQL**: Commerce-specific query language
- **Multi-Channel Attribution**: Unified view across channels
- **AI-Powered Insights**: Predictive analytics and recommendations

### MongoDB Translation
```javascript
// Analytics Events Collection (Time-Series)
{
  _id: ObjectId(),
  timestamp: ISODate("2025-01-15T10:30:00Z"),
  eventType: "pageview", // pageview, add_to_cart, checkout, purchase
  
  // Session Info
  session: {
    id: "session123",
    source: "google",
    medium: "cpc",
    campaign: "summer_sale"
  },
  
  // Customer Info
  customer: {
    id: ObjectId(),
    isReturning: true,
    lifetimeValue: NumberDecimal("1250.00")
  },
  
  // Event Data
  data: {
    page: "/products/premium-tshirt",
    productId: ObjectId(),
    variantId: ObjectId(),
    quantity: 1,
    value: NumberDecimal("29.99")
  },
  
  // Device Info
  device: {
    type: "mobile",
    os: "iOS",
    browser: "Safari"
  }
}

// Aggregated Metrics Collection
{
  _id: {
    date: ISODate("2025-01-15T00:00:00Z"),
    granularity: "hour", // hour, day, week, month
    hour: 10
  },
  
  // Traffic Metrics
  traffic: {
    sessions: 1250,
    users: 980,
    pageviews: 3500,
    bounceRate: 0.35
  },
  
  // Conversion Metrics
  conversions: {
    addToCart: 250,
    checkoutStarted: 180,
    purchased: 150,
    conversionRate: 0.12, // 12%
    cartAbandonment: 0.17 // 17%
  },
  
  // Revenue Metrics
  revenue: {
    gross: NumberDecimal("15420.50"),
    net: NumberDecimal("13878.45"),
    tax: NumberDecimal("1542.05"),
    shipping: NumberDecimal("890.00"),
    discounts: NumberDecimal("1500.00")
  },
  
  // Product Performance
  topProducts: [{
    productId: ObjectId(),
    title: "Premium T-Shirt",
    units: 45,
    revenue: NumberDecimal("1349.55")
  }],
  
  // Channel Attribution
  channels: [{
    name: "Google Ads",
    revenue: NumberDecimal("8500.00"),
    orders: 85,
    roas: 3.5 // Return on ad spend
  }]
}

// Customer Segments Collection
{
  _id: ObjectId(),
  name: "High Value Customers",
  
  // Segment Definition
  criteria: [{
    field: "lifetimeValue",
    operator: "gte",
    value: NumberDecimal("1000.00")
  }, {
    field: "orderCount",
    operator: "gte",
    value: 5
  }],
  
  // Segment Stats
  stats: {
    customerCount: 1250,
    avgLifetimeValue: NumberDecimal("2450.00"),
    avgOrderValue: NumberDecimal("125.00"),
    churnRate: 0.05
  },
  
  // Predictive Insights
  predictions: {
    nextMonthRevenue: NumberDecimal("125000.00"),
    churnRisk: [{
      customerId: ObjectId(),
      probability: 0.75,
      reasons: ["no_recent_orders", "declined_engagement"]
    }]
  },
  
  updatedAt: ISODate("2025-01-15T00:00:00Z")
}
```

### Key Principles
- Use time-series collections for event data
- Pre-aggregate metrics for performance
- Support flexible segmentation
- Enable predictive analytics

## 10. App Extensibility Patterns

### Shopify Pattern
- **Metafields**: Flexible custom fields for any resource
- **Metaobjects**: Custom data structures beyond standard resources
- **App-Owned Namespaces**: Secure data isolation for apps
- **GraphQL Extensions**: Unified API for custom data

### MongoDB Translation
```javascript
// Metafield Definitions Collection
{
  _id: ObjectId(),
  namespace: "custom_fields",
  key: "warranty_info",
  
  // Definition
  definition: {
    name: "Warranty Information",
    description: "Product warranty details",
    type: "json", // string, integer, json, boolean, date
    
    // Validation Rules
    validations: [{
      type: "json_schema",
      schema: {
        type: "object",
        required: ["duration", "type"],
        properties: {
          duration: { type: "number" },
          type: { enum: ["limited", "lifetime", "extended"] }
        }
      }
    }],
    
    // Capabilities
    capabilities: {
      unique: false,
      searchable: true,
      sortable: false
    }
  },
  
  // Access Control
  access: {
    admin: "read_write",
    storefront: "read",
    apps: ["app_123"] // Specific app access
  },
  
  // Resource Types
  resourceTypes: ["product", "variant"],
  
  createdAt: ISODate("2025-01-01T00:00:00Z")
}

// Metaobject Definitions Collection
{
  _id: ObjectId(),
  type: "product_bundle",
  name: "Product Bundle",
  
  // Field Definitions
  fields: [{
    key: "title",
    type: "string",
    required: true,
    validations: [{ type: "min_length", value: 3 }]
  }, {
    key: "products",
    type: "reference",
    referenceType: "product",
    list: true,
    validations: [{ type: "min_items", value: 2 }]
  }, {
    key: "discount",
    type: "decimal",
    validations: [{ type: "min", value: 0 }, { type: "max", value: 100 }]
  }],
  
  // Display Configuration
  display: {
    adminField: "title",
    sortField: "createdAt"
  },
  
  // Capabilities
  capabilities: {
    publishable: true,
    translatable: true
  }
}

// Metaobjects Collection (Instances)
{
  _id: ObjectId(),
  type: "product_bundle",
  handle: "summer-essentials-bundle",
  
  // Field Values
  fields: {
    title: "Summer Essentials Bundle",
    products: [ObjectId(), ObjectId(), ObjectId()], // Product IDs
    discount: NumberDecimal("15.00"),
    description: "Everything you need for summer"
  },
  
  // Publishing Status
  status: "published",
  publishedAt: ISODate("2025-06-01T00:00:00Z"),
  
  // SEO
  seo: {
    title: "Summer Essentials Bundle - 15% Off",
    description: "Get ready for summer with our essential bundle"
  },
  
  // Translations
  translations: {
    "fr": {
      title: "Ensemble Essentiels d'Été",
      description: "Tout ce dont vous avez besoin pour l'été"
    }
  },
  
  createdAt: ISODate("2025-01-01T00:00:00Z"),
  updatedAt: ISODate("2025-01-15T00:00:00Z")
}

// App Data Storage
{
  _id: ObjectId(),
  appId: "app_123",
  namespace: "$app:loyalty",
  
  // Resource Association
  resource: {
    type: "customer",
    id: ObjectId()
  },
  
  // App-Specific Data
  data: {
    points: 1250,
    tier: "gold",
    lastEarned: ISODate("2025-01-10T00:00:00Z"),
    history: [{
      action: "purchase",
      points: 100,
      orderId: ObjectId(),
      timestamp: ISODate("2025-01-10T00:00:00Z")
    }]
  },
  
  // Metadata
  version: 2,
  createdAt: ISODate("2024-01-01T00:00:00Z"),
  updatedAt: ISODate("2025-01-10T00:00:00Z")
}
```

### Key Principles
- Support flexible schema validation
- Enable app-specific data isolation
- Provide reference types for relationships
- Support internationalization

## MongoDB Schema Design Best Practices

### 1. **Embedding vs Referencing**
- **Embed** when data is frequently accessed together (e.g., order line items)
- **Reference** when data is shared across documents (e.g., products in orders)
- **Hybrid** approach for optimal performance (embed critical fields, reference full details)

### 2. **Indexing Strategy**
```javascript
// Compound indexes for common queries
db.orders.createIndex({ customerId: 1, createdAt: -1 })
db.products.createIndex({ status: 1, title: "text" })
db.inventory.createIndex({ sku: 1, locationId: 1 }, { unique: true })

// Partial indexes for efficiency
db.orders.createIndex(
  { status: 1 }, 
  { partialFilterExpression: { status: { $in: ["pending", "processing"] } } }
)
```

### 3. **Data Types**
- Use `NumberDecimal` for all monetary values
- Use `ISODate` for timestamps
- Use `ObjectId` for references
- Consider schema validation for data integrity

### 4. **Aggregation Patterns**
```javascript
// Pre-aggregated daily stats
db.analytics.daily.insertOne({
  _id: { date: ISODate("2025-01-15T00:00:00Z"), channelId: ObjectId() },
  orders: 150,
  revenue: NumberDecimal("15420.50"),
  // ... other metrics
})

// Time-series collections for events
db.createCollection("events", {
  timeseries: {
    timeField: "timestamp",
    metaField: "metadata",
    granularity: "minutes"
  }
})
```

### 5. **Change Streams for Real-Time Updates**
```javascript
// Watch for inventory changes
const pipeline = [
  { $match: { operationType: "update", "fullDocument.quantities.available": { $lt: 10 } } }
];

const changeStream = db.inventory.watch(pipeline);
changeStream.on("change", (change) => {
  // Trigger low stock alert
});
```

## Conclusion

This analysis demonstrates how Shopify's sophisticated e-commerce patterns can be effectively translated to MongoDB. Key takeaways:

1. **Document Design**: Balance between embedding and referencing based on access patterns
2. **Flexibility**: Use schema validation while maintaining flexibility for custom fields
3. **Performance**: Pre-aggregate data and use appropriate indexes
4. **Scalability**: Design for growth with patterns like separate variant collections
5. **Real-Time**: Leverage MongoDB features like change streams for real-time updates

The MongoDB patterns presented here provide a foundation for building scalable, performant e-commerce applications while maintaining the flexibility that modern commerce requires.