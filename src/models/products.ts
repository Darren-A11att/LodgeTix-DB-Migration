import { v4 as uuidv4 } from 'uuid';
import { Db, Collection } from 'mongodb';

// Products Schema Type Definitions (Simplified Catalog)
// This is an alternative/simplified products schema for catalog management
// The existing 'product' schema in product.ts is more comprehensive

export type ProductStatus = 'active' | 'inactive' | 'discontinued' | 'coming_soon';
export type ProductCondition = 'new' | 'refurbished' | 'used' | 'open_box';
export type FulfillmentType = 'ship' | 'pickup' | 'digital' | 'service';

export interface ProductPrice {
  amount: number;
  currency: string;
  compareAt?: number; // Original price for showing discounts
  validFrom?: Date;
  validTo?: Date;
}

export interface ProductStock {
  quantity: number;
  reserved: number;
  available: number; // quantity - reserved
  warehouse?: string;
  restockDate?: Date;
  lowStockThreshold?: number;
}

export interface ProductShipping {
  weight: number;
  weightUnit: string;
  length?: number;
  width?: number;
  height?: number;
  dimensionUnit?: string;
  freeShipping: boolean;
  shippingClass?: string;
}

export interface ProductRating {
  average: number; // 1-5
  count: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface Products {
  productId: string; // UUID v4
  sku: string; // Stock keeping unit
  barcode?: string; // EAN, UPC, etc.
  name: string;
  slug: string; // URL-friendly name
  description: string;
  shortDescription?: string;
  status: ProductStatus;
  condition: ProductCondition;
  brand?: string;
  manufacturer?: string;
  model?: string;
  price: ProductPrice;
  stock: ProductStock;
  categories: string[];
  tags: string[];
  images: string[]; // Array of image URLs
  thumbnailUrl?: string;
  fulfillmentTypes: FulfillmentType[];
  shipping?: ProductShipping;
  vendorId: string;
  vendorSku?: string; // Vendor's own SKU
  rating?: ProductRating;
  featured: boolean;
  bestseller: boolean;
  newArrival: boolean;
  onSale: boolean;
  attributes?: Record<string, any>; // Flexible attributes
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  relatedProducts?: string[]; // Product IDs
  crossSellProducts?: string[]; // Product IDs
  upSellProducts?: string[]; // Product IDs
  warranty?: string;
  returnPolicy?: string;
  viewCount: number;
  purchaseCount: number;
  createdAt: Date;
  lastModifiedAt: Date;
}

// Validation functions
export function validateProducts(product: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!product.productId || typeof product.productId !== 'string') {
    errors.push('productId is required and must be a string');
  } else if (!isValidUUID(product.productId)) {
    errors.push('productId must be a valid UUID v4');
  }

  if (!product.sku || typeof product.sku !== 'string') {
    errors.push('sku is required and must be a string');
  }

  if (!product.name || typeof product.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  if (!product.slug || typeof product.slug !== 'string') {
    errors.push('slug is required and must be a string');
  } else if (!isValidSlug(product.slug)) {
    errors.push('slug must be URL-friendly (lowercase, hyphens only)');
  }

  if (!product.description || typeof product.description !== 'string') {
    errors.push('description is required and must be a string');
  }

  // Validate enums
  const validStatuses: ProductStatus[] = ['active', 'inactive', 'discontinued', 'coming_soon'];
  if (!product.status || !validStatuses.includes(product.status)) {
    errors.push(`status must be one of: ${validStatuses.join(', ')}`);
  }

  const validConditions: ProductCondition[] = ['new', 'refurbished', 'used', 'open_box'];
  if (!product.condition || !validConditions.includes(product.condition)) {
    errors.push(`condition must be one of: ${validConditions.join(', ')}`);
  }

  // Validate price
  if (!product.price || typeof product.price !== 'object') {
    errors.push('price is required and must be an object');
  } else {
    if (typeof product.price.amount !== 'number' || product.price.amount < 0) {
      errors.push('price.amount must be a non-negative number');
    }
    if (!product.price.currency || typeof product.price.currency !== 'string' || product.price.currency.length !== 3) {
      errors.push('price.currency must be a 3-letter ISO currency code');
    }
    if (product.price.compareAt !== undefined && (typeof product.price.compareAt !== 'number' || product.price.compareAt < 0)) {
      errors.push('price.compareAt must be a non-negative number when provided');
    }
  }

  // Validate stock
  if (!product.stock || typeof product.stock !== 'object') {
    errors.push('stock is required and must be an object');
  } else {
    if (typeof product.stock.quantity !== 'number' || product.stock.quantity < 0) {
      errors.push('stock.quantity must be a non-negative number');
    }
    if (typeof product.stock.reserved !== 'number' || product.stock.reserved < 0) {
      errors.push('stock.reserved must be a non-negative number');
    }
    if (typeof product.stock.available !== 'number') {
      errors.push('stock.available must be a number');
    }
    
    // Validate stock calculation
    const expectedAvailable = product.stock.quantity - product.stock.reserved;
    if (Math.abs(product.stock.available - expectedAvailable) > 0.01) {
      errors.push(`stock.available must equal quantity - reserved. Expected ${expectedAvailable}, got ${product.stock.available}`);
    }
  }

  // Validate arrays
  if (!Array.isArray(product.categories)) {
    errors.push('categories must be an array');
  }

  if (!Array.isArray(product.tags)) {
    errors.push('tags must be an array');
  }

  if (!Array.isArray(product.images)) {
    errors.push('images must be an array');
  }

  if (!Array.isArray(product.fulfillmentTypes)) {
    errors.push('fulfillmentTypes must be an array');
  } else {
    const validFulfillmentTypes: FulfillmentType[] = ['ship', 'pickup', 'digital', 'service'];
    product.fulfillmentTypes.forEach((type: any) => {
      if (!validFulfillmentTypes.includes(type)) {
        errors.push(`fulfillmentTypes must contain only: ${validFulfillmentTypes.join(', ')}`);
      }
    });
  }

  // Validate vendorId
  if (!product.vendorId || typeof product.vendorId !== 'string') {
    errors.push('vendorId is required and must be a string');
  }

  // Validate booleans
  if (typeof product.featured !== 'boolean') {
    errors.push('featured must be a boolean');
  }
  if (typeof product.bestseller !== 'boolean') {
    errors.push('bestseller must be a boolean');
  }
  if (typeof product.newArrival !== 'boolean') {
    errors.push('newArrival must be a boolean');
  }
  if (typeof product.onSale !== 'boolean') {
    errors.push('onSale must be a boolean');
  }

  // Validate counts
  if (typeof product.viewCount !== 'number' || product.viewCount < 0) {
    errors.push('viewCount must be a non-negative number');
  }
  if (typeof product.purchaseCount !== 'number' || product.purchaseCount < 0) {
    errors.push('purchaseCount must be a non-negative number');
  }

  // Validate rating if present
  if (product.rating !== undefined) {
    if (typeof product.rating !== 'object') {
      errors.push('rating must be an object when provided');
    } else {
      if (typeof product.rating.average !== 'number' || product.rating.average < 1 || product.rating.average > 5) {
        errors.push('rating.average must be between 1 and 5');
      }
      if (typeof product.rating.count !== 'number' || product.rating.count < 0) {
        errors.push('rating.count must be a non-negative number');
      }
    }
  }

  // Validate timestamps
  if (!product.createdAt || !(product.createdAt instanceof Date)) {
    errors.push('createdAt is required and must be a Date');
  }

  if (!product.lastModifiedAt || !(product.lastModifiedAt instanceof Date)) {
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

function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
}

// Helper functions
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export function createProducts(data: {
  sku: string;
  name: string;
  description: string;
  price: ProductPrice;
  vendorId: string;
  status?: ProductStatus;
  condition?: ProductCondition;
  slug?: string;
  shortDescription?: string;
  barcode?: string;
  brand?: string;
  manufacturer?: string;
  model?: string;
  stock?: Partial<ProductStock>;
  categories?: string[];
  tags?: string[];
  images?: string[];
  thumbnailUrl?: string;
  fulfillmentTypes?: FulfillmentType[];
  shipping?: ProductShipping;
  vendorSku?: string;
  featured?: boolean;
  bestseller?: boolean;
  newArrival?: boolean;
  onSale?: boolean;
  attributes?: Record<string, any>;
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  warranty?: string;
  returnPolicy?: string;
}): Products {
  const now = new Date();
  const stock = {
    quantity: data.stock?.quantity || 0,
    reserved: data.stock?.reserved || 0,
    available: (data.stock?.quantity || 0) - (data.stock?.reserved || 0),
    warehouse: data.stock?.warehouse,
    restockDate: data.stock?.restockDate,
    lowStockThreshold: data.stock?.lowStockThreshold
  };

  const product: Products = {
    productId: uuidv4(),
    sku: data.sku,
    barcode: data.barcode,
    name: data.name,
    slug: data.slug || generateSlug(data.name),
    description: data.description,
    shortDescription: data.shortDescription,
    status: data.status || 'active',
    condition: data.condition || 'new',
    brand: data.brand,
    manufacturer: data.manufacturer,
    model: data.model,
    price: data.price,
    stock,
    categories: data.categories || [],
    tags: data.tags || [],
    images: data.images || [],
    thumbnailUrl: data.thumbnailUrl || data.images?.[0],
    fulfillmentTypes: data.fulfillmentTypes || ['ship'],
    shipping: data.shipping,
    vendorId: data.vendorId,
    vendorSku: data.vendorSku,
    featured: data.featured || false,
    bestseller: data.bestseller || false,
    newArrival: data.newArrival || false,
    onSale: data.onSale || (data.price.compareAt ? data.price.amount < data.price.compareAt : false),
    attributes: data.attributes,
    seo: data.seo,
    warranty: data.warranty,
    returnPolicy: data.returnPolicy,
    viewCount: 0,
    purchaseCount: 0,
    createdAt: now,
    lastModifiedAt: now
  };

  // Validate before returning
  const validation = validateProducts(product);
  if (!validation.valid) {
    throw new Error(`Invalid product: ${validation.errors.join(', ')}`);
  }

  return product;
}

// Products Repository class for database operations
export class ProductsRepository {
  private collection: Collection<Products>;
  private db: Db;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection<Products>('products');
    this.ensureIndexes();
  }

  private async ensureIndexes() {
    // Create unique indexes
    await this.collection.createIndex(
      { productId: 1 },
      { unique: true }
    );
    
    await this.collection.createIndex(
      { sku: 1 },
      { unique: true }
    );
    
    await this.collection.createIndex(
      { slug: 1 },
      { unique: true }
    );
    
    // Create other useful indexes
    await this.collection.createIndex({ name: 'text', description: 'text' }); // Text search
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ vendorId: 1 });
    await this.collection.createIndex({ categories: 1 });
    await this.collection.createIndex({ tags: 1 });
    await this.collection.createIndex({ brand: 1 });
    await this.collection.createIndex({ 'price.amount': 1 });
    await this.collection.createIndex({ 'stock.available': 1 });
    await this.collection.createIndex({ featured: 1 });
    await this.collection.createIndex({ bestseller: 1 });
    await this.collection.createIndex({ newArrival: 1 });
    await this.collection.createIndex({ onSale: 1 });
    await this.collection.createIndex({ createdAt: -1 });
    await this.collection.createIndex({ purchaseCount: -1 }); // For bestsellers
    await this.collection.createIndex({ viewCount: -1 }); // For popular products
    
    // Compound indexes
    await this.collection.createIndex({ status: 1, vendorId: 1 });
    await this.collection.createIndex({ status: 1, featured: 1 });
    await this.collection.createIndex({ categories: 1, status: 1 });
  }

  async create(productData: Parameters<typeof createProducts>[0]): Promise<Products> {
    const product = createProducts(productData);

    // Validate before inserting
    const validation = validateProducts(product);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid product: ${validation.errors.join(', ')}`);
    }

    await this.collection.insertOne(product as any);
    return product;
  }

  async findByProductId(productId: string): Promise<Products | null> {
    return this.collection.findOne({ productId }) as Promise<Products | null>;
  }

  async findBySku(sku: string): Promise<Products | null> {
    return this.collection.findOne({ sku }) as Promise<Products | null>;
  }

  async findBySlug(slug: string): Promise<Products | null> {
    return this.collection.findOne({ slug }) as Promise<Products | null>;
  }

  async update(productId: string, updates: Partial<Products>): Promise<Products | null> {
    // Don't allow changing productId, sku, or createdAt
    delete (updates as any).productId;
    delete (updates as any).sku;
    delete (updates as any).createdAt;
    
    // Recalculate stock available if quantity or reserved changes
    if (updates.stock) {
      const current = await this.findByProductId(productId);
      if (current) {
        const quantity = updates.stock.quantity !== undefined ? updates.stock.quantity : current.stock.quantity;
        const reserved = updates.stock.reserved !== undefined ? updates.stock.reserved : current.stock.reserved;
        updates.stock.available = quantity - reserved;
      }
    }
    
    // Update slug if name changes
    if (updates.name && !updates.slug) {
      updates.slug = generateSlug(updates.name);
    }
    
    // Update onSale flag if price changes
    if (updates.price) {
      updates.onSale = updates.price.compareAt ? updates.price.amount < updates.price.compareAt : false;
    }
    
    // Always update lastModifiedAt
    const updatesWithTimestamp = {
      ...updates,
      lastModifiedAt: new Date()
    };

    const result = await this.collection.findOneAndUpdate(
      { productId },
      { $set: updatesWithTimestamp },
      { returnDocument: 'after' }
    );

    if (result) {
      // Validate the updated product
      const validation = validateProducts(result);
      if (!validation.valid) {
        throw new Error(`Update resulted in invalid product: ${validation.errors.join(', ')}`);
      }
    }

    return result as Products | null;
  }

  async updateStock(productId: string, quantity: number, reserved?: number): Promise<Products | null> {
    const product = await this.findByProductId(productId);
    if (!product) return null;

    const newReserved = reserved !== undefined ? reserved : product.stock.reserved;
    return this.update(productId, {
      stock: {
        ...product.stock,
        quantity,
        reserved: newReserved,
        available: quantity - newReserved
      }
    });
  }

  async incrementViewCount(productId: string): Promise<void> {
    await this.collection.updateOne(
      { productId },
      { 
        $inc: { viewCount: 1 },
        $set: { lastModifiedAt: new Date() }
      }
    );
  }

  async incrementPurchaseCount(productId: string, quantity: number = 1): Promise<void> {
    await this.collection.updateOne(
      { productId },
      { 
        $inc: { purchaseCount: quantity },
        $set: { lastModifiedAt: new Date() }
      }
    );
  }

  async updateRating(productId: string, rating: number): Promise<Products | null> {
    const product = await this.findByProductId(productId);
    if (!product) return null;

    const currentRating = product.rating || {
      average: 0,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };

    const newCount = currentRating.count + 1;
    const newAverage = ((currentRating.average * currentRating.count) + rating) / newCount;
    currentRating.distribution[rating as 1 | 2 | 3 | 4 | 5]++;

    return this.update(productId, {
      rating: {
        average: newAverage,
        count: newCount,
        distribution: currentRating.distribution
      }
    });
  }

  async findByVendor(vendorId: string, status?: ProductStatus): Promise<Products[]> {
    const filter: any = { vendorId };
    if (status) filter.status = status;
    return this.collection.find(filter)
      .sort({ createdAt: -1 })
      .toArray() as Promise<Products[]>;
  }

  async findByCategory(category: string, activeOnly: boolean = true): Promise<Products[]> {
    const filter: any = { categories: category };
    if (activeOnly) filter.status = 'active';
    return this.collection.find(filter).toArray() as Promise<Products[]>;
  }

  async findFeatured(): Promise<Products[]> {
    return this.collection.find({
      featured: true,
      status: 'active'
    }).toArray() as Promise<Products[]>;
  }

  async findBestsellers(limit: number = 10): Promise<Products[]> {
    return this.collection.find({
      status: 'active'
    })
      .sort({ purchaseCount: -1 })
      .limit(limit)
      .toArray() as Promise<Products[]>;
  }

  async findOnSale(): Promise<Products[]> {
    return this.collection.find({
      onSale: true,
      status: 'active'
    }).toArray() as Promise<Products[]>;
  }

  async search(query: string): Promise<Products[]> {
    return this.collection.find({
      $text: { $search: query },
      status: 'active'
    }).toArray() as Promise<Products[]>;
  }

  async findLowStock(threshold?: number): Promise<Products[]> {
    return this.collection.find({
      $or: [
        { 'stock.available': { $lte: threshold || 10 } },
        { $expr: { $lte: ['$stock.available', '$stock.lowStockThreshold'] } }
      ]
    }).toArray() as Promise<Products[]>;
  }

  async delete(productId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ productId });
    return result.deletedCount === 1;
  }

  async findAll(filter: Partial<Products> = {}): Promise<Products[]> {
    return this.collection.find(filter)
      .sort({ createdAt: -1 })
      .toArray() as Promise<Products[]>;
  }
}

export default ProductsRepository;