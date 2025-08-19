import { v4 as uuidv4 } from 'uuid';
import { Db, Collection } from 'mongodb';

// Cart Schema Type Definitions
export type CartStatus = 'active' | 'checkout' | 'abandoned' | 'completed';

export interface CustomerObject {
  metadata: Record<string, any>;
}

export interface CartItem {
  cartItemId: string; // UUID v4
  variantId: string; // ID of the product variant
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number; // quantity * unitPrice
  customerObject?: CustomerObject[];
}

export interface Cart {
  cartId: string; // UUID v4
  status: CartStatus;
  createdAt: Date;
  lastModifiedAt: Date;
  lastActive: Date;
  customerId: string; // auth user ID
  supplierId: string; // vendor ID
  cartItems: CartItem[];
}

// Validation functions
export function validateCart(cart: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!cart.cartId || typeof cart.cartId !== 'string') {
    errors.push('cartId is required and must be a string');
  } else if (!isValidUUID(cart.cartId)) {
    errors.push('cartId must be a valid UUID v4');
  }

  // Validate status enum
  const validStatuses: CartStatus[] = ['active', 'checkout', 'abandoned', 'completed'];
  if (!cart.status || !validStatuses.includes(cart.status)) {
    errors.push(`status is required and must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate dates
  if (!cart.createdAt || !(cart.createdAt instanceof Date)) {
    errors.push('createdAt is required and must be a Date');
  }

  if (!cart.lastModifiedAt || !(cart.lastModifiedAt instanceof Date)) {
    errors.push('lastModifiedAt is required and must be a Date');
  }

  if (!cart.lastActive || !(cart.lastActive instanceof Date)) {
    errors.push('lastActive is required and must be a Date');
  }

  // Validate IDs
  if (!cart.customerId || typeof cart.customerId !== 'string') {
    errors.push('customerId is required and must be a string');
  }

  if (!cart.supplierId || typeof cart.supplierId !== 'string') {
    errors.push('supplierId is required and must be a string');
  }

  // Validate cartItems array
  if (!Array.isArray(cart.cartItems)) {
    errors.push('cartItems must be an array');
  } else {
    cart.cartItems.forEach((item: any, i: number) => {
      // Validate cartItemId
      if (!item.cartItemId || typeof item.cartItemId !== 'string') {
        errors.push(`cartItems[${i}].cartItemId is required and must be a string`);
      } else if (!isValidUUID(item.cartItemId)) {
        errors.push(`cartItems[${i}].cartItemId must be a valid UUID v4`);
      }

      // Validate variantId
      if (!item.variantId || typeof item.variantId !== 'string') {
        errors.push(`cartItems[${i}].variantId is required and must be a string`);
      }

      // Validate name
      if (!item.name || typeof item.name !== 'string') {
        errors.push(`cartItems[${i}].name is required and must be a string`);
      }

      // Validate quantity
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        errors.push(`cartItems[${i}].quantity must be a positive number`);
      }

      // Validate unitPrice
      if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
        errors.push(`cartItems[${i}].unitPrice must be a non-negative number`);
      }

      // Validate subtotal
      if (typeof item.subtotal !== 'number') {
        errors.push(`cartItems[${i}].subtotal must be a number`);
      }

      // Validate subtotal calculation
      const expectedSubtotal = item.quantity * item.unitPrice;
      if (Math.abs(item.subtotal - expectedSubtotal) > 0.01) { // Allow for small floating point differences
        errors.push(`cartItems[${i}].subtotal must equal quantity * unitPrice. Expected ${expectedSubtotal}, got ${item.subtotal}`);
      }

      // Validate customerObject if present
      if (item.customerObject !== undefined) {
        if (!Array.isArray(item.customerObject)) {
          errors.push(`cartItems[${i}].customerObject must be an array`);
        } else {
          item.customerObject.forEach((obj: any, j: number) => {
            if (!obj.metadata || typeof obj.metadata !== 'object') {
              errors.push(`cartItems[${i}].customerObject[${j}].metadata must be an object`);
            }
          });
        }
      }
    });
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
export function createCartItem(data: {
  variantId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  customerObject?: CustomerObject[];
}): CartItem {
  const subtotal = data.quantity * data.unitPrice;

  return {
    cartItemId: uuidv4(),
    variantId: data.variantId,
    name: data.name,
    quantity: data.quantity,
    unitPrice: data.unitPrice,
    subtotal,
    customerObject: data.customerObject
  };
}

export function createCart(data: {
  customerId: string;
  supplierId: string;
  status?: CartStatus;
  cartItems?: CartItem[];
  createdAt?: Date;
  lastModifiedAt?: Date;
  lastActive?: Date;
}): Cart {
  const now = new Date();
  const cart: Cart = {
    cartId: uuidv4(),
    status: data.status || 'active',
    createdAt: data.createdAt || now,
    lastModifiedAt: data.lastModifiedAt || now,
    lastActive: data.lastActive || now,
    customerId: data.customerId,
    supplierId: data.supplierId,
    cartItems: data.cartItems || []
  };

  // Validate before returning
  const validation = validateCart(cart);
  if (!validation.valid) {
    throw new Error(`Invalid cart: ${validation.errors.join(', ')}`);
  }

  return cart;
}

// Cart Repository class for database operations
export class CartRepository {
  private collection: Collection<Cart>;
  private db: Db;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection<Cart>('cart');
    this.ensureIndexes();
  }

  private async ensureIndexes() {
    // Create unique index on cartId
    await this.collection.createIndex(
      { cartId: 1 },
      { unique: true }
    );
    
    // Create other useful indexes
    await this.collection.createIndex({ customerId: 1 });
    await this.collection.createIndex({ supplierId: 1 });
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ createdAt: -1 }); // For sorting by most recent
    await this.collection.createIndex({ lastActive: -1 });
    await this.collection.createIndex({ 'cartItems.variantId': 1 }); // For inventory calculations
    
    // Compound index for finding active carts by customer
    await this.collection.createIndex({ customerId: 1, status: 1 });
  }

  async create(cartData: {
    customerId: string;
    supplierId: string;
    status?: CartStatus;
    cartItems?: CartItem[];
  }): Promise<Cart> {
    const cart = createCart(cartData);

    // Validate before inserting
    const validation = validateCart(cart);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid cart: ${validation.errors.join(', ')}`);
    }

    await this.collection.insertOne(cart as any);
    return cart;
  }

  async findByCartId(cartId: string): Promise<Cart | null> {
    return this.collection.findOne({ cartId }) as Promise<Cart | null>;
  }

  async findActiveCartByCustomer(customerId: string): Promise<Cart | null> {
    return this.collection.findOne({ 
      customerId, 
      status: 'active' 
    }) as Promise<Cart | null>;
  }

  async findCartsByCustomer(customerId: string): Promise<Cart[]> {
    return this.collection.find({ customerId })
      .sort({ createdAt: -1 })
      .toArray() as Promise<Cart[]>;
  }

  async findCartsBySupplier(supplierId: string): Promise<Cart[]> {
    return this.collection.find({ supplierId })
      .sort({ createdAt: -1 })
      .toArray() as Promise<Cart[]>;
  }

  async findCartsByStatus(status: CartStatus): Promise<Cart[]> {
    return this.collection.find({ status })
      .sort({ lastActive: -1 })
      .toArray() as Promise<Cart[]>;
  }

  async addItem(cartId: string, item: Omit<CartItem, 'cartItemId'>): Promise<Cart | null> {
    const cartItem = createCartItem(item);
    const now = new Date();
    
    const result = await this.collection.findOneAndUpdate(
      { cartId },
      { 
        $push: { cartItems: cartItem },
        $set: { 
          lastActive: now,
          lastModifiedAt: now
        }
      },
      { returnDocument: 'after' }
    );

    return result as Cart | null;
  }

  async updateItem(cartId: string, cartItemId: string, updates: {
    quantity?: number;
    unitPrice?: number;
    customerObject?: CustomerObject[];
  }): Promise<Cart | null> {
    // Get current cart to recalculate subtotal
    const cart = await this.findByCartId(cartId);
    if (!cart) return null;

    const itemIndex = cart.cartItems.findIndex(item => item.cartItemId === cartItemId);
    if (itemIndex === -1) return null;

    const currentItem = cart.cartItems[itemIndex];
    const updatedItem = {
      ...currentItem,
      ...updates,
      subtotal: (updates.quantity || currentItem.quantity) * (updates.unitPrice || currentItem.unitPrice)
    };

    const now = new Date();
    const result = await this.collection.findOneAndUpdate(
      { cartId, 'cartItems.cartItemId': cartItemId },
      { 
        $set: { 
          [`cartItems.${itemIndex}`]: updatedItem,
          lastActive: now,
          lastModifiedAt: now
        }
      },
      { returnDocument: 'after' }
    );

    return result as Cart | null;
  }

  async removeItem(cartId: string, cartItemId: string): Promise<Cart | null> {
    const now = new Date();
    const result = await this.collection.findOneAndUpdate(
      { cartId },
      { 
        $pull: { cartItems: { cartItemId } },
        $set: { 
          lastActive: now,
          lastModifiedAt: now
        }
      },
      { returnDocument: 'after' }
    );

    return result as Cart | null;
  }

  async updateStatus(cartId: string, status: CartStatus): Promise<Cart | null> {
    const now = new Date();
    const result = await this.collection.findOneAndUpdate(
      { cartId },
      { 
        $set: { 
          status,
          lastActive: now,
          lastModifiedAt: now
        }
      },
      { returnDocument: 'after' }
    );

    if (result) {
      // Validate the updated cart
      const validation = validateCart(result);
      if (!validation.valid) {
        throw new Error(`Update resulted in invalid cart: ${validation.errors.join(', ')}`);
      }
    }

    return result as Cart | null;
  }

  async clearCart(cartId: string): Promise<Cart | null> {
    const now = new Date();
    const result = await this.collection.findOneAndUpdate(
      { cartId },
      { 
        $set: { 
          cartItems: [],
          lastActive: now,
          lastModifiedAt: now
        }
      },
      { returnDocument: 'after' }
    );

    return result as Cart | null;
  }

  async delete(cartId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ cartId });
    return result.deletedCount === 1;
  }

  async getCartTotal(cartId: string): Promise<number> {
    const cart = await this.findByCartId(cartId);
    if (!cart) return 0;

    return cart.cartItems.reduce((total, item) => total + item.subtotal, 0);
  }

  async getCartItemCount(cartId: string): Promise<number> {
    const cart = await this.findByCartId(cartId);
    if (!cart) return 0;

    return cart.cartItems.reduce((total, item) => total + item.quantity, 0);
  }

  // Find carts with specific variant (for inventory reserved count)
  async findActiveCartsWithVariant(variantId: string): Promise<Cart[]> {
    return this.collection.find({
      status: 'active',
      'cartItems.variantId': variantId
    }).toArray() as Promise<Cart[]>;
  }

  // Get total reserved quantity for a variant across all active carts
  async getReservedQuantityForVariant(variantId: string): Promise<number> {
    const carts = await this.findActiveCartsWithVariant(variantId);
    
    let totalReserved = 0;
    for (const cart of carts) {
      for (const item of cart.cartItems) {
        if (item.variantId === variantId) {
          totalReserved += item.quantity;
        }
      }
    }
    
    return totalReserved;
  }

  // Abandon inactive carts (e.g., carts inactive for more than 24 hours)
  async abandonInactiveCarts(hoursInactive: number = 24): Promise<number> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursInactive);

    const result = await this.collection.updateMany(
      {
        status: 'active',
        lastActive: { $lt: cutoffTime }
      },
      {
        $set: { 
          status: 'abandoned' as CartStatus,
          lastActive: new Date()
        }
      }
    );

    return result.modifiedCount;
  }

  // Merge two carts (useful when anonymous user logs in)
  async mergeCarts(sourceCartId: string, targetCartId: string): Promise<Cart | null> {
    const sourceCart = await this.findByCartId(sourceCartId);
    const targetCart = await this.findByCartId(targetCartId);

    if (!sourceCart || !targetCart) return null;

    // Add all items from source to target
    const mergedItems = [...targetCart.cartItems];
    
    for (const sourceItem of sourceCart.cartItems) {
      const existingItemIndex = mergedItems.findIndex(
        item => item.variantId === sourceItem.variantId
      );

      if (existingItemIndex >= 0) {
        // Combine quantities for same variant
        mergedItems[existingItemIndex].quantity += sourceItem.quantity;
        mergedItems[existingItemIndex].subtotal = 
          mergedItems[existingItemIndex].quantity * mergedItems[existingItemIndex].unitPrice;
      } else {
        // Add new item
        mergedItems.push(sourceItem);
      }
    }

    // Update target cart with merged items
    const result = await this.collection.findOneAndUpdate(
      { cartId: targetCartId },
      {
        $set: {
          cartItems: mergedItems,
          lastActive: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    // Delete source cart
    await this.delete(sourceCartId);

    return result as Cart | null;
  }

  async findAll(filter: Partial<Cart> = {}): Promise<Cart[]> {
    return this.collection.find(filter)
      .sort({ createdAt: -1 })
      .toArray() as Promise<Cart[]>;
  }
}

export default CartRepository;