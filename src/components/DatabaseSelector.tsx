'use client';

import { useState, useEffect } from 'react';
import { CLUSTER_CONFIGS, ClusterConfig, DatabaseConfig, DatabaseSelector, getDatabaseById, fetchDynamicClusters } from '@/lib/database-selector';

interface DatabaseSelectorProps {
  onDatabaseChange?: (database: DatabaseConfig) => void;
  className?: string;
  useDynamic?: boolean;
}

export default function DatabaseSelectorDropdown({ onDatabaseChange, className = '', useDynamic = true }: DatabaseSelectorProps) {
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseConfig>(DatabaseSelector.getSelectedDatabase());
  const [isOpen, setIsOpen] = useState(false);
  const [clusters, setClusters] = useState<ClusterConfig[]>(CLUSTER_CONFIGS);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // Load dynamic clusters if enabled
    if (useDynamic && isOpen) {
      setIsLoading(true);
      setLoadError(null);
      fetchDynamicClusters()
        .then(dynamicClusters => {
          setClusters(dynamicClusters);
          setIsLoading(false);
        })
        .catch(error => {
          console.error('Failed to load dynamic clusters:', error);
          setLoadError(error.message || 'Failed to connect to MongoDB clusters');
          setIsLoading(false);
          // Don't fall back to static data - show error instead
          setClusters([]);
        });
    }
  }, [useDynamic, isOpen]);

  useEffect(() => {
    // Listen for database changes
    const cleanup = DatabaseSelector.onDatabaseChange((database) => {
      setSelectedDatabase(database);
      if (onDatabaseChange) {
        onDatabaseChange(database);
      }
    });

    return cleanup;
  }, [onDatabaseChange]);

  const handleDatabaseSelect = (databaseId: string) => {
    // Try to find the database in dynamic clusters first
    let database: DatabaseConfig | undefined;
    for (const cluster of clusters) {
      database = cluster.databases.find(db => db.id === databaseId);
      if (database) break;
    }
    
    // Fall back to static config if not found
    if (!database) {
      database = getDatabaseById(databaseId) || undefined;
    }
    
    if (database) {
      DatabaseSelector.setSelectedDatabase(databaseId);
      setSelectedDatabase(database);
      setIsOpen(false);
      
      if (onDatabaseChange) {
        onDatabaseChange(database);
      }
    }
  };

  // Find the cluster of the selected database
  const selectedCluster = clusters.find(cluster => 
    cluster.databases.some(db => db.id === selectedDatabase.id)
  );

  return (
    <div className={`relative ${className}`}>
      {/* Selected Database Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors min-w-80"
      >
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${selectedDatabase.isDefault ? 'bg-green-500' : 'bg-blue-500'}`}></div>
          <div className="text-left">
            <div className="font-semibold text-gray-900">{selectedDatabase.name}</div>
            <div className="text-xs text-gray-500">
              {selectedCluster?.name} → {selectedDatabase.collectionCount ?? selectedDatabase.collections?.length ?? 0} collections
            </div>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Hierarchical Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {isLoading && (
            <div className="p-4 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
              <div className="mt-2 text-sm">Loading live databases...</div>
            </div>
          )}
          {loadError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg m-2">
              <div className="flex items-center gap-2 text-red-700">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <div className="font-semibold">Connection Error</div>
                  <div className="text-sm mt-1">{loadError}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-red-600">
                Please check MongoDB cluster connections and try again.
              </div>
            </div>
          )}
          {!isLoading && clusters.map((cluster) => (
            <div key={cluster.id} className="border-b border-gray-100 last:border-b-0">
              {/* Cluster Header */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12l4-4m-4 4l4 4" />
                  </svg>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">
                      {cluster.name}
                      {cluster.connected === false && <span className="ml-2 text-xs text-red-600">(Offline)</span>}
                    </div>
                    <div className="text-xs text-gray-600">
                      {cluster.description} • {cluster.totalDatabases || cluster.databases.length} databases
                    </div>
                  </div>
                </div>
              </div>

              {/* Databases under this cluster */}
              <div className="py-1">
                {cluster.databases.map((database) => (
                  <button
                    key={database.id}
                    onClick={() => handleDatabaseSelect(database.id)}
                    className={`w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedDatabase.id === database.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                    }`}
                  >
                    {/* Indent indicator */}
                    <div className="flex items-center gap-2">
                      <div className="w-4 border-t border-gray-300"></div>
                      <div className={`w-2 h-2 rounded-full ${database.isDefault ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                    </div>
                    
                    <div className="flex-1">
                      <div className={`font-medium ${selectedDatabase.id === database.id ? 'text-blue-900' : 'text-gray-900'}`}>
                        {database.name}
                        {database.isDefault && <span className="ml-2 text-xs text-green-600">(Default)</span>}
                      </div>
                      <div className={`text-sm ${selectedDatabase.id === database.id ? 'text-blue-700' : 'text-gray-600'}`}>
                        {database.description}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {database.collectionCount ?? database.collections?.length ?? 0} collections
                        {database.empty && <span className="ml-2 text-orange-600">(Empty)</span>}
                      </div>
                    </div>

                    {selectedDatabase.id === database.id && (
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
          
          {/* Info Section */}
          {!isLoading && (
            <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
              <div className="text-xs text-gray-600">
                <div className="mb-1">📊 <strong>Cluster Overview:</strong></div>
                {clusters.map((cluster) => (
                  <div key={cluster.id} className="mb-1">
                    • <strong>{cluster.name}</strong>: {cluster.totalDatabases || cluster.databases.length} databases
                    {cluster.connected === false && <span className="text-red-600"> (Offline)</span>}
                  </div>
                ))}
                {useDynamic && (
                  <div className="mt-2 text-xs text-gray-500">
                    <em>Live data from MongoDB clusters</em>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}