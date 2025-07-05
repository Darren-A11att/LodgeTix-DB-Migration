# Organizations Collection Schema

## Overview
Stores organizations that can purchase tickets, host events, or provide services. Focused ONLY on event ticketing needs.

## Document Structure
```javascript
{
  "_id": ObjectId("..."),
  "organizationId": "3e893fa6-2cc2-448c-be9c-e3858cc90e11", // UUID from existing data
  
  // Core Identity
  "name": "Lodge Horace Thompson Ryde No. 134",
  "type": "lodge", // lodge, grandlodge, charity, venue, caterer, sponsor, other
  "status": "active", // active, inactive, suspended
  
  // Business Registration (for invoicing)
  "abn": "12345678901", // Australian Business Number
  "gstRegistered": true,
  "charityNumber": null, // if charity
  
  // Primary Contact (for tickets/events)
  "contactName": "John Smith",
  "contactRole": "Secretary", 
  "contactEmail": "secretary@lodge134.org.au",
  "contactPhone": "+61 2 9999 9999",
  
  // Billing Contact (defaults to primary if not specified)
  "billingEmail": "treasurer@lodge134.org.au",
  "billingPhone": "+61 2 9999 9999",
  
  // Address (for invoicing)
  "address": {
    "line1": "123 Main Street",
    "line2": "",
    "city": "Ryde",
    "state": "NSW",
    "postcode": "2112",
    "country": "Australia"
  },
  
  // For Masonic Organizations - Links
  "jurisdictionId": "3e893fa6-2cc2-448c-be9c-e3858cc90e11", // for lodges, links to jurisdiction
  "lodgeId": "7f4e9b2a-1234-5678-9012-3456789abcde", // if type=lodge, links to lodge record
  
  // Ticketing Preferences
  "paymentTerms": "net30", // net30, net14, immediate
  "preferredPaymentMethod": "invoice", // invoice, card, bank
  "purchaseOrderRequired": false,
  
  // Stripe Connect (if they host events)
  "stripeAccountId": "acct_1234567890",
  "stripeAccountStatus": "connected", // connected, pending, inactive
  "stripePayoutsEnabled": true,
  "stripeDetailsSubmitted": true,
  
  // Simple Stats (calculated)
  "eventStats": {
    "eventsHosted": 0,
    "ticketsPurchased": 0,
    "lastPurchaseDate": null,
    "totalSpent": 0
  },
  
  // Metadata
  "createdAt": ISODate("2024-01-01T00:00:00Z"),
  "updatedAt": ISODate("2024-01-01T00:00:00Z"),
  "createdBy": "userId",
  "updatedBy": "userId"
}
```

## Field Definitions

### Core Fields
- `organizationId`: UUID from existing organizations data
- `name`: Organization name for display
- `type`: What kind of organization (for business logic)
- `status`: Active/inactive for soft delete

### Business Fields
- `abn`: For Australian tax invoices
- `gstRegistered`: Determines GST on invoices
- `charityNumber`: For registered charities

### Contact Fields
- `contactEmail/Phone`: Primary contact for all communications
- `billingEmail`: Override for invoice delivery

### Relationships
- `jurisdictionId`: Links masonic orgs to their jurisdiction
- `lodgeId`: Links to lodge record if type=lodge

### Payment Fields
- `paymentTerms`: Default terms for invoices
- `preferredPaymentMethod`: How they prefer to pay
- `stripeAccountId`: For organizations that host events

## What We DON'T Store Here
- Member lists (not needed for ticketing)
- Internal governance/officers
- Meeting schedules
- Complex financial data
- Documents/compliance
- Communication preferences beyond billing
- Any data not directly related to event ticketing

## Use Cases
1. **Ticket Purchase**: Use billing details and payment preferences
2. **Event Hosting**: Use Stripe account for receiving payments
3. **Invoicing**: Use ABN, GST status, and billing address
4. **Registration Forms**: Link to jurisdiction/lodge for dropdowns