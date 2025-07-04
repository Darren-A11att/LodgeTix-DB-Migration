# Orders Collection - Validation Rules

## Schema Validation

```javascript
db.createCollection("orders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "orderNumber",
        "orderType", 
        "catalogObjectId",
        "status",
        "customer",
        "lineItems",
        "totals",
        "metadata"
      ],
      properties: {
        // Order identification
        orderNumber: {
          bsonType: "string",
          pattern: "^ORD-[0-9]{4}-[0-9]{6}$",
          description: "Order number in format ORD-YYYY-NNNNNN"
        },
        
        orderType: {
          bsonType: "string",
          enum: ["registration", "purchase", "sponsorship"],
          description: "Type of order"
        },
        
        catalogObjectId: {
          bsonType: "objectId",
          description: "Reference to catalog object"
        },
        
        status: {
          bsonType: "string",
          enum: ["pending", "processing", "paid", "partially_paid", "cancelled", "refunded"],
          description: "Current order status"
        },
        
        // Customer information
        customer: {
          bsonType: "object",
          required: ["type"],
          properties: {
            type: {
              bsonType: "string",
              enum: ["individual", "lodge", "delegation", "organisation"],
              description: "Customer type"
            },
            contactId: {
              bsonType: ["objectId", "null"],
              description: "Reference to contact if exists"
            },
            organisationId: {
              bsonType: ["objectId", "null"],
              description: "For group orders"
            },
            rawData: {
              bsonType: ["object", "null"],
              properties: {
                name: { bsonType: "string" },
                email: { bsonType: "string" },
                phone: { bsonType: "string" }
              },
              description: "Raw data if contact doesn't exist"
            }
          }
        },
        
        // Line items array
        lineItems: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            required: ["productId", "productName", "quantity", "unitPrice", "totalPrice", "owner", "fulfillment"],
            properties: {
              productId: {
                bsonType: "string",
                pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                description: "Product UUID"
              },
              productName: {
                bsonType: "string",
                minLength: 1,
                description: "Product name for history"
              },
              variationId: {
                bsonType: ["string", "null"],
                pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                description: "Variation UUID"
              },
              variationName: {
                bsonType: ["string", "null"],
                description: "Variation name for history"
              },
              quantity: {
                bsonType: "int",
                minimum: 1,
                description: "Quantity must be positive"
              },
              unitPrice: {
                bsonType: "decimal",
                minimum: NumberDecimal("0"),
                description: "Price per unit"
              },
              totalPrice: {
                bsonType: "decimal",
                minimum: NumberDecimal("0"),
                description: "Total line item price"
              },
              owner: {
                bsonType: "object",
                required: ["type"],
                properties: {
                  type: {
                    bsonType: "string",
                    enum: ["contact", "organisation", "unassigned"],
                    description: "Owner type"
                  },
                  contactId: {
                    bsonType: ["objectId", "null"],
                    description: "If assigned to contact"
                  },
                  organisationId: {
                    bsonType: ["objectId", "null"],
                    description: "If assigned to org"
                  },
                  rawAttendee: {
                    bsonType: ["object", "null"],
                    properties: {
                      firstName: { bsonType: "string" },
                      lastName: { bsonType: "string" },
                      email: { bsonType: "string" },
                      phone: { bsonType: "string" },
                      dietaryRequirements: { bsonType: ["string", "null"] },
                      specialNeeds: { bsonType: ["string", "null"] }
                    }
                  }
                }
              },
              fulfillment: {
                bsonType: "object",
                required: ["status"],
                properties: {
                  status: {
                    bsonType: "string",
                    enum: ["pending", "fulfilled", "partial", "cancelled"],
                    description: "Fulfillment status"
                  },
                  ticketId: {
                    bsonType: ["objectId", "null"],
                    description: "Reference to created ticket"
                  },
                  fulfilledAt: {
                    bsonType: ["date", "null"],
                    description: "When fulfilled"
                  }
                }
              }
            }
          }
        },
        
        // Financial totals
        totals: {
          bsonType: "object",
          required: ["subtotal", "total", "currency"],
          properties: {
            subtotal: {
              bsonType: "decimal",
              minimum: NumberDecimal("0"),
              description: "Sum of line items"
            },
            discount: {
              bsonType: ["decimal", "null"],
              minimum: NumberDecimal("0"),
              description: "Applied discounts"
            },
            tax: {
              bsonType: ["decimal", "null"],
              minimum: NumberDecimal("0"),
              description: "Tax amount"
            },
            fees: {
              bsonType: ["decimal", "null"],
              minimum: NumberDecimal("0"),
              description: "Processing fees"
            },
            total: {
              bsonType: "decimal",
              minimum: NumberDecimal("0"),
              description: "Final amount"
            },
            paid: {
              bsonType: ["decimal", "null"],
              minimum: NumberDecimal("0"),
              description: "Amount paid"
            },
            balance: {
              bsonType: ["decimal", "null"],
              description: "Remaining balance"
            },
            currency: {
              bsonType: "string",
              enum: ["AUD", "NZD", "USD", "GBP", "EUR"],
              description: "Currency code"
            }
          }
        },
        
        // Payment information
        payment: {
          bsonType: ["object", "null"],
          properties: {
            status: {
              bsonType: "string",
              enum: ["pending", "processing", "paid", "failed", "refunded"],
              description: "Payment status"
            },
            transactions: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "objectId"
              },
              description: "Financial transaction references"
            }
          }
        },
        
        // Billing information
        billing: {
          bsonType: ["object", "null"],
          properties: {
            contact: {
              bsonType: ["object", "null"],
              properties: {
                name: { bsonType: "string" },
                email: { bsonType: "string" },
                phone: { bsonType: "string" }
              }
            },
            address: {
              bsonType: ["object", "null"],
              properties: {
                addressLine1: { bsonType: "string" },
                addressLine2: { bsonType: ["string", "null"] },
                city: { bsonType: "string" },
                state: { bsonType: "string" },
                postcode: { bsonType: "string" },
                country: { bsonType: "string" }
              }
            },
            abn: { bsonType: ["string", "null"] },
            organisationName: { bsonType: ["string", "null"] }
          }
        },
        
        notes: {
          bsonType: ["string", "null"],
          description: "Customer notes"
        },
        
        // System metadata
        metadata: {
          bsonType: "object",
          required: ["createdAt"],
          properties: {
            source: {
              bsonType: ["object", "null"],
              properties: {
                channel: {
                  bsonType: "string",
                  enum: ["online", "phone", "email", "manual"]
                },
                device: { bsonType: ["string", "null"] },
                ipAddress: { bsonType: ["string", "null"] }
              }
            },
            createdAt: { bsonType: "date" },
            createdBy: { bsonType: ["objectId", "null"] },
            updatedAt: { bsonType: ["date", "null"] },
            updatedBy: { bsonType: ["objectId", "null"] }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})
```

## Custom Validation Functions

### 1. Order Number Uniqueness
```javascript
// Ensure order number is unique and follows pattern
function validateOrderNumber(orderNumber) {
  const pattern = /^ORD-\d{4}-\d{6}$/;
  if (!pattern.test(orderNumber)) {
    throw new Error("Order number must match pattern ORD-YYYY-NNNNNN");
  }
  
  const existing = db.orders.findOne({ orderNumber });
  if (existing) {
    throw new Error(`Order number ${orderNumber} already exists`);
  }
  
  return true;
}
```

### 2. Line Item Price Validation
```javascript
// Validate line item pricing calculations
function validateLineItemPricing(lineItem) {
  const calculatedTotal = lineItem.quantity * lineItem.unitPrice;
  const difference = Math.abs(calculatedTotal - lineItem.totalPrice);
  
  if (difference > 0.01) { // Allow for rounding
    throw new Error(
      `Line item total (${lineItem.totalPrice}) doesn't match quantity × unit price (${calculatedTotal})`
    );
  }
  
  return true;
}
```

### 3. Order Totals Validation
```javascript
// Validate order financial totals
function validateOrderTotals(order) {
  // Calculate line items subtotal
  const calculatedSubtotal = order.lineItems.reduce(
    (sum, item) => sum + parseFloat(item.totalPrice),
    0
  );
  
  // Check subtotal matches
  if (Math.abs(calculatedSubtotal - parseFloat(order.totals.subtotal)) > 0.01) {
    throw new Error("Order subtotal doesn't match sum of line items");
  }
  
  // Calculate expected total
  const discount = parseFloat(order.totals.discount || 0);
  const tax = parseFloat(order.totals.tax || 0);
  const fees = parseFloat(order.totals.fees || 0);
  const expectedTotal = calculatedSubtotal - discount + tax + fees;
  
  if (Math.abs(expectedTotal - parseFloat(order.totals.total)) > 0.01) {
    throw new Error("Order total doesn't match calculated amount");
  }
  
  // Validate balance
  const paid = parseFloat(order.totals.paid || 0);
  const expectedBalance = parseFloat(order.totals.total) - paid;
  const actualBalance = parseFloat(order.totals.balance || 0);
  
  if (Math.abs(expectedBalance - actualBalance) > 0.01) {
    throw new Error("Order balance doesn't match total - paid");
  }
  
  return true;
}
```

### 4. Customer Validation
```javascript
// Validate customer data requirements
function validateCustomer(customer) {
  // Either contactId or rawData must be provided
  if (!customer.contactId && !customer.rawData) {
    throw new Error("Customer must have either contactId or raw data");
  }
  
  // Raw data validation
  if (customer.rawData) {
    if (!customer.rawData.name || !customer.rawData.email) {
      throw new Error("Customer raw data must include name and email");
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.rawData.email)) {
      throw new Error("Invalid customer email format");
    }
  }
  
  // Lodge/delegation orders must have organisationId
  if (['lodge', 'delegation'].includes(customer.type) && !customer.organisationId) {
    throw new Error(`${customer.type} orders must include organisationId`);
  }
  
  return true;
}
```

### 5. Inventory Availability Check
```javascript
// Check if items are available before order creation
async function validateInventoryAvailability(order) {
  const catalog = await db.catalogObjects.findOne(
    { _id: order.catalogObjectId }
  );
  
  if (!catalog) {
    throw new Error("Catalog object not found");
  }
  
  for (const lineItem of order.lineItems) {
    const product = catalog.products.find(p => p.productId === lineItem.productId);
    if (!product) {
      throw new Error(`Product ${lineItem.productId} not found in catalog`);
    }
    
    if (lineItem.variationId) {
      const variation = product.variations.find(v => v.variationId === lineItem.variationId);
      if (!variation) {
        throw new Error(`Variation ${lineItem.variationId} not found`);
      }
      
      if (variation.inventory.method === 'allocated') {
        if (variation.inventory.quantity_available < lineItem.quantity) {
          throw new Error(
            `Insufficient inventory for ${product.name} - ${variation.name}. ` +
            `Available: ${variation.inventory.quantity_available}, Requested: ${lineItem.quantity}`
          );
        }
      }
    }
  }
  
  return true;
}
```

### 6. Status Transition Validation
```javascript
// Validate order status transitions
function validateStatusTransition(currentStatus, newStatus) {
  const validTransitions = {
    'pending': ['processing', 'cancelled'],
    'processing': ['paid', 'partially_paid', 'failed', 'cancelled'],
    'paid': ['refunded'],
    'partially_paid': ['paid', 'cancelled', 'refunded'],
    'failed': ['pending', 'processing', 'cancelled'],
    'cancelled': [], // Terminal state
    'refunded': [] // Terminal state
  };
  
  const allowed = validTransitions[currentStatus] || [];
  
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid status transition from ${currentStatus} to ${newStatus}`
    );
  }
  
  return true;
}
```

### 7. Fulfillment Validation
```javascript
// Validate fulfillment requirements
function validateFulfillment(order) {
  // Only paid orders can be fulfilled
  if (!['paid', 'partially_paid'].includes(order.status)) {
    const pendingFulfillments = order.lineItems.filter(
      item => item.fulfillment.status !== 'pending'
    );
    
    if (pendingFulfillments.length > 0) {
      throw new Error("Cannot fulfill items for unpaid orders");
    }
  }
  
  // Validate owner assignment for fulfilled items
  for (const item of order.lineItems) {
    if (item.fulfillment.status === 'fulfilled') {
      if (item.owner.type === 'unassigned') {
        throw new Error("Cannot fulfill unassigned items");
      }
      
      if (!item.fulfillment.ticketId && !item.fulfillment.fulfilledAt) {
        throw new Error("Fulfilled items must have ticketId or fulfilledAt");
      }
    }
  }
  
  return true;
}
```

## Validation Triggers

### 1. Pre-Insert Validation
```javascript
// Complete validation before order creation
async function preInsertOrderValidation(order) {
  // Generate order number if not provided
  if (!order.orderNumber) {
    order.orderNumber = await generateOrderNumber();
  }
  
  // Validate all aspects
  validateOrderNumber(order.orderNumber);
  validateCustomer(order.customer);
  
  // Validate each line item
  for (const item of order.lineItems) {
    validateLineItemPricing(item);
  }
  
  validateOrderTotals(order);
  await validateInventoryAvailability(order);
  
  // Set defaults
  order.status = order.status || 'pending';
  order.payment = order.payment || { status: 'pending' };
  order.metadata = order.metadata || {};
  order.metadata.createdAt = new Date();
  
  // Initialize fulfillment status
  for (const item of order.lineItems) {
    item.fulfillment = item.fulfillment || { status: 'pending' };
  }
  
  // Calculate initial balance
  order.totals.paid = order.totals.paid || NumberDecimal("0");
  order.totals.balance = NumberDecimal(order.totals.total - order.totals.paid);
  
  return order;
}
```

### 2. Pre-Update Validation
```javascript
// Validation for order updates
async function preUpdateOrderValidation(orderId, update) {
  const currentOrder = await db.orders.findOne({ _id: orderId });
  
  if (!currentOrder) {
    throw new Error("Order not found");
  }
  
  // Status transition validation
  if (update.status && update.status !== currentOrder.status) {
    validateStatusTransition(currentOrder.status, update.status);
  }
  
  // Payment validation
  if (update.payment) {
    if (update.payment.status === 'paid' && currentOrder.totals.balance > 0) {
      throw new Error("Cannot mark as paid with outstanding balance");
    }
  }
  
  // Fulfillment validation
  if (update.lineItems) {
    const mergedOrder = { ...currentOrder, lineItems: update.lineItems };
    validateFulfillment(mergedOrder);
  }
  
  // Update metadata
  update['metadata.updatedAt'] = new Date();
  
  return update;
}
```

## Business Rule Enforcement

### 1. Order Number Generation
```javascript
// Generate next order number
async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const lastOrder = await db.orders.findOne(
    { orderNumber: { $regex: `^ORD-${year}-` } },
    { sort: { orderNumber: -1 } }
  );
  
  let nextNumber = 1;
  if (lastOrder) {
    const matches = lastOrder.orderNumber.match(/ORD-\d{4}-(\d{6})/);
    if (matches) {
      nextNumber = parseInt(matches[1]) + 1;
    }
  }
  
  return `ORD-${year}-${nextNumber.toString().padStart(6, '0')}`;
}
```

### 2. Reservation Management
```javascript
// Reserve inventory when order created
async function reserveInventory(order) {
  const updates = [];
  
  for (const item of order.lineItems) {
    updates.push({
      updateOne: {
        filter: {
          _id: order.catalogObjectId,
          "products.productId": item.productId,
          "products.variations.variationId": item.variationId
        },
        update: {
          $inc: {
            "products.$[product].variations.$[variation].inventory.quantity_reserved": item.quantity,
            "products.$[product].variations.$[variation].inventory.quantity_available": -item.quantity
          }
        },
        arrayFilters: [
          { "product.productId": item.productId },
          { "variation.variationId": item.variationId }
        ]
      }
    });
  }
  
  return db.catalogObjects.bulkWrite(updates);
}
```

### 3. Currency Consistency
```javascript
// Ensure all monetary values use same currency
function validateCurrencyConsistency(order) {
  const currency = order.totals.currency;
  
  // Check catalog currency matches
  const catalog = db.catalogObjects.findOne({ _id: order.catalogObjectId });
  
  for (const item of order.lineItems) {
    const product = catalog.products.find(p => p.productId === item.productId);
    const variation = product.variations.find(v => v.variationId === item.variationId);
    
    if (variation.price.currency !== currency) {
      throw new Error(
        `Currency mismatch: Order uses ${currency} but product uses ${variation.price.currency}`
      );
    }
  }
  
  return true;
}
```

## Data Integrity Rules

1. **Order Immutability**: Certain fields cannot be changed after creation
   - orderNumber
   - catalogObjectId
   - customer.type
   - metadata.createdAt

2. **Financial Integrity**: 
   - Totals must always balance
   - Refunds cannot exceed paid amount
   - Currency cannot change after creation

3. **Inventory Integrity**:
   - Reserved items must be released on cancellation
   - Fulfilled items cannot be unreserved

4. **Relationship Integrity**:
   - Referenced catalog must exist
   - Referenced contacts must exist
   - Transaction references must be valid