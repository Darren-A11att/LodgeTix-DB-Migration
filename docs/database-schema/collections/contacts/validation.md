# Contacts Collection Validation

## MongoDB Schema Validation Rules

```javascript
db.createCollection("contacts", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["contactId", "firstName", "lastName"],
      properties: {
        _id: {
          bsonType: "objectId"
        },
        contactId: {
          bsonType: "string",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "Must be a valid UUID v4"
        },
        firstName: {
          bsonType: "string",
          minLength: 1,
          maxLength: 100,
          description: "First name is required"
        },
        lastName: {
          bsonType: "string",
          minLength: 1,
          maxLength: 100,
          description: "Last name is required"
        },
        preferredName: {
          bsonType: ["string", "null"],
          maxLength: 100,
          description: "Optional preferred name"
        },
        title: {
          bsonType: ["string", "null"],
          maxLength: 20,
          description: "Honorific title (Mr, Mrs, Ms, Dr, etc.)"
        },
        email: {
          bsonType: ["string", "null"],
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "Must be a valid email address"
        },
        phone: {
          bsonType: ["string", "null"],
          pattern: "^\\+[1-9]\\d{1,14}$",
          description: "E.164 format phone number"
        },
        mobile: {
          bsonType: ["string", "null"],
          pattern: "^\\+[1-9]\\d{1,14}$",
          description: "E.164 format mobile number"
        },
        alternatePhone: {
          bsonType: ["string", "null"],
          pattern: "^\\+[1-9]\\d{1,14}$",
          description: "E.164 format alternate phone"
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
              maxLength: 100
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
          required: ["line1", "city", "state", "postcode", "country"],
          additionalProperties: false
        },
        masonicProfile: {
          bsonType: ["object", "null"],
          properties: {
            isMason: {
              bsonType: "bool"
            },
            title: {
              bsonType: ["string", "null"],
              maxLength: 50,
              description: "Masonic title (WBro, VWBro, etc.)"
            },
            rank: {
              bsonType: ["string", "null"],
              maxLength: 50,
              description: "Masonic rank (EA, FC, MM, PM, etc.)"
            },
            grandRank: {
              bsonType: ["string", "null"],
              maxLength: 50,
              description: "Grand Lodge rank"
            },
            grandOffice: {
              bsonType: ["string", "null"],
              maxLength: 100,
              description: "Current Grand Office held"
            },
            grandOfficer: {
              bsonType: ["bool", "null"]
            },
            grandLodgeId: {
              bsonType: ["string", "null"],
              pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
            },
            grandLodgeName: {
              bsonType: ["string", "null"],
              maxLength: 200
            },
            lodgeId: {
              bsonType: ["string", "null"],
              pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
            },
            lodgeName: {
              bsonType: ["string", "null"],
              maxLength: 200
            },
            lodgeNumber: {
              bsonType: ["string", "null"],
              maxLength: 20
            }
          },
          additionalProperties: false
        },
        registrations: {
          bsonType: ["object", "null"],
          description: "Map of registration ID to participation details",
          patternProperties: {
            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$": {
              bsonType: "object",
              required: ["role", "functionId"],
              properties: {
                role: {
                  bsonType: "string",
                  enum: ["attendee", "bookingContact", "billingContact"],
                  description: "Role in this registration"
                },
                functionId: {
                  bsonType: "string",
                  pattern: "^[0-9a-f]{24}$"
                },
                functionName: {
                  bsonType: ["string", "null"],
                  maxLength: 200
                },
                eventId: {
                  bsonType: ["string", "null"]
                },
                eventName: {
                  bsonType: ["string", "null"],
                  maxLength: 200
                },
                tableNumber: {
                  bsonType: ["string", "null"],
                  maxLength: 20
                },
                seatNumber: {
                  bsonType: ["string", "null"],
                  maxLength: 20
                },
                registeredAt: {
                  bsonType: ["date", "null"]
                },
                registeredBy: {
                  bsonType: ["string", "null"],
                  pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
                },
                bookingsManaged: {
                  bsonType: ["number", "null"],
                  minimum: 0
                }
              },
              additionalProperties: false
            }
          }
        },
        organizations: {
          bsonType: ["object", "null"],
          description: "Map of organization ID to role details",
          patternProperties: {
            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$": {
              bsonType: "object",
              required: ["organizationName", "role"],
              properties: {
                organizationName: {
                  bsonType: "string",
                  maxLength: 200
                },
                role: {
                  bsonType: "string",
                  maxLength: 100,
                  description: "Role in organization"
                },
                startDate: {
                  bsonType: ["date", "null"]
                },
                endDate: {
                  bsonType: ["date", "null"]
                },
                isCurrent: {
                  bsonType: ["bool", "null"]
                }
              },
              additionalProperties: false
            }
          }
        },
        hosting: {
          bsonType: ["object", "null"],
          description: "Map of function ID to host details",
          patternProperties: {
            "^[0-9a-f]{24}$": {
              bsonType: "object",
              required: ["functionName", "role"],
              properties: {
                functionName: {
                  bsonType: "string",
                  maxLength: 200
                },
                role: {
                  bsonType: "string",
                  enum: ["organizer", "coordinator", "host"],
                  description: "Host role"
                },
                startDate: {
                  bsonType: ["date", "null"]
                },
                responsibilities: {
                  bsonType: ["array", "null"],
                  items: {
                    bsonType: "string"
                  }
                }
              },
              additionalProperties: false
            }
          }
        },
        relationships: {
          bsonType: ["object", "null"],
          properties: {
            partners: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "object",
                required: ["contactId", "relationshipType", "name"],
                properties: {
                  contactId: {
                    bsonType: "string",
                    pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
                  },
                  relationshipType: {
                    bsonType: "string",
                    enum: ["spouse", "partner", "child", "parent", "sibling", "other"]
                  },
                  name: {
                    bsonType: "string",
                    maxLength: 200
                  },
                  isPrimary: {
                    bsonType: ["bool", "null"]
                  }
                },
                additionalProperties: false
              }
            },
            emergencyContacts: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "object",
                required: ["name", "relationship", "phone"],
                properties: {
                  contactId: {
                    bsonType: ["string", "null"],
                    pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
                  },
                  name: {
                    bsonType: "string",
                    maxLength: 200
                  },
                  relationship: {
                    bsonType: "string",
                    maxLength: 100
                  },
                  phone: {
                    bsonType: "string",
                    pattern: "^\\+[1-9]\\d{1,14}$"
                  }
                },
                additionalProperties: false
              }
            }
          },
          additionalProperties: false
        },
        profile: {
          bsonType: ["object", "null"],
          properties: {
            dateOfBirth: {
              bsonType: ["date", "null"]
            },
            dietaryRequirements: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "string"
              }
            },
            specialNeeds: {
              bsonType: ["string", "null"],
              maxLength: 500
            },
            preferredCommunication: {
              bsonType: ["string", "null"],
              enum: ["email", "sms", "phone", "post", null]
            }
          },
          additionalProperties: false
        },
        hasUserAccount: {
          bsonType: "bool",
          description: "Whether contact has a user account"
        },
        isActive: {
          bsonType: "bool",
          description: "Whether contact is active"
        },
        tags: {
          bsonType: ["array", "null"],
          items: {
            bsonType: "string",
            maxLength: 50
          }
        },
        source: {
          bsonType: ["string", "null"],
          enum: ["attendee", "registration", "import", "manual", null]
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

## Custom Validation Rules

### 1. Contact Method Requirement
```javascript
// At least one contact method (email or phone) must be present
function validateContactMethod(contact) {
  if (!contact.email && !contact.phone && !contact.mobile) {
    throw new Error("At least one contact method (email, phone, or mobile) is required");
  }
}
```

### 2. Date Validation for Context Objects
```javascript
// Ensure dates are logical in organizations
function validateOrganizationDates(org) {
  if (org.endDate && org.startDate && org.endDate < org.startDate) {
    throw new Error("Organization end date cannot be before start date");
  }
  if (org.isCurrent && org.endDate && org.endDate < new Date()) {
    throw new Error("Organization cannot be current with past end date");
  }
}
```

### 3. No Self-Relationships
```javascript
// Contacts cannot have relationships with themselves
function validateRelationships(contactId, relationships) {
  if (relationships && relationships.partners) {
    relationships.partners.forEach(rel => {
      if (rel.contactId === contactId) {
        throw new Error("Contact cannot have relationship with itself");
      }
    });
  }
}
```

### 4. Phone Number Normalization
```javascript
// Normalize phone numbers to E.164 format
function normalizePhoneNumber(phone, defaultCountryCode = '+61') {
  if (!phone) return null;
  
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  
  // Add country code if missing
  if (!phone.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = defaultCountryCode.replace('+', '') + cleaned;
  }
  
  return '+' + cleaned;
}
```

### 5. Email Deduplication Check
```javascript
// Check if email already exists (for deduplication)
async function checkEmailUniqueness(email, excludeContactId) {
  if (!email) return true;
  
  const query = { email: email.toLowerCase() };
  if (excludeContactId) {
    query._id = { $ne: excludeContactId };
  }
  
  const existing = await db.contacts.findOne(query);
  return !existing;
}
```

### 6. Phone Deduplication Check
```javascript
// Check if phone already exists (for deduplication)
async function checkPhoneUniqueness(phone, excludeContactId) {
  if (!phone) return true;
  
  const normalized = normalizePhoneNumber(phone);
  const query = { 
    $or: [
      { phone: normalized },
      { mobile: normalized }
    ]
  };
  
  if (excludeContactId) {
    query._id = { $ne: excludeContactId };
  }
  
  const existing = await db.contacts.findOne(query);
  return !existing;
}
```

### 7. Booking/Billing Contact User Requirement
```javascript
// Ensure booking and billing contacts have user accounts
function validateUserRequirement(contact) {
  if (!contact.hasUserAccount && contact.registrations) {
    for (const [regId, reg] of Object.entries(contact.registrations)) {
      if (reg.role === 'bookingContact' || reg.role === 'billingContact') {
        throw new Error(`${reg.role} must have a user account`);
      }
    }
  }
}
```

## Business Rules

### Data Quality
1. Names must be trimmed of leading/trailing whitespace
2. Email addresses stored in lowercase
3. Phone numbers normalized to E.164 format
4. At least one contact method required (email or phone)

### Deduplication
1. Check existing contacts by email (case-insensitive)
2. Check existing contacts by phone (normalized)
3. Merge data instead of creating duplicates
4. Keep most recent contact information

### User Account Requirements
1. Booking contacts MUST have user accounts
2. Billing contacts MUST have user accounts
3. Organization representatives should have user accounts
4. Event hosts should have user accounts

### Masonic Profile
1. If isMason is true, should have lodge details
2. Grand officers should have grandLodgeId
3. Lodge number extracted from lodge name if possible

## Migration Validation

### Pre-Migration Checks
```javascript
// Validate data before migrating from legacy collections
async function validateMigrationData(sourceData) {
  const errors = [];
  
  // Check required fields
  if (!sourceData.firstName || !sourceData.lastName) {
    errors.push("Missing required name fields");
  }
  
  // Check contact method
  if (!sourceData.email && !sourceData.phone) {
    errors.push("No contact method available");
  }
  
  // Validate email format if present
  if (sourceData.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(sourceData.email)) {
    errors.push("Invalid email format");
  }
  
  return errors;
}
```

### Post-Migration Validation
```javascript
// Verify migrated contacts
async function validateMigratedContacts() {
  const issues = await db.contacts.aggregate([
    {
      $project: {
        contactId: 1,
        hasEmail: { $ne: ["$email", null] },
        hasPhone: { $or: [
          { $ne: ["$phone", null] },
          { $ne: ["$mobile", null] }
        ]},
        hasContactMethod: {
          $or: [
            { $ne: ["$email", null] },
            { $ne: ["$phone", null] },
            { $ne: ["$mobile", null] }
          ]
        },
        validContactId: {
          $regexMatch: {
            input: "$contactId",
            regex: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
          }
        },
        hasUserWhenRequired: {
          $or: [
            { $eq: ["$hasUserAccount", true] },
            { $not: { $in: ["bookingContact", "$registrations.role"] } },
            { $not: { $in: ["billingContact", "$registrations.role"] } }
          ]
        }
      }
    },
    {
      $match: {
        $or: [
          { hasContactMethod: false },
          { validContactId: false },
          { hasUserWhenRequired: false }
        ]
      }
    }
  ]).toArray();
  
  return issues;
}
```