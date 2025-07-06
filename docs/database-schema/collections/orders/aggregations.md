# Orders Collection Aggregations

## Order Summary Statistics

### Total Order Value by Status
```javascript
db.orders.aggregate([
  {
    $group: {
      _id: "$status",
      count: { $sum: 1 },
      totalValue: { $sum: "$totals.total" },
      avgValue: { $avg: "$totals.total" }
    }
  },
  {
    $sort: { totalValue: -1 }
  }
]);
```

### Orders by Catalog Object
```javascript
db.orders.aggregate([
  {
    $group: {
      _id: "$catalogObjectId",
      orderCount: { $sum: 1 },
      totalRevenue: { $sum: "$totals.total" },
      totalQuantity: { $sum: { $sum: "$lineItems.quantity" } },
      uniqueCustomers: { $addToSet: "$customer.contactId" }
    }
  },
  {
    $lookup: {
      from: "catalogObjects",
      localField: "_id",
      foreignField: "_id",
      as: "catalog"
    }
  },
  {
    $unwind: "$catalog"
  },
  {
    $project: {
      catalogName: "$catalog.name",
      orderCount: 1,
      totalRevenue: 1,
      totalQuantity: 1,
      customerCount: { $size: "$uniqueCustomers" }
    }
  }
]);
```

## Customer Analytics

### Top Customers by Order Value
```javascript
db.orders.aggregate([
  {
    $match: { "customer.contactId": { $exists: true } }
  },
  {
    $group: {
      _id: "$customer.contactId",
      orderCount: { $sum: 1 },
      totalSpent: { $sum: "$totals.total" },
      avgOrderValue: { $avg: "$totals.total" },
      firstOrder: { $min: "$metadata.createdAt" },
      lastOrder: { $max: "$metadata.createdAt" }
    }
  },
  {
    $lookup: {
      from: "contacts",
      localField: "_id",
      foreignField: "_id",
      as: "contact"
    }
  },
  {
    $unwind: "$contact"
  },
  {
    $project: {
      customerName: { $concat: ["$contact.profile.firstName", " ", "$contact.profile.lastName"] },
      orderCount: 1,
      totalSpent: 1,
      avgOrderValue: 1,
      customerLifetimeValue: "$totalSpent",
      daysSinceFirstOrder: {
        $divide: [
          { $subtract: [new Date(), "$firstOrder"] },
          1000 * 60 * 60 * 24
        ]
      }
    }
  },
  {
    $sort: { totalSpent: -1 }
  },
  {
    $limit: 20
  }
]);
```

### Organization Orders Summary
```javascript
db.orders.aggregate([
  {
    $match: { "customer.organisationId": { $exists: true } }
  },
  {
    $group: {
      _id: "$customer.organisationId",
      orderCount: { $sum: 1 },
      totalSpent: { $sum: "$totals.total" },
      totalAttendees: { $sum: { $size: "$lineItems" } }
    }
  },
  {
    $lookup: {
      from: "organisations",
      localField: "_id",
      foreignField: "_id",
      as: "organisation"
    }
  },
  {
    $unwind: "$organisation"
  },
  {
    $project: {
      organisationName: "$organisation.profile.name",
      orderCount: 1,
      totalSpent: 1,
      totalAttendees: 1,
      avgOrderValue: { $divide: ["$totalSpent", "$orderCount"] }
    }
  }
]);
```

## Fulfillment Analytics

### Unfulfilled Line Items
```javascript
db.orders.aggregate([
  {
    $match: { status: "paid" }
  },
  {
    $unwind: "$lineItems"
  },
  {
    $match: {
      "lineItems.fulfillment.status": { $ne: "fulfilled" }
    }
  },
  {
    $group: {
      _id: {
        orderId: "$_id",
        orderNumber: "$orderNumber"
      },
      unfulfilledItems: { $sum: 1 },
      totalUnfulfilledQuantity: { $sum: "$lineItems.quantity" }
    }
  },
  {
    $sort: { totalUnfulfilledQuantity: -1 }
  }
]);
```

### Fulfillment Rate by Product
```javascript
db.orders.aggregate([
  {
    $unwind: "$lineItems"
  },
  {
    $group: {
      _id: {
        productId: "$lineItems.productId",
        productName: "$lineItems.productName"
      },
      totalQuantity: { $sum: "$lineItems.quantity" },
      fulfilledQuantity: {
        $sum: {
          $cond: [
            { $eq: ["$lineItems.fulfillment.status", "fulfilled"] },
            "$lineItems.quantity",
            0
          ]
        }
      }
    }
  },
  {
    $project: {
      product: "$_id",
      totalQuantity: 1,
      fulfilledQuantity: 1,
      fulfillmentRate: {
        $multiply: [
          { $divide: ["$fulfilledQuantity", "$totalQuantity"] },
          100
        ]
      }
    }
  }
]);
```

## Financial Analytics

### Revenue by Time Period
```javascript
db.orders.aggregate([
  {
    $match: {
      "payment.status": "paid",
      "metadata.createdAt": {
        $gte: ISODate("2024-01-01"),
        $lt: ISODate("2025-01-01")
      }
    }
  },
  {
    $group: {
      _id: {
        year: { $year: "$metadata.createdAt" },
        month: { $month: "$metadata.createdAt" }
      },
      orderCount: { $sum: 1 },
      revenue: { $sum: "$totals.total" },
      avgOrderValue: { $avg: "$totals.total" }
    }
  },
  {
    $sort: { "_id.year": 1, "_id.month": 1 }
  }
]);
```

### Payment Status Distribution
```javascript
db.orders.aggregate([
  {
    $group: {
      _id: "$payment.status",
      count: { $sum: 1 },
      totalValue: { $sum: "$totals.total" },
      totalPaid: { $sum: "$totals.paid" },
      totalBalance: { $sum: "$totals.balance" }
    }
  },
  {
    $project: {
      status: "$_id",
      count: 1,
      totalValue: 1,
      totalPaid: 1,
      totalBalance: 1,
      percentOfOrders: {
        $multiply: [
          { $divide: ["$count", { $sum: "$count" }] },
          100
        ]
      }
    }
  }
]);
```

## Product Performance

### Best Selling Products
```javascript
db.orders.aggregate([
  {
    $unwind: "$lineItems"
  },
  {
    $group: {
      _id: {
        productId: "$lineItems.productId",
        productName: "$lineItems.productName",
        variationId: "$lineItems.variationId",
        variationName: "$lineItems.variationName"
      },
      quantitySold: { $sum: "$lineItems.quantity" },
      revenue: { $sum: "$lineItems.totalPrice" },
      orderCount: { $addToSet: "$_id" }
    }
  },
  {
    $project: {
      product: "$_id",
      quantitySold: 1,
      revenue: 1,
      orderCount: { $size: "$orderCount" },
      avgRevenuePerOrder: { $divide: ["$revenue", { $size: "$orderCount" }] }
    }
  },
  {
    $sort: { revenue: -1 }
  },
  {
    $limit: 20
  }
]);
```

## Attendee Management

### Unassigned Attendees by Order
```javascript
db.orders.aggregate([
  {
    $unwind: "$lineItems"
  },
  {
    $match: {
      "lineItems.owner.type": "unassigned"
    }
  },
  {
    $group: {
      _id: {
        orderId: "$_id",
        orderNumber: "$orderNumber",
        customerName: "$customer.rawData.name"
      },
      unassignedCount: { $sum: "$lineItems.quantity" },
      products: { 
        $push: {
          productName: "$lineItems.productName",
          variationName: "$lineItems.variationName",
          quantity: "$lineItems.quantity"
        }
      }
    }
  },
  {
    $sort: { unassignedCount: -1 }
  }
]);
```

### Contact Order History
```javascript
db.orders.aggregate([
  {
    $match: { "customer.contactId": ObjectId("...") }
  },
  {
    $lookup: {
      from: "tickets",
      localField: "lineItems._id",
      foreignField: "order.lineItemId",
      as: "tickets"
    }
  },
  {
    $project: {
      orderNumber: 1,
      orderDate: "$metadata.createdAt",
      status: 1,
      total: "$totals.total",
      itemCount: { $size: "$lineItems" },
      ticketCount: { $size: "$tickets" },
      items: {
        $map: {
          input: "$lineItems",
          as: "item",
          in: {
            product: "$$item.productName",
            variation: "$$item.variationName",
            quantity: "$$item.quantity",
            price: "$$item.totalPrice"
          }
        }
      }
    }
  },
  {
    $sort: { orderDate: -1 }
  }
]);
```