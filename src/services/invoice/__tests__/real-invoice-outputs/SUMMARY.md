# Real Invoice Generation Summary

Generated invoices from actual payment and registration data provided by the user.

## Individual Registrations (5 invoices)

### 1. Luis A Reyes - IND-029388TI
- **Payment**: $277.10 (Square, Visa ****9894)
- **Registration**: 2 attendees (RW Bro Luis Reyes + Mrs Marilyn Reyes)
- **Lodge**: Lodge Sir Joseph Banks No. 300
- **Invoice Total**: $277.10
- **Supplier Invoice**: $14.81 (Processing fees + 2.8% software fee)

### 2. Stoyan Dimitrov - IND-702724KT
- **Payment**: $21.47 (Square, Amex ****1004)
- **Registration**: 1 attendee (W Bro Stoyan Dimitrov)
- **Lodge**: Lodge Ku-Ring-Gai No. 1033
- **Invoice Total**: $21.47
- **Supplier Invoice**: $1.42

### 3. Robert Moore - IND-648819EP
- **Payment**: $21.47 (Square, Visa ****7786)
- **Registration**: 1 attendee
- **Invoice Total**: $41.30 (calculated from items)
- **Supplier Invoice**: $2.46

### 4. Ken Sheppard - IND-522951GX
- **Payment**: $287.32 (Square)
- **Registration**: 1 attendee (RW Bro Kenneth SHEPPARD, Grand Chaplain)
- **Lodge**: Lodge Milton No. 63
- **Multiple tickets**: 4 different event tickets
- **Invoice Total**: $287.32
- **Supplier Invoice**: $15.34

### 5. David Baker (VIP) - IND-128022YC
- **Payment**: $1,999.85 (Square)
- **Registration**: VIP Package
- **Invoice Total**: $4,099.99 (calculated)
- **Supplier Invoice**: $215.09

## Lodge Registrations (5 invoices)

### 6. Lodge Sydney St. George No. 269 - LDG-867620PW
- **Payment**: $4,717.59 (Square, Visa ****4477)
- **Description**: 4 tables
- **Contact**: McJulian Franco
- **Invoice Total**: $4,717.59
- **Supplier Invoice**: $247.45 (2.8% Square rate)

### 7. The Prince Charles Edward Stuart Lodge No. 1745 - LDG-643031YX
- **Payment**: $1,179.40 (Square, Amex ****2003)
- **Description**: 1 table
- **Contact**: Joe Corrigan
- **Invoice Total**: $1,179.40
- **Supplier Invoice**: $62.08

### 8. VIP Lodge Group - IND-930810GG
- **Payment**: $1,999.85 (Square)
- **Note**: High-value individual registration treated as lodge
- **Invoice Total**: $1,999.85
- **Supplier Invoice**: $105.07

### 9. Lodge 210679 - LDG-210679FX
- **Payment**: $1,196.32 (Square)
- **Email**: joe@buildtec.net.au
- **Status**: Previously processed
- **Invoice Total**: $1,196.32
- **Supplier Invoice**: $62.97

### 10. Test Lodge 005 - LDG-TEST-005
- **Payment**: $500.00 (Square)
- **Note**: Minimal test case
- **Invoice Total**: $500.00
- **Supplier Invoice**: $26.49

## Key Observations

1. **Payment Sources**: All payments are from Square (2.8% software utilization fee)
2. **Processing Fees**: Correctly calculated as payment total - subtotal
3. **Registration Data**: Mix of complete and partial registration data
4. **Billing Details**: 
   - Individuals use bookingContact details
   - Lodges use metadata.billingDetails when available
5. **Ticket Prices**: Many tickets show $0 price, indicating special pricing or included tickets

## Total Summary

- **Total Customer Invoices**: $11,919.34
- **Total Supplier Invoices**: $753.17
- **Average Processing Fee**: ~2.2% (Square standard)
- **Software Utilization**: 2.8% of customer invoice totals