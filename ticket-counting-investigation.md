# Ticket Counting System Investigation

## Executive Summary

The LodgeTix system has multiple overlapping and conflicting systems for tracking ticket counts, leading to incorrect reporting after ticket cancellations. This investigation documents all the issues discovered and provides recommendations for resolution.

## Current State Analysis

### 1. Multiple Data Sources

#### 1.1 Collections
- **`eventTickets`**: The base collection storing event ticket definitions
- **`registrations`**: Contains actual ticket purchases with status (sold/cancelled)

#### 1.2 Views/Computed Collections
- **`eventTickets_computed`**: A view that adds calculated fields to eventTickets
- **`ticket_counts`**: Another view showing ticket counts

### 2. Conflicting Count Fields

#### 2.1 In `eventTickets_computed`:
```json
{
  // Main object fields
  "soldCount": 470,           // Stale value
  "availableCount": 10,       // Unclear how calculated
  "reservedCount": 0,
  
  // Nested calculated fields
  "calculatedFields": {
    "soldCount": 418,         // Different from main soldCount!
    "reservedCount": 0,
    "availableCount": 62,     // Different from main availableCount!
  },
  
  // Our script added these
  "cancelledCount": 8,        // Correct
  "previousSoldCount": 470    // Correct
}
```

#### 2.2 In `ticket_counts`:
```json
{
  "soldCount": 470,           // Same stale value
  "reservedCount": 0,
  "transferredCount": 0
}
```

#### 2.3 Actual Count from Registrations:
- Active (non-cancelled) tickets: **119**
- Cancelled tickets: **8**
- Total: **127**

### 3. Timestamp Chaos

Multiple timestamp fields showing different update times:
- `updatedAt`: 2025-06-23 (2 months old!)
- `calculatedFields.lastUpdated`: 2025-07-23
- `lastCalculatedAt`: 2025-07-23
- `lastComputedAt`: 2025-07-30 23:19
- `lastSoldCountUpdate`: 2025-07-30 23:33 (our script)

## Root Cause Analysis

### Issue 1: Views Not Updating
The views (`eventTickets_computed`, `ticket_counts`) are reading the `soldCount` field from the `eventTickets` collection, which is not automatically updated when tickets are cancelled.

### Issue 2: Multiple Truth Sources
There's no single source of truth for ticket counts:
- `eventTickets.soldCount`: Manual field, not auto-updated
- `calculatedFields.soldCount`: Different calculation method
- Actual registration counts: The real truth but not reflected in views

### Issue 3: No Trigger for Cancellations
When tickets are cancelled in registrations, there's no MongoDB trigger to:
1. Decrement the soldCount in eventTickets
2. Refresh the computed views

### Issue 4: Inconsistent View Definitions
The two views (`eventTickets_computed` and `ticket_counts`) appear to serve the same purpose but may have different aggregation pipelines.

## Impact Analysis

### 1. Reporting Accuracy
- Reports show 470 sold tickets for "Proclamation Banquet - Best Available"
- Reality: Only 119 active tickets (351 ticket discrepancy!)
- Financial impact: Overstating revenue and attendance

### 2. Capacity Management
- Available tickets calculation is wrong
- Could lead to overselling or underselling

### 3. Data Integrity
- Multiple fields showing different values for the same metric
- Timestamps don't reflect actual changes
- No audit trail for count changes

## Specific Example: Ross Mylonas Case

After cancelling 8 banquet tickets:
- Registration status: ✅ Correctly updated to "refunded"/"failed"
- Ticket status: ✅ Correctly updated to "cancelled"
- eventTickets.soldCount: ❌ Still shows 470 (should be 119)
- Views: ❌ Still showing stale data

## Recommendations

### Immediate Actions

1. **Create a Single Source of Truth**
   - Remove soldCount from eventTickets collection
   - Calculate counts dynamically from registrations

2. **Fix the Views**
   - Rewrite `eventTickets_computed` to aggregate from registrations
   - Either fix or remove `ticket_counts` (redundant)

3. **Add MongoDB Triggers**
   - Trigger on registration updates
   - Automatically recalculate counts when tickets change status

### Long-term Solutions

1. **Implement Event Sourcing**
   - Track all ticket state changes
   - Build counts from event history

2. **Add Proper Monitoring**
   - Alert when counts diverge
   - Regular reconciliation jobs

3. **Improve Documentation**
   - Document which fields/views to use
   - Clear ownership of count calculations

## Technical Deep Dive

### Current View Pipeline (Suspected)
The views appear to be using a simple projection from eventTickets rather than aggregating from registrations:

```javascript
// What it's probably doing (WRONG)
db.eventTickets.aggregate([
  { $project: {
    soldCount: 1,
    // ... other fields
  }}
])

// What it SHOULD do
db.registrations.aggregate([
  { $unwind: "$registrationData.tickets" },
  { $match: { 
    "registrationData.tickets.status": { $ne: "cancelled" }
  }},
  { $group: {
    _id: "$registrationData.tickets.eventTicketId",
    soldCount: { $sum: 1 }
  }}
])
```

### MongoDB Atlas Triggers
There appear to be Atlas triggers (based on fields like `lastTriggeredBy`) but they're either:
1. Not firing on ticket cancellations
2. Not updating the right fields
3. Configured incorrectly

## Next Steps

1. **Immediate Fix**: Create script to recalculate ALL event ticket counts from registrations
2. **Short-term**: Rewrite the views to calculate dynamically
3. **Medium-term**: Implement proper triggers
4. **Long-term**: Redesign the entire counting system

## Live Data Analysis Results

### Current State (After Ross Mylonas Updates)

#### Base eventTickets Collection
- **soldCount**: 119 ✅ (Correctly updated by our script)
- **cancelledCount**: 8 ✅ (Correct)
- **lastSoldCountUpdate**: 2025-07-31 09:33 ✅ (Recent)
- **updatedAt**: 2025-06-23 ❌ (Still showing old date)

#### eventTickets_computed View
- **soldCount**: 470 ❌ (Still showing old value!)
- **calculatedFields.soldCount**: 418 ❌ (Different wrong value!)
- **cancelledCount**: 8 ✅ (Somehow this is correct)
- **lastComputedAt**: 2025-07-31 09:19 (Before our update)

#### ticket_counts View
- **soldCount**: 470 ❌ (Still showing old value!)
- **No other count fields** (Very limited data)

#### Actual Registration Count
- **Active tickets**: 119 ✅
- **Cancelled tickets**: 8 ✅
- **Total**: 127

### Key Finding: Views Are NOT Dynamic!

The views are not recalculating counts from registrations. Instead:
- `eventTickets_computed` appears to be a simple projection of eventTickets fields
- `ticket_counts` claims to be a view on registrations but shows stale eventTickets data
- Neither view is actually aggregating live data from registrations

### View Definition Discovery

`ticket_counts` is listed as "View on: registrations" but it's showing:
- The old soldCount (470) from eventTickets
- NOT the actual count (119) from registrations

This suggests the view pipeline is incorrectly configured or there's a caching issue.

## Atlas Trigger Bug Discovery

### The Trigger Function Has Critical Flaws

The Atlas trigger function (`updateEventTicketCountsOnRegistrationChange`) has major bugs:

1. **Wrong Status Logic**: 
   ```javascript
   // Current logic (WRONG)
   counts.forEach(c => {
     if (c._id === "sold") soldCount = c.totalQuantity;
     else if (c._id === "reserved") reservedCount = c.totalQuantity;
     // Note: "cancelled" tickets are completely ignored!
   });
   ```

2. **Missing Default Status Handling**:
   - Tickets without a status field default to "sold" (line 43)
   - But the counting logic only counts explicit "sold" status
   - This misses tickets with null/undefined status

3. **No Cancelled Ticket Handling**:
   - Cancelled tickets are grouped but never subtracted
   - The trigger doesn't update a cancelledCount field
   - Sold count is never reduced when tickets are cancelled

### Why the Views Show Wrong Data

1. **Atlas Trigger Overwrites Manual Updates**:
   - Our script correctly set soldCount to 119
   - But the trigger fired and reset it to 470 (counting all non-cancelled as "sold")
   - The trigger ignores cancelled tickets entirely

2. **View Timing Issues**:
   - `eventTickets_computed` is a view on eventTickets
   - It shows whatever soldCount is in the base collection
   - Since the trigger keeps setting it wrong, the view shows wrong data

3. **ticket_counts View Mystery**:
   - Claims to be "View on: registrations"
   - But shows the same wrong soldCount as eventTickets
   - Likely using a JOIN or LOOKUP to eventTickets instead of calculating from registrations

## Appendix: Sample Data

### Registration with Cancelled Tickets
```json
{
  "confirmationNumber": "IND-616604CO",
  "paymentStatus": "refunded",
  "registrationData": {
    "tickets": [
      {
        "eventTicketId": "fd12d7f0-f346-49bf-b1eb-0682ad226216",
        "status": "cancelled",
        "cancelledAt": "2025-07-30T23:30:00Z"
      }
    ]
  }
}
```

### EventTickets Document (Stale)
```json
{
  "eventTicketId": "fd12d7f0-f346-49bf-b1eb-0682ad226216",
  "soldCount": 470,  // Never updated when tickets cancelled
  "updatedAt": "2025-06-23T08:21:11.992371Z"  // 2 months old!
}
```

## Proposed Solution: Fix the Atlas Trigger

### Corrected Trigger Logic

```javascript
// Fixed aggregation pipeline
const pipeline = [
  { $match: { "registrationData.tickets.eventTicketId": eventTicketId } },
  { $unwind: "$registrationData.tickets" },
  { $match: { "registrationData.tickets.eventTicketId": eventTicketId } },
  { $group: {
    _id: null,
    soldCount: {
      $sum: {
        $cond: [
          { $ne: ["$registrationData.tickets.status", "cancelled"] },
          { $ifNull: ["$registrationData.tickets.quantity", 1] },
          0
        ]
      }
    },
    cancelledCount: {
      $sum: {
        $cond: [
          { $eq: ["$registrationData.tickets.status", "cancelled"] },
          { $ifNull: ["$registrationData.tickets.quantity", 1] },
          0
        ]
      }
    },
    reservedCount: {
      $sum: {
        $cond: [
          { $eq: ["$registrationData.tickets.status", "reserved"] },
          { $ifNull: ["$registrationData.tickets.quantity", 1] },
          0
        ]
      }
    }
  }}
];
```

### Key Changes Needed

1. **Count all non-cancelled as sold** (including null status)
2. **Track cancelledCount** separately
3. **Update the eventTickets document** with all counts
4. **Fix the views** to show live data or remove them

## Conclusion

The ticket counting system has fundamental design flaws where:
1. Counts are stored rather than calculated
2. Multiple systems track the same data differently
3. No automatic synchronization when tickets change status
4. Views show stale data from stored fields rather than live calculations
5. **The Atlas trigger has bugs that prevent proper count updates**

This requires both immediate fixes for data accuracy and a longer-term architectural redesign. The most critical fix is updating the Atlas trigger function to properly handle cancelled tickets.