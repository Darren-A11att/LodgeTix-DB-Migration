# Product Requirements Document: Organizations & Jurisdictions Use Cases

## Overview
This document outlines the use cases for Organizations and Jurisdictions within the LodgeTix Event Ticketing System, focusing ONLY on event ticketing needs.

## Jurisdictions Use Cases

### UC-J1: Registration Form Population
**Purpose:** Populate dropdown fields in event registration forms
- **Actors:** Event Attendee, Registration System
- **Description:** When registering for an event, jurisdictions provide the grand lodge and lodge options
- **Key Requirements:**
  - Store Grand Lodge information (name, abbreviation, region)
  - Store Lodge information (name, number, district)
  - Simple parent-child relationship (Grand Lodge → Lodges)
  - Populate registration dropdowns

### UC-J2: Field Constants Storage
**Purpose:** Store jurisdiction-specific options for registration forms
- **Actors:** System Administrator
- **Description:** Different jurisdictions use different titles, ranks, and offices in their registration forms
- **Key Requirements:**
  - Store arrays of valid options per jurisdiction
  - No data yet - just the capability to add them
  - Used only for form validation and dropdowns

## Organizations Use Cases

### UC-O1: Event Ticket Purchasing
**Purpose:** Organizations purchase tickets for their members
- **Actors:** Lodge Secretary/Treasurer
- **Organization Types:**
  - Grand Lodge
  - Lodge
  - Chapter
  - Other masonic bodies
  - Charities
  - Sponsors
- **Key Requirements:**
  - Purchase tickets in bulk
  - Receive single invoice
  - Allocate tickets to members
  - Track who attends on their tickets

### UC-O2: Event Hosting
**Purpose:** Organizations host events and sell tickets
- **Actors:** Event Organizer
- **Description:** Organizations can create events and manage ticket sales
- **Key Requirements:**
  - Create events
  - Set ticket prices
  - Receive payments
  - Track sales

### UC-O3: Service Provider Invoicing
**Purpose:** Venues and caterers get paid through the platform
- **Actors:** Service Providers
- **Provider Types:**
  - Venues
  - Caterers
  - Equipment hire
- **Key Requirements:**
  - Link to events they service
  - Invoice event organizers
  - Track payments

### UC-O4: Sponsorship Recognition
**Purpose:** Track and display event sponsors
- **Actors:** Sponsors, Event Organizers
- **Description:** Organizations sponsor events for recognition
- **Key Requirements:**
  - Track sponsorship level
  - Display on event page
  - Include in event materials

## Core Ticketing Use Cases

### UC-T1: Bulk Ticket Purchase
**Purpose:** Organizations buy multiple tickets at once
- **Actors:** Lodge Secretary
- **Flow:**
  1. Select event and ticket quantity
  2. Provide organization details for invoice
  3. Pay by invoice or card
  4. Receive tickets to distribute
- **Key Requirements:**
  - Single invoice for multiple tickets
  - Organization owns the tickets
  - Can allocate to members later

### UC-T2: Member Registration with Lodge
**Purpose:** Individual registers but lodge pays
- **Actors:** Member, Lodge
- **Flow:**
  1. Member fills registration form
  2. Selects their Grand Lodge and Lodge from dropdowns
  3. Lodge receives invoice for the ticket
  4. Member attends event
- **Key Requirements:**
  - Jurisdiction data populates dropdowns
  - Organization gets invoiced
  - Member is the attendee

## Simple Data Requirements

### What We Actually Need

**For Jurisdictions:**
- Grand Lodge details (from existing data)
- Lodge details with grand_lodge_id link
- Capability to store titles/ranks arrays (empty for now)
- Used ONLY for registration form dropdowns

**For Organizations:**
- Basic identity (name, type, ABN)
- Contact for invoicing (email, phone)
- Billing address
- Payment preferences
- Link to jurisdiction (for masonic orgs only)

## What This Means for Schema

### Jurisdictions Collection
- Store what we have from grand_lodges and lodges
- Add fields for titles/ranks/offices arrays (empty)
- Simple parent-child relationship
- NO membership management
- NO statistics or analytics

### Organizations Collection  
- Focus on billing and contact info
- Organization type determines capabilities
- Link to jurisdiction for masonic orgs
- NO complex membership tracking
- NO internal governance


## Data Model Requirements

### Jurisdiction Schema (Based on Actual Data)
```javascript
{
  "_id": ObjectId,
  "jurisdictionId": "uuid", // e.g. "3e893fa6-2cc2-448c-be9c-e3858cc90e11"
  "name": "United Grand Lodge of New South Wales & Australian Capital Territory",
  "abbreviation": "UGLNSWACT",
  "country": "Australia",
  "countryCode": "AUS",
  "stateRegion": "New South Wales and Australian Capital Territory",
  "stateRegionCode": "NSW/ACT",
  
  // Empty arrays - ready for future data
  "titles": [],    // e.g. ["WBro", "VWBro"] when provided
  "ranks": [],     // e.g. ["EA", "FC", "MM"] when provided  
  "offices": [],   // e.g. ["WM", "SW", "JW"] when provided
  
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

### Lodge Schema (Separate for now, based on actual data)
```javascript
{
  "_id": ObjectId,
  "lodgeId": "uuid",
  "jurisdictionId": "uuid", // links to jurisdiction
  "name": "Port Macquarie Daylight Lodge",
  "number": "991",
  "displayName": "Port Macquarie Daylight Lodge No. 991",
  "district": "13",
  "meetingPlace": "Wauchope Masonic Centre",
  "areaType": "COUNTRY", // or "METRO"
  "stateRegion": "NSW",
  
  "createdAt": ISODate,
  "updatedAt": ISODate  
}
```

### Organization Schema (Simplified for Event Ticketing)
```javascript
{
  "_id": ObjectId,
  "organizationId": "uuid",
  
  // Core Identity
  "name": "Lodge Horace Thompson Ryde No. 134",
  "type": "lodge", // lodge, grandlodge, charity, venue, caterer, sponsor
  "status": "active",
  
  // Business Identity (for invoicing)
  "abn": "12345678901",
  "gstRegistered": true,
  
  // Contact (for tickets/invoices)
  "contactEmail": "secretary@lodge134.org.au",
  "contactPhone": "+61 2 9999 9999",
  "billingEmail": "treasurer@lodge134.org.au", // defaults to contactEmail
  
  // Address (for invoicing)
  "address": {
    "line1": "123 Main St",
    "city": "Ryde",
    "state": "NSW",
    "postcode": "2112",
    "country": "Australia"
  },
  
  // For Masonic Orgs - Link to Jurisdiction
  "jurisdictionId": "uuid", // only for lodges/grand lodges
  "lodgeId": "uuid", // links to lodge record if type=lodge
  
  // Payment Preferences
  "paymentTerms": "net30",
  "preferredPaymentMethod": "invoice", // invoice, card
  
  // Stripe Connect (if they host events)
  "stripeAccountId": "acct_xxx",
  "stripeAccountStatus": "connected",
  
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

## Summary

For an event ticketing platform, we need:

**Jurisdictions:**
- Store grand lodges and lodges from existing data
- Titles without dots: Bro, W Bro, VW Bro, RW Bro, MW Bro
- Ranks: EAF, FCF, MM, IM, GL
- Used ONLY for populating registration form dropdowns
- All IDs use UUID v4 format (except MongoDB _id)

**Organizations:**
- Basic identity and contact info for invoicing
- Link to jurisdiction for masonic organizations
- Payment preferences for ticket purchases
- Stripe info if they host events

**NO NEED FOR:**
- Member management
- Membership statistics
- Internal governance
- Complex hierarchies
- Analytics beyond ticket sales