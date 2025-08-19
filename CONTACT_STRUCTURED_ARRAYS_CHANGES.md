# Contact Structured Arrays Implementation

## Summary
Replaced duplicate references in contacts with structured registrations[] and orders[] arrays containing detailed registration data instead of just ObjectId references.

## Changes Made

### 1. Enhanced Payment Sync Service (`src/services/sync/enhanced-payment-sync.ts`)

#### New Interfaces Added
```typescript
interface RegistrationRef {
  functionId: string;
  functionName: string;
  registrationId: string;
  confirmationNumber: string;
  attendeeId?: string;
}

interface OrderRef {
  functionId: string;
  functionName: string;
  registrationId: string;
  confirmationNumber: string;
  attendeeId?: string;
}
```

#### Updated Contact Interface
- Added `registrations: RegistrationRef[]` - structured array for attendee registrations
- Added `orders: OrderRef[]` - structured array for customer/booking contact orders
- Kept legacy fields for backward compatibility:
  - `customerRef?: ObjectId`
  - `attendeeRefs: ObjectId[]`
  - `registrationRefs: ObjectId[]`

#### New Helper Functions
```typescript
createRegistrationRefData(registrationData, attendeeRef, db): Promise<RegistrationRef | null>
createOrderRefData(registrationData, source, db): Promise<OrderRef | null>
```

#### Updated Functions
- `processContact()` - Now accepts `registrationData` parameter and creates structured arrays
- `updateExistingContact()` - Handles merging structured arrays with deduplication
- Modified contact creation logic to populate both structured and legacy arrays

#### Enhanced Logging
- Logs creation of registration and order references
- Shows structured array contents when contacts are created/updated
- Tracks array sizes and deduplication

### 2. Contacts Repository (`src/repositories/contacts.repository.ts`)

#### Updated Contact Interface
- Added RegistrationRef and OrderRef interfaces
- Updated Contact interface to include:
  - `registrations?: RegistrationRef[]`
  - `orders?: OrderRef[]`
- Maintained flexible typing with `[key: string]: any`

## Key Features

### Structured Data Storage
- **registrations[]**: Contains detailed registration info for attendees
- **orders[]**: Contains detailed order info for customers/booking contacts
- Each entry includes: functionId, functionName, registrationId, confirmationNumber, attendeeId

### Deduplication Logic
- Prevents duplicate entries based on registrationId
- Works for both new contacts and existing contact updates
- Maintains data integrity across sync runs

### Data Extraction
- Extracts registration data during contact processing
- Resolves function names via ReferenceDataService
- Handles attendeeId resolution from ObjectId references
- Robust null checking and string conversion

### Backward Compatibility
- Legacy ObjectId reference arrays are still populated
- Existing code continues to work unchanged
- Gradual migration path available

## Usage Examples

### Registration Reference (for attendees)
```json
{
  "functionId": "func-123",
  "functionName": "Annual Lodge Meeting 2024",
  "registrationId": "reg-456",
  "confirmationNumber": "CONF-789",
  "attendeeId": "att-101"
}
```

### Order Reference (for customers)
```json
{
  "functionId": "func-123", 
  "functionName": "Annual Lodge Meeting 2024",
  "registrationId": "reg-456",
  "confirmationNumber": "CONF-789",
  "attendeeId": undefined
}
```

## Benefits

1. **Rich Data Access**: Direct access to registration details without additional lookups
2. **Reduced Joins**: No need to resolve ObjectId references for basic information
3. **Better Reporting**: Function names and confirmation numbers readily available
4. **Cleaner Queries**: Filter by function, confirmation number, etc. directly
5. **Audit Trail**: Clear relationship between contacts and their registrations/orders

## Migration Path

The implementation maintains backward compatibility:
- Legacy ObjectId arrays continue to be populated
- Existing queries work unchanged  
- New queries can use structured arrays for richer data
- Gradual migration to structured arrays possible

## Error Handling

- Graceful fallback if registration data unavailable
- Comprehensive logging for debugging
- Null safety with String() conversions
- Try-catch blocks around array creation