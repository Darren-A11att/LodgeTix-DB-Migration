# Products Collection - Aggregation Pipelines

## Common Aggregations

### 1. Products with Event Details
Enriches products with their associated event information.

```javascript
db.products.aggregate([
  {
    $match: {
      functionId: "function-uuid-here",
      type: "ticket"
    }
  },
  {
    $lookup: {
      from: "functions",
      let: { 
        functionId: "$functionId",
        eventId: "$eventId"
      },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$functionId", "$$functionId"] }
          }
        },
        {
          $project: {
            event: {
              $filter: {
                input: "$events",
                as: "event",
                cond: { $eq: ["$$event.event_id", "$$eventId"] }
              }
            }
          }
        },
        { $unwind: "$event" }
      ],
      as: "eventDetails"
    }
  },
  {
    $unwind: {
      path: "$eventDetails",
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $addFields: {
      "eventName": "$eventDetails.event.name",
      "eventDate": "$eventDetails.event.dates.eventStart",
      "eventLocation": "$eventDetails.event.location.name"
    }
  },
  {
    $project: {
      eventDetails: 0
    }
  }
])
```

### 2. Inventory Summary by Function
Provides inventory statistics across all products for a function.

```javascript
db.products.aggregate([
  {
    $match: {
      functionId: "function-uuid-here"
    }
  },
  {
    $group: {
      _id: {
        functionId: "$functionId",
        type: "$type"
      },
      totalProducts: { $sum: 1 },
      totalCapacity: {
        $sum: {
          $cond: [
            { $eq: ["$inventory.method", "allocated"] },
            "$inventory.totalCapacity",
            0
          ]
        }
      },
      totalSold: { $sum: "$inventory.soldCount" },
      totalReserved: { $sum: "$inventory.reservedCount" },
      totalAvailable: {
        $sum: {
          $cond: [
            { $eq: ["$inventory.method", "allocated"] },
            "$inventory.availableCount",
            0
          ]
        }
      },
      totalRevenue: {
        $sum: {
          $multiply: ["$price.amount", "$inventory.soldCount"]
        }
      }
    }
  },
  {
    $group: {
      _id: "$_id.functionId",
      productTypes: {
        $push: {
          type: "$_id.type",
          count: "$totalProducts",
          capacity: "$totalCapacity",
          sold: "$totalSold",
          reserved: "$totalReserved",
          available: "$totalAvailable",
          revenue: "$totalRevenue"
        }
      },
      totalProducts: { $sum: "$totalProducts" },
      totalCapacity: { $sum: "$totalCapacity" },
      totalSold: { $sum: "$totalSold" },
      totalReserved: { $sum: "$totalReserved" },
      totalRevenue: { $sum: "$totalRevenue" }
    }
  },
  {
    $addFields: {
      utilizationRate: {
        $round: [
          {
            $multiply: [
              { $divide: ["$totalSold", "$totalCapacity"] },
              100
            ]
          },
          2
        ]
      }
    }
  }
])
```

### 3. Low Stock Alert
Identifies products with low available inventory.

```javascript
db.products.aggregate([
  {
    $match: {
      status: "active",
      "inventory.method": "allocated"
    }
  },
  {
    $addFields: {
      stockPercentage: {
        $multiply: [
          { $divide: ["$inventory.availableCount", "$inventory.totalCapacity"] },
          100
        ]
      }
    }
  },
  {
    $match: {
      stockPercentage: { $lte: 10 } // 10% or less remaining
    }
  },
  {
    $project: {
      productId: 1,
      sku: 1,
      name: 1,
      type: 1,
      totalCapacity: "$inventory.totalCapacity",
      availableCount: "$inventory.availableCount",
      stockPercentage: { $round: ["$stockPercentage", 2] }
    }
  },
  {
    $sort: { stockPercentage: 1 }
  }
])
```

### 4. Sales Performance Analysis
Analyzes product sales performance with rankings.

```javascript
db.products.aggregate([
  {
    $match: {
      functionId: "function-uuid-here",
      "inventory.soldCount": { $gt: 0 }
    }
  },
  {
    $addFields: {
      revenue: {
        $multiply: ["$price.amount", "$inventory.soldCount"]
      },
      sellThroughRate: {
        $cond: [
          { $eq: ["$inventory.method", "allocated"] },
          {
            $multiply: [
              { $divide: ["$inventory.soldCount", "$inventory.totalCapacity"] },
              100
            ]
          },
          null
        ]
      }
    }
  },
  {
    $setWindowFields: {
      partitionBy: "$type",
      sortBy: { revenue: -1 },
      output: {
        revenueRank: {
          $rank: {}
        }
      }
    }
  },
  {
    $setWindowFields: {
      partitionBy: "$type",
      sortBy: { "inventory.soldCount": -1 },
      output: {
        volumeRank: {
          $rank: {}
        }
      }
    }
  },
  {
    $project: {
      sku: 1,
      name: 1,
      type: 1,
      unitsSold: "$inventory.soldCount",
      revenue: { $round: ["$revenue", 2] },
      sellThroughRate: { $round: ["$sellThroughRate", 2] },
      revenueRank: 1,
      volumeRank: 1
    }
  }
])
```

### 5. Eligible Products for User
Finds products a specific user is eligible to purchase.

```javascript
db.products.aggregate([
  {
    $match: {
      functionId: "function-uuid-here",
      status: "active"
    }
  },
  {
    $addFields: {
      isEligible: {
        $cond: {
          if: {
            $or: [
              { $eq: [{ $size: { $ifNull: ["$eligibility.rules", []] } }, 0] },
              {
                $and: [
                  { $eq: ["$eligibility.operator", "OR"] },
                  {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: { $ifNull: ["$eligibility.rules", []] },
                            as: "rule",
                            cond: {
                              $and: [
                                { $eq: ["$$rule.type", "membership"] },
                                { $eq: ["$$rule.value", "Master Mason"] } // User's membership
                              ]
                            }
                          }
                        }
                      },
                      0
                    ]
                  }
                ]
              }
            ]
          },
          then: true,
          else: false
        }
      }
    }
  },
  {
    $match: { isEligible: true }
  }
])
```

### 6. Cart Reservation Cleanup
Finds expired cart reservations for cleanup.

```javascript
db.products.aggregate([
  {
    $match: {
      "inventory.reservedCount": { $gt: 0 }
    }
  },
  {
    $addFields: {
      minutesSinceUpdate: {
        $divide: [
          { $subtract: [new Date(), "$inventory.lastUpdated"] },
          60000 // milliseconds to minutes
        ]
      }
    }
  },
  {
    $match: {
      minutesSinceUpdate: { $gt: 15 } // 15 minute timeout
    }
  },
  {
    $project: {
      productId: 1,
      sku: 1,
      reservedCount: "$inventory.reservedCount",
      lastUpdated: "$inventory.lastUpdated",
      minutesSinceUpdate: { $round: ["$minutesSinceUpdate", 0] }
    }
  }
])
```

### 7. Revenue Projection
Projects potential revenue based on capacity and pricing.

```javascript
db.products.aggregate([
  {
    $match: {
      functionId: "function-uuid-here",
      status: { $in: ["active", "draft"] }
    }
  },
  {
    $facet: {
      byType: [
        {
          $group: {
            _id: "$type",
            currentRevenue: {
              $sum: {
                $multiply: ["$price.amount", "$inventory.soldCount"]
              }
            },
            potentialRevenue: {
              $sum: {
                $cond: [
                  { $eq: ["$inventory.method", "allocated"] },
                  {
                    $multiply: ["$price.amount", "$inventory.totalCapacity"]
                  },
                  0
                ]
              }
            },
            remainingRevenue: {
              $sum: {
                $cond: [
                  { $eq: ["$inventory.method", "allocated"] },
                  {
                    $multiply: ["$price.amount", "$inventory.availableCount"]
                  },
                  0
                ]
              }
            }
          }
        }
      ],
      totals: [
        {
          $group: {
            _id: null,
            currentRevenue: {
              $sum: {
                $multiply: ["$price.amount", "$inventory.soldCount"]
              }
            },
            potentialRevenue: {
              $sum: {
                $cond: [
                  { $eq: ["$inventory.method", "allocated"] },
                  {
                    $multiply: ["$price.amount", "$inventory.totalCapacity"]
                  },
                  0
                ]
              }
            }
          }
        },
        {
          $addFields: {
            achievementRate: {
              $multiply: [
                { $divide: ["$currentRevenue", "$potentialRevenue"] },
                100
              ]
            }
          }
        }
      ]
    }
  }
])
```

### 8. Product Availability Calendar
Shows product availability by date for planning.

```javascript
db.products.aggregate([
  {
    $match: {
      functionId: "function-uuid-here",
      type: "ticket"
    }
  },
  {
    $lookup: {
      from: "functions",
      localField: "functionId",
      foreignField: "functionId",
      as: "function"
    }
  },
  {
    $unwind: "$function"
  },
  {
    $unwind: "$function.events"
  },
  {
    $match: {
      $expr: { $eq: ["$eventId", "$function.events.event_id"] }
    }
  },
  {
    $group: {
      _id: {
        date: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$function.events.dates.eventStart"
          }
        }
      },
      products: {
        $push: {
          productId: "$productId",
          name: "$name",
          eventTime: "$function.events.dates.eventStart",
          available: "$inventory.availableCount",
          price: "$price.amount"
        }
      },
      totalAvailable: { $sum: "$inventory.availableCount" }
    }
  },
  {
    $sort: { "_id.date": 1 }
  }
])
```

## Usage Notes

1. **Indexes**: Ensure proper indexes exist for fields used in `$match` stages
2. **Performance**: Use `$project` early to reduce document size in pipeline
3. **Memory**: Large aggregations may require `allowDiskUse: true`
4. **Real-time**: For live dashboards, consider materialized views or caching
5. **Monitoring**: Use `explain()` to analyze aggregation performance

## Creating Views

```javascript
// Create a view for active products with availability
db.createView(
  "activeProductsView",
  "products",
  [
    {
      $match: {
        status: "active",
        "inventory.availableCount": { $gt: 0 }
      }
    },
    {
      $project: {
        productId: 1,
        functionId: 1,
        eventId: 1,
        name: 1,
        type: 1,
        price: 1,
        availableCount: "$inventory.availableCount"
      }
    }
  ]
)
```