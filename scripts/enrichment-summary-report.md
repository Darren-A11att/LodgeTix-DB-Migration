# Square Transactions Enrichment Summary Report

Generated: 2025-07-22

## Overview

Successfully enriched Square transactions with registration data by matching payment IDs across multiple fields in both MongoDB and Supabase.

## Results Summary

### Initial Enrichment
- **Total Square Transactions**: 112
- **Successfully Enriched**: 101 (90.2%)
- **Initially Unenriched**: 11 (9.8%)

### Additional Supabase Search
- **Found in Supabase**: 3 registrations
- **Successfully Imported**: 3
- **Field where found**: `stripe_payment_intent_id` (Square payment IDs were stored in Stripe field)

### Final Status
- **Total Enriched**: 104 (92.9%)
- **Remaining Unenriched**: 8 (7.1%)

## Successfully Recovered Registrations

1. **IND-991563YW**
   - Payment ID: bbt1J0xMeBdB1GXNakdpciUyx6FZY
   - Customer: Simon Welburn (sj_welburn@hotmail.com)
   - Amount: $20.45

2. **IND-241525JY**
   - Payment ID: DjHXcnzNvuuZVVGxdUe9PXWraYJZY
   - Customer: Brian Samson (bsamsonrgc@gmail.com)
   - Amount: $20.45

3. **IND-176449HG**
   - Payment ID: Pdbu7w9Ia2VEdeu2lhuZEBVvhzfZY
   - Customer: Peter Goodridge (petergoodridge@hotmail.com)
   - Amount: $20.45

## Remaining Unenriched Transactions

### Lodge Registrations (5)

1. **Lodge Ionic No. 65**
   - Payment: nVNemNbGg3V5dGg2EOXOnLa58AeZY
   - Amount: $1,175.87
   - Customer: Marcantone Cosoleto

2. **United Supreme Chapter (3 transactions)**
   - Payments: bTp1t6NLdAcZLC4aAy1b7uM0KP8YY, bD5NnYXdmohsMmTpxZm4LyWgmaDZY, B8ola9eL7qdDsS429Y0aVe2RdFEZY
   - Amount: $1,196.32 each
   - No customer information

### Test/Unknown Transactions (3)
- Small amounts ($21.47, $93.05)
- Generic customer names or no customer info
- Likely test transactions

## Technical Details

### Search Fields Checked
1. MongoDB:
   - squarePaymentId
   - square_payment_id
   - stripePaymentIntentId
   - Plus 20+ other payment-related fields

2. Supabase:
   - stripe_payment_intent_id
   - square_payment_id
   - registration_data->square_payment_id

### Registration Object Structure Created
Each enriched transaction now contains:
- Registration ID and confirmation number
- Registration type (individuals/lodge)
- Attendees array with:
  - Personal details
  - Contact information
  - Membership details
  - Catering preferences
  - Ticket assignments

### Files Generated
1. `/scripts/unenriched-transactions-report.json` - Initial unenriched transactions
2. `/scripts/payment-id-search-results.json` - MongoDB search results
3. `/scripts/supabase-payment-search-results.json` - Supabase search results

## Recommendations

1. **Missing Lodge Registrations**: The 5 unenriched lodge payments appear to be legitimate transactions that never had registrations created due to the broken lodge registration flow.

2. **Test Transactions**: The 3 small test transactions can likely be ignored as they appear to be testing data.

3. **Data Integrity**: Consider adding validation to ensure payment IDs are stored in the correct fields going forward.