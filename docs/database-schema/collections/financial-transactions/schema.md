# Financial Transactions Collection Schema

## Overview
The financial transactions collection tracks all payment activities including payments, refunds, and fees. Each transaction links to an order and provides detailed gateway information.

## Document Structure

```javascript
{
  "_id": ObjectId("..."),
  "transactionId": "550e8400-e29b-41d4-a716-446655440000", // UUID v4
  "orderId": "uuid",                                        // Link to order
  "type": "payment",                                        // payment, refund, adjustment
  "status": "succeeded",                                    // succeeded, pending, failed, cancelled
  
  // Transaction amounts
  "amount": {"$numberDecimal": "253.00"},                   // Total amount
  "currency": "AUD",
  
  // Payment gateway details
  "gateway": {
    "provider": "stripe",                                   // stripe, square, manual
    "transactionId": "pi_3MQZqK2eZvKYlo2C0XqLKGqe",       // Gateway reference
    "paymentMethodId": "pm_1MQZqJ2eZvKYlo2C8n4Kz6X8",     // Payment method
    "customerId": "cus_NQZqKlo2CXqLKG",                    // Gateway customer
    "fee": {"$numberDecimal": "6.90"},                     // Gateway fee
    "net": {"$numberDecimal": "246.10"},                   // Net after fee
    "metadata": {                                           // Gateway-specific data
      "stripe_fee_details": {
        "amount": 690,
        "currency": "aud",
        "description": "Stripe processing fees"
      }
    }
  },
  
  // Platform fee (our commission)
  "platformFee": {
    "amount": {"$numberDecimal": "11.50"},                 // Platform fee amount
    "percentage": 5,                                        // Fee percentage
    "description": "Platform service fee"
  },
  
  // Payment method details
  "paymentMethod": {
    "type": "card",                                         // card, bank_transfer, cash
    "card": {
      "brand": "visa",
      "last4": "4242",
      "expMonth": 12,
      "expYear": 2025,
      "country": "AU"
    }
  },
  
  // For refunds
  "refund": {
    "originalTransactionId": "uuid",                        // Original payment transaction
    "reason": "requested_by_customer",                      // Refund reason
    "amount": {"$numberDecimal": "253.00"}
  },
  
  // Reconciliation
  "reconciliation": {
    "status": "pending",                                    // pending, reconciled, disputed
    "reconciledAt": null,
    "reference": "PAYOUT-2024-01-15"
  },
  
  // Metadata
  "metadata": {
    "ipAddress": "203.0.113.0",
    "userAgent": "Mozilla/5.0...",
    "source": "checkout",                                   // checkout, admin, import
    "createdAt": ISODate("2024-01-15T10:35:00Z"),
    "createdBy": "uuid"                                     // User who processed
  }
}
```

## Field Definitions

### Core Fields
- `transactionId`: UUID v4 for the transaction
- `orderId`: Links to the order this payment is for
- `type`: Type of transaction (payment, refund, adjustment)
- `status`: Current transaction status

### Gateway Details
- `provider`: Payment gateway used
- `transactionId`: Gateway's unique reference
- `fee`: Amount charged by gateway
- `net`: Amount after gateway fee
- `metadata`: Gateway-specific data

### Platform Fee
- `amount`: Our platform commission
- `percentage`: Fee percentage applied
- `description`: Fee description

### Payment Method
- Captures details of how payment was made
- Card details for card payments
- Bank details for transfers

### Refund Details
- Links to original payment transaction
- Reason for refund
- Refund amount (may be partial)

## Indexes
```javascript
db.financialTransactions.createIndex({ "transactionId": 1 }, { unique: true })
db.financialTransactions.createIndex({ "orderId": 1 })
db.financialTransactions.createIndex({ "gateway.transactionId": 1 })
db.financialTransactions.createIndex({ "type": 1, "status": 1 })
db.financialTransactions.createIndex({ "metadata.createdAt": -1 })
db.financialTransactions.createIndex({ "reconciliation.status": 1 })
```

## Migration Notes

### From Payments Collection:
- `payment_id` → `gateway.transactionId`
- `registration_id` → lookup order → `orderId`
- `amount` → `amount`
- `status` → `status`
- `payment_method` → `paymentMethod.type`
- `stripe_payment_intent_id` → `gateway.transactionId`
- `square_payment_id` → `gateway.transactionId`
- Calculate fees from registration data