// @ts-nocheck
/**
 * MongoDB Data Model Fix Script
 * 
 * This script fixes the incorrect data model by:
 * 1. Dropping the products collection
 * 2. Updating the functions collection schema to embed eventTickets
 * 3. Recreating computed views with correct structure
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = process.env.MONGODB_DB || 'LodgeTix';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

const { MongoClient } = require('mongodb');

async function fixDataModel() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔧 Fixing MongoDB Data Model...\n');
    console.log('Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    console.log(`Connected to database: ${DATABASE_NAME}\n`);
    
    // Step 1: Drop incorrect collections and views
    console.log('📝 Step 1: Cleaning up incorrect structure...');
    
    try {
      await db.dropCollection('products');
      console.log('✓ Dropped products collection');
    } catch (error) {
      console.log('✓ Products collection does not exist or already dropped');
    }
    
    // Drop old views that reference products
    const viewsToDrop = [
      'functions_with_dates',
      'functions_with_inventory'
    ];
    
    for (const viewName of viewsToDrop) {
      try {
        await db.dropCollection(viewName);
        console.log(`✓ Dropped view: ${viewName}`);
      } catch (error) {
        console.log(`✓ View ${viewName} does not exist or already dropped`);
      }
    }
    
    // Step 2: Update functions collection schema
    console.log('\n📝 Step 2: Updating functions collection schema...');
    
    // First, drop the existing functions collection to recreate with new schema
    try {
      await db.dropCollection('functions');
      console.log('✓ Dropped existing functions collection');
    } catch (error) {
      console.log('⚠️  Could not drop functions collection:', error.message);
    }
    
    // Recreate functions collection with correct schema
    await db.createCollection('functions', {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["functionId", "name", "slug", "dates", "organiser"],
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
              maxLength: 2000
            },
            slug: {
              bsonType: "string",
              pattern: "^[a-z0-9-]+$",
              description: "URL-friendly slug"
            },
            organiser: {
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
              description: "User who created the function"
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
                  dates: {
                    bsonType: "object",
                    properties: {
                      eventStart: { bsonType: ["date", "null"] },
                      eventEnd: { bsonType: ["date", "null"] },
                      additionalDateTimes: { bsonType: ["object", "null"] }
                    }
                  },
                  location: {
                    bsonType: "object",
                    properties: {
                      location_id: { bsonType: ["string", "null"] },
                      name: { bsonType: ["string", "null"] },
                      description: { bsonType: ["string", "null"] },
                      room_area: { bsonType: ["string", "null"] },
                      address: { bsonType: ["object", "null"] }
                    }
                  },
                  // EVENT TICKETS EMBEDDED HERE!
                  eventTickets: {
                    bsonType: "array",
                    items: {
                      bsonType: "object",
                      required: ["ticketId", "name", "type", "price", "inventory"],
                      properties: {
                        ticketId: {
                          bsonType: "string",
                          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
                        },
                        name: {
                          bsonType: "string",
                          description: "Ticket name (e.g., Standard Ticket, VIP Table)"
                        },
                        description: {
                          bsonType: ["string", "null"]
                        },
                        type: {
                          bsonType: "string",
                          enum: ["ticket", "package", "addon"],
                          description: "Type of event ticket"
                        },
                        category: {
                          bsonType: ["string", "null"]
                        },
                        price: {
                          bsonType: "object",
                          required: ["amount", "currency"],
                          properties: {
                            amount: {
                              bsonType: "decimal",
                              minimum: 0
                            },
                            currency: {
                              bsonType: "string",
                              enum: ["AUD", "NZD", "USD", "GBP", "EUR"]
                            },
                            taxIncluded: { bsonType: ["bool", "null"] },
                            taxRate: {
                              bsonType: ["number", "null"],
                              minimum: 0,
                              maximum: 1
                            }
                          }
                        },
                        inventory: {
                          bsonType: "object",
                          required: ["method", "capacity", "soldCount", "availableCount"],
                          properties: {
                            method: {
                              bsonType: "string",
                              enum: ["allocated", "unlimited"],
                              description: "Inventory tracking method"
                            },
                            capacity: {
                              bsonType: "int",
                              minimum: 0,
                              description: "Maximum tickets that can be sold"
                            },
                            soldCount: {
                              bsonType: "int",
                              minimum: 0,
                              description: "Number of tickets sold"
                            },
                            reservedCount: {
                              bsonType: "int",
                              minimum: 0,
                              description: "Number of tickets in carts/pending"
                            },
                            availableCount: {
                              bsonType: "int",
                              minimum: 0,
                              description: "Computed: capacity - soldCount - reservedCount"
                            }
                          }
                        },
                        eligibility: {
                          bsonType: ["object", "null"],
                          properties: {
                            criteria: { bsonType: ["array", "null"] }
                          }
                        },
                        status: {
                          bsonType: "string",
                          enum: ["active", "inactive", "sold_out"],
                          description: "Ticket status"
                        }
                      }
                    }
                  },
                  published: { bsonType: ["bool", "null"] },
                  featured: { bsonType: ["bool", "null"] }
                }
              }
            },
            // Computed inventory totals
            inventory: {
              bsonType: ["object", "null"],
              properties: {
                totalCapacity: { bsonType: ["int", "null"] },
                totalSold: { bsonType: ["int", "null"] },
                totalAvailable: { bsonType: ["int", "null"] },
                totalRevenue: { bsonType: ["decimal", "null"] }
              }
            }
          }
        }
      },
      validationLevel: "moderate",
      validationAction: "warn"
    });
    
    console.log('✓ Functions collection recreated with embedded eventTickets');
    
    // Step 3: Recreate indexes
    console.log('\n📝 Step 3: Recreating indexes...');
    
    await db.collection('functions').createIndex(
      { "functionId": 1 },
      { unique: true, name: "functionId_unique" }
    );
    
    await db.collection('functions').createIndex(
      { "slug": 1 },
      { unique: true, name: "slug_unique" }
    );
    
    await db.collection('functions').createIndex(
      { "dates.startDate": 1, "dates.endDate": 1 },
      { name: "date_range" }
    );
    
    await db.collection('functions').createIndex(
      { "events.event_id": 1 },
      { name: "event_lookup" }
    );
    
    await db.collection('functions').createIndex(
      { "events.eventTickets.ticketId": 1 },
      { name: "ticket_lookup" }
    );
    
    console.log('✓ Indexes created');
    
    // Step 4: Create new computed views
    console.log('\n📝 Step 4: Creating computed views with inventory tracking...');
    
    // Functions with computed inventory
    await db.createCollection('functions_with_inventory', {
      viewOn: 'functions',
      pipeline: [
        {
          $addFields: {
            // Compute function-level inventory
            "inventory.totalCapacity": {
              $sum: {
                $map: {
                  input: "$events",
                  as: "event",
                  in: {
                    $sum: {
                      $map: {
                        input: "$$event.eventTickets",
                        as: "ticket",
                        in: "$$ticket.inventory.capacity"
                      }
                    }
                  }
                }
              }
            },
            "inventory.totalSold": {
              $sum: {
                $map: {
                  input: "$events",
                  as: "event",
                  in: {
                    $sum: {
                      $map: {
                        input: "$$event.eventTickets",
                        as: "ticket",
                        in: "$$ticket.inventory.soldCount"
                      }
                    }
                  }
                }
              }
            },
            "inventory.totalAvailable": {
              $sum: {
                $map: {
                  input: "$events",
                  as: "event",
                  in: {
                    $sum: {
                      $map: {
                        input: "$$event.eventTickets",
                        as: "ticket",
                        in: "$$ticket.inventory.availableCount"
                      }
                    }
                  }
                }
              }
            },
            "inventory.totalRevenue": {
              $sum: {
                $map: {
                  input: "$events",
                  as: "event",
                  in: {
                    $sum: {
                      $map: {
                        input: "$$event.eventTickets",
                        as: "ticket",
                        in: {
                          $multiply: [
                            "$$ticket.price.amount",
                            "$$ticket.inventory.soldCount"
                          ]
                        }
                      }
                    }
                  }
                }
              }
            },
            // Compute dates from events
            "dates.computedStartDate": {
              $min: "$events.dates.eventStart"
            },
            "dates.computedEndDate": {
              $max: "$events.dates.eventEnd"
            },
            // Add event-level computed fields
            events: {
              $map: {
                input: "$events",
                as: "event",
                in: {
                  $mergeObjects: [
                    "$$event",
                    {
                      inventory: {
                        eventCapacity: {
                          $sum: "$$event.eventTickets.inventory.capacity"
                        },
                        eventSold: {
                          $sum: "$$event.eventTickets.inventory.soldCount"
                        },
                        eventAvailable: {
                          $sum: "$$event.eventTickets.inventory.availableCount"
                        },
                        eventRevenue: {
                          $sum: {
                            $map: {
                              input: "$$event.eventTickets",
                              as: "ticket",
                              in: {
                                $multiply: [
                                  "$$ticket.price.amount",
                                  "$$ticket.inventory.soldCount"
                                ]
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    });
    
    console.log('✓ Created functions_with_inventory view');
    
    // Step 5: Create inventory update aggregations
    console.log('\n📝 Step 5: Creating inventory management functions...');
    
    // Drop and recreate aggregation_functions collection
    try {
      await db.dropCollection('aggregation_functions');
    } catch (error) {
      // Collection might not exist
    }
    
    await db.createCollection('aggregation_functions');
    
    await db.collection('aggregation_functions').insertMany([
      {
        name: "updateTicketInventory",
        description: "Update available count when tickets are sold",
        type: "atomic_operation",
        pipeline: [
          {
            $match: {
              functionId: "$$functionId",
              "events.event_id": "$$eventId",
              "events.eventTickets.ticketId": "$$ticketId"
            }
          },
          {
            $set: {
              events: {
                $map: {
                  input: "$events",
                  as: "event",
                  in: {
                    $cond: [
                      { $eq: ["$$event.event_id", "$$eventId"] },
                      {
                        $mergeObjects: [
                          "$$event",
                          {
                            eventTickets: {
                              $map: {
                                input: "$$event.eventTickets",
                                as: "ticket",
                                in: {
                                  $cond: [
                                    { $eq: ["$$ticket.ticketId", "$$ticketId"] },
                                    {
                                      $mergeObjects: [
                                        "$$ticket",
                                        {
                                          "inventory.soldCount": {
                                            $add: ["$$ticket.inventory.soldCount", "$$quantity"]
                                          },
                                          "inventory.availableCount": {
                                            $subtract: [
                                              "$$ticket.inventory.capacity",
                                              { $add: ["$$ticket.inventory.soldCount", "$$quantity"] }
                                            ]
                                          }
                                        }
                                      ]
                                    },
                                    "$$ticket"
                                  ]
                                }
                              }
                            }
                          }
                        ]
                      },
                      "$$event"
                    ]
                  }
                }
              }
            }
          },
          {
            $merge: {
              into: "functions",
              on: "_id",
              whenMatched: "replace"
            }
          }
        ]
      },
      {
        name: "checkTicketAvailability",
        description: "Check if tickets are available before sale",
        type: "query",
        pipeline: [
          {
            $match: {
              functionId: "$$functionId",
              "events.event_id": "$$eventId",
              "events.eventTickets.ticketId": "$$ticketId"
            }
          },
          {
            $project: {
              _id: 0,
              available: {
                $reduce: {
                  input: "$events",
                  initialValue: false,
                  in: {
                    $cond: [
                      { $eq: ["$$this.event_id", "$$eventId"] },
                      {
                        $reduce: {
                          input: "$$this.eventTickets",
                          initialValue: false,
                          in: {
                            $cond: [
                              { $eq: ["$$this.ticketId", "$$ticketId"] },
                              { $gte: ["$$this.inventory.availableCount", "$$quantity"] },
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
    
    console.log('✓ Created inventory management functions');
    
    console.log('\n✅ Data model fix completed successfully!');
    console.log('\n📊 Summary of changes:');
    console.log('- ✓ Removed separate products collection');
    console.log('- ✓ Embedded eventTickets within events in functions');
    console.log('- ✓ Added real-time inventory tracking fields');
    console.log('- ✓ Created computed views for inventory totals');
    console.log('- ✓ Added atomic inventory update operations');
    
  } catch (error) {
    console.error('❌ Error fixing data model:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the fix
fixDataModel().catch(console.error);
