'use client';

import { useState, useEffect } from 'react';
import { CLUSTER_CONFIGS, DatabaseConfig, DatabaseSelector, getDatabaseById } from '@/lib/database-selector';

interface DatabaseSelectorProps {
  onDatabaseChange?: (database: DatabaseConfig) => void;
  className?: string;
}

export default function DatabaseSelectorDropdown({ onDatabaseChange, className = '' }: DatabaseSelectorProps) {
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseConfig>(DatabaseSelector.getSelectedDatabase());
  const [isOpen, setIsOpen] = useState(false);

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
    const database = getDatabaseById(databaseId);
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
  const selectedCluster = CLUSTER_CONFIGS.find(cluster => 
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
              {selectedCluster?.name} → {selectedDatabase.collections?.length || 0} collections
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
          {CLUSTER_CONFIGS.map((cluster) => (
            <div key={cluster.id} className="border-b border-gray-100 last:border-b-0">
              {/* Cluster Header */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12l4-4m-4 4l4 4" />
                  </svg>
                  <div>
                    <div className="font-semibold text-gray-800">{cluster.name}</div>
                    <div className="text-xs text-gray-600">{cluster.description}</div>
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
                        {database.collections?.length || 0} collections
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
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
            <div className="text-xs text-gray-600">
              <div className="mb-1">📊 <strong>Cluster Overview:</strong></div>
              {CLUSTER_CONFIGS.map((cluster) => (
                <div key={cluster.id} className="mb-1">
                  • <strong>{cluster.name}</strong>: {cluster.databases.length} databases
                </div>
              ))}
            </div>
          </div>
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