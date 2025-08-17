/**
 * SimpleDatabaseSelector - Easy to integrate database selector dropdown
 * 
 * Usage:
 * ```tsx
 * import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';
 * 
 * // Basic usage - just add to any page
 * <SimpleDatabaseSelector />
 * 
 * // With custom styling
 * <SimpleDatabaseSelector className="w-64" />
 * 
 * // With callback when database changes
 * <SimpleDatabaseSelector onDatabaseChange={(db) => console.log('Selected:', db.name)} />
 * ```
 * 
 * Features:
 * - Lists all databases from both clusters in format "ClusterName - DatabaseName"
 * - Automatically triggers page refresh when database is changed
 * - Uses existing DatabaseSelector for state management
 * - Handles hydration correctly (no SSR issues)
 * - Self-contained component - minimal setup required
 */
'use client';

import { useState, useEffect } from 'react';
import { DatabaseSelector, CLUSTER_CONFIGS, DatabaseConfig } from '@/lib/database-selector';

interface SimpleDatabaseSelectorProps {
  className?: string;
  onDatabaseChange?: (database: DatabaseConfig) => void;
}

export default function SimpleDatabaseSelector({ 
  className = '', 
  onDatabaseChange 
}: SimpleDatabaseSelectorProps) {
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseConfig | null>(null);
  const [mounted, setMounted] = useState(false);

  // Get flattened list of all databases with cluster info
  const allDatabases = CLUSTER_CONFIGS.flatMap(cluster => 
    cluster.databases.map(db => ({
      ...db,
      clusterName: cluster.name,
      displayName: `${cluster.name} - ${db.name}`
    }))
  );

  useEffect(() => {
    setMounted(true);
    
    // Get initially selected database
    const currentDatabase = DatabaseSelector.getSelectedDatabase();
    setSelectedDatabase(currentDatabase);

    // Listen for database changes
    const cleanup = DatabaseSelector.onDatabaseChange((database) => {
      setSelectedDatabase(database);
      if (onDatabaseChange) {
        onDatabaseChange(database);
      }
    });

    return cleanup;
  }, []); // Remove onDatabaseChange from dependencies to prevent infinite loops

  const handleDatabaseChange = (databaseId: string) => {
    DatabaseSelector.setSelectedDatabase(databaseId);
    
    // Trigger page refresh to update all data
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  // Don't render on server side to avoid hydration mismatch
  if (!mounted || !selectedDatabase) {
    return (
      <select className={`border rounded px-3 py-1 ${className}`} disabled>
        <option>Loading...</option>
      </select>
    );
  }

  return (
    <select
      value={selectedDatabase.id}
      onChange={(e) => handleDatabaseChange(e.target.value)}
      className={`border border-gray-300 rounded px-3 py-1 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
    >
      {allDatabases.map((database) => (
        <option key={database.id} value={database.id}>
          {database.displayName}
        </option>
      ))}
    </select>
  );
}