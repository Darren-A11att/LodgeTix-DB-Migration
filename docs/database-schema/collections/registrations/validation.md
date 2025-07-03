# Registrations Collection - Validation Rules

## MongoDB Schema Validation

```javascript
db.createCollection("registrations", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["registrationNumber", "functionId", "type", "registrant", "purchase", "status"],
      properties: {
        registrationNumber: {
          bsonType: "string",
          pattern: "^[A-Z0-9]+-REG-[0-9]{5}$",
          description: "Registration number must follow pattern FUNCTION-REG-NNNNN"
        },
        functionId: {
          bsonType: "string",
          pattern: "^[a-z0-9-]+$",
          description: "Must be valid function ID"
        },
        type: {
          bsonType: "string",
          enum: ["individual", "lodge", "delegation"],
          description: "Registration type must be valid"
        },
        registrant: {
          bsonType: "object",
          required: ["type", "name"],
          properties: {
            type: {
              bsonType: "string",
              enum: ["contact", "organisation"]
            },
            contactId: { 
              bsonType: ["objectId", "null"],
              description: "Required when type is contact"
            },
            organisationId: { 
              bsonType: ["objectId", "null"],
              description: "Required when type is organisation"
            },
            userId: { 
              bsonType: ["objectId", "null"],
              description: "User account that made the purchase"
            },
            name: {
              bsonType: "string",
              minLength: 1,
              maxLength: 200
            },
            email: {
              bsonType: "string",
              pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
            },
            phone: {
              bsonType: ["string", "null"],
              pattern: "^\\+?[0-9\\s-()]+$"
            },
            abn: {
              bsonType: ["string", "null"],
              pattern: "^[0-9]{11}$"
            },
            lodgeNumber: {
              bsonType: ["string", "null"]
            }
          }
        },
        purchase: {
          bsonType: "object",
          required: ["items", "subtotal", "total"],
          properties: {
            items: {
              bsonType: "array",
              minItems: 1,
              items: {
                bsonType: "object",
                required: ["lineItemId", "productId", "productType", "name", "quantity", "unitPrice", "total"],
                properties: {
                  lineItemId: { bsonType: "objectId" },
                  productId: { bsonType: "objectId" },
                  productType: {
                    bsonType: "string",
                    enum: ["ticket", "merchandise", "accommodation", "donation", "sponsorship"]
                  },
                  eventId: { bsonType: ["string", "null"] },
                  eventName: { bsonType: ["string", "null"] },
                  name: { bsonType: "string" },
                  description: { bsonType: ["string", "null"] },
                  quantity: {
                    bsonType: "int",
                    minimum: 1,
                    maximum: 1000
                  },
                  unitPrice: {
                    bsonType: "decimal",
                    minimum: 0
                  },
                  discount: {
                    bsonType: ["object", "null"],
                    properties: {
                      amount: { bsonType: "decimal", minimum: 0 },
                      percentage: { bsonType: "number", minimum: 0, maximum: 100 },
                      code: { bsonType: ["string", "null"] }
                    }
                  },
                  tax: {
                    bsonType: "object",
                    properties: {
                      rate: { bsonType: "number", minimum: 0, maximum: 1 },
                      amount: { bsonType: "decimal", minimum: 0 }
                    }
                  },
                  total: {
                    bsonType: "decimal",
                    minimum: 0
                  },
                  ticketIds: {
                    bsonType: "array",
                    items: { bsonType: "objectId" }
                  },
                  fulfillment: {
                    bsonType: ["object", "null"],
                    properties: {
                      method: {
                        bsonType: "string",
                        enum: ["digital", "shipping", "pickup"]
                      },
                      status: {
                        bsonType: "string",
                        enum: ["pending", "processing", "shipped", "delivered", "cancelled"]
                      },
                      trackingNumber: { bsonType: ["string", "null"] },
                      shippingAddress: {
                        bsonType: ["object", "null"],
                        properties: {
                          name: { bsonType: "string" },
                          addressLine1: { bsonType: "string" },
                          addressLine2: { bsonType: ["string", "null"] },
                          city: { bsonType: "string" },
                          state: { bsonType: "string" },
                          postcode: { bsonType: "string" },
                          country: { bsonType: "string" }
                        }
                      }
                    }
                  }
                }
              }
            },
            subtotal: { bsonType: "decimal", minimum: 0 },
            discountTotal: { bsonType: "decimal", minimum: 0 },
            taxTotal: { bsonType: "decimal", minimum: 0 },
            shippingTotal: { bsonType: "decimal", minimum: 0 },
            fees: { bsonType: "decimal", minimum: 0 },
            total: { bsonType: "decimal", minimum: 0 }
          }
        },
        payment: {
          bsonType: ["object", "null"],
          properties: {
            method: {
              bsonType: "string",
              enum: ["credit_card", "debit_card", "bank_transfer", "invoice", "cash", "cheque"]
            },
            gateway: {
              bsonType: ["string", "null"],
              enum: ["stripe", "square", "manual", null]
            },
            transactionId: { bsonType: ["string", "null"] },
            status: {
              bsonType: "string",
              enum: ["pending", "processing", "paid", "failed", "refunded"]
            },
            paidAt: { bsonType: ["date", "null"] },
            invoiceTerms: {
              bsonType: ["object", "null"],
              properties: {
                dueDate: { bsonType: "date" },
                terms: {
                  bsonType: "string",
                  enum: ["immediate", "net15", "net30", "net60", "net90"]
                }
              }
            }
          }
        },
        attendeeIds: {
          bsonType: "array",
          items: { bsonType: "objectId" }
        },
        attendeeAllocation: {
          bsonType: ["object", "null"],
          properties: {
            total: { bsonType: "int", minimum: 0 },
            assigned: { bsonType: "int", minimum: 0 },
            unassigned: { bsonType: "int", minimum: 0 }
          }
        },
        status: {
          bsonType: "string",
          enum: ["pending", "partial", "complete", "cancelled"]
        },
        cancellation: {
          bsonType: ["object", "null"],
          properties: {
            cancelledAt: { bsonType: "date" },
            cancelledBy: { bsonType: "objectId" },
            reason: { bsonType: "string" },
            refundAmount: { bsonType: "decimal" },
            refundTransactionId: { bsonType: "objectId" }
          }
        },
        financialTransactionId: { bsonType: ["objectId", "null"] },
        invoiceId: { bsonType: ["objectId", "null"] },
        communications: {
          bsonType: ["object", "null"],
          properties: {
            confirmationSent: { bsonType: "bool" },
            confirmationSentAt: { bsonType: ["date", "null"] },
            remindersSent: { bsonType: "int", minimum: 0 },
            lastReminderAt: { bsonType: ["date", "null"] }
          }
        },
        customFields: {
          bsonType: ["object", "null"],
          properties: {
            specialRequests: { bsonType: ["string", "null"] },
            internalNotes: { bsonType: ["string", "null"] },
            referralSource: { bsonType: ["string", "null"] },
            marketingConsent: { bsonType: ["bool", "null"] }
          }
        },
        metadata: {
          bsonType: "object",
          required: ["createdAt", "updatedAt"],
          properties: {
            source: {
              bsonType: "string",
              enum: ["web", "admin", "import", "api", "phone"]
            },
            ipAddress: { bsonType: ["string", "null"] },
            userAgent: { bsonType: ["string", "null"] },
            sessionId: { bsonType: ["string", "null"] },
            affiliateCode: { bsonType: ["string", "null"] },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
            version: { bsonType: "int", minimum: 1 }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})
```

## Custom Validation Rules

### 1. Total Calculation Validation
```javascript
// Ensure purchase total equals calculated sum
function validatePurchaseTotal(registration) {
  const calculatedTotal = registration.purchase.subtotal
    - registration.purchase.discountTotal
    + registration.purchase.taxTotal
    + registration.purchase.shippingTotal
    + registration.purchase.fees;
  
  return Math.abs(calculatedTotal - registration.purchase.total) < 0.01;
}
```

### 2. Line Item Total Validation
```javascript
// Ensure each line item total is correct
function validateLineItemTotals(items) {
  return items.every(item => {
    const baseAmount = item.quantity * item.unitPrice;
    const discountAmount = item.discount?.amount || 0;
    const taxAmount = item.tax?.amount || 0;
    const calculatedTotal = baseAmount - discountAmount + taxAmount;
    
    return Math.abs(calculatedTotal - item.total) < 0.01;
  });
}
```

### 3. Attendee Allocation Validation
```javascript
// Ensure attendee allocation numbers are consistent
function validateAttendeeAllocation(registration) {
  if (!registration.attendeeAllocation) return true;
  
  const { total, assigned, unassigned } = registration.attendeeAllocation;
  return total === assigned + unassigned;
}
```

### 4. Status Consistency Validation
```javascript
// Ensure status is consistent with data
function validateStatusConsistency(registration) {
  // If cancelled, must have cancellation details
  if (registration.status === 'cancelled' && !registration.cancellation) {
    return false;
  }
  
  // If complete, all attendees must be assigned
  if (registration.status === 'complete' && 
      registration.attendeeAllocation?.unassigned > 0) {
    return false;
  }
  
  // If paid, payment must be successful
  if (registration.payment?.status === 'paid' && 
      registration.status === 'pending') {
    return false;
  }
  
  return true;
}
```

## Business Rules

1. **Registration Number**: Must be unique and follow pattern
2. **Minimum Order**: At least one item required
3. **Ticket Limits**: Quantity cannot exceed product inventory
4. **Lodge Registrations**: Must have organisation as registrant
5. **Individual Registrations**: Should have immediate attendee assignment
6. **Discounts**: Cannot exceed 100% of order value
7. **Tax Calculation**: Must follow regional tax rules
8. **Payment Status**: Can only transition in valid directions
9. **Cancellations**: Cannot cancel after event date

## Pre-save Validation Hook

```javascript
// Example pre-save validation in application
async function validateRegistration(registration) {
  // Check all validation rules
  const validations = [
    validatePurchaseTotal(registration),
    validateLineItemTotals(registration.purchase.items),
    validateAttendeeAllocation(registration),
    validateStatusConsistency(registration)
  ];
  
  if (!validations.every(v => v)) {
    throw new Error('Registration validation failed');
  }
  
  // Check inventory availability
  for (const item of registration.purchase.items) {
    if (item.productType === 'ticket') {
      const available = await checkProductAvailability(
        item.productId, 
        item.quantity
      );
      if (!available) {
        throw new Error(`Insufficient inventory for ${item.name}`);
      }
    }
  }
  
  return true;
}
```