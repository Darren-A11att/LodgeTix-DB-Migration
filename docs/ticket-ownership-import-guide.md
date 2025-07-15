# Ticket Ownership Import Guide

## Problem Statement

When importing registrations from Supabase to MongoDB, the ticket ownership information (attendeeId) was being lost. In the original selectedTickets array, each ticket has an attendeeId that indicates which attendee owns that ticket. This was being replaced with the registrationId or primaryAttendeeId during transformation.

## Solution

We've created updated import and transformation scripts that preserve the attendeeId from selectedTickets when creating the tickets array with ownerType/ownerId structure.

## Key Changes

### 1. Import Script (`import-registrations-with-correct-ownership.ts`)

This script imports registrations from Supabase and immediately transforms selectedTickets to tickets with correct ownership:

- For **individual registrations**: Each ticket's `ownerId` is set to the `attendeeId` from selectedTickets
- For **lodge registrations**: Tickets are owned by the lodge/organisation

### 2. Update Script (`update-ticket-structure-preserve-attendee.ts`)

This script updates existing registrations in MongoDB by fetching the original selectedTickets from Supabase:

- Fetches the original registration data from Supabase
- Maps tickets by position to their correct attendeeId
- Updates the tickets array with correct ownership

## Usage

### For New Imports

When importing registrations from Supabase, use the new import script:

```bash
npm run import-with-ownership
```

This will:
1. Fetch registrations from Supabase
2. Transform selectedTickets to tickets with correct ownership
3. Store in MongoDB with proper ownerId values

### For Existing Data

To fix existing registrations that have incorrect ownership:

```bash
npm run fix-ticket-owners
```

This script:
1. Finds all individual registrations where tickets have registrationId as ownerId
2. Fetches original selectedTickets from Supabase
3. Updates tickets with correct attendeeId as ownerId

### To Update Ticket Structure

If you need to update the ticket structure from attendeeId to ownerType/ownerId:

```bash
npm run update-ticket-structure
```

## Data Structure

### Original (selectedTickets)
```json
{
  "selectedTickets": [
    {
      "id": "attendee-123-ticket-456",
      "attendeeId": "attendee-123",
      "event_ticket_id": "ticket-456",
      "price": 100,
      "quantity": 1
    }
  ]
}
```

### Transformed (tickets)
```json
{
  "tickets": [
    {
      "eventTicketId": "ticket-456",
      "name": "Event Ticket",
      "price": 100,
      "quantity": 1,
      "ownerType": "attendee",
      "ownerId": "attendee-123"  // Preserved from selectedTickets.attendeeId
    }
  ]
}
```

## Important Notes

1. **Always preserve attendeeId**: When transforming selectedTickets to tickets, the attendeeId must be preserved as ownerId
2. **Position-based mapping**: If selectedTickets have quantity > 1, tickets are mapped by position
3. **Lodge vs Individual**: Lodge registrations use organisationId/lodgeId as ownerId, individuals use attendeeId
4. **Verification**: Always run `npm run verify-ticket-fix` after imports to ensure ownership is correct

## Verification

To verify ticket ownership is correct:

```bash
# Check a specific registration
npm run test-fix-single <registrationId>

# Check random registrations
npm run test-random 10

# Verify all registrations
npm run verify-ticket-fix
```

## Migration Strategy

1. **Fix existing data**: Run `npm run fix-ticket-owners` to correct existing registrations
2. **Update import processes**: Use the new import scripts for future imports
3. **Update transformation logic**: Ensure any ticket transformation preserves attendeeId
4. **Monitor**: Regularly verify ticket ownership is maintained correctly