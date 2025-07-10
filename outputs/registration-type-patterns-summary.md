# Registration Type Pattern Analysis

## Summary

When analyzing registration structures by type (ignoring payment platform differences), we found:

### **Individual Registrations: 8 Structural Patterns**
- **109 total registrations** (82% of all registrations)
- Most common pattern: 69 registrations (63% of individuals)
- Second pattern: 33 registrations (30% of individuals)
- Remaining 6 patterns: 7 registrations combined

### **Lodge Registrations: 3 Structural Patterns**
- **24 total registrations** (18% of all registrations)
- Most common pattern: 21 registrations (88% of lodges)
- Two additional patterns with invoice/matching fields: 3 registrations

## Key Structural Differences

### 1. **Registration Data Structure**

**Individual Registrations:**
- **Has attendees array** with detailed attendee information
- Average 1-2 attendees per registration
- Attendee fields include: name, lodge affiliation, dietary requirements, special needs, etc.
- 16 top-level fields in registrationData

**Lodge Registrations:**
- **No attendees array** - represents bulk bookings
- Has `lodgeDetails` object with lodgeId and lodgeName
- Has `tableCount` field for table bookings
- Only 7 top-level fields in registrationData

### 2. **Unique Fields**

**Fields only in Individual Registrations:**
- Price/ticket update tracking fields:
  - `lastPriceUpdate`
  - `priceUpdateReason`
  - `lastTicketNameUpdate`
  - `ticketNameUpdateReason`
- Legacy/migration fields:
  - `testField`
  - `insertedFromSupabase`
  - `supabaseSync`

**Fields only in Lodge Registrations:**
- `customerInvoice`
- `supplierInvoice`

### 3. **Pattern Variations Within Each Type**

**Individual Pattern Variations:**
1. **Base pattern** (69 registrations): Standard fields with update tracking
2. **Simplified pattern** (33 registrations): No update tracking fields
3. **Invoice patterns** (5 registrations): Include invoice generation fields
4. **Matching patterns** (5 registrations): Include payment matching fields

**Lodge Pattern Variations:**
1. **Base pattern** (21 registrations): Standard lodge fields
2. **Invoice pattern** (2 registrations): Includes invoice fields
3. **Full pattern** (1 registration): Includes both invoice and matching fields

## Why These Patterns Exist

### Individual Registrations (8 patterns)
- **Update tracking variations**: Some registrations track price/ticket changes, others don't
- **Invoice requirements**: ~5% need invoice generation
- **Payment matching**: ~5% require manual payment reconciliation
- **Legacy data**: Some have migration/test fields

### Lodge Registrations (3 patterns)
- **Simpler structure**: Fewer variations needed for bulk bookings
- **Invoice focus**: 12.5% require invoicing (higher percentage than individuals)
- **No update tracking**: Lodge bookings don't track individual price changes

## Conclusions

1. **Lodge registrations are more standardized** with only 3 patterns vs 8 for individuals
2. **Individual registrations have more complexity** due to:
   - Attendee management
   - Price/ticket update tracking
   - More varied business requirements

3. **Core differences are business-driven**:
   - Individuals: Focus on attendee details and changes
   - Lodges: Focus on bulk bookings and table management

4. **Both types share 40 common fields** showing strong structural similarity at the registration level

5. **Pattern variations within each type** are primarily driven by:
   - Invoice requirements
   - Payment reconciliation needs
   - Update tracking requirements (individuals only)