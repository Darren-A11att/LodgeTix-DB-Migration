# Functions Collection - Validation Rules

## MongoDB Schema Validation

```javascript
db.createCollection("functions", {
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
              products: {
                bsonType: "array",
                items: {
                  bsonType: "object",
                  required: ["_id", "name", "type", "price", "stock"],
                  properties: {
                    _id: { bsonType: "objectId" },
                    name: { bsonType: "string" },
                    type: { 
                      bsonType: "string",
                      enum: ["Ticket", "Merchandise", "Food_Beverage", "Donation"]
                    },
                    description: { bsonType: ["string", "null"] },
                    status: { bsonType: ["string", "null"] },
                    billing_details: {
                      bsonType: "array",
                      items: {
                        bsonType: "object",
                        required: ["gateway", "type", "id"],
                        properties: {
                          gateway: { bsonType: "string" },
                          type: { bsonType: "string" },
                          id: { bsonType: "string" }
                        }
                      }
                    },
                    price: {
                      bsonType: "object",
                      required: ["cost", "amount", "currency"],
                      properties: {
                        cost: { bsonType: "number" },
                        amount: { bsonType: "number" },
                        tax_rate: { bsonType: ["number", "null"] },
                        currency: { bsonType: "string" }
                      }
                    },
                    stock: {
                      bsonType: "object",
                      required: ["available", "reserved", "sold", "max"],
                      properties: {
                        available: { bsonType: "int" },
                        reserved: { bsonType: "int" },
                        sold: { bsonType: "int" },
                        max: { bsonType: "int" }
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
})
```