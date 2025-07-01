# Attendees Collection - Validation Rules

## MongoDB Schema Validation

```javascript
db.createCollection("attendees", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["attendeeNumber", "registrationId", "functionId", "profile", "qrCode", "status"],
      properties: {
        attendeeNumber: {
          bsonType: "string",
          pattern: "^ATT-[0-9]{4}-[0-9]{5}$",
          description: "Attendee number must follow pattern ATT-YYYY-NNNNN"
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
        profile: {
          bsonType: "object",
          required: ["firstName", "lastName", "contact"],
          properties: {
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
            preferredName: {
              bsonType: ["string", "null"],
              maxLength: 100
            },
            dateOfBirth: {
              bsonType: ["date", "null"]
            },
            gender: {
              bsonType: ["string", "null"],
              enum: ["male", "female", "other", "prefer_not_to_say", null]
            },
            contact: {
              bsonType: "object",
              required: ["email"],
              properties: {
                email: {
                  bsonType: "string",
                  pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                },
                phone: {
                  bsonType: ["string", "null"],
                  pattern: "^\\+?[0-9\\s-()]+$"
                },
                emergencyContact: {
                  bsonType: ["object", "null"],
                  properties: {
                    name: { bsonType: "string", minLength: 1 },
                    phone: { 
                      bsonType: "string",
                      pattern: "^\\+?[0-9\\s-()]+$"
                    },
                    relationship: { bsonType: "string" }
                  }
                }
              }
            },
            identification: {
              bsonType: ["object", "null"],
              properties: {
                type: {
                  bsonType: "string",
                  enum: ["drivers_license", "passport", "member_card", "student_id"]
                },
                number: {
                  bsonType: "string",
                  description: "Must be encrypted"
                },
                verifiedAt: { bsonType: ["date", "null"] },
                verifiedBy: { bsonType: ["objectId", "null"] }
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
              description: "Must be unique QR code"
            },
            format: {
              bsonType: "string",
              enum: ["uuid", "custom"]
            },
            generatedAt: { bsonType: "date" },
            lastScanned: { bsonType: ["date", "null"] },
            scanCount: {
              bsonType: "int",
              minimum: 0
            },
            security: {
              bsonType: ["object", "null"],
              properties: {
                pin: {
                  bsonType: ["string", "null"],
                  description: "Must be bcrypt hashed"
                },
                validFrom: { bsonType: "date" },
                validUntil: { bsonType: "date" },
                revoked: { bsonType: "bool" },
                revokedReason: { bsonType: ["string", "null"] }
              }
            }
          }
        },
        tickets: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["ticketId", "eventId", "eventName", "productName"],
            properties: {
              ticketId: { bsonType: "objectId" },
              eventId: { bsonType: "string" },
              eventName: { bsonType: "string" },
              productName: { bsonType: "string" },
              access: {
                bsonType: "object",
                properties: {
                  zones: {
                    bsonType: "array",
                    items: { bsonType: "string" }
                  },
                  validFrom: { bsonType: "date" },
                  validUntil: { bsonType: "date" },
                  singleUse: { bsonType: "bool" },
                  used: { bsonType: "bool" },
                  usedAt: { bsonType: ["date", "null"] }
                }
              }
            }
          }
        },
        checkIns: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["eventId", "checkInTime"],
            properties: {
              eventId: { bsonType: "string" },
              locationId: { bsonType: ["string", "null"] },
              checkInTime: { bsonType: "date" },
              checkOutTime: { bsonType: ["date", "null"] },
              device: { bsonType: ["string", "null"] },
              staff: { bsonType: ["objectId", "null"] },
              method: {
                bsonType: "string",
                enum: ["qr_scan", "manual", "facial", "rfid"]
              },
              notes: { bsonType: ["string", "null"] }
            }
          }
        },
        requirements: {
          bsonType: ["object", "null"],
          properties: {
            dietary: {
              bsonType: "array",
              items: {
                bsonType: "string",
                enum: ["vegetarian", "vegan", "gluten_free", "dairy_free", "nut_free", "halal", "kosher", "other"]
              }
            },
            accessibility: {
              bsonType: "array",
              items: {
                bsonType: "string",
                enum: ["wheelchair", "hearing_loop", "large_print", "guide_dog", "accessible_seating", "other"]
              }
            },
            medical: {
              bsonType: ["object", "null"],
              properties: {
                conditions: { bsonType: "array", items: { bsonType: "string" } },
                medications: { bsonType: "array", items: { bsonType: "string" } },
                allergies: { bsonType: "array", items: { bsonType: "string" } }
              }
            },
            seating: {
              bsonType: ["object", "null"],
              properties: {
                preference: {
                  bsonType: ["string", "null"],
                  enum: ["aisle", "front", "back", "near_exit", "quiet_area", null]
                },
                companionIds: {
                  bsonType: "array",
                  items: { bsonType: "objectId" }
                },
                avoidIds: {
                  bsonType: "array",
                  items: { bsonType: "objectId" }
                }
              }
            }
          }
        },
        accommodation: {
          bsonType: ["object", "null"],
          properties: {
            roomId: { bsonType: ["string", "null"] },
            roomType: { bsonType: ["string", "null"] },
            checkIn: { bsonType: ["date", "null"] },
            checkOut: { bsonType: ["date", "null"] },
            companions: {
              bsonType: "array",
              items: { bsonType: "objectId" }
            },
            preferences: {
              bsonType: ["object", "null"],
              properties: {
                floor: {
                  bsonType: ["string", "null"],
                  enum: ["ground", "upper", "any", null]
                },
                bedType: {
                  bsonType: ["string", "null"],
                  enum: ["twin", "double", "queen", "king", null]
                },
                notes: { bsonType: ["string", "null"] }
              }
            }
          }
        },
        communications: {
          bsonType: ["object", "null"],
          properties: {
            preferences: {
              bsonType: "object",
              properties: {
                email: { bsonType: "bool" },
                sms: { bsonType: "bool" },
                pushNotifications: { bsonType: "bool" }
              }
            },
            language: {
              bsonType: "string",
              pattern: "^[a-z]{2}(-[A-Z]{2})?$"
            },
            timezone: { bsonType: "string" },
            sent: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["type", "channel", "sentAt"],
                properties: {
                  type: {
                    bsonType: "string",
                    enum: ["confirmation", "reminder", "update", "alert"]
                  },
                  channel: {
                    bsonType: "string",
                    enum: ["email", "sms", "push"]
                  },
                  sentAt: { bsonType: "date" },
                  subject: { bsonType: ["string", "null"] },
                  status: {
                    bsonType: "string",
                    enum: ["sent", "delivered", "bounced", "failed"]
                  }
                }
              }
            }
          }
        },
        engagement: {
          bsonType: ["object", "null"],
          properties: {
            eventsAttended: { bsonType: "int", minimum: 0 },
            lastEventDate: { bsonType: ["date", "null"] },
            totalSpent: { bsonType: "decimal", minimum: 0 },
            sessions: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  eventId: { bsonType: "string" },
                  sessionId: { bsonType: "string" },
                  attended: { bsonType: "bool" },
                  feedback: {
                    bsonType: ["object", "null"],
                    properties: {
                      rating: { 
                        bsonType: ["int", "null"],
                        minimum: 1,
                        maximum: 5
                      },
                      comments: { bsonType: ["string", "null"] }
                    }
                  }
                }
              }
            },
            activities: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  type: { bsonType: "string" },
                  activityId: { bsonType: "string" },
                  participatedAt: { bsonType: "date" },
                  result: { bsonType: ["string", "null"] }
                }
              }
            }
          }
        },
        badge: {
          bsonType: ["object", "null"],
          properties: {
            printed: { bsonType: "bool" },
            printedAt: { bsonType: ["date", "null"] },
            collectedAt: { bsonType: ["date", "null"] },
            badgeType: {
              bsonType: "string",
              enum: ["standard", "vip", "speaker", "staff", "volunteer", "media"]
            },
            customFields: {
              bsonType: ["object", "null"],
              properties: {
                title: { bsonType: ["string", "null"] },
                organisation: { bsonType: ["string", "null"] },
                ribbons: {
                  bsonType: "array",
                  items: { bsonType: "string" }
                }
              }
            }
          }
        },
        status: {
          bsonType: "string",
          enum: ["active", "checked_in", "no_show", "cancelled"]
        },
        source: {
          bsonType: "string",
          enum: ["registration", "import", "manual", "transfer"]
        },
        customFields: {
          bsonType: ["object", "null"]
        },
        metadata: {
          bsonType: "object",
          required: ["createdAt", "updatedAt"],
          properties: {
            createdAt: { bsonType: "date" },
            createdBy: { bsonType: ["objectId", "null"] },
            updatedAt: { bsonType: "date" },
            updatedBy: { bsonType: ["objectId", "null"] },
            importId: { bsonType: ["string", "null"] },
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

### 1. QR Code Security Validation
```javascript
// Ensure QR validity dates are logical
function validateQRCodeDates(qrCode) {
  if (qrCode.security) {
    return qrCode.security.validFrom < qrCode.security.validUntil;
  }
  return true;
}

// Ensure revoked codes have a reason
function validateRevokedQR(qrCode) {
  if (qrCode.security?.revoked && !qrCode.security.revokedReason) {
    return false;
  }
  return true;
}
```

### 2. Ticket Access Validation
```javascript
// Ensure single-use tickets are properly tracked
function validateSingleUseTickets(tickets) {
  return tickets.every(ticket => {
    if (ticket.access.singleUse && ticket.access.used) {
      return ticket.access.usedAt !== null;
    }
    return true;
  });
}

// Validate ticket date ranges
function validateTicketDates(tickets) {
  return tickets.every(ticket => {
    return ticket.access.validFrom < ticket.access.validUntil;
  });
}
```

### 3. Check-in Consistency
```javascript
// Ensure check-out is after check-in
function validateCheckInTimes(checkIns) {
  return checkIns.every(checkIn => {
    if (checkIn.checkOutTime) {
      return checkIn.checkInTime < checkIn.checkOutTime;
    }
    return true;
  });
}

// Validate status matches check-in state
function validateAttendeeStatus(attendee) {
  const hasActiveCheckIn = attendee.checkIns.some(
    ci => ci.checkInTime && !ci.checkOutTime
  );
  
  if (hasActiveCheckIn && attendee.status !== 'checked_in') {
    return false;
  }
  
  return true;
}
```

### 4. Room Companion Validation
```javascript
// Ensure room companions are mutual
async function validateRoomCompanions(attendeeId, companionIds) {
  for (const companionId of companionIds) {
    const companion = await db.attendees.findOne({ _id: companionId });
    if (!companion.accommodation?.companions.includes(attendeeId)) {
      return false;
    }
  }
  return true;
}
```

## Business Rules

1. **QR Code Generation**: Must be cryptographically secure and unique
2. **Age Verification**: Date of birth required for age-restricted events
3. **Check-in Limits**: Cannot check into same event multiple times simultaneously
4. **Ticket Transfer**: Updates attendee assignment and maintains audit trail
5. **Badge Collection**: Can only collect after printing
6. **Communication Consent**: Must respect opt-out preferences
7. **Seating Conflicts**: Cannot have mutual avoid relationships
8. **Medical Data**: Requires extra encryption and access controls
9. **Revocation**: Revoked QR codes cannot be reactivated

## Pre-save Validation Hook

```javascript
// Example pre-save validation in application
async function validateAttendee(attendee) {
  // Validate all custom rules
  const validations = [
    validateQRCodeDates(attendee.qrCode),
    validateRevokedQR(attendee.qrCode),
    validateSingleUseTickets(attendee.tickets),
    validateTicketDates(attendee.tickets),
    validateCheckInTimes(attendee.checkIns),
    validateAttendeeStatus(attendee)
  ];
  
  if (!validations.every(v => v)) {
    throw new Error('Attendee validation failed');
  }
  
  // Check registration exists and has capacity
  const registration = await db.registrations.findOne({ 
    _id: attendee.registrationId 
  });
  
  if (!registration) {
    throw new Error('Invalid registration reference');
  }
  
  // For new attendees, check allocation capacity
  if (!attendee._id && registration.attendeeAllocation) {
    const currentAttendees = await db.attendees.countDocuments({
      registrationId: attendee.registrationId
    });
    
    if (currentAttendees >= registration.attendeeAllocation.total) {
      throw new Error('Registration attendee capacity exceeded');
    }
  }
  
  return true;
}
```

## Security Validations

1. **PII Encryption**: Validate that sensitive fields are encrypted
2. **QR Signature**: Verify QR code signature before accepting
3. **Access Control**: Validate user has permission to view medical data
4. **Rate Limiting**: Enforce scan frequency limits per QR code