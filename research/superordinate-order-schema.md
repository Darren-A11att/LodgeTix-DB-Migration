# Superordinate Order Schema Design

## Overview

This document outlines a flexible, polymorphic order schema that can handle multiple order types (registration, sponsorship, POS, etc.) while maintaining consistency, extensibility, and performance.

## Core Design Principles

1. **Single Source of Truth**: One order collection with discriminator fields
2. **Polymorphic Pattern**: Base schema with type-specific extensions
3. **State Machine**: Clear state transitions with audit trail
4. **Financial Integration**: Direct linking to payment systems
5. **Extensibility**: Easy to add new order types without breaking existing functionality

## Schema Design

### Base Order Schema

```typescript
interface BaseOrder {
  // Primary Identification
  _id: ObjectId;
  orderNumber: string; // Human-readable, unique identifier
  orderType: OrderType; // Discriminator field
  
  // Temporal Information
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  
  // State Management
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  
  // Customer Information
  customer: {
    id: ObjectId; // Reference to customer collection
    type: 'individual' | 'organization' | 'lodge';
    name: string;
    email: string;
    phone?: string;
    // Denormalized for performance and historical accuracy
    snapshotData?: any;
  };
  
  // Financial Information
  financial: {
    currency: string;
    subtotal: number;
    tax: number;
    discounts: Discount[];
    total: number;
    paid: number;
    balance: number;
    paymentStatus: PaymentStatus;
  };
  
  // Line Items (Polymorphic)
  items: OrderItem[];
  
  // Relationships
  relatedOrders: RelatedOrder[];
  parentOrderId?: ObjectId;
  
  // Event Context
  event?: {
    id: ObjectId;
    name: string;
    date: Date;
    location: string;
  };
  
  // Metadata
  metadata: Record<string, any>;
  tags: string[];
  
  // Audit Trail
  createdBy: {
    userId: ObjectId;
    userType: 'system' | 'admin' | 'customer';
    ipAddress?: string;
  };
  lastModifiedBy: {
    userId: ObjectId;
    timestamp: Date;
  };
  
  // Type-specific data
  typeSpecificData: any; // Polymorphic field
}
```

### Discriminator Pattern Implementation

```typescript
// Order Types Enum
enum OrderType {
  REGISTRATION = 'registration',
  SPONSORSHIP = 'sponsorship',
  POS = 'pos',
  MERCHANDISE = 'merchandise',
  DONATION = 'donation',
  MEMBERSHIP = 'membership',
  TICKET = 'ticket'
}

// Type-specific interfaces
interface RegistrationOrder extends BaseOrder {
  orderType: OrderType.REGISTRATION;
  typeSpecificData: {
    registrationType: 'individual' | 'group' | 'lodge';
    attendees: Attendee[];
    accommodationRequests?: AccommodationRequest[];
    dietaryRestrictions?: string[];
    specialRequests?: string;
    emergencyContact?: EmergencyContact;
  };
}

interface SponsorshipOrder extends BaseOrder {
  orderType: OrderType.SPONSORSHIP;
  typeSpecificData: {
    sponsorshipLevel: string;
    benefits: SponsorshipBenefit[];
    recognitionPreferences: {
      displayName: string;
      logo?: string;
      websiteListing: boolean;
      programListing: boolean;
    };
    contractTerms?: {
      startDate: Date;
      endDate: Date;
      paymentSchedule: PaymentSchedule[];
    };
  };
}

interface POSOrder extends BaseOrder {
  orderType: OrderType.POS;
  typeSpecificData: {
    terminal: string;
    cashier: string;
    location: string;
    shiftId?: string;
    receiptNumber: string;
    paymentMethod: 'cash' | 'card' | 'check' | 'other';
  };
}
```

### Common vs Specific Fields Strategy

```typescript
// Common fields that apply to ALL order types
interface CommonOrderFields {
  // Always required
  orderNumber: string;
  orderType: OrderType;
  status: OrderStatus;
  customer: CustomerInfo;
  financial: FinancialSummary;
  createdAt: Date;
  updatedAt: Date;
  
  // Often used but optional
  event?: EventReference;
  items: OrderItem[];
  metadata: Record<string, any>;
}

// Type-specific field validation
const orderTypeValidation = {
  [OrderType.REGISTRATION]: {
    required: ['attendees', 'registrationType'],
    optional: ['accommodationRequests', 'dietaryRestrictions']
  },
  [OrderType.SPONSORSHIP]: {
    required: ['sponsorshipLevel', 'benefits'],
    optional: ['contractTerms', 'recognitionPreferences']
  },
  [OrderType.POS]: {
    required: ['terminal', 'cashier', 'receiptNumber'],
    optional: ['shiftId', 'location']
  }
};
```

### State Machine Pattern

```typescript
enum OrderStatus {
  // Initial states
  DRAFT = 'draft',
  PENDING = 'pending',
  
  // Processing states
  PROCESSING = 'processing',
  PAYMENT_PENDING = 'payment_pending',
  PARTIALLY_PAID = 'partially_paid',
  
  // Final states
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  FAILED = 'failed'
}

// State transition rules
const stateTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]: [OrderStatus.PENDING, OrderStatus.CANCELLED],
  [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.PAYMENT_PENDING, OrderStatus.COMPLETED, OrderStatus.FAILED],
  [OrderStatus.PAYMENT_PENDING]: [OrderStatus.PARTIALLY_PAID, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.PARTIALLY_PAID]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [], // Terminal state
  [OrderStatus.REFUNDED]: [], // Terminal state
  [OrderStatus.FAILED]: [OrderStatus.PENDING] // Can retry
};

// Status history tracking
interface StatusHistoryEntry {
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  timestamp: Date;
  reason?: string;
  userId: ObjectId;
  metadata?: Record<string, any>;
}
```

### Extensibility Through Subdocuments

```typescript
// Flexible item structure supporting various product types
interface OrderItem {
  id: string; // Unique within order
  type: 'ticket' | 'merchandise' | 'service' | 'donation' | 'custom';
  productId?: ObjectId; // Reference to product catalog
  
  // Item details
  name: string;
  description?: string;
  sku?: string;
  
  // Pricing
  unitPrice: number;
  quantity: number;
  discount?: number;
  tax?: number;
  total: number;
  
  // Fulfillment
  fulfillmentStatus?: 'pending' | 'processing' | 'fulfilled' | 'cancelled';
  fulfillmentData?: any; // Type-specific fulfillment info
  
  // Extensible metadata
  attributes: Record<string, any>;
  
  // For complex items (e.g., registrations with multiple components)
  subItems?: OrderItem[];
}

// Extension example for event tickets
interface TicketOrderItem extends OrderItem {
  type: 'ticket';
  attributes: {
    eventId: ObjectId;
    ticketType: string;
    seatNumber?: string;
    attendeeName?: string;
    transferable: boolean;
    validFrom: Date;
    validTo: Date;
  };
}
```

### Relationship Modeling

```typescript
// Customer relationship with denormalization
interface CustomerReference {
  id: ObjectId;
  type: 'individual' | 'organization' | 'lodge';
  
  // Denormalized fields for performance and history
  snapshot: {
    name: string;
    email: string;
    phone?: string;
    // Type-specific fields
    organizationName?: string;
    lodgeNumber?: string;
    membershipStatus?: string;
    // Captured at order time for historical accuracy
    capturedAt: Date;
  };
}

// Product relationship
interface ProductReference {
  id: ObjectId;
  type: 'event' | 'merchandise' | 'service';
  
  // Denormalized for history
  snapshot: {
    name: string;
    price: number;
    description?: string;
    // Product-specific attributes
    attributes: Record<string, any>;
    capturedAt: Date;
  };
}

// Related orders (for packages, split payments, etc.)
interface RelatedOrder {
  orderId: ObjectId;
  relationship: 'parent' | 'child' | 'sibling' | 'replacement' | 'refund';
  reason?: string;
}
```

### Financial Transaction Linking

```typescript
interface PaymentTransaction {
  id: string; // External payment system ID
  provider: 'stripe' | 'square' | 'paypal' | 'cash' | 'check';
  type: 'charge' | 'refund' | 'partial_refund' | 'adjustment';
  
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  
  processedAt: Date;
  reference: string; // External reference
  
  // Provider-specific data
  providerData: {
    // Stripe
    paymentIntentId?: string;
    chargeId?: string;
    customerId?: string;
    
    // Square
    paymentId?: string;
    locationId?: string;
    
    // Common fields
    receiptUrl?: string;
    last4?: string;
    brand?: string;
  };
  
  metadata: Record<string, any>;
}

// Order-Payment relationship
interface OrderFinancial {
  currency: string;
  
  // Amounts
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  
  // Payment tracking
  totalPaid: number;
  balance: number;
  
  // Transaction history
  transactions: PaymentTransaction[];
  
  // Payment status
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'overpaid' | 'refunded';
  
  // Refund tracking
  refunds: {
    amount: number;
    reason: string;
    processedAt: Date;
    transactionId: string;
  }[];
}
```

### Audit Trail Integration

```typescript
interface AuditLog {
  orderId: ObjectId;
  timestamp: Date;
  
  // Action details
  action: string; // e.g., 'create', 'update', 'status_change', 'payment_received'
  category: 'system' | 'user' | 'automation' | 'integration';
  
  // Actor information
  actor: {
    id: ObjectId;
    type: 'user' | 'system' | 'api' | 'integration';
    name: string;
    ipAddress?: string;
    userAgent?: string;
  };
  
  // Change details
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  
  // Context
  context: {
    reason?: string;
    source?: string; // e.g., 'admin_panel', 'api', 'webhook'
    requestId?: string;
    sessionId?: string;
  };
  
  // Searchable metadata
  tags: string[];
  metadata: Record<string, any>;
}

// Audit trail queries
const auditQueries = {
  // Get complete order history
  getOrderHistory: (orderId: ObjectId) => ({
    orderId,
    $sort: { timestamp: -1 }
  }),
  
  // Get financial changes only
  getFinancialHistory: (orderId: ObjectId) => ({
    orderId,
    'changes.field': { $regex: /^financial\./ }
  }),
  
  // Get status changes
  getStatusHistory: (orderId: ObjectId) => ({
    orderId,
    action: 'status_change'
  })
};
```

### Reporting Considerations

```typescript
// Materialized view for reporting
interface OrderReportingView {
  _id: ObjectId;
  
  // Denormalized fields for fast queries
  orderNumber: string;
  orderType: OrderType;
  status: OrderStatus;
  
  // Date dimensions
  createdDate: Date;
  createdYear: number;
  createdMonth: number;
  createdWeek: number;
  completedDate?: Date;
  
  // Financial dimensions
  currency: string;
  totalAmount: number;
  paidAmount: number;
  refundedAmount: number;
  netAmount: number;
  
  // Customer dimensions
  customerId: ObjectId;
  customerType: string;
  customerSegment?: string;
  
  // Event dimensions
  eventId?: ObjectId;
  eventName?: string;
  eventDate?: Date;
  
  // Product dimensions
  productCategories: string[];
  itemCount: number;
  
  // Performance metrics
  processingTime?: number; // Time from creation to completion
  paymentTime?: number; // Time from creation to payment
  
  // Tags for filtering
  tags: string[];
}

// Aggregation pipeline for reporting
const reportingPipeline = [
  // Add computed fields
  {
    $addFields: {
      createdYear: { $year: '$createdAt' },
      createdMonth: { $month: '$createdAt' },
      createdWeek: { $week: '$createdAt' },
      netAmount: {
        $subtract: ['$financial.total', '$financial.refunds.amount']
      },
      processingTime: {
        $subtract: ['$completedAt', '$createdAt']
      }
    }
  },
  // Group by dimensions
  {
    $group: {
      _id: {
        year: '$createdYear',
        month: '$createdMonth',
        orderType: '$orderType'
      },
      count: { $sum: 1 },
      totalRevenue: { $sum: '$financial.total' },
      avgOrderValue: { $avg: '$financial.total' }
    }
  }
];
```

### Migration Strategies

```typescript
// Migration from existing schemas
interface MigrationStrategy {
  // 1. Parallel Run Strategy
  parallelRun: {
    // Keep both old and new schemas active
    duration: '3 months';
    approach: 'dual-write';
    rollback: 'immediate';
  };
  
  // 2. Phased Migration
  phases: [
    {
      phase: 1,
      description: 'Migrate read operations',
      duration: '2 weeks',
      rollback: 'switch reads back to old schema'
    },
    {
      phase: 2,
      description: 'Migrate write operations for new orders',
      duration: '4 weeks',
      rollback: 'disable new schema writes'
    },
    {
      phase: 3,
      description: 'Batch migrate historical data',
      duration: '2 weeks',
      rollback: 'restore from backup'
    },
    {
      phase: 4,
      description: 'Decommission old schema',
      duration: '1 week',
      rollback: 'reactivate old schema'
    }
  ];
}

// Migration script example
async function migrateToSuperordinateSchema() {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // 1. Create new orders from registrations
    const registrations = await Registration.find({}).session(session);
    
    for (const reg of registrations) {
      const order: BaseOrder = {
        _id: new ObjectId(),
        orderNumber: reg.invoiceNumber || generateOrderNumber(),
        orderType: OrderType.REGISTRATION,
        status: mapRegistrationStatus(reg.status),
        
        customer: {
          id: reg.userId,
          type: reg.isLodgeRegistration ? 'lodge' : 'individual',
          name: reg.contactInfo.name,
          email: reg.contactInfo.email
        },
        
        financial: {
          currency: 'USD',
          subtotal: reg.totalAmount,
          tax: 0,
          discounts: [],
          total: reg.totalAmount,
          paid: reg.paymentStatus === 'paid' ? reg.totalAmount : 0,
          balance: reg.paymentStatus === 'paid' ? 0 : reg.totalAmount,
          paymentStatus: mapPaymentStatus(reg.paymentStatus)
        },
        
        typeSpecificData: {
          registrationType: reg.isLodgeRegistration ? 'lodge' : 'individual',
          attendees: reg.attendees || [reg.contactInfo],
          dietaryRestrictions: reg.dietaryRestrictions
        },
        
        createdAt: reg.createdAt,
        updatedAt: reg.updatedAt,
        metadata: {
          migrated: true,
          originalId: reg._id,
          migratedAt: new Date()
        }
      };
      
      await Order.create([order], { session });
    }
    
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

## Implementation Examples

### 1. Creating a Registration Order

```typescript
async function createRegistrationOrder(data: RegistrationRequest): Promise<RegistrationOrder> {
  const order: RegistrationOrder = {
    _id: new ObjectId(),
    orderNumber: generateOrderNumber('REG'),
    orderType: OrderType.REGISTRATION,
    status: OrderStatus.PENDING,
    
    customer: {
      id: data.customerId,
      type: data.isLodge ? 'lodge' : 'individual',
      name: data.contactName,
      email: data.contactEmail,
      snapshotData: await captureCustomerSnapshot(data.customerId)
    },
    
    event: {
      id: data.eventId,
      name: data.eventName,
      date: data.eventDate,
      location: data.eventLocation
    },
    
    items: data.tickets.map(ticket => ({
      id: generateItemId(),
      type: 'ticket',
      productId: ticket.ticketTypeId,
      name: ticket.ticketTypeName,
      unitPrice: ticket.price,
      quantity: ticket.quantity,
      total: ticket.price * ticket.quantity,
      attributes: {
        attendeeName: ticket.attendeeName,
        mealPreference: ticket.mealPreference
      }
    })),
    
    financial: calculateOrderFinancials(data),
    
    typeSpecificData: {
      registrationType: data.isLodge ? 'lodge' : 'individual',
      attendees: data.attendees,
      dietaryRestrictions: data.dietaryRestrictions,
      specialRequests: data.specialRequests
    },
    
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: {
      userId: data.userId,
      userType: 'customer'
    },
    
    statusHistory: [{
      fromStatus: null,
      toStatus: OrderStatus.PENDING,
      timestamp: new Date(),
      userId: data.userId
    }],
    
    metadata: {},
    tags: ['registration', data.eventName],
    relatedOrders: []
  };
  
  return await Order.create(order);
}
```

### 2. Processing Payment

```typescript
async function processOrderPayment(
  orderId: ObjectId,
  payment: PaymentData
): Promise<BaseOrder> {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const order = await Order.findById(orderId).session(session);
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Validate state transition
    if (!canTransitionTo(order.status, OrderStatus.PROCESSING)) {
      throw new Error(`Cannot process payment in status ${order.status}`);
    }
    
    // Add payment transaction
    const transaction: PaymentTransaction = {
      id: payment.transactionId,
      provider: payment.provider,
      type: 'charge',
      amount: payment.amount,
      currency: payment.currency,
      status: 'completed',
      processedAt: new Date(),
      reference: payment.reference,
      providerData: payment.providerData,
      metadata: payment.metadata
    };
    
    order.financial.transactions.push(transaction);
    order.financial.totalPaid += payment.amount;
    order.financial.balance = order.financial.total - order.financial.totalPaid;
    
    // Update payment status
    if (order.financial.balance <= 0) {
      order.financial.paymentStatus = 'paid';
      order.status = OrderStatus.COMPLETED;
      order.completedAt = new Date();
    } else if (order.financial.totalPaid > 0) {
      order.financial.paymentStatus = 'partial';
      order.status = OrderStatus.PARTIALLY_PAID;
    }
    
    // Add status history
    order.statusHistory.push({
      fromStatus: order.status,
      toStatus: order.status,
      timestamp: new Date(),
      reason: 'Payment processed',
      userId: payment.processedBy,
      metadata: { transactionId: transaction.id }
    });
    
    await order.save({ session });
    
    // Create audit log
    await AuditLog.create([{
      orderId: order._id,
      timestamp: new Date(),
      action: 'payment_received',
      category: 'system',
      actor: {
        id: payment.processedBy,
        type: 'system',
        name: 'Payment Processor'
      },
      changes: [{
        field: 'financial.totalPaid',
        oldValue: order.financial.totalPaid - payment.amount,
        newValue: order.financial.totalPaid
      }],
      context: {
        source: payment.source,
        requestId: payment.requestId
      }
    }], { session });
    
    await session.commitTransaction();
    return order;
    
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### 3. Querying Orders

```typescript
// Type-safe query builder
class OrderQueryBuilder {
  private pipeline: any[] = [];
  
  constructor(private orderType?: OrderType) {
    if (orderType) {
      this.pipeline.push({ $match: { orderType } });
    }
  }
  
  // Filter by status
  withStatus(status: OrderStatus | OrderStatus[]) {
    const statuses = Array.isArray(status) ? status : [status];
    this.pipeline.push({ $match: { status: { $in: statuses } } });
    return this;
  }
  
  // Filter by date range
  createdBetween(startDate: Date, endDate: Date) {
    this.pipeline.push({
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    });
    return this;
  }
  
  // Filter by customer
  forCustomer(customerId: ObjectId) {
    this.pipeline.push({ $match: { 'customer.id': customerId } });
    return this;
  }
  
  // Include related data
  includePayments() {
    this.pipeline.push({
      $lookup: {
        from: 'payments',
        localField: 'financial.transactions.id',
        foreignField: 'transactionId',
        as: 'payments'
      }
    });
    return this;
  }
  
  // Execute query
  async execute(): Promise<BaseOrder[]> {
    return await Order.aggregate(this.pipeline);
  }
}

// Usage examples
const registrationOrders = await new OrderQueryBuilder(OrderType.REGISTRATION)
  .withStatus([OrderStatus.COMPLETED, OrderStatus.PARTIALLY_PAID])
  .createdBetween(startOfMonth, endOfMonth)
  .includePayments()
  .execute();
```

## Best Practices

1. **Always use transactions** for operations that modify multiple documents
2. **Validate state transitions** before making changes
3. **Maintain audit trails** for all significant changes
4. **Use indexes** on frequently queried fields (orderNumber, orderType, status, customer.id)
5. **Implement proper error handling** with rollback capabilities
6. **Use TypeScript** for type safety and better developer experience
7. **Create materialized views** for complex reporting queries
8. **Implement caching** for frequently accessed data
9. **Use event sourcing** for critical financial operations
10. **Regular backups** before any migration operations

## Conclusion

This superordinate order schema provides a flexible, extensible foundation for handling multiple order types while maintaining consistency and performance. The polymorphic design allows for easy addition of new order types, while the comprehensive audit trail and financial tracking ensure data integrity and compliance requirements are met.