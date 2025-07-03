# Jurisdictions Collection Validation

## MongoDB Schema Validation Rules

Due to the dynamic nature of field names in this collection, validation must be flexible. The following shows a base validation schema with examples for craft jurisdictions.

```javascript
db.createCollection("jurisdictions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["type", "definitions"],
      properties: {
        _id: {
          bsonType: "objectId"
        },
        jurisdictionId: {
          bsonType: "string",
          minLength: 1,
          description: "Unique jurisdiction identifier"
        },
        type: {
          bsonType: "string",
          minLength: 1,
          description: "Jurisdiction type (craft, mark & royal arch, etc.)"
        },
        definitions: {
          bsonType: "object",
          required: ["parentName", "parentLabel", "childName", "childLabel"],
          properties: {
            parentName: {
              bsonType: "string",
              minLength: 1,
              description: "Field name for parent entity"
            },
            parentLabel: {
              bsonType: "string",
              minLength: 1,
              description: "Display label for parent entity"
            },
            childName: {
              bsonType: "string",
              minLength: 1,
              description: "Field name for child entities"
            },
            childLabel: {
              bsonType: "string",
              minLength: 1,
              description: "Display label for child entities"
            },
            ranks: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "object",
                required: ["code", "name"],
                properties: {
                  code: { bsonType: "string" },
                  name: { bsonType: "string" },
                  order: { bsonType: ["number", "null"] },
                  abbreviation: { bsonType: ["string", "null"] }
                }
              }
            },
            titles: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "object",
                required: ["code", "name"],
                properties: {
                  code: { bsonType: "string" },
                  name: { bsonType: "string" },
                  abbreviation: { bsonType: ["string", "null"] }
                }
              }
            },
            parentOffices: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "object",
                required: ["code", "name"],
                properties: {
                  code: { bsonType: "string" },
                  name: { bsonType: "string" },
                  order: { bsonType: ["number", "null"] },
                  type: { 
                    bsonType: ["string", "null"],
                    enum: ["elected", "appointed", null]
                  }
                }
              }
            },
            childOffices: {
              bsonType: ["array", "null"],
              items: {
                bsonType: "object",
                required: ["code", "name"],
                properties: {
                  code: { bsonType: "string" },
                  name: { bsonType: "string" },
                  order: { bsonType: ["number", "null"] },
                  type: { 
                    bsonType: ["string", "null"],
                    enum: ["elected", "appointed", null]
                  }
                }
              }
            }
          },
          additionalProperties: false
        },
        metadata: {
          bsonType: "object",
          required: ["createdAt"],
          properties: {
            source: {
              bsonType: ["string", "null"]
            },
            createdAt: {
              bsonType: "date"
            },
            createdBy: {
              bsonType: ["objectId", "null"]
            },
            updatedAt: {
              bsonType: ["date", "null"]
            },
            updatedBy: {
              bsonType: ["objectId", "null"]
            },
            version: {
              bsonType: ["number", "null"],
              minimum: 1
            }
          },
          additionalProperties: false
        }
      },
      // Allow additional properties for dynamic parent/child fields
      additionalProperties: true
    }
  },
  validationLevel: "moderate",
  validationAction: "error"
})
```

## Dynamic Field Validation

Since parent and child field names are defined in `definitions`, additional validation must be performed in application logic:

### Validate Parent Entity Structure
```javascript
function validateParentEntity(doc) {
  const parentName = doc.definitions.parentName;
  const parentEntity = doc[parentName];
  
  if (!parentEntity) {
    throw new Error(`Missing required parent entity: ${parentName}`);
  }
  
  // Required parent fields
  const requiredFields = ['name'];
  for (const field of requiredFields) {
    if (!parentEntity[field]) {
      throw new Error(`Missing required field: ${parentName}.${field}`);
    }
  }
  
  // Validate geographic fields if present
  if (parentEntity.countryCode && !/^[A-Z]{3}$/.test(parentEntity.countryCode)) {
    throw new Error('Country code must be 3 uppercase letters (ISO3)');
  }
}
```

### Validate Child Entities Structure
```javascript
function validateChildEntities(doc) {
  const parentName = doc.definitions.parentName;
  const childName = doc.definitions.childName;
  const children = doc[parentName]?.[childName];
  
  if (!Array.isArray(children)) {
    return; // Children are optional
  }
  
  children.forEach((child, index) => {
    // Required child fields
    if (!child.name) {
      throw new Error(`Missing name for ${childName}[${index}]`);
    }
    
    // Validate status if present
    const validStatuses = ['active', 'dormant', 'consecrating', 'amalgamated', 'closed'];
    if (child.status && !validStatuses.includes(child.status)) {
      throw new Error(`Invalid status for ${childName}[${index}]: ${child.status}`);
    }
    
    // Validate area type if present
    const validAreaTypes = ['METRO', 'COUNTRY', 'REGIONAL'];
    if (child.areaType && !validAreaTypes.includes(child.areaType)) {
      throw new Error(`Invalid area type for ${childName}[${index}]: ${child.areaType}`);
    }
  });
}
```

### Validate Jurisdiction Type Consistency
```javascript
function validateJurisdictionType(doc) {
  const validTypes = {
    'craft': {
      parentName: 'grandLodge',
      childName: 'lodges'
    },
    'mark & royal arch': {
      parentName: 'grandChapter',
      childName: 'chapters'
    },
    'scottish rite': {
      parentName: 'supremeCouncil',
      childName: 'valleys'
    }
  };
  
  const typeConfig = validTypes[doc.type];
  if (typeConfig) {
    // Validate that definitions match expected values for known types
    if (doc.definitions.parentName !== typeConfig.parentName) {
      console.warn(`Unexpected parent name for ${doc.type}: ${doc.definitions.parentName}`);
    }
    if (doc.definitions.childName !== typeConfig.childName) {
      console.warn(`Unexpected child name for ${doc.type}: ${doc.definitions.childName}`);
    }
  }
}
```

### Validate Meeting Schedule
```javascript
function validateMeetingSchedule(schedule) {
  if (!schedule) return;
  
  const validFrequencies = ['weekly', 'fortnightly', 'monthly', 'bi-monthly', 'quarterly'];
  if (schedule.frequency && !validFrequencies.includes(schedule.frequency)) {
    throw new Error(`Invalid meeting frequency: ${schedule.frequency}`);
  }
  
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  if (schedule.dayOfWeek && !validDays.includes(schedule.dayOfWeek)) {
    throw new Error(`Invalid day of week: ${schedule.dayOfWeek}`);
  }
  
  const validWeeks = ['first', 'second', 'third', 'fourth', 'last'];
  if (schedule.weekOfMonth && !validWeeks.includes(schedule.weekOfMonth)) {
    throw new Error(`Invalid week of month: ${schedule.weekOfMonth}`);
  }
  
  // Validate time format (HH:MM)
  if (schedule.time && !/^\d{2}:\d{2}$/.test(schedule.time)) {
    throw new Error(`Invalid time format: ${schedule.time} (expected HH:MM)`);
  }
}
```

## Custom Validation Rules

### No Duplicate Child Numbers
```javascript
function validateUniqueChildNumbers(doc) {
  const parentName = doc.definitions.parentName;
  const childName = doc.definitions.childName;
  const children = doc[parentName]?.[childName] || [];
  
  const numbers = children.map(child => child.number).filter(num => num);
  const uniqueNumbers = new Set(numbers);
  
  if (numbers.length !== uniqueNumbers.size) {
    throw new Error(`Duplicate ${childName} numbers found`);
  }
}
```

### Valid Office Order
```javascript
function validateOfficeOrder(offices) {
  if (!Array.isArray(offices)) return;
  
  const orders = offices.map(office => office.order).filter(order => order != null);
  const uniqueOrders = new Set(orders);
  
  if (orders.length !== uniqueOrders.size) {
    throw new Error('Duplicate office order values found');
  }
}
```

## Validation Notes

1. **Flexible Schema**: The collection allows additional properties to accommodate dynamic field names
2. **Application Validation**: Complex validation rules must be enforced at the application level
3. **Type Safety**: Jurisdiction types should be validated against known configurations
4. **Data Integrity**: Child entity arrays should be validated for consistency
5. **Migration Support**: Validation is set to "moderate" to allow existing data during migration