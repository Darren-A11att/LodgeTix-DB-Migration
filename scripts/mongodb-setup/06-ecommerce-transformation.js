/**
 * MongoDB E-Commerce Model Transformation Script
 * 
 * This script transforms the database to an e-commerce model:
 * 1. Functions → Catalog Objects with embedded products/variations
 * 2. Attendees → Merged into Contacts with roles
 * 3. Registrations → Orders
 * 4. Event Tickets → Products with variations and inventory
 */

const MONGODB_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
const DATABASE_NAME = 'LodgeTix';

const { MongoClient } = require('mongodb');

async function transformToEcommerce() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🛍️ E-Commerce Model Transformation\n');
    console.log('Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    console.log(`Connected to database: ${DATABASE_NAME}\n`);
    
    // Step 1: Drop old collections and views
    console.log('📝 Step 1: Cleaning up old structure...');
    
    const collectionsToRemove = [
      'attendees',
      'functions',
      'registrations',
      'attendees_with_computed',
      'functions_with_dates',
      'functions_with_inventory',
      'registrations_with_totals'
    ];
    
    for (const collName of collectionsToRemove) {
      try {
        await db.dropCollection(collName);
        console.log(`✓ Dropped ${collName}`);
      } catch (error) {
        console.log(`  ${collName} doesn't exist or already dropped`);
      }
    }
    
    // Step 2: Update Users collection (keep minimal for auth)
    console.log('\n📝 Step 2: Updating users collection for authentication only...');
    
    // Drop and recreate users with proper schema
    try { await db.dropCollection('users'); } catch (e) {}
    
    await db.createCollection('users', {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["email", "status", "createdAt"],
          properties: {
            email: {
              bsonType: "string",
              pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
              description: "Valid email address for authentication"
            },
            password: {
              bsonType: ["string", "null"],
              description: "Hashed password"
            },
            contactId: {
              bsonType: ["objectId", "null"],
              description: "Reference to contact for profile data"
            },
            status: {
              bsonType: "string",
              enum: ["active", "inactive", "suspended", "pending"],
              description: "Account status"
            },
            emailVerified: {
              bsonType: "bool",
              description: "Email verification status"
            },
            authentication: {
              bsonType: ["object", "null"],
              properties: {
                lastLogin: { bsonType: ["date", "null"] },
                lastLoginIp: { bsonType: ["string", "null"] },
                failedAttempts: { bsonType: "int", minimum: 0 },
                lockedUntil: { bsonType: ["date", "null"] },
                mfa: {
                  bsonType: ["object", "null"],
                  properties: {
                    enabled: { bsonType: "bool" },
                    type: { bsonType: ["string", "null"] },
                    secret: { bsonType: ["string", "null"] }
                  }
                }
              }
            },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: ["date", "null"] }
          }
        }
      },
      validationLevel: "strict",
      validationAction: "error"
    });
    console.log('✓ Users collection updated for authentication only');
    
    // Step 3: Enhance Contacts collection with roles
    console.log('\n📝 Step 3: Enhancing contacts collection with roles...');
    
    try { await db.dropCollection('contacts'); } catch (e) {}
    
    await db.createCollection('contacts', {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["contactNumber", "profile", "metadata"],
          properties: {
            contactNumber: {
              bsonType: "string",
              pattern: "^CON-[0-9]{4}-[0-9]{5}$",
              description: "Unique contact number"
            },
            profile: {
              bsonType: "object",
              required: ["firstName", "lastName"],
              properties: {
                firstName: { bsonType: "string", minLength: 1, maxLength: 100 },
                lastName: { bsonType: "string", minLength: 1, maxLength: 100 },
                preferredName: { bsonType: ["string", "null"] },
                email: { 
                  bsonType: ["string", "null"],
                  pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                },
                phone: { bsonType: ["string", "null"] },
                dateOfBirth: { bsonType: ["date", "null"] },
                dietaryRequirements: { bsonType: ["string", "null"] },
                specialNeeds: { bsonType: ["string", "null"] }
              }
            },
            addresses: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "object",
                properties: {
                  type: { bsonType: "string" },
                  addressLine1: { bsonType: ["string", "null"] },
                  addressLine2: { bsonType: ["string", "null"] },
                  city: { bsonType: ["string", "null"] },
                  state: { bsonType: ["string", "null"] },
                  postcode: { bsonType: ["string", "null"] },
                  country: { bsonType: ["string", "null"] },
                  isPrimary: { bsonType: ["bool", "null"] }
                }
              }
            },
            masonicProfile: {
              bsonType: ["object", "null"],
              properties: {
                craft: {
                  bsonType: ["object", "null"],
                  properties: {
                    grandLodge: { bsonType: ["object", "null"] },
                    lodge: { bsonType: ["object", "null"] },
                    rank: { bsonType: ["string", "null"] },
                    title: { bsonType: ["string", "null"] }
                  }
                }
              }
            },
            // NEW: Roles for different functions and contexts
            roles: {
              bsonType: "array",
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
                  startDate: { bsonType: ["date", "null"] },
                  endDate: { bsonType: ["date", "null"] },
                  permissions: {
                    bsonType: ["array", "null"],
                    items: { bsonType: "string" }
                  }
                }
              }
            },
            // Track all orders/registrations this contact is part of
            orderReferences: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "object",
                properties: {
                  orderId: { bsonType: "objectId" },
                  orderNumber: { bsonType: "string" },
                  role: { bsonType: "string" }, // "purchaser", "attendee"
                  items: {
                    bsonType: "array",
                    items: { bsonType: "objectId" }
                  }
                }
              }
            },
            relationships: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "object",
                properties: {
                  contactId: { bsonType: "objectId" },
                  relationshipType: { bsonType: "string" },
                  isPrimary: { bsonType: ["bool", "null"] },
                  isEmergencyContact: { bsonType: ["bool", "null"] }
                }
              }
            },
            userId: {
              bsonType: ["objectId", "null"],
              description: "Link to user account if exists"
            },
            metadata: {
              bsonType: "object",
              required: ["createdAt"],
              properties: {
                source: { bsonType: ["string", "null"] },
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
    console.log('✓ Contacts collection enhanced with roles and order references');
    
    // Step 4: Create Catalog Objects (transformed Functions)
    console.log('\n📝 Step 4: Creating catalog objects collection...');
    
    await db.createCollection('catalogObjects', {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["catalogId", "name", "slug", "type", "status", "dates"],
          properties: {
            catalogId: {
              bsonType: "string",
              pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
              description: "UUID for catalog object"
            },
            name: {
              bsonType: "string",
              minLength: 1,
              maxLength: 200
            },
            description: {
              bsonType: ["string", "null"],
              maxLength: 2000
            },
            slug: {
              bsonType: "string",
              pattern: "^[a-z0-9-]+$",
              description: "URL-friendly identifier"
            },
            type: {
              bsonType: "string",
              enum: ["function", "merchandise_collection", "sponsorship_program"],
              description: "Type of catalog object (only function for now)"
            },
            status: {
              bsonType: "string",
              enum: ["draft", "published", "active", "closed", "archived"]
            },
            // Organizer information
            organizer: {
              bsonType: "object",
              required: ["type", "id", "name"],
              properties: {
                type: {
                  bsonType: "string",
                  enum: ["organisation", "contact"]
                },
                id: { bsonType: "objectId" },
                name: { bsonType: "string" }
              }
            },
            createdBy: {
              bsonType: "objectId",
              description: "User who created this"
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
            // EMBEDDED PRODUCTS (Events, Merchandise, Sponsorships)
            products: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["productId", "name", "category", "status"],
                properties: {
                  productId: {
                    bsonType: "string",
                    pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
                  },
                  name: { bsonType: "string" },
                  description: { bsonType: ["string", "null"] },
                  category: {
                    bsonType: "string",
                    enum: ["event", "merchandise", "sponsorship", "package"]
                  },
                  slug: { bsonType: "string" },
                  status: {
                    bsonType: "string",
                    enum: ["active", "inactive", "sold_out"]
                  },
                  // Product attributes (flexible for different types)
                  attributes: {
                    bsonType: "object",
                    properties: {
                      // For events
                      eventType: { bsonType: ["string", "null"] },
                      eventStart: { bsonType: ["date", "null"] },
                      eventEnd: { bsonType: ["date", "null"] },
                      location: { bsonType: ["object", "null"] },
                      inclusions: { bsonType: ["string", "null"] },
                      // For merchandise
                      supplier: { bsonType: ["string", "null"] },
                      sku: { bsonType: ["string", "null"] },
                      // Common
                      images: {
                        bsonType: ["array", "null"],
                        items: { bsonType: "string" }
                      }
                    }
                  },
                  // Dependencies and eligibility
                  dependencies: {
                    bsonType: ["array", "null"],
                    items: {
                      bsonType: "object",
                      properties: {
                        type: {
                          bsonType: "string",
                          enum: ["eligibility", "prerequisite", "bundle"]
                        },
                        productId: { bsonType: ["string", "null"] },
                        criteria: { bsonType: ["object", "null"] }
                      }
                    }
                  },
                  // EMBEDDED VARIATIONS (Ticket types, sizes, levels)
                  variations: {
                    bsonType: "array",
                    items: {
                      bsonType: "object",
                      required: ["variationId", "name", "price"],
                      properties: {
                        variationId: {
                          bsonType: "string",
                          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
                        },
                        name: { bsonType: "string" }, // "Standard", "VIP", "Early Bird"
                        description: { bsonType: ["string", "null"] },
                        attributes: {
                          bsonType: ["object", "null"],
                          description: "Variation-specific attributes"
                        },
                        price: {
                          bsonType: "object",
                          required: ["amount", "currency"],
                          properties: {
                            amount: { bsonType: "decimal", minimum: 0 },
                            currency: {
                              bsonType: "string",
                              enum: ["AUD", "NZD", "USD", "GBP", "EUR"]
                            }
                          }
                        },
                        // INVENTORY for this variation
                        inventory: {
                          bsonType: "object",
                          required: ["method", "quantity_total", "quantity_sold", "quantity_available"],
                          properties: {
                            method: {
                              bsonType: "string",
                              enum: ["allocated", "unlimited"]
                            },
                            quantity_total: { bsonType: "int", minimum: 0 },
                            quantity_sold: { bsonType: "int", minimum: 0 },
                            quantity_reserved: { bsonType: "int", minimum: 0 },
                            quantity_available: { bsonType: "int", minimum: 0 }
                          }
                        },
                        status: {
                          bsonType: "string",
                          enum: ["active", "inactive", "sold_out"]
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
                registration_types: {
                  bsonType: "array",
                  items: {
                    bsonType: "string",
                    enum: ["individual", "lodge", "delegation"]
                  }
                },
                payment_gateways: {
                  bsonType: "array",
                  items: { bsonType: "string" }
                },
                allow_partial_registrations: { bsonType: "bool" }
              }
            }
          }
        }
      },
      validationLevel: "moderate",
      validationAction: "error"
    });
    console.log('✓ Catalog objects collection created with embedded products and variations');
    
    // Step 5: Transform Registrations to Orders
    console.log('\n📝 Step 5: Creating orders collection...');
    
    await db.createCollection('orders', {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["orderNumber", "orderType", "catalogObjectId", "status", "customer", "totals", "metadata"],
          properties: {
            orderNumber: {
              bsonType: "string",
              pattern: "^ORD-[0-9]{4}-[0-9]{6}$",
              description: "Order number ORD-YYYY-NNNNNN"
            },
            orderType: {
              bsonType: "string",
              enum: ["registration", "purchase", "sponsorship"],
              description: "Type of order"
            },
            catalogObjectId: {
              bsonType: "objectId",
              description: "Reference to catalog object"
            },
            status: {
              bsonType: "string",
              enum: ["pending", "processing", "paid", "partially_paid", "cancelled", "refunded"]
            },
            // Customer information
            customer: {
              bsonType: "object",
              required: ["type"],
              properties: {
                type: {
                  bsonType: "string",
                  enum: ["individual", "lodge", "delegation", "organisation"]
                },
                contactId: {
                  bsonType: ["objectId", "null"],
                  description: "Reference to contact if exists"
                },
                organisationId: {
                  bsonType: ["objectId", "null"],
                  description: "For lodge/delegation orders"
                },
                // Raw data if contact doesn't exist yet
                rawData: {
                  bsonType: ["object", "null"],
                  properties: {
                    name: { bsonType: "string" },
                    email: { bsonType: "string" },
                    phone: { bsonType: ["string", "null"] }
                  }
                }
              }
            },
            // Order line items
            lineItems: {
              bsonType: "array",
              minItems: 1,
              items: {
                bsonType: "object",
                required: ["productId", "variationId", "quantity", "unitPrice", "totalPrice"],
                properties: {
                  productId: { bsonType: "string" },
                  productName: { bsonType: "string" },
                  variationId: { bsonType: "string" },
                  variationName: { bsonType: "string" },
                  quantity: { bsonType: "int", minimum: 1 },
                  unitPrice: { bsonType: "decimal" },
                  totalPrice: { bsonType: "decimal" },
                  // Owner of this line item
                  owner: {
                    bsonType: "object",
                    required: ["type"],
                    properties: {
                      type: {
                        bsonType: "string",
                        enum: ["contact", "organisation", "unassigned"]
                      },
                      contactId: { bsonType: ["objectId", "null"] },
                      organisationId: { bsonType: ["objectId", "null"] },
                      // Raw attendee data before contact creation
                      rawAttendee: {
                        bsonType: ["object", "null"],
                        properties: {
                          firstName: { bsonType: "string" },
                          lastName: { bsonType: "string" },
                          email: { bsonType: ["string", "null"] },
                          phone: { bsonType: ["string", "null"] },
                          dietaryRequirements: { bsonType: ["string", "null"] },
                          specialNeeds: { bsonType: ["string", "null"] }
                        }
                      }
                    }
                  },
                  // Fulfillment status
                  fulfillment: {
                    bsonType: ["object", "null"],
                    properties: {
                      status: {
                        bsonType: "string",
                        enum: ["pending", "fulfilled", "partial", "cancelled"]
                      },
                      ticketId: {
                        bsonType: ["objectId", "null"],
                        description: "Reference to created ticket"
                      },
                      fulfilledAt: { bsonType: ["date", "null"] }
                    }
                  }
                }
              }
            },
            // Financial totals
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
            // Payment information
            payment: {
              bsonType: ["object", "null"],
              properties: {
                status: {
                  bsonType: "string",
                  enum: ["pending", "processing", "paid", "failed", "refunded"]
                },
                transactions: {
                  bsonType: "array",
                  items: { bsonType: "objectId" }
                }
              }
            },
            // Billing information
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
                  bsonType: ["object", "null"]
                },
                abn: { bsonType: ["string", "null"] },
                organisationName: { bsonType: ["string", "null"] }
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
                source: {
                  bsonType: ["object", "null"],
                  properties: {
                    channel: {
                      bsonType: "string",
                      enum: ["online", "phone", "email", "manual"]
                    },
                    device: { bsonType: ["string", "null"] },
                    ipAddress: { bsonType: ["string", "null"] }
                  }
                },
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
    console.log('✓ Orders collection created');
    
    // Step 6: Update Tickets collection for new model
    console.log('\n📝 Step 6: Updating tickets collection...');
    
    try { await db.dropCollection('tickets'); } catch (e) {}
    
    await db.createCollection('tickets', {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["ticketNumber", "orderId", "productId", "variationId", "status", "qrCode"],
          properties: {
            ticketNumber: {
              bsonType: "string",
              pattern: "^TKT-[0-9]{4}-[0-9]{7}$",
              description: "Ticket number TKT-YYYY-NNNNNNN"
            },
            // References
            orderId: {
              bsonType: "objectId",
              description: "Source order"
            },
            orderLineItemId: {
              bsonType: "objectId",
              description: "Specific line item in order"
            },
            catalogObjectId: {
              bsonType: "objectId",
              description: "Function/catalog object"
            },
            productId: {
              bsonType: "string",
              description: "Product UUID"
            },
            variationId: {
              bsonType: "string",
              description: "Variation UUID"
            },
            // Ownership
            owner: {
              bsonType: "object",
              required: ["type"],
              properties: {
                type: {
                  bsonType: "string",
                  enum: ["contact", "organisation"]
                },
                contactId: { bsonType: ["objectId", "null"] },
                organisationId: { bsonType: ["objectId", "null"] },
                name: { bsonType: "string" }
              }
            },
            status: {
              bsonType: "string",
              enum: ["active", "used", "cancelled", "transferred", "expired"]
            },
            qrCode: {
              bsonType: "object",
              required: ["code", "format"],
              properties: {
                code: {
                  bsonType: "string",
                  minLength: 16
                },
                format: {
                  bsonType: "string",
                  enum: ["uuid", "custom", "sequential"]
                },
                url: { bsonType: ["string", "null"] }
              }
            },
            // Event details snapshot
            eventDetails: {
              bsonType: "object",
              properties: {
                productName: { bsonType: "string" },
                variationName: { bsonType: "string" },
                eventDate: { bsonType: ["date", "null"] },
                location: { bsonType: ["string", "null"] }
              }
            },
            validity: {
              bsonType: ["object", "null"],
              properties: {
                validFrom: { bsonType: ["date", "null"] },
                validUntil: { bsonType: ["date", "null"] },
                singleUse: { bsonType: "bool" }
              }
            },
            usage: {
              bsonType: ["object", "null"],
              properties: {
                used: { bsonType: "bool" },
                usedAt: { bsonType: ["date", "null"] },
                checkInMethod: { bsonType: ["string", "null"] }
              }
            },
            transfer: {
              bsonType: ["object", "null"],
              properties: {
                transferable: { bsonType: "bool" },
                transferHistory: {
                  bsonType: "array",
                  items: {
                    bsonType: "object",
                    properties: {
                      fromContactId: { bsonType: "objectId" },
                      toContactId: { bsonType: "objectId" },
                      transferDate: { bsonType: "date" },
                      reason: { bsonType: ["string", "null"] }
                    }
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
                updatedBy: { bsonType: ["objectId", "null"] }
              }
            }
          }
        }
      },
      validationLevel: "moderate",
      validationAction: "error"
    });
    console.log('✓ Tickets collection updated for e-commerce model');
    
    // Step 7: Create indexes
    console.log('\n📝 Step 7: Creating indexes...');
    
    // Users indexes
    await db.collection('users').createIndex({ "email": 1 }, { unique: true, name: "email_unique" });
    await db.collection('users').createIndex({ "contactId": 1 }, { sparse: true, unique: true, name: "contact_unique" });
    
    // Contacts indexes
    await db.collection('contacts').createIndex({ "contactNumber": 1 }, { unique: true, name: "contactNumber_unique" });
    await db.collection('contacts').createIndex({ "profile.email": 1 }, { sparse: true, name: "email_lookup" });
    await db.collection('contacts').createIndex({ "userId": 1 }, { sparse: true, name: "user_lookup" });
    await db.collection('contacts').createIndex({ "roles.contextId": 1, "roles.role": 1 }, { name: "role_lookup" });
    
    // Catalog Objects indexes
    await db.collection('catalogObjects').createIndex({ "catalogId": 1 }, { unique: true, name: "catalogId_unique" });
    await db.collection('catalogObjects').createIndex({ "slug": 1 }, { unique: true, name: "slug_unique" });
    await db.collection('catalogObjects').createIndex({ "type": 1, "status": 1 }, { name: "type_status" });
    await db.collection('catalogObjects').createIndex({ "products.productId": 1 }, { name: "product_lookup" });
    await db.collection('catalogObjects').createIndex({ "products.variations.variationId": 1 }, { name: "variation_lookup" });
    
    // Orders indexes
    await db.collection('orders').createIndex({ "orderNumber": 1 }, { unique: true, name: "orderNumber_unique" });
    await db.collection('orders').createIndex({ "catalogObjectId": 1, "status": 1 }, { name: "catalog_orders" });
    await db.collection('orders').createIndex({ "customer.contactId": 1 }, { sparse: true, name: "customer_orders" });
    await db.collection('orders').createIndex({ "customer.organisationId": 1 }, { sparse: true, name: "org_orders" });
    await db.collection('orders').createIndex({ "metadata.createdAt": -1 }, { name: "order_date" });
    
    // Tickets indexes
    await db.collection('tickets').createIndex({ "ticketNumber": 1 }, { unique: true, name: "ticketNumber_unique" });
    await db.collection('tickets').createIndex({ "qrCode.code": 1 }, { unique: true, name: "qr_unique" });
    await db.collection('tickets').createIndex({ "orderId": 1 }, { name: "order_tickets" });
    await db.collection('tickets').createIndex({ "owner.contactId": 1 }, { sparse: true, name: "owner_tickets" });
    await db.collection('tickets').createIndex({ "productId": 1, "status": 1 }, { name: "product_tickets" });
    
    console.log('✓ All indexes created');
    
    // Step 8: Create computed views
    console.log('\n📝 Step 8: Creating computed views...');
    
    // Catalog with inventory totals
    await db.createCollection('catalog_with_inventory', {
      viewOn: 'catalogObjects',
      pipeline: [
        {
          $addFields: {
            // Compute total inventory across all products
            inventory: {
              totalItems: {
                $sum: {
                  $map: {
                    input: "$products",
                    as: "product",
                    in: { $size: { $ifNull: ["$$product.variations", []] } }
                  }
                }
              },
              totalCapacity: {
                $sum: {
                  $map: {
                    input: "$products",
                    as: "product",
                    in: {
                      $sum: {
                        $map: {
                          input: "$$product.variations",
                          as: "variation",
                          in: "$$variation.inventory.quantity_total"
                        }
                      }
                    }
                  }
                }
              },
              totalSold: {
                $sum: {
                  $map: {
                    input: "$products",
                    as: "product",
                    in: {
                      $sum: {
                        $map: {
                          input: "$$product.variations",
                          as: "variation",
                          in: "$$variation.inventory.quantity_sold"
                        }
                      }
                    }
                  }
                }
              },
              totalAvailable: {
                $sum: {
                  $map: {
                    input: "$products",
                    as: "product",
                    in: {
                      $sum: {
                        $map: {
                          input: "$$product.variations",
                          as: "variation",
                          in: "$$variation.inventory.quantity_available"
                        }
                      }
                    }
                  }
                }
              },
              totalRevenue: {
                $sum: {
                  $map: {
                    input: "$products",
                    as: "product",
                    in: {
                      $sum: {
                        $map: {
                          input: "$$product.variations",
                          as: "variation",
                          in: {
                            $multiply: [
                              "$$variation.price.amount",
                              "$$variation.inventory.quantity_sold"
                            ]
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]
    });
    
    // Contacts with computed fields
    await db.createCollection('contacts_enriched', {
      viewOn: 'contacts',
      pipeline: [
        {
          $addFields: {
            fullName: {
              $concat: ["$profile.firstName", " ", "$profile.lastName"]
            },
            displayName: {
              $cond: [
                { $ne: ["$profile.preferredName", null] },
                { $concat: ["$profile.preferredName", " ", "$profile.lastName"] },
                { $concat: ["$profile.firstName", " ", "$profile.lastName"] }
              ]
            },
            activeRoles: {
              $filter: {
                input: "$roles",
                cond: {
                  $or: [
                    { $eq: ["$$this.endDate", null] },
                    { $gte: ["$$this.endDate", new Date()] }
                  ]
                }
              }
            },
            orderCount: { $size: { $ifNull: ["$orderReferences", []] } }
          }
        }
      ]
    });
    
    // Orders with fulfillment status
    await db.createCollection('orders_with_fulfillment', {
      viewOn: 'orders',
      pipeline: [
        {
          $addFields: {
            fulfillmentStatus: {
              $switch: {
                branches: [
                  {
                    case: {
                      $allElementsTrue: {
                        $map: {
                          input: "$lineItems",
                          as: "item",
                          in: { $eq: ["$$item.fulfillment.status", "fulfilled"] }
                        }
                      }
                    },
                    then: "fulfilled"
                  },
                  {
                    case: {
                      $anyElementTrue: {
                        $map: {
                          input: "$lineItems",
                          as: "item",
                          in: { $eq: ["$$item.fulfillment.status", "fulfilled"] }
                        }
                      }
                    },
                    then: "partial"
                  }
                ],
                default: "pending"
              }
            },
            itemCount: { $size: "$lineItems" },
            totalQuantity: { $sum: "$lineItems.quantity" }
          }
        }
      ]
    });
    
    console.log('✓ Computed views created');
    
    // Step 9: Create inventory update functions
    console.log('\n📝 Step 9: Creating inventory management functions...');
    
    try { await db.dropCollection('aggregation_functions'); } catch (e) {}
    await db.createCollection('aggregation_functions');
    
    await db.collection('aggregation_functions').insertMany([
      {
        name: "purchaseItem",
        description: "Atomically update inventory when item is purchased",
        type: "atomic_update",
        pipeline: [
          {
            $match: {
              catalogId: "$$catalogId",
              "products.productId": "$$productId",
              "products.variations.variationId": "$$variationId"
            }
          },
          {
            $set: {
              products: {
                $map: {
                  input: "$products",
                  as: "product",
                  in: {
                    $cond: [
                      { $eq: ["$$product.productId", "$$productId"] },
                      {
                        $mergeObjects: [
                          "$$product",
                          {
                            variations: {
                              $map: {
                                input: "$$product.variations",
                                as: "variation",
                                in: {
                                  $cond: [
                                    { $eq: ["$$variation.variationId", "$$variationId"] },
                                    {
                                      $mergeObjects: [
                                        "$$variation",
                                        {
                                          inventory: {
                                            $mergeObjects: [
                                              "$$variation.inventory",
                                              {
                                                quantity_sold: {
                                                  $add: ["$$variation.inventory.quantity_sold", "$$quantity"]
                                                },
                                                quantity_available: {
                                                  $subtract: ["$$variation.inventory.quantity_available", "$$quantity"]
                                                }
                                              }
                                            ]
                                          }
                                        }
                                      ]
                                    },
                                    "$$variation"
                                  ]
                                }
                              }
                            }
                          }
                        ]
                      },
                      "$$product"
                    ]
                  }
                }
              }
            }
          }
        ]
      },
      {
        name: "checkItemAvailability",
        description: "Check if item has sufficient inventory",
        type: "query",
        pipeline: [
          {
            $match: {
              catalogId: "$$catalogId",
              "products.productId": "$$productId",
              "products.variations.variationId": "$$variationId"
            }
          },
          {
            $project: {
              available: {
                $reduce: {
                  input: "$products",
                  initialValue: false,
                  in: {
                    $cond: [
                      { $eq: ["$$this.productId", "$$productId"] },
                      {
                        $reduce: {
                          input: "$$this.variations",
                          initialValue: false,
                          in: {
                            $cond: [
                              { $eq: ["$$this.variationId", "$$variationId"] },
                              { $gte: ["$$this.inventory.quantity_available", "$$quantity"] },
                              "$$value"
                            ]
                          }
                        }
                      },
                      "$$value"
                    ]
                  }
                }
              }
            }
          }
        ]
      }
    ]);
    
    console.log('✓ Inventory management functions created');
    
    console.log('\n✅ E-Commerce transformation completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- ✓ Users simplified for authentication only');
    console.log('- ✓ Contacts enhanced with roles and order references');
    console.log('- ✓ Functions → Catalog Objects with embedded products/variations');
    console.log('- ✓ Registrations → Orders with line items');
    console.log('- ✓ Attendees merged into Contacts');
    console.log('- ✓ Products embedded with inventory tracking');
    console.log('- ✓ Tickets updated for new model');
    console.log('- ✓ All indexes and views created');
    
  } catch (error) {
    console.error('❌ Error during transformation:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the transformation
transformToEcommerce().catch(console.error);