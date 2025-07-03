# Contacts Collection Aggregations

## Contact Search and Lookup

### Search Contacts by Name or Email
```javascript
db.contacts.aggregate([
  {
    $match: {
      $or: [
        { "profile.firstName": { $regex: "searchTerm", $options: "i" } },
        { "profile.lastName": { $regex: "searchTerm", $options: "i" } },
        { "profile.email": { $regex: "searchTerm", $options: "i" } }
      ]
    }
  },
  {
    $project: {
      contactNumber: 1,
      fullName: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      email: "$profile.email",
      phone: "$profile.phone",
      lodge: "$masonicProfile.craft.lodge.name"
    }
  },
  { $limit: 20 }
])
```

### Get Contact with All Related Data
```javascript
db.contacts.aggregate([
  { $match: { _id: ObjectId("contactId") } },
  
  // Lookup user account
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "userAccount"
    }
  },
  
  // Lookup organisations
  {
    $lookup: {
      from: "organisations",
      localField: "references.organisationIds",
      foreignField: "_id",
      as: "organisations"
    }
  },
  
  // Lookup attendee records
  {
    $lookup: {
      from: "attendees",
      localField: "references.attendeeIds",
      foreignField: "_id",
      as: "attendeeRecords"
    }
  },
  
  // Lookup relationships
  {
    $lookup: {
      from: "contacts",
      localField: "relationships.contactId",
      foreignField: "_id",
      as: "relatedContacts"
    }
  },
  
  // Format output
  {
    $project: {
      contactNumber: 1,
      profile: 1,
      addresses: 1,
      masonicProfile: 1,
      userAccount: { $arrayElemAt: ["$userAccount", 0] },
      organisations: 1,
      attendeeCount: { $size: "$attendeeRecords" },
      relationships: {
        $map: {
          input: "$relationships",
          as: "rel",
          in: {
            $mergeObjects: [
              "$$rel",
              {
                contact: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$relatedContacts",
                        cond: { $eq: ["$$this._id", "$$rel.contactId"] }
                      }
                    },
                    0
                  ]
                }
              }
            ]
          }
        }
      }
    }
  }
])
```

## Lodge Member Reports

### Lodge Members with Ranks
```javascript
db.contacts.aggregate([
  { 
    $match: { 
      "masonicProfile.craft.lodge.organisationId": ObjectId("lodgeOrgId") 
    } 
  },
  {
    $group: {
      _id: "$masonicProfile.craft.rank",
      count: { $sum: 1 },
      members: {
        $push: {
          contactNumber: "$contactNumber",
          name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
          title: "$masonicProfile.craft.title",
          email: "$profile.email"
        }
      }
    }
  },
  { $sort: { "_id": 1 } }
])
```

### Grand Officers by Grand Lodge
```javascript
db.contacts.aggregate([
  { 
    $match: { 
      "masonicProfile.craft.isGrandOfficer": true 
    } 
  },
  {
    $group: {
      _id: "$masonicProfile.craft.grandLodge.name",
      count: { $sum: 1 },
      officers: {
        $push: {
          name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
          grandOffice: "$masonicProfile.craft.grandOffice",
          lodge: "$masonicProfile.craft.lodge.name"
        }
      }
    }
  },
  { $sort: { count: -1 } }
])
```

## Relationship Analysis

### Find All Emergency Contacts
```javascript
db.contacts.aggregate([
  { $unwind: "$relationships" },
  { $match: { "relationships.isEmergencyContact": true } },
  {
    $lookup: {
      from: "contacts",
      localField: "relationships.contactId",
      foreignField: "_id",
      as: "emergencyContact"
    }
  },
  { $unwind: "$emergencyContact" },
  {
    $project: {
      contactNumber: 1,
      name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      emergencyContactName: { 
        $concat: [
          "$emergencyContact.profile.firstName", 
          " ", 
          "$emergencyContact.profile.lastName"
        ] 
      },
      emergencyContactPhone: "$emergencyContact.profile.phone",
      relationship: "$relationships.relationshipType"
    }
  }
])
```

### Family Connections
```javascript
db.contacts.aggregate([
  { $match: { _id: ObjectId("contactId") } },
  
  // Get all relationships
  {
    $graphLookup: {
      from: "contacts",
      startWith: "$relationships.contactId",
      connectFromField: "relationships.contactId",
      connectToField: "_id",
      as: "familyNetwork",
      maxDepth: 2,
      restrictSearchWithMatch: {
        "relationships.relationshipType": { 
          $in: ["spouse", "partner", "child", "parent", "sibling"] 
        }
      }
    }
  },
  
  // Format the family tree
  {
    $project: {
      contactNumber: 1,
      name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      familySize: { $size: "$familyNetwork" },
      familyMembers: {
        $map: {
          input: "$familyNetwork",
          as: "member",
          in: {
            name: { 
              $concat: [
                "$$member.profile.firstName", 
                " ", 
                "$$member.profile.lastName"
              ] 
            },
            contactNumber: "$$member.contactNumber"
          }
        }
      }
    }
  }
])
```

## Data Quality Reports

### Duplicate Contact Detection
```javascript
db.contacts.aggregate([
  {
    $group: {
      _id: {
        email: { $toLower: "$profile.email" },
        phone: "$profile.phone"
      },
      count: { $sum: 1 },
      contacts: {
        $push: {
          _id: "$_id",
          contactNumber: "$contactNumber",
          name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
          createdAt: "$metadata.createdAt"
        }
      }
    }
  },
  { $match: { count: { $gt: 1 } } },
  { $sort: { count: -1 } }
])
```

### Incomplete Profiles
```javascript
db.contacts.aggregate([
  {
    $match: {
      $or: [
        { "profile.email": { $in: [null, ""] } },
        { "profile.phone": { $in: [null, ""] } },
        { "addresses": { $size: 0 } },
        { "addresses": { $exists: false } }
      ]
    }
  },
  {
    $project: {
      contactNumber: 1,
      name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      missingEmail: { $in: ["$profile.email", [null, ""]] },
      missingPhone: { $in: ["$profile.phone", [null, ""]] },
      missingAddress: { 
        $or: [
          { $eq: [{ $size: { $ifNull: ["$addresses", []] } }, 0] },
          { $eq: [{ $type: "$addresses" }, "missing"] }
        ]
      }
    }
  }
])
```

## Financial Summary

### Contact Payment History
```javascript
db.contacts.aggregate([
  { $match: { _id: ObjectId("contactId") } },
  
  // Lookup payments
  {
    $lookup: {
      from: "financial-transactions",
      localField: "references.paymentTransactionIds",
      foreignField: "_id",
      as: "payments"
    }
  },
  
  // Calculate totals
  {
    $project: {
      contactNumber: 1,
      name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      totalPayments: { $size: "$payments" },
      totalAmount: { $sum: "$payments.amounts.total" },
      lastPaymentDate: { $max: "$payments.audit.createdAt" },
      paymentMethods: { $setUnion: "$payments.payments.method" }
    }
  }
])
```

## Migration Support

### Find Contacts Without User Accounts
```javascript
db.contacts.aggregate([
  { 
    $match: { 
      $or: [
        { userId: null },
        { userId: { $exists: false } }
      ]
    }
  },
  {
    $project: {
      contactNumber: 1,
      name: { $concat: ["$profile.firstName", " ", "$profile.lastName"] },
      email: "$profile.email",
      hasEmail: { 
        $and: [
          { $ne: ["$profile.email", null] },
          { $ne: ["$profile.email", ""] }
        ]
      }
    }
  },
  { $match: { hasEmail: true } }
])
```