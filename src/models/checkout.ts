import { v4 as uuidv4 } from 'uuid';
import { Db, Collection } from 'mongodb';

// Checkout Schema Type Definitions
export type CheckoutStatus = 'started' | 'abandoned' | 'failed' | 'completed';
export type CustomerType = 'person' | 'business';
export type PaymentProvider = 'stripe' | 'square' | 'paypal' | string;

export interface Customer {
  customerId: string; // UUID v4
  type: CustomerType;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  suburb: string;
  state: string;
  postCode: string;
  country: string;
  businessName?: string;
  businessNumber?: string;
}

export interface PaymentFees {
  platformFee: number;
  merchantFee: number;
  totalFees: number;
}

export interface PaymentIntent {
  id: string;
  provider: PaymentProvider;
  data: any[];
  status: string;
  subtotal: number;
  fees: PaymentFees;
  totalAmount: number;
}

export interface Checkout {
  checkoutId: string; // UUID v4
  status: CheckoutStatus;
  createdAt: Date;
  lastModifiedAt: Date;
  customer: Customer;
  supplierId: string;
  cartId: string; // UUID v4 of the cart
  paymentIntent: PaymentIntent;
}

// Validation functions
export function validateCheckout(checkout: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!checkout.checkoutId || typeof checkout.checkoutId !== 'string') {
    errors.push('checkoutId is required and must be a string');
  } else if (!isValidUUID(checkout.checkoutId)) {
    errors.push('checkoutId must be a valid UUID v4');
  }

  // Validate status enum
  const validStatuses: CheckoutStatus[] = ['started', 'abandoned', 'failed', 'completed'];
  if (!checkout.status || !validStatuses.includes(checkout.status)) {
    errors.push(`status is required and must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate timestamps
  if (!checkout.createdAt || !(checkout.createdAt instanceof Date)) {
    errors.push('createdAt is required and must be a Date');
  }

  if (!checkout.lastModifiedAt || !(checkout.lastModifiedAt instanceof Date)) {
    errors.push('lastModifiedAt is required and must be a Date');
  }

  // Validate supplierId
  if (!checkout.supplierId || typeof checkout.supplierId !== 'string') {
    errors.push('supplierId is required and must be a string');
  }

  // Validate cartId
  if (!checkout.cartId || typeof checkout.cartId !== 'string') {
    errors.push('cartId is required and must be a string');
  } else if (!isValidUUID(checkout.cartId)) {
    errors.push('cartId must be a valid UUID v4');
  }

  // Validate customer
  if (!checkout.customer || typeof checkout.customer !== 'object') {
    errors.push('customer is required and must be an object');
  } else {
    const customer = checkout.customer;
    
    // Validate customerId
    if (!customer.customerId || typeof customer.customerId !== 'string') {
      errors.push('customer.customerId is required and must be a string');
    } else if (!isValidUUID(customer.customerId)) {
      errors.push('customer.customerId must be a valid UUID v4');
    }

    // Validate customer type
    const validCustomerTypes: CustomerType[] = ['person', 'business'];
    if (!customer.type || !validCustomerTypes.includes(customer.type)) {
      errors.push(`customer.type is required and must be one of: ${validCustomerTypes.join(', ')}`);
    }

    // Validate required customer fields
    if (!customer.firstName || typeof customer.firstName !== 'string') {
      errors.push('customer.firstName is required and must be a string');
    }

    if (!customer.lastName || typeof customer.lastName !== 'string') {
      errors.push('customer.lastName is required and must be a string');
    }

    if (!customer.phone || typeof customer.phone !== 'string') {
      errors.push('customer.phone is required and must be a string');
    }

    if (!customer.email || typeof customer.email !== 'string') {
      errors.push('customer.email is required and must be a string');
    } else if (!isValidEmail(customer.email)) {
      errors.push('customer.email must be a valid email address');
    }

    if (!customer.addressLine1 || typeof customer.addressLine1 !== 'string') {
      errors.push('customer.addressLine1 is required and must be a string');
    }

    if (!customer.suburb || typeof customer.suburb !== 'string') {
      errors.push('customer.suburb is required and must be a string');
    }

    if (!customer.state || typeof customer.state !== 'string') {
      errors.push('customer.state is required and must be a string');
    }

    if (!customer.postCode || typeof customer.postCode !== 'string') {
      errors.push('customer.postCode is required and must be a string');
    }

    if (!customer.country || typeof customer.country !== 'string') {
      errors.push('customer.country is required and must be a string');
    }

    // Validate business fields if type is business
    if (customer.type === 'business') {
      if (!customer.businessName || typeof customer.businessName !== 'string') {
        errors.push('customer.businessName is required for business customers');
      }
      if (!customer.businessNumber || typeof customer.businessNumber !== 'string') {
        errors.push('customer.businessNumber is required for business customers');
      }
    }
  }

  // Validate paymentIntent
  if (!checkout.paymentIntent || typeof checkout.paymentIntent !== 'object') {
    errors.push('paymentIntent is required and must be an object');
  } else {
    const payment = checkout.paymentIntent;
    
    if (!payment.id || typeof payment.id !== 'string') {
      errors.push('paymentIntent.id is required and must be a string');
    }

    if (!payment.provider || typeof payment.provider !== 'string') {
      errors.push('paymentIntent.provider is required and must be a string');
    }

    if (!Array.isArray(payment.data)) {
      errors.push('paymentIntent.data must be an array');
    }

    if (!payment.status || typeof payment.status !== 'string') {
      errors.push('paymentIntent.status is required and must be a string');
    }

    if (typeof payment.subtotal !== 'number' || payment.subtotal < 0) {
      errors.push('paymentIntent.subtotal must be a non-negative number');
    }

    if (typeof payment.totalAmount !== 'number' || payment.totalAmount < 0) {
      errors.push('paymentIntent.totalAmount must be a non-negative number');
    }

    // Validate fees
    if (!payment.fees || typeof payment.fees !== 'object') {
      errors.push('paymentIntent.fees is required and must be an object');
    } else {
      if (typeof payment.fees.platformFee !== 'number' || payment.fees.platformFee < 0) {
        errors.push('paymentIntent.fees.platformFee must be a non-negative number');
      }
      if (typeof payment.fees.merchantFee !== 'number' || payment.fees.merchantFee < 0) {
        errors.push('paymentIntent.fees.merchantFee must be a non-negative number');
      }
      if (typeof payment.fees.totalFees !== 'number' || payment.fees.totalFees < 0) {
        errors.push('paymentIntent.fees.totalFees must be a non-negative number');
      }

      // Validate fee calculation
      const expectedTotal = payment.fees.platformFee + payment.fees.merchantFee;
      if (Math.abs(payment.fees.totalFees - expectedTotal) > 0.01) {
        errors.push(`paymentIntent.fees.totalFees must equal platformFee + merchantFee. Expected ${expectedTotal}, got ${payment.fees.totalFees}`);
      }
    }

    // Validate total amount calculation
    if (payment.fees) {
      const expectedTotal = payment.subtotal + payment.fees.totalFees;
      if (Math.abs(payment.totalAmount - expectedTotal) > 0.01) {
        errors.push(`paymentIntent.totalAmount must equal subtotal + totalFees. Expected ${expectedTotal}, got ${payment.totalAmount}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper functions
export function createCustomer(data: {
  type: CustomerType;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  suburb: string;
  state: string;
  postCode: string;
  country: string;
  businessName?: string;
  businessNumber?: string;
  customerId?: string;
}): Customer {
  const customer: Customer = {
    customerId: data.customerId || uuidv4(),
    type: data.type,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    email: data.email,
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    suburb: data.suburb,
    state: data.state,
    postCode: data.postCode,
    country: data.country
  };

  if (data.type === 'business') {
    customer.businessName = data.businessName;
    customer.businessNumber = data.businessNumber;
  }

  return customer;
}

export function createPaymentIntent(data: {
  id?: string;
  provider: PaymentProvider;
  status: string;
  subtotal: number;
  platformFee: number;
  merchantFee: number;
  data?: any[];
}): PaymentIntent {
  const totalFees = data.platformFee + data.merchantFee;
  const totalAmount = data.subtotal + totalFees;

  return {
    id: data.id || uuidv4(),
    provider: data.provider,
    data: data.data || [],
    status: data.status,
    subtotal: data.subtotal,
    fees: {
      platformFee: data.platformFee,
      merchantFee: data.merchantFee,
      totalFees
    },
    totalAmount
  };
}

export function createCheckout(data: {
  customer: Customer;
  supplierId: string;
  cartId: string;
  paymentIntent: PaymentIntent;
  status?: CheckoutStatus;
}): Checkout {
  const now = new Date();
  const checkout: Checkout = {
    checkoutId: uuidv4(),
    status: data.status || 'started',
    createdAt: now,
    lastModifiedAt: now,
    customer: data.customer,
    supplierId: data.supplierId,
    cartId: data.cartId,
    paymentIntent: data.paymentIntent
  };

  // Validate before returning
  const validation = validateCheckout(checkout);
  if (!validation.valid) {
    throw new Error(`Invalid checkout: ${validation.errors.join(', ')}`);
  }

  return checkout;
}

// Checkout Repository class for database operations
export class CheckoutRepository {
  private collection: Collection<Checkout>;
  private db: Db;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection<Checkout>('checkout');
    this.ensureIndexes();
  }

  private async ensureIndexes() {
    // Create unique index on checkoutId
    await this.collection.createIndex(
      { checkoutId: 1 },
      { unique: true }
    );
    
    // Create other useful indexes
    await this.collection.createIndex({ 'customer.customerId': 1 });
    await this.collection.createIndex({ 'customer.email': 1 });
    await this.collection.createIndex({ supplierId: 1 });
    await this.collection.createIndex({ cartId: 1 });
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ createdAt: -1 });
    await this.collection.createIndex({ 'paymentIntent.id': 1 });
    await this.collection.createIndex({ 'paymentIntent.provider': 1 });
    
    // Compound indexes
    await this.collection.createIndex({ 'customer.customerId': 1, status: 1 });
    await this.collection.createIndex({ supplierId: 1, status: 1 });
  }

  async create(checkoutData: {
    customer: Customer;
    supplierId: string;
    cartId: string;
    paymentIntent: PaymentIntent;
    status?: CheckoutStatus;
  }): Promise<Checkout> {
    const checkout = createCheckout(checkoutData);

    // Validate before inserting
    const validation = validateCheckout(checkout);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid checkout: ${validation.errors.join(', ')}`);
    }

    await this.collection.insertOne(checkout as any);
    return checkout;
  }

  async findByCheckoutId(checkoutId: string): Promise<Checkout | null> {
    return this.collection.findOne({ checkoutId }) as Promise<Checkout | null>;
  }

  async findByCartId(cartId: string): Promise<Checkout | null> {
    return this.collection.findOne({ cartId }) as Promise<Checkout | null>;
  }

  async findByCustomerId(customerId: string): Promise<Checkout[]> {
    return this.collection.find({ 'customer.customerId': customerId })
      .sort({ createdAt: -1 })
      .toArray() as Promise<Checkout[]>;
  }

  async findByEmail(email: string): Promise<Checkout[]> {
    return this.collection.find({ 'customer.email': email })
      .sort({ createdAt: -1 })
      .toArray() as Promise<Checkout[]>;
  }

  async findBySupplierId(supplierId: string): Promise<Checkout[]> {
    return this.collection.find({ supplierId })
      .sort({ createdAt: -1 })
      .toArray() as Promise<Checkout[]>;
  }

  async findByStatus(status: CheckoutStatus): Promise<Checkout[]> {
    return this.collection.find({ status })
      .sort({ createdAt: -1 })
      .toArray() as Promise<Checkout[]>;
  }

  async findByPaymentIntentId(paymentIntentId: string): Promise<Checkout | null> {
    return this.collection.findOne({ 'paymentIntent.id': paymentIntentId }) as Promise<Checkout | null>;
  }

  async updateStatus(checkoutId: string, status: CheckoutStatus): Promise<Checkout | null> {
    const result = await this.collection.findOneAndUpdate(
      { checkoutId },
      { $set: { status, lastModifiedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (result) {
      // Validate the updated checkout
      const validation = validateCheckout(result);
      if (!validation.valid) {
        throw new Error(`Update resulted in invalid checkout: ${validation.errors.join(', ')}`);
      }
    }

    return result as Checkout | null;
  }

  async updatePaymentIntent(checkoutId: string, paymentIntent: PaymentIntent): Promise<Checkout | null> {
    // Validate payment intent calculations
    const totalFees = paymentIntent.fees.platformFee + paymentIntent.fees.merchantFee;
    if (Math.abs(paymentIntent.fees.totalFees - totalFees) > 0.01) {
      throw new Error('Invalid payment intent: totalFees must equal platformFee + merchantFee');
    }

    const totalAmount = paymentIntent.subtotal + paymentIntent.fees.totalFees;
    if (Math.abs(paymentIntent.totalAmount - totalAmount) > 0.01) {
      throw new Error('Invalid payment intent: totalAmount must equal subtotal + totalFees');
    }

    const result = await this.collection.findOneAndUpdate(
      { checkoutId },
      { $set: { paymentIntent, lastModifiedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (result) {
      // Validate the updated checkout
      const validation = validateCheckout(result);
      if (!validation.valid) {
        throw new Error(`Update resulted in invalid checkout: ${validation.errors.join(', ')}`);
      }
    }

    return result as Checkout | null;
  }

  async updateCustomer(checkoutId: string, customer: Customer): Promise<Checkout | null> {
    // Validate business fields if type is business
    if (customer.type === 'business' && (!customer.businessName || !customer.businessNumber)) {
      throw new Error('Business customers must have businessName and businessNumber');
    }

    const result = await this.collection.findOneAndUpdate(
      { checkoutId },
      { $set: { customer, lastModifiedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (result) {
      // Validate the updated checkout
      const validation = validateCheckout(result);
      if (!validation.valid) {
        throw new Error(`Update resulted in invalid checkout: ${validation.errors.join(', ')}`);
      }
    }

    return result as Checkout | null;
  }

  async delete(checkoutId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ checkoutId });
    return result.deletedCount === 1;
  }

  // Analytics methods
  async getCheckoutStats(supplierId?: string): Promise<{
    total: number;
    completed: number;
    abandoned: number;
    failed: number;
    started: number;
    completionRate: number;
    averageValue: number;
  }> {
    const filter = supplierId ? { supplierId } : {};

    const [total, completed, abandoned, failed, started] = await Promise.all([
      this.collection.countDocuments(filter),
      this.collection.countDocuments({ ...filter, status: 'completed' }),
      this.collection.countDocuments({ ...filter, status: 'abandoned' }),
      this.collection.countDocuments({ ...filter, status: 'failed' }),
      this.collection.countDocuments({ ...filter, status: 'started' })
    ]);

    const completedCheckouts = await this.collection.find({ 
      ...filter, 
      status: 'completed' 
    }).toArray();

    const totalValue = completedCheckouts.reduce((sum, c) => sum + c.paymentIntent.totalAmount, 0);
    const averageValue = completed > 0 ? totalValue / completed : 0;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      total,
      completed,
      abandoned,
      failed,
      started,
      completionRate,
      averageValue
    };
  }

  // Abandoned checkout recovery
  async findAbandonedCheckouts(hoursSinceCreation: number = 24): Promise<Checkout[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursSinceCreation);

    return this.collection.find({
      status: 'started',
      createdAt: { $lt: cutoffTime }
    }).toArray() as Promise<Checkout[]>;
  }

  async markAsAbandoned(checkoutId: string): Promise<Checkout | null> {
    return this.updateStatus(checkoutId, 'abandoned');
  }

  async markAbandonedCheckouts(hoursSinceCreation: number = 24): Promise<number> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursSinceCreation);

    const result = await this.collection.updateMany(
      {
        status: 'started',
        createdAt: { $lt: cutoffTime }
      },
      {
        $set: { status: 'abandoned' as CheckoutStatus }
      }
    );

    return result.modifiedCount;
  }

  async findAll(filter: Partial<Checkout> = {}): Promise<Checkout[]> {
    return this.collection.find(filter)
      .sort({ createdAt: -1 })
      .toArray() as Promise<Checkout[]>;
  }
}

export default CheckoutRepository;