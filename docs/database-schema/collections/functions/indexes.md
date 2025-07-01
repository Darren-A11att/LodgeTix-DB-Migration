# Functions Collection - Indexes

## Indexes

### 1. Default Primary Key
```javascript
db.functions.createIndex({ "_id": 1 })
// Automatically created by MongoDB
```

### 2. Unique Slug
```javascript
db.functions.createIndex(
  { "slug": 1 },
  { 
    unique: true,
    name: "slug_unique"
  }
)
```
**Purpose**: Ensure slug uniqueness, fast lookups by slug

### 3. Function ID Index
```javascript
db.functions.createIndex(
  { "functionId": 1 },
  { 
    unique: true,
    name: "functionId_unique"
  }
)
```
**Purpose**: Fast lookups by functionId (UUID)

### 4. Event Slug Index
```javascript
db.functions.createIndex(
  { "events.slug": 1 },
  { name: "event_slug_index" }
)
```
**Purpose**: Find functions by event slug

### 5. Date Range Index
```javascript
db.functions.createIndex(
  { "dates.startDate": 1, "dates.endDate": 1 },
  { name: "date_range_index" }
)
```
**Purpose**: Query functions by date range

### 6. Event Location ID Index
```javascript
db.functions.createIndex(
  { "events.location.location_id": 1 },
  { name: "event_location_id_index" }
)
```
**Purpose**: Find functions by event location ID