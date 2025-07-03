# Financial Transactions Collection - Validation Rules

## MongoDB Schema Validation

```javascript
db.createCollection("financialTransactions", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["transactionId", "type", "reference", "parties", "amounts", "payments", "audit"],
      properties: {
        transactionId: {
          bsonType: "string",
          pattern: "^TXN-[0-9]{4}-[0-9]{5}$",
          description: "Transaction ID must follow pattern TXN-YYYY-NNNNN"
        },
        type: {
          bsonType: "string",
          enum: ["registration_payment", "refund", "adjustment", "transfer", "cancellation_fee"],
          description: "Transaction type must be valid"
        },
        reference: {
          bsonType: "object",
          required: ["type", "id", "functionId"],
          properties: {
            type: {
              bsonType: "string",
              enum: ["registration", "refund", "adjustment"]
            },
            id: { bsonType: "objectId" },
            number: { bsonType: "string" },
            functionId: { 
              bsonType: "string",
              pattern: "^[a-z0-9-]+$"
            },
            functionName: { bsonType: "string" }
          }
        },
        parties: {
          bsonType: "object",
          required: ["customer", "supplier"],
          properties: {
            customer: {
              bsonType: "object",
              required: ["type", "id", "name"],
              properties: {
                type: {
                  bsonType: "string",
                  enum: ["organisation", "contact", "user"]
                },
                id: { bsonType: "objectId" },
                name: { 
                  bsonType: "string",
                  minLength: 1,
                  maxLength: 200
                },
                abn: {
                  bsonType: ["string", "null"],
                  pattern: "^[0-9]{11}$"
                },
                email: {
                  bsonType: "string",
                  pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                },
                contact: {
                  bsonType: "object",
                  properties: {
                    name: { bsonType: "string" },
                    phone: { 
                      bsonType: "string",
                      pattern: "^\\+?[0-9\\s-()]+$"
                    }
                  }
                }
              }
            },
            supplier: {
              bsonType: "object",
              required: ["name", "abn"],
              properties: {
                name: { bsonType: "string" },
                abn: {
                  bsonType: "string",
                  pattern: "^[0-9]{11}$"
                },
                address: { bsonType: "string" }
              }
            }
          }
        },
        amounts: {
          bsonType: "object",
          required: ["gross", "fees", "tax", "net", "total", "currency"],
          properties: {
            gross: { bsonType: "decimal" },
            fees: { bsonType: "decimal" },
            tax: { bsonType: "decimal" },
            net: { bsonType: "decimal" },
            total: { bsonType: "decimal" },
            currency: {
              bsonType: "string",
              enum: ["AUD", "NZD", "USD", "GBP", "EUR"]
            }
          },
          additionalProperties: false
        },
        payments: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            required: ["_id", "method", "status", "amount", "processedAt"],
            properties: {
              _id: { bsonType: "objectId" },
              method: {
                bsonType: "string",
                enum: ["credit_card", "debit_card", "bank_transfer", "paypal", "cash", "cheque"]
              },
              gateway: {
                bsonType: ["string", "null"],
                enum: ["stripe", "square", "paypal", "manual", null]
              },
              gatewayTransactionId: { bsonType: ["string", "null"] },
              status: {
                bsonType: "string",
                enum: ["pending", "processing", "succeeded", "failed", "refunded", "partially_refunded"]
              },
              amount: {
                bsonType: "decimal",
                minimum: 0
              },
              processedAt: { bsonType: "date" },
              card: {
                bsonType: ["object", "null"],
                properties: {
                  last4: {
                    bsonType: "string",
                    pattern: "^[0-9]{4}$"
                  },
                  brand: {
                    bsonType: "string",
                    enum: ["visa", "mastercard", "amex", "discover", "diners", "jcb", "unionpay"]
                  },
                  expiryMonth: {
                    bsonType: "int",
                    minimum: 1,
                    maximum: 12
                  },
                  expiryYear: {
                    bsonType: "int",
                    minimum: 2024,
                    maximum: 2099
                  }
                }
              },
              fees: {
                bsonType: ["object", "null"],
                properties: {
                  amount: { bsonType: "decimal" },
                  rate: { bsonType: "string" },
                  breakdown: {
                    bsonType: "object",
                    properties: {
                      percentage: { bsonType: "decimal" },
                      fixed: { bsonType: "decimal" }
                    }
                  }
                }
              },
              metadata: { bsonType: ["object", "null"] }
            }
          }
        },
        invoices: {
          bsonType: "object",
          properties: {
            customer: {
              bsonType: ["object", "null"],
              properties: {
                _id: { bsonType: "objectId" },
                invoiceNumber: {
                  bsonType: "string",
                  pattern: "^INV-[0-9]{4}-[0-9]{5}$"
                },
                type: {
                  bsonType: "string",
                  enum: ["tax_invoice", "receipt", "proforma"]
                },
                issuedDate: { bsonType: "date" },
                dueDate: { bsonType: ["date", "null"] },
                status: {
                  bsonType: "string",
                  enum: ["draft", "sent", "paid", "overdue", "cancelled"]
                },
                lineItems: {
                  bsonType: "array",
                  items: {
                    bsonType: "object",
                    required: ["description", "quantity", "unitPrice", "total"],
                    properties: {
                      description: { bsonType: "string" },
                      productId: { bsonType: ["objectId", "null"] },
                      eventId: { bsonType: ["string", "null"] },
                      quantity: {
                        bsonType: "int",
                        minimum: 1
                      },
                      unitPrice: { bsonType: "decimal" },
                      total: { bsonType: "decimal" },
                      taxRate: {
                        bsonType: "number",
                        minimum: 0,
                        maximum: 1
                      },
                      taxAmount: { bsonType: "decimal" }
                    }
                  }
                },
                totals: {
                  bsonType: "object",
                  required: ["subtotal", "tax", "total"],
                  properties: {
                    subtotal: { bsonType: "decimal" },
                    tax: { bsonType: "decimal" },
                    fees: { bsonType: ["decimal", "null"] },
                    total: { bsonType: "decimal" }
                  }
                },
                pdfUrl: { bsonType: ["string", "null"] },
                emailedTo: {
                  bsonType: "array",
                  items: {
                    bsonType: "string",
                    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
                  }
                },
                emailedAt: { bsonType: ["date", "null"] },
                downloadCount: {
                  bsonType: "int",
                  minimum: 0
                }
              }
            },
            creditNotes: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  _id: { bsonType: "objectId" },
                  creditNoteNumber: {
                    bsonType: "string",
                    pattern: "^CN-[0-9]{4}-[0-9]{5}$"
                  },
                  originalInvoiceNumber: { bsonType: "string" },
                  issuedDate: { bsonType: "date" },
                  amount: { bsonType: "decimal" },
                  reason: { bsonType: "string" },
                  status: { bsonType: "string" },
                  pdfUrl: { bsonType: ["string", "null"] }
                }
              }
            },
            supplier: {
              bsonType: "array",
              items: {
                bsonType: "object"
              }
            }
          }
        },
        remittance: {
          bsonType: ["object", "null"],
          properties: {
            required: { bsonType: "bool" },
            sentDate: { bsonType: ["date", "null"] },
            method: {
              bsonType: ["string", "null"],
              enum: ["email", "post", "eft", null]
            },
            recipient: { bsonType: ["string", "null"] },
            reference: { bsonType: ["string", "null"] },
            details: { bsonType: ["object", "null"] }
          }
        },
        reconciliation: {
          bsonType: "object",
          required: ["status"],
          properties: {
            status: {
              bsonType: "string",
              enum: ["pending", "reconciled", "disputed", "exception", "void"]
            },
            reconciledDate: { bsonType: ["date", "null"] },
            reconciledBy: { bsonType: ["string", "null"] },
            bankStatementRef: { bsonType: ["string", "null"] },
            bankDate: { bsonType: ["date", "null"] },
            notes: { bsonType: ["string", "null"] }
          }
        },
        accounting: {
          bsonType: ["object", "null"],
          properties: {
            exported: { bsonType: "bool" },
            exportedAt: { bsonType: ["date", "null"] },
            exportBatchId: { bsonType: ["string", "null"] },
            entries: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["account", "debit", "credit"],
                properties: {
                  account: { bsonType: "string" },
                  accountName: { bsonType: "string" },
                  debit: { bsonType: "decimal" },
                  credit: { bsonType: "decimal" },
                  description: { bsonType: "string" }
                }
              }
            },
            externalReferences: {
              bsonType: "object",
              properties: {
                xeroId: { bsonType: ["string", "null"] },
                myobId: { bsonType: ["string", "null"] },
                quickbooksId: { bsonType: ["string", "null"] }
              }
            }
          }
        },
        refund: {
          bsonType: ["object", "null"],
          properties: {
            originalTransactionId: { bsonType: "objectId" },
            reason: { bsonType: "string" },
            requestedBy: { bsonType: "objectId" },
            approvedBy: { bsonType: ["objectId", "null"] },
            items: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  description: { bsonType: "string" },
                  quantity: { bsonType: "int" },
                  amount: { bsonType: "decimal" }
                }
              }
            }
          }
        },
        audit: {
          bsonType: "object",
          required: ["createdAt", "createdBy", "updatedAt", "updatedBy"],
          properties: {
            createdAt: { bsonType: "date" },
            createdBy: { bsonType: "string" },
            updatedAt: { bsonType: "date" },
            updatedBy: { bsonType: "string" },
            version: {
              bsonType: "int",
              minimum: 1
            },
            changes: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  timestamp: { bsonType: "date" },
                  userId: { bsonType: "string" },
                  action: { bsonType: "string" },
                  field: { bsonType: "string" },
                  oldValue: { },
                  newValue: { },
                  reason: { bsonType: "string" }
                }
              }
            },
            notes: {
              bsonType: "array",
              items: {
                bsonType: "object",
                properties: {
                  timestamp: { bsonType: "date" },
                  userId: { bsonType: "string" },
                  note: { bsonType: "string" },
                  type: {
                    bsonType: "string",
                    enum: ["general", "dispute", "reconciliation", "audit"]
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})
```

## Custom Validation Rules

### 1. Amount Consistency
```javascript
// Ensure net = gross - fees
db.financialTransactions.createIndex({
  $expr: {
    $eq: ["$amounts.net", { $subtract: ["$amounts.gross", "$amounts.fees"] }]
  }
})

// Ensure total payment amounts match transaction total
db.financialTransactions.createIndex({
  $expr: {
    $eq: [
      "$amounts.total",
      { $sum: "$payments.amount" }
    ]
  }
})
```

### 2. Invoice Totals Validation
```javascript
// Ensure invoice line items sum to subtotal
function validateInvoiceTotals(invoice) {
  const lineItemTotal = invoice.lineItems.reduce((sum, item) => 
    sum + item.total, 0
  );
  return lineItemTotal === invoice.totals.subtotal;
}
```

### 3. Refund Validation
```javascript
// Ensure refund amount doesn't exceed original transaction
async function validateRefund(refund) {
  const original = await db.financialTransactions.findOne({
    _id: refund.originalTransactionId
  });
  
  const totalRefunded = await db.financialTransactions.aggregate([
    { $match: { 
      "refund.originalTransactionId": refund.originalTransactionId 
    }},
    { $group: { 
      _id: null, 
      total: { $sum: "$amounts.total" } 
    }}
  ]);
  
  return Math.abs(totalRefunded.total) <= original.amounts.total;
}
```

## Business Rules

1. **Transaction ID Format**: Must follow pattern TXN-YYYY-NNNNN
2. **Invoice Numbers**: Sequential and unique per financial year
3. **Payment Status**: Can only transition in allowed directions
4. **Reconciliation**: Can only be marked reconciled if payment succeeded
5. **Accounting Export**: Can only export reconciled transactions
6. **Refunds**: Cannot exceed original transaction amount
7. **GST**: Must be 10% for Australian transactions