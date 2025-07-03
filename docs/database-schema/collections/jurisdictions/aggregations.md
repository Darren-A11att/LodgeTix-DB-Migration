# Jurisdictions Collection Aggregations

Note: Due to dynamic field naming, these examples use craft jurisdiction field names (`grandLodge`, `lodges`). Actual implementations must use the appropriate field names from `definitions`.

## Jurisdiction Lookups

### Get All Jurisdictions by Type
```javascript
db.jurisdictions.aggregate([
  { $match: { type: "craft" } },
  {
    $project: {
      jurisdictionId: 1,
      type: 1,
      parentName: "$grandLodge.name",
      country: "$grandLodge.country",
      stateRegion: "$grandLodge.stateRegion",
      lodgeCount: { $size: { $ifNull: ["$grandLodge.lodges", []] } }
    }
  },
  { $sort: { parentName: 1 } }
])
```

### Find Jurisdiction by Lodge Number
```javascript
db.jurisdictions.aggregate([
  { $match: { type: "craft" } },
  { $unwind: "$grandLodge.lodges" },
  { $match: { "grandLodge.lodges.number": "414" } },
  {
    $project: {
      jurisdictionId: 1,
      grandLodgeName: "$grandLodge.name",
      lodge: "$grandLodge.lodges"
    }
  }
])
```

### Search Lodges Across All Jurisdictions
```javascript
db.jurisdictions.aggregate([
  { $match: { type: "craft" } },
  { $unwind: "$grandLodge.lodges" },
  {
    $match: {
      "grandLodge.lodges.name": { $regex: "searchTerm", $options: "i" }
    }
  },
  {
    $project: {
      grandLodgeName: "$grandLodge.name",
      country: "$grandLodge.country",
      lodgeNumber: "$grandLodge.lodges.number",
      lodgeName: "$grandLodge.lodges.name",
      lodgeDisplayName: "$grandLodge.lodges.displayName",
      district: "$grandLodge.lodges.district",
      meetingPlace: "$grandLodge.lodges.meetingPlace"
    }
  },
  { $limit: 50 }
])
```

## Geographic Analysis

### Jurisdictions by Country
```javascript
db.jurisdictions.aggregate([
  { $match: { type: "craft" } },
  {
    $group: {
      _id: "$grandLodge.country",
      count: { $sum: 1 },
      jurisdictions: {
        $push: {
          name: "$grandLodge.name",
          abbreviation: "$grandLodge.abbreviation",
          lodgeCount: { $size: { $ifNull: ["$grandLodge.lodges", []] } }
        }
      }
    }
  },
  { $sort: { count: -1 } }
])
```

### Lodges by State/Region
```javascript
db.jurisdictions.aggregate([
  { $match: { type: "craft" } },
  { $unwind: "$grandLodge.lodges" },
  {
    $group: {
      _id: {
        country: "$grandLodge.country",
        state: { $ifNull: ["$grandLodge.lodges.stateRegion", "$grandLodge.stateRegion"] }
      },
      lodgeCount: { $sum: 1 },
      districts: { $addToSet: "$grandLodge.lodges.district" }
    }
  },
  { $sort: { "_id.country": 1, "_id.state": 1 } }
])
```

### Meeting Places Analysis
```javascript
db.jurisdictions.aggregate([
  { $match: { type: "craft" } },
  { $unwind: "$grandLodge.lodges" },
  {
    $group: {
      _id: "$grandLodge.lodges.meetingPlace",
      lodgeCount: { $sum: 1 },
      lodges: {
        $push: {
          number: "$grandLodge.lodges.number",
          name: "$grandLodge.lodges.name",
          district: "$grandLodge.lodges.district"
        }
      }
    }
  },
  { $match: { lodgeCount: { $gt: 1 } } },
  { $sort: { lodgeCount: -1 } }
])
```

## Lodge Statistics

### Active vs Inactive Lodges
```javascript
db.jurisdictions.aggregate([
  { $match: { type: "craft" } },
  { $unwind: "$grandLodge.lodges" },
  {
    $group: {
      _id: {
        jurisdiction: "$grandLodge.name",
        status: { $ifNull: ["$grandLodge.lodges.status", "active"] }
      },
      count: { $sum: 1 }
    }
  },
  {
    $group: {
      _id: "$_id.jurisdiction",
      statusCounts: {
        $push: {
          status: "$_id.status",
          count: "$count"
        }
      },
      totalLodges: { $sum: "$count" }
    }
  },
  { $sort: { totalLodges: -1 } }
])
```

### District Analysis
```javascript
db.jurisdictions.aggregate([
  { $match: { type: "craft" } },
  { $unwind: "$grandLodge.lodges" },
  { $match: { "grandLodge.lodges.district": { $exists: true, $ne: "" } } },
  {
    $group: {
      _id: {
        jurisdiction: "$grandLodge.name",
        district: "$grandLodge.lodges.district"
      },
      lodgeCount: { $sum: 1 },
      areaTypes: { $addToSet: "$grandLodge.lodges.areaType" },
      meetingPlaces: { $addToSet: "$grandLodge.lodges.meetingPlace" }
    }
  },
  { $sort: { "_id.jurisdiction": 1, "_id.district": 1 } }
])
```

## Organisation Relationships

### Link Jurisdictions to Organisations
```javascript
db.jurisdictions.aggregate([
  { $match: { type: "craft" } },
  
  // Lookup parent organisation
  {
    $lookup: {
      from: "organisations",
      localField: "grandLodge.organisationId",
      foreignField: "_id",
      as: "parentOrganisation"
    }
  },
  
  // Unwind lodges to lookup their organisations
  { $unwind: { path: "$grandLodge.lodges", preserveNullAndEmptyArrays: true } },
  
  // Lookup lodge organisations
  {
    $lookup: {
      from: "organisations",
      localField: "grandLodge.lodges.organisationId",
      foreignField: "_id",
      as: "lodgeOrganisation"
    }
  },
  
  // Group back together
  {
    $group: {
      _id: "$_id",
      jurisdictionId: { $first: "$jurisdictionId" },
      type: { $first: "$type" },
      grandLodge: { $first: "$grandLodge" },
      parentOrganisation: { $first: "$parentOrganisation" },
      lodgeOrganisations: {
        $push: {
          lodge: "$grandLodge.lodges",
          organisation: { $arrayElemAt: ["$lodgeOrganisation", 0] }
        }
      }
    }
  }
])
```

## Office and Rank Analysis

### Available Offices by Jurisdiction Type
```javascript
db.jurisdictions.aggregate([
  {
    $group: {
      _id: "$type",
      parentOffices: { $first: "$definitions.parentOffices" },
      childOffices: { $first: "$definitions.childOffices" }
    }
  },
  {
    $project: {
      type: "$_id",
      parentOfficeCount: { $size: { $ifNull: ["$parentOffices", []] } },
      childOfficeCount: { $size: { $ifNull: ["$childOffices", []] } },
      electedParentOffices: {
        $size: {
          $filter: {
            input: { $ifNull: ["$parentOffices", []] },
            cond: { $eq: ["$$this.type", "elected"] }
          }
        }
      },
      appointedParentOffices: {
        $size: {
          $filter: {
            input: { $ifNull: ["$parentOffices", []] },
            cond: { $eq: ["$$this.type", "appointed"] }
          }
        }
      }
    }
  }
])
```

### Rank Hierarchy
```javascript
db.jurisdictions.aggregate([
  { $match: { type: "craft" } },
  { $unwind: "$definitions.ranks" },
  { $sort: { "definitions.ranks.order": 1 } },
  {
    $group: {
      _id: "$type",
      ranks: {
        $push: {
          code: "$definitions.ranks.code",
          name: "$definitions.ranks.name",
          order: "$definitions.ranks.order"
        }
      }
    }
  }
])
```

## Dynamic Field Aggregation

### Generic Parent-Child Count
```javascript
// This function generates aggregation for any jurisdiction type
function getJurisdictionCounts(type, parentName, childName) {
  return db.jurisdictions.aggregate([
    { $match: { type: type } },
    {
      $project: {
        jurisdictionId: 1,
        parentName: `$${parentName}.name`,
        childCount: { 
          $size: { 
            $ifNull: [`$${parentName}.${childName}`, []] 
          } 
        }
      }
    },
    { $sort: { childCount: -1 } }
  ]);
}

// Usage examples:
getJurisdictionCounts('craft', 'grandLodge', 'lodges');
getJurisdictionCounts('mark & royal arch', 'grandChapter', 'chapters');
```

## Data Quality Reports

### Missing Organisation Links
```javascript
db.jurisdictions.aggregate([
  { $match: { type: "craft" } },
  
  // Check parent organisation
  {
    $addFields: {
      missingParentOrg: { 
        $or: [
          { $eq: ["$grandLodge.organisationId", null] },
          { $not: { $ifNull: ["$grandLodge.organisationId", false] } }
        ]
      }
    }
  },
  
  // Unwind and check child organisations
  { $unwind: { path: "$grandLodge.lodges", preserveNullAndEmptyArrays: true } },
  
  {
    $group: {
      _id: "$_id",
      jurisdictionId: { $first: "$jurisdictionId" },
      grandLodgeName: { $first: "$grandLodge.name" },
      missingParentOrg: { $first: "$missingParentOrg" },
      lodgesWithoutOrg: {
        $push: {
          $cond: [
            { 
              $or: [
                { $eq: ["$grandLodge.lodges.organisationId", null] },
                { $not: { $ifNull: ["$grandLodge.lodges.organisationId", false] } }
              ]
            },
            "$grandLodge.lodges.displayName",
            null
          ]
        }
      }
    }
  },
  
  // Filter out nulls and format results
  {
    $project: {
      jurisdictionId: 1,
      grandLodgeName: 1,
      missingParentOrg: 1,
      lodgesWithoutOrg: {
        $filter: {
          input: "$lodgesWithoutOrg",
          cond: { $ne: ["$$this", null] }
        }
      }
    }
  },
  
  // Only show jurisdictions with missing data
  {
    $match: {
      $or: [
        { missingParentOrg: true },
        { "lodgesWithoutOrg.0": { $exists: true } }
      ]
    }
  }
])
```