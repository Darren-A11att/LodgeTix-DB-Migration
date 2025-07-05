# Jurisdictions Collection Schema

## Overview
Stores grand lodges and their field constants (titles, ranks, offices) for populating registration form dropdowns. This is ONLY for event ticketing - not membership management.

## Document Structure
```javascript
{
  "_id": ObjectId("..."),
  "jurisdictionId": "3e893fa6-2cc2-448c-be9c-e3858cc90e11", // UUID from existing data
  
  // Core Identity
  "name": "United Grand Lodge of New South Wales & Australian Capital Territory",
  "abbreviation": "UGLNSWACT",
  "type": "grand_lodge", // grand_lodge, grand_chapter, supreme_council
  
  // Location (from existing data)
  "country": "Australia", 
  "countryCode": "AUS",
  "stateRegion": "New South Wales and Australian Capital Territory",
  "stateRegionCode": "NSW/ACT",
  
  // Field Constants for Registration Forms
  "titles": ["Bro", "W Bro", "VW Bro", "RW Bro", "MW Bro"],
  "ranks": ["EAF", "FCF", "MM", "IM", "GL"],
  "offices": ["WM", "SW", "JW", "Treasurer", "Secretary", "SD", "JD", "IG", "Tyler"]
  
  // Link to organization (if exists)
  "organizationId": "3e893fa6-2cc2-448c-be9c-e3858cc90e11", // same as jurisdictionId usually
  
  // Metadata
  "createdAt": ISODate("2024-01-01T00:00:00Z"),
  "updatedAt": ISODate("2024-01-01T00:00:00Z")
}
```

## Separate Lodges Collection
```javascript
{
  "_id": ObjectId("..."),
  "lodgeId": "7f4e9b2a-1234-5678-9012-3456789abcde", // UUID from existing data
  "jurisdictionId": "3e893fa6-2cc2-448c-be9c-e3858cc90e11", // links to jurisdiction
  
  // Core Identity
  "name": "Port Macquarie Daylight Lodge",
  "number": "991",
  "displayName": "Port Macquarie Daylight Lodge No. 991",
  
  // Location Info
  "district": "13",
  "meetingPlace": "Wauchope Masonic Centre", 
  "areaType": "COUNTRY", // or "METRO"
  "stateRegion": "NSW",
  
  // Link to organization (if exists)
  "organizationId": "7f4e9b2a-1234-5678-9012-3456789abcde", // same as lodgeId usually
  
  // Metadata
  "createdAt": ISODate("2024-01-01T00:00:00Z"),
  "updatedAt": ISODate("2024-01-01T00:00:00Z")
}
```

## Purpose & Usage
1. Jurisdictions populate the "Grand Lodge" dropdown in registration forms
2. Lodges populate the "Lodge" dropdown after Grand Lodge is selected
3. Titles/ranks/offices arrays populate other dropdowns (when data is provided)
4. This is ONLY for event registration - not member management

## What We DON'T Store Here
- Member lists
- Membership statistics  
- Meeting schedules
- Officer lists
- Governance details
- Any data not needed for event ticketing