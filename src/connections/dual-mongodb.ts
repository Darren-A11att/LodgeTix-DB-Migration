import { MongoClient, Db, ServerApiVersion, ClientSession } from 'mongodb';
import { config } from '../config/environment';

interface DatabaseConnections {
  source: {
    client: MongoClient | null;
    db: Db | null;
  };
  destination: {
    client: MongoClient | null;
    db: Db | null;
  };
}

const connections: DatabaseConnections = {
  source: { client: null, db: null },
  destination: { client: null, db: null }
};

/**
 * Connect to source database (dirty data)
 */
export async function connectSourceDB(): Promise<{ client: MongoClient; db: Db }> {
  if (connections.source.client && connections.source.db) {
    return { client: connections.source.client, db: connections.source.db };
  }

  // Build connection URI with credentials
  let connectionUri = config.mongodb.uri;
  
  // Only replace if the URI contains the placeholder
  if (connectionUri.includes('<db_password>') && config.mongodb.password) {
    connectionUri = connectionUri.replace('<db_password>', encodeURIComponent(config.mongodb.password));
  }

  // Create MongoClient with Server API version for MongoDB Atlas
  connections.source.client = new MongoClient(connectionUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  try {
    await connections.source.client.connect();
    console.log('Connected to Source MongoDB');
    
    // Test the connection
    await connections.source.client.db('admin').command({ ping: 1 });
    
    connections.source.db = connections.source.client.db(config.mongodb.database);
    return { 
      client: connections.source.client, 
      db: connections.source.db 
    };
  } catch (error) {
    console.error('Failed to connect to Source MongoDB:', error);
    throw error;
  }
}

/**
 * Connect to destination database (clean data)
 */
export async function connectDestinationDB(): Promise<{ client: MongoClient; db: Db }> {
  if (connections.destination.client && connections.destination.db) {
    return { client: connections.destination.client, db: connections.destination.db };
  }

  // Get destination database config from environment
  const destUri = process.env.NEW_MONGODB_URI;
  const destDatabase = process.env.NEW_MONGODB_DATABASE;

  if (!destUri || !destDatabase) {
    throw new Error('Destination database configuration missing. Check NEW_MONGODB_URI and NEW_MONGODB_DATABASE environment variables.');
  }

  // Create MongoClient for destination
  connections.destination.client = new MongoClient(destUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  try {
    await connections.destination.client.connect();
    console.log('Connected to Destination MongoDB');
    
    // Test the connection
    await connections.destination.client.db('admin').command({ ping: 1 });
    
    connections.destination.db = connections.destination.client.db(destDatabase);
    return { 
      client: connections.destination.client, 
      db: connections.destination.db 
    };
  } catch (error) {
    console.error('Failed to connect to Destination MongoDB:', error);
    throw error;
  }
}

/**
 * Connect to both databases
 */
export async function connectBothDBs(): Promise<{
  source: { client: MongoClient; db: Db };
  destination: { client: MongoClient; db: Db };
}> {
  const [source, destination] = await Promise.all([
    connectSourceDB(),
    connectDestinationDB()
  ]);

  return { source, destination };
}

/**
 * Disconnect from source database
 */
export async function disconnectSourceDB(): Promise<void> {
  if (connections.source.client) {
    await connections.source.client.close();
    connections.source.client = null;
    connections.source.db = null;
    console.log('Disconnected from Source MongoDB');
  }
}

/**
 * Disconnect from destination database
 */
export async function disconnectDestinationDB(): Promise<void> {
  if (connections.destination.client) {
    await connections.destination.client.close();
    connections.destination.client = null;
    connections.destination.db = null;
    console.log('Disconnected from Destination MongoDB');
  }
}

/**
 * Disconnect from both databases
 */
export async function disconnectBothDBs(): Promise<void> {
  await Promise.all([
    disconnectSourceDB(),
    disconnectDestinationDB()
  ]);
}

/**
 * Get source database
 */
export function getSourceDb(): Db {
  if (!connections.source.db) {
    throw new Error('Source MongoDB not connected. Call connectSourceDB() first.');
  }
  return connections.source.db;
}

/**
 * Get destination database
 */
export function getDestinationDb(): Db {
  if (!connections.destination.db) {
    throw new Error('Destination MongoDB not connected. Call connectDestinationDB() first.');
  }
  return connections.destination.db;
}

/**
 * Get destination client for transactions
 */
export function getDestinationClient(): MongoClient {
  if (!connections.destination.client) {
    throw new Error('Destination MongoDB not connected. Call connectDestinationDB() first.');
  }
  return connections.destination.client;
}

/**
 * Start a session for ACID transactions on destination database
 */
export function startDestinationSession(): ClientSession {
  const client = getDestinationClient();
  return client.startSession();
}

/**
 * Execute a migration with ACID transaction support
 */
export async function executeMigrationTransaction<T>(
  operation: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = startDestinationSession();
  
  try {
    const result = await session.withTransaction(async () => {
      return await operation(session);
    }, {
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary'
    });
    
    return result;
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  } finally {
    await session.endSession();
  }
}