import { v4 as uuidv4 } from 'uuid';
import { Db, Collection } from 'mongodb';

// Bundled Products Schema Type Definitions (MedusaJS Pattern)
export type BundleStatus = 'active' | 'inactive' | 'draft' | 'archived';
export type BundlePricingType = 'fixed' | 'calculated' | 'discount_percentage' | 'discount_amount';
export type BundleType = 'fixed' | 'customizable'; // Fixed = all items required, Customizable = customer can choose

export interface BundleItem {
  id: string;
  productId: string; // Reference to product
  variantId: string; // Reference to specific variant
  quantity: number; // Quantity of this item in the bundle
  isRequired: boolean; // For customizable bundles
  minQuantity?: number; // Minimum quantity for customizable bundles
  maxQuantity?: number; // Maximum quantity for customizable bundles
  price?: number; // Individual price (for display/calculation)
  discountedPrice?: number; // Price when in bundle
  sortOrder: number; // Display order
}

export interface BundleImage {
  id: string;
  url: string;
  alternateText?: string;
  isPrimary: boolean;
}

export interface BundleMetadata {
  savings?: number; // Amount saved vs buying separately
  savingsPercentage?: number; // Percentage saved
  originalPrice?: number; // Sum of all items at regular price
  minItems?: number; // For customizable bundles
  maxItems?: number; // For customizable bundles
}

export interface BundledProduct {
  bundleId: string; // UUID v4
  sku: string; // Stock keeping unit
  name: string;
  description: string;
  status: BundleStatus;
  type: BundleType;
  pricingType: BundlePricingType;
  price: number; // Bundle price (fixed or calculated)
  compareAtPrice?: number; // Original price for showing savings
  currency: string; // ISO currency code
  bundleItems: BundleItem[];
  images: BundleImage[];
  category?: string[];
  tags?: string[];
  weight?: number; // Total weight if physical products
  weightUnit?: string; // kg, lb, etc.
  metadata: BundleMetadata;
  vendorId?: string; // If vendor-specific bundle
  availableFrom?: Date;
  availableTo?: Date;
  maxPurchaseQuantity?: number; // Max bundles per order
  requiresShipping: boolean;
  taxable: boolean;
  published: boolean;
  publishedAt?: Date;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  createdAt: Date;
  lastModifiedAt: Date;
}

// Validation functions
export function validateBundledProduct(bundle: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!bundle.bundleId || typeof bundle.bundleId !== 'string') {
    errors.push('bundleId is required and must be a string');
  } else if (!isValidUUID(bundle.bundleId)) {
    errors.push('bundleId must be a valid UUID v4');
  }

  if (!bundle.sku || typeof bundle.sku !== 'string') {
    errors.push('sku is required and must be a string');
  }

  if (!bundle.name || typeof bundle.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  if (!bundle.description || typeof bundle.description !== 'string') {
    errors.push('description is required and must be a string');
  }

  // Validate status enum
  const validStatuses: BundleStatus[] = ['active', 'inactive', 'draft', 'archived'];
  if (!bundle.status || !validStatuses.includes(bundle.status)) {
    errors.push(`status is required and must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate type enum
  const validTypes: BundleType[] = ['fixed', 'customizable'];
  if (!bundle.type || !validTypes.includes(bundle.type)) {
    errors.push(`type is required and must be one of: ${validTypes.join(', ')}`);
  }

  // Validate pricing type enum
  const validPricingTypes: BundlePricingType[] = ['fixed', 'calculated', 'discount_percentage', 'discount_amount'];
  if (!bundle.pricingType || !validPricingTypes.includes(bundle.pricingType)) {
    errors.push(`pricingType is required and must be one of: ${validPricingTypes.join(', ')}`);
  }

  // Validate price
  if (typeof bundle.price !== 'number' || bundle.price < 0) {
    errors.push('price must be a non-negative number');
  }

  // Validate currency
  if (!bundle.currency || typeof bundle.currency !== 'string' || bundle.currency.length !== 3) {
    errors.push('currency must be a 3-letter ISO currency code');
  }

  // Validate bundle items
  if (!Array.isArray(bundle.bundleItems)) {
    errors.push('bundleItems must be an array');
  } else if (bundle.bundleItems.length === 0) {
    errors.push('bundleItems must contain at least one item');
  } else {
    let calculatedPrice = 0;
    let originalPrice = 0;

    bundle.bundleItems.forEach((item: any, i: number) => {
      if (!item.id || typeof item.id !== 'string') {
        errors.push(`bundleItems[${i}].id is required and must be a string`);
      }
      if (!item.productId || typeof item.productId !== 'string') {
        errors.push(`bundleItems[${i}].productId is required and must be a string`);
      }
      if (!item.variantId || typeof item.variantId !== 'string') {
        errors.push(`bundleItems[${i}].variantId is required and must be a string`);
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        errors.push(`bundleItems[${i}].quantity must be a positive number`);
      }
      if (typeof item.isRequired !== 'boolean') {
        errors.push(`bundleItems[${i}].isRequired must be a boolean`);
      }
      if (typeof item.sortOrder !== 'number') {
        errors.push(`bundleItems[${i}].sortOrder must be a number`);
      }

      // For customizable bundles, validate min/max quantities
      if (bundle.type === 'customizable') {
        if (!item.isRequired) {
          if (item.minQuantity !== undefined && (typeof item.minQuantity !== 'number' || item.minQuantity < 0)) {
            errors.push(`bundleItems[${i}].minQuantity must be a non-negative number`);
          }
          if (item.maxQuantity !== undefined && (typeof item.maxQuantity !== 'number' || item.maxQuantity < 0)) {
            errors.push(`bundleItems[${i}].maxQuantity must be a non-negative number`);
          }
          if (item.minQuantity !== undefined && item.maxQuantity !== undefined && item.minQuantity > item.maxQuantity) {
            errors.push(`bundleItems[${i}].minQuantity cannot be greater than maxQuantity`);
          }
        }
      }

      // Calculate prices for validation
      if (item.price) {
        originalPrice += item.price * item.quantity;
        calculatedPrice += (item.discountedPrice || item.price) * item.quantity;
      }
    });

    // Validate pricing based on type
    if (bundle.pricingType === 'calculated' && bundle.metadata) {
      bundle.metadata.originalPrice = originalPrice;
      bundle.metadata.savings = originalPrice - calculatedPrice;
      bundle.metadata.savingsPercentage = originalPrice > 0 ? (bundle.metadata.savings / originalPrice) * 100 : 0;
    }
  }

  // Validate images
  if (!Array.isArray(bundle.images)) {
    errors.push('images must be an array');
  } else {
    let hasPrimary = false;
    bundle.images.forEach((img: any, i: number) => {
      if (!img.id || typeof img.id !== 'string') {
        errors.push(`images[${i}].id is required and must be a string`);
      }
      if (!img.url || typeof img.url !== 'string') {
        errors.push(`images[${i}].url is required and must be a string`);
      }
      if (typeof img.isPrimary !== 'boolean') {
        errors.push(`images[${i}].isPrimary must be a boolean`);
      }
      if (img.isPrimary) hasPrimary = true;
    });

    if (bundle.images.length > 0 && !hasPrimary) {
      errors.push('At least one image must be marked as primary');
    }
  }

  // Validate metadata
  if (!bundle.metadata || typeof bundle.metadata !== 'object') {
    errors.push('metadata is required and must be an object');
  }

  // Validate booleans
  if (typeof bundle.requiresShipping !== 'boolean') {
    errors.push('requiresShipping must be a boolean');
  }

  if (typeof bundle.taxable !== 'boolean') {
    errors.push('taxable must be a boolean');
  }

  if (typeof bundle.published !== 'boolean') {
    errors.push('published must be a boolean');
  }

  // Validate dates
  if (bundle.availableFrom !== undefined && !(bundle.availableFrom instanceof Date)) {
    errors.push('availableFrom must be a Date when provided');
  }

  if (bundle.availableTo !== undefined && !(bundle.availableTo instanceof Date)) {
    errors.push('availableTo must be a Date when provided');
  }

  if (bundle.availableFrom && bundle.availableTo && bundle.availableFrom > bundle.availableTo) {
    errors.push('availableFrom must be before availableTo');
  }

  // Validate timestamps
  if (!bundle.createdAt || !(bundle.createdAt instanceof Date)) {
    errors.push('createdAt is required and must be a Date');
  }

  if (!bundle.lastModifiedAt || !(bundle.lastModifiedAt instanceof Date)) {
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
export function createBundleItem(data: {
  productId: string;
  variantId: string;
  quantity: number;
  isRequired?: boolean;
  price?: number;
  discountedPrice?: number;
  sortOrder?: number;
  minQuantity?: number;
  maxQuantity?: number;
}): BundleItem {
  return {
    id: uuidv4(),
    productId: data.productId,
    variantId: data.variantId,
    quantity: data.quantity,
    isRequired: data.isRequired !== undefined ? data.isRequired : true,
    minQuantity: data.minQuantity,
    maxQuantity: data.maxQuantity,
    price: data.price,
    discountedPrice: data.discountedPrice,
    sortOrder: data.sortOrder || 0
  };
}

export function calculateBundlePrice(items: BundleItem[], pricingType: BundlePricingType, discount?: number): number {
  const totalOriginal = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  
  switch (pricingType) {
    case 'calculated':
      return items.reduce((sum, item) => sum + (item.discountedPrice || item.price || 0) * item.quantity, 0);
    case 'discount_percentage':
      return totalOriginal * (1 - (discount || 0) / 100);
    case 'discount_amount':
      return Math.max(0, totalOriginal - (discount || 0));
    case 'fixed':
    default:
      return totalOriginal; // Will be overridden by fixed price
  }
}

export function createBundledProduct(data: {
  sku: string;
  name: string;
  description: string;
  bundleItems: BundleItem[];
  pricingType: BundlePricingType;
  price?: number;
  currency: string;
  images: BundleImage[];
  status?: BundleStatus;
  type?: BundleType;
  compareAtPrice?: number;
  category?: string[];
  tags?: string[];
  vendorId?: string;
  availableFrom?: Date;
  availableTo?: Date;
  maxPurchaseQuantity?: number;
  requiresShipping?: boolean;
  taxable?: boolean;
  published?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
}): BundledProduct {
  const now = new Date();
  
  // Calculate metadata
  const originalPrice = data.bundleItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const bundlePrice = data.price || calculateBundlePrice(data.bundleItems, data.pricingType);
  const savings = originalPrice - bundlePrice;
  const savingsPercentage = originalPrice > 0 ? (savings / originalPrice) * 100 : 0;

  const bundle: BundledProduct = {
    bundleId: uuidv4(),
    sku: data.sku,
    name: data.name,
    description: data.description,
    status: data.status || 'draft',
    type: data.type || 'fixed',
    pricingType: data.pricingType,
    price: bundlePrice,
    compareAtPrice: data.compareAtPrice || originalPrice,
    currency: data.currency,
    bundleItems: data.bundleItems,
    images: data.images,
    category: data.category,
    tags: data.tags,
    metadata: {
      originalPrice,
      savings,
      savingsPercentage
    },
    vendorId: data.vendorId,
    availableFrom: data.availableFrom,
    availableTo: data.availableTo,
    maxPurchaseQuantity: data.maxPurchaseQuantity,
    requiresShipping: data.requiresShipping !== undefined ? data.requiresShipping : true,
    taxable: data.taxable !== undefined ? data.taxable : true,
    published: data.published || false,
    publishedAt: data.published ? now : undefined,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    seoKeywords: data.seoKeywords,
    createdAt: now,
    lastModifiedAt: now
  };

  // Calculate weight if physical products
  if (bundle.requiresShipping) {
    // This would normally calculate from product data
    bundle.weight = data.bundleItems.reduce((sum, item) => sum + (item.quantity * 0.5), 0); // Placeholder
    bundle.weightUnit = 'kg';
  }

  // Validate before returning
  const validation = validateBundledProduct(bundle);
  if (!validation.valid) {
    throw new Error(`Invalid bundled product: ${validation.errors.join(', ')}`);
  }

  return bundle;
}

// Bundled Products Repository class for database operations
export class BundledProductRepository {
  private collection: Collection<BundledProduct>;
  private db: Db;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection<BundledProduct>('bundled_products');
    this.ensureIndexes();
  }

  private async ensureIndexes() {
    // Create unique indexes
    await this.collection.createIndex(
      { bundleId: 1 },
      { unique: true }
    );
    
    await this.collection.createIndex(
      { sku: 1 },
      { unique: true }
    );
    
    // Create other useful indexes
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ type: 1 });
    await this.collection.createIndex({ name: 'text', description: 'text' }); // Text search
    await this.collection.createIndex({ 'bundleItems.productId': 1 });
    await this.collection.createIndex({ 'bundleItems.variantId': 1 });
    await this.collection.createIndex({ vendorId: 1 });
    await this.collection.createIndex({ published: 1 });
    await this.collection.createIndex({ category: 1 });
    await this.collection.createIndex({ tags: 1 });
    await this.collection.createIndex({ createdAt: -1 });
    
    // Compound indexes
    await this.collection.createIndex({ published: 1, status: 1 });
    await this.collection.createIndex({ vendorId: 1, published: 1 });
  }

  async create(bundleData: Parameters<typeof createBundledProduct>[0]): Promise<BundledProduct> {
    const bundle = createBundledProduct(bundleData);

    // Validate before inserting
    const validation = validateBundledProduct(bundle);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid bundled product: ${validation.errors.join(', ')}`);
    }

    await this.collection.insertOne(bundle as any);
    return bundle;
  }

  async findByBundleId(bundleId: string): Promise<BundledProduct | null> {
    return this.collection.findOne({ bundleId }) as Promise<BundledProduct | null>;
  }

  async findBySku(sku: string): Promise<BundledProduct | null> {
    return this.collection.findOne({ sku }) as Promise<BundledProduct | null>;
  }

  async findByProductId(productId: string): Promise<BundledProduct[]> {
    return this.collection.find({
      'bundleItems.productId': productId
    }).toArray() as Promise<BundledProduct[]>;
  }

  async findByVariantId(variantId: string): Promise<BundledProduct[]> {
    return this.collection.find({
      'bundleItems.variantId': variantId
    }).toArray() as Promise<BundledProduct[]>;
  }

  async findPublished(): Promise<BundledProduct[]> {
    const now = new Date();
    return this.collection.find({
      published: true,
      status: 'active',
      $or: [
        { availableFrom: { $exists: false } },
        { availableFrom: { $lte: now } }
      ],
      $and: [
        { $or: [
          { availableTo: { $exists: false } },
          { availableTo: { $gte: now } }
        ]}
      ]
    }).toArray() as Promise<BundledProduct[]>;
  }

  async findByVendor(vendorId: string, publishedOnly: boolean = false): Promise<BundledProduct[]> {
    const filter: any = { vendorId };
    if (publishedOnly) {
      filter.published = true;
      filter.status = 'active';
    }
    return this.collection.find(filter).toArray() as Promise<BundledProduct[]>;
  }

  async update(bundleId: string, updates: Partial<BundledProduct>): Promise<BundledProduct | null> {
    // Don't allow changing bundleId or createdAt
    delete (updates as any).bundleId;
    delete (updates as any).createdAt;
    
    // Recalculate metadata if items or pricing changed
    if (updates.bundleItems || updates.pricingType || updates.price) {
      const current = await this.findByBundleId(bundleId);
      if (current) {
        const items = updates.bundleItems || current.bundleItems;
        const pricingType = updates.pricingType || current.pricingType;
        const price = updates.price || current.price;
        
        const originalPrice = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
        const savings = originalPrice - price;
        const savingsPercentage = originalPrice > 0 ? (savings / originalPrice) * 100 : 0;
        
        updates.metadata = {
          ...current.metadata,
          originalPrice,
          savings,
          savingsPercentage
        };
      }
    }
    
    // Update timestamps
    const updatesWithTimestamp = {
      ...updates,
      lastModifiedAt: new Date(),
      ...(updates.published && !updates.publishedAt ? { publishedAt: new Date() } : {})
    };

    const result = await this.collection.findOneAndUpdate(
      { bundleId },
      { $set: updatesWithTimestamp },
      { returnDocument: 'after' }
    );

    if (result) {
      // Validate the updated bundle
      const validation = validateBundledProduct(result);
      if (!validation.valid) {
        throw new Error(`Update resulted in invalid bundled product: ${validation.errors.join(', ')}`);
      }
    }

    return result as BundledProduct | null;
  }

  async updateStatus(bundleId: string, status: BundleStatus): Promise<BundledProduct | null> {
    return this.update(bundleId, { status });
  }

  async publish(bundleId: string): Promise<BundledProduct | null> {
    return this.update(bundleId, { 
      published: true, 
      publishedAt: new Date(),
      status: 'active'
    });
  }

  async unpublish(bundleId: string): Promise<BundledProduct | null> {
    return this.update(bundleId, { published: false });
  }

  async delete(bundleId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ bundleId });
    return result.deletedCount === 1;
  }

  async search(query: string): Promise<BundledProduct[]> {
    return this.collection.find({
      $text: { $search: query },
      published: true,
      status: 'active'
    }).toArray() as Promise<BundledProduct[]>;
  }

  async findByCategory(category: string): Promise<BundledProduct[]> {
    return this.collection.find({
      category: category,
      published: true,
      status: 'active'
    }).toArray() as Promise<BundledProduct[]>;
  }

  async findByTags(tags: string[]): Promise<BundledProduct[]> {
    return this.collection.find({
      tags: { $in: tags },
      published: true,
      status: 'active'
    }).toArray() as Promise<BundledProduct[]>;
  }

  async checkInventoryAvailability(bundleId: string): Promise<boolean> {
    // This would check inventory for all bundle items
    // Placeholder implementation - would integrate with inventory system
    const bundle = await this.findByBundleId(bundleId);
    if (!bundle) return false;

    // Check each item's inventory
    for (const item of bundle.bundleItems) {
      // Would check actual inventory here
      // const inventory = await inventoryRepo.findByVariantId(item.variantId);
      // if (!inventory || inventory.available < item.quantity) return false;
    }

    return true;
  }

  async findAll(filter: Partial<BundledProduct> = {}): Promise<BundledProduct[]> {
    return this.collection.find(filter)
      .sort({ createdAt: -1 })
      .toArray() as Promise<BundledProduct[]>;
  }
}

export default BundledProductRepository;