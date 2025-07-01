# Database Schema Design Task Documentation

## Collaborative Working Process

### Our Approach
- **I am assisting you**, not doing the work independently
- We discuss each decision before implementing
- You provide the requirements and mappings
- I help document them in the correct MongoDB formats
- We work through each field systematically together

### Critical Rule
**"I didn't want you to go and do all of that, I wanted to talk through it so it doesn't get fucked up like it did before when an LLM went off and created stuff and then broke it by creating new shit that was out of line with the shit it previously created."**

This means:
- No creating fields without explicit discussion
- No assumptions about data structures
- Always clarify before adding anything
- Keep everything consistent with what we've already decided

## Task Overview
We are designing a clean MongoDB database schema for the LodgeTix ticketing system by:
1. Documenting the schema structure before building
2. Creating mapping documents from the dirty/existing database to the new clean structure
3. Building everything in one collection first, then deciding what needs to be extracted

## File Structure & Requirements

### For Each Collection We Must Create:

#### 1. schema.md
- MongoDB document structure in JavaScript format
- Only include fields we've explicitly discussed
- Mark undiscussed fields with "// to be discussed"
- Show data types clearly

#### 2. documents.json
- **MUST be valid JSON** (not .md file)
- Structure matches the MongoDB document exactly
- Values are mapping references:
  - Format: `"fieldName": "collectionName: sourceField"`
  - Example: `"functionId": "functions: functionId"`
  - For unmapped: `"fieldName": "TODO: description"`
- This file is used for migration from dirty to clean database

#### 3. indexes.md
- MongoDB index creation commands in exact MongoDB format
- Include:
  - Primary indexes
  - Unique constraints (like slug)
  - Query optimization indexes
  - Compound indexes where needed
- Format:
```javascript
db.functions.createIndex(
  { "slug": 1 },
  { 
    unique: true,
    name: "slug_unique"
  }
)
```

#### 4. validation.md
- MongoDB schema validation in exact MongoDB format
- Use `$jsonSchema` validation
- Include:
  - Required fields
  - Data type validation
  - Pattern matching (regex)
  - Min/max constraints
- Format:
```javascript
db.createCollection("functions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["fieldName"],
      properties: {
        // ... field definitions
      }
    }
  }
})
```

#### 5. aggregations.md
- Common aggregation pipelines we'll need
- Based on the fields and relationships we define
- Include:
  - Computed field calculations
  - Lookups to other collections
  - Data transformation pipelines
- Format: Full MongoDB aggregation pipeline syntax

## Key Decisions & Instructions

### 1. Document Structure
For each collection, we create 5 files:
- `schema.md` - The MongoDB document structure
- `documents.json` - Mapping from dirty database to clean (must be valid JSON)
- `indexes.md` - MongoDB index definitions
- `validation.md` - MongoDB validation rules
- `aggregations.md` - Common aggregation pipelines

### 2. Hierarchy
**IMPORTANT**: Functions are the parent of Events (not the other way around)
- A Function = Major multi-day event (e.g., "Grand Proclamation 2025")
- Events = Individual activities within the function (e.g., "Banquet", "Ceremony")

### 3. Design Approach
- Start with the highest level (Functions) and work down
- Document everything in the functions collection first
- Later decide what needs to be extracted into separate collections
- Only add fields that have been explicitly discussed
- If something hasn't been discussed, clarify first before adding

### 4. documents.json Format
- Must be valid JSON
- Structure matches the MongoDB document
- Values are either:
  - Mapping paths (e.g., "functions: functionId")
  - "TODO: description" for unmapped fields
- When given a mapping, use exact reference to dirty database

### 5. Field Mappings Documented So Far

#### Functions Collection
- `functionId` → `functions: functionId` (keeping UUID for backwards compatibility)
- `slug` → `functions: slug`
- `name` → Not mapped yet
- MongoDB ObjectId (`_id`) for database operations

#### Events (within Functions)
- `event_id` → `events: event_id`
- `name` → `events: title`
- `type` → `events: type`
- `slug` → `events: slug`

#### Event Details
- `subtitle` → `events: subtitle`
- `description` → `events: description`
- `type` → `events: type`
- `hero_image` → `events: imageUrl`
- `inclusions` → `events: eventIncludes`
- `importantDetails` → `events: importantInformation`

#### Event Dates
- `eventStart` → `events: eventStart`
- `eventEnd` → `events: eventEnd`
- `additionalDateTimes` → User-defined key-value pairs

### 6. Computed Fields
- `dates.startDate` - Computed from first event's eventStart
- `dates.endDate` - Computed from last event's eventEnd

### 7. Validation Decisions
- `slug` must be unique (enforced by unique index)
- `functionId` must be a valid UUID
- All dates should be in timestamp format

### 8. Fields Yet to Define
In Functions:
- registrations (likely references)
- organiser
- location (function level)
- tourism
- sponsorships
- finances
- details

In Events:
- location (event level)
- eligibility
- inventory
- attendees
- tickets
- website
- published status
- featured flag

## Important Reminders
1. Don't create things without discussing first
2. Update ALL relevant files as we go (not just schema.md)
3. Think about indexes, validation, and aggregations for each field
4. Use MongoDB's exact syntax and formats
5. Keep track of all mappings from dirty to clean database
6. documents.json MUST be valid JSON
7. All files must be kept in sync with each other

## Current Progress Tracking

### Files Being Maintained:
- ✅ `/docs/database-schema/collections/functions/schema.md`
- ✅ `/docs/database-schema/collections/functions/documents.json`
- ✅ `/docs/database-schema/collections/functions/indexes.md`
- ✅ `/docs/database-schema/collections/functions/validation.md`
- ✅ `/docs/database-schema/collections/functions/aggregations.md`

### Update Checklist for Each New Field:
When we add a new field, we must:
1. Add to schema.md with correct data type
2. Add mapping to documents.json (or "TODO: ...")
3. Consider if it needs an index → indexes.md
4. Add validation rules → validation.md
5. Consider aggregations that might use it → aggregations.md

## Working Context

### System Information
- We're working in: `/Users/darrenallatt/Development/LodgeTix - Reconcile/`
- Dirty database is in MongoDB: `LodgeTix-migration-test-1`
- We can explore data at: `http://192.168.20.41:3005`

### Our Process
1. You tell me what field to add
2. You provide any mappings from the dirty database
3. We discuss the structure together
4. I update ALL relevant files
5. We review before moving to the next field