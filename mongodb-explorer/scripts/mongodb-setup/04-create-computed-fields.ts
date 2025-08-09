// @ts-nocheck
/**
 * MongoDB Computed Fields and Views Creation Script
 * 
 * This script creates aggregation views and pipelines for computed fields
 * Run after collections and indexes have been created
 */

const MONGODB_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
const DATABASE_NAME = 'LodgeTix';

const { MongoClient } = require('mongodb');

async function createComputedFields() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    console.log(`Connected to database: ${DATABASE_NAME}`);
    
    // Drop existing views to recreate them
    const collections = await db.listCollections({ type: 'view' }).toArray();
    for (const collection of collections) {
      console.log(`Dropping existing view: ${collection.name}`);
      await db.dropCollection(collection.name);
    }
    
    // CREATE COMPUTED VIEWS
    console.log('\n🔧 Creating computed field views...\n');
    
    // 1. ATTENDEES WITH COMPUTED FIELDS
    console.log('Creating attendees_with_computed view...');
    await db.createCollection('attendees_with_computed', {
      viewOn: 'attendees',
      pipeline: [
        {
          $addFields: {
            // Compute full name
            fullName: {
              $concat: [
                { $ifNull: ["$profile.title", ""] },
                { $cond: [
                  { $ne: ["$profile.title", null] },
                  " ",
                  ""
                ]},
                "$profile.firstName",
                " ",
                "$profile.lastName",
                { $cond: [
                  { $ne: ["$profile.suffix", null] },
                  { $concat: [" ", "$profile.suffix"] },
                  ""
                ]}
              ]
            },
            // Compute display name for badges
            displayName: {
              $concat: [
                "$profile.firstName",
                " ",
                "$profile.lastName"
              ]
            },
            // Compute current check-in status for any event
            currentlyCheckedIn: {
              $anyElementTrue: {
                $map: {
                  input: { $ifNull: ["$checkIns", []] },
                  as: "checkIn",
                  in: {
                    $and: [
                      { $ne: ["$$checkIn.checkInTime", null] },
                      { $eq: ["$$checkIn.checkOutTime", null] }
                    ]
                  }
                }
              }
            },
            // Compute total events attended
            eventsAttended: {
              $size: {
                $filter: {
                  input: { $ifNull: ["$checkIns", []] },
                  cond: { $ne: ["$$this.checkInTime", null] }
                }
              }
            },
            // Compute if has special requirements
            hasSpecialRequirements: {
              $or: [
                { $ne: [{ $ifNull: ["$requirements.dietaryRequirements", ""] }, ""] },
                { $ne: [{ $ifNull: ["$requirements.specialNeeds", ""] }, ""] },
                { $gt: [{ $size: { $ifNull: ["$requirements.accessibility", []] } }, 0] }
              ]
            },
            // Compute partner status
            hasPartner: {
              $ne: [{ $ifNull: ["$partnerInfo.partner", null] }, null]
            },
            // Compute ticket count
            ticketCount: {
              $size: { $ifNull: ["$tickets", []] }
            }
          }
        }
      ]
    });
    console.log('✓ attendees_with_computed view created');
    
    // 2. CONTACTS WITH COMPUTED FIELDS
    console.log('\nCreating contacts_with_computed view...');
    await db.createCollection('contacts_with_computed', {
      viewOn: 'contacts',
      pipeline: [
        {
          $addFields: {
            // Compute full name
            fullName: {
              $concat: [
                "$profile.firstName",
                " ",
                "$profile.lastName"
              ]
            },
            // Compute display name (with preferred name)
            displayName: {
              $cond: [
                { $ne: [{ $ifNull: ["$profile.preferredName", ""] }, ""] },
                {
                  $concat: [
                    "$profile.preferredName",
                    " ",
                    "$profile.lastName"
                  ]
                },
                {
                  $concat: [
                    "$profile.firstName",
                    " ",
                    "$profile.lastName"
                  ]
                }
              ]
            },
            // Compute if has complete profile
            profileComplete: {
              $and: [
                { $ne: [{ $ifNull: ["$profile.email", ""] }, ""] },
                { $ne: [{ $ifNull: ["$profile.phone", ""] }, ""] },
                { $gt: [{ $size: { $ifNull: ["$addresses", []] } }, 0] }
              ]
            },
            // Compute relationship count
            relationshipCount: {
              $size: { $ifNull: ["$relationships", []] }
            },
            // Compute if is a Mason
            isMason: {
              $ne: [{ $ifNull: ["$masonicProfile", null] }, null]
            },
            // Compute lodge name and number combined
            lodgeNameNumber: {
              $cond: [
                {
                  $and: [
                    { $ne: [{ $ifNull: ["$masonicProfile.craft.lodge.name", ""] }, ""] },
                    { $ne: [{ $ifNull: ["$masonicProfile.craft.lodge.number", ""] }, ""] }
                  ]
                },
                {
                  $concat: [
                    "$masonicProfile.craft.lodge.name",
                    " No. ",
                    "$masonicProfile.craft.lodge.number"
                  ]
                },
                null
              ]
            }
          }
        }
      ]
    });
    console.log('✓ contacts_with_computed view created');
    
    // 3. FUNCTIONS WITH COMPUTED DATES
    console.log('\nCreating functions_with_dates view...');
    await db.createCollection('functions_with_dates', {
      viewOn: 'functions',
      pipeline: [
        {
          $addFields: {
            // Compute start date from events
            "dates.computedStartDate": {
              $min: "$events.dates.eventStart"
            },
            // Compute end date from events
            "dates.computedEndDate": {
              $max: "$events.dates.eventEnd"
            },
            // Compute total event count
            eventCount: {
              $size: { $ifNull: ["$events", []] }
            },
            // Compute if function is active (based on dates)
            isActive: {
              $and: [
                { $lte: ["$dates.startDate", new Date()] },
                { $gte: ["$dates.endDate", new Date()] }
              ]
            },
            // Compute if function is upcoming
            isUpcoming: {
              $gt: ["$dates.startDate", new Date()]
            },
            // Compute if function is past
            isPast: {
              $lt: ["$dates.endDate", new Date()]
            },
            // Compute duration in days
            durationDays: {
              $divide: [
                { $subtract: ["$dates.endDate", "$dates.startDate"] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        }
      ]
    });
    console.log('✓ functions_with_dates view created');
    
    // 4. REGISTRATIONS WITH COMPUTED TOTALS
    console.log('\nCreating registrations_with_totals view...');
    await db.createCollection('registrations_with_totals', {
      viewOn: 'registrations',
      pipeline: [
        {
          $addFields: {
            // Compute attendee count
            attendeeCount: {
              $size: { $ifNull: ["$attendees", []] }
            },
            // Compute ticket count
            ticketCount: {
              $size: { $ifNull: ["$tickets", []] }
            },
            // Compute if fully paid
            isFullyPaid: {
              $eq: [
                { $ifNull: ["$totals.balance", 0] },
                0
              ]
            },
            // Compute payment percentage
            paymentPercentage: {
              $cond: [
                { $gt: [{ $ifNull: ["$totals.total", 0] }, 0] },
                {
                  $multiply: [
                    {
                      $divide: [
                        { $ifNull: ["$totals.paid", 0] },
                        "$totals.total"
                      ]
                    },
                    100
                  ]
                },
                0
              ]
            },
            // Compute days since registration
            daysSinceRegistration: {
              $divide: [
                { $subtract: [new Date(), "$registrationDate"] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        }
      ]
    });
    console.log('✓ registrations_with_totals view created');
    
    // 5. TICKETS WITH STATUS
    console.log('\nCreating tickets_with_status view...');
    await db.createCollection('tickets_with_status', {
      viewOn: 'tickets',
      pipeline: [
        {
          $addFields: {
            // Compute if ticket is valid now
            isValidNow: {
              $and: [
                { $eq: ["$status", "active"] },
                {
                  $or: [
                    { $eq: [{ $ifNull: ["$validity.validFrom", null] }, null] },
                    { $lte: ["$validity.validFrom", new Date()] }
                  ]
                },
                {
                  $or: [
                    { $eq: [{ $ifNull: ["$validity.validUntil", null] }, null] },
                    { $gte: ["$validity.validUntil", new Date()] }
                  ]
                }
              ]
            },
            // Compute if ticket is expired
            isExpired: {
              $or: [
                { $eq: ["$status", "expired"] },
                {
                  $and: [
                    { $ne: [{ $ifNull: ["$validity.validUntil", null] }, null] },
                    { $lt: ["$validity.validUntil", new Date()] }
                  ]
                }
              ]
            },
            // Compute if ticket can be used
            canBeUsed: {
              $and: [
                { $eq: ["$status", "active"] },
                {
                  $or: [
                    { $eq: [{ $ifNull: ["$validity.singleUse", false] }, false] },
                    { $eq: [{ $ifNull: ["$usage.used", false] }, false] }
                  ]
                }
              ]
            }
          }
        }
      ]
    });
    console.log('✓ tickets_with_status view created');
    
    // 6. FINANCIAL TRANSACTIONS WITH CALCULATIONS
    console.log('\nCreating transactions_with_calculations view...');
    await db.createCollection('transactions_with_calculations', {
      viewOn: 'financialTransactions',
      pipeline: [
        {
          $addFields: {
            // Compute total payment amount
            totalPaymentAmount: {
              $sum: "$payments.amount"
            },
            // Compute if fully processed
            isFullyProcessed: {
              $allElementsTrue: {
                $map: {
                  input: "$payments",
                  as: "payment",
                  in: { $eq: ["$$payment.status", "succeeded"] }
                }
              }
            },
            // Compute days since transaction
            daysSinceTransaction: {
              $divide: [
                { $subtract: [new Date(), "$audit.createdAt"] },
                1000 * 60 * 60 * 24
              ]
            },
            // Compute if needs reconciliation
            needsReconciliation: {
              $and: [
                { $eq: ["$reconciliation.status", "pending"] },
                {
                  $gt: [
                    {
                      $divide: [
                        { $subtract: [new Date(), "$audit.createdAt"] },
                        1000 * 60 * 60 * 24
                      ]
                    },
                    7
                  ]
                }
              ]
            }
          }
        }
      ]
    });
    console.log('✓ transactions_with_calculations view created');
    
    // CREATE SCHEDULED AGGREGATIONS
    console.log('\n⏰ Setting up scheduled aggregation functions...\n');
    
    // Create a collection to store aggregation functions
    await db.createCollection('aggregation_functions', {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["name", "description", "pipeline", "schedule"],
          properties: {
            name: { bsonType: "string" },
            description: { bsonType: "string" },
            pipeline: { bsonType: "array" },
            schedule: { bsonType: "string" },
            lastRun: { bsonType: ["date", "null"] },
            enabled: { bsonType: "bool" }
          }
        }
      }
    });
    
    // Insert aggregation functions
    await db.collection('aggregation_functions').insertMany([
      {
        name: "updateFunctionDates",
        description: "Update function start/end dates based on events",
        schedule: "0 */6 * * *", // Every 6 hours
        enabled: true,
        pipeline: [
          {
            $project: {
              _id: 1,
              computedStartDate: { $min: "$events.dates.eventStart" },
              computedEndDate: { $max: "$events.dates.eventEnd" },
              currentStartDate: "$dates.startDate",
              currentEndDate: "$dates.endDate"
            }
          },
          {
            $match: {
              $or: [
                { $expr: { $ne: ["$computedStartDate", "$currentStartDate"] } },
                { $expr: { $ne: ["$computedEndDate", "$currentEndDate"] } }
              ]
            }
          },
          {
            $merge: {
              into: "functions",
              on: "_id",
              whenMatched: [
                {
                  $set: {
                    "dates.startDate": "$computedStartDate",
                    "dates.endDate": "$computedEndDate",
                    "dates.updatedAt": new Date()
                  }
                }
              ]
            }
          }
        ]
      },
      {
        name: "updateTicketExpiry",
        description: "Mark tickets as expired based on validity dates",
        schedule: "0 0 * * *", // Daily at midnight
        enabled: true,
        pipeline: [
          {
            $match: {
              status: "active",
              "validity.validUntil": { $lt: new Date() }
            }
          },
          {
            $set: {
              status: "expired",
              "metadata.updatedAt": new Date()
            }
          },
          {
            $merge: {
              into: "tickets",
              on: "_id",
              whenMatched: "replace"
            }
          }
        ]
      },
      {
        name: "updateInvoiceOverdue",
        description: "Mark invoices as overdue based on due date",
        schedule: "0 1 * * *", // Daily at 1 AM
        enabled: true,
        pipeline: [
          {
            $match: {
              status: "sent",
              dueDate: { $lt: new Date() }
            }
          },
          {
            $set: {
              status: "overdue",
              "metadata.updatedAt": new Date()
            }
          },
          {
            $merge: {
              into: "invoices",
              on: "_id",
              whenMatched: "replace"
            }
          }
        ]
      }
    ]);
    
    console.log('✓ Aggregation functions created');
    
    console.log('\n✅ All computed fields and views created successfully!');
    console.log('\n📝 Note: The scheduled aggregations need to be run by a job scheduler.');
    console.log('Consider using node-cron or a similar tool to execute these pipelines on schedule.');
    
  } catch (error) {
    console.error('❌ Error creating computed fields:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the script
createComputedFields().catch(console.error);
