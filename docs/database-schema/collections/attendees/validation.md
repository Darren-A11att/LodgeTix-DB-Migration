# Attendees Collection - Validation Rules

## MongoDB Schema Validation

```javascript
db.createCollection("attendees", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["attendeeNumber", "attendeeId", "registrationId", "functionId", "attendeeType", "profile", "qrCode", "status"],
      properties: {
        attendeeNumber: {
          bsonType: "string",
          pattern: "^ATT-[0-9]{4}-[0-9]{5}$",
          description: "Attendee number must follow pattern ATT-YYYY-NNNNN"
        },
        attendeeId: {
          bsonType: "string",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "Legacy UUID from application"
        },
        registrationId: {
          bsonType: "objectId",
          description: "Must reference valid registration"
        },
        functionId: {
          bsonType: "string",
          pattern: "^[a-z0-9-]+$",
          description: "Must be valid function ID"
        },
        contactId: {
          bsonType: ["objectId", "null"],
          description: "Reference to contacts collection (may be null initially)"
        },
        contactMatched: {
          bsonType: "bool",
          description: "Whether contact has been matched/created"
        },
        contactMatchedAt: {
          bsonType: ["date", "null"],
          description: "When contact was matched"
        },
        attendeeType: {
          bsonType: "string",
          enum: ["mason", "guest", "partner", "vip", "speaker", "staff"],
          description: "Type of attendee"
        },
        isPrimary: {
          bsonType: "bool",
          description: "Primary attendee for registration"
        },
        paymentStatus: {
          bsonType: "string",
          enum: ["pending", "paid", "refunded", "comped"],
          description: "Payment status"
        },
        profile: {
          bsonType: "object",
          required: ["firstName", "lastName"],
          properties: {
            title: {
              bsonType: ["string", "null"],
              maxLength: 50
            },
            firstName: {
              bsonType: "string",
              minLength: 1,
              maxLength: 100
            },
            lastName: {
              bsonType: "string",
              minLength: 1,
              maxLength: 100
            },
            suffix: {
              bsonType: ["string", "null"],
              maxLength: 50
            },
            primaryEmail: {
              bsonType: ["string", "null"],
              pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
            },
            primaryPhone: {
              bsonType: ["string", "null"],
              pattern: "^\\+?[0-9\\s-()]+$"
            },
            contactPreference: {
              bsonType: ["string", "null"],
              enum: ["directly", "primaryattendee", null]
            },
            contactConfirmed: {
              bsonType: "bool"
            }
          }
        },
        partnerInfo: {
          bsonType: ["object", "null"],
          properties: {
            partner: {
              bsonType: ["string", "null"],
              description: "AttendeeId of partner"
            },
            isPartner: {
              bsonType: ["string", "null"],
              description: "AttendeeId they are partner of"
            },
            partnerOf: {
              bsonType: ["string", "null"],
              description: "AttendeeId they are partner of"
            },
            relationship: {
              bsonType: ["string", "null"],
              description: "Relationship type"
            }
          }
        },
        masonicInfo: {
          bsonType: ["object", "null"],
          properties: {
            rank: {
              bsonType: ["string", "null"],
              enum: ["EA", "EAF", "FC", "MM", "GL", null]
            },
            title: {
              bsonType: ["string", "null"]
            },
            grandOfficerStatus: {
              bsonType: ["string", "null"],
              enum: ["Present", "Past", null]
            },
            postNominals: {
              bsonType: ["string", "null"]
            },
            lodge: {
              bsonType: ["string", "null"]
            },
            lodgeId: {
              bsonType: ["string", "null"]
            },
            lodgeNameNumber: {
              bsonType: ["string", "null"]
            },
            lodgeOrganisationId: {
              bsonType: ["string", "null"]
            },
            grandLodge: {
              bsonType: ["string", "null"]
            },
            grandLodgeId: {
              bsonType: ["string", "null"]
            },
            grandLodgeOrganisationId: {
              bsonType: ["string", "null"]
            },
            firstTime: {
              bsonType: ["bool", "null"]
            },
            useSameLodge: {
              bsonType: ["bool", "null"]
            }
          }
        },
        requirements: {
          bsonType: ["object", "null"],
          properties: {
            dietaryRequirements: {
              bsonType: ["string", "null"],
              maxLength: 500
            },
            specialNeeds: {
              bsonType: ["string", "null"],
              maxLength: 500
            },
            accessibility: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "string"
              }
            },
            seating: {
              bsonType: ["object", "null"],
              properties: {
                tableAssignment: {
                  bsonType: ["string", "null"]
                },
                preference: {
                  bsonType: ["string", "null"]
                },
                companionIds: {
                  bsonType: ["array", "null"],
                  items: {
                    bsonType: "string"
                  }
                }
              }
            }
          }
        },
        qrCode: {
          bsonType: "object",
          required: ["code", "format", "generatedAt"],
          properties: {
            code: {
              bsonType: "string",
              minLength: 16,
              description: "Unique QR code value"
            },
            format: {
              bsonType: "string",
              enum: ["uuid", "custom"]
            },
            generatedAt: {
              bsonType: "date"
            },
            lastScanned: {
              bsonType: ["date", "null"]
            },
            scanCount: {
              bsonType: "int",
              minimum: 0
            },
            security: {
              bsonType: ["object", "null"],
              properties: {
                pin: {
                  bsonType: ["string", "null"]
                },
                validFrom: {
                  bsonType: ["date", "null"]
                },
                validUntil: {
                  bsonType: ["date", "null"]
                },
                revoked: {
                  bsonType: "bool"
                },
                revokedReason: {
                  bsonType: ["string", "null"]
                }
              }
            }
          }
        },
        tickets: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["ticketId", "eventId"],
            properties: {
              ticketId: {
                bsonType: "objectId"
              },
              eventId: {
                bsonType: "string"
              },
              eventName: {
                bsonType: ["string", "null"]
              },
              productName: {
                bsonType: ["string", "null"]
              },
              access: {
                bsonType: ["object", "null"],
                properties: {
                  zones: {
                    bsonType: "array",
                    items: { bsonType: "string" }
                  },
                  validFrom: {
                    bsonType: ["date", "null"]
                  },
                  validUntil: {
                    bsonType: ["date", "null"]
                  },
                  singleUse: {
                    bsonType: "bool"
                  },
                  used: {
                    bsonType: "bool"
                  },
                  usedAt: {
                    bsonType: ["date", "null"]
                  }
                }
              }
            }
          }
        },
        isCheckedIn: {
          bsonType: "bool",
          description: "Current check-in status"
        },
        checkIns: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              eventId: {
                bsonType: "string"
              },
              locationId: {
                bsonType: ["string", "null"]
              },
              checkInTime: {
                bsonType: "date"
              },
              checkOutTime: {
                bsonType: ["date", "null"]
              },
              device: {
                bsonType: ["string", "null"]
              },
              staff: {
                bsonType: ["objectId", "null"]
              },
              method: {
                bsonType: "string",
                enum: ["qr_scan", "manual", "facial", "rfid"]
              },
              notes: {
                bsonType: ["string", "null"]
              }
            }
          }
        },
        notes: {
          bsonType: ["string", "null"],
          maxLength: 1000
        },
        status: {
          bsonType: "string",
          enum: ["active", "checked_in", "no_show", "cancelled"],
          description: "Attendee status"
        },
        source: {
          bsonType: "string",
          enum: ["registration", "import", "manual"],
          description: "How attendee was added"
        },
        guestInfo: {
          bsonType: ["object", "null"],
          properties: {
            guestOfId: {
              bsonType: ["string", "null"],
              description: "AttendeeId of who they are guest of"
            }
          }
        },
        metadata: {
          bsonType: "object",
          required: ["createdAt"],
          properties: {
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
            importId: {
              bsonType: ["string", "null"]
            },
            version: {
              bsonType: ["int", "null"],
              minimum: 1
            }
          }
        }
      },
      additionalProperties: true  // Allow for accommodation, communications, engagement, badge, etc.
    }
  },
  validationLevel: "moderate",
  validationAction: "error"
})
```

## Business Validation Rules

### QR Code Generation
```javascript
// QR code must be unique and cryptographically secure
function generateQRCode() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}
```

### Partner Relationship Consistency
```javascript
// If attendee A has partner B, then B should have isPartner A
function validatePartnerRelationships(attendeeA, attendeeB) {
  if (attendeeA.partnerInfo.partner !== attendeeB.attendeeId) {
    throw new Error('Partner relationship mismatch');
  }
  if (attendeeB.partnerInfo.isPartner !== attendeeA.attendeeId) {
    throw new Error('Reverse partner relationship missing');
  }
}
```

### Contact Matching Rules
```javascript
// Contact matching should be done post-registration
function shouldMatchContact(attendee) {
  return attendee.profile.primaryEmail || attendee.profile.primaryPhone;
}
```

### Primary Attendee Rules
```javascript
// Each registration should have exactly one primary attendee
function validatePrimaryAttendee(registration, attendees) {
  const primaryCount = attendees.filter(a => a.isPrimary).length;
  if (primaryCount !== 1) {
    throw new Error('Registration must have exactly one primary attendee');
  }
}
```

### Masonic Information Validation
```javascript
// Mason attendees should have masonic information
function validateMasonicInfo(attendee) {
  if (attendee.attendeeType === 'mason' && !attendee.masonicInfo.rank) {
    throw new Error('Mason attendees must have rank information');
  }
}
```

## Data Quality Rules

### Email Format
- Primary email should be valid format if provided
- Can be empty for non-primary attendees

### Phone Format
- Should accept international formats
- Can be empty for non-primary attendees

### Name Requirements
- First and last names are required
- Title and suffix are optional
- Names should be trimmed of whitespace

### Partner Relationships
- Partner field should reference valid attendeeId
- Relationships should be reciprocal
- Relationship type should be specified

## Migration Considerations

### Contact Reconciliation
- Attendees created during registration may not have contactId initially
- Post-registration process will match/create contacts
- contactMatched flag indicates completion status

### Legacy Data
- attendeeId contains the UUID from the current system
- All legacy IDs should be preserved for backwards compatibility
- Partner relationships use attendeeId references (not ObjectId)