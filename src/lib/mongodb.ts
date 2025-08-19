import { MongoClient, Db } from 'mongodb';
import { CLUSTER_CONFIGS, getDatabaseById, getDefaultDatabase } from './database-selector';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env.local');
}

const options = {};

// Cache clients per cluster connection string
const clientCache = new Map<string, Promise<MongoClient>>();

/**
 * Parse database parameter to find the correct cluster and connection
 */
export function parseDatabase(databaseParam: string): {
  clusterId: string;
  databaseName: string;
  connectionString: string;
} | null {
  // Try to find database by ID first
  const databaseConfig = getDatabaseById(databaseParam);
  if (databaseConfig) {
    // Find which cluster this database belongs to
    for (const cluster of CLUSTER_CONFIGS) {
      if (cluster.databases.some(db => db.id === databaseConfig.id)) {
        return {
          clusterId: cluster.id,
          databaseName: databaseConfig.name,
          connectionString: databaseConfig.connectionString
        };
      }
    }
  }
  
  // Try to find by name in any cluster
  for (const cluster of CLUSTER_CONFIGS) {
    const found = cluster.databases.find(db => db.name === databaseParam);
    if (found) {
      return {
        clusterId: cluster.id,
        databaseName: found.name,
        connectionString: found.connectionString
      };
    }
  }
  
  return null;
}

function getClientForConnectionString(connectionString: string): Promise<MongoClient> {
  if (clientCache.has(connectionString)) {
    return clientCache.get(connectionString)!;
  }
  
  const client = new MongoClient(connectionString, options);
  const clientPromise = client.connect();
  
  clientCache.set(connectionString, clientPromise);
  return clientPromise;
}

// Legacy support - use default database
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

const defaultDb = getDefaultDatabase();
const uri = defaultDb.connectionString;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// New function for cluster-aware database connections
export async function connectToDatabase(databaseParam?: string): Promise<{ client: MongoClient; db: Db }> {
  if (!databaseParam) {
    // Use legacy default connection
    const database = getDefaultDatabase();
    const client = await clientPromise;
    const db = client.db(database.name);
    console.log('[MongoDB] Connected to default:', database.name);
    return { client, db };
  }
  
  // Parse database parameter to find correct cluster
  const dbInfo = parseDatabase(databaseParam);
  if (!dbInfo) {
    // Fallback to default cluster with database name
    const database = getDefaultDatabase();
    const client = await clientPromise;
    const db = client.db(databaseParam);
    console.log('[MongoDB] Connected to fallback:', databaseParam);
    return { client, db };
  }
  
  // Connect to specific cluster
  const client = await getClientForConnectionString(dbInfo.connectionString);
  const db = client.db(dbInfo.databaseName);
  
  console.log(`[MongoDB] Connected to: ${dbInfo.databaseName} on cluster: ${dbInfo.clusterId}`);
  return { client, db };
}

// Legacy function - connects to default database
export async function connectMongoDB(): Promise<{ client: MongoClient; db: Db }> {
  const database = getDefaultDatabase();
  console.log('[MongoDB] Connecting to:', database.connectionString.substring(0, 50) + '...');
  console.log('[MongoDB] Using database:', database.name);
  
  const client = await clientPromise;
  const db = client.db(database.name);
  console.log('[MongoDB] Connected successfully to database:', database.name);
  return { client, db };
}

export default clientPromise;