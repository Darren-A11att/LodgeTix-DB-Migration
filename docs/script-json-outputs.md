# Script JSON Output Documentation

All scripts now save their results to JSON files in the `script-outputs/` directory for better tracking and analysis.

## Output Directory
- **Location**: `./script-outputs/`
- **Format**: JSON files with timestamps
- **Git Ignored**: Yes (added to .gitignore)

## Scripts with JSON Output

### 1. analyze-ticket-quantity-issue.ts
**Output File**: `ticket-quantity-analysis-{timestamp}.json`

**Structure**:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "summary": {
    "totalAffectedRegistrations": 150,
    "totalTicketsWithHighQuantity": 200,
    "totalQuantityAcrossAllTickets": 450,
    "expectedTotalTicketsAfterFix": 450,
    "currentTotalTickets": 200
  },
  "patterns": {
    "byTicketCount": { "1": 50, "2": 75, "3": 25 },
    "byQuantityValue": { "2": 100, "3": 50, "4": 50 }
  },
  "sampleRegistrations": [...],
  "affectedRegistrationIds": [
    {
      "registrationId": "abc123",
      "confirmationNumber": "IND-123456",
      "ticketCount": 1,
      "ticketsWithHighQuantity": 1
    }
  ]
}
```

### 2. fix-ticket-quantity-expansion-v2.ts
**Output File**: `ticket-quantity-fix-results-{timestamp}.json`

**Structure**:
```json
{
  "timestamp": "2024-01-15T11:00:00.000Z",
  "summary": {
    "totalProcessed": 150,
    "successfullyFixed": 145,
    "completeFixes": 140,
    "partialFixes": 5,
    "unchanged": 0,
    "errors": 5,
    "totalTicketsExpanded": 250
  },
  "fixResults": [
    {
      "registrationId": "abc123",
      "confirmationNumber": "IND-123456",
      "status": "fixed",
      "isPartialFix": false,
      "before": {
        "ticketCount": 1,
        "ticketsWithHighQuantity": 1
      },
      "after": {
        "ticketCount": 4,
        "allQuantityOne": true
      },
      "attendeeCount": 4,
      "ticketDistribution": {
        "attendee-1": 1,
        "attendee-2": 1,
        "attendee-3": 1,
        "attendee-4": 1
      }
    }
  ],
  "errors": [
    {
      "registrationId": "def456",
      "confirmationNumber": "IND-789012",
      "error": "Supabase fetch error",
      "message": "Not found"
    }
  ],
  "verification": {
    "remainingWithQuantityGt1": 0,
    "registrationsWithPartialFixes": 5
  }
}
```

### 3. test-ticket-quantity-fix.ts
**Output File**: `ticket-quantity-test-{registrationId}-{timestamp}.json`

**Structure**:
```json
{
  "timestamp": "2024-01-15T10:45:00.000Z",
  "registrationId": "b49542ec-cbf2-43fe-95bb-b93edcd466f2",
  "confirmationNumber": "IND-123456",
  "registrationType": "individuals",
  "currentState": {
    "ticketCount": 1,
    "tickets": [
      {
        "eventTicketId": "7196514b-d4b8-4fe0-93ac-deb4c205dd09",
        "name": "Grand Proclamation Ceremony",
        "quantity": 4,
        "ownerType": "attendee",
        "ownerId": "01974c6c-9dec-77c9-bb11-1cf3feb4cded",
        "price": 20
      }
    ]
  },
  "supabaseData": {
    "selectedTicketsCount": 1,
    "selectedTickets": [...],
    "attendeeCount": 4,
    "attendees": [...]
  },
  "proposedFix": {
    "expandedTicketCount": 4,
    "expandedTickets": [...],
    "ticketDistribution": [...]
  },
  "validation": {
    "totalTicketsNeeded": 4,
    "totalAttendees": 4,
    "expandedTicketsCreated": 4,
    "match": true,
    "hasEnoughAttendees": true
  }
}
```

## Benefits of JSON Output

1. **Audit Trail**: Complete record of all script runs with timestamps
2. **Analysis**: Can analyze results across multiple runs
3. **Debugging**: Detailed error information preserved
4. **Reporting**: Easy to generate reports from structured data
5. **Integration**: JSON format allows easy integration with other tools

## Usage Examples

### Find all analysis results:
```bash
ls script-outputs/ticket-quantity-analysis-*.json
```

### View latest fix results:
```bash
ls -t script-outputs/ticket-quantity-fix-results-*.json | head -1 | xargs cat | jq .summary
```

### Check errors from a fix run:
```bash
cat script-outputs/ticket-quantity-fix-results-2024-01-15*.json | jq '.errors[]'
```

### Count total tickets expanded across all runs:
```bash
cat script-outputs/ticket-quantity-fix-results-*.json | jq '.summary.totalTicketsExpanded' | paste -sd+ | bc
```

## Notes

- Files are timestamped with ISO format (colons and dots replaced with hyphens)
- The `script-outputs/` directory is created automatically if it doesn't exist
- All JSON files are pretty-printed with 2-space indentation
- The directory is git-ignored to prevent committing large result files