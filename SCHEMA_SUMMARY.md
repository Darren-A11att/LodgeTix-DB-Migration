# MongoDB Schema Summary - LodgeTix

All schemas include automatic `createdAt` and `lastModifiedAt` timestamps.

## Product Collection

```typescript
{
  productId: string          // UUID v4, unique
  name: string
  status: string
  type: string
  description?: string | null
  options?: [{
    id: string
    name: string
    values: string[]
  }]
  variants?: [{             // Computed from option variations
    id: string
    name: string
    price: number
    inventoryItem?: string  // ID of related inventory item
    inventoryAvailable?: number // Computed value
  }]
  collection?: [{
    id: string
    name: string
  }]
  category?: [{
    id: string
    name: string
    parent?: string
  }]
  images?: [{
    id: string
    url: string
    alternateText?: string
  }]
  createdAt: Date          // Auto-set on creation
  lastModifiedAt: Date     // Auto-updated on any change
}
```

## Inventory Collection

```typescript
{
  inventoryItemId: string   // UUID v4
  name: string
  productVariantId: string  // References product variant
  status: 'available' | 'soldOut' | 'backOrder'
  type: 'digital' | 'physical' | 'service'
  total: number            // Total inventory
  reserved: number         // Computed from active carts
  sold: number            // Computed from paid orders
  available: number       // Computed: total - sold - reserved
  location: [{
    locationId: string
    type: 'digital' | 'physical' | 'service'
    locationAddress: string
  }]
  createdAt: Date         // Auto-set on creation
  lastModifiedAt: Date    // Auto-updated on any change
}
```

## Cart Collection

```typescript
{
  cartId: string          // UUID v4
  status: 'active' | 'checkout' | 'abandoned' | 'completed'
  customerId: string      // Auth user ID
  supplierId: string      // Vendor ID
  cartItems: [{
    cartItemId: string    // UUID v4
    variantId: string     // Product variant ID
    name: string
    quantity: number
    unitPrice: number
    subtotal: number      // Computed: quantity * unitPrice
    customerObject?: [{
      metadata: object
    }]
  }]
  createdAt: Date         // Auto-set on creation
  lastModifiedAt: Date    // Auto-updated on any change
  lastActive: Date        // Updated on any interaction
}
```

## Checkout Collection

```typescript
{
  checkoutId: string      // UUID v4
  status: 'started' | 'abandoned' | 'failed' | 'completed'
  customer: {
    customerId: string    // UUID v4
    type: 'person' | 'business'
    firstName: string
    lastName: string
    phone: string
    email: string
    addressLine1: string
    addressLine2?: string
    suburb: string
    state: string
    postCode: string
    country: string
    businessName?: string  // Required for business type
    businessNumber?: string // Required for business type
  }
  supplierId: string
  cartId: string          // UUID v4 of the cart
  paymentIntent: {
    id: string
    provider: string
    data: any[]
    status: string
    subtotal: number
    fees: {
      platformFee: number
      merchantFee: number
      totalFees: number   // Computed: platformFee + merchantFee
    }
    totalAmount: number   // Computed: subtotal + totalFees
  }
  createdAt: Date         // Auto-set on creation
  lastModifiedAt: Date    // Auto-updated on any change
}
```

## Computed Fields & Validations

### Automatic Calculations:
- **Cart Item Subtotal**: `quantity * unitPrice`
- **Inventory Available**: `total - sold - reserved`
- **Payment Total Fees**: `platformFee + merchantFee`
- **Payment Total Amount**: `subtotal + totalFees`

### Automatic Updates:
- **createdAt**: Set once when document is created
- **lastModifiedAt**: Updated on every modification
- **lastActive** (Cart only): Updated on any cart interaction

### UUID Validation:
All ID fields marked as UUID v4 are validated to ensure proper format.

### Business Rules:
- Business customers must provide `businessName` and `businessNumber`
- Email addresses are validated for proper format
- Inventory `reserved` counts are computed from active carts
- Inventory `sold` counts are computed from paid orders

## Repository Methods

All schemas have corresponding Repository classes with:
- CRUD operations (create, read, update, delete)
- Specialized queries by various fields
- Automatic timestamp management
- Validation before save
- Computed field updates
- Business logic enforcement

## Testing

Each schema has a comprehensive test script in `/scripts/test-[schema]-schema.ts` that validates:
- Creation with required and optional fields
- Validation rules
- Update operations
- Query methods
- Computed field calculations
- Timestamp management