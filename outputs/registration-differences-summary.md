# Registration Data Structure Analysis Report

## Executive Summary

Analysis of 133 registration records in the LodgeTix database reveals 10 unique structural patterns, with significant variations in fields and data organization. These differences stem from feature evolution, payment integrations, and business requirement changes.

## Key Findings

### 1. **Structural Variations**

The registration collection contains 10 distinct structural patterns:

- **Most Common Pattern (51.88%)**: 69 registrations with standard fields
- **Second Pattern (40.60%)**: 54 registrations with slightly different structure
- **Invoice-Enhanced Pattern (5.26%)**: 7 registrations with invoice-related fields
- **Remaining Patterns**: Small groups with specific variations

### 2. **Major Field Differences**

#### Invoice System Integration (5.3% of registrations)
- `invoiceId`
- `invoiceStatus`
- `invoiceCreated`
- `invoiceCreatedAt`
- `customerInvoiceNumber`
- `supplierInvoiceNumber`

**When introduced**: First seen on June 7, 2025
**Why**: Business requirement for generating and tracking invoices for certain registration types

#### Payment Matching System (5.3% of registrations)
- `matchCriteria`
- `matchedAt`
- `matchedBy`
- `matchedPaymentId`

**When introduced**: June 2025
**Why**: Manual payment reconciliation feature for matching offline payments to registrations

#### Price & Ticket Update Tracking (55.6% of registrations)
- `lastPriceUpdate`
- `priceUpdateReason`
- `lastTicketNameUpdate`
- `ticketNameUpdateReason`

**When introduced**: Throughout June 2025
**Why**: Audit trail for price changes and ticket modifications

### 3. **Registration Data Substructure Patterns**

Two main patterns exist within the `registrationData` field:

1. **Pattern 1 (82% of registrations)**:
   - Has attendees array (avg 1.6 attendees)
   - Has tickets, bookingContact, billingContact
   - Includes Square payment fields

2. **Pattern 2 (18% of registrations)**:
   - No attendees array
   - Has tickets, bookingContact, billingContact
   - Includes Square payment fields

### 4. **Why These Differences Exist**

1. **Feature Evolution**: New capabilities added incrementally
   - Invoice generation system
   - Payment matching for manual reconciliation
   - Price/ticket change tracking

2. **Payment Integration Variations**:
   - All records have Stripe payment fields (100%)
   - Some have additional Square payment data
   - Invoice generation for specific payment scenarios

3. **Business Process Changes**:
   - Introduction of audit trails for modifications
   - Support for different registration types (with/without attendees)
   - Enhanced tracking for financial reconciliation

4. **Data Migration Artifacts**:
   - Mix of field naming conventions (camelCase vs snake_case in registrationData)
   - Different date field names (createdAt vs dateCreated)

### 5. **Timeline of Changes**

All analyzed registrations are from June 2025, showing:
- June 7: First appearance of invoice fields
- June 9-17: Introduction of various structural patterns
- June 25: Payment matching fields appear
- Throughout June: Price/ticket update tracking fields

## Recommendations

1. **Standardize Structure**: Create a unified registration schema to reduce complexity
2. **Handle Optional Features**: Use consistent patterns for optional features (invoices, matching)
3. **Migration Strategy**: Develop migration scripts to normalize existing data
4. **Documentation**: Document all field variations and their purposes
5. **Validation**: Implement schema validation for new registrations

## Technical Details

- **Total Registrations Analyzed**: 133
- **Unique Structure Patterns**: 10
- **Date Range**: June 7-27, 2025
- **Most Variable Fields**: Invoice-related (7 fields), Payment matching (4 fields), Update tracking (4 fields)

## Conclusion

The registration data shows clear evolution over time with features being added incrementally. The main drivers of structural differences are:
1. Business feature additions (invoicing, payment matching)
2. Audit and compliance requirements (update tracking)
3. Support for different registration scenarios (events with/without attendees)

The variations are manageable but would benefit from standardization to improve data consistency and simplify application logic.