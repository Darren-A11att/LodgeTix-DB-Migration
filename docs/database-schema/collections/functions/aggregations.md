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

## 4. Calculate Event Capacity and Availability

```javascript
db.functions.aggregate([
  {
    $unwind: "$events"
  },
  {
    $lookup: {
      from: "tickets",
      let: { eventId: "$events.event_id" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$eventId", "$$eventId"] },
            status: { $in: ["active", "used"] }
          }
        },
        { $count: "sold" }
      ],
      as: "eventTickets"
    }
  },
  {
    $addFields: {
      "events.ticketsSold": {
        $ifNull: [{ $first: "$eventTickets.sold" }, 0]
      },
      "events.available": {
        $subtract: [
          "$events.inventory.capacity",
          { $ifNull: [{ $first: "$eventTickets.sold" }, 0] }
        ]
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
      eventTickets: 0
    }
  }
])
```

## 5. Update Function Dates (Scheduled Job)

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

## 6. Update Product Stock Levels

```javascript
// This pipeline computes stock levels for each product based on ticket sales
db.functions.aggregate([
  {
    $unwind: "$events"
  },
  {
    $unwind: "$events.products"
  },
  {
    $lookup: {
      from: "tickets",
      let: { 
        eventId: "$events.event_id",
        productId: "$events.products._id"
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$eventId", "$$eventId"] },
                { $eq: ["$productId", "$$productId"] }
              ]
            }
          }
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ],
      as: "ticketCounts"
    }
  },
  {
    $addFields: {
      "events.products.stock.reserved": {
        $ifNull: [
          {
            $first: {
              $filter: {
                input: "$ticketCounts",
                cond: { $eq: ["$$this._id", "reserved"] }
              }
            }
          },
          { count: 0 }
        ]
      },
      "events.products.stock.sold": {
        $ifNull: [
          {
            $first: {
              $filter: {
                input: "$ticketCounts",
                cond: { $eq: ["$$this._id", "paid"] }
              }
            }
          },
          { count: 0 }
        ]
      }
    }
  },
  {
    $addFields: {
      "events.products.stock.reserved": "$events.products.stock.reserved.count",
      "events.products.stock.sold": "$events.products.stock.sold.count",
      "events.products.stock.available": {
        $subtract: [
          "$events.products.stock.max",
          { $add: ["$events.products.stock.sold", "$events.products.stock.reserved"] }
        ]
      }
    }
  },
  {
    $group: {
      _id: {
        functionId: "$_id",
        eventId: "$events.event_id"
      },
      function: { $first: "$$ROOT" },
      products: { $push: "$events.products" }
    }
  },
  {
    $group: {
      _id: "$_id.functionId",
      function: { $first: "$function" },
      events: {
        $push: {
          event_id: "$_id.eventId",
          products: "$products"
        }
      }
    }
  },
  {
    $replaceRoot: {
      newRoot: {
        $mergeObjects: [
          "$function",
          {
            events: {
              $map: {
                input: "$function.events",
                as: "event",
                in: {
                  $mergeObjects: [
                    "$$event",
                    {
                      products: {
                        $ifNull: [
                          {
                            $first: {
                              $filter: {
                                input: "$events",
                                cond: { $eq: ["$$this.event_id", "$$event.event_id"] }
                              }
                            }
                          },
                          "$$event.products"
                        ]
                      }
                    }
                  ]
                }
              }
            }
          }
        ]
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