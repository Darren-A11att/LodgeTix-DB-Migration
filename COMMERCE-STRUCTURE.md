# Commerce Database Structure

## Overview
The commerce database has been restructured to align with MedusaJS patterns while maintaining compatibility with LodgeTix data.

## Key Changes

### 1. Product Types
- **Removed**: `event_ticket` (now handled as product variants)
- **Available Types**: 
  - `simple` - Single standalone product
  - `variant` - Product with variants
  - `bundle` - Collection of products sold together
  - `multipart` - Product with multiple components
  - `digital` - Digital/downloadable product
  - `service` - Service-based product
  - `subscription` - Recurring subscription product

### 2. Payment Methods
- `card` - Credit/Debit Card
- `eft` - Electronic Funds Transfer
- `cash` - Cash payment
- `check` - Check payment
- `other` - Other payment methods

### 3. Payment Gateway System
Supports multiple gateway accounts with different types:

#### Providers
- Stripe
- Square
- PayPal
- Manual

#### Account Types
- `platform` - Main platform account
- `connect` - Connected account (e.g., Stripe Connect)
- `merchant` - Direct merchant account

#### Current Configuration
- 3 Stripe accounts (1 platform, 2 connect)
- 1 Square account (merchant)

### 4. Product Structure (MedusaJS Pattern)

#### Collections
- Groups of related products
- Maps to LodgeTix `functions`
- Example: "Annual Ball 2024" collection

#### Products
- Main product entities
- Can have multiple variants
- Maps to LodgeTix `events`
- Example: "Annual Ball 2024 Tickets" product

#### Variants
- Product variations with unique SKUs
- Individual inventory tracking
- Maps to LodgeTix `eventTickets`
- Example: "Standard Ticket", "VIP Ticket"

#### Options
- Product customization fields
- Used for attendee details
- Example: "Attendee Name", "Dietary Requirements"

#### Bundles
- Multiple products sold together
- Special pricing available
- Maps to LodgeTix `packages`
- Example: "Couples Package"

### 5. Inventory Management
- **Inventory Items**: Track SKUs and shipping requirements
- **Stock Locations**: Multi-warehouse support
- **Inventory Levels**: Stock quantities per location
- **Reservations**: Hold inventory for orders

## LodgeTix Mapping

| LodgeTix Entity | Commerce Entity | Description |
|-----------------|-----------------|-------------|
| `function` | `product_collection` | Event category/group |
| `event` | `product` | Specific event instance |
| `eventTicket` | `product_variant` | Ticket type/tier |
| `package` | `bundle` product | Multi-ticket packages |
| `registration` | `order` | Purchase record |
| `attendee` | `line_item` + options | Individual attendee details |

## Database Collections

### Core Commerce
- `products` - Product catalog
- `product_collections` - Product groupings
- `product_categories` - Hierarchical categorization
- `product_variants` - Product variations
- `product_tags` - Product tagging

### Payments
- `payment_gateways` - Gateway configurations
- `payment_gateway_accounts` - Multiple accounts per gateway
- `payments` - Payment records
- `payment_sessions` - Payment processing sessions

### Orders & Carts
- `orders` - Completed purchases
- `carts` - Shopping carts
- `line_items` - Order/cart items

### Inventory
- `inventory_items` - SKU tracking
- `inventory_levels` - Stock per location
- `stock_locations` - Warehouse/venue locations
- `reservation_items` - Inventory holds

### Vendors & Customers
- `vendors` - Marketplace vendors
- `vendor_users` - Vendor team members
- `customers` - Customer accounts

### Fulfillment
- `fulfillments` - Shipping/delivery records
- `shipping_methods` - Available shipping options

## Admin Pages

### Available Now
- `/admin/products` - Product management
- `/admin/product-collections` - Collection management
- `/admin/payment-gateways` - Gateway configuration
- `/admin/vendors` - Vendor management
- `/admin/customers` - Customer management
- `/admin/orders` - Order management
- `/admin/payments` - Payment tracking
- `/admin/inventory` - Inventory management
- `/admin/fulfillments` - Fulfillment tracking

## API Endpoints

### Base Pattern
- `GET /api/admin/{collection}` - List all
- `POST /api/admin/{collection}` - Create new
- `GET /api/admin/{collection}/{id}` - Get one
- `PUT /api/admin/{collection}/{id}` - Update
- `DELETE /api/admin/{collection}/{id}` - Delete

### Special Endpoints
- `GET /api/admin/orders/status-counts` - Order status summary

## Schema Files

### Domain Models (Zod)
- `/src/domain/products/product.schema.ts`
- `/src/domain/payments/payment-gateway.schema.ts`
- `/src/domain/payments/payment.schema.ts`
- `/src/domain/inventory/inventory.schema.ts`
- `/src/domain/vendors/vendor.schema.ts`
- `/src/domain/products/lodgetix-mapping.schema.ts`

### UI Schemas
- `/src/types/commerce-schemas.ts` - Field configurations for forms
- `/src/types/commerce.ts` - TypeScript interfaces

### Database Setup
- `/scripts/mongodb-setup/07-create-commerce-indexes.ts` - Index creation
- `/scripts/test-commerce-structure.ts` - Test data generation

## Example Data Structure

### Product with Variants
```javascript
{
  handle: 'annual-ball-2024-tickets',
  title: 'Annual Ball 2024 Tickets',
  type: 'variant',
  collection_id: 'collection_123',
  variants: [
    {
      title: 'Standard Ticket',
      sku: 'BALL-2024-STD',
      inventory_quantity: 100,
      price: { amount: 150000, currency_code: 'ZAR' }
    },
    {
      title: 'VIP Ticket',
      sku: 'BALL-2024-VIP',
      inventory_quantity: 20,
      price: { amount: 300000, currency_code: 'ZAR' }
    }
  ],
  options: [
    { title: 'Attendee Name' },
    { title: 'Dietary Requirements' }
  ],
  lodgetix_mapping: {
    event_id: 'event_456',
    function_id: 'function_123'
  }
}
```

### Bundle Product
```javascript
{
  handle: 'couples-package-2024',
  title: 'Couples Package',
  type: 'bundle',
  bundle_items: [
    {
      product_id: 'prod_1',
      variant_id: 'var_std',
      quantity: 2,
      is_optional: false
    }
  ],
  price: { amount: 270000, currency_code: 'ZAR' }
}
```

## Migration Notes

When migrating from LodgeTix:
1. Create product collections from functions
2. Create products from events
3. Create variants from eventTickets
4. Map packages to bundle products
5. Convert registrations to orders
6. Store attendee details as line item options

## Currency
Default currency is set to `ZAR` (South African Rand) with support for:
- USD, EUR, GBP, AUD, CAD, ZAR

## Next Steps
1. Implement order creation workflow
2. Add inventory tracking for ticket sales
3. Create reporting dashboards
4. Implement payment processing
5. Add vendor payout management