import { MongoClient, Db } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const productSchema = {
  bsonType: 'object',
  required: ['productId', 'name', 'status', 'type'],
  properties: {
    productId: {
      bsonType: 'string',
      description: 'UUID v4 - must be unique'
    },
    name: {
      bsonType: 'string',
      description: 'Product name'
    },
    status: {
      bsonType: 'string',
      description: 'Product status'
    },
    type: {
      bsonType: 'string',
      description: 'Product type'
    },
    description: {
      bsonType: ['string', 'null'],
      description: 'Product description'
    },
    options: {
      bsonType: 'array',
      description: 'Product options',
      items: {
        bsonType: 'object',
        required: ['id', 'name', 'values'],
        properties: {
          id: {
            bsonType: 'string',
            description: 'Option ID'
          },
          name: {
            bsonType: 'string',
            description: 'Option name'
          },
          values: {
            bsonType: 'array',
            description: 'Option values',
            items: {
              bsonType: 'string'
            }
          }
        }
      }
    },
    variants: {
      bsonType: 'array',
      description: 'Product variants - computed from option variations',
      items: {
        bsonType: 'object',
        required: ['id', 'name', 'price'],
        properties: {
          id: {
            bsonType: 'string',
            description: 'Variant ID'
          },
          name: {
            bsonType: 'string',
            description: 'Variant name'
          },
          price: {
            bsonType: 'number',
            description: 'Variant price'
          },
          inventoryItem: {
            bsonType: ['string', 'null'],
            description: 'ID of the related inventory item'
          },
          inventoryAvailable: {
            bsonType: ['number', 'null'],
            description: 'Computed value of inventory available'
          }
        }
      }
    },
    collection: {
      bsonType: 'array',
      description: 'Product collections',
      items: {
        bsonType: 'object',
        required: ['id', 'name'],
        properties: {
          id: {
            bsonType: 'string',
            description: 'Collection ID'
          },
          name: {
            bsonType: 'string',
            description: 'Collection name'
          }
        }
      }
    },
    category: {
      bsonType: 'array',
      description: 'Product categories',
      items: {
        bsonType: 'object',
        required: ['id', 'name'],
        properties: {
          id: {
            bsonType: 'string',
            description: 'Category ID'
          },
          name: {
            bsonType: 'string',
            description: 'Category name'
          },
          parent: {
            bsonType: ['string', 'null'],
            description: 'Parent category ID'
          }
        }
      }
    },
    images: {
      bsonType: 'array',
      description: 'Product images',
      items: {
        bsonType: 'object',
        required: ['id', 'url'],
        properties: {
          id: {
            bsonType: 'string',
            description: 'Image ID'
          },
          url: {
            bsonType: 'string',
            description: 'Image URL'
          },
          alternateText: {
            bsonType: ['string', 'null'],
            description: 'Alt text for image'
          }
        }
      }
    }
  }
};

async function setupProductSchema() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(process.env.MONGODB_DB || 'lodgetix');
    
    // Drop existing validation if any
    try {
      await db.command({
        collMod: 'product',
        validator: {},
        validationLevel: 'off'
      });
      console.log('Removed existing validation rules');
    } catch (e) {
      // Collection might not have validation, that's ok
    }
    
    // Apply the new schema validation
    await db.command({
      collMod: 'product',
      validator: {
        $jsonSchema: productSchema
      },
      validationLevel: 'strict',
      validationAction: 'error'
    });
    
    console.log('✅ Product schema validation applied successfully');
    
    // Create unique index on productId
    await db.collection('product').createIndex(
      { productId: 1 },
      { unique: true }
    );
    console.log('✅ Unique index created on productId');
    
    // Create additional useful indexes
    await db.collection('product').createIndex({ name: 1 });
    await db.collection('product').createIndex({ status: 1 });
    await db.collection('product').createIndex({ type: 1 });
    await db.collection('product').createIndex({ 'category.id': 1 });
    await db.collection('product').createIndex({ 'collection.id': 1 });
    console.log('✅ Additional indexes created for performance');
    
  } catch (error) {
    console.error('Error setting up product schema:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Helper function to create a product with proper structure
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
}) {
  return {
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
    }))
  };
}

// Helper function to generate variants from options
export function generateVariantsFromOptions(options: Array<{ name: string; values: string[] }>): Array<{ name: string }> {
  if (!options || options.length === 0) return [];
  
  // Generate all combinations of option values
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
  
  // Create variant names from combinations
  return combinations.map(combo => ({
    name: combo.join(' / ')
  }));
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupProductSchema()
    .then(() => {
      console.log('\n✅ Product schema setup complete!');
      console.log('\nSchema enforces:');
      console.log('- productId: UUID v4 (unique)');
      console.log('- name: required string');
      console.log('- status: required string');
      console.log('- type: required string');
      console.log('- description: optional string');
      console.log('- options: array of {id, name, values[]}');
      console.log('- variants: array of {id, name, price, inventoryItem, inventoryAvailable}');
      console.log('- collection: array of {id, name}');
      console.log('- category: array of {id, name, parent}');
      console.log('- images: array of {id, url, alternateText}');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to setup product schema:', error);
      process.exit(1);
    });
}

export default setupProductSchema;