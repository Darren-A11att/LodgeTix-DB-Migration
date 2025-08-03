# Invoice Generation Test Cases

This directory contains 10 test invoice outputs - 5 for individuals and 5 for lodge registrations. Each file contains the complete invoice generation output including payment data, registration data, and both customer and supplier invoices.

## Individual Registration Test Cases

### 1. `individual-01-single-attendee.json`
- **Scenario**: Simple case with one attendee and one ticket
- **Key Features**: 
  - Single attendee (Michael Johnson)
  - One Gala Dinner ticket ($150)
  - Complete booking contact information
  - Stripe payment

### 2. `individual-02-multiple-attendees.json`
- **Scenario**: Multiple attendees with different ticket types
- **Key Features**:
  - 3 attendees (including titles like "W Bro")
  - Mixed tickets (Installation Ceremony + Festive Board)
  - Primary attendee designation
  - Business details in booking contact
  - Total: $320 (4 tickets)

### 3. `individual-03-no-booking-contact.json`
- **Scenario**: Missing booking contact - tests fallback logic
- **Key Features**:
  - No bookingContact object
  - Should fall back to attendee email/details
  - Multiple ticket quantities (5 raffle tickets)
  - Square payment
  - Tests default value handling

### 4. `individual-04-registration-tickets.json`
- **Scenario**: Registration-owned tickets (no attendeeId)
- **Key Features**:
  - "Table of 10" ticket owned by registration
  - Should assign to primary attendee
  - Mixed ownership (registration + attendee tickets)
  - Name parsing from single "name" field
  - Total: $795

### 5. `individual-05-minimal-data.json`
- **Scenario**: Minimal data with many missing fields
- **Key Features**:
  - No confirmation number
  - Missing attendee IDs
  - Guest with only name field
  - Free member ticket + paid guest ticket
  - Tests all fallback scenarios

## Lodge Registration Test Cases

### 6. `lodge-01-standard.json`
- **Scenario**: Standard lodge registration with metadata
- **Key Features**:
  - Complete metadata.billingDetails
  - 5 lodge members
  - Single lodge registration fee ($500)
  - Tests addressLine1 skip when it matches business name

### 7. `lodge-02-multiple-tickets.json`
- **Scenario**: Lodge with multiple ticket types
- **Key Features**:
  - 8 members
  - Mixed ticket types (Early Bird, Standard, Lunch)
  - Uses organisation object instead of lodgeName
  - Square payment
  - Total: $1060

### 8. `lodge-03-minimal.json`
- **Scenario**: Minimal lodge data
- **Key Features**:
  - No attendees listed
  - Single subscription payment ($1200)
  - Minimal billing information
  - Tests lodge defaults

### 9. `lodge-04-large-delegation.json`
- **Scenario**: Large lodge delegation (15 members)
- **Key Features**:
  - 15 attendees with individual tickets
  - Member types (master, members)
  - Lodge details in registrationData.lodge
  - All members have same ticket type
  - Total: $1800 (15 × $120)

### 10. `lodge-05-complex-metadata.json`
- **Scenario**: Complex lodge with full metadata
- **Key Features**:
  - Centenary celebration
  - Multiple metadata fields (membershipType, notes)
  - High-value tickets ($250 gala + $100 commemorative)
  - Distinguished attendees (Grand Master, etc.)
  - Total: $1400

## Output Structure

Each JSON file contains:
```json
{
  "testCase": "test-name",
  "payment": { /* payment data used */ },
  "registration": { /* registration data used */ },
  "customerInvoice": { /* generated customer invoice */ },
  "supplierInvoice": { /* generated supplier invoice */ },
  "summary": {
    "registrationType": "individuals|lodge",
    "paymentSource": "stripe|square",
    "customerTotal": 123.45,
    "supplierTotal": 12.34,
    "processingFees": 3.45,
    "softwareUtilizationFee": 4.56
  }
}
```

## Key Testing Points

1. **Billing Details Priority**:
   - Individuals: bookingContact → attendee → registration defaults
   - Lodge: metadata.billingDetails → bookingContact → registration

2. **Ticket Assignment**:
   - Direct attendeeId matching
   - Registration-owned to primary attendee
   - Even distribution of unassigned tickets

3. **Payment Sources**:
   - Stripe: 3.3% software fee, Darren's ABN
   - Square: 2.8% software fee, Winding Stair ABN

4. **Data Handling**:
   - Missing fields use appropriate defaults
   - Name parsing from various formats
   - Address field consolidation