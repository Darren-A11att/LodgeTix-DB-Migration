# Jurisdictions Collection Validation

## MongoDB Schema Validation

```javascript
db.createCollection("jurisdictions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["jurisdictionId", "name", "type"],
      properties: {
        _id: {
          bsonType: "objectId"
        },
        jurisdictionId: {
          bsonType: "string",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "Must be a valid UUID"
        },
        name: {
          bsonType: "string",
          minLength: 1,
          maxLength: 200,
          description: "Grand Lodge name"
        },
        abbreviation: {
          bsonType: "string",
          minLength: 1,
          maxLength: 20,
          description: "Short code"
        },
        type: {
          bsonType: "string",
          enum: ["grand_lodge", "grand_chapter", "supreme_council"],
          description: "Type of jurisdiction"
        },
        country: {
          bsonType: "string",
          minLength: 1,
          maxLength: 100
        },
        countryCode: {
          bsonType: "string",
          pattern: "^[A-Z]{3}$",
          description: "ISO 3-letter country code"
        },
        stateRegion: {
          bsonType: ["string", "null"],
          maxLength: 100
        },
        stateRegionCode: {
          bsonType: ["string", "null"],
          maxLength: 10
        },
        titles: {
          bsonType: "array",
          items: {
            bsonType: "string"
          },
          description: "Array of masonic titles"
        },
        ranks: {
          bsonType: "array",
          items: {
            bsonType: "string"
          },
          description: "Array of masonic ranks"
        },
        offices: {
          bsonType: "array",
          items: {
            bsonType: "string"
          },
          description: "Array of officer positions"
        },
        organizationId: {
          bsonType: ["string", "null"],
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "Link to organizations collection"
        },
        createdAt: {
          bsonType: "date"
        },
        updatedAt: {
          bsonType: "date"
        }
      },
      additionalProperties: false
    }
  },
  validationLevel: "moderate",
  validationAction: "error"
})
```

# Lodges Collection Validation

```javascript
db.createCollection("lodges", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["lodgeId", "jurisdictionId", "name", "number"],
      properties: {
        _id: {
          bsonType: "objectId"
        },
        lodgeId: {
          bsonType: "string",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "Must be a valid UUID"
        },
        jurisdictionId: {
          bsonType: "string",
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "Must reference a valid jurisdiction"
        },
        name: {
          bsonType: "string",
          minLength: 1,
          maxLength: 200,
          description: "Lodge name"
        },
        number: {
          bsonType: "string",
          minLength: 1,
          maxLength: 10,
          description: "Lodge number"
        },
        displayName: {
          bsonType: "string",
          minLength: 1,
          maxLength: 250,
          description: "Full display name with number"
        },
        district: {
          bsonType: ["string", "null"],
          maxLength: 50
        },
        meetingPlace: {
          bsonType: ["string", "null"],
          maxLength: 200
        },
        areaType: {
          bsonType: ["string", "null"],
          enum: ["METRO", "COUNTRY", null],
          description: "Metropolitan or Country area"
        },
        stateRegion: {
          bsonType: ["string", "null"],
          maxLength: 50
        },
        organizationId: {
          bsonType: ["string", "null"],
          pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          description: "Link to organizations collection"
        },
        createdAt: {
          bsonType: "date"
        },
        updatedAt: {
          bsonType: "date"
        }
      },
      additionalProperties: false
    }
  },
  validationLevel: "moderate",
  validationAction: "error"
})
```

## Validation Rules

### Jurisdictions
1. `jurisdictionId` must be a valid UUID
2. `type` must be one of the allowed jurisdiction types
3. `countryCode` must be 3 uppercase letters
4. Arrays (titles, ranks, offices) can be empty but must be arrays

### Lodges
1. `lodgeId` must be a valid UUID
2. `jurisdictionId` must reference an existing jurisdiction
3. `number` is required and stored as string (can be alphanumeric)
4. `areaType` if present must be METRO or COUNTRY

## Business Rules (Application Level)
1. Lodge numbers must be unique within a jurisdiction
2. Jurisdiction abbreviations should be unique globally
3. When creating a lodge, verify the jurisdictionId exists
4. Empty arrays for titles/ranks/offices are expected initially