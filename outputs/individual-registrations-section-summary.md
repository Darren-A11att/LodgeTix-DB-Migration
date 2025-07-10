# Individual Registrations - Section by Section Analysis

## Overview
**Total Individual Registrations Analyzed: 109**

## Section 1: Core Registration Fields
**100% Consistency** - All individual registrations have these 16 core fields:
- Registration identifiers: `registrationId`, `registrationType`, `confirmationNumber`
- Status and dates: `status`, `registrationDate`, `createdAt`, `updatedAt`
- Event/Organization: `eventId`, `functionId`, `organisationId`, `organisationName`
- User/Contact IDs: `customerId`, `authUserId`, `bookingContactId`, `primaryAttendeeId`
- Terms: `agreeToTerms`

## Section 2: Payment Fields
**Key Finding: 100% have BOTH Stripe and Square fields**

This suggests:
- All individual registrations are set up to support both payment platforms
- No registrations use exclusively one payment method
- Fields present: `stripePaymentIntentId`, `stripeFee`, `squarePaymentId`, `squareFee`

## Section 3: Invoice & Financial Fields

### Always Present (100%):
- `totalAmountPaid`, `totalPricePaid`, `subtotal`
- `platformFeeAmount`, `platformFeeId`
- `includesProcessingFee`

### Invoice Fields (3.7% - only 4 registrations):
- `invoiceId`, `invoiceStatus`, `invoiceCreated`, `invoiceCreatedAt`
- `customerInvoiceNumber`, `supplierInvoiceNumber`

**Insight**: Invoice generation is rare for individual registrations

## Section 4: Update Tracking Fields

**Two distinct patterns:**
1. **67.9% (74 registrations)** have update tracking:
   - `lastPriceUpdate` + `priceUpdateReason`
   - `lastTicketNameUpdate` + `ticketNameUpdateReason`

2. **32.1% (35 registrations)** have no update tracking

**Note**: When present, both price and ticket tracking always appear together

## Section 5: Registration Data Structure

**13 different patterns found**, with key variations:

### Most Common Patterns:
1. **Pattern 1** (50 registrations): 1 attendee, 13 fields
2. **Pattern 2** (17 registrations): 2 attendees, 13 fields
3. **Pattern 3** (10 registrations): 2 attendees, 16 fields (includes `agreeToTerms`, `eventTitle`)

### Attendee Count Distribution:
- 1 attendee: 67 registrations
- 2 attendees: 32 registrations
- 4 attendees: 3 registrations
- 5 attendees: 2 registrations
- 10 attendees: 2 registrations

### Field Variations in registrationData:
- **Base fields** (13): Always include tickets, booking contact, payment info
- **Extended fields** (16-17): Add `agreeToTerms`, `eventTitle`, `billToPrimaryAttendee`
- **Square-enhanced** (15-17): Include Square-specific fields like `square_customer_id`

## Section 6: Attendee Structure Variations

**179 total attendees across 109 registrations**
**15 unique attendee structures**

### Top 5 Patterns:

1. **Pattern 1** (51 attendees - 28.5%):
   - 23 fields - Basic structure
   - Missing: lodge organization IDs, rank, grand lodge info

2. **Pattern 2** (38 attendees - 21.2%):
   - 30 fields - Adds lodge organization fields
   - Includes: `rank`, `firstTime`, lodge/grand lodge IDs

3. **Pattern 3** (20 attendees - 11.2%):
   - 32 fields - Adds grand officer fields
   - New: `grandOfficerStatus`, `suffix`

4. **Pattern 4** (13 attendees - 7.3%):
   - 34 fields - Full grand officer details
   - Adds: `presentGrandOfficerRole`, `otherGrandOfficerRole`

5. **Pattern 5** (12 attendees - 6.7%):
   - 34 fields - Includes textual lodge names
   - Has both `lodge` and `lodge_id`, `grand_lodge` and `grand_lodge_id`

### Field Categories in Attendees:
- **Identity**: firstName, lastName, title, postNominals
- **Lodge Affiliation**: lodgeNameNumber, lodge_id, grand_lodge_id, organizationIds
- **Contact**: primaryEmail, primaryPhone, contactPreference
- **Status**: isPrimary, isPartner, isCheckedIn, paymentStatus
- **Event-specific**: dietaryRequirements, specialNeeds, tableAssignment

## Section 7: Edge Cases & Special Fields

### Always Present but Not Core (100%):
- `paymentStatus`, `connectedAccountId`
- `confirmationPdfUrl`, `organisationNumber`
- `primaryAttendee`, `attendeeCount`
- `confirmationGeneratedAt`

### Payment Matching Fields (5.5% - 6 registrations):
- `matchCriteria`, `matchedAt`, `matchedBy`, `matchedPaymentId`

### Test/Migration Fields (0.9% - 1 registration each):
- `testField`, `processed`, `processedAt`
- `paymentAmount`, `paymentDate`, `paymentId`, `paymentTransactionId`
- `insertedFromSupabase`, `supabaseSync`

## Key Insights

1. **Core structure is highly consistent** - All registrations share the same 16 core fields

2. **Payment setup is uniform** - All registrations support both Stripe and Square

3. **Update tracking is binary** - Either full tracking (68%) or none (32%)

4. **Attendee structures vary significantly** - 15 patterns for 179 attendees shows high customization

5. **Invoice generation is rare** - Only 3.7% of individual registrations

6. **Registration data patterns correlate with:**
   - Number of attendees (1-10)
   - Payment platform fields included
   - Legacy vs newer registration forms

7. **Attendee field complexity increases with:**
   - Lodge affiliation details
   - Grand officer roles
   - Partner relationships