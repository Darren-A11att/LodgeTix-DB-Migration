# Functions Collection - Aggregation Pipelines

## 1. Compute Function Start and End Dates from Events

```javascript
db.functions.aggregate([
  {
    $addFields: {
      "dates.startDate": {
        $min: "$events.dates.eventStart"
      },
      "dates.endDate": {
        $max: "$events.dates.eventEnd"
      }
    }
  },
  {
    $merge: {
      into: "functions",
      on: "_id",
      whenMatched: "merge"
    }
  }
])
```

## 2. Get Functions with Events in Date Range

```javascript
db.functions.aggregate([
  {
    $match: {
      "dates.startDate": { $lte: ISODate("2025-12-31") },
      "dates.endDate": { $gte: ISODate("2025-01-01") }
    }
  },
  {
    $project: {
      functionId: 1,
      name: 1,
      slug: 1,
      "dates.startDate": 1,
      "dates.endDate": 1,
      eventCount: { $size: "$events" }
    }
  }
])
```

## 3. Functions with Registration Count

```javascript
db.functions.aggregate([
  {
    $lookup: {
      from: "registrations",
      localField: "functionId",
      foreignField: "functionId",
      as: "functionRegistrations"
    }
  },
  {
    $addFields: {
      registrationCount: { $size: "$functionRegistrations" }
    }
  },
  {
    $project: {
      functionRegistrations: 0
    }
  }
])
```

## 4. Calculate Event Capacity and Availability from Products

```javascript
db.functions.aggregate([
  {
    $unwind: "$events"
  },
  {
    $lookup: {
      from: "products",
      let: { 
        functionId: "$functionId",
        eventId: "$events.event_id" 
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$functionId", "$$functionId"] },
                { $eq: ["$eventId", "$$eventId"] },
                { $eq: ["$type", "ticket"] }
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
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
            totalAvailable: { $sum: "$inventory.availableCount" },
            productCount: { $sum: 1 }
          }
        }
      ],
      as: "eventCapacity"
    }
  },
  {
    $addFields: {
      "events.capacity": {
        $ifNull: [{ $first: "$eventCapacity.totalCapacity" }, 0]
      },
      "events.ticketsSold": {
        $ifNull: [{ $first: "$eventCapacity.totalSold" }, 0]
      },
      "events.ticketsReserved": {
        $ifNull: [{ $first: "$eventCapacity.totalReserved" }, 0]
      },
      "events.ticketsAvailable": {
        $ifNull: [{ $first: "$eventCapacity.totalAvailable" }, 0]
      },
      "events.productCount": {
        $ifNull: [{ $first: "$eventCapacity.productCount" }, 0]
      }
    }
  },
  {
    $group: {
      _id: "$_id",
      function: { $first: "$$ROOT" },
      events: { $push: "$events" }
    }
  },
  {
    $replaceRoot: {
      newRoot: {
        $mergeObjects: [
          "$function",
          { events: "$events" }
        ]
      }
    }
  },
  {
    $project: {
      eventCapacity: 0
    }
  }
])
```

## 5. Real-time Inventory Dashboard

```javascript
// Get complete inventory status across all events in a function
db.functions.aggregate([
  {
    $match: {
      functionId: "gp-2025"
    }
  },
  {
    $lookup: {
      from: "products",
      localField: "functionId",
      foreignField: "functionId",
      as: "allProducts"
    }
  },
  {
    $unwind: "$events"
  },
  {
    $project: {
      functionId: 1,
      functionName: "$name",
      event: {
        id: "$events.event_id",
        name: "$events.name",
        type: "$events.type",
        date: "$events.dates.eventStart",
        products: {
          $filter: {
            input: "$allProducts",
            cond: { 
              $and: [
                { $eq: ["$$this.eventId", "$events.event_id"] },
                { $eq: ["$$this.type", "ticket"] }
              ]
            }
          }
        }
      }
    }
  },
  {
    $unwind: "$event.products"
  },
  {
    $group: {
      _id: {
        functionId: "$functionId",
        functionName: "$functionName",
        eventId: "$event.id",
        eventName: "$event.name",
        eventDate: "$event.date"
      },
      products: {
        $push: {
          productId: "$event.products.productId",
          name: "$event.products.name",
          category: "$event.products.category",
          price: "$event.products.price.amount",
          inventory: {
            method: "$event.products.inventory.method",
            capacity: "$event.products.inventory.totalCapacity",
            sold: "$event.products.inventory.soldCount",
            reserved: "$event.products.inventory.reservedCount",
            available: "$event.products.inventory.availableCount"
          },
          status: "$event.products.status"
        }
      },
      totals: {
        capacity: { 
          $sum: {
            $cond: [
              { $eq: ["$event.products.inventory.method", "allocated"] },
              "$event.products.inventory.totalCapacity",
              0
            ]
          }
        },
        sold: { $sum: "$event.products.inventory.soldCount" },
        reserved: { $sum: "$event.products.inventory.reservedCount" },
        available: { $sum: "$event.products.inventory.availableCount" },
        revenue: {
          $sum: {
            $multiply: [
              "$event.products.price.amount",
              "$event.products.inventory.soldCount"
            ]
          }
        }
      }
    }
  },
  {
    $project: {
      function: {
        id: "$_id.functionId",
        name: "$_id.functionName"
      },
      event: {
        id: "$_id.eventId",
        name: "$_id.eventName",
        date: "$_id.eventDate"
      },
      inventory: {
        summary: {
          totalCapacity: "$totals.capacity",
          totalSold: "$totals.sold",
          totalReserved: "$totals.reserved",
          totalAvailable: "$totals.available",
          utilizationRate: {
            $multiply: [
              {
                $divide: ["$totals.sold", "$totals.capacity"]
              },
              100
            ]
          },
          projectedRevenue: "$totals.revenue"
        },
        products: "$products"
      }
    }
  },
  {
    $sort: { "event.date": 1 }
  }
])
```

## 6. Update Function Dates (Scheduled Job)

```javascript
// Run periodically to update computed dates
db.functions.aggregate([
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
])
```

