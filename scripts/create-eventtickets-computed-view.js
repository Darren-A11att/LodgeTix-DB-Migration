const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function createEventTicketsComputedView() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    const db = client.db('lodgetix');
    
    console.log('Connected to lodgetix database');
    
    // Check if the view already exists and drop it
    const collections = await db.listCollections({ name: 'eventTickets_computed' }).toArray();
    if (collections.length > 0) {
      console.log('Existing eventTickets_computed view found, dropping it...');
      await db.dropCollection('eventTickets_computed');
      console.log('View dropped successfully');
    }
    
    // Define the aggregation pipeline with fixed variable references
    const agg = [
      {
        '$lookup': {
          'from': 'tickets', 
          'let': {
            'eventTicketId': '$eventTicketId'
          }, 
          'pipeline': [
            {
              '$match': {
                '$expr': {
                  '$eq': [
                    '$eventTicketId', '$$eventTicketId'  // Fixed: using $$ for variable reference
                  ]
                }
              }
            }, {
              '$group': {
                '_id': '$status', 
                'count': {
                  '$sum': {
                    '$ifNull': [
                      '$quantity', 1
                    ]
                  }
                }
              }
            }
          ], 
          'as': 'ticketCounts'
        }
      }, {
        '$addFields': {
          'soldCount': {
            '$ifNull': [
              {
                '$sum': {
                  '$map': {
                    'input': {
                      '$filter': {
                        'input': '$ticketCounts', 
                        'cond': {
                          '$eq': [
                            '$$this._id', 'sold'
                          ]
                        }
                      }
                    }, 
                    'in': '$$this.count'
                  }
                }
              }, 0
            ]
          }, 
          'cancelledCount': {
            '$ifNull': [
              {
                '$sum': {
                  '$map': {
                    'input': {
                      '$filter': {
                        'input': '$ticketCounts', 
                        'cond': {
                          '$eq': [
                            '$$this._id', 'cancelled'
                          ]
                        }
                      }
                    }, 
                    'in': '$$this.count'
                  }
                }
              }, 0
            ]
          }, 
          'reservedCount': {
            '$ifNull': [
              {
                '$sum': {
                  '$map': {
                    'input': {
                      '$filter': {
                        'input': '$ticketCounts', 
                        'cond': {
                          '$eq': [
                            '$$this._id', 'reserved'
                          ]
                        }
                      }
                    }, 
                    'in': '$$this.count'
                  }
                }
              }, 0
            ]
          }, 
          'transferredCount': {
            '$ifNull': [
              {
                '$sum': {
                  '$map': {
                    'input': {
                      '$filter': {
                        'input': '$ticketCounts', 
                        'cond': {
                          '$eq': [
                            '$$this._id', 'transferred'
                          ]
                        }
                      }
                    }, 
                    'in': '$$this.count'
                  }
                }
              }, 0
            ]
          }
        }
      }, {
        '$addFields': {
          'totalSold': {
            '$add': [
              '$soldCount', '$transferredCount'
            ]
          }, 
          'availableCount': {
            '$max': [
              0, {
                '$subtract': [
                  {
                    '$ifNull': [
                      '$totalCapacity', 0
                    ]
                  }, {
                    '$add': [
                      '$soldCount', '$transferredCount', '$reservedCount'
                    ]
                  }
                ]
              }
            ]
          }, 
          'utilizationRate': {
            '$round': [
              {
                '$cond': {
                  'if': {
                    '$gt': [
                      '$totalCapacity', 0
                    ]
                  }, 
                  'then': {
                    '$multiply': [
                      100, {
                        '$divide': [
                          {
                            '$add': [
                              '$soldCount', '$transferredCount'
                            ]
                          }, '$totalCapacity'
                        ]
                      }
                    ]
                  }, 
                  'else': 0
                }
              }, 1
            ]
          }
        }
      }, {
        '$project': {
          'ticketCounts': 0
        }
      }
    ];
    
    console.log('Creating eventTickets_computed view...');
    
    // Create the view
    await db.createCollection('eventTickets_computed', {
      viewOn: 'eventTickets',
      pipeline: agg
    });
    
    console.log('View created successfully!');
    
    // Verify the view was created
    const viewExists = await db.listCollections({ name: 'eventTickets_computed' }).toArray();
    if (viewExists.length > 0) {
      console.log('✓ View verification: eventTickets_computed exists');
      
      // Test the view by counting documents
      const count = await db.collection('eventTickets_computed').countDocuments();
      console.log(`✓ View test: Found ${count} documents in eventTickets_computed view`);
      
      // Show a sample document if any exist
      if (count > 0) {
        const sample = await db.collection('eventTickets_computed').findOne();
        console.log('\nSample document from view:');
        console.log('=========================');
        console.log(JSON.stringify(sample, null, 2));
      }
    } else {
      console.error('✗ View verification failed: eventTickets_computed was not created');
    }
    
  } catch (error) {
    console.error('Error creating view:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
console.log('Starting eventTickets_computed view creation...');
console.log('===============================================\n');

createEventTicketsComputedView()
  .then(() => {
    console.log('\n✓ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Script failed:', error.message);
    process.exit(1);
  });