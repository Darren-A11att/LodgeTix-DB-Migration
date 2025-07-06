# Payment CSV Analysis Report

## Summary

This report analyzes 5 payment CSV files from Stripe and Square to identify common headers, non-standard values, and create a standardized mapping structure.

## Files Analyzed

1. **items-2025-01-01-2026-01-01.csv** (Square - Item-level transaction data)
2. **Stripe - Lodge Tickets Exports.csv** (Stripe export 1)
3. **Stripe - LodgeTix Darren Export.csv** (Stripe export 2)
4. **Stripe - LodgeTix Export.csv** (Stripe export 3)
5. **transactions-2025-01-01-2026-01-01.csv** (Square - Transaction-level data)

## Common Data Patterns Identified

### 1. Core Payment Information
All files contain these essential payment fields (with different header names):

| Data Type | Square Headers | Stripe Headers |
|-----------|---------------|----------------|
| Transaction ID | Transaction ID | id |
| Payment ID | Payment ID | PaymentIntent ID |
| Date/Time | Date, Time, Time Zone | Created date (UTC) |
| Amount | Gross Sales, Net Sales, Product Sales | Amount |
| Currency | (Implicit AUD) | Currency, Converted Currency |
| Card Brand | Card Brand | Card Brand |
| Card Last 4 | PAN Suffix | Card Last4 |
| Status | Transaction Status | Status |
| Customer Name | Customer Name | Card Name, Customer Description |
| Customer Email | (Not in Square files) | Customer Email |
| Description | Description, Notes, Details | Description |
| Refunds | Partial Refunds | Amount Refunded |
| Fees | Fees | Fee |

### 2. Non-Standard Values Requiring Mapping

#### Payment Status Values
- **Square**: "Complete"
- **Stripe**: "Paid", "Failed", "Refunded"

#### Card Brands
Both use standard names: Visa, Mastercard, American Express

#### Currency Format
- **Square**: Uses $ symbol (e.g., "$21.47", "$1,179.40")
- **Stripe**: Numeric values (e.g., 21.47, 1179.40)
- **Currency Code**: All appear to be AUD

#### Date/Time Formats
- **Square**: Separate Date (2025-06-25), Time (20:00:03), Time Zone (Sydney)
- **Stripe**: Combined UTC timestamp (2025-06-18 10:56:30)

#### Event/Registration Types
Common patterns found:
- "Individual Registration - Grand Proclamation 2025"
- "Lodge Registration - Grand Proclamation 2025"
- "Custom Amount"
- "Lodge Package"
- "Ladies Brunch"

### 3. Metadata Fields

Both platforms store extensive metadata, but in different formats:

#### Square
- Embedded in description fields
- Customer ID, Customer Reference ID
- Location field

#### Stripe
- Extensive metadata columns (40+ metadata fields)
- Key metadata includes:
  - registration_type (individuals, lodge)
  - function_name
  - lodge_name
  - platform_fee
  - stripe_fee
  - total_attendees
  - organisation_name
  - environment (production)

### 4. Fee Structure

#### Square
- Fee column (negative values, e.g., -$0.47, -$26.13)
- Fee Percentage Rate: 2.2%
- Service Charges column

#### Stripe
- Fee column (positive values)
- Taxes On Fee
- platform_fee (metadata)
- stripe_fee (metadata)

## Standardized Mapping Structure

```json
{
  "transaction": {
    "id": {
      "square": "Transaction ID",
      "stripe": "id"
    },
    "payment_id": {
      "square": "Payment ID",
      "stripe": "PaymentIntent ID"
    },
    "timestamp": {
      "square": ["Date", "Time", "Time Zone"],
      "stripe": "Created date (UTC)"
    },
    "status": {
      "square": "Transaction Status",
      "stripe": "Status",
      "mapping": {
        "Complete": "paid",
        "Paid": "paid",
        "Failed": "failed",
        "Refunded": "refunded"
      }
    }
  },
  "amounts": {
    "gross_amount": {
      "square": "Gross Sales",
      "stripe": "Amount"
    },
    "net_amount": {
      "square": "Net Total",
      "stripe": "Amount"
    },
    "refund_amount": {
      "square": "Partial Refunds",
      "stripe": "Amount Refunded"
    },
    "fee_amount": {
      "square": "Fees",
      "stripe": "Fee"
    },
    "currency": {
      "square": "implicit_aud",
      "stripe": "Currency"
    }
  },
  "customer": {
    "name": {
      "square": "Customer Name",
      "stripe": ["Card Name", "Customer Description"]
    },
    "email": {
      "square": null,
      "stripe": "Customer Email"
    },
    "id": {
      "square": "Customer ID",
      "stripe": "Customer ID"
    }
  },
  "card": {
    "brand": {
      "square": "Card Brand",
      "stripe": "Card Brand"
    },
    "last4": {
      "square": "PAN Suffix",
      "stripe": "Card Last4"
    }
  },
  "event": {
    "type": {
      "square": "Event Type",
      "stripe": "registration_type (metadata)"
    },
    "description": {
      "square": ["Description", "Details"],
      "stripe": "Description"
    },
    "function_name": {
      "square": "parse_from_description",
      "stripe": "function_name (metadata)"
    },
    "organisation": {
      "square": "Location",
      "stripe": "organisation_name (metadata)"
    }
  }
}
```

## Data Quality Issues & Recommendations

### 1. Missing Data
- Square files lack customer email addresses
- Square doesn't have explicit currency codes
- Some Stripe records have empty customer names

### 2. Data Parsing Required
- Square amounts need to strip $ and commas
- Square dates need timezone conversion to UTC
- Event/function details in Square need parsing from description fields

### 3. Reconciliation Challenges
- Different fee structures between platforms
- Multiple Stripe exports with slightly different metadata columns
- Need to handle both individual and lodge registrations

### 4. Recommended Processing Steps
1. Normalize currency amounts (remove symbols, convert to decimal)
2. Convert all timestamps to UTC
3. Standardize status values using the mapping
4. Extract event/function details from description fields
5. Calculate net amounts consistently
6. Handle missing email addresses gracefully

## Next Steps

1. Implement a data parser for each file format
2. Create a unified data model based on the mapping structure
3. Build validation rules for data quality
4. Develop reconciliation logic to match transactions across platforms
5. Generate standardized reports for accounting purposes