# Functions-Products Aggregation Pipelines

## Overview
These aggregations demonstrate how to work with Functions and Products as separate collections.

## 1. Functions with Products Lookup

```javascript
// Join functions with their products from the separate products collection
db.functions.aggregate([
  {
    $match: {
      functionId: "function-uuid-here"
    }
  },
  {
    $lookup: {
      from: "products",
      localField: "functionId",
      foreignField: "functionId",
      as: "products"
    }
  },
  {
    $addFields: {
      // Group products by event
      eventProducts: {
        $map: {
          input: "$events",
          as: "event",
          in: {
            event_id: "$$event.event_id",
            eventName: "$$event.name",
            products: {
              $filter: {
                input: "$products",
                cond: { $eq: ["$$this.eventId", "$$event.event_id"] }
              }
            }
          }
        }
      },
      // Get function-level products (merchandise, etc.)
      functionProducts: {
        $filter: {
          input: "$products",
          cond: { $eq: ["$$this.eventId", null] }
        }
      }
    }
  },
  {
    $project: {
      products: 0 // Remove the flat products array
    }
  }
])
```

## 2. Revenue Summary with Products

```javascript
// Calculate revenue across functions using the products collection
db.functions.aggregate([
  {
    $lookup: {
      from: "products",
      localField: "functionId",
      foreignField: "functionId",
      pipeline: [
        {
          $match: {
            status: "active"
          }
        },
        {
          $group: {
            _id: "$type",
            totalSold: { $sum: "$inventory.soldCount" },
            totalRevenue: {
              $sum: {
                $multiply: ["$price.amount", "$inventory.soldCount"]
              }
            },
            productCount: { $sum: 1 }
          }
        }
      ],
      as: "productSummary"
    }
  },
  {
    $addFields: {
      totalRevenue: {
        $sum: "$productSummary.totalRevenue"
      },
      totalTicketsSold: {
        $sum: {
          $map: {
            input: {
              $filter: {
                input: "$productSummary",
                cond: { $eq: ["$$this._id", "ticket"] }
              }
            },
            as: "ticketType",
            in: "$$ticketType.totalSold"
          }
        }
      }
    }
  }
])
```

## 3. Event Capacity and Sales Status

```javascript
// Show event capacity and sales from products collection
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
            totalAvailable: { $sum: "$inventory.availableCount" }
          }
        }
      ],
      as: "ticketStats"
    }
  },
  {
    $unwind: {
      path: "$ticketStats",
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $project: {
      functionId: 1,
      functionName: "$name",
      eventId: "$events.event_id",
      eventName: "$events.name",
      eventDate: "$events.dates.eventStart",
      capacity: { $ifNull: ["$ticketStats.totalCapacity", 0] },
      sold: { $ifNull: ["$ticketStats.totalSold", 0] },
      available: { $ifNull: ["$ticketStats.totalAvailable", 0] },
      utilization: {
        $cond: [
          { $gt: ["$ticketStats.totalCapacity", 0] },
          {
            $round: [
              {
                $multiply: [
                  { $divide: ["$ticketStats.totalSold", "$ticketStats.totalCapacity"] },
                  100
                ]
              },
              2
            ]
          },
          0
        ]
      }
    }
  }
])
```