/**
 * Database selector utility with hierarchical cluster support
 */

export interface DatabaseConfig {
  id: string;
  name: string;
  description: string;
  connectionString: string;
  isDefault?: boolean;
  collections?: string[];
}

export interface ClusterConfig {
  id: string;
  name: string;
  description: string;
  baseConnectionString: string;
  databases: DatabaseConfig[];
}

export const CLUSTER_CONFIGS: ClusterConfig[] = [
  {
    id: 'lodgetix-cluster',
    name: 'LodgeTix',
    description: 'Production cluster',
    baseConnectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net',
    databases: [
      {
        id: 'lodgetix-db',
        name: 'LodgeTix',
        description: 'Main production database',
        connectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/LodgeTix?retryWrites=true&w=majority&appName=LodgeTix'
      },
      {
        id: 'lodgetix-migration-test-1-cluster1',
        name: 'LodgeTix-migration-test-1',
        description: 'Migration test database on production cluster',
        connectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority&appName=LodgeTix'
      },
      {
        id: 'admin-cluster1',
        name: 'admin',
        description: 'MongoDB admin database',
        connectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/admin?retryWrites=true&w=majority&appName=LodgeTix'
      },
      {
        id: 'local-cluster1',
        name: 'local',
        description: 'MongoDB local database',
        connectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/local?retryWrites=true&w=majority&appName=LodgeTix'
      }
    ]
  },
  {
    id: 'lodgetix-migration-test-1-cluster',
    name: 'LodgeTix-migration-test-1',
    description: 'Test/Migration cluster',
    baseConnectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net',
    databases: [
      {
        id: 'lodgetix-migration-test-1-db',
        name: 'LodgeTix-migration-test-1',
        description: 'Main migration test database',
        connectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority&appName=LodgeTix'
      },
      {
        id: 'admin-cluster2',
        name: 'admin',
        description: 'MongoDB admin database',
        connectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/admin?retryWrites=true&w=majority&appName=LodgeTix'
      },
      {
        id: 'commerce-db',
        name: 'commerce',
        description: 'E-commerce database',
        connectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/commerce?retryWrites=true&w=majority&appName=LodgeTix'
      },
      {
        id: 'local-cluster2',
        name: 'local',
        description: 'MongoDB local database',
        connectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/local?retryWrites=true&w=majority&appName=LodgeTix'
      },
      {
        id: 'lodgetix-clean-db',
        name: 'lodgetix',
        description: 'Clean completed transactions',
        connectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix',
        isDefault: true
      },
      {
        id: 'projectcleanup-db',
        name: 'projectCleanUp',
        description: 'Project cleanup database',
        connectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/projectCleanUp?retryWrites=true&w=majority&appName=LodgeTix'
      },
      {
        id: 'test-db',
        name: 'test',
        description: 'Test database',
        connectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/test?retryWrites=true&w=majority&appName=LodgeTix'
      },
      {
        id: 'uglops-db',
        name: 'UGLOps',
        description: 'UGL Operations database',
        connectionString: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/UGLOps?retryWrites=true&w=majority&appName=LodgeTix'
      }
    ]
  }
];

// Flatten databases for compatibility
export const DATABASE_CONFIGS: DatabaseConfig[] = CLUSTER_CONFIGS.flatMap(cluster => 
  cluster.databases.map(db => ({
    ...db,
    clusterName: cluster.name
  }))
);

export const getDefaultDatabase = (): DatabaseConfig => {
  return DATABASE_CONFIGS.find(db => db.isDefault) || DATABASE_CONFIGS[0];
};

export const getDatabaseById = (id: string): DatabaseConfig | null => {
  return DATABASE_CONFIGS.find(db => db.id === id) || null;
};

export const getDatabaseByName = (name: string): DatabaseConfig | null => {
  return DATABASE_CONFIGS.find(db => db.name === name) || null;
};

// Legacy function - updated to use new system
export function getDatabaseName(isAdminRoute: boolean = false): string {
  if (isAdminRoute) {
    // Admin routes now use the lodgetix database for sync processes
    return 'lodgetix';
  }
  
  // Use the current selected database or default
  const selected = DatabaseSelector.getSelectedDatabase();
  return selected.name;
}

export function isCommerceAdminRoute(pathname: string): boolean {
  return pathname.includes('/admin/');
}

// Client-side database selection state management
export class DatabaseSelector {
  private static STORAGE_KEY = 'selected_database';
  
  static getSelectedDatabase(): DatabaseConfig {
    if (typeof window === 'undefined') {
      return getDefaultDatabase();
    }
    
    const storedId = localStorage.getItem(this.STORAGE_KEY);
    if (storedId) {
      const database = getDatabaseById(storedId);
      if (database) {
        return database;
      }
    }
    
    return getDefaultDatabase();
  }
  
  static setSelectedDatabase(databaseId: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, databaseId);
      
      // Trigger a custom event for components to listen to
      window.dispatchEvent(new CustomEvent('databaseChanged', {
        detail: { databaseId }
      }));
    }
  }
  
  static onDatabaseChange(callback: (database: DatabaseConfig) => void): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }
    
    const handler = (event: CustomEvent) => {
      const database = getDatabaseById(event.detail.databaseId);
      if (database) {
        callback(database);
      }
    };
    
    window.addEventListener('databaseChanged', handler as EventListener);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('databaseChanged', handler as EventListener);
    };
  }
}