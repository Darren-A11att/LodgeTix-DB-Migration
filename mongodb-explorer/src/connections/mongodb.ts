import { MongoClient, Db, ServerApiVersion } from 'mongodb';
import { config } from '../config/environment';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongoDB(): Promise<{ client: MongoClient; db: Db }> {
  if (client && db) {
    return { client, db };
  }

  // Build connection URI with credentials
  let connectionUri = config.mongodb.uri;
  
  // Only replace if the URI contains the placeholder
  if (connectionUri.includes('<db_password>') && config.mongodb.password) {
    connectionUri = connectionUri.replace('<db_password>', encodeURIComponent(config.mongodb.password));
  }
  // If the URI already contains credentials, use it as-is

  // Create MongoClient with Server API version for MongoDB Atlas
  client = new MongoClient(connectionUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    // Test the connection
    await client.db('admin').command({ ping: 1 });
    
    db = client.db(config.mongodb.database);
    return { client, db };
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('Disconnected from MongoDB');
  }
}

export function getMongoDb(): Db {
  if (!db) {
    throw new Error('MongoDB not connected. Call connectMongoDB() first.');
  }
  return db;
}