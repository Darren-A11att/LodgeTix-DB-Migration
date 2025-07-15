# Ticket Quantity Expansion Fix

## Problem Description

Individual registrations were incorrectly storing tickets with quantity > 1. For individual registrations, each attendee should have their own ticket with quantity = 1.

### Example of the Problem:
```json
// INCORRECT - 1 ticket with quantity 4
"tickets": [{
  "eventTicketId": "7196514b-d4b8-4fe0-93ac-deb4c205dd09",
  "name": "Grand Proclamation Ceremony",
  "price": 20,
  "quantity": 4,
  "ownerType": "attendee",
  "ownerId": "01974c6c-9dec-77c9-bb11-1cf3feb4cded"
}]

// CORRECT - 4 tickets each with quantity 1
"tickets": [
  {
    "eventTicketId": "7196514b-d4b8-4fe0-93ac-deb4c205dd09",
    "name": "Grand Proclamation Ceremony",
    "price": 20,
    "quantity": 1,
    "ownerType": "attendee",
    "ownerId": "attendee-id-1"
  },
  {
    "eventTicketId": "7196514b-d4b8-4fe0-93ac-deb4c205dd09",
    "name": "Grand Proclamation Ceremony",
    "price": 20,
    "quantity": 1,
    "ownerType": "attendee",
    "ownerId": "attendee-id-2"
  },
  // ... 2 more tickets
]
```

## Solution

We created scripts to:
1. Identify affected registrations
2. Fetch the original selectedTickets from Supabase
3. Expand tickets with quantity > 1 into individual tickets
4. Assign each ticket to the appropriate attendee

## Scripts Created

### 1. `analyze-ticket-quantity-issue.ts`
Analyzes the scope of the problem and identifies affected registrations.

```bash
npm run analyze-quantity-issue
```

### 2. `test-ticket-quantity-fix.ts`
Tests the fix on a single registration without making changes.

```bash
# Test on specific registration
npm run test-quantity-fix -- b49542ec-cbf2-43fe-95bb-b93edcd466f2

# Test on default example
npm run test-quantity-fix
```

### 3. `fix-ticket-quantity-expansion.ts`
Fixes the ticket quantity issue by expanding tickets.

```bash
npm run fix-ticket-quantities
```

### 4. `fix-ticket-quantity-expansion-v2.ts`
Enhanced version that handles edge cases better:
- Position-based attendee assignment
- Handles more tickets than attendees
- Better error handling

```bash
npm run fix-ticket-quantities-v2
```

## How the Fix Works

### Step 1: Identify Problematic Registrations
Find all individual registrations where any ticket has quantity > 1.

### Step 2: Fetch Original Data
Retrieve the original selectedTickets and attendees from Supabase.

### Step 3: Expand Tickets
For each selectedTicket with quantity > 1:
- Create that many individual ticket entries
- Each with quantity = 1
- Assign to appropriate attendee

### Step 4: Attendee Assignment Logic

#### If attendeeId is in selectedTicket:
```javascript
ticket.ownerId = selectedTicket.attendeeId
```

#### If no attendeeId (position-based mapping):
```javascript
// Distribute tickets round-robin to attendees
attendeeIndex = ticketIndex % attendees.length
ticket.ownerId = attendees[attendeeIndex].attendeeId
```

### Step 5: Update Registration
Replace the tickets array with the expanded version.

## Edge Cases Handled

### 1. More Tickets Than Attendees
If a registration has 4 tickets but only 2 attendees:
- Tickets are distributed round-robin
- Each attendee gets 2 tickets
- Marked as "partial fix"

### 2. Missing AttendeeId
Multiple fallback strategies:
1. Use attendeeId from selectedTicket
2. Use position-based mapping
3. Use primaryAttendeeId
4. Generate a unique ID

### 3. Field Name Variations
Handles multiple field name formats:
- `event_ticket_id` / `eventTicketId` / `ticketDefinitionId`
- `selectedTickets` / `tickets`
- `attendeeId` / `id`

## Verification

After running the fix:
```bash
# Check remaining issues
npm run analyze-quantity-issue

# Verify specific registration
npm run test-quantity-fix -- <registrationId>
```

## Important Notes

1. **Individual Registrations Only**: This fix only applies to individual registrations. Lodge registrations can have tickets with quantity > 1.

2. **Attendee Mapping**: The fix attempts to map tickets to specific attendees, but may need to share attendee IDs if there are more tickets than attendees.

3. **Audit Trail**: Fixed registrations include:
   - `lastTicketQuantityFix`: Timestamp of fix
   - `ticketQuantityFixReason`: Description of what was done
   - `ticketQuantityFixMetadata`: Additional details

4. **Data Preservation**: Original data is fetched from Supabase to ensure correct attendee assignments.

## Running the Complete Fix

1. First, analyze the issue:
   ```bash
   npm run analyze-quantity-issue
   ```

2. Test on a sample registration:
   ```bash
   npm run test-quantity-fix -- <registrationId>
   ```

3. Run the fix (choose one):
   ```bash
   # Basic version
   npm run fix-ticket-quantities
   
   # Enhanced version (recommended)
   npm run fix-ticket-quantities-v2
   ```

4. Verify the results:
   ```bash
   npm run analyze-quantity-issue
   ```