import { v4 as uuidv4 } from 'uuid';
import { Db, Collection } from 'mongodb';

// Order Schema Type Definitions
export type OrderStatus = 'created' | 'placed' | 'fulfilled' | 'received' | 'completed';
export type TaxApplication = 'included' | 'excluded';
export type ChangeStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type ExchangeStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'cancelled';
export type ReturnStatus = 'pending' | 'approved' | 'processing' | 'refunded' | 'rejected';

export interface OrderedItem {
  id: string;
  description: string;
  variantId: string;
  inventoryItemId: string;
  quantity: number;
  price: number;
  subTotal: number;
  total: number;
}

export interface Tax {
  total: number;
  applied: TaxApplication;
}

export interface Change {
  id: string;
  type: string;
  requestedBy: string;
  status: ChangeStatus;
  requestedDate: Date;
  finalisedDate?: Date;
  notes?: string;
}

export interface ExchangeItem {
  swap: string; // orderedItemId to swap out
  for: string;  // orderedItemId to swap in
}

export interface Exchange {
  id: string;
  status: ExchangeStatus;
  requestedDate: Date;
  finalisedDate?: Date;
  items: ExchangeItem[];
}

export interface ReturnItem {
  id: string; // orderedItemId
  refundAmount: number;
}

export interface Return {
  id: string;
  status: ReturnStatus;
  requestedDate: Date;
  finalisedDate?: Date;
  items: ReturnItem[];
}

export interface Order {
  orderId: string; // UUID v4
  status: OrderStatus;
  customerId: string;
  supplierId: string;
  subtotal: number;
  processingFees: number;
  total: number;
  tax: Tax;
  orderedItems: OrderedItem[];
  change: Change[];
  exchange?: Exchange;
  return?: Return;
  createdAt: Date;
  lastModifiedAt: Date;
}

// Validation functions
export function validateOrder(order: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!order.orderId || typeof order.orderId !== 'string') {
    errors.push('orderId is required and must be a string');
  } else if (!isValidUUID(order.orderId)) {
    errors.push('orderId must be a valid UUID v4');
  }

  // Validate status enum
  const validStatuses: OrderStatus[] = ['created', 'placed', 'fulfilled', 'received', 'completed'];
  if (!order.status || !validStatuses.includes(order.status)) {
    errors.push(`status is required and must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate IDs
  if (!order.customerId || typeof order.customerId !== 'string') {
    errors.push('customerId is required and must be a string');
  }

  if (!order.supplierId || typeof order.supplierId !== 'string') {
    errors.push('supplierId is required and must be a string');
  }

  // Validate amounts
  if (typeof order.subtotal !== 'number' || order.subtotal < 0) {
    errors.push('subtotal must be a non-negative number');
  }

  if (typeof order.processingFees !== 'number' || order.processingFees < 0) {
    errors.push('processingFees must be a non-negative number');
  }

  if (typeof order.total !== 'number' || order.total < 0) {
    errors.push('total must be a non-negative number');
  }

  // Validate tax
  if (!order.tax || typeof order.tax !== 'object') {
    errors.push('tax is required and must be an object');
  } else {
    if (typeof order.tax.total !== 'number' || order.tax.total < 0) {
      errors.push('tax.total must be a non-negative number');
    }

    const validTaxApplications: TaxApplication[] = ['included', 'excluded'];
    if (!order.tax.applied || !validTaxApplications.includes(order.tax.applied)) {
      errors.push(`tax.applied must be one of: ${validTaxApplications.join(', ')}`);
    }
  }

  // Validate total calculation
  if (order.tax && order.tax.applied === 'excluded') {
    const expectedTotal = order.subtotal + order.processingFees + order.tax.total;
    if (Math.abs(order.total - expectedTotal) > 0.01) {
      errors.push(`total must equal subtotal + processingFees + tax when tax is excluded. Expected ${expectedTotal}, got ${order.total}`);
    }
  } else if (order.tax && order.tax.applied === 'included') {
    const expectedTotal = order.subtotal + order.processingFees;
    if (Math.abs(order.total - expectedTotal) > 0.01) {
      errors.push(`total must equal subtotal + processingFees when tax is included. Expected ${expectedTotal}, got ${order.total}`);
    }
  }

  // Validate orderedItems array
  if (!Array.isArray(order.orderedItems)) {
    errors.push('orderedItems must be an array');
  } else {
    let calculatedSubtotal = 0;
    order.orderedItems.forEach((item: any, i: number) => {
      if (!item.id || typeof item.id !== 'string') {
        errors.push(`orderedItems[${i}].id is required and must be a string`);
      }

      if (!item.description || typeof item.description !== 'string') {
        errors.push(`orderedItems[${i}].description is required and must be a string`);
      }

      if (!item.variantId || typeof item.variantId !== 'string') {
        errors.push(`orderedItems[${i}].variantId is required and must be a string`);
      }

      if (!item.inventoryItemId || typeof item.inventoryItemId !== 'string') {
        errors.push(`orderedItems[${i}].inventoryItemId is required and must be a string`);
      }

      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        errors.push(`orderedItems[${i}].quantity must be a positive number`);
      }

      if (typeof item.price !== 'number' || item.price < 0) {
        errors.push(`orderedItems[${i}].price must be a non-negative number`);
      }

      if (typeof item.subTotal !== 'number') {
        errors.push(`orderedItems[${i}].subTotal must be a number`);
      }

      if (typeof item.total !== 'number') {
        errors.push(`orderedItems[${i}].total must be a number`);
      }

      // Validate item calculations
      const expectedSubTotal = item.quantity * item.price;
      if (Math.abs(item.subTotal - expectedSubTotal) > 0.01) {
        errors.push(`orderedItems[${i}].subTotal must equal quantity * price. Expected ${expectedSubTotal}, got ${item.subTotal}`);
      }

      calculatedSubtotal += item.subTotal || 0;
    });

    // Validate order subtotal matches sum of items
    if (Math.abs(order.subtotal - calculatedSubtotal) > 0.01) {
      errors.push(`subtotal must equal sum of all orderedItems subtotals. Expected ${calculatedSubtotal}, got ${order.subtotal}`);
    }
  }

  // Validate change array
  if (!Array.isArray(order.change)) {
    errors.push('change must be an array');
  } else {
    order.change.forEach((change: any, i: number) => {
      if (!change.id || typeof change.id !== 'string') {
        errors.push(`change[${i}].id is required and must be a string`);
      }

      if (!change.type || typeof change.type !== 'string') {
        errors.push(`change[${i}].type is required and must be a string`);
      }

      if (!change.requestedBy || typeof change.requestedBy !== 'string') {
        errors.push(`change[${i}].requestedBy is required and must be a string`);
      }

      const validChangeStatuses: ChangeStatus[] = ['pending', 'approved', 'rejected', 'completed'];
      if (!change.status || !validChangeStatuses.includes(change.status)) {
        errors.push(`change[${i}].status must be one of: ${validChangeStatuses.join(', ')}`);
      }

      if (!change.requestedDate || !(change.requestedDate instanceof Date)) {
        errors.push(`change[${i}].requestedDate is required and must be a Date`);
      }

      if (change.finalisedDate !== undefined && !(change.finalisedDate instanceof Date)) {
        errors.push(`change[${i}].finalisedDate must be a Date when provided`);
      }
    });
  }

  // Validate exchange if present
  if (order.exchange !== undefined) {
    const exchange = order.exchange;
    if (typeof exchange !== 'object') {
      errors.push('exchange must be an object when provided');
    } else {
      if (!exchange.id || typeof exchange.id !== 'string') {
        errors.push('exchange.id is required and must be a string');
      }

      const validExchangeStatuses: ExchangeStatus[] = ['pending', 'approved', 'processing', 'completed', 'cancelled'];
      if (!exchange.status || !validExchangeStatuses.includes(exchange.status)) {
        errors.push(`exchange.status must be one of: ${validExchangeStatuses.join(', ')}`);
      }

      if (!exchange.requestedDate || !(exchange.requestedDate instanceof Date)) {
        errors.push('exchange.requestedDate is required and must be a Date');
      }

      if (exchange.finalisedDate !== undefined && !(exchange.finalisedDate instanceof Date)) {
        errors.push('exchange.finalisedDate must be a Date when provided');
      }

      if (!Array.isArray(exchange.items)) {
        errors.push('exchange.items must be an array');
      } else {
        exchange.items.forEach((item: any, i: number) => {
          if (!item.swap || typeof item.swap !== 'string') {
            errors.push(`exchange.items[${i}].swap is required and must be a string`);
          }
          if (!item.for || typeof item.for !== 'string') {
            errors.push(`exchange.items[${i}].for is required and must be a string`);
          }
        });
      }
    }
  }

  // Validate return if present
  if (order.return !== undefined) {
    const returnObj = order.return;
    if (typeof returnObj !== 'object') {
      errors.push('return must be an object when provided');
    } else {
      if (!returnObj.id || typeof returnObj.id !== 'string') {
        errors.push('return.id is required and must be a string');
      }

      const validReturnStatuses: ReturnStatus[] = ['pending', 'approved', 'processing', 'refunded', 'rejected'];
      if (!returnObj.status || !validReturnStatuses.includes(returnObj.status)) {
        errors.push(`return.status must be one of: ${validReturnStatuses.join(', ')}`);
      }

      if (!returnObj.requestedDate || !(returnObj.requestedDate instanceof Date)) {
        errors.push('return.requestedDate is required and must be a Date');
      }

      if (returnObj.finalisedDate !== undefined && !(returnObj.finalisedDate instanceof Date)) {
        errors.push('return.finalisedDate must be a Date when provided');
      }

      if (!Array.isArray(returnObj.items)) {
        errors.push('return.items must be an array');
      } else {
        returnObj.items.forEach((item: any, i: number) => {
          if (!item.id || typeof item.id !== 'string') {
            errors.push(`return.items[${i}].id is required and must be a string`);
          }
          if (typeof item.refundAmount !== 'number' || item.refundAmount < 0) {
            errors.push(`return.items[${i}].refundAmount must be a non-negative number`);
          }
        });
      }
    }
  }

  // Validate timestamps
  if (!order.createdAt || !(order.createdAt instanceof Date)) {
    errors.push('createdAt is required and must be a Date');
  }

  if (!order.lastModifiedAt || !(order.lastModifiedAt instanceof Date)) {
    errors.push('lastModifiedAt is required and must be a Date');
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

// Helper functions
export function createOrderedItem(data: {
  description: string;
  variantId: string;
  inventoryItemId: string;
  quantity: number;
  price: number;
  taxRate?: number;
}): OrderedItem {
  const subTotal = data.quantity * data.price;
  const taxAmount = data.taxRate ? subTotal * data.taxRate : 0;
  const total = subTotal + taxAmount;

  return {
    id: uuidv4(),
    description: data.description,
    variantId: data.variantId,
    inventoryItemId: data.inventoryItemId,
    quantity: data.quantity,
    price: data.price,
    subTotal,
    total
  };
}

export function createOrder(data: {
  customerId: string;
  supplierId: string;
  orderedItems: OrderedItem[];
  processingFees: number;
  tax: Tax;
  status?: OrderStatus;
}): Order {
  const subtotal = data.orderedItems.reduce((sum, item) => sum + item.subTotal, 0);
  const total = data.tax.applied === 'excluded' 
    ? subtotal + data.processingFees + data.tax.total
    : subtotal + data.processingFees;
  
  const now = new Date();
  const order: Order = {
    orderId: uuidv4(),
    status: data.status || 'created',
    customerId: data.customerId,
    supplierId: data.supplierId,
    subtotal,
    processingFees: data.processingFees,
    total,
    tax: data.tax,
    orderedItems: data.orderedItems,
    change: [],
    createdAt: now,
    lastModifiedAt: now
  };

  // Validate before returning
  const validation = validateOrder(order);
  if (!validation.valid) {
    throw new Error(`Invalid order: ${validation.errors.join(', ')}`);
  }

  return order;
}

// Order Repository class for database operations
export class OrderRepository {
  private collection: Collection<Order>;
  private db: Db;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection<Order>('order');
    this.ensureIndexes();
  }

  private async ensureIndexes() {
    // Create unique index on orderId
    await this.collection.createIndex(
      { orderId: 1 },
      { unique: true }
    );
    
    // Create other useful indexes
    await this.collection.createIndex({ customerId: 1 });
    await this.collection.createIndex({ supplierId: 1 });
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ createdAt: -1 });
    await this.collection.createIndex({ 'orderedItems.variantId': 1 });
    await this.collection.createIndex({ 'orderedItems.inventoryItemId': 1 });
    
    // Compound indexes
    await this.collection.createIndex({ customerId: 1, status: 1 });
    await this.collection.createIndex({ supplierId: 1, status: 1 });
  }

  async create(orderData: {
    customerId: string;
    supplierId: string;
    orderedItems: OrderedItem[];
    processingFees: number;
    tax: Tax;
    status?: OrderStatus;
  }): Promise<Order> {
    const order = createOrder(orderData);

    // Validate before inserting
    const validation = validateOrder(order);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid order: ${validation.errors.join(', ')}`);
    }

    await this.collection.insertOne(order as any);
    return order;
  }

  async findByOrderId(orderId: string): Promise<Order | null> {
    return this.collection.findOne({ orderId }) as Promise<Order | null>;
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    return this.collection.find({ customerId })
      .sort({ createdAt: -1 })
      .toArray() as Promise<Order[]>;
  }

  async findBySupplierId(supplierId: string): Promise<Order[]> {
    return this.collection.find({ supplierId })
      .sort({ createdAt: -1 })
      .toArray() as Promise<Order[]>;
  }

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    return this.collection.find({ status })
      .sort({ createdAt: -1 })
      .toArray() as Promise<Order[]>;
  }

  async updateStatus(orderId: string, status: OrderStatus): Promise<Order | null> {
    const result = await this.collection.findOneAndUpdate(
      { orderId },
      { 
        $set: { 
          status,
          lastModifiedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (result) {
      // Validate the updated order
      const validation = validateOrder(result);
      if (!validation.valid) {
        throw new Error(`Update resulted in invalid order: ${validation.errors.join(', ')}`);
      }
    }

    return result as Order | null;
  }

  async addChange(orderId: string, change: Omit<Change, 'id'>): Promise<Order | null> {
    const changeWithId: Change = {
      ...change,
      id: uuidv4()
    };

    const result = await this.collection.findOneAndUpdate(
      { orderId },
      { 
        $push: { change: changeWithId },
        $set: { lastModifiedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    return result as Order | null;
  }

  async updateChange(orderId: string, changeId: string, updates: Partial<Change>): Promise<Order | null> {
    const order = await this.findByOrderId(orderId);
    if (!order) return null;

    const changeIndex = order.change.findIndex(c => c.id === changeId);
    if (changeIndex === -1) return null;

    const updatedChange = {
      ...order.change[changeIndex],
      ...updates
    };

    const result = await this.collection.findOneAndUpdate(
      { orderId },
      { 
        $set: { 
          [`change.${changeIndex}`]: updatedChange,
          lastModifiedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return result as Order | null;
  }

  async initiateExchange(orderId: string, items: ExchangeItem[]): Promise<Order | null> {
    const exchange: Exchange = {
      id: uuidv4(),
      status: 'pending',
      requestedDate: new Date(),
      items
    };

    const result = await this.collection.findOneAndUpdate(
      { orderId },
      { 
        $set: { 
          exchange,
          lastModifiedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return result as Order | null;
  }

  async updateExchange(orderId: string, status: ExchangeStatus, finalisedDate?: Date): Promise<Order | null> {
    const updateObj: any = {
      'exchange.status': status,
      lastModifiedAt: new Date()
    };

    if (finalisedDate) {
      updateObj['exchange.finalisedDate'] = finalisedDate;
    }

    const result = await this.collection.findOneAndUpdate(
      { orderId },
      { $set: updateObj },
      { returnDocument: 'after' }
    );

    return result as Order | null;
  }

  async initiateReturn(orderId: string, items: ReturnItem[]): Promise<Order | null> {
    const returnObj: Return = {
      id: uuidv4(),
      status: 'pending',
      requestedDate: new Date(),
      items
    };

    const result = await this.collection.findOneAndUpdate(
      { orderId },
      { 
        $set: { 
          return: returnObj,
          lastModifiedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return result as Order | null;
  }

  async updateReturn(orderId: string, status: ReturnStatus, finalisedDate?: Date): Promise<Order | null> {
    const updateObj: any = {
      'return.status': status,
      lastModifiedAt: new Date()
    };

    if (finalisedDate) {
      updateObj['return.finalisedDate'] = finalisedDate;
    }

    const result = await this.collection.findOneAndUpdate(
      { orderId },
      { $set: updateObj },
      { returnDocument: 'after' }
    );

    return result as Order | null;
  }

  async delete(orderId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ orderId });
    return result.deletedCount === 1;
  }

  // Analytics methods
  async getOrderStats(supplierId?: string, dateFrom?: Date, dateTo?: Date): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    statusBreakdown: Record<OrderStatus, number>;
    returnsCount: number;
    exchangesCount: number;
  }> {
    const filter: any = {};
    if (supplierId) filter.supplierId = supplierId;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = dateFrom;
      if (dateTo) filter.createdAt.$lte = dateTo;
    }

    const orders = await this.collection.find(filter).toArray();
    
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    const statusBreakdown: Record<OrderStatus, number> = {
      created: 0,
      placed: 0,
      fulfilled: 0,
      received: 0,
      completed: 0
    };
    
    let returnsCount = 0;
    let exchangesCount = 0;
    
    orders.forEach(order => {
      statusBreakdown[order.status]++;
      if (order.return) returnsCount++;
      if (order.exchange) exchangesCount++;
    });

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      statusBreakdown,
      returnsCount,
      exchangesCount
    };
  }

  async findOrdersWithReturns(): Promise<Order[]> {
    return this.collection.find({ 
      return: { $exists: true } 
    }).toArray() as Promise<Order[]>;
  }

  async findOrdersWithExchanges(): Promise<Order[]> {
    return this.collection.find({ 
      exchange: { $exists: true } 
    }).toArray() as Promise<Order[]>;
  }

  async findOrdersWithChanges(): Promise<Order[]> {
    return this.collection.find({ 
      'change.0': { $exists: true } 
    }).toArray() as Promise<Order[]>;
  }

  async findAll(filter: Partial<Order> = {}): Promise<Order[]> {
    return this.collection.find(filter)
      .sort({ createdAt: -1 })
      .toArray() as Promise<Order[]>;
  }
}

export default OrderRepository;