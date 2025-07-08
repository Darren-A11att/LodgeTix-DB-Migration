# Migration Report

Generated: 2025-07-04T11:32:32.252Z

## Summary

### Collections Migrated

| Collection | Count |
|------------|-------|
| Catalog Objects | 1 |
| Contacts | 168 |
| Users | 144 |
| Orders | 224 |
| Tickets | 0 |
| Financial Transactions | 196 |
| Jurisdictions | 187 |
| Organisations | 455 |
| **Total Documents** | **1375** |

### Migration Status

- ✅ Completed Successfully
- ⚠️ Warnings: 47
- ❌ Errors: 0

## Inventory Updates

### Inventory Summary

- Catalog Objects with Sales: 2
- Product Variations Updated: 18
- Total Quantity Sold: 276

## Warnings (47)

### LINE_ITEM_MAPPING (47 warnings)

- Missing product mapping for event 6c12952b-7cf3-4d6a-81bd-1ac3b7ff7076 or ticket undefined
  Context: {"registrationId":"685beba0b2fa6b693adabc45"}
- Missing product mapping for event 6c12952b-7cf3-4d6a-81bd-1ac3b7ff7076 or ticket undefined
  Context: {"registrationId":"685beba0b2fa6b693adabc4b"}
- Missing product mapping for event 03a51924-1606-47c9-838d-9dc32657cd59 or ticket undefined
  Context: {"registrationId":"685beba0b2fa6b693adabc4b"}
- Missing product mapping for event 6c12952b-7cf3-4d6a-81bd-1ac3b7ff7076 or ticket undefined
  Context: {"registrationId":"685beba0b2fa6b693adabc1a"}
- Missing product mapping for event 03a51924-1606-47c9-838d-9dc32657cd59 or ticket undefined
  Context: {"registrationId":"685beba0b2fa6b693adabc38"}
- ... and 42 more

## ID Mappings

### Functions to Catalog Objects
- Total Mappings: 1

### Events to Products  
- Total Mappings: 6

### Tickets to Variations
- Total Mappings: 9

### Attendees to Contacts
- Total Mappings: 46

### Users to Contacts
- Total Mappings: 0

## Data Quality Notes

### Automatic Corrections Applied

1. **Order Status Normalization**
   - Fixed registrations with 'pending' status but paid payments
   - Normalized payment statuses to match order statuses

2. **Inventory Initialization**
   - Set all initial inventory sold counts to 0
   - Updated based on actual registration/attendee data

3. **Contact Deduplication**
   - Merged contacts with same email and phone
   - Preserved all roles and order references

4. **Missing Data Defaults**
   - Set default currency to AUD where missing
   - Set default ticket capacity to 100 where missing
   - Generated slugs for entities missing them

### Recommended Manual Reviews

1. Review orders with status mismatches between order and payment
2. Verify inventory counts match expected values
3. Check contacts with multiple roles for accuracy
4. Review unassigned tickets in lodge/organisation orders

