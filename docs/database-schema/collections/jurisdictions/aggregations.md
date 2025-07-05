# Jurisdictions Collection Aggregations

## Registration Form Queries

### Get All Jurisdictions for Dropdown
```javascript
db.jurisdictions.aggregate([
  { $match: { type: "grand_lodge" } },
  {
    $project: {
      _id: 0,
      value: "$jurisdictionId",
      label: "$name",
      abbreviation: 1,
      country: 1,
      stateRegion: 1
    }
  },
  { $sort: { label: 1 } }
])
```

### Get Lodges by Jurisdiction for Dropdown
```javascript
db.lodges.aggregate([
  { $match: { jurisdictionId: "3e893fa6-2cc2-448c-be9c-e3858cc90e11" } },
  {
    $project: {
      _id: 0,
      value: "$lodgeId",
      label: "$displayName",
      number: 1,
      district: 1
    }
  },
  { $sort: { number: 1 } }
])
```

### Get Titles/Ranks/Offices for a Jurisdiction
```javascript
db.jurisdictions.aggregate([
  { $match: { jurisdictionId: "3e893fa6-2cc2-448c-be9c-e3858cc90e11" } },
  {
    $project: {
      _id: 0,
      titles: 1,
      ranks: 1,
      offices: 1
    }
  }
])
```

## Ticket Purchase Queries

### Get Organization Details from Lodge Selection
```javascript
db.lodges.aggregate([
  { $match: { lodgeId: "7f4e9b2a-1234-5678-9012-3456789abcde" } },
  {
    $lookup: {
      from: "organizations",
      localField: "organizationId",
      foreignField: "organizationId",
      as: "organization"
    }
  },
  { $unwind: { path: "$organization", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 0,
      lodgeName: "$displayName",
      organizationId: 1,
      organizationName: "$organization.name",
      billingEmail: "$organization.billingEmail",
      contactEmail: "$organization.contactEmail"
    }
  }
])
```

## Analytics Queries

### Count Lodges per Jurisdiction
```javascript
db.lodges.aggregate([
  {
    $group: {
      _id: "$jurisdictionId",
      lodgeCount: { $sum: 1 }
    }
  },
  {
    $lookup: {
      from: "jurisdictions",
      localField: "_id",
      foreignField: "jurisdictionId",
      as: "jurisdiction"
    }
  },
  { $unwind: "$jurisdiction" },
  {
    $project: {
      _id: 0,
      jurisdictionName: "$jurisdiction.name",
      country: "$jurisdiction.country",
      lodgeCount: 1
    }
  },
  { $sort: { lodgeCount: -1 } }
])
```

### Lodges by District
```javascript
db.lodges.aggregate([
  { $match: { jurisdictionId: "3e893fa6-2cc2-448c-be9c-e3858cc90e11" } },
  {
    $group: {
      _id: "$district",
      count: { $sum: 1 },
      lodges: { 
        $push: {
          name: "$displayName",
          meetingPlace: "$meetingPlace"
        }
      }
    }
  },
  { $sort: { _id: 1 } }
])
```

### Meeting Places with Multiple Lodges
```javascript
db.lodges.aggregate([
  { $match: { meetingPlace: { $exists: true, $ne: "" } } },
  {
    $group: {
      _id: "$meetingPlace",
      lodgeCount: { $sum: 1 },
      lodges: { $push: "$displayName" }
    }
  },
  { $match: { lodgeCount: { $gt: 1 } } },
  { $sort: { lodgeCount: -1 } }
])
```

## Data Quality Checks

### Jurisdictions Without Organizations
```javascript
db.jurisdictions.aggregate([
  {
    $match: {
      $or: [
        { organizationId: null },
        { organizationId: { $exists: false } }
      ]
    }
  },
  {
    $project: {
      _id: 0,
      jurisdictionId: 1,
      name: 1,
      type: 1
    }
  }
])
```

### Lodges Without Organizations
```javascript
db.lodges.aggregate([
  {
    $match: {
      $or: [
        { organizationId: null },
        { organizationId: { $exists: false } }
      ]
    }
  },
  {
    $lookup: {
      from: "jurisdictions",
      localField: "jurisdictionId",
      foreignField: "jurisdictionId",
      as: "jurisdiction"
    }
  },
  { $unwind: "$jurisdiction" },
  {
    $project: {
      _id: 0,
      lodgeName: "$displayName",
      jurisdictionName: "$jurisdiction.name",
      lodgeId: 1
    }
  },
  { $limit: 100 }
])
```

## Search Queries

### Search Lodges by Name
```javascript
db.lodges.aggregate([
  { 
    $match: { 
      $or: [
        { name: { $regex: "Port", $options: "i" } },
        { displayName: { $regex: "Port", $options: "i" } }
      ]
    }
  },
  {
    $lookup: {
      from: "jurisdictions",
      localField: "jurisdictionId", 
      foreignField: "jurisdictionId",
      as: "jurisdiction"
    }
  },
  { $unwind: "$jurisdiction" },
  {
    $project: {
      _id: 0,
      lodgeId: 1,
      displayName: 1,
      jurisdictionName: "$jurisdiction.name",
      meetingPlace: 1,
      district: 1
    }
  },
  { $limit: 20 }
])
```