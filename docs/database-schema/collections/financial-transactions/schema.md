# Financial Transactions Collection Schema

## Overview
The financial transactions collection serves as the single source of truth for all financial activities related to registrations. It tracks payments, invoices, refunds, and reconciliation status.

## Document Structure

```javascript
{
  _id: ObjectId,
  transactionId: String,        // Unique transaction identifier (e.g., "TXN-2024-00123")
  type: String,                 // Transaction type enum
  
  // Reference to related entity
  reference: {
    type: String,               // "registration", "refund", "adjustment"
    id: ObjectId,               // Registration ID or other entity ID
    number: String,             // Registration number for quick reference
    functionId: String,         // Function ID for reporting
    functionName: String        // Denormalized for display
  },
  
  // Transaction parties
  parties: {
    customer: {
      type: String,             // "organisation" or "user"
      id: ObjectId,             // Customer ID
      name: String,             // Customer name
      abn: String,              // ABN if applicable
      email: String,            // Contact email
      contact: {
        name: String,
        phone: String
      }
    },
    supplier: {
      name: String,             // Supplier legal name
      abn: String,              // Supplier ABN
      address: String           // Supplier address
    }
  },
  
  // Financial amounts
  amounts: {
    gross: Decimal128,          // Subtotal before fees and tax
    fees: Decimal128,           // Processing fees
    tax: Decimal128,            // GST/tax amount
    net: Decimal128,            // Net amount (gross - fees)
    total: Decimal128,          // Total charged to customer
    currency: String            // Currency code (e.g., "AUD")
  },
  
  // Payment records (array for partial payments)
  payments: [{
    _id: ObjectId,
    method: String,             // "credit_card", "bank_transfer", "cash"
    gateway: String,            // "stripe", "square", "manual"
    gatewayTransactionId: String, // External transaction ID
    status: String,             // "pending", "succeeded", "failed", "refunded"
    amount: Decimal128,         // Amount for this payment
    processedAt: Date,          // When payment was processed
    
    // Card details (if applicable)
    card: {
      last4: String,
      brand: String,            // "visa", "mastercard", etc.
      expiryMonth: Number,
      expiryYear: Number
    },
    
    // Gateway fees
    fees: {
      amount: Decimal128,
      rate: String,             // e.g., "1.75% + $0.30"
      breakdown: {
        percentage: Decimal128,
        fixed: Decimal128
      }
    },
    
    // Gateway metadata
    metadata: {
      chargeId: String,
      receiptUrl: String,
      riskScore: Number,
      // Additional gateway-specific fields
    }
  }],
  
  // Invoice records
  invoices: {
    // Customer invoice
    customer: {
      _id: ObjectId,
      invoiceNumber: String,    // Sequential invoice number
      type: String,             // "tax_invoice", "receipt", "proforma"
      issuedDate: Date,
      dueDate: Date,            // null if paid immediately
      status: String,           // "draft", "sent", "paid", "overdue", "cancelled"
      
      // Line items
      lineItems: [{
        description: String,
        productId: ObjectId,    // Reference to product
        eventId: String,        // For ticket products
        quantity: Number,
        unitPrice: Decimal128,
        total: Decimal128,
        taxRate: Number,        // e.g., 0.10 for 10% GST
        taxAmount: Decimal128
      }],
      
      // Totals
      totals: {
        subtotal: Decimal128,
        tax: Decimal128,
        fees: Decimal128,
        total: Decimal128
      },
      
      // Delivery
      pdfUrl: String,
      emailedTo: [String],      // Email addresses
      emailedAt: Date,
      downloadCount: Number
    },
    
    // Credit notes for refunds/adjustments
    creditNotes: [{
      _id: ObjectId,
      creditNoteNumber: String,
      originalInvoiceNumber: String,
      issuedDate: Date,
      amount: Decimal128,
      reason: String,
      status: String,
      pdfUrl: String
    }],
    
    // Supplier invoices (if tracking costs)
    supplier: [{
      _id: ObjectId,
      invoiceNumber: String,
      supplierName: String,
      amount: Decimal128,
      dueDate: Date,
      status: String
    }]
  },
  
  // Remittance advice
  remittance: {
    required: Boolean,
    sentDate: Date,
    method: String,             // "email", "post"
    recipient: String,
    reference: String,
    details: Mixed              // Flexible remittance details
  },
  
  // Reconciliation tracking
  reconciliation: {
    status: String,             // "pending", "reconciled", "disputed", "exception"
    reconciledDate: Date,
    reconciledBy: String,       // User ID or "system"
    bankStatementRef: String,
    bankDate: Date,
    notes: String
  },
  
  // Accounting integration
  accounting: {
    exported: Boolean,
    exportedAt: Date,
    exportBatchId: String,
    
    // Double-entry bookkeeping
    entries: [{
      account: String,          // Account code
      accountName: String,      // Account name
      debit: Decimal128,
      credit: Decimal128,
      description: String
    }],
    
    // External system references
    externalReferences: {
      xeroId: String,
      myobId: String,
      quickbooksId: String
    }
  },
  
  // Refund tracking (if this is a refund)
  refund: {
    originalTransactionId: ObjectId,
    reason: String,
    requestedBy: ObjectId,
    approvedBy: ObjectId,
    items: [{                   // Partial refund support
      description: String,
      quantity: Number,
      amount: Decimal128
    }]
  },
  
  // Audit trail
  audit: {
    createdAt: Date,
    createdBy: String,          // User ID or "system"
    updatedAt: Date,
    updatedBy: String,
    version: Number,            // For optimistic locking
    
    // Change history
    changes: [{
      timestamp: Date,
      userId: String,
      action: String,
      field: String,
      oldValue: Mixed,
      newValue: Mixed,
      reason: String
    }],
    
    // Notes and comments
    notes: [{
      timestamp: Date,
      userId: String,
      note: String,
      type: String              // "general", "dispute", "reconciliation"
    }]
  }
}
```

## Field Constraints

### Required Fields
- `transactionId` - Must be unique
- `type` - Must be valid enum value
- `reference.type` - Must be valid reference type
- `reference.id` - Must reference existing entity
- `parties.customer` - Must have complete customer information
- `amounts` - All amount fields required
- `payments` - At least one payment record

### Enumerations

**Transaction Types:**
- `registration_payment` - Payment for registration
- `refund` - Full or partial refund
- `adjustment` - Price adjustment or correction
- `transfer` - Transfer between accounts
- `cancellation_fee` - Cancellation charges

**Payment Status:**
- `pending` - Awaiting processing
- `processing` - Currently being processed
- `succeeded` - Successfully completed
- `failed` - Payment failed
- `refunded` - Payment refunded
- `partially_refunded` - Partial refund applied

**Reconciliation Status:**
- `pending` - Not yet reconciled
- `reconciled` - Matched with bank statement
- `disputed` - Under dispute
- `exception` - Requires manual intervention
- `void` - Transaction voided

## Patterns Used

### Bucket Pattern
Used for storing payment history - multiple payments can be stored in the `payments` array, useful for partial payments or payment plans.

### Attribute Pattern
The `accounting.externalReferences` and `payments.metadata` objects use the attribute pattern to store varying gateway-specific or accounting system-specific fields.

### Computed Pattern
The `amounts` object contains computed values (net, total) that are calculated from other fields but stored for query performance.

## Transaction Requirements
This collection requires ACID transactions when:
- Creating a financial transaction linked to a registration
- Processing refunds that affect multiple documents
- Updating reconciliation status that affects accounting exports