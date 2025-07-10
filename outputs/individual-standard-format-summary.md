# Individual Registrations - Standard Format & Variations

## Standard Format Structure

### Top-Level Registration (35 fields - 100% consistent)
```javascript
{
  // Identity & References
  _id, registrationId, registrationType: "individuals",
  
  // Status & Timestamps
  status, registrationDate, createdAt, updatedAt,
  confirmationGeneratedAt, confirmationNumber, confirmationPdfUrl,
  
  // Organization & Event
  eventId, functionId, organisationId, organisationName, organisationNumber,
  connectedAccountId,
  
  // Users & Contacts
  customerId, authUserId, bookingContactId, 
  primaryAttendeeId, primaryAttendee, attendeeCount,
  
  // Agreement
  agreeToTerms,
  
  // Payment Status
  paymentStatus,
  
  // Financial Fields
  totalAmountPaid, totalPricePaid, subtotal,
  platformFeeAmount, platformFeeId, includesProcessingFee,
  
  // Payment Processors (ALL registrations have BOTH)
  stripePaymentIntentId, stripeFee,
  squarePaymentId, squareFee,
  
  // Nested Data
  registrationData: { ... }
}
```

### Standard registrationData Structure (Used by 71/109 registrations)
```javascript
registrationData: {
  // Arrays
  attendees: [ ... ],        // Array of attendee objects
  tickets: { ... },          // Object with ticket details
  
  // Objects
  bookingContact: { ... },   // Contact information
  metadata: { ... },         // Additional metadata
  
  // Payment & Registration Info
  authUserId,
  functionId,
  registrationId,
  registrationType,
  paymentStatus,
  
  // Financial
  subtotal,
  totalAmount,
  stripeFee,
  stripePaymentIntentId
}
```

## Array Structures

### 1. ATTENDEE Structure

#### Standard Attendee Fields (100% of attendees have these 23 fields)
```javascript
{
  // Identity
  attendeeId, firstName, lastName, title,
  
  // Type & Status
  attendeeType, isPrimary, isPartner, isCheckedIn,
  paymentStatus,
  
  // Contact
  primaryEmail, primaryPhone, 
  contactConfirmed, contactPreference,
  
  // Lodge (basic)
  lodgeNameNumber,
  
  // Event Specific
  dietaryRequirements, specialNeeds, 
  tableAssignment, notes,
  
  // Relationships
  partner, partnerOf, guestOfId, relationship,
  
  // Metadata
  updatedAt
}
```

#### Attendee Variations (Additional Fields)

**Variation 1: Basic (51 attendees)**
- Only the 23 standard fields

**Variation 2: With Lodge Details (+7 fields)**
```javascript
// Additional fields:
firstTime,
rank,
postNominals,
lodgeOrganisationId,
lodge_id,
grandLodgeOrganisationId,
grand_lodge_id
```

**Variation 3: With Grand Officer Status (+9 fields)**
```javascript
// All fields from Variation 2, plus:
grandOfficerStatus,
suffix
```

**Variation 4: Full Grand Officer Details (+11 fields)**
```javascript
// All fields from Variation 3, plus:
presentGrandOfficerRole,
otherGrandOfficerRole
```

**Variation 5: With Text Lodge Names (+11 fields)**
```javascript
// Similar to Variation 3, but includes:
lodge,        // Text name in addition to lodge_id
grand_lodge   // Text name in addition to grand_lodge_id
```

### 2. TICKET Structure

#### Standard Ticket Format (100% consistent - 306 tickets)
```javascript
tickets: {
  "ticket-id-1": {
    eventTicketId: "uuid",
    name: "Ticket Name",
    price: 20,
    quantity: 2
  },
  "ticket-id-2": {
    eventTicketId: "uuid",
    name: "Another Ticket",
    price: 50,
    quantity: 1
  }
}
```

**No variations found** - All tickets have exactly these 4 fields

## Key Variations Summary

### Top-Level Variations

1. **Update Tracking Fields** (68% of registrations)
   - `lastPriceUpdate`, `priceUpdateReason`
   - `lastTicketNameUpdate`, `ticketNameUpdateReason`

2. **Invoice Fields** (3.7% of registrations)
   - `invoiceId`, `invoiceStatus`, `invoiceCreated`
   - `invoiceCreatedAt`, `customerInvoiceNumber`, `supplierInvoiceNumber`

3. **Payment Matching Fields** (5.5% of registrations)
   - `matchCriteria`, `matchedAt`, `matchedBy`, `matchedPaymentId`

### registrationData Variations

1. **Standard Pattern** (71 registrations)
   - 13 fields as shown above

2. **Extended Pattern** (with form fields)
   - Adds: `agreeToTerms`, `eventTitle`, `billToPrimaryAttendee`
   - Different field names: `paymentIntentId` instead of `stripePaymentIntentId`

3. **Square-Enhanced Pattern**
   - Adds: `square_customer_id`, `square_payment_id`
   - Sometimes duplicated as: `squareCustomerId`, `squarePaymentId`

### Attendee Array Variations

- **5 distinct structures** ranging from 23-34 fields
- Core 23 fields are 100% consistent
- Variations add lodge affiliation details progressively
- Grand officer roles appear in more complex variations

### Ticket Array Structure

- **100% consistent** - No variations
- Always 4 fields per ticket
- Stored as object with ticket IDs as keys

## Summary

1. **Top-level structure is highly standardized** with variations only in:
   - Update tracking (present/absent)
   - Invoice generation (rare)
   - Payment matching (rare)

2. **Attendee structures show progressive complexity**:
   - Base: Personal info only
   - Standard: Add lodge affiliations
   - Advanced: Add grand officer details

3. **Ticket structure is completely standardized** with no variations

4. **Payment setup is uniform** - All registrations support both Stripe and Square