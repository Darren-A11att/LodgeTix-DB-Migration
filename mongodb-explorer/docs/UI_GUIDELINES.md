# UI Guidelines for Field Selection

## Field Dropdown Display Pattern

When displaying field selection dropdowns anywhere in the application, **always show the current value** of each field alongside the field name/path. This helps users make informed selections by seeing the actual data they're working with.

### Standard Format

```
fieldName: currentValue
```

### Examples

1. **Simple fields:**
   - `firstName: John`
   - `amount: $150.00`
   - `status: active`

2. **Complex fields (truncated):**
   - `attendeeId: 01977da7-3537-72bf-90b0-7aac6b0d66d2`
   - `address: 123 Main Street, Sydney NSW 2000...`

3. **Object/Array fields:**
   - `attendees: [3 items]`
   - `paymentInfo: {object}`

### Implementation Pattern

```typescript
// In dropdown options
<option value={field.path}>
  {field.name}: {field.value?.toString().substring(0, 50)}
  {field.value?.toString().length > 50 ? '...' : ''}
</option>

// For selected/mapped fields
<div>
  Mapped to: {fieldPath} 
  <span className="text-gray-500">(Current: {currentValue})</span>
</div>
```

### Value Display Rules

1. **Truncation:** Limit display to 30-50 characters for readability
2. **Objects:** Show as `{object}` or stringify with truncation
3. **Arrays:** Show as `[n items]` where n is the array length
4. **Null/undefined:** Display as `null` or `undefined` explicitly
5. **Empty strings:** Display as `(empty)`

### Components Following This Pattern

- ArrayRelationshipBuilder (key fields, quantity, price)
- TemplateBuilder (field insertion dropdown)
- FieldMappingSelector (field selection and display)
- CalculatedFieldSelector (already implements this)
- ExternalFieldSelector (already implements this)

This pattern should be applied to ANY dropdown or display where users select or view field mappings.