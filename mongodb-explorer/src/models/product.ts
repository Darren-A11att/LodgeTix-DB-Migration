import { v4 as uuidv4 } from 'uuid';
import { Db, Collection } from 'mongodb';

// Product Schema Type Definition
export interface ProductOption {
  id: string;
  name: string;
  values: string[];
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  inventoryItem?: string | null;
  inventoryAvailable?: number | null;
}

export interface ProductCollection {
  id: string;
  name: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  parent?: string | null;
}

export interface ProductImage {
  id: string;
  url: string;
  alternateText?: string | null;
}

export interface Product {
  productId: string; // UUID v4, unique
  name: string;
  status: string;
  type: string;
  description?: string | null;
  options?: ProductOption[];
  variants?: ProductVariant[];
  collection?: ProductCollection[];
  category?: ProductCategory[];
  images?: ProductImage[];
  createdAt: Date;
  lastModifiedAt: Date;
}

// Validation functions
export function validateProduct(product: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!product.productId || typeof product.productId !== 'string') {
    errors.push('productId is required and must be a string');
  } else if (!isValidUUID(product.productId)) {
    errors.push('productId must be a valid UUID v4');
  }

  if (!product.name || typeof product.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  if (!product.status || typeof product.status !== 'string') {
    errors.push('status is required and must be a string');
  }

  if (!product.type || typeof product.type !== 'string') {
    errors.push('type is required and must be a string');
  }

  // Validate timestamps
  if (!product.createdAt || !(product.createdAt instanceof Date)) {
    errors.push('createdAt is required and must be a Date');
  }

  if (!product.lastModifiedAt || !(product.lastModifiedAt instanceof Date)) {
    errors.push('lastModifiedAt is required and must be a Date');
  }

  // Optional fields validation
  if (product.description !== undefined && product.description !== null && typeof product.description !== 'string') {
    errors.push('description must be a string or null');
  }

  // Validate options array
  if (product.options !== undefined) {
    if (!Array.isArray(product.options)) {
      errors.push('options must be an array');
    } else {
      product.options.forEach((opt: any, i: number) => {
        if (!opt.id || typeof opt.id !== 'string') {
          errors.push(`options[${i}].id is required and must be a string`);
        }
        if (!opt.name || typeof opt.name !== 'string') {
          errors.push(`options[${i}].name is required and must be a string`);
        }
        if (!Array.isArray(opt.values)) {
          errors.push(`options[${i}].values must be an array`);
        }
      });
    }
  }

  // Validate variants array
  if (product.variants !== undefined) {
    if (!Array.isArray(product.variants)) {
      errors.push('variants must be an array');
    } else {
      product.variants.forEach((variant: any, i: number) => {
        if (!variant.id || typeof variant.id !== 'string') {
          errors.push(`variants[${i}].id is required and must be a string`);
        }
        if (!variant.name || typeof variant.name !== 'string') {
          errors.push(`variants[${i}].name is required and must be a string`);
        }
        if (typeof variant.price !== 'number') {
          errors.push(`variants[${i}].price is required and must be a number`);
        }
      });
    }
  }

  // Validate collection array
  if (product.collection !== undefined) {
    if (!Array.isArray(product.collection)) {
      errors.push('collection must be an array');
    } else {
      product.collection.forEach((coll: any, i: number) => {
        if (!coll.id || typeof coll.id !== 'string') {
          errors.push(`collection[${i}].id is required and must be a string`);
        }
        if (!coll.name || typeof coll.name !== 'string') {
          errors.push(`collection[${i}].name is required and must be a string`);
        }
      });
    }
  }

  // Validate category array
  if (product.category !== undefined) {
    if (!Array.isArray(product.category)) {
      errors.push('category must be an array');
    } else {
      product.category.forEach((cat: any, i: number) => {
        if (!cat.id || typeof cat.id !== 'string') {
          errors.push(`category[${i}].id is required and must be a string`);
        }
        if (!cat.name || typeof cat.name !== 'string') {
          errors.push(`category[${i}].name is required and must be a string`);
        }
      });
    }
  }

  // Validate images array
  if (product.images !== undefined) {
    if (!Array.isArray(product.images)) {
      errors.push('images must be an array');
    } else {
      product.images.forEach((img: any, i: number) => {
        if (!img.id || typeof img.id !== 'string') {
          errors.push(`images[${i}].id is required and must be a string`);
        }
        if (!img.url || typeof img.url !== 'string') {
          errors.push(`images[${i}].url is required and must be a string`);
        }
      });
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

// Helper functions
export function createProduct(data: {
  name: string;
  status: string;
  type: string;
  description?: string;
  options?: Array<{
    id?: string;
    name: string;
    values: string[];
  }>;
  variants?: Array<{
    id?: string;
    name: string;
    price: number;
    inventoryItem?: string;
    inventoryAvailable?: number;
  }>;
  collection?: Array<{
    id: string;
    name: string;
  }>;
  category?: Array<{
    id: string;
    name: string;
    parent?: string;
  }>;
  images?: Array<{
    id?: string;
    url: string;
    alternateText?: string;
  }>;
}): Product {
  const now = new Date();
  const product: Product = {
    productId: uuidv4(),
    name: data.name,
    status: data.status,
    type: data.type,
    description: data.description || null,
    options: (data.options || []).map(opt => ({
      id: opt.id || uuidv4(),
      name: opt.name,
      values: opt.values
    })),
    variants: (data.variants || []).map(variant => ({
      id: variant.id || uuidv4(),
      name: variant.name,
      price: variant.price,
      inventoryItem: variant.inventoryItem || null,
      inventoryAvailable: variant.inventoryAvailable || null
    })),
    collection: data.collection || [],
    category: data.category || [],
    images: (data.images || []).map(img => ({
      id: img.id || uuidv4(),
      url: img.url,
      alternateText: img.alternateText || null
    })),
    createdAt: now,
    lastModifiedAt: now
  };

  // Validate before returning
  const validation = validateProduct(product);
  if (!validation.valid) {
    throw new Error(`Invalid product: ${validation.errors.join(', ')}`);
  }

  return product;
}

// Generate variants from options
export function generateVariantsFromOptions(
  options: ProductOption[],
  basePrice: number = 0
): Omit<ProductVariant, 'id'>[] {
  if (!options || options.length === 0) return [];
  
  const combinations: string[][] = [];
  
  function generateCombinations(index: number, current: string[]) {
    if (index === options.length) {
      combinations.push([...current]);
      return;
    }
    
    for (const value of options[index].values) {
      current.push(value);
      generateCombinations(index + 1, current);
      current.pop();
    }
  }
  
  generateCombinations(0, []);
  
  // Create variants from combinations
  return combinations.map(combo => ({
    name: combo.join(' / '),
    price: basePrice,
    inventoryItem: null,
    inventoryAvailable: null
  }));
}

// Product Repository class for database operations
export class ProductRepository {
  private collection: Collection<Product>;

  constructor(db: Db) {
    this.collection = db.collection<Product>('product');
    this.ensureIndexes();
  }

  private async ensureIndexes() {
    // Create unique index on productId
    await this.collection.createIndex(
      { productId: 1 },
      { unique: true }
    );
    
    // Create other useful indexes
    await this.collection.createIndex({ name: 1 });
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ type: 1 });
    await this.collection.createIndex({ 'category.id': 1 });
    await this.collection.createIndex({ 'collection.id': 1 });
  }

  async create(productData: Omit<Product, 'productId'> & { productId?: string }): Promise<Product> {
    const product = createProduct({
      name: productData.name,
      status: productData.status,
      type: productData.type,
      description: productData.description,
      options: productData.options,
      variants: productData.variants,
      collection: productData.collection,
      category: productData.category,
      images: productData.images
    });

    // Override productId if provided
    if (productData.productId) {
      product.productId = productData.productId;
    }

    // Validate before inserting
    const validation = validateProduct(product);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid product: ${validation.errors.join(', ')}`);
    }

    await this.collection.insertOne(product as any);
    return product;
  }

  async findByProductId(productId: string): Promise<Product | null> {
    return this.collection.findOne({ productId }) as Promise<Product | null>;
  }

  async update(productId: string, updates: Partial<Product>): Promise<Product | null> {
    // Don't allow changing productId or createdAt
    delete (updates as any).productId;
    delete (updates as any).createdAt;
    
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
      const validation = validateProduct(result);
      if (!validation.valid) {
        // Rollback if validation fails
        throw new Error(`Update resulted in invalid product: ${validation.errors.join(', ')}`);
      }
    }

    return result as Product | null;
  }

  async delete(productId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ productId });
    return result.deletedCount === 1;
  }

  async findByCategory(categoryId: string): Promise<Product[]> {
    return this.collection.find({ 'category.id': categoryId }).toArray() as Promise<Product[]>;
  }

  async findByCollection(collectionId: string): Promise<Product[]> {
    return this.collection.find({ 'collection.id': collectionId }).toArray() as Promise<Product[]>;
  }

  async findByStatus(status: string): Promise<Product[]> {
    return this.collection.find({ status }).toArray() as Promise<Product[]>;
  }

  async findAll(filter: Partial<Product> = {}): Promise<Product[]> {
    return this.collection.find(filter).toArray() as Promise<Product[]>;
  }
}

export default ProductRepository;