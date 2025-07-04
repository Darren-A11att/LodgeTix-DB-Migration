# Contacts Collection Validation

## MongoDB Schema Validation Rules

```javascript
db.createCollection("contacts", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["contactNumber", "profile", "metadata"],
      properties: {
        _id: {
          bsonType: "objectId"
        },
        contactNumber: {
          bsonType: "string",
          pattern: "^CON-[0-9]{4}-[0-9]{5}$",
          description: "Must be a valid contact number in format CON-YYYY-NNNNN"
        },
        profile: {
          bsonType: "object",
          required: ["firstName", "lastName"],
          properties: {
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
            email: {
              bsonType: ["string", "null"],
              pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
              description: "Must be a valid email address"
            },
            phone: {
              bsonType: ["string", "null"],
              description: "Phone number"
            },
            dateOfBirth: {
              bsonType: ["date", "null"],
              description: "Date of birth for age verification"
            },
            dietaryRequirements: {
              bsonType: ["string", "null"],
              maxLength: 500,
              description: "Dietary requirements as free text"
            },
            specialNeeds: {
              bsonType: ["string", "null"],
              maxLength: 500,
              description: "Special needs as free text"
            }
          },
          additionalProperties: false
        },
        addresses: {
          bsonType: ["array", "null"],
          items: {
            bsonType: "object",
            required: ["type"],
            properties: {
              type: {
                bsonType: "string",
                description: "Address type (e.g., billing, shipping)"
              },
              addressLine1: {
                bsonType: ["string", "null"],
                maxLength: 200
              },
              addressLine2: {
                bsonType: ["string", "null"],
                maxLength: 200
              },
              city: {
                bsonType: ["string", "null"],
                maxLength: 100
              },
              state: {
                bsonType: ["string", "null"],
                maxLength: 100
              },
              postcode: {
                bsonType: ["string", "null"],
                maxLength: 20
              },
              country: {
                bsonType: ["string", "null"],
                maxLength: 100
              },
              isPrimary: {
                bsonType: ["bool", "null"],
                description: "Whether this is the primary address for this type"
              }
            },
            additionalProperties: false
          }
        },
        masonicProfile: {
          bsonType: ["object", "null"],
          properties: {
            craft: {
              bsonType: ["object", "null"],
              properties: {
                grandLodge: {
                  bsonType: ["object", "null"],
                  properties: {
                    name: {
                      bsonType: ["string", "null"],
                      maxLength: 200
                    },
                    memberNumber: {
                      bsonType: ["string", "null"],
                      maxLength: 50
                    }
                  }
                },
                lodge: {
                  bsonType: ["object", "null"],
                  properties: {
                    organisationId: {
                      bsonType: ["objectId", "null"]
                    },
                    name: {
                      bsonType: ["string", "null"],
                      maxLength: 200
                    },
                    number: {
                      bsonType: ["string", "null"],
                      maxLength: 20
                    }
                  }
                },
                title: {
                  bsonType: ["string", "null"],
                  maxLength: 50
                },
                rank: {
                  bsonType: ["string", "null"],
                  maxLength: 50
                }
              }
            }
          }
        },
        roles: {
          bsonType: ["array", "null"],
          items: {
            bsonType: "object",
            required: ["role", "context", "contextId"],
            properties: {
              role: {
                bsonType: "string",
                enum: ["attendee", "organizer", "sponsor", "vendor", "host", "staff"],
                description: "Role type"
              },
              context: {
                bsonType: "string",
                enum: ["function", "organisation", "system"],
                description: "Context where role applies"
              },
              contextId: {
                bsonType: ["objectId", "string"],
                description: "ID of function/org where role applies"
              },
              startDate: {
                bsonType: ["date", "null"],
                description: "When role became active"
              },
              endDate: {
                bsonType: ["date", "null"],
                description: "When role ends (null for ongoing)"
              },
              permissions: {
                bsonType: ["array", "null"],
                items: {
                  bsonType: "string"
                },
                description: "Specific permissions for this role"
              }
            },
            additionalProperties: false
          }
        },
        orderReferences: {
          bsonType: ["array", "null"],
          items: {
            bsonType: "object",
            required: ["orderId", "orderNumber", "role"],
            properties: {
              orderId: {
                bsonType: "objectId",
                description: "Reference to orders collection"
              },
              orderNumber: {
                bsonType: "string",
                pattern: "^ORD-[0-9]{4}-[0-9]{6}$",
                description: "Order number for quick reference"
              },
              role: {
                bsonType: "string",
                enum: ["purchaser", "attendee"],
                description: "Role in the order"
              },
              items: {
                bsonType: ["array", "null"],
                items: {
                  bsonType: "objectId"
                },
                description: "Line items in the order for this contact"
              }
            },
            additionalProperties: false
          }
        },
        relationships: {
          bsonType: ["array", "null"],
          items: {
            bsonType: "object",
            required: ["contactId", "relationshipType"],
            properties: {
              contactId: {
                bsonType: "objectId",
                description: "Reference to another contact"
              },
              relationshipType: {
                bsonType: "string",
                description: "Type of relationship"
              },
              isPrimary: {
                bsonType: ["bool", "null"]
              },
              isEmergencyContact: {
                bsonType: ["bool", "null"]
              }
            },
            additionalProperties: false
          }
        },
        userId: {
          bsonType: ["objectId", "null"],
          description: "Optional reference to users collection"
        },
        metadata: {
          bsonType: "object",
          required: ["createdAt"],
          properties: {
            source: {
              bsonType: ["string", "null"],
              description: "How contact was created"
            },
            createdAt: {
              bsonType: "date"
            },
            createdBy: {
              bsonType: ["objectId", "null"]
            },
            updatedAt: {
              bsonType: ["date", "null"]
            },
            updatedBy: {
              bsonType: ["objectId", "null"]
            }
          },
          additionalProperties: false
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
function validateContactMethod(profile) {
  if (!profile.email && !profile.phone) {
    throw new Error("At least one contact method (email or phone) is required");
  }
}
```

### 2. Role Date Validation
```javascript
// Ensure role dates are logical
function validateRoleDates(role) {
  if (role.endDate && role.startDate && role.endDate < role.startDate) {
    throw new Error("Role end date cannot be before start date");
  }
}
```

### 3. No Self-Relationships
```javascript
// Contacts cannot have relationships with themselves
function validateRelationships(contactId, relationships) {
  relationships.forEach(rel => {
    if (rel.contactId.equals(contactId)) {
      throw new Error("Contact cannot have relationship with itself");
    }
  });
}
```

### 4. Primary Address Validation
```javascript
// Only one primary address per type
function validatePrimaryAddresses(addresses) {
  const primaryByType = {};
  addresses.forEach(addr => {
    if (addr.isPrimary) {
      if (primaryByType[addr.type]) {
        throw new Error(`Only one primary ${addr.type} address allowed`);
      }
      primaryByType[addr.type] = true;
    }
  });
}
```

### 5. Contact Number Generation
```javascript
// Generate unique contact number
async function generateContactNumber() {
  const year = new Date().getFullYear();
  const lastContact = await db.contacts
    .findOne({ contactNumber: new RegExp(`^CON-${year}-`) })
    .sort({ contactNumber: -1 });
  
  let sequence = 1;
  if (lastContact) {
    const match = lastContact.contactNumber.match(/CON-\d{4}-(\d{5})/);
    if (match) {
      sequence = parseInt(match[1]) + 1;
    }
  }
  
  return `CON-${year}-${sequence.toString().padStart(5, '0')}`;
}
```

### 6. Email Uniqueness Check
```javascript
// Check if email already exists (for deduplication)
async function checkEmailUniqueness(email, excludeContactId) {
  const query = { "profile.email": email.toLowerCase() };
  if (excludeContactId) {
    query._id = { $ne: excludeContactId };
  }
  
  const existing = await db.contacts.findOne(query);
  return !existing;
}
```

### 7. Active Role Validation
```javascript
// Validate no duplicate active roles in same context
function validateActiveRoles(roles) {
  const activeRoles = roles.filter(r => !r.endDate || r.endDate >= new Date());
  const roleMap = {};
  
  activeRoles.forEach(role => {
    const key = `${role.context}-${role.contextId}-${role.role}`;
    if (roleMap[key]) {
      throw new Error(`Duplicate active role: ${role.role} in ${role.context}`);
    }
    roleMap[key] = true;
  });
}
```

## Business Rules

### Data Quality
1. Names must be trimmed of leading/trailing whitespace
2. Email addresses stored in lowercase
3. Phone numbers should be normalized (country code + number)
4. At least one contact method required

### Relationships
1. No self-relationships allowed
2. Only one primary relationship per type
3. Emergency contacts should have phone numbers

### Roles
1. Role dates must be logical (end >= start)
2. No duplicate active roles in same context
3. System roles require special permissions to assign

### Orders
1. Order references are append-only (no deletion)
2. Order numbers must match pattern
3. Contact can be both purchaser and attendee

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
  if (sourceData.email && !isValidEmail(sourceData.email)) {
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
        hasEmail: { $ne: ["$profile.email", null] },
        hasPhone: { $ne: ["$profile.phone", null] },
        hasContactMethod: {
          $or: [
            { $ne: ["$profile.email", null] },
            { $ne: ["$profile.phone", null] }
          ]
        },
        validContactNumber: {
          $regexMatch: {
            input: "$contactNumber",
            regex: "^CON-[0-9]{4}-[0-9]{5}$"
          }
        }
      }
    },
    {
      $match: {
        $or: [
          { hasContactMethod: false },
          { validContactNumber: false }
        ]
      }
    }
  ]).toArray();
  
  return issues;
}
```