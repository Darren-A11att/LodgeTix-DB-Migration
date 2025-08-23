/**
 * E-Commerce Schema for Event Registration System
 * Transforms registration model to proper e-commerce structure
 */

import { ObjectId } from 'mongodb';

// ============================================================================
// CUSTOMER SCHEMA
// ============================================================================

export type CustomerType = 'person' | 'organisation';

export interface Customer {
  customerId: string; // UUID v4 - anonymous or actual customer ID
  name: string; // 'guest' for anonymous, actual name for logged in
  type: CustomerType; // person or organisation
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  suburb?: string;
  state?: string;
  postCode?: string;
  country?: string;
  businessName?: string;
  businessNumber?: string; // ABN/ACN for Australian businesses
}

// ============================================================================
// PRODUCT SCHEMA
// ============================================================================

export type ProductType = 'bundle' | 'product' | 'multiPart';
export type ProductStatus = 'available' | 'sold_out' | 'closed';
export type RegistrationType = 'individual' | 'lodge' | 'grandLodge' | 'masonicOrder';
export type AttendeeType = 'mason' | 'partner' | 'guest';

export interface ProductOption {
  name: string;
  values: string[];
  required: boolean;
}

export interface ProductVariant {
  variantId: string;
  sku: string;
  name: string;
  price: number;
  options: Record<string, string>; // option name -> selected value
  inventoryItemId?: string;
  defaultQuantity?: number;
  customObject?: {
    registrationForm?: string; // Form ID for this variant
    [key: string]: any;
  };
  status: ProductStatus;
  stock?: {
    available: number;
    reserved: number;
    sold: number;
  };
}

export interface BundledProduct {
  productId: string;
  isOptional: boolean;
  quantity: number;
  displayName?: string;
}

export interface Product {
  _id?: ObjectId;
  productId: string;
  name: string;
  description?: string;
  type: ProductType;
  status: ProductStatus;
  display: boolean;
  price?: number; // Base price, variants may override
  
  // Options and Variants
  options: ProductOption[];
  variants: ProductVariant[];
  
  // For bundle type products
  bundledProducts?: BundledProduct[];
  
  // For mapping to existing system
  sourceId?: string; // Original functionId, eventId, or packageId
  sourceType?: 'function' | 'event' | 'package';
  
  // Metadata
  imageUrl?: string;
  tags?: string[];
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CART SCHEMA
// ============================================================================

export type CartStatus = 'active' | 'abandoned' | 'converted' | 'expired';

export interface CartItem {
  cartItemId: string;
  productId: string;
  variantId: string;
  quantity: number;
  price: number;
  subtotal: number;
  
  // For bundled products
  parentItemId?: string; // If this item is part of a bundle
  bundleDiscount?: number;
  
  // Form data - flexible metadata object for form values
  // For migrations: contains attendee details (individual) or lodge details (lodge/grandLodge/masonicOrder)
  // For new registrations: will contain form submission data
  formData?: {
    [key: string]: any; // Flexible structure to accommodate any form fields
  };
  
  // Custom data per item
  metadata?: {
    attendeeInfo?: {
      firstName: string;
      lastName: string;
      type: AttendeeType;
      [key: string]: any;
    };
    registrationForm?: Record<string, any>;
    [key: string]: any;
  };
  
  addedAt: Date;
  updatedAt: Date;
}

export interface Cart {
  _id?: ObjectId;
  cartId: string;
  customerId: string;
  sessionId?: string; // For guest checkouts
  status: CartStatus;
  
  // Customer details
  customer: Customer;
  
  // Items
  cartItems: CartItem[];
  
  // Pricing
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  currency: string;
  
  // Metadata
  source?: 'web' | 'admin' | 'api';
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  convertedAt?: Date; // When converted to order
}

// ============================================================================
// ORDER SCHEMA
// ============================================================================

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';

export interface OrderItem {
  orderItemId: string;
  productId: string;
  variantId: string;
  quantity: number;
  price: number;
  subtotal: number;
  
  // For bundled products
  parentItemId?: string;
  bundleDiscount?: number;
  
  // Fulfillment
  status: 'pending' | 'fulfilled' | 'cancelled';
  fulfilledAt?: Date;
  
  // Attendee/Registration data
  attendeeId?: string;
  ticketId?: string;
  
  // Preserved metadata from cart
  metadata?: Record<string, any>;
}

// Use Customer interface instead of OrderCustomer

export interface OrderPayment {
  paymentId: string;
  method: 'stripe' | 'square' | 'manual' | 'other';
  status: PaymentStatus;
  amount: number;
  transactionId?: string;
  processedAt?: Date;
  processor?: {
    stripe?: {
      paymentIntentId: string;
      chargeId?: string;
    };
    square?: {
      paymentId: string;
      orderId?: string;
    };
  };
}

export interface Order {
  _id?: ObjectId;
  orderId: string;
  orderNumber: string; // This becomes the confirmation number
  
  // Source
  cartId: string; // Original cart this came from
  
  // Customer
  customer: Customer;
  
  // Items
  orderItems: OrderItem[];
  
  // Pricing
  subtotal: number;
  tax: number;
  discount: number;
  shipping: number;
  total: number;
  currency: string;
  
  // Payment
  payment: OrderPayment;
  
  // Status
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: 'unfulfilled' | 'partial' | 'fulfilled';
  
  // Metadata
  source?: 'web' | 'admin' | 'api' | 'migration';
  notes?: string;
  internalNotes?: string;
  tags?: string[];
  
  // Original registration data (for migration)
  originalRegistrationId?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

// ============================================================================
// INVENTORY SCHEMA
// ============================================================================

export interface Inventory {
  _id?: ObjectId;
  inventoryId: string;
  productId: string;
  variantId: string;
  
  // Stock levels
  total: number;      // Total inventory
  available: number;  // Available for purchase
  reserved: number;   // Reserved in active carts
  sold: number;       // Already sold
  
  // Thresholds
  lowStockThreshold?: number;
  outOfStockThreshold?: number;
  
  // Tracking
  lastRestocked?: Date;
  lastSold?: Date;
  
  // For event tickets
  eventId?: string;
  ticketType?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// REGISTRATION FORM MAPPING
// ============================================================================

export interface RegistrationFormMapping {
  _id?: ObjectId;
  formId: string;
  variantId: string;
  registrationType: RegistrationType;
  attendeeType: AttendeeType;
  
  // Form configuration
  fields: {
    fieldName: string;
    fieldType: string;
    required: boolean;
    validation?: Record<string, any>;
  }[];
  
  // UI configuration
  formTitle: string;
  formDescription?: string;
  submitButtonText?: string;
  
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// MIGRATION TRACKING
// ============================================================================

export interface MigrationLog {
  _id?: ObjectId;
  migrationId: string;
  sourceCollection: string;
  targetCollection: string;
  sourceId: string;
  targetId: string;
  migrationType: 'registration_to_cart' | 'cart_to_order' | 'event_to_product' | 'ticket_to_inventory';
  status: 'success' | 'failed' | 'partial';
  details?: Record<string, any>;
  errors?: string[];
  createdAt: Date;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface PriceCalculation {
  basePrice: number;
  quantity: number;
  subtotal: number;
  discounts: {
    type: string;
    amount: number;
    reason?: string;
  }[];
  tax: number;
  total: number;
}

export interface StockMovement {
  _id?: ObjectId;
  movementId: string;
  inventoryId: string;
  type: 'restock' | 'sale' | 'reserve' | 'release' | 'adjustment';
  quantity: number; // Positive for additions, negative for removals
  previousAvailable: number;
  newAvailable: number;
  reason?: string;
  referenceId?: string; // orderId, cartId, etc.
  createdAt: Date;
  createdBy?: string;
}

// ============================================================================
// VARIANT GENERATION HELPERS
// ============================================================================

export function generateVariantSKU(productId: string, options: Record<string, string>): string {
  const optionString = Object.entries(options)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_, value]) => value.substring(0, 3).toUpperCase())
    .join('-');
  return `${productId}-${optionString}`;
}

export function generateVariantName(baseName: string, options: Record<string, string>): string {
  const optionString = Object.entries(options)
    .map(([key, value]) => `${value}`)
    .join(' - ');
  return `${baseName} (${optionString})`;
}

export function generateAllVariants(product: Product): ProductVariant[] {
  const variants: ProductVariant[] = [];
  
  if (product.options.length === 0) {
    // Single variant product
    return [{
      variantId: `${product.productId}-default`,
      sku: `${product.productId}-DEFAULT`,
      name: product.name,
      price: product.price || 0,
      options: {},
      status: product.status,
      defaultQuantity: 1
    }];
  }
  
  // Generate all combinations
  const optionValues = product.options.map(opt => opt.values);
  const combinations = cartesianProduct(...optionValues);
  
  combinations.forEach((combination, index) => {
    const optionMap: Record<string, string> = {};
    product.options.forEach((opt, i) => {
      optionMap[opt.name] = combination[i];
    });
    
    variants.push({
      variantId: `${product.productId}-${index + 1}`,
      sku: generateVariantSKU(product.productId, optionMap),
      name: generateVariantName(product.name, optionMap),
      price: product.price || 0,
      options: optionMap,
      status: product.status,
      defaultQuantity: 1
    });
  });
  
  return variants;
}

function cartesianProduct<T>(...arrays: T[][]): T[][] {
  return arrays.reduce((acc, array) => {
    return acc.flatMap(x => array.map(y => [...x, y]));
  }, [[]] as T[][]);
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateCart(cart: Cart): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!cart.cartId) errors.push('Cart ID is required');
  if (!cart.customerId && !cart.sessionId) errors.push('Either customerId or sessionId is required');
  if (cart.cartItems.length === 0) errors.push('Cart must have at least one item');
  
  // Validate pricing
  const calculatedSubtotal = cart.cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  if (Math.abs(calculatedSubtotal - cart.subtotal) > 0.01) {
    errors.push(`Subtotal mismatch: calculated ${calculatedSubtotal}, stored ${cart.subtotal}`);
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateOrder(order: Order): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!order.orderId) errors.push('Order ID is required');
  if (!order.orderNumber) errors.push('Order number is required');
  if (!order.customer?.customerId) errors.push('Customer ID is required');
  if (!order.customer?.email) errors.push('Customer email is required');
  if (order.orderItems.length === 0) errors.push('Order must have at least one item');
  
  // Validate payment
  if (order.paymentStatus === 'paid' && !order.payment?.transactionId) {
    errors.push('Paid orders must have a transaction ID');
  }
  
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// EXPORT ALL SCHEMAS
// ============================================================================

export default {
  generateVariantSKU,
  generateVariantName,
  generateAllVariants,
  validateCart,
  validateOrder
};