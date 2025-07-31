# BigCommerce Schema Analysis for MongoDB Design

## Executive Summary

This document analyzes BigCommerce's API and data models to extract insights applicable to MongoDB schema design. BigCommerce has evolved from a monolithic platform to support multi-channel, multi-storefront, and headless commerce patterns through comprehensive APIs and flexible data models.

## 1. Order and Cart Structures

### Cart Data Model
BigCommerce implements a sophisticated cart structure that separates concerns and supports multiple types of items:

```javascript
{
  // Core Identifiers
  "id": "cart-unique-id",
  "customer_id": 0, // 0 for guest checkout
  "channel_id": 1,
  "email": "customer@example.com",
  
  // Currency & Pricing
  "currency": {
    "code": "USD",
    "name": "US Dollar",
    "symbol": "$"
  },
  "tax_included": false,
  "base_amount": 100.00,
  "discount_amount": 10.00,
  "cart_amount": 90.00,
  
  // Applied Promotions
  "coupons": [],
  
  // Line Items (Polymorphic)
  "line_items": {
    "physical_items": [{
      "id": "line-item-id",
      "variant_id": 123,
      "product_id": 456,
      "sku": "PROD-SKU",
      "name": "Product Name",
      "quantity": 2,
      "list_price": 50.00,
      "sale_price": 45.00,
      "extended_sale_price": 90.00
    }],
    "digital_items": [],
    "gift_certificates": [],
    "custom_items": []
  }
}
```

**MongoDB Design Insights:**
- Use embedded documents for line items to maintain atomicity
- Implement polymorphic patterns for different item types
- Consider separate collections for active carts vs. abandoned carts
- Index on customer_id, channel_id, and creation timestamp

### Order Data Model
Orders extend the cart model with fulfillment and payment information:

```javascript
{
  // Extends cart structure
  "order_id": "order-unique-id",
  "status": "pending",
  "payment_status": "captured",
  
  // Multi-currency support
  "currency_id": 1,
  "currency_code": "USD",
  "currency_exchange_rate": 1.0,
  "store_default_currency_code": "USD",
  
  // Addresses (embedded)
  "billing_address": {},
  "shipping_addresses": [{}],
  
  // Metadata
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

## 2. Product Catalog Modeling

### Product Structure with Variants
BigCommerce treats every purchasable entity as a variant, simplifying inventory tracking:

```javascript
{
  "id": 123,
  "name": "Product Name",
  "type": "physical",
  "sku": "BASE-SKU",
  
  // Variant Options (generate variants)
  "options": [{
    "id": 1,
    "name": "Color",
    "type": "swatch",
    "values": ["Red", "Blue"]
  }],
  
  // Modifiers (don't generate variants)
  "modifiers": [{
    "id": 2,
    "name": "Gift Wrapping",
    "type": "checkbox",
    "required": false
  }],
  
  // Generated Variants
  "variants": [{
    "id": 456,
    "sku": "PROD-RED",
    "price": 29.99,
    "option_values": [{
      "option_id": 1,
      "value": "Red"
    }]
  }]
}
```

**MongoDB Design Patterns:**
- Consider separate collections for products and variants for query flexibility
- Use compound indexes on product_id + variant options
- Implement materialized paths for category hierarchies
- Cache frequently accessed variant combinations

### Pricing Architecture
BigCommerce supports complex pricing through Price Lists:

```javascript
{
  "price_list_id": 1,
  "name": "VIP Customers",
  "active": true,
  "price_records": [{
    "variant_id": 360,
    "price": 27.57,
    "sale_price": 12.00,
    "currency": "USD"
  }]
}
```

## 3. Customer Segments and Groups

### Customer Segmentation Model
BigCommerce implements flexible customer segmentation for B2B and B2C:

```javascript
{
  "segment_id": "vip-segment",
  "name": "VIP Customers",
  "description": "High-value customers",
  "type": "manual", // or "automatic"
  "conditions": [], // For automatic segments
  "customer_ids": [] // For manual segments
}
```

### B2B Customer Groups
```javascript
{
  "group_id": 1,
  "name": "Company ABC",
  "parent_company": true,
  "pricing_level": "wholesale",
  "members": [{
    "customer_id": 123,
    "role": "purchaser",
    "permissions": ["place_order", "view_pricing"]
  }]
}
```

**MongoDB Considerations:**
- Use reference pattern for customer-segment relationships
- Implement role-based access control at the document level
- Consider separate collections for B2B vs B2C customers
- Index on company associations for B2B queries

## 4. Pricing and Currency Handling

### Multi-Currency Architecture
```javascript
{
  "currency": {
    "code": "EUR",
    "name": "Euro",
    "symbol": "€",
    "is_transactional": true, // Can complete purchases
    "exchange_rate": 0.85,
    "countries": ["DE", "FR", "IT"]
  }
}
```

**Design Patterns:**
- Store prices in base currency with exchange rates
- Cache converted prices for performance
- Implement currency-specific rounding rules
- Consider separate price collections per market

## 5. B2B Commerce Patterns

### Company Account Structure
```javascript
{
  "company_id": "company-123",
  "name": "ABC Corp",
  "credit_limit": 50000,
  "payment_terms": "NET30",
  "users": [{
    "user_id": "user-456",
    "role": "admin",
    "spending_limit": 10000
  }],
  "addresses": [{
    "type": "billing",
    "is_default": true
  }],
  "price_lists": ["wholesale-tier-1"]
}
```

### Quote/Contract Patterns
```javascript
{
  "quote_id": "quote-789",
  "company_id": "company-123",
  "status": "pending",
  "valid_until": "2024-12-31",
  "items": [],
  "negotiated_prices": {},
  "approval_chain": []
}
```

## 6. Multi-Storefront Patterns

### Channel Architecture
```javascript
{
  "channel_id": 1,
  "name": "Main Store",
  "type": "storefront",
  "platform": "bigcommerce",
  "config": {
    "domain": "store.com",
    "default_currency": "USD",
    "supported_currencies": ["USD", "EUR"],
    "locale": "en-US"
  }
}
```

### Product-Channel Assignment
```javascript
{
  "product_id": 123,
  "channel_assignments": [{
    "channel_id": 1,
    "is_visible": true,
    "pricing": "default" // or price_list_id
  }]
}
```

**MongoDB Implementation:**
- Use channel_id as partition key for multi-tenant data
- Implement channel-aware indexes
- Consider separate databases per major channel
- Cache channel-specific data aggressively

## 7. Custom Fields and Metafields

### Metafield Structure
```javascript
{
  "id": "metafield-123",
  "namespace": "product_specs",
  "key": "material_type",
  "value": "100% Cotton",
  "description": "Product material composition",
  "permission_set": "app_only",
  "resource_type": "product",
  "resource_id": 123
}
```

**Design Considerations:**
- Use separate metafields collection for flexibility
- Index on namespace + key + resource_type
- Implement value validation based on field type
- Consider EAV pattern for highly dynamic fields

## 8. Workflow and Automation Patterns

### Event-Driven Architecture
```javascript
{
  "webhook_id": "webhook-123",
  "scope": "store/order/created",
  "destination": "https://app.com/webhooks",
  "headers": {
    "X-Auth-Token": "secret"
  },
  "retry_policy": {
    "max_retries": 5,
    "backoff_type": "exponential"
  }
}
```

### Workflow States
```javascript
{
  "workflow_id": "order-fulfillment",
  "current_state": "picking",
  "transitions": [{
    "from": "picking",
    "to": "packed",
    "conditions": ["all_items_picked"],
    "actions": ["notify_shipping"]
  }]
}
```

## 9. Integration Patterns

### API Gateway Pattern
- Implement rate limiting per API key
- Use circuit breakers for external services
- Cache frequently accessed data
- Implement request coalescing

### Microservices Communication
```javascript
{
  "service": "inventory",
  "events": {
    "inventory.updated": {
      "schema": "v1",
      "routing_key": "inventory.physical.*"
    }
  }
}
```

## 10. Performance Optimization Strategies

### Caching Strategies
1. **Product Catalog**: Cache complete product documents with TTL
2. **Pricing**: Cache calculated prices per customer segment
3. **Inventory**: Use write-through cache with real-time updates
4. **Customer Data**: Cache session data in Redis

### Database Optimization
```javascript
// Compound Indexes
db.products.createIndex({ 
  "channel_id": 1, 
  "status": 1, 
  "updated_at": -1 
})

// Partial Indexes
db.orders.createIndex(
  { "customer_id": 1 },
  { partialFilterExpression: { "status": "active" } }
)

// Text Search Indexes
db.products.createIndex({ 
  "name": "text", 
  "description": "text",
  "sku": "text" 
})
```

### Query Patterns
1. **Pagination**: Use cursor-based pagination for large datasets
2. **Aggregation**: Pre-aggregate common metrics
3. **Denormalization**: Strategic denormalization for read performance
4. **Sharding**: Shard by channel_id or customer segment

## Key Takeaways for MongoDB Design

1. **Flexibility First**: Design schemas that can adapt to changing business requirements
2. **Performance at Scale**: Use appropriate indexes and caching strategies
3. **Multi-Tenancy**: Consider channel/store isolation from the beginning
4. **Event Sourcing**: Implement audit trails and event logs for compliance
5. **Gradual Migration**: Support both old and new data models during transitions
6. **API-First Design**: Structure data to support efficient API access patterns
7. **Extensibility**: Use metafields/custom fields for merchant-specific data
8. **B2B Ready**: Design with complex organizational hierarchies in mind
9. **Global Commerce**: Build in multi-currency and localization support
10. **Real-Time Updates**: Implement change streams and webhooks for reactive systems

## Conclusion

BigCommerce's evolution from monolithic to composable commerce provides valuable lessons for MongoDB schema design. The key is balancing flexibility with performance, supporting both simple and complex use cases, and building with future scalability in mind.