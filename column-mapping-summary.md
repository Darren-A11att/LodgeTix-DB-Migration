# Payment CSV Column Mapping Summary

## Core Column Mappings

### 1. Transaction Identifiers
| Square | Stripe | Standardized Field |
|--------|--------|-------------------|
| Transaction ID | id | transaction_id |
| Payment ID | PaymentIntent ID | payment_intent_id |

### 2. Date/Time
| Square | Stripe | Standardized Field |
|--------|--------|-------------------|
| Date + Time + Time Zone | Created date (UTC) | timestamp |
| (3 separate fields) | (single UTC timestamp) | (unified datetime) |

### 3. Amounts
| Square | Stripe | Standardized Field |
|--------|--------|-------------------|
| Gross Sales | Amount | gross_amount |
| Net Sales/Net Total | Amount (minus fees) | net_amount |
| Fees | Fee | fee_amount |
| Partial Refunds | Amount Refunded | refund_amount |
| (implicit AUD) | Currency | currency |

### 4. Customer Information
| Square | Stripe | Standardized Field |
|--------|--------|-------------------|
| Customer Name | Card Name | customer_name |
| Customer ID | Customer ID | customer_id |
| (not available) | Customer Email | customer_email |

### 5. Card Details
| Square | Stripe | Standardized Field |
|--------|--------|-------------------|
| Card Brand | Card Brand | card_brand |
| PAN Suffix | Card Last4 | card_last4 |

### 6. Status
| Square | Stripe | Standardized Field |
|--------|--------|-------------------|
| Transaction Status | Status | status |
| "Complete" | "Paid" | "paid" |

### 7. Event/Description
| Square | Stripe | Standardized Field |
|--------|--------|-------------------|
| Description/Details | Description | description |
| Location | organisationName (metadata) | organisation |
| Event Type | registration_type (metadata) | event_type |

## Key Differences to Handle

1. **Currency Format**
   - Square: "$1,234.56" (string with symbols)
   - Stripe: 1234.56 (numeric)
   - **Solution**: Strip symbols and convert to float

2. **Timestamps**
   - Square: Separate Date/Time/Timezone columns
   - Stripe: Single UTC timestamp
   - **Solution**: Combine Square fields and convert to UTC

3. **Missing Data**
   - Square: No customer email
   - Stripe: Has customer email
   - **Solution**: Make email optional in schema

4. **Metadata**
   - Square: Limited metadata in description fields
   - Stripe: 40+ metadata columns with structured data
   - **Solution**: Parse Square descriptions, preserve all Stripe metadata

## Recommended Processing Flow

1. **Parse CSV files** → Extract raw data
2. **Apply column mappings** → Convert to standard fields
3. **Transform values** → Clean currency, dates, statuses
4. **Validate data** → Check required fields
5. **Store in MongoDB** → Single payments collection

## Sample Standardized Document

```json
{
  "_id": "ObjectId",
  "transaction_id": "ch_3RbJfOCari1bgsWq0CxPr7NI",
  "payment_intent_id": "pi_...",
  "timestamp": "2025-06-18T10:56:30Z",
  "status": "paid",
  
  "amounts": {
    "gross": 118.46,
    "net": 115.84,
    "fee": 2.62,
    "refunded": 0,
    "currency": "AUD"
  },
  
  "customer": {
    "name": "John Smith",
    "email": "john@example.com",
    "id": "cus_..."
  },
  
  "card": {
    "brand": "Visa",
    "last4": "4242"
  },
  
  "event": {
    "type": "individual",
    "description": "Individual Registration - Grand Proclamation 2025",
    "function_name": "Grand Proclamation 2025",
    "organisation": "Grand Lodge"
  },
  
  "source": {
    "platform": "stripe",
    "file": "Stripe - Lodge Tickets Exports.csv",
    "imported_at": "2025-01-25T..."
  },
  
  "metadata": {
    // All original metadata preserved
  },
  
  "original_data": {
    // Complete original row data
  }
}
```