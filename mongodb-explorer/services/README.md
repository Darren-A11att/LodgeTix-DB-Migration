# Cart Services Documentation

## Overview

This service layer provides a complete, reusable architecture for handling the e-commerce cart system that converts registrations into a proper cart → order flow. The services handle both individual and organization (lodge, grand lodge, masonic order) registrations.

## Architecture

```
Registration → Cart → Order
```

### Key Concepts

1. **Individual Registrations**: One bundle item per attendee
2. **Organization Registrations**: Single bundle item for the entire organization
3. **Customer**: Always the booking contact (person who made the purchase)
4. **FormData**: Contains attendee details (individual) or organization details (lodge/grand lodge/masonic order)

## Services

### 1. CartService (`cart-service.ts`)

Main service for cart operations.

#### Key Methods

```typescript
// Convert registration to cart
const cart = await cartService.registrationToCart(registrationData);

// Save cart to database
await cartService.saveCart(cart);

// Get cart by ID
const cart = await cartService.getCart(cartId);

// Update cart
await cartService.updateCart(cartId, updates);

// Convert cart to order
const order = await cartService.convertCartToOrder(cartId, paymentInfo);
```

#### Registration Data Structure

```typescript
interface RegistrationData {
  registrationId: string;
  registrationType: 'individual' | 'lodge' | 'grandLodge' | 'masonicOrder';
  registrationDate: Date;
  confirmationNumber: string;
  bookingContact: BookingContact;
  attendees?: Attendee[];
  lodgeDetails?: LodgeDetails;
  tickets?: Ticket[];
}
```

### 2. CartValidationService (`cart-validation-service.ts`)

Validates cart structure and data integrity.

#### Key Methods

```typescript
// Validate cart structure
const validation = validationService.validateCart(cart);
if (!validation.valid) {
  console.error('Errors:', validation.errors);
  console.warn('Warnings:', validation.warnings);
}

// Validate for order conversion
const validation = validationService.validateForOrderConversion(cart);
```

#### Validation Rules

- **Cart Basics**: ID, status, currency, dates
- **Customer**: Email, name, type (person/organisation)
- **Cart Items**: Product IDs, quantities, pricing
- **Registration Rules**: 
  - Individual: One bundle per attendee with formData
  - Organization: Single bundle with organization details

### 3. MigrationUtilities (`migration-utilities.ts`)

Utilities for bulk operations and migrations.

#### Key Methods

```typescript
// Migrate all registrations to carts
const result = await migrationUtils.migrateRegistrationsToCarts({
  batchSize: 100,
  validateBeforeSave: true,
  continueOnError: true,
  dryRun: false
});

// Update formData from attendee records
await migrationUtils.updateFormDataFromAttendees();

// Validate all existing carts
const validation = await migrationUtils.validateAllCarts();

// Clean up orphaned items
await migrationUtils.cleanupOrphanedItems();
```

## Usage Examples

### Creating a Cart from Individual Registration

```typescript
import { MongoClient } from 'mongodb';
import { CartService } from './services/cart-service';
import { CartValidationService } from './services/cart-validation-service';

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db('supabase');

const cartService = new CartService(db);
const validationService = new CartValidationService();

// Individual registration with 2 attendees
const registrationData = {
  registrationId: 'REG-001',
  registrationType: 'individual',
  registrationDate: new Date(),
  confirmationNumber: 'CONF-001',
  bookingContact: {
    firstName: 'John',
    lastName: 'Smith',
    email: 'john@example.com',
    phone: '0400000000'
  },
  attendees: [
    {
      attendeeId: 'ATT-001',
      firstName: 'John',
      lastName: 'Smith',
      rank: 'MM',
      lodgeName: 'Example Lodge',
      lodgeNumber: '123',
      email: 'john@example.com'
    },
    {
      attendeeId: 'ATT-002',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com'
      // No rank = guest
    }
  ]
};

// Create cart (will create 2 bundle items, one per attendee)
const cart = await cartService.registrationToCart(registrationData);

// Validate
const validation = validationService.validateCart(cart);
if (validation.valid) {
  await cartService.saveCart(cart);
  console.log('Cart created:', cart.cartId);
}
```

### Creating a Cart from Lodge Registration

```typescript
// Lodge registration
const lodgeRegistration = {
  registrationId: 'REG-002',
  registrationType: 'lodge',
  registrationDate: new Date(),
  confirmationNumber: 'LDG-001',
  bookingContact: {
    firstName: 'Secretary',
    lastName: 'Name',
    email: 'secretary@lodge.org',
    businessName: 'Example Lodge No. 123',
    businessNumber: 'ABN123456'
  },
  lodgeDetails: {
    lodgeName: 'Example Lodge',
    lodgeNumber: '123',
    lodgeCity: 'Melbourne',
    lodgeState: 'VIC'
  },
  attendees: [
    // List of 10 attendees
  ]
};

// Create cart (will create 1 bundle item with quantity 10)
const cart = await cartService.registrationToCart(lodgeRegistration);

// Customer will be type 'organisation' due to businessName
console.log('Customer type:', cart.customer.type); // 'organisation'
```

### Converting Cart to Order

```typescript
// Get cart
const cart = await cartService.getCart('cart-id-123');

// Validate for order conversion
const validation = validationService.validateForOrderConversion(cart);

if (validation.valid) {
  // Convert to order
  const order = await cartService.convertCartToOrder('cart-id-123', {
    method: 'stripe',
    paymentIntentId: 'pi_123',
    amount: cart.total
  });
  
  console.log('Order created:', order.orderNumber);
}
```

### Bulk Migration

```typescript
const migrationUtils = new MigrationUtilities(db);

// Migrate all old registrations
const result = await migrationUtils.migrateRegistrationsToCarts({
  batchSize: 50,
  validateBeforeSave: true,
  continueOnError: true,
  dryRun: false // Set to true for testing
});

console.log(`Migrated: ${result.success}`);
console.log(`Failed: ${result.failed}`);
console.log(`Duration: ${result.duration}ms`);
```

## API Integration

### Express.js Example

```typescript
import express from 'express';
import { setupCartRoutes } from './api/cart-api-example';

const app = express();
app.use(express.json());

// Setup all cart routes
setupCartRoutes(app, db);

// Routes created:
// POST   /api/carts/from-registration
// GET    /api/carts/:cartId
// PUT    /api/carts/:cartId
// POST   /api/carts/:cartId/convert-to-order
// POST   /api/carts/:cartId/validate
// POST   /api/admin/migrate-registrations
// POST   /api/admin/update-formdata
// GET    /api/admin/validate-all-carts
```

## Data Structure Reference

### Cart Structure

```typescript
{
  cartId: "uuid",
  customer: {
    customerId: "uuid",
    name: "John Smith",
    type: "person", // or "organisation"
    email: "john@example.com",
    businessName?: "Lodge Name", // if organisation
    businessNumber?: "ABN123"
  },
  cartItems: [
    {
      // Bundle item (parent)
      cartItemId: "uuid",
      productId: "bundle-product-id",
      variantId: "individual-mason-variant",
      quantity: 1,
      formData: {
        // All attendee data for individual
        // Or organization data for lodge
      },
      metadata: {
        registrationType: "individual",
        attendeeType: "mason"
      }
    },
    {
      // Event item (child)
      cartItemId: "uuid",
      parentItemId: "parent-bundle-id",
      productId: "event-product-id",
      // ...
    }
  ],
  subtotal: 1000,
  tax: 100,
  discount: 0,
  total: 1100,
  currency: "AUD",
  status: "active"
}
```

## Testing

### Unit Test Example

```typescript
import { CartService } from './services/cart-service';
import { CartValidationService } from './services/cart-validation-service';

describe('CartService', () => {
  let cartService: CartService;
  let validationService: CartValidationService;
  
  beforeEach(async () => {
    const db = await getTestDatabase();
    cartService = new CartService(db);
    validationService = new CartValidationService();
  });
  
  test('should create individual registration cart', async () => {
    const registration = createTestRegistration('individual');
    const cart = await cartService.registrationToCart(registration);
    
    expect(cart.cartItems).toHaveLength(registration.attendees.length);
    expect(cart.customer.type).toBe('person');
  });
  
  test('should validate cart structure', () => {
    const cart = createTestCart();
    const validation = validationService.validateCart(cart);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});
```

## Error Handling

All services throw errors for critical failures. Always wrap service calls in try-catch:

```typescript
try {
  const cart = await cartService.registrationToCart(data);
  await cartService.saveCart(cart);
} catch (error) {
  if (error.message.includes('Bundle product not found')) {
    // Handle missing bundle product
  } else if (error.message.includes('Validation failed')) {
    // Handle validation errors
  } else {
    // Handle other errors
  }
}
```

## Performance Considerations

1. **Batch Processing**: Use `batchSize` parameter for large migrations
2. **Validation**: Can be disabled for bulk operations with `validateBeforeSave: false`
3. **Dry Run**: Always test migrations with `dryRun: true` first
4. **Indexing**: Ensure MongoDB indexes on:
   - `carts.cartId`
   - `carts.customer.customerId`
   - `carts.cartItems.metadata.registrationId`

## Maintenance

### Adding New Registration Types

1. Add to `RegistrationData` type
2. Update variant selection logic in `CartService`
3. Add validation rules in `CartValidationService`
4. Update migration transformations

### Changing Validation Rules

Edit `CartValidationService` methods:
- `validateRegistrationRules()` for business rules
- `validateCartBasics()` for structural rules
- `validateCustomer()` for customer requirements

## Support

For issues or questions:
1. Check validation errors for detailed messages
2. Use dry run mode for testing migrations
3. Review the validation service for rule definitions
4. Check MongoDB logs for database issues