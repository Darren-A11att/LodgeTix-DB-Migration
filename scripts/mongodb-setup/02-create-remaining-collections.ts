// @ts-nocheck
/**
 * MongoDB Collection Creation Script - Remaining Collections
 * 
 * This script creates the remaining collections with their validation rules
 * Run after 01-create-collections.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DB || 'LodgeTix';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

const { MongoClient } = require('mongodb');

async function createRemainingCollections() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    console.log(`Connected to database: ${DATABASE_NAME}`);
    
    // Get existing collections
    const existingCollections = await db.listCollections().toArray();
    const existingNames = existingCollections.map(c => c.name);
    
    // Create invoices collection
    if (!existingNames.includes('invoices')) {
      console.log('Creating invoices collection...');
      await db.createCollection("invoices", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["invoiceNumber", "type", "status", "issuedDate", "parties", "totals", "metadata"],
            properties: {
              invoiceNumber: {
                bsonType: "string",
                pattern: "^INV-[0-9]{4}-[0-9]{5}$",
                description: "Invoice number must follow pattern INV-YYYY-NNNNN"
              },
              type: {
                bsonType: "string",
                enum: ["tax_invoice", "receipt", "proforma", "credit_note"],
                description: "Invoice type"
              },
              status: {
                bsonType: "string",
                enum: ["draft", "sent", "paid", "overdue", "cancelled", "void"],
                description: "Invoice status"
              },
              issuedDate: {
                bsonType: "date",
                description: "Date invoice was issued"
              },
              dueDate: {
                bsonType: ["date", "null"],
                description: "Payment due date"
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
                      name: { bsonType: "string" },
                      abn: { bsonType: ["string", "null"] },
                      address: { bsonType: ["string", "null"] },
                      email: { bsonType: ["string", "null"] },
                      contactPerson: {
                        bsonType: ["object", "null"],
                        properties: {
                          name: { bsonType: "string" },
                          phone: { bsonType: "string" },
                          email: { bsonType: "string" }
                        }
                      }
                    }
                  },
                  supplier: {
                    bsonType: "object",
                    required: ["name", "abn"],
                    properties: {
                      name: { bsonType: "string" },
                      abn: { bsonType: "string" },
                      address: { bsonType: ["string", "null"] }
                    }
                  }
                }
              },
              lineItems: {
                bsonType: "array",
                minItems: 1,
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
                    discount: {
                      bsonType: ["object", "null"],
                      properties: {
                        amount: { bsonType: "decimal" },
                        percentage: { bsonType: "number" }
                      }
                    },
                    taxRate: {
                      bsonType: "number",
                      minimum: 0,
                      maximum: 1
                    },
                    taxAmount: { bsonType: "decimal" },
                    total: { bsonType: "decimal" }
                  }
                }
              },
              totals: {
                bsonType: "object",
                required: ["subtotal", "tax", "total", "currency"],
                properties: {
                  subtotal: { bsonType: "decimal" },
                  discount: { bsonType: ["decimal", "null"] },
                  tax: { bsonType: "decimal" },
                  fees: { bsonType: ["decimal", "null"] },
                  total: { bsonType: "decimal" },
                  paid: { bsonType: ["decimal", "null"] },
                  balance: { bsonType: ["decimal", "null"] },
                  currency: {
                    bsonType: "string",
                    enum: ["AUD", "NZD", "USD", "GBP", "EUR"]
                  }
                }
              },
              payment: {
                bsonType: ["object", "null"],
                properties: {
                  transactionId: { bsonType: "objectId" },
                  method: { bsonType: "string" },
                  paidDate: { bsonType: "date" },
                  reference: { bsonType: "string" }
                }
              },
              references: {
                bsonType: ["object", "null"],
                properties: {
                  registrationId: { bsonType: ["objectId", "null"] },
                  functionId: { bsonType: ["string", "null"] },
                  originalInvoiceNumber: { bsonType: ["string", "null"] },
                  creditNoteNumbers: {
                    bsonType: ["array", "null"],
                    items: { bsonType: "string" }
                  }
                }
              },
              distribution: {
                bsonType: ["object", "null"],
                properties: {
                  emailedTo: {
                    bsonType: "array",
                    items: { bsonType: "string" }
                  },
                  emailedAt: { bsonType: ["date", "null"] },
                  downloadCount: {
                    bsonType: "int",
                    minimum: 0
                  },
                  pdfUrl: { bsonType: ["string", "null"] }
                }
              },
              metadata: {
                bsonType: "object",
                required: ["createdAt"],
                properties: {
                  createdAt: { bsonType: "date" },
                  createdBy: { bsonType: ["objectId", "null"] },
                  updatedAt: { bsonType: ["date", "null"] },
                  updatedBy: { bsonType: ["objectId", "null"] },
                  version: {
                    bsonType: ["int", "null"],
                    minimum: 1
                  }
                }
              }
            }
          }
        },
        validationLevel: "moderate",
        validationAction: "error"
      });
      console.log('✓ Invoices collection created');
    } else {
      console.log('✓ Invoices collection already exists');
    }
    
    // Create jurisdictions collection
    if (!existingNames.includes('jurisdictions')) {
      console.log('Creating jurisdictions collection...');
      await db.createCollection("jurisdictions", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["jurisdictionId", "name", "type", "country", "active"],
            properties: {
              jurisdictionId: {
                bsonType: "string",
                pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                description: "Must be a valid UUID"
              },
              name: {
                bsonType: "string",
                minLength: 1,
                maxLength: 200,
                description: "Jurisdiction name"
              },
              type: {
                bsonType: "string",
                enum: ["grand_lodge", "district", "region", "province"],
                description: "Type of jurisdiction"
              },
              country: {
                bsonType: "string",
                minLength: 2,
                maxLength: 2,
                description: "ISO 3166-1 alpha-2 country code"
              },
              parentJurisdictionId: {
                bsonType: ["string", "null"],
                pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                description: "Reference to parent jurisdiction UUID"
              },
              hierarchy: {
                bsonType: "object",
                properties: {
                  level: {
                    bsonType: "int",
                    minimum: 1,
                    maximum: 5
                  },
                  path: {
                    bsonType: "array",
                    items: { bsonType: "string" }
                  }
                }
              },
              contact: {
                bsonType: ["object", "null"],
                properties: {
                  address: {
                    bsonType: "object",
                    properties: {
                      addressLine1: { bsonType: ["string", "null"] },
                      addressLine2: { bsonType: ["string", "null"] },
                      city: { bsonType: ["string", "null"] },
                      state: { bsonType: ["string", "null"] },
                      postcode: { bsonType: ["string", "null"] },
                      country: { bsonType: ["string", "null"] }
                    }
                  },
                  phone: { bsonType: ["string", "null"] },
                  email: { bsonType: ["string", "null"] },
                  website: { bsonType: ["string", "null"] }
                }
              },
              active: {
                bsonType: "bool",
                description: "Whether jurisdiction is active"
              },
              metadata: {
                bsonType: "object",
                required: ["createdAt"],
                properties: {
                  createdAt: { bsonType: "date" },
                  createdBy: { bsonType: ["objectId", "null"] },
                  updatedAt: { bsonType: ["date", "null"] },
                  updatedBy: { bsonType: ["objectId", "null"] }
                }
              }
            }
          }
        },
        validationLevel: "moderate",
        validationAction: "error"
      });
      console.log('✓ Jurisdictions collection created');
    } else {
      console.log('✓ Jurisdictions collection already exists');
    }
    
    // Create products collection
    if (!existingNames.includes('products')) {
      console.log('Creating products collection...');
      await db.createCollection("products", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["productId", "name", "type", "status", "pricing"],
            properties: {
              productId: {
                bsonType: "string",
                pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                description: "Must be a valid UUID"
              },
              name: {
                bsonType: "string",
                minLength: 1,
                maxLength: 200,
                description: "Product name"
              },
              description: {
                bsonType: ["string", "null"],
                maxLength: 2000
              },
              type: {
                bsonType: "string",
                enum: ["ticket", "merchandise", "accommodation", "addon", "package"],
                description: "Product type"
              },
              category: {
                bsonType: ["string", "null"],
                description: "Product category"
              },
              status: {
                bsonType: "string",
                enum: ["active", "inactive", "archived"],
                description: "Product status"
              },
              eventId: {
                bsonType: ["string", "null"],
                pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                description: "Associated event ID"
              },
              functionId: {
                bsonType: ["string", "null"],
                pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                description: "Associated function ID"
              },
              pricing: {
                bsonType: "object",
                required: ["basePrice", "currency"],
                properties: {
                  basePrice: { 
                    bsonType: "decimal",
                    minimum: 0
                  },
                  currency: {
                    bsonType: "string",
                    enum: ["AUD", "NZD", "USD", "GBP", "EUR"]
                  },
                  taxIncluded: { bsonType: "bool" },
                  taxRate: {
                    bsonType: ["number", "null"],
                    minimum: 0,
                    maximum: 1
                  },
                  tiers: {
                    bsonType: ["array", "null"],
                    items: {
                      bsonType: "object",
                      required: ["name", "price"],
                      properties: {
                        name: { bsonType: "string" },
                        description: { bsonType: ["string", "null"] },
                        price: { bsonType: "decimal" },
                        validFrom: { bsonType: ["date", "null"] },
                        validUntil: { bsonType: ["date", "null"] },
                        conditions: { bsonType: ["object", "null"] }
                      }
                    }
                  }
                }
              },
              inventory: {
                bsonType: ["object", "null"],
                properties: {
                  trackInventory: { bsonType: "bool" },
                  quantity: {
                    bsonType: ["int", "null"],
                    minimum: 0
                  },
                  allocated: {
                    bsonType: ["int", "null"],
                    minimum: 0
                  },
                  available: {
                    bsonType: ["int", "null"],
                    minimum: 0
                  },
                  lowStockThreshold: {
                    bsonType: ["int", "null"],
                    minimum: 0
                  }
                }
              },
              eligibility: {
                bsonType: ["object", "null"],
                properties: {
                  criteria: {
                    bsonType: "array",
                    items: {
                      bsonType: "object",
                      required: ["key", "value"],
                      properties: {
                        key: { bsonType: "string" },
                        value: { bsonType: "string" },
                        operator: {
                          bsonType: "string",
                          enum: ["equals", "contains", "in", "not_in"]
                        }
                      }
                    }
                  }
                }
              },
              images: {
                bsonType: ["array", "null"],
                items: {
                  bsonType: "object",
                  properties: {
                    url: { bsonType: "string" },
                    alt: { bsonType: ["string", "null"] },
                    isPrimary: { bsonType: "bool" }
                  }
                }
              },
              metadata: {
                bsonType: "object",
                required: ["createdAt"],
                properties: {
                  createdAt: { bsonType: "date" },
                  createdBy: { bsonType: ["objectId", "null"] },
                  updatedAt: { bsonType: ["date", "null"] },
                  updatedBy: { bsonType: ["objectId", "null"] },
                  version: {
                    bsonType: ["int", "null"],
                    minimum: 1
                  }
                }
              }
            }
          }
        },
        validationLevel: "moderate",
        validationAction: "error"
      });
      console.log('✓ Products collection created');
    } else {
      console.log('✓ Products collection already exists');
    }
    
    // Create registrations collection
    if (!existingNames.includes('registrations')) {
      console.log('Creating registrations collection...');
      await db.createCollection("registrations", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["registrationNumber", "registrationDate", "functionId", "type", "status", "registrant"],
            properties: {
              registrationNumber: {
                bsonType: "string",
                pattern: "^REG-[0-9]{4}-[0-9]{5}$",
                description: "Registration number must follow pattern REG-YYYY-NNNNN"
              },
              legacyNumber: {
                bsonType: ["string", "null"],
                description: "Legacy registration number from old system"
              },
              registrationDate: {
                bsonType: "date",
                description: "Date of registration"
              },
              functionId: {
                bsonType: "string",
                pattern: "^[a-z0-9-]+$",
                description: "Must be valid function ID"
              },
              type: {
                bsonType: "string",
                enum: ["Individuals", "Lodges", "Delegations"],
                description: "Registration type"
              },
              status: {
                bsonType: "string",
                enum: ["pending", "confirmed", "cancelled", "transferred"],
                description: "Registration status"
              },
              registrant: {
                bsonType: "object",
                required: ["name", "email"],
                properties: {
                  userId: { bsonType: ["objectId", "null"] },
                  contactId: { bsonType: ["objectId", "null"] },
                  organisationId: { bsonType: ["objectId", "null"] },
                  name: { 
                    bsonType: "string",
                    minLength: 1,
                    maxLength: 200
                  },
                  email: { 
                    bsonType: "string",
                    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                  },
                  phone: { bsonType: ["string", "null"] },
                  type: {
                    bsonType: "string",
                    enum: ["individual", "lodge", "organisation"]
                  }
                }
              },
              billing: {
                bsonType: ["object", "null"],
                properties: {
                  contact: {
                    bsonType: "object",
                    properties: {
                      name: { bsonType: ["string", "null"] },
                      email: { bsonType: ["string", "null"] },
                      phone: { bsonType: ["string", "null"] }
                    }
                  },
                  address: {
                    bsonType: "object",
                    properties: {
                      addressLine1: { bsonType: ["string", "null"] },
                      addressLine2: { bsonType: ["string", "null"] },
                      city: { bsonType: ["string", "null"] },
                      state: { bsonType: ["string", "null"] },
                      postcode: { bsonType: ["string", "null"] },
                      country: { bsonType: ["string", "null"] }
                    }
                  },
                  abn: { bsonType: ["string", "null"] },
                  organisationName: { bsonType: ["string", "null"] }
                }
              },
              attendees: {
                bsonType: "array",
                items: {
                  bsonType: "object",
                  required: ["attendeeId"],
                  properties: {
                    attendeeId: { bsonType: "objectId" },
                    isPrimary: { bsonType: "bool" },
                    addedDate: { bsonType: "date" }
                  }
                }
              },
              tickets: {
                bsonType: "array",
                items: {
                  bsonType: "object",
                  required: ["ticketId", "productId"],
                  properties: {
                    ticketId: { bsonType: "objectId" },
                    productId: { bsonType: "objectId" },
                    eventId: { bsonType: ["string", "null"] },
                    quantity: {
                      bsonType: "int",
                      minimum: 1
                    },
                    unitPrice: { bsonType: "decimal" },
                    totalPrice: { bsonType: "decimal" }
                  }
                }
              },
              totals: {
                bsonType: ["object", "null"],
                properties: {
                  subtotal: { bsonType: "decimal" },
                  discount: { bsonType: ["decimal", "null"] },
                  tax: { bsonType: "decimal" },
                  total: { bsonType: "decimal" },
                  paid: { bsonType: ["decimal", "null"] },
                  balance: { bsonType: ["decimal", "null"] },
                  currency: {
                    bsonType: "string",
                    enum: ["AUD", "NZD", "USD", "GBP", "EUR"]
                  }
                }
              },
              payment: {
                bsonType: ["object", "null"],
                properties: {
                  status: {
                    bsonType: "string",
                    enum: ["pending", "partial", "paid", "refunded"]
                  },
                  transactions: {
                    bsonType: "array",
                    items: { bsonType: "objectId" }
                  }
                }
              },
              source: {
                bsonType: ["object", "null"],
                properties: {
                  channel: {
                    bsonType: "string",
                    enum: ["online", "phone", "email", "paper", "import"]
                  },
                  referrer: { bsonType: ["string", "null"] },
                  campaign: { bsonType: ["string", "null"] },
                  device: { bsonType: ["string", "null"] },
                  ipAddress: { bsonType: ["string", "null"] }
                }
              },
              notes: {
                bsonType: ["string", "null"],
                maxLength: 2000
              },
              metadata: {
                bsonType: "object",
                required: ["createdAt"],
                properties: {
                  createdAt: { bsonType: "date" },
                  createdBy: { bsonType: ["objectId", "null"] },
                  updatedAt: { bsonType: ["date", "null"] },
                  updatedBy: { bsonType: ["objectId", "null"] },
                  importId: { bsonType: ["string", "null"] },
                  version: {
                    bsonType: ["int", "null"],
                    minimum: 1
                  }
                }
              }
            }
          }
        },
        validationLevel: "moderate",
        validationAction: "error"
      });
      console.log('✓ Registrations collection created');
    } else {
      console.log('✓ Registrations collection already exists');
    }
    
    // Create tickets collection
    if (!existingNames.includes('tickets')) {
      console.log('Creating tickets collection...');
      await db.createCollection("tickets", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["ticketNumber", "productId", "eventId", "status", "qrCode"],
            properties: {
              ticketNumber: {
                bsonType: "string",
                pattern: "^TKT-[0-9]{4}-[0-9]{7}$",
                description: "Ticket number must follow pattern TKT-YYYY-NNNNNNN"
              },
              productId: {
                bsonType: "objectId",
                description: "Reference to product"
              },
              eventId: {
                bsonType: "string",
                pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                description: "Event UUID"
              },
              functionId: {
                bsonType: "string",
                pattern: "^[a-z0-9-]+$",
                description: "Function slug"
              },
              attendeeId: {
                bsonType: ["objectId", "null"],
                description: "Assigned attendee"
              },
              registrationId: {
                bsonType: "objectId",
                description: "Source registration"
              },
              status: {
                bsonType: "string",
                enum: ["active", "used", "cancelled", "transferred", "expired"],
                description: "Ticket status"
              },
              qrCode: {
                bsonType: "object",
                required: ["code", "format"],
                properties: {
                  code: {
                    bsonType: "string",
                    minLength: 16,
                    description: "Unique QR code value"
                  },
                  format: {
                    bsonType: "string",
                    enum: ["uuid", "custom", "sequential"]
                  },
                  url: { bsonType: ["string", "null"] }
                }
              },
              details: {
                bsonType: ["object", "null"],
                properties: {
                  eventName: { bsonType: "string" },
                  productName: { bsonType: "string" },
                  price: { bsonType: "decimal" },
                  purchaseDate: { bsonType: "date" }
                }
              },
              validity: {
                bsonType: ["object", "null"],
                properties: {
                  validFrom: { bsonType: ["date", "null"] },
                  validUntil: { bsonType: ["date", "null"] },
                  singleUse: { bsonType: "bool" },
                  zones: {
                    bsonType: "array",
                    items: { bsonType: "string" }
                  }
                }
              },
              usage: {
                bsonType: ["object", "null"],
                properties: {
                  used: { bsonType: "bool" },
                  usedAt: { bsonType: ["date", "null"] },
                  usedBy: { bsonType: ["objectId", "null"] },
                  checkInMethod: {
                    bsonType: ["string", "null"],
                    enum: ["qr_scan", "manual", "facial", "rfid", null]
                  },
                  locationId: { bsonType: ["string", "null"] },
                  deviceId: { bsonType: ["string", "null"] }
                }
              },
              transfer: {
                bsonType: ["object", "null"],
                properties: {
                  transferable: { bsonType: "bool" },
                  transferredFrom: { bsonType: ["objectId", "null"] },
                  transferredTo: { bsonType: ["objectId", "null"] },
                  transferDate: { bsonType: ["date", "null"] },
                  transferReason: { bsonType: ["string", "null"] }
                }
              },
              metadata: {
                bsonType: "object",
                required: ["createdAt"],
                properties: {
                  createdAt: { bsonType: "date" },
                  createdBy: { bsonType: ["objectId", "null"] },
                  updatedAt: { bsonType: ["date", "null"] },
                  updatedBy: { bsonType: ["objectId", "null"] },
                  version: {
                    bsonType: ["int", "null"],
                    minimum: 1
                  }
                }
              }
            }
          }
        },
        validationLevel: "moderate",
        validationAction: "error"
      });
      console.log('✓ Tickets collection created');
    } else {
      console.log('✓ Tickets collection already exists');
    }
    
    // Create users collection
    if (!existingNames.includes('users')) {
      console.log('Creating users collection...');
      await db.createCollection("users", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["email", "profile", "status", "metadata"],
            properties: {
              email: {
                bsonType: "string",
                pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                description: "Valid email address"
              },
              password: {
                bsonType: ["string", "null"],
                description: "Hashed password"
              },
              profile: {
                bsonType: "object",
                required: ["firstName", "lastName"],
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
                  displayName: { bsonType: ["string", "null"] },
                  phone: { bsonType: ["string", "null"] },
                  avatar: { bsonType: ["string", "null"] }
                }
              },
              contactId: {
                bsonType: ["objectId", "null"],
                description: "Reference to contacts collection"
              },
              status: {
                bsonType: "string",
                enum: ["active", "inactive", "suspended", "pending"],
                description: "User account status"
              },
              emailVerified: {
                bsonType: "bool",
                description: "Email verification status"
              },
              roles: {
                bsonType: "array",
                items: {
                  bsonType: "string",
                  enum: ["admin", "organiser", "staff", "attendee", "user"]
                }
              },
              permissions: {
                bsonType: ["array", "null"],
                items: { bsonType: "string" }
              },
              authentication: {
                bsonType: ["object", "null"],
                properties: {
                  lastLogin: { bsonType: ["date", "null"] },
                  lastLoginIp: { bsonType: ["string", "null"] },
                  failedAttempts: {
                    bsonType: "int",
                    minimum: 0
                  },
                  lockedUntil: { bsonType: ["date", "null"] },
                  mfa: {
                    bsonType: ["object", "null"],
                    properties: {
                      enabled: { bsonType: "bool" },
                      type: {
                        bsonType: ["string", "null"],
                        enum: ["totp", "sms", "email", null]
                      },
                      secret: { bsonType: ["string", "null"] }
                    }
                  }
                }
              },
              preferences: {
                bsonType: ["object", "null"],
                properties: {
                  language: { bsonType: ["string", "null"] },
                  timezone: { bsonType: ["string", "null"] },
                  notifications: {
                    bsonType: ["object", "null"],
                    properties: {
                      email: { bsonType: "bool" },
                      sms: { bsonType: "bool" },
                      push: { bsonType: "bool" }
                    }
                  }
                }
              },
              metadata: {
                bsonType: "object",
                required: ["createdAt"],
                properties: {
                  createdAt: { bsonType: "date" },
                  createdBy: { bsonType: ["objectId", "null"] },
                  updatedAt: { bsonType: ["date", "null"] },
                  updatedBy: { bsonType: ["objectId", "null"] },
                  lastPasswordChange: { bsonType: ["date", "null"] },
                  version: {
                    bsonType: ["int", "null"],
                    minimum: 1
                  }
                }
              }
            }
          }
        },
        validationLevel: "moderate",
        validationAction: "error"
      });
      console.log('✓ Users collection created');
    } else {
      console.log('✓ Users collection already exists');
    }
    
    // Create organisations collection
    if (!existingNames.includes('organisations')) {
      console.log('Creating organisations collection...');
      await db.createCollection("organisations", {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["organisationId", "name", "type", "status"],
            properties: {
              organisationId: {
                bsonType: "string",
                pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                description: "Must be a valid UUID"
              },
              name: {
                bsonType: "string",
                minLength: 1,
                maxLength: 200,
                description: "Organisation name"
              },
              type: {
                bsonType: "string",
                enum: ["lodge", "grand_lodge", "district", "club", "association", "other"],
                description: "Organisation type"
              },
              status: {
                bsonType: "string",
                enum: ["active", "inactive", "suspended"],
                description: "Organisation status"
              },
              number: {
                bsonType: ["string", "null"],
                description: "Lodge or organisation number"
              },
              jurisdictionId: {
                bsonType: ["string", "null"],
                pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                description: "Parent jurisdiction UUID"
              },
              contact: {
                bsonType: ["object", "null"],
                properties: {
                  address: {
                    bsonType: "object",
                    properties: {
                      addressLine1: { bsonType: ["string", "null"] },
                      addressLine2: { bsonType: ["string", "null"] },
                      city: { bsonType: ["string", "null"] },
                      state: { bsonType: ["string", "null"] },
                      postcode: { bsonType: ["string", "null"] },
                      country: { bsonType: ["string", "null"] }
                    }
                  },
                  phone: { bsonType: ["string", "null"] },
                  email: { bsonType: ["string", "null"] },
                  website: { bsonType: ["string", "null"] }
                }
              },
              officers: {
                bsonType: ["array", "null"],
                items: {
                  bsonType: "object",
                  required: ["contactId", "role", "startDate"],
                  properties: {
                    contactId: { bsonType: "objectId" },
                    role: { bsonType: "string" },
                    title: { bsonType: ["string", "null"] },
                    startDate: { bsonType: "date" },
                    endDate: { bsonType: ["date", "null"] },
                    isPrimary: { bsonType: "bool" }
                  }
                }
              },
              billing: {
                bsonType: ["object", "null"],
                properties: {
                  abn: {
                    bsonType: ["string", "null"],
                    pattern: "^[0-9]{11}$"
                  },
                  tradingName: { bsonType: ["string", "null"] },
                  taxExempt: { bsonType: "bool" },
                  billingContact: {
                    bsonType: ["object", "null"],
                    properties: {
                      name: { bsonType: ["string", "null"] },
                      email: { bsonType: ["string", "null"] },
                      phone: { bsonType: ["string", "null"] }
                    }
                  }
                }
              },
              metadata: {
                bsonType: "object",
                required: ["createdAt"],
                properties: {
                  createdAt: { bsonType: "date" },
                  createdBy: { bsonType: ["objectId", "null"] },
                  updatedAt: { bsonType: ["date", "null"] },
                  updatedBy: { bsonType: ["objectId", "null"] },
                  version: {
                    bsonType: ["int", "null"],
                    minimum: 1
                  }
                }
              }
            }
          }
        },
        validationLevel: "moderate",
        validationAction: "error"
      });
      console.log('✓ Organisations collection created');
    } else {
      console.log('✓ Organisations collection already exists');
    }
    
    console.log('\n✅ All remaining collections created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating collections:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the script
createRemainingCollections().catch(console.error);
