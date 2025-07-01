# Organisations Collection - Validation Rules

## MongoDB Schema Validation

```javascript
db.createCollection("organisations", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["organisationId", "profile", "status"],
      properties: {
        organisationId: {
          bsonType: "string",
          pattern: "^ORG-[0-9]{6}$",
          description: "Organisation ID must follow pattern ORG-NNNNNN"
        },
        profile: {
          bsonType: "object",
          required: ["name", "type", "contact"],
          properties: {
            name: {
              bsonType: "string",
              minLength: 2,
              maxLength: 200
            },
            displayName: {
              bsonType: ["string", "null"],
              maxLength: 100
            },
            type: {
              bsonType: "string",
              enum: ["lodge", "company", "association", "charity", "government", "educational", "other"]
            },
            registration: {
              bsonType: "object",
              properties: {
                number: {
                  bsonType: ["string", "null"],
                  maxLength: 50
                },
                registeredName: {
                  bsonType: ["string", "null"],
                  maxLength: 200
                },
                abn: {
                  bsonType: ["string", "null"],
                  pattern: "^[0-9]{11}$"
                },
                acn: {
                  bsonType: ["string", "null"],
                  pattern: "^[0-9]{9}$"
                },
                taxId: {
                  bsonType: ["string", "null"],
                  pattern: "^[A-Z0-9-]+$"
                },
                gstRegistered: { bsonType: "bool" },
                charityStatus: { bsonType: "bool" },
                charityNumber: {
                  bsonType: ["string", "null"],
                  pattern: "^[A-Z0-9-]+$"
                }
              }
            },
            contact: {
              bsonType: "object",
              required: ["primary"],
              properties: {
                primary: {
                  bsonType: "object",
                  required: ["name", "email"],
                  properties: {
                    name: {
                      bsonType: "string",
                      minLength: 1,
                      maxLength: 100
                    },
                    role: {
                      bsonType: ["string", "null"],
                      maxLength: 50
                    },
                    email: {
                      bsonType: "string",
                      pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                    },
                    phone: {
                      bsonType: ["string", "null"],
                      pattern: "^\\+?[0-9\\s-()]+$"
                    }
                  }
                },
                billing: {
                  bsonType: ["object", "null"],
                  properties: {
                    name: { bsonType: ["string", "null"] },
                    email: {
                      bsonType: ["string", "null"],
                      pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                    },
                    phone: {
                      bsonType: ["string", "null"],
                      pattern: "^\\+?[0-9\\s-()]+$"
                    }
                  }
                },
                events: {
                  bsonType: ["object", "null"],
                  properties: {
                    name: { bsonType: ["string", "null"] },
                    email: {
                      bsonType: ["string", "null"],
                      pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                    },
                    phone: {
                      bsonType: ["string", "null"],
                      pattern: "^\\+?[0-9\\s-()]+$"
                    }
                  }
                },
                general: {
                  bsonType: ["object", "null"],
                  properties: {
                    email: {
                      bsonType: ["string", "null"],
                      pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                    },
                    phone: {
                      bsonType: ["string", "null"],
                      pattern: "^\\+?[0-9\\s-()]+$"
                    },
                    website: {
                      bsonType: ["string", "null"],
                      pattern: "^https?://"
                    },
                    socialMedia: {
                      bsonType: ["object", "null"],
                      properties: {
                        facebook: { bsonType: ["string", "null"] },
                        twitter: { bsonType: ["string", "null"] },
                        linkedin: { bsonType: ["string", "null"] },
                        instagram: { bsonType: ["string", "null"] }
                      }
                    }
                  }
                }
              }
            },
            addresses: {
              bsonType: "object",
              properties: {
                physical: {
                  bsonType: ["object", "null"],
                  properties: {
                    addressLine1: { bsonType: "string", maxLength: 200 },
                    addressLine2: { bsonType: ["string", "null"], maxLength: 200 },
                    city: { bsonType: "string", maxLength: 100 },
                    state: { bsonType: "string", maxLength: 50 },
                    postcode: { bsonType: "string", maxLength: 20 },
                    country: { bsonType: "string", minLength: 2, maxLength: 2 },
                    venue: {
                      bsonType: ["object", "null"],
                      properties: {
                        name: { bsonType: ["string", "null"] },
                        capacity: { bsonType: ["int", "null"], minimum: 0 },
                        facilities: {
                          bsonType: "array",
                          items: { bsonType: "string" }
                        },
                        directions: { bsonType: ["string", "null"] }
                      }
                    }
                  }
                },
                postal: {
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
                billing: {
                  bsonType: ["object", "null"],
                  properties: {
                    sameAsPostal: { bsonType: "bool" },
                    addressLine1: { bsonType: ["string", "null"] },
                    addressLine2: { bsonType: ["string", "null"] },
                    city: { bsonType: ["string", "null"] },
                    state: { bsonType: ["string", "null"] },
                    postcode: { bsonType: ["string", "null"] },
                    country: { bsonType: ["string", "null"] }
                  }
                }
              }
            },
            details: {
              bsonType: ["object", "null"],
              properties: {
                founded: { bsonType: ["date", "null"] },
                description: { bsonType: ["string", "null"], maxLength: 2000 },
                mission: { bsonType: ["string", "null"], maxLength: 1000 },
                lodge: {
                  bsonType: ["object", "null"],
                  properties: {
                    district: { bsonType: ["string", "null"] },
                    grandLodge: { bsonType: ["string", "null"] },
                    meetingSchedule: { bsonType: ["string", "null"] },
                    meetingTime: { bsonType: ["string", "null"] },
                    dresscode: { bsonType: ["string", "null"] }
                  }
                },
                size: {
                  bsonType: ["object", "null"],
                  properties: {
                    memberCount: { bsonType: ["int", "null"], minimum: 0 },
                    activeMembers: { bsonType: ["int", "null"], minimum: 0 },
                    category: {
                      bsonType: ["string", "null"],
                      enum: ["small", "medium", "large", null]
                    }
                  }
                }
              }
            }
          }
        },
        membership: {
          bsonType: ["object", "null"],
          properties: {
            members: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["userId", "status"],
                properties: {
                  userId: { bsonType: "objectId" },
                  memberNumber: { bsonType: ["string", "null"] },
                  role: { bsonType: ["string", "null"] },
                  title: { bsonType: ["string", "null"] },
                  status: {
                    bsonType: "string",
                    enum: ["active", "suspended", "resigned", "expelled", "deceased"]
                  },
                  joinedAt: { bsonType: "date" },
                  permissions: {
                    bsonType: "array",
                    items: { bsonType: "string" }
                  },
                  membershipType: {
                    bsonType: "string",
                    enum: ["full", "associate", "honorary", "life"]
                  },
                  dues: {
                    bsonType: ["object", "null"],
                    properties: {
                      amount: { bsonType: "decimal", minimum: 0 },
                      frequency: {
                        bsonType: "string",
                        enum: ["annual", "quarterly", "monthly"]
                      },
                      paidUntil: { bsonType: ["date", "null"] },
                      autoRenew: { bsonType: "bool" }
                    }
                  }
                }
              }
            },
            officers: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["position", "userId"],
                properties: {
                  position: { bsonType: "string" },
                  userId: { bsonType: "objectId" },
                  name: { bsonType: ["string", "null"] },
                  startDate: { bsonType: "date" },
                  endDate: { bsonType: ["date", "null"] },
                  current: { bsonType: "bool" },
                  contact: {
                    bsonType: ["object", "null"],
                    properties: {
                      email: {
                        bsonType: ["string", "null"],
                        pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                      },
                      phone: {
                        bsonType: ["string", "null"],
                        pattern: "^\\+?[0-9\\s-()]+$"
                      }
                    }
                  }
                }
              }
            },
            rules: {
              bsonType: ["object", "null"],
              properties: {
                approvalRequired: { bsonType: "bool" },
                approvalQuorum: { bsonType: ["int", "null"], minimum: 1 },
                votingRights: {
                  bsonType: ["object", "null"],
                  properties: {
                    minimumTenure: { bsonType: ["int", "null"], minimum: 0 },
                    requiresDuesPaid: { bsonType: "bool" }
                  }
                },
                eligibility: {
                  bsonType: ["object", "null"],
                  properties: {
                    minAge: { bsonType: ["int", "null"], minimum: 0 },
                    maxAge: { bsonType: ["int", "null"], minimum: 0 },
                    gender: {
                      bsonType: "array",
                      items: {
                        bsonType: "string",
                        enum: ["male", "female", "other", "any"]
                      }
                    },
                    requiresInvitation: { bsonType: "bool" },
                    requiresSponsor: { bsonType: "bool" },
                    otherRequirements: {
                      bsonType: "array",
                      items: { bsonType: "string" }
                    }
                  }
                }
              }
            }
          }
        },
        financial: {
          bsonType: ["object", "null"],
          properties: {
            banking: {
              bsonType: ["object", "null"],
              properties: {
                accountName: { bsonType: ["string", "null"] },
                bsb: { bsonType: ["string", "null"] },
                accountNumber: { bsonType: ["string", "null"] },
                bankName: { bsonType: ["string", "null"] },
                preferredMethod: {
                  bsonType: "string",
                  enum: ["invoice", "direct_debit", "credit_card"]
                },
                terms: {
                  bsonType: "string",
                  enum: ["immediate", "net15", "net30", "net60", "net90"]
                }
              }
            },
            credit: {
              bsonType: ["object", "null"],
              properties: {
                limit: { bsonType: "decimal", minimum: 0 },
                used: { bsonType: "decimal", minimum: 0 },
                available: { bsonType: "decimal" },
                rating: {
                  bsonType: "string",
                  enum: ["excellent", "good", "fair", "poor"]
                },
                lastReview: { bsonType: ["date", "null"] },
                onTimePayments: { bsonType: "int", minimum: 0 },
                latePayments: { bsonType: "int", minimum: 0 },
                averageDaysToPayment: { bsonType: ["number", "null"], minimum: 0 }
              }
            },
            invoicing: {
              bsonType: ["object", "null"],
              properties: {
                consolidated: { bsonType: "bool" },
                frequency: {
                  bsonType: "string",
                  enum: ["immediate", "weekly", "monthly", "quarterly"]
                },
                format: {
                  bsonType: "string",
                  enum: ["pdf", "electronic", "paper"]
                },
                purchaseOrderRequired: { bsonType: "bool" },
                costCenters: {
                  bsonType: "array",
                  items: {
                    bsonType: "object",
                    properties: {
                      code: { bsonType: "string" },
                      name: { bsonType: "string" },
                      approver: { bsonType: ["objectId", "null"] }
                    }
                  }
                }
              }
            },
            tax: {
              bsonType: ["object", "null"],
              properties: {
                exemptStatus: { bsonType: "bool" },
                exemptionCertificate: {
                  bsonType: ["object", "null"],
                  properties: {
                    number: { bsonType: ["string", "null"] },
                    expiryDate: { bsonType: ["date", "null"] },
                    documentUrl: { bsonType: ["string", "null"] }
                  }
                }
              }
            }
          }
        },
        events: {
          bsonType: ["object", "null"],
          properties: {
            defaults: {
              bsonType: ["object", "null"],
              properties: {
                registrationType: {
                  bsonType: "string",
                  enum: ["individual", "lodge", "delegation"]
                },
                paymentMethod: {
                  bsonType: "string",
                  enum: ["credit_card", "invoice", "bank_transfer"]
                },
                bulkBooking: {
                  bsonType: ["object", "null"],
                  properties: {
                    minimumAttendees: { bsonType: "int", minimum: 1 },
                    defaultAllocation: { bsonType: "int", minimum: 1 },
                    autoAssignMembers: { bsonType: "bool" }
                  }
                },
                seating: {
                  bsonType: ["object", "null"],
                  properties: {
                    preferTogether: { bsonType: "bool" },
                    specialRequirements: {
                      bsonType: "array",
                      items: { bsonType: "string" }
                    },
                    vipMembers: {
                      bsonType: "array",
                      items: { bsonType: "objectId" }
                    }
                  }
                }
              }
            },
            history: {
              bsonType: ["object", "null"],
              properties: {
                eventsAttended: { bsonType: "int", minimum: 0 },
                totalAttendees: { bsonType: "int", minimum: 0 },
                totalSpent: { bsonType: "decimal", minimum: 0 },
                lastEventDate: { bsonType: ["date", "null"] },
                favoriteEvents: {
                  bsonType: "array",
                  items: { bsonType: "string" }
                },
                eventsHosted: {
                  bsonType: "array",
                  items: {
                    bsonType: "object",
                    properties: {
                      eventId: { bsonType: "string" },
                      date: { bsonType: "date" },
                      type: { bsonType: "string" },
                      attendance: { bsonType: "int", minimum: 0 }
                    }
                  }
                }
              }
            },
            arrangements: {
              bsonType: ["object", "null"],
              properties: {
                cateringPreferences: {
                  bsonType: ["object", "null"],
                  properties: {
                    provider: { bsonType: ["string", "null"] },
                    restrictions: {
                      bsonType: "array",
                      items: { bsonType: "string" }
                    },
                    notes: { bsonType: ["string", "null"] }
                  }
                },
                transportArrangements: {
                  bsonType: ["object", "null"],
                  properties: {
                    required: { bsonType: "bool" },
                    details: { bsonType: ["string", "null"] }
                  }
                },
                accommodationPreferences: {
                  bsonType: ["object", "null"],
                  properties: {
                    preferredHotels: {
                      bsonType: "array",
                      items: { bsonType: "string" }
                    },
                    roomTypes: {
                      bsonType: "array",
                      items: { bsonType: "string" }
                    },
                    specialNeeds: {
                      bsonType: "array",
                      items: { bsonType: "string" }
                    }
                  }
                }
              }
            }
          }
        },
        relationships: {
          bsonType: ["object", "null"],
          properties: {
            parent: {
              bsonType: ["object", "null"],
              properties: {
                organisationId: { bsonType: ["objectId", "null"] },
                name: { bsonType: ["string", "null"] },
                type: { bsonType: ["string", "null"] }
              }
            },
            children: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  organisationId: { bsonType: "objectId" },
                  name: { bsonType: "string" },
                  type: { bsonType: "string" }
                }
              }
            },
            affiliations: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  organisationId: { bsonType: "objectId" },
                  name: { bsonType: "string" },
                  type: { bsonType: "string" },
                  startDate: { bsonType: "date" },
                  endDate: { bsonType: ["date", "null"] },
                  current: { bsonType: "bool" }
                }
              }
            },
            reciprocal: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  organisationId: { bsonType: "objectId" },
                  name: { bsonType: "string" },
                  benefits: {
                    bsonType: "array",
                    items: { bsonType: "string" }
                  },
                  validUntil: { bsonType: ["date", "null"] }
                }
              }
            }
          }
        },
        documents: {
          bsonType: ["object", "null"],
          properties: {
            constitution: {
              bsonType: ["object", "null"],
              properties: {
                uploaded: { bsonType: "bool" },
                uploadedAt: { bsonType: ["date", "null"] },
                documentUrl: { bsonType: ["string", "null"] },
                version: { bsonType: ["string", "null"] }
              }
            },
            insurance: {
              bsonType: ["object", "null"],
              properties: {
                publicLiability: {
                  bsonType: ["object", "null"],
                  properties: {
                    insurer: { bsonType: ["string", "null"] },
                    policyNumber: { bsonType: ["string", "null"] },
                    coverAmount: { bsonType: ["decimal", "null"], minimum: 0 },
                    expiryDate: { bsonType: ["date", "null"] },
                    documentUrl: { bsonType: ["string", "null"] }
                  }
                },
                professionalIndemnity: {
                  bsonType: ["object", "null"],
                  properties: {
                    insurer: { bsonType: ["string", "null"] },
                    policyNumber: { bsonType: ["string", "null"] },
                    coverAmount: { bsonType: ["decimal", "null"], minimum: 0 },
                    expiryDate: { bsonType: ["date", "null"] },
                    documentUrl: { bsonType: ["string", "null"] }
                  }
                }
              }
            },
            compliance: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  type: { bsonType: "string" },
                  year: { bsonType: "int", minimum: 2000, maximum: 2100 },
                  submittedAt: { bsonType: "date" },
                  documentUrl: { bsonType: ["string", "null"] },
                  status: {
                    bsonType: "string",
                    enum: ["pending", "approved", "rejected"]
                  }
                }
              }
            },
            agreements: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  type: { bsonType: "string" },
                  party: { bsonType: "string" },
                  startDate: { bsonType: "date" },
                  endDate: { bsonType: ["date", "null"] },
                  documentUrl: { bsonType: ["string", "null"] },
                  autoRenew: { bsonType: "bool" }
                }
              }
            }
          }
        },
        communications: {
          bsonType: ["object", "null"],
          properties: {
            notifications: {
              bsonType: ["object", "null"],
              properties: {
                newEvents: {
                  bsonType: ["object", "null"],
                  properties: {
                    enabled: { bsonType: "bool" },
                    channels: {
                      bsonType: "array",
                      items: {
                        bsonType: "string",
                        enum: ["email", "sms", "post"]
                      }
                    },
                    recipients: {
                      bsonType: "array",
                      items: { bsonType: "string" }
                    }
                  }
                },
                reminders: {
                  bsonType: ["object", "null"],
                  properties: {
                    enabled: { bsonType: "bool" },
                    daysBefore: {
                      bsonType: "array",
                      items: { bsonType: "int", minimum: 0 }
                    },
                    channels: {
                      bsonType: "array",
                      items: { bsonType: "string" }
                    }
                  }
                },
                announcements: {
                  bsonType: ["object", "null"],
                  properties: {
                    enabled: { bsonType: "bool" },
                    channels: {
                      bsonType: "array",
                      items: { bsonType: "string" }
                    },
                    allMembers: { bsonType: "bool" }
                  }
                }
              }
            },
            bulkCommunication: {
              bsonType: ["object", "null"],
              properties: {
                requireApproval: { bsonType: "bool" },
                approvers: {
                  bsonType: "array",
                  items: { bsonType: "objectId" }
                },
                blackoutDates: {
                  bsonType: "array",
                  items: {
                    bsonType: "object",
                    properties: {
                      startDate: { bsonType: "date" },
                      endDate: { bsonType: "date" },
                      reason: { bsonType: ["string", "null"] }
                    }
                  }
                }
              }
            }
          }
        },
        settings: {
          bsonType: ["object", "null"],
          properties: {
            privacy: {
              bsonType: ["object", "null"],
              properties: {
                listPublicly: { bsonType: "bool" },
                showMemberCount: { bsonType: "bool" },
                allowMemberDirectory: { bsonType: "bool" },
                shareContactDetails: { bsonType: "bool" }
              }
            },
            features: {
              bsonType: ["object", "null"],
              properties: {
                onlineVoting: { bsonType: "bool" },
                memberPortal: { bsonType: "bool" },
                eventHosting: { bsonType: "bool" },
                fundraising: { bsonType: "bool" }
              }
            },
            branding: {
              bsonType: ["object", "null"],
              properties: {
                logo: {
                  bsonType: ["object", "null"],
                  properties: {
                    url: { bsonType: ["string", "null"] },
                    uploadedAt: { bsonType: ["date", "null"] }
                  }
                },
                colors: {
                  bsonType: ["object", "null"],
                  properties: {
                    primary: {
                      bsonType: ["string", "null"],
                      pattern: "^#[0-9A-Fa-f]{6}$"
                    },
                    secondary: {
                      bsonType: ["string", "null"],
                      pattern: "^#[0-9A-Fa-f]{6}$"
                    }
                  }
                },
                customDomain: { bsonType: ["string", "null"] }
              }
            }
          }
        },
        status: {
          bsonType: "string",
          enum: ["active", "suspended", "dissolved", "pending"]
        },
        verification: {
          bsonType: ["object", "null"],
          properties: {
            verified: { bsonType: "bool" },
            verifiedAt: { bsonType: ["date", "null"] },
            verifiedBy: { bsonType: ["objectId", "null"] },
            documents: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  type: { bsonType: "string" },
                  status: {
                    bsonType: "string",
                    enum: ["pending", "approved", "rejected"]
                  },
                  notes: { bsonType: ["string", "null"] }
                }
              }
            }
          }
        },
        metadata: {
          bsonType: "object",
          required: ["createdAt", "updatedAt"],
          properties: {
            source: {
              bsonType: "string",
              enum: ["registration", "import", "admin", "api"]
            },
            tags: {
              bsonType: "array",
              items: { bsonType: "string" }
            },
            createdAt: { bsonType: "date" },
            createdBy: { bsonType: ["objectId", "null"] },
            updatedAt: { bsonType: "date" },
            updatedBy: { bsonType: ["objectId", "null"] },
            importBatchId: { bsonType: ["string", "null"] },
            legacyId: { bsonType: ["string", "null"] },
            migrationNotes: { bsonType: ["string", "null"] }
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

### 1. ABN Validation
```javascript
// Validate Australian Business Number format and checksum
function validateABN(abn) {
  if (!abn || abn.length !== 11) return false;
  
  // Remove spaces
  const cleanABN = abn.replace(/\s/g, '');
  
  // Check all digits
  if (!/^\d{11}$/.test(cleanABN)) return false;
  
  // ABN checksum validation
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  let sum = 0;
  
  // Subtract 1 from first digit
  const digits = cleanABN.split('').map(Number);
  digits[0] -= 1;
  
  // Calculate weighted sum
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }
  
  return sum % 89 === 0;
}
```

### 2. Member Count Validation
```javascript
// Ensure active members doesn't exceed total members
function validateMemberCounts(size) {
  if (!size) return true;
  
  if (size.activeMembers > size.memberCount) {
    return false;
  }
  
  // Validate size category
  if (size.memberCount < 50 && size.category === 'large') {
    return false;
  }
  if (size.memberCount > 200 && size.category === 'small') {
    return false;
  }
  
  return true;
}
```

### 3. Officer Validation
```javascript
// Ensure officers are also members
async function validateOfficers(organisationId, officers, members) {
  const memberUserIds = new Set(members.map(m => m.userId.toString()));
  
  for (const officer of officers) {
    if (!memberUserIds.has(officer.userId.toString())) {
      return false;
    }
    
    // Current officers must have null end date or future end date
    if (officer.current && officer.endDate && officer.endDate < new Date()) {
      return false;
    }
  }
  
  // Check for duplicate current positions
  const currentPositions = new Set();
  for (const officer of officers.filter(o => o.current)) {
    if (currentPositions.has(officer.position)) {
      return false;
    }
    currentPositions.add(officer.position);
  }
  
  return true;
}
```

### 4. Credit Limit Validation
```javascript
// Ensure credit calculations are consistent
function validateCreditLimits(credit) {
  if (!credit) return true;
  
  const calculatedAvailable = credit.limit - credit.used;
  
  // Allow small rounding differences
  if (Math.abs(calculatedAvailable - credit.available) > 0.01) {
    return false;
  }
  
  // Used cannot exceed limit
  if (credit.used > credit.limit) {
    return false;
  }
  
  return true;
}
```

### 5. Insurance Expiry
```javascript
// Check insurance is current for active organisations
function validateInsurance(documents, status) {
  if (status !== 'active') return true;
  
  if (!documents?.insurance) return false;
  
  const now = new Date();
  
  // Public liability is mandatory
  if (!documents.insurance.publicLiability?.expiryDate || 
      documents.insurance.publicLiability.expiryDate < now) {
    return false;
  }
  
  return true;
}
```

## Business Rules

1. **Unique Identifiers**: Organisation ID and ABN must be unique
2. **Contact Requirements**: Primary contact with email is mandatory
3. **Member Management**: Officers must be members of the organisation
4. **Credit Control**: Used credit cannot exceed limit
5. **Insurance Requirements**: Active organisations need current insurance
6. **Tax Compliance**: GST registered organisations need valid ABN
7. **Officer Terms**: No overlapping terms for same position
8. **Parent-Child Consistency**: Child orgs must reference valid parent
9. **Address Requirements**: At least one address (physical or postal)
10. **Verification Process**: Certain documents required for verification

## Pre-save Validation Hook

```javascript
// Example pre-save validation in application
async function validateOrganisation(organisation, isNew = false) {
  // ABN validation
  if (organisation.profile.registration?.abn) {
    if (!validateABN(organisation.profile.registration.abn)) {
      throw new Error('Invalid ABN format or checksum');
    }
    
    // Check ABN uniqueness
    if (isNew || organisation.profile.registration.abn !== organisation._original?.profile.registration.abn) {
      const existing = await db.organisations.findOne({
        "profile.registration.abn": organisation.profile.registration.abn,
        _id: { $ne: organisation._id }
      });
      
      if (existing) {
        throw new Error('ABN already registered');
      }
    }
  }
  
  // Member count validation
  if (organisation.profile.details?.size) {
    if (!validateMemberCounts(organisation.profile.details.size)) {
      throw new Error('Invalid member counts');
    }
  }
  
  // Officer validation
  if (organisation.membership?.officers && organisation.membership?.members) {
    if (!await validateOfficers(
      organisation._id,
      organisation.membership.officers,
      organisation.membership.members
    )) {
      throw new Error('Officers must be members of the organisation');
    }
  }
  
  // Credit validation
  if (organisation.financial?.credit) {
    if (!validateCreditLimits(organisation.financial.credit)) {
      throw new Error('Invalid credit calculations');
    }
  }
  
  // Insurance validation for active orgs
  if (!validateInsurance(organisation.documents, organisation.status)) {
    throw new Error('Active organisations require current insurance');
  }
  
  // Billing address validation
  if (organisation.profile.addresses?.billing?.sameAsPostal) {
    if (!organisation.profile.addresses.postal) {
      throw new Error('Postal address required when billing same as postal');
    }
  }
  
  // Default status for new orgs
  if (isNew && !organisation.status) {
    organisation.status = 'pending';
  }
  
  return true;
}
```

## Security Validations

1. **Banking Details**: Must be encrypted before storage
2. **Member Privacy**: Access controls on member lists
3. **Document Access**: Verify user permissions
4. **Financial Data**: Restricted to authorized roles
5. **Contact Information**: PII protection required