# Confirmation Number Implementation Guide

**Last Updated**: January 2025  
**Version**: 1.0

## Quick Start

### Generate a Confirmation Number

```typescript
import { generateConfirmationNumber } from '@/services/reversed-timestamp-confirmation';

// For individual registration
const confirmationNumber = generateConfirmationNumber('individuals');
// Result: "IND-432725637K"

// For lodge registration
const confirmationNumber = generateConfirmationNumber('lodge');
// Result: "LDG-432725637M"
```

### Generate When Payment Matched

```typescript
import { generateForPaymentMatch } from '@/services/reversed-timestamp-confirmation';

// In your payment matching logic
const confirmationNumber = await generateForPaymentMatch(
  db,
  registration.registrationId,
  registration.registrationType
);
```

## Integration Examples

### 1. Payment Matching Workflow

```typescript
// In payment-registration-matcher.ts
import { generateForPaymentMatch } from '@/services/reversed-timestamp-confirmation';

async function onPaymentMatched(payment: Payment, registration: Registration) {
  // ... existing matching logic ...
  
  // Generate confirmation number if needed
  if (!registration.confirmationNumber && payment.status === 'completed') {
    const confirmationNumber = await generateForPaymentMatch(
      this.db,
      registration.registrationId,
      registration.registrationType
    );
    
    // Send confirmation email
    if (confirmationNumber) {
      await sendConfirmationEmail(registration.email, confirmationNumber);
    }
  }
}
```

### 2. Registration Status Update

```typescript
// When updating registration status
async function updateRegistrationStatus(registrationId: string, newStatus: string) {
  const registration = await db.collection('registrations').findOne({ registrationId });
  
  // Generate confirmation number when payment completes
  if (newStatus === 'completed' && !registration.confirmationNumber) {
    await generateForPaymentMatch(db, registrationId, registration.registrationType);
  }
  
  // Update status
  await db.collection('registrations').updateOne(
    { registrationId },
    { $set: { status: newStatus, updatedAt: new Date() } }
  );
}
```

### 3. Batch Processing

```typescript
import { batchGenerateForPaymentMatches } from '@/services/reversed-timestamp-confirmation';

// Process multiple registrations
const registrationIds = ['reg1', 'reg2', 'reg3'];
const confirmationNumbers = await batchGenerateForPaymentMatches(db, registrationIds);

// confirmationNumbers is a Map
confirmationNumbers.forEach((number, regId) => {
  console.log(`${regId}: ${number}`);
});
```

## Error Handling

### Unique Constraint Violations

While extremely unlikely with reversed timestamps, handle MongoDB duplicate key errors:

```typescript
try {
  const result = await db.collection('registrations').updateOne(
    { registrationId },
    { $set: { confirmationNumber } }
  );
} catch (error) {
  if (error.code === 11000 && error.message.includes('confirmationNumber')) {
    // This should never happen with timestamp-based generation
    console.error('Duplicate confirmation number detected:', confirmationNumber);
    // Generate new one with additional entropy or investigate system clock issue
  }
}
```

### Missing Registration Type

```typescript
// The service handles missing types gracefully
const confirmationNumber = generateConfirmationNumber(undefined);
// Result: "REG-432725637K" (uses REG prefix as fallback)
```

## Testing

### Unit Tests

```typescript
describe('Confirmation Number Generation', () => {
  it('should generate unique numbers for consecutive calls', async () => {
    const numbers = new Set();
    
    for (let i = 0; i < 100; i++) {
      const number = generateConfirmationNumber('individuals');
      numbers.add(number);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    expect(numbers.size).toBe(100); // All unique
  });
  
  it('should use correct prefix for registration type', () => {
    expect(generateConfirmationNumber('individuals')).toMatch(/^IND-/);
    expect(generateConfirmationNumber('lodge')).toMatch(/^LDG-/);
    expect(generateConfirmationNumber('delegation')).toMatch(/^DEL-/);
  });
  
  it('should validate confirmation number format', () => {
    const valid = 'IND-432725637K';
    const invalid = 'IND-12345'; // Too short
    
    expect(isValidConfirmationNumber(valid)).toBe(true);
    expect(isValidConfirmationNumber(invalid)).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe('Payment Matching Integration', () => {
  it('should generate confirmation number on payment match', async () => {
    // Create registration without confirmation number
    const registration = await createTestRegistration({
      confirmationNumber: null,
      paymentStatus: 'pending'
    });
    
    // Match payment
    await generateForPaymentMatch(db, registration.registrationId);
    
    // Verify confirmation number was generated
    const updated = await db.collection('registrations').findOne({
      registrationId: registration.registrationId
    });
    
    expect(updated.confirmationNumber).toMatch(/^IND-\d{8,9}[A-Z]$/);
    expect(updated.confirmationGeneratedMethod).toBe('reversed-timestamp');
  });
});
```

## Monitoring

### Logs to Track

```typescript
// Successful generation
console.log(`Generated confirmation number ${confirmationNumber} for registration ${registrationId}`);

// Already exists
console.log(`Registration ${registrationId} already has confirmation number: ${confirmationNumber}`);

// Generation method
console.log(`Method: reversed-timestamp`);
```

### Metrics to Monitor

1. **Generation Rate**: Track confirmations generated per hour
2. **Missing Confirmations**: Alert if paid registrations lack confirmation numbers
3. **Format Compliance**: Ensure all new confirmations match expected pattern

## Troubleshooting

### Common Issues

#### 1. Registration Already Has Confirmation Number
- **Symptom**: No new number generated
- **Cause**: Existing confirmation number
- **Solution**: This is expected behavior - we don't overwrite existing numbers

#### 2. No Confirmation Number After Payment
- **Symptom**: Paid registration without confirmation
- **Cause**: Payment matching logic not calling generation
- **Solution**: Check payment matching workflow integration

#### 3. Unexpected Prefix
- **Symptom**: REG prefix instead of IND/LDG
- **Cause**: Registration type not properly set
- **Solution**: Ensure registration type is set before generation

### Debug Queries

```javascript
// Find registrations without confirmation numbers
db.registrations.find({
  confirmationNumber: { $in: [null, '', undefined] },
  paymentStatus: 'completed'
});

// Check for any duplicates (should be empty)
db.registrations.aggregate([
  { $group: { _id: '$confirmationNumber', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
]);

// Verify index exists
db.registrations.getIndexes();
// Should show: idx_unique_confirmationNumber
```

## Best Practices

### DO ✅
- Generate confirmation numbers when payment is confirmed
- Use the service functions rather than implementing your own
- Trust the uniqueness - no need to check database
- Include confirmation numbers in customer communications

### DON'T ❌
- Don't generate confirmation numbers for unpaid registrations
- Don't try to parse or decode confirmation numbers
- Don't use confirmation numbers for security/authentication
- Don't modify confirmation numbers after generation

## Migration from Old System

If you have registrations using the old format:

```javascript
// Old format examples:
// IND-705286AR (6 digits + 2 letters)
// LDG-123456 (missing letters)

// These will continue to work
// New generations will use the new format:
// IND-432725637K (8-9 digits + 1 letter)
```

The unique constraint accepts both formats, ensuring backward compatibility.