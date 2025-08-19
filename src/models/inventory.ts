import { v4 as uuidv4 } from 'uuid';
import { Db, Collection } from 'mongodb';

// Inventory Schema Type Definitions
export type InventoryStatus = 'available' | 'soldOut' | 'backOrder';
export type InventoryType = 'digital' | 'physical' | 'service';
export type LocationType = 'digital' | 'physical' | 'service';

export interface InventoryLocation {
  locationId: string;
  type: LocationType;
  locationAddress: string;
}

export interface Inventory {
  inventoryItemId: string; // UUID v4
  name: string;
  productVariantId: string; // ID of the related product variant
  status: InventoryStatus;
  type: InventoryType;
  total: number; // Total number of inventory items
  reserved: number; // Computed: count in active carts
  sold: number; // Computed: count in paid orders
  available: number; // Computed: total - sold - reserved
  location: InventoryLocation[];
  createdAt: Date;
  lastModifiedAt: Date;
}

// Validation functions
export function validateInventory(inventory: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!inventory.inventoryItemId || typeof inventory.inventoryItemId !== 'string') {
    errors.push('inventoryItemId is required and must be a string');
  } else if (!isValidUUID(inventory.inventoryItemId)) {
    errors.push('inventoryItemId must be a valid UUID v4');
  }

  if (!inventory.name || typeof inventory.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  if (!inventory.productVariantId || typeof inventory.productVariantId !== 'string') {
    errors.push('productVariantId is required and must be a string');
  }

  // Validate status enum
  const validStatuses: InventoryStatus[] = ['available', 'soldOut', 'backOrder'];
  if (!inventory.status || !validStatuses.includes(inventory.status)) {
    errors.push(`status is required and must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate type enum
  const validTypes: InventoryType[] = ['digital', 'physical', 'service'];
  if (!inventory.type || !validTypes.includes(inventory.type)) {
    errors.push(`type is required and must be one of: ${validTypes.join(', ')}`);
  }

  // Validate numeric fields
  if (typeof inventory.total !== 'number' || inventory.total < 0) {
    errors.push('total must be a non-negative number');
  }

  if (typeof inventory.reserved !== 'number' || inventory.reserved < 0) {
    errors.push('reserved must be a non-negative number');
  }

  if (typeof inventory.sold !== 'number' || inventory.sold < 0) {
    errors.push('sold must be a non-negative number');
  }

  if (typeof inventory.available !== 'number') {
    errors.push('available must be a number');
  }

  // Validate computed field consistency
  const expectedAvailable = inventory.total - inventory.sold - inventory.reserved;
  if (inventory.available !== expectedAvailable) {
    errors.push(`available must equal (total - sold - reserved). Expected ${expectedAvailable}, got ${inventory.available}`);
  }

  // Validate timestamps
  if (!inventory.createdAt || !(inventory.createdAt instanceof Date)) {
    errors.push('createdAt is required and must be a Date');
  }

  if (!inventory.lastModifiedAt || !(inventory.lastModifiedAt instanceof Date)) {
    errors.push('lastModifiedAt is required and must be a Date');
  }

  // Validate location array
  if (!Array.isArray(inventory.location)) {
    errors.push('location must be an array');
  } else {
    inventory.location.forEach((loc: any, i: number) => {
      if (!loc.locationId || typeof loc.locationId !== 'string') {
        errors.push(`location[${i}].locationId is required and must be a string`);
      }

      const validLocationTypes: LocationType[] = ['digital', 'physical', 'service'];
      if (!loc.type || !validLocationTypes.includes(loc.type)) {
        errors.push(`location[${i}].type must be one of: ${validLocationTypes.join(', ')}`);
      }

      if (!loc.locationAddress || typeof loc.locationAddress !== 'string') {
        errors.push(`location[${i}].locationAddress is required and must be a string`);
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
export function createInventory(data: {
  name: string;
  productVariantId: string;
  status: InventoryStatus;
  type: InventoryType;
  total: number;
  reserved?: number;
  sold?: number;
  location: Array<{
    locationId: string;
    type: LocationType;
    locationAddress: string;
  }>;
}): Inventory {
  const reserved = data.reserved || 0;
  const sold = data.sold || 0;
  const available = data.total - sold - reserved;
  const now = new Date();

  const inventory: Inventory = {
    inventoryItemId: uuidv4(),
    name: data.name,
    productVariantId: data.productVariantId,
    status: data.status,
    type: data.type,
    total: data.total,
    reserved,
    sold,
    available,
    location: data.location,
    createdAt: now,
    lastModifiedAt: now
  };

  // Validate before returning
  const validation = validateInventory(inventory);
  if (!validation.valid) {
    throw new Error(`Invalid inventory: ${validation.errors.join(', ')}`);
  }

  return inventory;
}

// Inventory Repository class for database operations
export class InventoryRepository {
  private collection: Collection<Inventory>;
  private db: Db;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection<Inventory>('inventory');
    this.ensureIndexes();
  }

  private async ensureIndexes() {
    // Create unique index on inventoryItemId
    await this.collection.createIndex(
      { inventoryItemId: 1 },
      { unique: true }
    );
    
    // Create other useful indexes
    await this.collection.createIndex({ productVariantId: 1 });
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ type: 1 });
    await this.collection.createIndex({ 'location.locationId': 1 });
    await this.collection.createIndex({ available: 1 });
  }

  async create(inventoryData: Omit<Inventory, 'inventoryItemId' | 'available'> & { 
    inventoryItemId?: string;
    reserved?: number;
    sold?: number;
  }): Promise<Inventory> {
    const inventory = createInventory({
      name: inventoryData.name,
      productVariantId: inventoryData.productVariantId,
      status: inventoryData.status,
      type: inventoryData.type,
      total: inventoryData.total,
      reserved: inventoryData.reserved || 0,
      sold: inventoryData.sold || 0,
      location: inventoryData.location
    });

    // Override inventoryItemId if provided
    if (inventoryData.inventoryItemId) {
      inventory.inventoryItemId = inventoryData.inventoryItemId;
    }

    // Validate before inserting
    const validation = validateInventory(inventory);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid inventory: ${validation.errors.join(', ')}`);
    }

    await this.collection.insertOne(inventory as any);
    return inventory;
  }

  async findByInventoryItemId(inventoryItemId: string): Promise<Inventory | null> {
    return this.collection.findOne({ inventoryItemId }) as Promise<Inventory | null>;
  }

  async findByProductVariantId(productVariantId: string): Promise<Inventory[]> {
    return this.collection.find({ productVariantId }).toArray() as Promise<Inventory[]>;
  }

  async update(inventoryItemId: string, updates: Partial<Inventory>): Promise<Inventory | null> {
    // Don't allow changing inventoryItemId or createdAt
    delete (updates as any).inventoryItemId;
    delete (updates as any).createdAt;

    // Recalculate available if related fields change
    if (updates.total !== undefined || updates.sold !== undefined || updates.reserved !== undefined) {
      const current = await this.findByInventoryItemId(inventoryItemId);
      if (current) {
        const total = updates.total !== undefined ? updates.total : current.total;
        const sold = updates.sold !== undefined ? updates.sold : current.sold;
        const reserved = updates.reserved !== undefined ? updates.reserved : current.reserved;
        updates.available = total - sold - reserved;
      }
    }

    // Always update lastModifiedAt
    const updatesWithTimestamp = {
      ...updates,
      lastModifiedAt: new Date()
    };

    const result = await this.collection.findOneAndUpdate(
      { inventoryItemId },
      { $set: updatesWithTimestamp },
      { returnDocument: 'after' }
    );

    if (result) {
      // Validate the updated inventory
      const validation = validateInventory(result);
      if (!validation.valid) {
        // Rollback if validation fails
        throw new Error(`Update resulted in invalid inventory: ${validation.errors.join(', ')}`);
      }
    }

    return result as Inventory | null;
  }

  async delete(inventoryItemId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ inventoryItemId });
    return result.deletedCount === 1;
  }

  async findByStatus(status: InventoryStatus): Promise<Inventory[]> {
    return this.collection.find({ status }).toArray() as Promise<Inventory[]>;
  }

  async findByType(type: InventoryType): Promise<Inventory[]> {
    return this.collection.find({ type }).toArray() as Promise<Inventory[]>;
  }

  async findAvailable(minAvailable: number = 1): Promise<Inventory[]> {
    return this.collection.find({ 
      available: { $gte: minAvailable },
      status: 'available'
    }).toArray() as Promise<Inventory[]>;
  }

  async findByLocation(locationId: string): Promise<Inventory[]> {
    return this.collection.find({ 
      'location.locationId': locationId 
    }).toArray() as Promise<Inventory[]>;
  }

  // Computed field update methods
  async updateReservedCount(productVariantId: string): Promise<void> {
    // This would be called after cart operations
    // Count active carts with this variant
    const cartsCollection = this.db.collection('cart');
    const reservedCount = await cartsCollection.countDocuments({
      'items.productVariantId': productVariantId,
      status: 'active'
    });

    const inventories = await this.findByProductVariantId(productVariantId);
    for (const inventory of inventories) {
      await this.update(inventory.inventoryItemId, {
        reserved: reservedCount
      });
    }
  }

  async updateSoldCount(productVariantId: string): Promise<void> {
    // This would be called after order operations
    // Count paid orders with this variant
    const ordersCollection = this.db.collection('order');
    const soldCount = await ordersCollection.countDocuments({
      'items.productVariantId': productVariantId,
      status: 'paid'
    });

    const inventories = await this.findByProductVariantId(productVariantId);
    for (const inventory of inventories) {
      await this.update(inventory.inventoryItemId, {
        sold: soldCount
      });
    }
  }

  async updateComputedFields(productVariantId: string): Promise<void> {
    // Update both reserved and sold counts
    await this.updateReservedCount(productVariantId);
    await this.updateSoldCount(productVariantId);
  }

  async checkAvailability(inventoryItemId: string, quantity: number = 1): Promise<boolean> {
    const inventory = await this.findByInventoryItemId(inventoryItemId);
    if (!inventory) return false;
    return inventory.available >= quantity;
  }

  async reserveInventory(inventoryItemId: string, quantity: number = 1): Promise<boolean> {
    const inventory = await this.findByInventoryItemId(inventoryItemId);
    if (!inventory || inventory.available < quantity) {
      return false;
    }

    await this.update(inventoryItemId, {
      reserved: inventory.reserved + quantity
    });

    return true;
  }

  async releaseReservation(inventoryItemId: string, quantity: number = 1): Promise<boolean> {
    const inventory = await this.findByInventoryItemId(inventoryItemId);
    if (!inventory || inventory.reserved < quantity) {
      return false;
    }

    await this.update(inventoryItemId, {
      reserved: inventory.reserved - quantity
    });

    return true;
  }

  async recordSale(inventoryItemId: string, quantity: number = 1): Promise<boolean> {
    const inventory = await this.findByInventoryItemId(inventoryItemId);
    if (!inventory) {
      return false;
    }

    // Move from reserved to sold
    await this.update(inventoryItemId, {
      reserved: Math.max(0, inventory.reserved - quantity),
      sold: inventory.sold + quantity
    });

    // Update status if sold out
    const updated = await this.findByInventoryItemId(inventoryItemId);
    if (updated && updated.available === 0) {
      await this.update(inventoryItemId, { status: 'soldOut' });
    }

    return true;
  }

  async findAll(filter: Partial<Inventory> = {}): Promise<Inventory[]> {
    return this.collection.find(filter).toArray() as Promise<Inventory[]>;
  }
}

export default InventoryRepository;