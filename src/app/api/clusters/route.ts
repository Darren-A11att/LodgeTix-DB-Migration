import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MongoDB cluster configurations
const CLUSTER_CONFIGS = [
  {
    id: 'lodgetix-cluster',
    name: 'LodgeTix',
    description: 'Production cluster',
    uri: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.wydwfu6.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix'
  },
  {
    id: 'lodgetix-migration-test-1-cluster',
    name: 'LodgeTix-migration-test-1',
    description: 'Test/Migration cluster',
    uri: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1'
  }
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const includeCollections = searchParams.get('includeCollections') === 'true';
  
  try {
    const clustersWithDatabases = await Promise.all(
      CLUSTER_CONFIGS.map(async (cluster) => {
        let client: MongoClient | null = null;
        
        try {
          // Connect to cluster
          client = new MongoClient(cluster.uri);
          await client.connect();
          
          // Get admin database to list all databases
          const admin = client.db().admin();
          const dbList = await admin.listDatabases();
          
          // Process each database
          const databases = await Promise.all(
            dbList.databases.map(async (db) => {
              // Create shorter IDs to avoid MongoDB's 38-byte limit
              const shortClusterId = cluster.id === 'lodgetix-migration-test-1-cluster' ? 'lmt1' : 'lprod';
              const database: any = {
                id: `${shortClusterId}-${db.name}`,
                name: db.name,
                sizeOnDisk: db.sizeOnDisk,
                empty: db.empty
              };
              
              // Get collection count if requested
              if (includeCollections && !['admin', 'local', 'config'].includes(db.name)) {
                try {
                  const dbInstance = client!.db(db.name);
                  const collections = await dbInstance.listCollections().toArray();
                  database.collections = collections.map(c => c.name);
                  database.collectionCount = collections.length;
                } catch (error) {
                  console.error(`Error fetching collections for ${db.name}:`, error);
                  database.collections = [];
                  database.collectionCount = 0;
                }
              } else {
                database.collectionCount = 0;
              }
              
              // Add descriptions based on database name
              switch (db.name) {
                case 'admin':
                  database.description = 'MongoDB admin database';
                  break;
                case 'local':
                  database.description = 'MongoDB local database';
                  break;
                case 'config':
                  database.description = 'MongoDB config database';
                  break;
                case 'lodgetix':
                  database.description = 'Clean completed transactions';
                  database.isDefault = cluster.id === 'lodgetix-migration-test-1-cluster';
                  break;
                case 'LodgeTix':
                  database.description = 'Main production database';
                  break;
                case 'LodgeTix-migration-test-1':
                  database.description = cluster.id === 'lodgetix-cluster' 
                    ? 'Migration test database on production cluster'
                    : 'Main migration test database';
                  break;
                case 'commerce':
                  database.description = 'E-commerce database';
                  break;
                case 'projectCleanUp':
                  database.description = 'Project cleanup database';
                  break;
                case 'test':
                  database.description = 'Test database';
                  break;
                case 'UGLOps':
                  database.description = 'UGL Operations database';
                  break;
                case 'supabase':
                  database.description = 'Supabase migration database';
                  break;
                default:
                  database.description = `${db.name} database`;
              }
              
              // Build connection string for this specific database
              database.connectionString = cluster.uri.replace(
                /\/\?/,
                `/${db.name}?`
              );
              
              return database;
            })
          );
          
          return {
            ...cluster,
            databases: databases.sort((a, b) => {
              // Sort admin and local to the end
              if (['admin', 'local', 'config'].includes(a.name)) return 1;
              if (['admin', 'local', 'config'].includes(b.name)) return -1;
              return a.name.localeCompare(b.name);
            }),
            totalDatabases: databases.length,
            connected: true
          };
        } catch (error) {
          console.error(`Error connecting to cluster ${cluster.name}:`, error);
          return {
            ...cluster,
            databases: [],
            totalDatabases: 0,
            connected: false,
            error: (error as Error).message
          };
        } finally {
          if (client) {
            await client.close();
          }
        }
      })
    );
    
    return NextResponse.json({
      clusters: clustersWithDatabases,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching clusters:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch cluster information',
        message: (error as Error).message,
        details: 'Unable to connect to MongoDB clusters. Please verify cluster configurations and network connectivity.'
      },
      { status: 500 }
    );
  }
}