/**
 * MongoDB Collection Creation Script with Validation Rules
 * 
 * This script creates all collections with their schema validation rules
 * It is idempotent - can be run multiple times safely
 */

import { MongoClient, Db, CreateCollectionOptions } from 'mongodb';

const MONGODB_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
const DATABASE_NAME = 'LodgeTix';

interface CollectionInfo {
  name: string;
}

async function createCollections(): Promise<void> {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    
    const db: Db = client.db(DATABASE_NAME);
    console.log(`Connected to database: ${DATABASE_NAME}`);
    
    // Get existing collections
    const existingCollections: CollectionInfo[] = await db.listCollections().toArray();
    const existingNames: string[] = existingCollections.map(c => c.name);
    
    // Create attendees collection
    if (!existingNames.includes('attendees')) {
      console.log('Creating attendees collection...');
      const attendeesOptions: CreateCollectionOptions = {
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
                    pattern: "^\\+?[0-9\\s\\-\\(\\)]+$"
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
      };
      await db.createCollection("attendees", attendeesOptions);
      console.log('✓ Attendees collection created');
    } else {
      console.log('✓ Attendees collection already exists');
    }
    
    // Create contacts collection
    if (!existingNames.includes('contacts')) {
      console.log('Creating contacts collection...');
      const contactsOptions: CreateCollectionOptions = {
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
      };
      await db.createCollection("contacts", contactsOptions);
      console.log('✓ Contacts collection created');
    } else {
      console.log('✓ Contacts collection already exists');
    }
    
    // Create financial-transactions collection
    if (!existingNames.includes('financialTransactions')) {
      console.log('Creating financialTransactions collection...');
      const financialTransactionsOptions: CreateCollectionOptions = {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["transactionId", "type", "reference", "parties", "amounts", "payments", "audit"],
            properties: {
              transactionId: {
                bsonType: "string",
                pattern: "^TXN-[0-9]{4}-[0-9]{5}$",
                description: "Transaction ID must follow pattern TXN-YYYY-NNNNN"
              },
              type: {
                bsonType: "string",
                enum: ["registration_payment", "refund", "adjustment", "transfer", "cancellation_fee"],
                description: "Transaction type must be valid"
              },
              reference: {
                bsonType: "object",
                required: ["type", "id", "functionId"],
                properties: {
                  type: {
                    bsonType: "string",
                    enum: ["registration", "refund", "adjustment"]
                  },
                  id: { bsonType: "objectId" },
                  number: { bsonType: "string" },
                  functionId: { 
                    bsonType: "string",
                    pattern: "^[a-z0-9-]+$"
                  },
                  functionName: { bsonType: "string" }
                }
              },
              parties: {
                bsonType: "object",
                required: ["customer", "supplier"],
                properties: {
                  customer: {
                    bsonType: "object",
                    required: ["type", "id", "name"],
                    properties: {
                      type: {
                        bsonType: "string",
                        enum: ["organisation", "contact", "user"]
                      },
                      id: { bsonType: "objectId" },
                      name: { 
                        bsonType: "string",
                        minLength: 1,
                        maxLength: 200
                      },
                      abn: {
                        bsonType: ["string", "null"],
                        pattern: "^[0-9]{11}$"
                      },
                      email: {
                        bsonType: "string",
                        pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                      },
                      contact: {
                        bsonType: "object",
                        properties: {
                          name: { bsonType: "string" },
                          phone: { 
                            bsonType: "string",
                            pattern: "^\\+?[0-9\\s\\-\\(\\)]+$"
                          }
                        }
                      }
                    }
                  },
                  supplier: {
                    bsonType: "object",
                    required: ["name", "abn"],
                    properties: {
                      name: { bsonType: "string" },
                      abn: {
                        bsonType: "string",
                        pattern: "^[0-9]{11}$"
                      },
                      address: { bsonType: "string" }
                    }
                  }
                }
              },
              amounts: {
                bsonType: "object",
                required: ["gross", "fees", "tax", "net", "total", "currency"],
                properties: {
                  gross: { bsonType: "decimal" },
                  fees: { bsonType: "decimal" },
                  tax: { bsonType: "decimal" },
                  net: { bsonType: "decimal" },
                  total: { bsonType: "decimal" },
                  currency: {
                    bsonType: "string",
                    enum: ["AUD", "NZD", "USD", "GBP", "EUR"]
                  }
                },
                additionalProperties: false
              },
              payments: {
                bsonType: "array",
                minItems: 1,
                items: {
                  bsonType: "object",
                  required: ["_id", "method", "status", "amount", "processedAt"],
                  properties: {
                    _id: { bsonType: "objectId" },
                    method: {
                      bsonType: "string",
                      enum: ["credit_card", "debit_card", "bank_transfer", "paypal", "cash", "cheque"]
                    },
                    gateway: {
                      bsonType: ["string", "null"],
                      enum: ["stripe", "square", "paypal", "manual", null]
                    },
                    gatewayTransactionId: { bsonType: ["string", "null"] },
                    status: {
                      bsonType: "string",
                      enum: ["pending", "processing", "succeeded", "failed", "refunded", "partially_refunded"]
                    },
                    amount: {
                      bsonType: "decimal",
                      minimum: 0
                    },
                    processedAt: { bsonType: "date" },
                    card: {
                      bsonType: ["object", "null"],
                      properties: {
                        last4: {
                          bsonType: "string",
                          pattern: "^[0-9]{4}$"
                        },
                        brand: {
                          bsonType: "string",
                          enum: ["visa", "mastercard", "amex", "discover", "diners", "jcb", "unionpay"]
                        },
                        expiryMonth: {
                          bsonType: "int",
                          minimum: 1,
                          maximum: 12
                        },
                        expiryYear: {
                          bsonType: "int",
                          minimum: 2024,
                          maximum: 2099
                        }
                      }
                    },
                    fees: {
                      bsonType: ["object", "null"],
                      properties: {
                        amount: { bsonType: "decimal" },
                        rate: { bsonType: "string" },
                        breakdown: {
                          bsonType: "object",
                          properties: {
                            percentage: { bsonType: "decimal" },
                            fixed: { bsonType: "decimal" }
                          }
                        }
                      }
                    },
                    metadata: { bsonType: ["object", "null"] }
                  }
                }
              },
              invoices: {
                bsonType: "object",
                properties: {
                  customer: {
                    bsonType: ["object", "null"],
                    properties: {
                      _id: { bsonType: "objectId" },
                      invoiceNumber: {
                        bsonType: "string",
                        pattern: "^INV-[0-9]{4}-[0-9]{5}$"
                      },
                      type: {
                        bsonType: "string",
                        enum: ["tax_invoice", "receipt", "proforma"]
                      },
                      issuedDate: { bsonType: "date" },
                      dueDate: { bsonType: ["date", "null"] },
                      status: {
                        bsonType: "string",
                        enum: ["draft", "sent", "paid", "overdue", "cancelled"]
                      },
                      lineItems: {
                        bsonType: "array",
                        items: {
                          bsonType: "object",
                          required: ["description", "quantity", "unitPrice", "total"],
                          properties: {
                            description: { bsonType: "string" },
                            productId: { bsonType: ["objectId", "null"] },
                            eventId: { bsonType: ["string", "null"] },
                            quantity: {
                              bsonType: "int",
                              minimum: 1
                            },
                            unitPrice: { bsonType: "decimal" },
                            total: { bsonType: "decimal" },
                            taxRate: {
                              bsonType: "number",
                              minimum: 0,
                              maximum: 1
                            },
                            taxAmount: { bsonType: "decimal" }
                          }
                        }
                      },
                      totals: {
                        bsonType: "object",
                        required: ["subtotal", "tax", "total"],
                        properties: {
                          subtotal: { bsonType: "decimal" },
                          tax: { bsonType: "decimal" },
                          fees: { bsonType: ["decimal", "null"] },
                          total: { bsonType: "decimal" }
                        }
                      },
                      pdfUrl: { bsonType: ["string", "null"] },
                      emailedTo: {
                        bsonType: "array",
                        items: {
                          bsonType: "string",
                          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                        }
                      },
                      emailedAt: { bsonType: ["date", "null"] },
                      downloadCount: {
                        bsonType: "int",
                        minimum: 0
                      }
                    }
                  },
                  creditNotes: {
                    bsonType: "array",
                    items: {
                      bsonType: "object",
                      properties: {
                        _id: { bsonType: "objectId" },
                        creditNoteNumber: {
                          bsonType: "string",
                          pattern: "^CN-[0-9]{4}-[0-9]{5}$"
                        },
                        originalInvoiceNumber: { bsonType: "string" },
                        issuedDate: { bsonType: "date" },
                        amount: { bsonType: "decimal" },
                        reason: { bsonType: "string" },
                        status: { bsonType: "string" },
                        pdfUrl: { bsonType: ["string", "null"] }
                      }
                    }
                  },
                  supplier: {
                    bsonType: "array",
                    items: {
                      bsonType: "object"
                    }
                  }
                }
              },
              remittance: {
                bsonType: ["object", "null"],
                properties: {
                  required: { bsonType: "bool" },
                  sentDate: { bsonType: ["date", "null"] },
                  method: {
                    bsonType: ["string", "null"],
                    enum: ["email", "post", "eft", null]
                  },
                  recipient: { bsonType: ["string", "null"] },
                  reference: { bsonType: ["string", "null"] },
                  details: { bsonType: ["object", "null"] }
                }
              },
              reconciliation: {
                bsonType: "object",
                required: ["status"],
                properties: {
                  status: {
                    bsonType: "string",
                    enum: ["pending", "reconciled", "disputed", "exception", "void"]
                  },
                  reconciledDate: { bsonType: ["date", "null"] },
                  reconciledBy: { bsonType: ["string", "null"] },
                  bankStatementRef: { bsonType: ["string", "null"] },
                  bankDate: { bsonType: ["date", "null"] },
                  notes: { bsonType: ["string", "null"] }
                }
              },
              accounting: {
                bsonType: ["object", "null"],
                properties: {
                  exported: { bsonType: "bool" },
                  exportedAt: { bsonType: ["date", "null"] },
                  exportBatchId: { bsonType: ["string", "null"] },
                  entries: {
                    bsonType: "array",
                    items: {
                      bsonType: "object",
                      required: ["account", "debit", "credit"],
                      properties: {
                        account: { bsonType: "string" },
                        accountName: { bsonType: "string" },
                        debit: { bsonType: "decimal" },
                        credit: { bsonType: "decimal" },
                        description: { bsonType: "string" }
                      }
                    }
                  },
                  externalReferences: {
                    bsonType: "object",
                    properties: {
                      xeroId: { bsonType: ["string", "null"] },
                      myobId: { bsonType: ["string", "null"] },
                      quickbooksId: { bsonType: ["string", "null"] }
                    }
                  }
                }
              },
              refund: {
                bsonType: ["object", "null"],
                properties: {
                  originalTransactionId: { bsonType: "objectId" },
                  reason: { bsonType: "string" },
                  requestedBy: { bsonType: "objectId" },
                  approvedBy: { bsonType: ["objectId", "null"] },
                  items: {
                    bsonType: "array",
                    items: {
                      bsonType: "object",
                      properties: {
                        description: { bsonType: "string" },
                        quantity: { bsonType: "int" },
                        amount: { bsonType: "decimal" }
                      }
                    }
                  }
                }
              },
              audit: {
                bsonType: "object",
                required: ["createdAt", "createdBy", "updatedAt", "updatedBy"],
                properties: {
                  createdAt: { bsonType: "date" },
                  createdBy: { bsonType: "string" },
                  updatedAt: { bsonType: "date" },
                  updatedBy: { bsonType: "string" },
                  version: {
                    bsonType: "int",
                    minimum: 1
                  },
                  changes: {
                    bsonType: "array",
                    items: {
                      bsonType: "object",
                      properties: {
                        timestamp: { bsonType: "date" },
                        userId: { bsonType: "string" },
                        action: { bsonType: "string" },
                        field: { bsonType: "string" },
                        oldValue: { },
                        newValue: { },
                        reason: { bsonType: "string" }
                      }
                    }
                  },
                  notes: {
                    bsonType: "array",
                    items: {
                      bsonType: "object",
                      properties: {
                        timestamp: { bsonType: "date" },
                        userId: { bsonType: "string" },
                        note: { bsonType: "string" },
                        type: {
                          bsonType: "string",
                          enum: ["general", "dispute", "reconciliation", "audit"]
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        validationLevel: "strict",
        validationAction: "error"
      };
      await db.createCollection("financialTransactions", financialTransactionsOptions);
      console.log('✓ FinancialTransactions collection created');
    } else {
      console.log('✓ FinancialTransactions collection already exists');
    }
    
    // Create functions collection
    if (!existingNames.includes('functions')) {
      console.log('Creating functions collection...');
      const functionsOptions: CreateCollectionOptions = {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["functionId", "name", "slug", "dates"],
            properties: {
              functionId: {
                bsonType: "string",
                pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                description: "Must be a valid UUID"
              },
              name: {
                bsonType: "string",
                minLength: 1,
                maxLength: 200,
                description: "Function name is required"
              },
              description: {
                bsonType: ["string", "null"],
                maxLength: 2000,
                description: "Function description"
              },
              slug: {
                bsonType: "string",
                pattern: "^[a-z0-9-]+$",
                description: "URL-friendly slug, lowercase with hyphens"
              },
              dates: {
                bsonType: "object",
                required: ["createdAt", "updatedAt"],
                properties: {
                  publishedDate: { bsonType: ["date", "null"] },
                  onSaleDate: { bsonType: ["date", "null"] },
                  closedDate: { bsonType: ["date", "null"] },
                  startDate: { bsonType: ["date", "null"] },
                  endDate: { bsonType: ["date", "null"] },
                  createdAt: { bsonType: "date" },
                  updatedAt: { bsonType: "date" }
                }
              },
              events: {
                bsonType: "array",
                items: {
                  bsonType: "object",
                  required: ["event_id", "name", "type", "slug"],
                  properties: {
                    event_id: {
                      bsonType: "string",
                      pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
                    },
                    name: { bsonType: "string" },
                    type: { bsonType: "string" },
                    slug: { 
                      bsonType: "string",
                      pattern: "^[a-z0-9-]+$"
                    },
                    details: {
                      bsonType: "object",
                      properties: {
                        subtitle: { bsonType: ["string", "null"] },
                        description: { bsonType: ["string", "null"] },
                        type: { bsonType: ["string", "null"] },
                        hero_image: { bsonType: ["string", "null"] },
                        inclusions: { bsonType: ["string", "null"] },
                        importantDetails: { bsonType: ["string", "null"] }
                      }
                    },
                    location: {
                      bsonType: "object",
                      properties: {
                        location_id: {
                          bsonType: "string",
                          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
                        },
                        name: { bsonType: ["string", "null"] },
                        description: { bsonType: ["string", "null"] },
                        room_area: { bsonType: ["string", "null"] },
                        address: {
                          bsonType: "object",
                          properties: {
                            addressLine1: { bsonType: ["string", "null"] },
                            addressLine2: { bsonType: ["string", "null"] },
                            suburb: { bsonType: ["string", "null"] },
                            postcode: { bsonType: ["string", "null"] },
                            state_territory: { bsonType: ["string", "null"] },
                            country: { bsonType: ["string", "null"] }
                          }
                        },
                        details: {
                          bsonType: "object",
                          properties: {
                            parking: { bsonType: ["string", "null"] },
                            public_transport: { bsonType: ["string", "null"] },
                            google_maps_embed_url: { bsonType: ["string", "null"] },
                            features: { bsonType: ["string", "null"] },
                            dress_code: { bsonType: ["string", "null"] }
                          }
                        },
                        images: {
                          bsonType: "array",
                          items: { bsonType: "string" }
                        }
                      }
                    },
                    eligibility: {
                      bsonType: "object",
                      properties: {
                        criteria: {
                          bsonType: "array",
                          items: {
                            bsonType: "object",
                            required: ["index", "key", "value"],
                            properties: {
                              index: { bsonType: "int" },
                              key: { bsonType: "string" },
                              value: { bsonType: "string" }
                            }
                          }
                        }
                      }
                    },
                    published: { bsonType: ["bool", "null"] },
                    featured: { bsonType: ["bool", "null"] }
                  }
                }
              },
              registrations: {
                bsonType: "array",
                items: {
                  bsonType: "object",
                  required: ["_id", "registrationNumber", "registrationDate", "type", "status"],
                  properties: {
                    _id: { bsonType: "objectId" },
                    registrationNumber: { bsonType: "string" },
                    registrationDate: { bsonType: "date" },
                    type: { 
                      bsonType: "string",
                      enum: ["Individuals", "Lodges", "Delegations"]
                    },
                    status: { 
                      bsonType: "string",
                      enum: ["pending", "confirmed", "cancelled"]
                    },
                    billing_details: {
                      bsonType: "object",
                      properties: {
                        contact: {
                          bsonType: "object",
                          properties: {
                            name: { bsonType: ["string", "null"] },
                            email: { bsonType: ["string", "null"] },
                            phone: { bsonType: ["string", "null"] }
                          }
                        },
                        payment_details: {
                          bsonType: "object",
                          properties: {
                            method: { bsonType: ["string", "null"] },
                            transactionId: { bsonType: ["string", "null"] },
                            amount: { bsonType: ["number", "null"] },
                            currency: { bsonType: ["string", "null"] },
                            paidDate: { bsonType: ["date", "null"] }
                          }
                        }
                      }
                    },
                    attendees: {
                      bsonType: "array",
                      items: {
                        bsonType: "object",
                        required: ["_id", "attendeeType", "firstName", "lastName"],
                        properties: {
                          _id: { bsonType: "objectId" },
                          attendeeId: { 
                            bsonType: "string",
                            pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
                          },
                          attendeeType: { 
                            bsonType: "string",
                            enum: ["mason", "guest"]
                          },
                          isPrimary: { bsonType: ["bool", "null"] },
                          title: { bsonType: ["string", "null"] },
                          firstName: { bsonType: "string" },
                          lastName: { bsonType: "string" },
                          email: { bsonType: ["string", "null"] },
                          phone: { bsonType: ["string", "null"] },
                          contactPreference: { 
                            bsonType: ["string", "null"],
                            enum: ["directly", "primaryattendee", null]
                          },
                          dietaryRequirements: { bsonType: ["string", "null"] },
                          specialNeeds: { bsonType: ["string", "null"] },
                          // Masonic information
                          masonicProfile: {
                            bsonType: ["object", "null"],
                            properties: {
                              rank: { bsonType: "string" },
                              primaryLodge: {
                                bsonType: "object",
                                properties: {
                                  id: { bsonType: "string" },
                                  nameNumber: { bsonType: "string" }
                                }
                              },
                              grandLodge: {
                                bsonType: "object",
                                properties: {
                                  id: { bsonType: "string" },
                                  name: { bsonType: "string" },
                                  rank: { bsonType: ["string", "null"] },
                                  office: { bsonType: ["string", "null"] },
                                  officerStatus: { bsonType: ["string", "null"] }
                                }
                              },
                              masonicOrders: {
                                bsonType: "array",
                                items: { bsonType: "object" }
                              }
                            }
                          },
                          // Relationships
                          relationships: {
                            bsonType: ["object", "null"],
                            properties: {
                              type: { 
                                bsonType: "string",
                                enum: ["partner", "guest_of"]
                              },
                              relatedTo: { bsonType: "string" },
                              relationship: { bsonType: "string" }
                            }
                          },
                          ticketsPurchased: {
                            bsonType: "array",
                            items: { bsonType: "objectId" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        validationLevel: "moderate",
        validationAction: "warn"
      };
      await db.createCollection("functions", functionsOptions);
      console.log('✓ Functions collection created');
    } else {
      console.log('✓ Functions collection already exists');
    }
    
    // Create other collections without validation for now (will be added based on their validation files)
    const otherCollections: string[] = ['invoices', 'jurisdictions', 'organisations', 'products', 'registrations', 'tickets', 'users'];
    
    for (const collectionName of otherCollections) {
      if (!existingNames.includes(collectionName)) {
        console.log(`Creating ${collectionName} collection...`);
        await db.createCollection(collectionName);
        console.log(`✓ ${collectionName} collection created`);
      } else {
        console.log(`✓ ${collectionName} collection already exists`);
      }
    }
    
    console.log('\n✅ All collections created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating collections:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the script
createCollections().catch(console.error);