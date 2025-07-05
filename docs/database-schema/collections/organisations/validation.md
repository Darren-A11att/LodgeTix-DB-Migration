# Organizations Collection Validation

## MongoDB Schema Validation

```javascript
db.createCollection("organizations", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["organizationId", "name", "type", "status", "contactEmail"],
      properties: {
        _id: {
          bsonType: "objectId"
        },
        organizationId: {
          bsonType: "string",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "Must be a valid UUID"
        },
        name: {
          bsonType: "string",
          minLength: 1,
          maxLength: 200,
          description: "Organization name"
        },
        type: {
          bsonType: "string",
          enum: ["lodge", "grandlodge", "charity", "venue", "caterer", "sponsor", "other"],
          description: "Organization type"
        },
        status: {
          bsonType: "string",
          enum: ["active", "inactive", "suspended"],
          description: "Organization status"
        },
        abn: {
          bsonType: ["string", "null"],
          pattern: "^[0-9]{11}$",
          description: "Australian Business Number"
        },
        gstRegistered: {
          bsonType: "boolean"
        },
        charityNumber: {
          bsonType: ["string", "null"],
          maxLength: 50
        },
        contactName: {
          bsonType: ["string", "null"],
          maxLength: 100
        },
        contactRole: {
          bsonType: ["string", "null"],
          maxLength: 50
        },
        contactEmail: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "Valid email required"
        },
        contactPhone: {
          bsonType: ["string", "null"],
          pattern: "^\\+?[0-9\\s-()]+$",
          maxLength: 30
        },
        billingEmail: {
          bsonType: ["string", "null"],
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
        },
        billingPhone: {
          bsonType: ["string", "null"],
          pattern: "^\\+?[0-9\\s-()]+$",
          maxLength: 30
        },
        address: {
          bsonType: ["object", "null"],
          properties: {
            line1: {
              bsonType: "string",
              maxLength: 200
            },
            line2: {
              bsonType: ["string", "null"],
              maxLength: 200
            },
            city: {
              bsonType: "string",
              maxLength: 100
            },
            state: {
              bsonType: "string",
              maxLength: 50
            },
            postcode: {
              bsonType: "string",
              maxLength: 20
            },
            country: {
              bsonType: "string",
              maxLength: 100
            }
          },
          required: ["line1", "city", "state", "postcode", "country"]
        },
        jurisdictionId: {
          bsonType: ["string", "null"],
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "Links to jurisdiction for masonic orgs"
        },
        lodgeId: {
          bsonType: ["string", "null"],
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "Links to lodge record if type=lodge"
        },
        paymentTerms: {
          bsonType: ["string", "null"],
          enum: ["immediate", "net14", "net30", "net60", null],
          description: "Payment terms"
        },
        preferredPaymentMethod: {
          bsonType: ["string", "null"],
          enum: ["invoice", "card", "bank", null],
          description: "Preferred payment method"
        },
        purchaseOrderRequired: {
          bsonType: "boolean"
        },
        stripeAccountId: {
          bsonType: ["string", "null"],
          pattern: "^acct_[a-zA-Z0-9]+$",
          description: "Stripe Connect account ID"
        },
        stripeAccountStatus: {
          bsonType: ["string", "null"],
          enum: ["connected", "pending", "inactive", null]
        },
        stripePayoutsEnabled: {
          bsonType: ["boolean", "null"]
        },
        stripeDetailsSubmitted: {
          bsonType: ["boolean", "null"]
        },
        eventStats: {
          bsonType: ["object", "null"],
          properties: {
            eventsHosted: {
              bsonType: "number",
              minimum: 0
            },
            ticketsPurchased: {
              bsonType: "number",
              minimum: 0
            },
            lastPurchaseDate: {
              bsonType: ["date", "null"]
            },
            totalSpent: {
              bsonType: "number",
              minimum: 0
            }
          }
        },
        createdAt: {
          bsonType: "date"
        },
        updatedAt: {
          bsonType: "date"
        },
        createdBy: {
          bsonType: ["string", "null"]
        },
        updatedBy: {
          bsonType: ["string", "null"]
        }
      },
      additionalProperties: false
    }
  },
  validationLevel: "moderate",
  validationAction: "error"
})
```

## Validation Rules

### Required Fields
1. `organizationId` - Must be a valid UUID
2. `name` - Organization name (1-200 chars)
3. `type` - Must be one of the allowed types
4. `status` - Must be active/inactive/suspended
5. `contactEmail` - Valid email format required

### Business Rules
1. If `type` is "lodge", should have `jurisdictionId` and `lodgeId`
2. If `type` is "grandlodge", should have matching `jurisdictionId`
3. If `gstRegistered` is true, `abn` should be provided
4. If `stripeAccountStatus` is "connected", `stripeAccountId` must exist
5. `billingEmail` defaults to `contactEmail` if not specified

### ABN Validation (Application Level)
```javascript
function validateABN(abn) {
  if (!abn || abn.length !== 11) return false;
  if (!/^\d{11}$/.test(abn)) return false;
  
  // ABN checksum validation
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = abn.split('').map(Number);
  digits[0] -= 1;
  
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }
  
  return sum % 89 === 0;
}
```

## Data Integrity
1. Organization names should be unique within same type
2. ABN should be unique across all organizations
3. Lodge organizations must reference valid lodges
4. Stripe account IDs must be unique