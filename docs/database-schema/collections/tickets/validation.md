# Tickets Collection - Validation Rules

## MongoDB Schema Validation

```javascript
db.createCollection("tickets", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["ticketNumber", "product", "purchase", "owner", "access", "status"],
      properties: {
        ticketNumber: {
          bsonType: "string",
          pattern: "^TKT-[A-Z0-9]+-[A-Z]+-[0-9]{5}$",
          description: "Ticket number must follow pattern TKT-FUNCTION-EVENT-NNNNN"
        },
        product: {
          bsonType: "object",
          required: ["functionId", "eventId", "productId", "productName", "price"],
          properties: {
            functionId: {
              bsonType: "string",
              pattern: "^[a-z0-9-]+$"
            },
            eventId: {
              bsonType: "string",
              pattern: "^[a-z0-9-]+$"
            },
            eventName: {
              bsonType: "string",
              minLength: 1,
              maxLength: 200
            },
            productId: { bsonType: "objectId" },
            productName: {
              bsonType: "string",
              minLength: 1,
              maxLength: 200
            },
            productCategory: {
              bsonType: "string",
              enum: ["general", "vip", "student", "member", "child", "group"]
            },
            description: { bsonType: ["string", "null"] },
            price: {
              bsonType: "decimal",
              minimum: 0
            },
            features: {
              bsonType: "array",
              items: { bsonType: "string" }
            },
            restrictions: {
              bsonType: "array",
              items: { bsonType: "string" }
            }
          }
        },
        purchase: {
          bsonType: "object",
          required: ["registrationId", "purchaseDate", "paymentStatus"],
          properties: {
            registrationId: { bsonType: "objectId" },
            registrationNumber: {
              bsonType: "string",
              pattern: "^[A-Z0-9]+-REG-[0-9]{5}$"
            },
            purchasedBy: {
              bsonType: "object",
              required: ["type", "id", "name"],
              properties: {
                type: {
                  bsonType: "string",
                  enum: ["organisation", "contact", "user"]
                },
                id: { bsonType: "objectId" },
                name: { bsonType: "string" }
              }
            },
            purchaseDate: { bsonType: "date" },
            paymentStatus: {
              bsonType: "string",
              enum: ["paid", "pending", "refunded"]
            },
            lineItemId: { bsonType: "objectId" },
            pricePaid: {
              bsonType: "decimal",
              minimum: 0
            },
            discount: {
              bsonType: ["object", "null"],
              properties: {
                amount: { bsonType: "decimal", minimum: 0 },
                code: { bsonType: ["string", "null"] },
                percentage: { 
                  bsonType: "number", 
                  minimum: 0,
                  maximum: 100
                }
              }
            },
            refund: {
              bsonType: ["object", "null"],
              properties: {
                amount: { bsonType: "decimal", minimum: 0 },
                date: { bsonType: "date" },
                reason: { bsonType: "string" },
                transactionId: { bsonType: "string" }
              }
            }
          }
        },
        owner: {
          bsonType: "object",
          required: [],
          properties: {
            attendeeId: { bsonType: ["objectId", "null"] }
          },
          description: "Owner object required, attendeeId null means owned by registration"
        },
        transferHistory: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["transferId", "type", "from", "to", "transferDate", "reason"],
            properties: {
              transferId: { bsonType: "objectId" },
              type: {
                bsonType: "string",
                enum: ["assignment", "transfer", "return"]
              },
              from: {
                bsonType: "object",
                required: ["type"],
                properties: {
                  type: {
                    bsonType: "string",
                    enum: ["registration", "attendee"]
                  },
                  attendeeId: { bsonType: ["objectId", "null"] },
                  name: { bsonType: "string" }
                }
              },
              to: {
                bsonType: "object",
                required: ["type"],
                properties: {
                  type: {
                    bsonType: "string",
                    enum: ["attendee", "registration"]
                  },
                  attendeeId: { bsonType: ["objectId", "null"] },
                  name: { bsonType: "string" }
                }
              },
              transferDate: { bsonType: "date" },
              transferredBy: { bsonType: "objectId" },
              reason: {
                bsonType: "string",
                enum: ["initial_assignment", "reassignment", "sold", "gifted", "returned"]
              },
              notes: { bsonType: ["string", "null"] },
              salePrice: { bsonType: ["decimal", "null"], minimum: 0 },
              platform: {
                bsonType: "string",
                enum: ["internal", "external"]
              },
              verificationCode: { bsonType: ["string", "null"] }
            }
          }
        },
        access: {
          bsonType: "object",
          required: ["status"],
          properties: {
            zones: {
              bsonType: "array",
              items: { bsonType: "string" },
              minItems: 1
            },
            gates: {
              bsonType: "array",
              items: { bsonType: "string" }
            },
            validFrom: { bsonType: "date" },
            validUntil: { bsonType: "date" },
            singleUse: { bsonType: "bool" },
            multiEntry: { bsonType: "bool" },
            maxEntries: { bsonType: "int", minimum: 0 },
            entryCount: { bsonType: "int", minimum: 0 },
            status: {
              bsonType: "string",
              enum: ["valid", "used", "expired", "revoked"]
            },
            revokedReason: { bsonType: ["string", "null"] },
            revokedAt: { bsonType: ["date", "null"] },
            revokedBy: { bsonType: ["objectId", "null"] }
          }
        },
        usageHistory: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["usedAt", "location", "method"],
            properties: {
              usedAt: { bsonType: "date" },
              location: {
                bsonType: "object",
                properties: {
                  gate: { bsonType: "string" },
                  scanner: { bsonType: "string" },
                  coordinates: {
                    bsonType: ["object", "null"],
                    properties: {
                      latitude: { 
                        bsonType: "number",
                        minimum: -90,
                        maximum: 90
                      },
                      longitude: { 
                        bsonType: "number",
                        minimum: -180,
                        maximum: 180
                      }
                    }
                  }
                }
              },
              method: {
                bsonType: "string",
                enum: ["qr_scan", "manual", "rfid", "facial"]
              },
              staff: { bsonType: ["objectId", "null"] },
              notes: { bsonType: ["string", "null"] },
              exitAt: { bsonType: ["date", "null"] },
              exitLocation: {
                bsonType: ["object", "null"],
                properties: {
                  gate: { bsonType: "string" },
                  scanner: { bsonType: "string" }
                }
              }
            }
          }
        },
        delivery: {
          bsonType: "object",
          required: ["method", "status"],
          properties: {
            method: {
              bsonType: "string",
              enum: ["digital", "physical", "will_call"]
            },
            status: {
              bsonType: "string",
              enum: ["pending", "sent", "delivered", "collected", "failed"]
            },
            digital: {
              bsonType: ["object", "null"],
              properties: {
                sentAt: { bsonType: ["date", "null"] },
                email: {
                  bsonType: "string",
                  pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                },
                downloadCount: { bsonType: "int", minimum: 0 },
                lastDownloadAt: { bsonType: ["date", "null"] }
              }
            },
            physical: {
              bsonType: ["object", "null"],
              properties: {
                shippedAt: { bsonType: ["date", "null"] },
                carrier: { bsonType: ["string", "null"] },
                trackingNumber: { bsonType: ["string", "null"] },
                deliveredAt: { bsonType: ["date", "null"] },
                signature: { bsonType: ["string", "null"] }
              }
            },
            willCall: {
              bsonType: ["object", "null"],
              properties: {
                booth: { bsonType: ["string", "null"] },
                collectedAt: { bsonType: ["date", "null"] },
                collectedBy: {
                  bsonType: ["object", "null"],
                  properties: {
                    name: { bsonType: "string" },
                    idVerified: { bsonType: "bool" },
                    idType: { bsonType: ["string", "null"] },
                    notes: { bsonType: ["string", "null"] }
                  }
                }
              }
            }
          }
        },
        seat: {
          bsonType: ["object", "null"],
          properties: {
            section: { bsonType: ["string", "null"] },
            row: { bsonType: ["string", "null"] },
            number: { bsonType: ["string", "null"] },
            accessibility: { bsonType: "bool" },
            assigned: { bsonType: "bool" },
            assignedAt: { bsonType: ["date", "null"] },
            preferences: {
              bsonType: ["object", "null"],
              properties: {
                zone: { bsonType: ["string", "null"] },
                companions: {
                  bsonType: "array",
                  items: { bsonType: "string" }
                }
              }
            }
          }
        },
        addOns: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              type: { bsonType: "string" },
              description: { bsonType: "string" },
              value: { bsonType: "decimal", minimum: 0 },
              status: {
                bsonType: "string",
                enum: ["active", "redeemed", "expired"]
              },
              redeemedAt: { bsonType: ["date", "null"] }
            }
          }
        },
        security: {
          bsonType: "object",
          required: ["barcode", "qrData"],
          properties: {
            barcode: {
              bsonType: "string",
              minLength: 12
            },
            qrData: {
              bsonType: "string",
              minLength: 16
            },
            securityCode: {
              bsonType: "string",
              minLength: 6
            },
            ipAddress: {
              bsonType: ["string", "null"],
              pattern: "^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$"
            },
            deviceFingerprint: { bsonType: ["string", "null"] },
            riskScore: {
              bsonType: "number",
              minimum: 0,
              maximum: 1
            },
            verified: { bsonType: "bool" },
            verifiedAt: { bsonType: ["date", "null"] },
            verificationMethod: { bsonType: ["string", "null"] }
          }
        },
        status: {
          bsonType: "string",
          enum: ["active", "transferred", "cancelled", "expired"]
        },
        customFields: { bsonType: ["object", "null"] },
        metadata: {
          bsonType: "object",
          required: ["createdAt", "updatedAt"],
          properties: {
            createdAt: { bsonType: "date" },
            createdBy: { bsonType: ["objectId", "null"] },
            updatedAt: { bsonType: "date" },
            updatedBy: { bsonType: ["objectId", "null"] },
            version: { bsonType: "int", minimum: 1 },
            source: {
              bsonType: "string",
              enum: ["purchase", "import", "conversion", "manual"]
            },
            importBatch: { bsonType: ["string", "null"] },
            migrationId: { bsonType: ["string", "null"] }
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

### 1. Access Date Validation
```javascript
// Ensure validity dates are logical
function validateAccessDates(access) {
  return access.validFrom < access.validUntil;
}

// Validate entry count doesn't exceed max
function validateEntryCount(access) {
  if (access.maxEntries > 0) {
    return access.entryCount <= access.maxEntries;
  }
  return true;
}
```

### 2. Transfer Chain Validation
```javascript
// Ensure transfer history is chronological
function validateTransferHistory(transfers) {
  for (let i = 1; i < transfers.length; i++) {
    if (transfers[i].transferDate <= transfers[i-1].transferDate) {
      return false;
    }
  }
  return true;
}

// Validate current owner matches last transfer
function validateOwnership(owner, transferHistory) {
  if (transferHistory.length > 0) {
    const lastTransfer = transferHistory[transferHistory.length - 1];
    // If last transfer was to attendee, owner.attendeeId should match
    if (lastTransfer.to.type === 'attendee') {
      return owner.attendeeId?.equals(lastTransfer.to.attendeeId);
    }
    // If last transfer was to registration, owner.attendeeId should be null
    if (lastTransfer.to.type === 'registration') {
      return owner.attendeeId === null;
    }
  }
  return true;
}
```

### 3. Usage Validation
```javascript
// Single-use tickets can only have one usage
function validateSingleUseTicket(access, usageHistory) {
  if (access.singleUse && usageHistory.length > 1) {
    return false;
  }
  return true;
}

// Exit time must be after entry time
function validateUsageTimes(usageHistory) {
  return usageHistory.every(usage => {
    if (usage.exitAt) {
      return usage.usedAt < usage.exitAt;
    }
    return true;
  });
}
```

### 4. Status Consistency
```javascript
// Validate status matches actual state
function validateTicketStatus(ticket) {
  const now = new Date();
  
  // Check if expired
  if (ticket.access.validUntil < now && ticket.status !== 'expired') {
    return false;
  }
  
  // Check if revoked
  if (ticket.access.status === 'revoked' && ticket.status !== 'cancelled') {
    return false;
  }
  
  // Check if used (for single-use)
  if (ticket.access.singleUse && 
      ticket.access.status === 'used' && 
      ticket.status === 'active') {
    return false;
  }
  
  return true;
}
```

## Business Rules

1. **Unique Identifiers**: Barcode and QR data must be cryptographically unique
2. **Transfer Limits**: Some tickets may be non-transferable
3. **Price Validation**: Refund amount cannot exceed price paid
4. **Gate Access**: Tickets must have at least one valid access zone
5. **Delivery Method**: Physical tickets require shipping address
6. **Age Restrictions**: Validate attendee age for restricted events
7. **Capacity Limits**: Cannot create more tickets than product inventory
8. **Time Windows**: Tickets can only be scanned during valid periods
9. **Security Codes**: Must be generated using secure random methods

## Pre-save Validation Hook

```javascript
// Example pre-save validation in application
async function validateTicket(ticket) {
  // Run all validation rules
  const validations = [
    validateAccessDates(ticket.access),
    validateEntryCount(ticket.access),
    validateTransferHistory(ticket.transferHistory || []),
    validateOwnership(ticket.owner, ticket.transferHistory || []),
    validateSingleUseTicket(ticket.access, ticket.usageHistory || []),
    validateUsageTimes(ticket.usageHistory || []),
    validateTicketStatus(ticket)
  ];
  
  if (!validations.every(v => v)) {
    throw new Error('Ticket validation failed');
  }
  
  // Verify registration exists
  const registration = await db.registrations.findOne({
    _id: ticket.purchase.registrationId
  });
  
  if (!registration) {
    throw new Error('Invalid registration reference');
  }
  
  // Verify product exists and has inventory
  const function = await db.functions.findOne({
    functionId: ticket.product.functionId,
    "events.event_id": ticket.product.eventId,
    "events.products._id": ticket.product.productId
  });
  
  if (!function) {
    throw new Error('Invalid product reference');
  }
  
  // Check for duplicate barcode/QR
  if (!ticket._id) { // New ticket
    const duplicate = await db.tickets.findOne({
      $or: [
        { "security.barcode": ticket.security.barcode },
        { "security.qrData": ticket.security.qrData }
      ]
    });
    
    if (duplicate) {
      throw new Error('Duplicate security code detected');
    }
  }
  
  return true;
}
```

## Security Validations

1. **Barcode Format**: Must follow secure generation pattern
2. **QR Encryption**: Data must be properly encrypted
3. **Transfer Verification**: Codes must be single-use
4. **Risk Assessment**: High-risk tickets require manual review
5. **Location Tracking**: GPS coordinates must be valid ranges