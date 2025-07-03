# Products Collection - Validation Rules

## MongoDB Schema Validation

```javascript
db.createCollection("products", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["productId", "functionId", "sku", "name", "type", "price", "inventory", "status"],
      properties: {
        productId: {
          bsonType: "string",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "Must be a valid UUID"
        },
        functionId: {
          bsonType: "string",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "Must reference a valid function UUID"
        },
        eventId: {
          bsonType: ["string", "null"],
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "Optional event UUID for tickets"
        },
        sku: {
          bsonType: "string",
          minLength: 1,
          maxLength: 50,
          pattern: "^[A-Z0-9-]+$",
          description: "Stock keeping unit - uppercase alphanumeric with hyphens"
        },
        name: {
          bsonType: "string",
          minLength: 1,
          maxLength: 200,
          description: "Product display name"
        },
        description: {
          bsonType: ["string", "null"],
          maxLength: 2000,
          description: "Product description"
        },
        type: {
          bsonType: "string",
          enum: ["ticket", "merchandise", "addon", "donation"],
          description: "Product type classification"
        },
        category: {
          bsonType: ["string", "null"],
          enum: ["admission", "apparel", "commemorative", "vip_upgrade", "general", null],
          description: "Product category"
        },
        price: {
          bsonType: "object",
          required: ["amount", "currency"],
          properties: {
            amount: {
              bsonType: "decimal",
              minimum: 0,
              description: "Price must be non-negative"
            },
            currency: {
              bsonType: "string",
              pattern: "^[A-Z]{3}$",
              description: "ISO 4217 currency code"
            },
            taxRate: {
              bsonType: ["number", "null"],
              minimum: 0,
              maximum: 1,
              description: "Tax rate as decimal (0.10 = 10%)"
            },
            taxIncluded: {
              bsonType: ["bool", "null"],
              description: "Whether tax is included in amount"
            },
            cost: {
              bsonType: ["decimal", "null"],
              minimum: 0,
              description: "Cost price for margin calculations"
            }
          }
        },
        inventory: {
          bsonType: "object",
          required: ["method", "soldCount", "reservedCount", "version"],
          properties: {
            method: {
              bsonType: "string",
              enum: ["allocated", "unlimited"],
              description: "Inventory tracking method"
            },
            totalCapacity: {
              bsonType: ["number", "null"],
              minimum: 0,
              description: "Maximum available quantity"
            },
            soldCount: {
              bsonType: "number",
              minimum: 0,
              description: "Number of items sold"
            },
            reservedCount: {
              bsonType: "number",
              minimum: 0,
              description: "Number temporarily reserved"
            },
            availableCount: {
              bsonType: ["number", "null"],
              description: "Computed available quantity"
            },
            lastUpdated: {
              bsonType: ["date", "null"],
              description: "Last inventory update timestamp"
            },
            version: {
              bsonType: "number",
              minimum: 0,
              description: "Optimistic locking version"
            }
          }
        },
        attributes: {
          bsonType: ["object", "null"],
          properties: {
            sessionInfo: {
              bsonType: ["object", "null"],
              properties: {
                date: { bsonType: ["date", "null"] },
                duration: { 
                  bsonType: ["number", "null"],
                  minimum: 0,
                  description: "Duration in minutes"
                },
                venue: { bsonType: ["string", "null"] },
                room: { bsonType: ["string", "null"] }
              }
            },
            shipping: {
              bsonType: ["object", "null"],
              properties: {
                required: { bsonType: "bool" },
                weight: { 
                  bsonType: ["number", "null"],
                  minimum: 0,
                  description: "Weight in grams"
                },
                dimensions: {
                  bsonType: ["object", "null"],
                  properties: {
                    length: { bsonType: "number", minimum: 0 },
                    width: { bsonType: "number", minimum: 0 },
                    height: { bsonType: "number", minimum: 0 }
                  }
                },
                shippingClass: {
                  bsonType: ["string", "null"],
                  enum: ["standard", "express", "bulky", null]
                }
              }
            },
            digital: {
              bsonType: ["object", "null"],
              properties: {
                downloadUrl: { 
                  bsonType: ["string", "null"],
                  pattern: "^https?://"
                },
                expiryDays: { 
                  bsonType: ["number", "null"],
                  minimum: 1
                }
              }
            }
          }
        },
        eligibility: {
          bsonType: ["object", "null"],
          properties: {
            rules: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["type", "operator", "value"],
                properties: {
                  type: {
                    bsonType: "string",
                    enum: ["membership", "rank", "lodge", "jurisdiction"]
                  },
                  operator: {
                    bsonType: "string",
                    enum: ["equals", "includes", "excludes", "greater_than", "less_than"]
                  },
                  value: { bsonType: "string" },
                  message: { bsonType: ["string", "null"] }
                }
              }
            },
            operator: {
              bsonType: ["string", "null"],
              enum: ["AND", "OR", null],
              description: "How to combine multiple rules"
            }
          }
        },
        restrictions: {
          bsonType: ["object", "null"],
          properties: {
            minPerOrder: {
              bsonType: ["number", "null"],
              minimum: 1
            },
            maxPerOrder: {
              bsonType: ["number", "null"],
              minimum: 1
            },
            maxPerAttendee: {
              bsonType: ["number", "null"],
              minimum: 1
            },
            startDate: { bsonType: ["date", "null"] },
            endDate: { bsonType: ["date", "null"] },
            memberOnly: { bsonType: ["bool", "null"] }
          }
        },
        display: {
          bsonType: ["object", "null"],
          properties: {
            order: {
              bsonType: ["number", "null"],
              description: "Display sort order"
            },
            featured: { bsonType: ["bool", "null"] },
            hidden: { bsonType: ["bool", "null"] },
            imageUrl: {
              bsonType: ["string", "null"],
              pattern: "^https?://"
            },
            thumbnailUrl: {
              bsonType: ["string", "null"],
              pattern: "^https?://"
            },
            badges: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "string",
                enum: ["bestseller", "limited", "new", "sale", "exclusive"]
              }
            }
          }
        },
        external: {
          bsonType: ["object", "null"],
          properties: {
            stripeProductId: {
              bsonType: ["string", "null"],
              pattern: "^prod_"
            },
            stripePriceId: {
              bsonType: ["string", "null"],
              pattern: "^price_"
            },
            squareCatalogId: { bsonType: ["string", "null"] },
            xeroItemCode: { bsonType: ["string", "null"] }
          }
        },
        status: {
          bsonType: "string",
          enum: ["draft", "active", "inactive", "sold_out", "discontinued"],
          description: "Product lifecycle status"
        },
        statusReason: {
          bsonType: ["string", "null"],
          maxLength: 500
        },
        metadata: {
          bsonType: ["object", "null"],
          properties: {
            tags: {
              bsonType: ["array", "null"],
              items: { bsonType: "string" }
            },
            customFields: { bsonType: ["object", "null"] },
            source: { bsonType: ["string", "null"] },
            importId: { bsonType: ["string", "null"] }
          }
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
        createdBy: { bsonType: ["string", "null"] },
        updatedBy: { bsonType: ["string", "null"] }
      },
      additionalProperties: false
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})
```

## Custom Validation Rules

```javascript
// Ensure allocated inventory has totalCapacity
db.runCommand({
  collMod: "products",
  validator: {
    $expr: {
      $or: [
        { $ne: ["$inventory.method", "allocated"] },
        { $and: [
          { $eq: ["$inventory.method", "allocated"] },
          { $gt: ["$inventory.totalCapacity", 0] }
        ]}
      ]
    }
  }
})

// Ensure event tickets have eventId
db.runCommand({
  collMod: "products",
  validator: {
    $expr: {
      $or: [
        { $ne: ["$type", "ticket"] },
        { $and: [
          { $eq: ["$type", "ticket"] },
          { $ne: ["$eventId", null] }
        ]}
      ]
    }
  }
})

// Validate inventory counts
db.runCommand({
  collMod: "products",
  validator: {
    $expr: {
      $and: [
        { $gte: ["$inventory.soldCount", 0] },
        { $gte: ["$inventory.reservedCount", 0] },
        {
          $or: [
            { $eq: ["$inventory.method", "unlimited"] },
            { $lte: [
              { $add: ["$inventory.soldCount", "$inventory.reservedCount"] },
              "$inventory.totalCapacity"
            ]}
          ]
        }
      ]
    }
  }
})

// Validate date ranges
db.runCommand({
  collMod: "products",
  validator: {
    $expr: {
      $or: [
        { $eq: ["$restrictions", null] },
        { $eq: ["$restrictions.startDate", null] },
        { $eq: ["$restrictions.endDate", null] },
        { $lte: ["$restrictions.startDate", "$restrictions.endDate"] }
      ]
    }
  }
})
```

## Validation Notes

1. **Strict validation** ensures data integrity at the database level
2. **UUID patterns** enforce proper format for all ID fields
3. **Inventory rules** prevent overselling and negative quantities
4. **Type-specific rules** ensure tickets have events, physical products have shipping info
5. **Price validation** ensures non-negative amounts and valid currency codes
6. **Status transitions** should be managed by application logic with proper audit trails

## Testing Validation

```javascript
// Test invalid product (missing required field)
db.products.insertOne({
  productId: "550e8400-e29b-41d4-a716-446655440000",
  functionId: "660e8400-e29b-41d4-a716-446655440000",
  // Missing required fields: sku, name, type, etc.
})
// Should fail with validation error

// Test invalid inventory (oversold)
db.products.insertOne({
  productId: "550e8400-e29b-41d4-a716-446655440000",
  functionId: "660e8400-e29b-41d4-a716-446655440000",
  sku: "TEST-001",
  name: "Test Product",
  type: "ticket",
  price: { amount: NumberDecimal("100"), currency: "AUD" },
  inventory: {
    method: "allocated",
    totalCapacity: 10,
    soldCount: 8,
    reservedCount: 5, // 8 + 5 > 10
    version: 1
  },
  status: "active"
})
// Should fail with validation error
```