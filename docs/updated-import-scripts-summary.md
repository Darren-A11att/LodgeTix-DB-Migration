# Updated Import Scripts Summary

## Overview

All registration import and transformation scripts have been updated to preserve the `attendeeId` from `selectedTickets` when creating the `tickets` array. This prevents data loss during the import process.

## Updated Scripts

### 1. **sync-supabase-registrations-v2.js** (NEW)
- **Location**: `/scripts/sync-supabase-registrations-v2.js`
- **Purpose**: Sync registrations from Supabase to MongoDB with preserved attendeeId
- **Key Changes**: 
  - Created new version that includes `transformTickets` function
  - Preserves attendeeId from selectedTickets for individual registrations
  - Sets proper ownerType/ownerId structure

### 2. **convert-selectedtickets-to-tickets.js**
- **Location**: `/scripts/convert-selectedtickets-to-tickets.js`
- **Purpose**: Convert existing selectedTickets arrays to tickets format
- **Key Changes**:
  - Added logic to preserve attendeeId from selectedTickets
  - Sets ownerType = 'attendee' and ownerId = attendeeId for individuals
  - Sets ownerType = 'lodge' and appropriate ownerId for lodge registrations

### 3. **update-ticket-structure-owner.js**
- **Location**: `/scripts/update-ticket-structure-owner.js`
- **Purpose**: Update ticket structure to use ownerType/ownerId
- **Key Changes**:
  - Now fetches original selectedTickets from Supabase
  - Creates attendeeId mapping and preserves original ownership
  - Adds tracking fields for audit trail

### 4. **sync-latest-data-with-owner-structure.js**
- **Location**: `/scripts/sync-latest-data-with-owner-structure.js`
- **Purpose**: Sync latest registrations with proper ticket structure
- **Key Changes**:
  - Builds ticketToAttendeeMap from selectedTickets
  - Uses mapped attendeeId when transforming tickets
  - Preserves attendeeId during sync operations

## Key Implementation Details

### Ticket Transformation Logic

For **Individual Registrations**:
```javascript
ticket.ownerType = 'attendee';
ticket.ownerId = selectedTicket.attendeeId; // Preserved from selectedTickets
```

For **Lodge Registrations**:
```javascript
ticket.ownerType = 'lodge';
ticket.ownerId = regData?.lodgeDetails?.lodgeId || 
                regData?.lodgeId || 
                regData?.organisationId ||
                registrationId;
```

### Field Name Variations Handled

All scripts now handle multiple field name variations:
- `event_ticket_id`
- `eventTicketId`
- `ticketDefinitionId`
- `eventTicketsId`

### Position-Based Mapping

For tickets with quantity > 1, position-based mapping ensures correct attendeeId assignment:
```javascript
selectedTickets.forEach((ticket) => {
  const quantity = ticket.quantity || 1;
  for (let i = 0; i < quantity; i++) {
    ticketToAttendeeMap.set(ticketIndex, ticket.attendeeId);
    ticketIndex++;
  }
});
```

## Usage Instructions

### For New Imports
Use the new sync script:
```bash
node scripts/sync-supabase-registrations-v2.js
```

### For Converting Existing Data
```bash
node scripts/convert-selectedtickets-to-tickets.js
```

### For Updating Ticket Structure
```bash
node scripts/update-ticket-structure-owner.js
```

### For Syncing Latest Data
```bash
node scripts/sync-latest-data-with-owner-structure.js
```

## Verification

After running any import or transformation script, verify the results:
```bash
npm run verify-ticket-fix
```

## Important Notes

1. **Always preserve attendeeId**: The core principle is that attendeeId from selectedTickets must be preserved as ownerId
2. **Audit Trail**: Updated scripts add tracking fields like `lastTicketTransform` and `ticketTransformReason`
3. **Backward Compatibility**: Scripts handle both old and new data formats
4. **Error Handling**: Scripts continue processing even if some registrations fail, logging errors for review