# Registration Schema Analysis Report
Generated: 2025-07-16T00:44:34.629Z

## Executive Summary

- **Total Registrations**: 157
- **Total Unique Fields**: 459
- **Registration Types**: individuals (133), lodge (24)

## Most Common Schema Structure

The most common schema pattern appears in **8 registrations (5.1%)** and contains **190 fields**.

## Core Fields (Present in >90% of registrations)

These fields form the core structure that is consistent across almost all registrations:

| Field Path | Presence | Count |
|------------|----------|-------|
| `_id` | 100.0% | 157 |
| `status` | 100.0% | 157 |
| `subtotal` | 100.0% | 157 |
| `registrationId` | 100.0% | 157 |
| `totalAmountPaid` | 100.0% | 157 |
| `paymentStatus` | 100.0% | 157 |
| `stripePaymentIntentId` | 100.0% | 157 |
| `registrationType` | 100.0% | 157 |
| `createdAt` | 100.0% | 157 |
| `updatedAt` | 100.0% | 157 |
| `registrationData` | 100.0% | 157 |
| `registrationData.bookingContact` | 100.0% | 157 |
| `registrationData.bookingContact.city` | 100.0% | 157 |
| `registrationData.bookingContact.title` | 100.0% | 157 |
| `registrationData.bookingContact.country` | 100.0% | 157 |
| `registrationData.bookingContact.lastName` | 100.0% | 157 |
| `registrationData.bookingContact.firstName` | 100.0% | 157 |
| `registrationData.bookingContact.addressLine1` | 100.0% | 157 |
| `confirmationNumber` | 100.0% | 157 |
| `squarePaymentId` | 100.0% | 157 |
| `functionId` | 97.5% | 153 |
| `attendeeCount` | 97.5% | 153 |
| `customerId` | 94.3% | 148 |
| `registrationDate` | 94.3% | 148 |
| `totalPricePaid` | 94.3% | 148 |
| `agreeToTerms` | 94.3% | 148 |
| `primaryAttendeeId` | 94.3% | 148 |
| `organisationId` | 94.3% | 148 |
| `connectedAccountId` | 94.3% | 148 |
| `platformFeeAmount` | 94.3% | 148 |

## Schema Patterns by Registration Type

### individuals (133 registrations)

**Common Fields (>90% presence)**: 96 fields

**Unique Fields (only in this type)**:
- `agree_to_terms`
- `attendee_count`
- `auditLog`
- `auditLog[0].action`
- `auditLog[0].description`
- `auditLog[0].details`
- `auditLog[0].details.checkCount`
- `auditLog[0].details.hasPaymentIds`
- `auditLog[0].details.importedBy`
- `auditLog[0].details.originalReason`
- ... and 127 more

### lodge (24 registrations)

**Common Fields (>90% presence)**: 52 fields

**Unique Fields (only in this type)**:
- `customerInvoice.dueDate`
- `customerInvoice.payment.currency`
- `registrationData.attendeeDetails`
- `registrationData.bookingContact.mobile`
- `registrationData.bookingContact.postcode`
- `registrationData.bookingContact.rank`
- `registrationData.bookingContact.state`
- `registrationData.bookingContactId`
- `registrationData.calculatedAmounts`
- `registrationData.calculatedAmounts.processingFee`
- ... and 132 more

## Nested Structure Analysis

### Key Nested Objects

| Object Path | Presence | Registration Types |
|-------------|----------|-------------------|
| `registrationData.bookingContact` | 100.0% | individuals: 133 |
| `registrationData.metadata` | 80.9% | individuals: 114 |

### Array Fields

| Array Path | Presence | Description |
|------------|----------|-------------|
| `registrationData.tickets` | 93.0% | Ticket details |
| `registrationData.attendees` | 84.7% | Attendee information |

## Field Variations and Potential Issues

### Potential Field Duplicates

These fields have similar names and might represent the same data:

- `_id` (100.0%) vs `registrationData.attendees[0].lodge_id` (84.7%)
- `totalAmountPaid` (100.0%) vs `registrationData.totalAmount` (84.7%)
- `registrationData.bookingContact` (100.0%) vs `bookingContactId` (94.3%)
- `primaryAttendeeId` (94.3%) vs `primaryAttendee` (94.3%)
- `registrationData.bookingContact.email` (93.0%) vs `registrationData.bookingContact.emailAddress` (91.7%)
- `registrationData.attendees[0].partner` (84.7%) vs `registrationData.attendees[0].partnerOf` (84.7%)
- `registrationData.attendees[0].lodge_id` (84.7%) vs `registrationData.attendees[0].grand_lodge_id` (84.7%)

## Registration Type Specific Insights

### Individual Registration Specific Fields

Fields that only appear in individual registrations:

- `registrationData.subtotal` (84.7%)
- `registrationData.stripeFee` (84.7%)
- `registrationData.authUserId` (84.7%)
- `registrationData.totalAmount` (84.7%)
- `registrationData.registrationId` (84.7%)
- `registrationData.registrationType` (84.7%)
- `registrationData.attendees` (84.7%)
- `registrationData.attendees[0].rank` (84.7%)
- `registrationData.attendees[0].notes` (84.7%)
- `registrationData.attendees[0].title` (84.7%)
- `registrationData.attendees[0].partner` (84.7%)
- `registrationData.attendees[0].lastName` (84.7%)
- `registrationData.attendees[0].lodge_id` (84.7%)
- `registrationData.attendees[0].firstName` (84.7%)
- `registrationData.attendees[0].firstTime` (84.7%)

### Lodge Registration Specific Fields

Fields that only appear in lodge registrations:


## Recommendations

Based on the schema analysis:

1. **Core Schema**: The core fields present in 100% of registrations should form the base schema
2. **Type-Specific Extensions**: Use inheritance or composition for type-specific fields
3. **Field Standardization**: Consider standardizing similar fields (e.g., email vs emailAddress)
4. **Nested Structure**: The deeply nested structure (registrationData.bookingContact.*, registrationData.attendees[*]) suggests a hierarchical data model
5. **Array Handling**: Attendees and tickets are the primary array fields that need special handling
