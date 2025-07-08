# MongoDB Sequential ID/Number Options

## 1. Counter Collection Method (Recommended) ✅
**Implementation**: See `/utils/invoice-sequence.ts`

This is the most reliable method for generating sequential numbers in MongoDB:
- Uses a separate `counters` collection
- Atomic operations with `findOneAndUpdate`
- Thread-safe and handles concurrent requests
- Can have multiple counters for different purposes

**Pros:**
- Guaranteed uniqueness
- No gaps in sequence
- Works across distributed systems
- Easy to reset or adjust

**Cons:**
- Requires an extra collection
- Additional database operation per invoice

## 2. MongoDB ObjectId Timestamp Method
```typescript
// Extract timestamp from ObjectId
const objectId = new ObjectId();
const timestamp = objectId.getTimestamp();
const sequentialPart = parseInt(objectId.toHexString().substring(18), 16);
```

**Pros:**
- No extra collection needed
- Built into every document

**Cons:**
- Not truly sequential
- Can have gaps
- Harder to format nicely

## 3. Auto-Increment Using Aggregation Pipeline
```typescript
// Find max invoice number and increment
const lastInvoice = await invoicesCollection
  .find({})
  .sort({ invoiceNumber: -1 })
  .limit(1)
  .toArray();

const nextNumber = lastInvoice.length > 0 
  ? parseInt(lastInvoice[0].invoiceNumber.split('-').pop()) + 1 
  : 1000;
```

**Pros:**
- Simple implementation
- No extra collection

**Cons:**
- NOT thread-safe
- Can create duplicates under load
- Performance issues with large collections

## 4. UUID/GUID with Timestamp
```typescript
import { v4 as uuidv4 } from 'uuid';

const invoiceNumber = `LT-${Date.now()}-${uuidv4().substring(0, 8)}`;
// Example: LT-1703123456789-a1b2c3d4
```

**Pros:**
- Guaranteed unique
- Works in distributed systems
- No coordination needed

**Cons:**
- Not sequential
- Long and less human-friendly

## 5. Optimistic Loop Pattern
```typescript
async function generateUniqueInvoiceNumber(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const invoiceNumber = generateRandomInvoiceNumber();
    
    try {
      // Try to insert with unique constraint
      await invoicesCollection.insertOne({
        invoiceNumber,
        // ... other fields
      });
      return invoiceNumber;
    } catch (error: any) {
      if (error.code === 11000) {
        // Duplicate key, try again
        attempts++;
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('Failed to generate unique invoice number');
}
```

**Pros:**
- Works with any ID format
- No extra collection

**Cons:**
- Can fail under high load
- Not truly sequential

## Recommendation for LodgeTix

Use the **Counter Collection Method** (already implemented) because:

1. **Reliability**: Guaranteed sequential numbers with no gaps
2. **Format Control**: Easy to format as `LT-YYYY-NNNNNN`
3. **Audit Trail**: Sequential numbers are important for financial records
4. **Performance**: Single atomic operation
5. **Flexibility**: Can have different sequences for different document types

### Usage Example:
```typescript
const invoiceSequence = new InvoiceSequence(db);
const invoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber();
// Returns: "LT-2024-001234"
```

### Additional Sequences You Might Need:
- Receipt numbers: `RCP-2024-000001`
- Credit note numbers: `CN-2024-000001`
- Payment references: `PAY-2024-000001`

Each can have its own counter in the counters collection.