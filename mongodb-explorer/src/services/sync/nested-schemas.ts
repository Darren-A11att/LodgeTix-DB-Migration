/**
 * Database Schemas and TypeScript Interfaces for Restructured Collections
 * 
 * This file defines the database schemas for the restructured contact, customer, 
 * and orders collections with proper TypeScript interfaces and index definitions.
 */

import { ObjectId } from 'mongodb';

// ================================
// NESTED STRUCTURES AND INTERFACES
// ================================

/**
 * Tax calculation interface for GST calculations
 */
export interface TaxCalculation {
  subtotal: number;
  fees: number;
  gstRate: number; // Default: 0.10 (10%)
  gstAmount: number;
  totalAmount: number;
  isGstInclusive: boolean; // Default: true
}

/**
 * Address interface for billing and contact information
 */
export interface Address {
  street?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

/**
 * Individual ticket within a registration
 */
export interface RegistrationTicket {
  ticketId: ObjectId;
  ticketType: string;
  ticketName: string;
  price: number;
  quantity: number;
  attendeeId?: ObjectId;
  attendeeName?: string;
  specialRequirements?: string;
  seatingPreference?: string;
}

/**
 * Individual attendee for a function
 */
export interface FunctionAttendee {
  attendeeId: ObjectId;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dietaryRequirements?: string;
  accessibilityNeeds?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  tickets: RegistrationTicket[];
}

/**
 * Single registration for a function
 */
export interface FunctionRegistration {
  registrationId: ObjectId;
  orderId?: string; // UUIDv4 reference to orders collection
  orderObjectId?: ObjectId; // MongoDB ObjectId reference to orders collection
  registrationDate: Date;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  totalAmount: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'refunded';
  paymentMethod?: 'card' | 'bank_transfer' | 'cash' | 'cheque';
  notes?: string;
  attendees: FunctionAttendee[];
  tickets: RegistrationTicket[];
  specialRequests?: string;
  tablePreference?: string;
}

/**
 * Function details within registeredFunctions
 */
export interface RegisteredFunction {
  functionId: ObjectId;
  functionName: string;
  functionDate: Date;
  venue?: string;
  description?: string;
  registrations: FunctionRegistration[];
  attendees: FunctionAttendee[];
  tickets: RegistrationTicket[];
  totalRegistrations: number;
  totalAttendees: number;
  totalRevenue: number;
}

// ================================
// MAIN COLLECTION INTERFACES
// ================================

/**
 * Contact schema with nested registeredFunctions structure
 */
export interface Contact {
  _id: ObjectId;
  contactId?: string; // External ID if needed
  
  // Personal Information
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  
  // Address Information
  address?: Address;
  
  // Lodge/Organization Information
  lodgeId?: ObjectId;
  lodgeName?: string;
  grandLodgeId?: ObjectId;
  grandLodgeName?: string;
  membershipNumber?: string;
  membershipStatus?: 'active' | 'inactive' | 'suspended' | 'honorary';
  
  // Function Participation
  registeredFunctions: RegisteredFunction[];
  hostedFunctions: Record<string, any>; // Empty object for now, will be defined later
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastActivityDate?: Date;
  source?: string; // 'import', 'manual', 'registration'
  notes?: string;
  
  // Sync Information
  syncStatus?: 'pending' | 'synced' | 'error';
  lastSyncDate?: Date;
  externalIds?: {
    lodgetixId?: string;
    stripeCustomerId?: string;
    squareCustomerId?: string;
  };
}

/**
 * Order item interface for detailed order tracking
 */
export interface OrderItem {
  itemId: ObjectId;
  productId?: ObjectId;
  ticketId?: ObjectId;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: 'ticket' | 'merchandise' | 'donation' | 'fee';
  metadata?: Record<string, any>;
}

/**
 * Orders collection schema with full order details
 */
export interface Order {
  _id: ObjectId;
  orderId: string; // UUIDv4 unique identifier
  
  // Customer Information
  customerId?: ObjectId;
  contactId?: ObjectId;
  
  // Billing Information
  billTo: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: Address;
    company?: string;
  };
  
  // Order Details
  orderedItems: OrderItem[];
  
  // Financial Calculations
  subtotal: number;
  fees: number;
  taxCalculation: TaxCalculation;
  totalAmount: number;
  
  // Payment Information
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'refunded' | 'cancelled';
  paymentMethod?: 'card' | 'bank_transfer' | 'cash' | 'cheque';
  paymentGateway?: 'stripe' | 'square' | 'manual';
  paymentReference?: string;
  paidAmount: number;
  paidDate?: Date;
  
  // Order Status
  status: 'draft' | 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
  orderDate: Date;
  completedDate?: Date;
  
  // Function/Event Information
  functionId?: ObjectId;
  functionName?: string;
  functionDate?: Date;
  
  // Additional Information
  notes?: string;
  internalNotes?: string;
  cancellationReason?: string;
  refundAmount?: number;
  refundDate?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  
  // Sync Information
  syncStatus?: 'pending' | 'synced' | 'error';
  lastSyncDate?: Date;
  externalIds?: {
    lodgetixOrderId?: string;
    stripePaymentIntentId?: string;
    squareOrderId?: string;
  };
}

/**
 * Order reference for customer collection
 */
export interface OrderReference {
  orderObjectId: ObjectId; // MongoDB ObjectId reference
  orderId: string; // UUIDv4 for easy lookup
  orderDate: Date;
  totalAmount: number;
  status: string;
  functionName?: string;
}

/**
 * Customer schema with order references only
 */
export interface Customer {
  _id: ObjectId;
  customerId?: string; // External ID if needed
  
  // Customer Information
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  
  // Address Information
  billingAddress?: Address;
  shippingAddress?: Address;
  
  // Order References (lightweight)
  orders: OrderReference[];
  
  // Customer Metrics
  totalOrders: number;
  totalSpent: number;
  firstOrderDate?: Date;
  lastOrderDate?: Date;
  
  // Customer Status
  status: 'active' | 'inactive' | 'blocked';
  customerType?: 'individual' | 'organization';
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
  
  // Sync Information
  syncStatus?: 'pending' | 'synced' | 'error';
  lastSyncDate?: Date;
  externalIds?: {
    lodgetixCustomerId?: string;
    contactId?: ObjectId;
  };
}

// ================================
// HELPER FUNCTIONS
// ================================

/**
 * Calculate GST tax (10% inclusive by default)
 * Formula: GST Amount = (Subtotal + Fees) / 11 for inclusive GST
 * Formula: GST Amount = (Subtotal + Fees) * 0.10 for exclusive GST
 */
export function calculateTax(
  subtotal: number, 
  fees: number = 0, 
  gstRate: number = 0.10, 
  isInclusive: boolean = true
): TaxCalculation {
  const baseAmount = subtotal + fees;
  
  let gstAmount: number;
  let totalAmount: number;
  
  if (isInclusive) {
    // GST is included in the price
    gstAmount = baseAmount / (1 + gstRate) * gstRate;
    totalAmount = baseAmount;
  } else {
    // GST is added to the price
    gstAmount = baseAmount * gstRate;
    totalAmount = baseAmount + gstAmount;
  }
  
  return {
    subtotal,
    fees,
    gstRate,
    gstAmount: Math.round(gstAmount * 100) / 100, // Round to 2 decimal places
    totalAmount: Math.round(totalAmount * 100) / 100,
    isGstInclusive: isInclusive
  };
}

/**
 * Generate UUIDv4 for order IDs
 */
export function generateOrderId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Create order reference from full order
 */
export function createOrderReference(order: Order): OrderReference {
  return {
    orderObjectId: order._id,
    orderId: order.orderId,
    orderDate: order.orderDate,
    totalAmount: order.totalAmount,
    status: order.status,
    functionName: order.functionName
  };
}

// ================================
// INDEX DEFINITIONS
// ================================

/**
 * MongoDB index definitions for all collections
 */
export const IndexDefinitions = {
  contacts: [
    // Primary indexes
    { contactId: 1 },
    { email: 1 },
    { firstName: 1, lastName: 1 },
    
    // Function-related indexes
    { 'registeredFunctions.functionId': 1 },
    { 'registeredFunctions.registrations.registrationId': 1 },
    { 'registeredFunctions.registrations.orderId': 1 },
    { 'registeredFunctions.registrations.orderObjectId': 1 },
    { 'registeredFunctions.attendees.attendeeId': 1 },
    { 'registeredFunctions.tickets.ticketId': 1 },
    
    // Lodge-related indexes
    { lodgeId: 1 },
    { grandLodgeId: 1 },
    { membershipNumber: 1 },
    
    // External ID indexes
    { 'externalIds.lodgetixId': 1 },
    { 'externalIds.stripeCustomerId': 1 },
    { 'externalIds.squareCustomerId': 1 },
    
    // Date indexes
    { createdAt: 1 },
    { updatedAt: 1 },
    { lastActivityDate: 1 }
  ],
  
  orders: [
    // Primary indexes
    { orderId: 1 }, // Unique UUIDv4
    { customerId: 1 },
    { contactId: 1 },
    
    // Order item indexes
    { 'orderedItems.itemId': 1 },
    { 'orderedItems.productId': 1 },
    { 'orderedItems.ticketId': 1 },
    
    // Function-related indexes
    { functionId: 1 },
    
    // Payment indexes
    { paymentStatus: 1 },
    { paymentReference: 1 },
    
    // External ID indexes
    { 'externalIds.lodgetixOrderId': 1 },
    { 'externalIds.stripePaymentIntentId': 1 },
    { 'externalIds.squareOrderId': 1 },
    
    // Date indexes
    { orderDate: 1 },
    { createdAt: 1 },
    { updatedAt: 1 },
    
    // Compound indexes
    { status: 1, orderDate: -1 },
    { customerId: 1, orderDate: -1 },
    { functionId: 1, orderDate: -1 }
  ],
  
  customers: [
    // Primary indexes
    { customerId: 1 },
    { email: 1 },
    { firstName: 1, lastName: 1 },
    
    // Order reference indexes
    { 'orders.orderObjectId': 1 },
    { 'orders.orderId': 1 },
    
    // External ID indexes
    { 'externalIds.lodgetixCustomerId': 1 },
    { 'externalIds.contactId': 1 },
    
    // Date indexes
    { createdAt: 1 },
    { updatedAt: 1 },
    { firstOrderDate: 1 },
    { lastOrderDate: 1 },
    
    // Status indexes
    { status: 1 },
    { customerType: 1 }
  ]
};

/**
 * MongoDB index creation commands
 */
export const CreateIndexCommands = {
  contacts: IndexDefinitions.contacts.map(index => ({ 
    createIndex: index, 
    background: true 
  })),
  
  orders: IndexDefinitions.orders.map(index => ({ 
    createIndex: index, 
    background: true 
  })),
  
  customers: IndexDefinitions.customers.map(index => ({ 
    createIndex: index, 
    background: true 
  }))
};

// ================================
// VALIDATION SCHEMAS
// ================================

/**
 * Validation helper functions
 */
export const ValidationHelpers = {
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  isValidPhone: (phone: string): boolean => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  },
  
  isValidOrderId: (orderId: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(orderId);
  },
  
  isValidObjectId: (id: string): boolean => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
};

/**
 * Default values for new documents
 */
export const DefaultValues = {
  contact: {
    registeredFunctions: [],
    hostedFunctions: {},
    createdAt: () => new Date(),
    updatedAt: () => new Date(),
    syncStatus: 'pending' as const
  },
  
  order: {
    orderId: generateOrderId,
    status: 'draft' as const,
    paymentStatus: 'unpaid' as const,
    paidAmount: 0,
    createdAt: () => new Date(),
    updatedAt: () => new Date(),
    syncStatus: 'pending' as const
  },
  
  customer: {
    orders: [],
    totalOrders: 0,
    totalSpent: 0,
    status: 'active' as const,
    customerType: 'individual' as const,
    createdAt: () => new Date(),
    updatedAt: () => new Date(),
    syncStatus: 'pending' as const
  }
};

// All exports are already done inline above, no need for additional export statement