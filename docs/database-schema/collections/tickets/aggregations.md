# Tickets Collection - Aggregation Pipelines

## Revenue and Sales Analysis

### 1. Ticket Sales by Category
```javascript
// Analyze ticket sales performance by category
db.tickets.aggregate([
  {
    $match: {
      "purchase.paymentStatus": "paid",
      status: { $ne: "cancelled" }
    }
  },
  {
    $group: {
      _id: {
        functionId: "$product.functionId",
        eventId: "$product.eventId",
        category: "$product.productCategory"
      },
      ticketsSold: { $sum: 1 },
      totalRevenue: { $sum: "$purchase.pricePaid" },
      avgPrice: { $avg: "$purchase.pricePaid" },
      
      // Discount analysis
      discountedTickets: {
        $sum: { $cond: [{ $gt: ["$purchase.discount.amount", 0] }, 1, 0] }
      },
      totalDiscounts: { $sum: "$purchase.discount.amount" },
      
      // Price distribution
      priceRange: {
        min: { $min: "$purchase.pricePaid" },
        max: { $max: "$purchase.pricePaid" }
      }
    }
  },
  {
    $group: {
      _id: {
        functionId: "$_id.functionId",
        eventId: "$_id.eventId"
      },
      categories: {
        $push: {
          category: "$_id.category",
          metrics: {
            quantity: "$ticketsSold",
            revenue: "$totalRevenue",
            avgPrice: { $round: ["$avgPrice", 2] },
            discountRate: {
              $multiply: [
                { $divide: ["$discountedTickets", "$ticketsSold"] },
                100
              ]
            },
            totalDiscounts: "$totalDiscounts"
          }
        }
      },
      totals: {
        tickets: { $sum: "$ticketsSold" },
        revenue: { $sum: "$totalRevenue" },
        discounts: { $sum: "$totalDiscounts" }
      }
    }
  },
  {
    $lookup: {
      from: "functions",
      let: { functionId: "$_id.functionId", eventId: "$_id.eventId" },
      pipeline: [
        { $match: { $expr: { $eq: ["$functionId", "$$functionId"] } } },
        { $unwind: "$events" },
        { $match: { $expr: { $eq: ["$events.event_id", "$$eventId"] } } },
        { $project: { eventName: "$events.name" } }
      ],
      as: "event"
    }
  },
  {
    $project: {
      function: "$_id.functionId",
      event: {
        id: "$_id.eventId",
        name: { $first: "$event.eventName" }
      },
      sales: {
        byCategory: "$categories",
        totals: "$totals"
      }
    }
  }
])
```

### 2. Secondary Market Analysis
```javascript
// Track ticket transfers and secondary sales
db.tickets.aggregate([
  {
    $match: {
      "transferHistory": { $exists: true, $ne: [] }
    }
  },
  { $unwind: "$transferHistory" },
  {
    $match: {
      "transferHistory.reason": "sold"
    }
  },
  {
    $project: {
      ticketNumber: 1,
      event: "$product.eventName",
      category: "$product.productCategory",
      originalPrice: "$purchase.pricePaid",
      resalePrice: "$transferHistory.salePrice",
      markup: {
        $subtract: ["$transferHistory.salePrice", "$purchase.pricePaid"]
      },
      markupPercent: {
        $multiply: [
          {
            $divide: [
              { $subtract: ["$transferHistory.salePrice", "$purchase.pricePaid"] },
              "$purchase.pricePaid"
            ]
          },
          100
        ]
      },
      daysBeforeEvent: {
        $divide: [
          { $subtract: ["$product.validFrom", "$transferHistory.transferredAt"] },
          1000 * 60 * 60 * 24
        ]
      },
      platform: "$transferHistory.platform"
    }
  },
  {
    $group: {
      _id: {
        event: "$event",
        category: "$category"
      },
      totalTransfers: { $sum: 1 },
      avgMarkup: { $avg: "$markup" },
      avgMarkupPercent: { $avg: "$markupPercent" },
      maxMarkup: { $max: "$markup" },
      avgDaysBeforeEvent: { $avg: "$daysBeforeEvent" },
      platformBreakdown: {
        $push: "$platform"
      }
    }
  }
])
```

## Access Control and Security

### 3. Gate Entry Analysis
```javascript
// Analyze entry patterns by gate and time
db.tickets.aggregate([
  { $unwind: "$usageHistory" },
  {
    $match: {
      "usageHistory.usedAt": {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    }
  },
  {
    $group: {
      _id: {
        gate: "$usageHistory.location.gate",
        hour: { $hour: "$usageHistory.usedAt" },
        method: "$usageHistory.method"
      },
      entries: { $sum: 1 },
      uniqueEvents: { $addToSet: "$product.eventId" },
      avgProcessingTime: {
        $avg: {
          $cond: [
            { $ne: ["$usageHistory.exitAt", null] },
            {
              $divide: [
                { $subtract: ["$usageHistory.exitAt", "$usageHistory.usedAt"] },
                1000 * 60 // Minutes
              ]
            },
            null
          ]
        }
      }
    }
  },
  {
    $group: {
      _id: "$_id.gate",
      hourlyTraffic: {
        $push: {
          hour: "$_id.hour",
          method: "$_id.method",
          count: "$entries"
        }
      },
      totalEntries: { $sum: "$entries" },
      peakHour: { $max: { hour: "$_id.hour", count: "$entries" } },
      eventsServed: { $addToSet: { $arrayElemAt: ["$uniqueEvents", 0] } }
    }
  },
  {
    $project: {
      gate: "$_id",
      metrics: {
        totalEntries: "$totalEntries",
        eventsCount: { $size: "$eventsServed" },
        peakHour: "$peakHour",
        methodDistribution: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: "$hourlyTraffic.method" },
              as: "method",
              in: {
                k: "$$method",
                v: {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$hourlyTraffic",
                          cond: { $eq: ["$$this.method", "$$method"] }
                        }
                      },
                      in: "$$this.count"
                    }
                  }
                }
              }
            }
          }
        }
      },
      hourlyBreakdown: "$hourlyTraffic"
    }
  }
])
```

### 4. Fraud Detection Report
```javascript
// Identify potentially fraudulent ticket activity
db.tickets.aggregate([
  {
    $match: {
      $or: [
        { "security.riskScore": { $gte: 0.7 } },
        { "access.status": "revoked" },
        { 
          $expr: {
            $gte: [{ $size: { $ifNull: ["$transferHistory", []] } }, 3]
          }
        }
      ]
    }
  },
  {
    $project: {
      ticketNumber: 1,
      event: "$product.eventName",
      riskFactors: {
        riskScore: "$security.riskScore",
        isRevoked: { $eq: ["$access.status", "revoked"] },
        revokedReason: "$access.revokedReason",
        transferCount: { $size: { $ifNull: ["$transferHistory", []] } },
        
        // Suspicious patterns
        rapidTransfers: {
          $let: {
            vars: {
              transfers: { $ifNull: ["$transferHistory", []] }
            },
            in: {
              $anyElementTrue: {
                $map: {
                  input: { $range: [1, { $size: "$$transfers" }] },
                  as: "idx",
                  in: {
                    $lt: [
                      {
                        $divide: [
                          {
                            $subtract: [
                              { $arrayElemAt: ["$$transfers.transferredAt", "$$idx"] },
                              { $arrayElemAt: ["$$transfers.transferredAt", { $subtract: ["$$idx", 1] }] }
                            ]
                          },
                          1000 * 60 * 60 // Less than 1 hour between transfers
                        ]
                      },
                      1
                    ]
                  }
                }
              }
            }
          }
        },
        
        priceAnomaly: {
          $gt: [
            { $max: "$transferHistory.salePrice" },
            { $multiply: ["$product.price", 5] } // 5x face value
          ]
        }
      },
      details: {
        originalPurchase: {
          date: "$purchase.purchaseDate",
          ip: "$security.ipAddress",
          device: "$security.deviceFingerprint"
        },
        currentOwner: "$currentOwner.name",
        lastTransfer: { $last: "$transferHistory" }
      }
    }
  },
  {
    $sort: { "riskFactors.riskScore": -1 }
  }
])
```

## Delivery and Fulfillment

### 5. Delivery Status Report
```javascript
// Track ticket delivery and collection status
db.tickets.aggregate([
  {
    $group: {
      _id: {
        functionId: "$product.functionId",
        method: "$delivery.method",
        status: "$delivery.status"
      },
      count: { $sum: 1 },
      tickets: {
        $push: {
          $cond: [
            { $ne: ["$delivery.status", "delivered"] },
            {
              ticketNumber: "$ticketNumber",
              owner: "$currentOwner.name",
              purchaseDate: "$purchase.purchaseDate"
            },
            null
          ]
        }
      }
    }
  },
  {
    $group: {
      _id: {
        functionId: "$_id.functionId",
        method: "$_id.method"
      },
      statuses: {
        $push: {
          status: "$_id.status",
          count: "$count",
          pendingTickets: {
            $filter: {
              input: "$tickets",
              cond: { $ne: ["$$this", null] }
            }
          }
        }
      },
      total: { $sum: "$count" }
    }
  },
  {
    $project: {
      function: "$_id.functionId",
      deliveryMethod: "$_id.method",
      summary: {
        total: "$total",
        breakdown: {
          $arrayToObject: {
            $map: {
              input: "$statuses",
              in: {
                k: "$$this.status",
                v: {
                  count: "$$this.count",
                  percentage: {
                    $multiply: [
                      { $divide: ["$$this.count", "$total"] },
                      100
                    ]
                  },
                  samples: { $slice: ["$$this.pendingTickets", 5] }
                }
              }
            }
          }
        }
      }
    }
  }
])
```

### 6. Will Call Queue Management
```javascript
// Real-time will call collection status
db.tickets.aggregate([
  {
    $match: {
      "delivery.method": "will_call",
      "delivery.status": { $ne: "collected" }
    }
  },
  {
    $lookup: {
      from: "registrations",
      localField: "purchase.registrationId",
      foreignField: "_id",
      as: "registration"
    }
  },
  {
    $unwind: "$registration"
  },
  {
    $group: {
      _id: "$purchase.registrationId",
      registrationNumber: { $first: "$purchase.registrationNumber" },
      purchaser: { $first: "$purchase.purchasedBy.name" },
      ticketCount: { $sum: 1 },
      tickets: {
        $push: {
          ticketNumber: "$ticketNumber",
          event: "$product.eventName",
          booth: "$delivery.willCall.booth"
        }
      },
      registrationType: { $first: "$registration.type" },
      
      // Priority scoring
      priorityScore: {
        $sum: {
          $add: [
            { $cond: [{ $eq: ["$product.productCategory", "vip"] }, 10, 0] },
            { $cond: [{ $eq: ["$registration.type", "lodge"] }, 5, 0] },
            {
              $multiply: [
                {
                  $divide: [
                    { $subtract: [new Date(), "$purchase.purchaseDate"] },
                    1000 * 60 * 60 * 24
                  ]
                },
                0.1 // Age of purchase factor
              ]
            }
          ]
        }
      }
    }
  },
  {
    $sort: { priorityScore: -1 }
  },
  {
    $project: {
      registration: {
        number: "$registrationNumber",
        type: "$registrationType",
        purchaser: "$purchaser"
      },
      tickets: {
        count: "$ticketCount",
        list: "$tickets"
      },
      priority: {
        score: { $round: ["$priorityScore", 2] },
        isVIP: {
          $anyElementTrue: {
            $map: {
              input: "$tickets",
              in: { $eq: ["$$this.event", "vip"] }
            }
          }
        }
      }
    }
  }
])
```

## Capacity and Availability

### 7. Real-time Availability by Zone
```javascript
// Calculate remaining capacity by access zone
db.tickets.aggregate([
  {
    $match: {
      "product.functionId": "gp-2025",
      status: { $in: ["active", "transferred"] }
    }
  },
  { $unwind: "$access.zones" },
  {
    $group: {
      _id: {
        eventId: "$product.eventId",
        zone: "$access.zones"
      },
      sold: { $sum: 1 },
      
      // Entry tracking
      checkedIn: {
        $sum: {
          $cond: [
            {
              $anyElementTrue: {
                $map: {
                  input: { $ifNull: ["$usageHistory", []] },
                  in: { $ne: ["$$this.exitAt", null] }
                }
              }
            },
            1,
            0
          ]
        }
      },
      
      // Current occupancy (checked in but not exited)
      currentlyInside: {
        $sum: {
          $cond: [
            {
              $anyElementTrue: {
                $map: {
                  input: { $ifNull: ["$usageHistory", []] },
                  in: {
                    $and: [
                      { $ne: ["$$this.usedAt", null] },
                      { $eq: ["$$this.exitAt", null] }
                    ]
                  }
                }
              }
            },
            1,
            0
          ]
        }
      }
    }
  },
  {
    $lookup: {
      from: "functions",
      let: { eventId: "$_id.eventId" },
      pipeline: [
        { $match: { functionId: "gp-2025" } },
        { $unwind: "$events" },
        { $match: { $expr: { $eq: ["$events.event_id", "$$eventId"] } } },
        { $unwind: "$events.products" },
        { $match: { "events.products.features.accessZones": { $exists: true } } },
        {
          $project: {
            eventName: "$events.name",
            zoneCapacities: "$events.products.inventory.zoneCapacities"
          }
        }
      ],
      as: "eventInfo"
    }
  },
  {
    $project: {
      event: {
        id: "$_id.eventId",
        name: { $first: "$eventInfo.eventName" }
      },
      zone: "$_id.zone",
      capacity: {
        $ifNull: [
          { $first: "$eventInfo.zoneCapacities.$_id.zone" },
          "unlimited"
        ]
      },
      status: {
        sold: "$sold",
        checkedIn: "$checkedIn",
        currentOccupancy: "$currentlyInside",
        available: {
          $cond: [
            { $eq: ["$capacity", "unlimited"] },
            "unlimited",
            { $subtract: ["$capacity", "$sold"] }
          ]
        }
      }
    }
  }
])
```

## Customer Analytics

### 8. Ticket Purchase Patterns
```javascript
// Analyze customer buying behavior
db.tickets.aggregate([
  {
    $group: {
      _id: "$purchase.purchasedBy.id",
      customerName: { $first: "$purchase.purchasedBy.name" },
      customerType: { $first: "$purchase.purchasedBy.type" },
      
      // Purchase metrics
      totalTickets: { $sum: 1 },
      uniqueEvents: { $addToSet: "$product.eventId" },
      totalSpent: { $sum: "$purchase.pricePaid" },
      
      // Category preferences
      categoryPreferences: {
        $push: "$product.productCategory"
      },
      
      // Transfer behavior
      transferredTickets: {
        $sum: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ["$transferHistory", []] } }, 0] },
            1,
            0
          ]
        }
      },
      
      // Timing patterns
      purchaseDates: { $push: "$purchase.purchaseDate" },
      
      // Group size
      registrations: { $addToSet: "$purchase.registrationId" }
    }
  },
  {
    $project: {
      customer: {
        id: "$_id",
        name: "$customerName",
        type: "$customerType"
      },
      metrics: {
        totalTickets: "$totalTickets",
        eventsAttended: { $size: "$uniqueEvents" },
        totalSpent: "$totalSpent",
        avgTicketPrice: { $divide: ["$totalSpent", "$totalTickets"] },
        transferRate: {
          $multiply: [
            { $divide: ["$transferredTickets", "$totalTickets"] },
            100
          ]
        }
      },
      preferences: {
        favoriteCategory: {
          $first: {
            $arrayElemAt: [
              {
                $map: {
                  input: { $setUnion: "$categoryPreferences" },
                  as: "cat",
                  in: {
                    category: "$$cat",
                    count: {
                      $size: {
                        $filter: {
                          input: "$categoryPreferences",
                          cond: { $eq: ["$$this", "$$cat"] }
                        }
                      }
                    }
                  }
                }
              },
              0
            ]
          }
        }
      },
      behavior: {
        avgGroupSize: {
          $divide: ["$totalTickets", { $size: "$registrations" }]
        },
        purchaseFrequency: {
          $divide: [
            { $size: "$purchaseDates" },
            {
              $divide: [
                {
                  $subtract: [
                    { $max: "$purchaseDates" },
                    { $min: "$purchaseDates" }
                  ]
                },
                1000 * 60 * 60 * 24 * 30 // Purchases per month
              ]
            }
          ]
        }
      }
    }
  },
  {
    $sort: { "metrics.totalSpent": -1 }
  }
])
```

## Seat Management

### 9. Seating Chart Status
```javascript
// Generate real-time seating availability
db.tickets.aggregate([
  {
    $match: {
      "product.eventId": "gala-dinner-2025",
      "seat.section": { $exists: true }
    }
  },
  {
    $group: {
      _id: {
        section: "$seat.section",
        row: "$seat.row"
      },
      seats: {
        $push: {
          number: "$seat.number",
          status: "$status",
          accessibility: "$seat.accessibility",
          owner: "$currentOwner.name",
          category: "$product.productCategory"
        }
      }
    }
  },
  {
    $group: {
      _id: "$_id.section",
      rows: {
        $push: {
          row: "$_id.row",
          seats: "$seats",
          occupancy: { $size: "$seats" }
        }
      },
      sectionStats: {
        total: { $sum: { $size: "$seats" } },
        accessible: {
          $sum: {
            $size: {
              $filter: {
                input: "$seats",
                cond: { $eq: ["$$this.accessibility", true] }
              }
            }
          }
        }
      }
    }
  },
  {
    $project: {
      section: "$_id",
      layout: {
        rows: {
          $sortArray: {
            input: "$rows",
            sortBy: { row: 1 }
          }
        }
      },
      summary: {
        totalSeats: "$sectionStats.total",
        accessibleSeats: "$sectionStats.accessible",
        occupancyRate: {
          $multiply: [
            { $divide: ["$sectionStats.total", 500] }, // Assuming 500 seats per section
            100
          ]
        }
      }
    }
  }
])
```

## Performance Metrics

### 10. Scanning Performance Analysis
```javascript
// Analyze QR/barcode scanning efficiency
db.tickets.aggregate([
  {
    $match: {
      "usageHistory": { $exists: true, $ne: [] }
    }
  },
  { $unwind: "$usageHistory" },
  {
    $project: {
      scanner: "$usageHistory.location.scanner",
      method: "$usageHistory.method",
      scanTime: "$usageHistory.usedAt",
      dayOfWeek: { $dayOfWeek: "$usageHistory.usedAt" },
      hour: { $hour: "$usageHistory.usedAt" },
      
      // Calculate time since last scan on same device
      timeSincePrevious: {
        $let: {
          vars: {
            prevScan: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$usageHistory",
                    cond: {
                      $and: [
                        { $eq: ["$$this.location.scanner", "$usageHistory.location.scanner"] },
                        { $lt: ["$$this.usedAt", "$usageHistory.usedAt"] }
                      ]
                    }
                  }
                },
                -1
              ]
            }
          },
          in: {
            $cond: [
              { $ne: ["$$prevScan", null] },
              {
                $divide: [
                  { $subtract: ["$usageHistory.usedAt", "$$prevScan.usedAt"] },
                  1000 // Convert to seconds
                ]
              },
              null
            ]
          }
        }
      }
    }
  },
  {
    $match: {
      timeSincePrevious: { $ne: null }
    }
  },
  {
    $group: {
      _id: {
        scanner: "$scanner",
        method: "$method",
        hour: "$hour"
      },
      scansPerformed: { $sum: 1 },
      avgTimeBetweenScans: { $avg: "$timeSincePrevious" },
      minTime: { $min: "$timeSincePrevious" },
      maxTime: { $max: "$timeSincePrevious" }
    }
  },
  {
    $group: {
      _id: "$_id.scanner",
      performance: {
        $push: {
          method: "$_id.method",
          hour: "$_id.hour",
          metrics: {
            scansPerHour: { $multiply: ["$scansPerformed", { $divide: [3600, "$avgTimeBetweenScans"] }] },
            avgProcessingTime: { $round: ["$avgTimeBetweenScans", 2] },
            efficiency: {
              $multiply: [
                { $divide: [1, { $max: ["$avgTimeBetweenScans", 1] }] },
                100
              ]
            }
          }
        }
      },
      dailyTotal: { $sum: "$scansPerformed" }
    }
  }
])
```