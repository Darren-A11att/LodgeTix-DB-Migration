# Contacts Collection Validation

## MongoDB Schema Validation Rules

```javascript
db.createCollection("contacts", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["contactNumber", "profile"],
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
                description: "Address type (e.g., billing)"
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
                  },
                  additionalProperties: false
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
                  },
                  additionalProperties: false
                },
                title: {
                  bsonType: ["string", "null"],
                  maxLength: 50
                },
                rank: {
                  bsonType: ["string", "null"],
                  maxLength: 50
                },
                grandRank: {
                  bsonType: ["string", "null"],
                  maxLength: 50
                },
                isGrandOfficer: {
                  bsonType: ["bool", "null"]
                },
                grandOffice: {
                  bsonType: ["string", "null"],
                  maxLength: 100
                }
              },
              additionalProperties: false
            }
          },
          additionalProperties: false
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
              },
              notes: {
                bsonType: ["string", "null"],
                maxLength: 500
              },
              reciprocal: {
                bsonType: ["bool", "null"]
              },
              reciprocalType: {
                bsonType: ["string", "null"]
              }
            },
            additionalProperties: false
          }
        },
        userId: {
          bsonType: ["objectId", "null"],
          description: "Optional reference to users collection"
        },
        references: {
          bsonType: ["object", "null"],
          properties: {
            organisationIds: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "objectId"
              }
            },
            attendeeIds: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "objectId"
              }
            },
            paymentTransactionIds: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "objectId"
              }
            },
            invoiceIds: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "objectId"
              }
            }
          },
          additionalProperties: false
        },
        metadata: {
          bsonType: "object",
          required: ["createdAt"],
          properties: {
            source: {
              bsonType: ["string", "null"]
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
            },
            version: {
              bsonType: ["number", "null"],
              minimum: 1
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

### At Least One Contact Method
```javascript
{
  $or: [
    { "profile.email": { $exists: true, $ne: null, $ne: "" } },
    { "profile.phone": { $exists: true, $ne: null, $ne: "" } }
  ]
}
```

### No Self-Relationships
```javascript
// In application logic, ensure:
relationships.forEach(rel => {
  if (rel.contactId.equals(document._id)) {
    throw new Error("Contact cannot have relationship with itself");
  }
});
```

### Primary Address Validation
```javascript
// Ensure only one primary address per type
addresses.reduce((types, addr) => {
  if (addr.isPrimary) {
    if (types[addr.type]) {
      throw new Error(`Only one primary ${addr.type} address allowed`);
    }
    types[addr.type] = true;
  }
  return types;
}, {});
```

### Contact Number Format
```javascript
// Validation pattern: CON-YYYY-NNNNN
// Where YYYY is the current year and NNNNN is sequential
const pattern = /^CON-\d{4}-\d{5}$/;
if (!pattern.test(contactNumber)) {
  throw new Error("Invalid contact number format");
}
```

## Validation Notes

1. **Moderate Validation Level**: Allows existing documents to remain but validates new inserts and updates
2. **Required Fields**: Only `contactNumber`, `profile.firstName`, and `profile.lastName` are truly required
3. **Email Format**: Uses standard email regex pattern
4. **Phone Numbers**: No specific format enforced to allow international numbers
5. **String Lengths**: Conservative limits to prevent abuse while allowing reasonable data
6. **Optional Fields**: Most fields allow null to support partial data during migration