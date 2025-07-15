# Ticket Transformation Rules

## CRITICAL: Data Integrity Principles

### 1. **NO DATA LOSS - EVER**
- Every field value from the source must be preserved or explicitly mapped
- Never compute or infer values when direct mappings exist
- Always use 1:1 mapping for critical identifiers

### 2. **Direct Field Mappings (NO COMPUTATIONS)**

#### For Individual Registrations:
```
selectedTickets.attendeeId → tickets.ownerId (DIRECT 1:1 MAPPING)
selectedTickets.event_ticket_id → tickets.eventTicketId
selectedTickets.price → tickets.price (use eventTickets lookup only if missing)
selectedTickets.quantity → tickets.quantity (default to 1 if missing)
```

#### For Lodge Registrations:
```
lodgeDetails.lodgeId → tickets.ownerId
OR registration.organisationId → tickets.ownerId
OR registration.registrationId → tickets.ownerId (last resort)
```

### 3. **Field Transformations**

#### Structure Changes:
- `selectedTickets` array → `tickets` array
- Remove composite `id` field (e.g., "attendeeId-eventTicketId")
- Add `ownerType`: 'attendee' for individuals, 'lodge' for lodges

#### Field Renames (preserving values):
- `event_ticket_id` → `eventTicketId`
- `attendeeId` → `ownerId` (for individuals ONLY)

#### Field Additions (from lookups):
- `name`: From eventTickets collection
- `price`: From eventTickets ONLY if not present in selectedTickets

### 4. **Audit Logging Requirements**

Every transformation must record:
1. Original field name and value
2. New field name and value
3. Action type: 'rename', 'add', 'delete', 'update'
4. Source of data (if from lookup)
5. Whether data was preserved or changed

Example audit log entry:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "transform_tickets",
  "fieldChanges": [
    {
      "field": "attendeeId",
      "action": "rename",
      "from": "attendeeId",
      "to": "ownerId",
      "oldValue": "attendee-123",
      "newValue": "attendee-123",
      "preserved": true
    }
  ]
}
```

### 5. **Common Data Loss Scenarios to AVOID**

#### ❌ WRONG: Using primary attendee for all tickets
```javascript
// NEVER DO THIS
tickets.forEach(ticket => {
  ticket.ownerId = registration.primaryAttendeeId; // DATA LOSS!
});
```

#### ✅ CORRECT: Preserving each ticket's attendeeId
```javascript
selectedTickets.forEach(selectedTicket => {
  ticket.ownerId = selectedTicket.attendeeId; // Preserved!
});
```

#### ❌ WRONG: Computing or inferring IDs
```javascript
// NEVER DO THIS
ticket.ownerId = attendees[0].attendeeId; // DATA LOSS!
```

#### ✅ CORRECT: Direct mapping
```javascript
ticket.ownerId = selectedTicket.attendeeId; // Direct mapping!
```

### 6. **Validation Rules**

After any transformation:
1. Count of tickets must match
2. Each unique attendeeId must be preserved as ownerId
3. Event ticket IDs must match exactly
4. No tickets should have registrationId as ownerId (for individuals)

### 7. **Emergency Recovery**

If data loss is detected:
1. Always fetch original data from Supabase
2. Use selectedTickets as source of truth for attendeeId
3. Never trust computed values over original data
4. Document all corrections in audit log

## Implementation Checklist

Before deploying any import/transformation script:
- [ ] Verify 1:1 mapping for all critical IDs
- [ ] Ensure NO computations for ID fields
- [ ] Add detailed audit logging
- [ ] Test with sample data showing multiple attendees
- [ ] Validate no data loss occurs
- [ ] Document all transformations