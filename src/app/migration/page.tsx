'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import JsonViewer from '@/components/JsonViewer';
import JsonViewerWithHighlight from '@/components/JsonViewerWithHighlight';
import EditableJsonViewer from '@/components/EditableJsonViewer';
import FieldMappingSelector from '@/components/FieldMappingSelector';
import apiService from '@/lib/api';
import { extractAllFieldOptions, getValueByPath, extractRelatedDocumentFields } from '@/utils/field-extractor';
import { fieldMappingStorage, FieldMapping } from '@/services/field-mapping-storage';

interface CollectionInfo {
  name: string;
  count: number;
  sampleDocument: any;
}

interface MigrationMapping {
  id: string;
  name: string;
  description: string;
  sourceCollections: {
    primary: string;
    additional: string[];
  };
  destinationCollections: {
    primary: string;
    additional: string[];
  };
  mappings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export default function DataMigrationPage() {
  // Source collection states
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [primarySource, setPrimarySource] = useState<string>('');
  const [sourceDocuments, setSourceDocuments] = useState<Record<string, any>>({});
  
  // Destination collection states
  const [primaryDestination, setPrimaryDestination] = useState<string>('');
  const [additionalDestinations, setAdditionalDestinations] = useState<string[]>([]);
  const [destinationSchemas, setDestinationSchemas] = useState<Record<string, any>>({});
  const [defaultMappings, setDefaultMappings] = useState<Record<string, any>>({});
  const [destinationStats, setDestinationStats] = useState<any>(null);
  
  // Current document states
  const [currentSourceDoc, setCurrentSourceDoc] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalDocs, setTotalDocs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Related documents
  const [relatedDocuments, setRelatedDocuments] = useState<any>(null);
  const [loadingRelatedDocs, setLoadingRelatedDocs] = useState(false);
  const [relatedDocsError, setRelatedDocsError] = useState<string | null>(null);
  
  // Mapping states
  const [fieldMappings, setFieldMappings] = useState<Record<string, any>>({});
  const [savedMappings, setSavedMappings] = useState<MigrationMapping[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const [showSaveMappingModal, setShowSaveMappingModal] = useState(false);
  const [mappingName, setMappingName] = useState('');
  const [mappingDescription, setMappingDescription] = useState('');
  
  // Preview states
  const [previewData, setPreviewData] = useState<Record<string, any>>({});
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  // Load collections on mount
  useEffect(() => {
    loadCollections();
    loadSavedMappings();
  }, []);
  
  // Load documents when source changes
  useEffect(() => {
    if (primarySource) {
      loadSourceDocuments();
    }
  }, [primarySource, currentIndex]);
  
  // Load destination schemas and default mappings
  useEffect(() => {
    if (primaryDestination || additionalDestinations.length > 0) {
      loadDestinationSchemas();
      loadDefaultMappings();
    }
  }, [primaryDestination, additionalDestinations]);
  
  // Load destination stats periodically
  useEffect(() => {
    loadDestinationStats();
    const interval = setInterval(loadDestinationStats, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, []);
  
  // Auto-map fields when schemas and source documents are loaded
  useEffect(() => {
    if (Object.keys(destinationSchemas).length > 0 && Object.keys(sourceDocuments).length > 0 && Object.keys(defaultMappings).length > 0) {
      applyAutoMapping();
    }
  }, [destinationSchemas, sourceDocuments, defaultMappings]);
  
  const loadCollections = async () => {
    try {
      const response = await apiService.getCollections();
      setCollections(response);
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadSavedMappings = () => {
    // Load from localStorage for now
    const saved = localStorage.getItem('migrationMappings');
    if (saved) {
      setSavedMappings(JSON.parse(saved));
    }
  };
  
  const loadSourceDocuments = async () => {
    if (!primarySource) return;
    
    try {
      setLoading(true);
      setLoadingRelatedDocs(true);
      
      // Load primary source document
      const primaryDocs = await apiService.getDocuments(primarySource, currentIndex, 1);
      if (primaryDocs.documents && primaryDocs.documents.length > 0) {
        const primaryDoc = primaryDocs.documents[0];
        setCurrentSourceDoc(primaryDoc);
        setTotalDocs(primaryDocs.total);
        
        // Set primary document
        setSourceDocuments({
          [primarySource]: primaryDoc
        });
        
        // Load related documents
        if (primaryDoc._id) {
          try {
            // Convert ObjectId to string if necessary
            const docId = typeof primaryDoc._id === 'object' ? primaryDoc._id.toString() : primaryDoc._id;
            console.log('Loading related documents for:', primarySource, docId);
            const related = await apiService.getRelatedDocuments(primarySource, docId);
            console.log('Related documents response:', related);
            
            setRelatedDocuments(related.relatedDocuments);
            setRelatedDocsError(null);
            
            // Add related documents to source documents
            const allSourceDocs: Record<string, any> = {
              [primarySource]: primaryDoc
            };
            
            // Add all related documents
            if (related.relatedDocuments) {
              Object.entries(related.relatedDocuments).forEach(([collection, docs]) => {
                if (Array.isArray(docs) && docs.length > 0) {
                  // For collections with multiple documents, we'll show them all
                  allSourceDocs[collection] = docs;
                }
              });
            }
            
            setSourceDocuments(allSourceDocs);
          } catch (err: any) {
            console.error('Failed to load related documents:', err);
            setRelatedDocsError(err.message || 'Failed to load related documents');
            setRelatedDocuments(null);
          }
        } else {
          console.warn('No _id found on primary document:', primaryDoc);
        }
      }
    } catch (error) {
      console.error('Failed to load source documents:', error);
    } finally {
      setLoading(false);
      setLoadingRelatedDocs(false);
    }
  };
  
  const loadDestinationSchemas = async () => {
    try {
      const schemas: Record<string, any> = {};
      
      // Load primary destination schema
      if (primaryDestination) {
        const schemaPath = `/database-schema/collections/${primaryDestination}/documents.json`;
        try {
          const response = await fetch(schemaPath);
          if (response.ok) {
            schemas[primaryDestination] = await response.json();
          }
        } catch (err) {
          console.warn(`Schema not found for ${primaryDestination}`);
        }
      }
      
      // Load additional destination schemas
      for (const dest of additionalDestinations) {
        const schemaPath = `/database-schema/collections/${dest}/documents.json`;
        try {
          const response = await fetch(schemaPath);
          if (response.ok) {
            schemas[dest] = await response.json();
          }
        } catch (err) {
          console.warn(`Schema not found for ${dest}`);
        }
      }
      
      setDestinationSchemas(schemas);
    } catch (error) {
      console.error('Failed to load destination schemas:', error);
    }
  };
  
  const loadDefaultMappings = async () => {
    try {
      const response = await apiService.get('/migration/mappings');
      setDefaultMappings(response.mappings || {});
    } catch (error) {
      console.error('Failed to load default mappings:', error);
    }
  };
  
  const loadDestinationStats = async () => {
    try {
      const response = await apiService.get('/migration/destination/stats');
      setDestinationStats(response);
    } catch (error) {
      console.error('Failed to load destination stats:', error);
    }
  };
  
  const extractFieldOptions = () => {
    const options: any[] = [];
    
    // Add fields from all source documents
    Object.entries(sourceDocuments).forEach(([collection, docs]) => {
      if (Array.isArray(docs)) {
        docs.forEach((doc, index) => {
          const fields = extractFieldsFromObject(doc, `${collection}[${index}]`);
          options.push(...fields);
        });
      } else if (docs) {
        const fields = extractFieldsFromObject(docs, collection);
        options.push(...fields);
      }
    });
    
    return options;
  };
  
  const extractFieldsFromObject = (obj: any, prefix: string): any[] => {
    const fields: any[] = [];
    
    const traverse = (current: any, path: string) => {
      if (current === null || current === undefined) return;
      
      if (Array.isArray(current)) {
        current.forEach((item, index) => {
          traverse(item, `${path}[${index}]`);
        });
      } else if (typeof current === 'object' && !(current instanceof Date)) {
        Object.entries(current).forEach(([key, value]) => {
          const fullPath = `${path}.${key}`;
          fields.push({
            label: fullPath,
            value: fullPath,
            type: Array.isArray(value) ? 'array' : typeof value,
            sampleValue: value
          });
          traverse(value, fullPath);
        });
      }
    };
    
    traverse(obj, prefix);
    return fields;
  };
  
  const applyMapping = (mappingId: string) => {
    const mapping = savedMappings.find(m => m.id === mappingId);
    if (!mapping) return;
    
    setSelectedMappingId(mappingId);
    setPrimarySource(mapping.sourceCollections.primary);
    setPrimaryDestination(mapping.destinationCollections.primary);
    setAdditionalDestinations(mapping.destinationCollections.additional);
    setFieldMappings(mapping.mappings);
  };
  
  const generatePreview = () => {
    const preview: Record<string, any> = {};
    
    // Generate primary destination document
    if (primaryDestination && destinationSchemas[primaryDestination]) {
      preview[primaryDestination] = generateMappedDocument(
        destinationSchemas[primaryDestination],
        fieldMappings[primaryDestination] || {},
        defaultMappings[primaryDestination]
      );
    }
    
    // Generate additional destination documents
    additionalDestinations.forEach(dest => {
      if (destinationSchemas[dest]) {
        preview[dest] = generateMappedDocument(
          destinationSchemas[dest],
          fieldMappings[dest] || {},
          defaultMappings[dest]
        );
      }
    });
    
    setPreviewData(preview);
    setShowPreviewModal(true);
    return preview;
  };
  
  const generateMappedDocument = (schema: any, mappings: any, defaultMapping?: any): any => {
    // Helper to set nested value
    const setNestedValue = (obj: any, path: string, value: any): void => {
      const keys = path.split('.');
      let current = obj;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
    };
    
    // Helper to get nested value
    const getNestedValue = (obj: any, path: string): any => {
      if (!obj) return null;
      return path.split('.').reduce((current, key) => current?.[key], obj);
    };
    
    // Process schema recursively
    const processSchema = (schemaObj: any, resultObj: any, path = '') => {
      Object.entries(schemaObj).forEach(([field, schemaValue]) => {
        const fullPath = path ? `${path}.${field}` : field;
        
        if (Array.isArray(schemaValue)) {
          // Handle arrays
          if (schemaValue.length > 0 && typeof schemaValue[0] === 'object') {
            // Array of objects - check for indexed mappings
            const arrayItems = [];
            let itemIndex = 0;
            
            // Check for mappings with array index notation (e.g., events[0], events[1])
            while (true) {
              const itemPath = `${fullPath}[${itemIndex}]`;
              const hasMapping = Object.keys(mappings).some(key => key.startsWith(itemPath));
              
              if (!hasMapping && itemIndex === 0) {
                // No mappings at all for this array, use empty array
                break;
              }
              
              if (!hasMapping) {
                // No more items mapped
                break;
              }
              
              // Process this array item
              const itemObj = {};
              processSchema(schemaValue[0], itemObj, itemPath);
              
              // Only add non-empty items
              if (Object.keys(itemObj).length > 0) {
                arrayItems.push(itemObj);
              }
              
              itemIndex++;
            }
            
            setNestedValue(resultObj, fullPath, arrayItems);
          } else {
            // Simple array - check for direct mapping
            const mapping = getNestedValue(mappings, fullPath);
            if (mapping?.source) {
              const [collection, ...pathParts] = mapping.source.split('.');
              const sourceDoc = sourceDocuments[collection];
              if (sourceDoc) {
                const value = Array.isArray(sourceDoc) 
                  ? getValueByPath(sourceDoc[0], pathParts.join('.'))
                  : getValueByPath(sourceDoc, pathParts.join('.'));
                if (value !== undefined) {
                  setNestedValue(resultObj, fullPath, value);
                }
              }
            } else if (mapping?.customValue !== undefined) {
              setNestedValue(resultObj, fullPath, mapping.customValue);
            } else {
              setNestedValue(resultObj, fullPath, schemaValue);
            }
          }
        } else if (typeof schemaValue === 'object' && schemaValue !== null) {
          // Nested object - recurse
          if (!getNestedValue(resultObj, fullPath)) {
            setNestedValue(resultObj, fullPath, {});
          }
          processSchema(schemaValue, resultObj, fullPath);
        } else {
          // Simple field
          const mapping = getNestedValue(mappings, fullPath);
          
          if (mapping?.source) {
            // Extract value from source
            const [collection, ...pathParts] = mapping.source.split('.');
            const sourceDoc = sourceDocuments[collection];
            if (sourceDoc) {
              const value = Array.isArray(sourceDoc)
                ? getValueByPath(sourceDoc[0], pathParts.join('.'))
                : getValueByPath(sourceDoc, pathParts.join('.'));
              if (value !== undefined) {
                setNestedValue(resultObj, fullPath, value);
              }
            }
          } else if (mapping?.customValue !== undefined) {
            setNestedValue(resultObj, fullPath, mapping.customValue);
          } else {
            // Try default mapping
            const defaultValue = getNestedValue(defaultMapping, fullPath) || schemaValue;
            
            if (typeof defaultValue === 'string' && defaultValue.includes(':') && !defaultValue.startsWith('TODO:') && !defaultValue.startsWith('Computed:')) {
              const [sourceCollection, sourcePath] = defaultValue.split(':').map(s => s.trim());
              const sourceDoc = sourceDocuments[sourceCollection];
              if (sourceDoc) {
                const value = Array.isArray(sourceDoc)
                  ? getValueByPath(sourceDoc[0], sourcePath)
                  : getValueByPath(sourceDoc, sourcePath);
                if (value !== undefined) {
                  setNestedValue(resultObj, fullPath, value);
                }
              }
            } else if (!defaultValue.toString().startsWith('TODO:')) {
              // Use default value
              setNestedValue(resultObj, fullPath, defaultValue);
            }
          }
        }
      });
    };
    
    const result = {};
    processSchema(schema, result);
    return result;
  };
  
  const evaluateCalculation = (calculation: any): any => {
    // Simple calculation evaluation
    // This could be expanded to support more complex calculations
    if (calculation.type === 'concat') {
      return calculation.fields.map((field: string) => {
        const [collection, ...pathParts] = field.split('.');
        const sourceDoc = sourceDocuments[collection];
        if (Array.isArray(sourceDoc)) {
          return sourceDoc[0] ? getValueByPath(sourceDoc[0], pathParts.join('.')) : '';
        }
        return sourceDoc ? getValueByPath(sourceDoc, pathParts.join('.')) : '';
      }).join(calculation.separator || ' ');
    }
    
    return null;
  };
  
  const processCurrent = async () => {
    try {
      setProcessing(true);
      
      // Use the new migration process endpoint for complex migrations
      const mappingsToSend: Record<string, any> = {};
      
      // Add primary destination mapping
      if (primaryDestination) {
        mappingsToSend[primaryDestination] = fieldMappings[primaryDestination] || {};
      }
      
      // Add additional destination mappings
      additionalDestinations.forEach(dest => {
        if (dest) {
          mappingsToSend[dest] = fieldMappings[dest] || {};
        }
      });
      
      // Process the migration
      const response = await apiService.post('/migration/process', {
        sourceDocument: currentSourceDoc,
        relatedDocuments: relatedDocuments,
        destinationCollection: primaryDestination,
        mappings: mappingsToSend
      });
      
      if (response.success) {
        // Move to next document
        if (currentIndex < totalDocs - 1) {
          setCurrentIndex(currentIndex + 1);
        } else {
          alert('Migration complete!');
        }
        
        // Reload destination stats
        loadDestinationStats();
      } else {
        throw new Error(response.error || 'Migration failed');
      }
    } catch (error: any) {
      console.error('Failed to process document:', error);
      alert(`Failed to process document: ${error.message || 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };
  
  const applyAutoMapping = () => {
    const newFieldMappings: Record<string, any> = {};
    
    // Helper to set nested value
    const setNestedValue = (obj: any, path: string, value: any): any => {
      const keys = path.split('.');
      const result = { ...obj };
      let current = result;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return result;
    };
    
    // Helper to get nested value
    const getNestedValue = (obj: any, path: string): any => {
      if (!obj) return null;
      return path.split('.').reduce((current, key) => current?.[key], obj);
    };
    
    // Helper to flatten schema
    const flattenSchema = (obj: any, prefix = ''): Array<{path: string, value: any}> => {
      const result: Array<{path: string, value: any}> = [];
      
      Object.entries(obj).forEach(([key, value]) => {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result.push(...flattenSchema(value, fullPath));
        } else {
          result.push({ path: fullPath, value });
        }
      });
      
      return result;
    };
    
    // Process each destination collection
    Object.entries(destinationSchemas).forEach(([collection, schema]) => {
      if (!schema) return;
      
      let mappings = { ...(fieldMappings[collection] || {}) };
      const defaultMapping = defaultMappings[collection] || {};
      
      // Get flattened schema fields
      const flatFields = flattenSchema(schema);
      
      // Process each flattened field
      flatFields.forEach(({ path, value: schemaValue }) => {
        // Skip if field already has a mapping
        if (getNestedValue(mappings, path)) {
          return;
        }
        
        // Try to get default value for this path
        const defaultValue = getNestedValue(defaultMapping, path) || schemaValue;
        
        if (typeof defaultValue === 'string' && defaultValue.includes(':') && !defaultValue.startsWith('TODO:') && !defaultValue.startsWith('Computed:')) {
          const [sourceCollection, sourcePath] = defaultValue.split(':').map(s => s.trim());
          
          // Check if source collection and path exist
          const sourceDoc = sourceDocuments[sourceCollection];
          if (sourceDoc) {
            let value;
            if (Array.isArray(sourceDoc)) {
              value = getValueByPath(sourceDoc[0], sourcePath);
            } else {
              value = getValueByPath(sourceDoc, sourcePath);
            }
            
            // Only auto-map if value exists
            if (value !== undefined && value !== null) {
              mappings = setNestedValue(mappings, path, {
                source: `${sourceCollection}.${sourcePath}`,
                customValue: undefined
              });
            }
          }
        } else if (typeof defaultValue === 'string' && (defaultValue === 'ObjectId' || defaultValue.startsWith('Multiple sources:'))) {
          // Skip auto-mapping for these special cases
        } else if (typeof defaultValue === 'string' && !defaultValue.startsWith('TODO:')) {
          // Use as custom value if it's not a TODO
          mappings = setNestedValue(mappings, path, {
            customValue: defaultValue,
            source: null
          });
        } else if (typeof defaultValue === 'number' || typeof defaultValue === 'boolean') {
          // Use numeric or boolean defaults
          mappings = setNestedValue(mappings, path, {
            customValue: defaultValue,
            source: null
          });
        }
      });
      
      newFieldMappings[collection] = mappings;
    });
    
    setFieldMappings(newFieldMappings);
  };
  
  const saveMapping = () => {
    const newMapping: MigrationMapping = {
      id: Date.now().toString(),
      name: mappingName,
      description: mappingDescription,
      sourceCollections: {
        primary: primarySource,
        additional: Object.keys(relatedDocuments || {})
      },
      destinationCollections: {
        primary: primaryDestination,
        additional: additionalDestinations
      },
      mappings: fieldMappings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const updated = [...savedMappings, newMapping];
    setSavedMappings(updated);
    localStorage.setItem('migrationMappings', JSON.stringify(updated));
    
    setShowSaveMappingModal(false);
    setMappingName('');
    setMappingDescription('');
    alert('Mapping saved successfully!');
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading collections...</div>
      </div>
    );
  }
  
  return (
    <main className="mx-auto px-4 py-8 w-[90%]">
      <div className="mb-6">
        <Link href="/" className="text-blue-500 hover:underline">
          ← Back to Home
        </Link>
      </div>
      
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Data Migration Tool
      </h1>
      
      {/* Destination Database Stats */}
      {destinationStats && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">
            Destination Database: {destinationStats.database}
          </h2>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Total Documents:</span> {destinationStats.totalDocuments}
            </div>
            <div>
              <span className="font-medium">Migrated:</span> {destinationStats.totalMigrated}
            </div>
            <div>
              <span className="font-medium">Collections:</span> {Object.keys(destinationStats.collections || {}).length}
            </div>
            <div className="text-right">
              <button
                onClick={loadDestinationStats}
                className="text-blue-600 hover:underline"
              >
                Refresh Stats
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Configuration Section */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Migration Configuration</h2>
        
        {/* Saved Mappings */}
        {savedMappings.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Saved Mappings
            </label>
            <select
              value={selectedMappingId || ''}
              onChange={(e) => e.target.value && applyMapping(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">Select a saved mapping...</option>
              {savedMappings.map(mapping => (
                <option key={mapping.id} value={mapping.id}>
                  {mapping.name} - {mapping.description}
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-6">
          {/* Source Collections */}
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Source Collection</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Primary Source
              </label>
              <div className="flex gap-2">
                <select
                  value={primarySource}
                  onChange={(e) => {
                    setPrimarySource(e.target.value);
                    setCurrentIndex(0);
                    setRelatedDocuments(null);
                    setRelatedDocsError(null);
                  }}
                  className="flex-1 p-2 border rounded"
                >
                  <option value="">Select primary source...</option>
                  {collections.map(col => (
                    <option key={col.name} value={col.name}>
                      {col.name} ({col.count} documents)
                    </option>
                  ))}
                </select>
                {primarySource && (
                  <button
                    onClick={() => loadSourceDocuments()}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                  >
                    {loading ? '...' : 'Refresh'}
                  </button>
                )}
              </div>
            </div>
            
            {loadingRelatedDocs && (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
                <p className="text-sm text-gray-600">Loading related documents...</p>
              </div>
            )}
            
            {relatedDocsError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm text-red-600">Error: {relatedDocsError}</p>
              </div>
            )}
            
            {relatedDocuments && Object.keys(relatedDocuments).length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <h4 className="font-medium text-blue-900 mb-2">Related Documents Found:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  {Object.entries(relatedDocuments).map(([collection, docs]) => (
                    <li key={collection}>
                      • {collection}: {Array.isArray(docs) ? docs.length : 1} document(s)
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {relatedDocuments && Object.keys(relatedDocuments).length === 0 && !loadingRelatedDocs && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">No related documents found for this {primarySource} document.</p>
              </div>
            )}
          </div>
          
          {/* Destination Collections */}
          <div>
            <h3 className="font-medium text-gray-700 mb-3">Destination Collections</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Primary Destination
              </label>
              <select
                value={primaryDestination}
                onChange={(e) => setPrimaryDestination(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">Select primary destination...</option>
                <option value="functions">functions</option>
                <option value="registrations">registrations</option>
                <option value="attendees">attendees</option>
                <option value="tickets">tickets</option>
                <option value="financial-transactions">financial-transactions</option>
                <option value="organisations">organisations</option>
                <option value="contacts">contacts</option>
                <option value="users">users</option>
                <option value="jurisdictions">jurisdictions</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Additional Destinations
              </label>
              <div className="space-y-2">
                {additionalDestinations.map((dest, index) => (
                  <div key={index} className="flex gap-2">
                    <select
                      value={dest}
                      onChange={(e) => {
                        const updated = [...additionalDestinations];
                        updated[index] = e.target.value;
                        setAdditionalDestinations(updated);
                      }}
                      className="flex-1 p-2 border rounded"
                    >
                      <option value="">Select collection...</option>
                      <option value="functions">functions</option>
                      <option value="registrations">registrations</option>
                      <option value="attendees">attendees</option>
                      <option value="tickets">tickets</option>
                      <option value="financial-transactions">financial-transactions</option>
                      <option value="organisations">organisations</option>
                      <option value="contacts">contacts</option>
                      <option value="users">users</option>
                      <option value="jurisdictions">jurisdictions</option>
                    </select>
                    <button
                      onClick={() => {
                        setAdditionalDestinations(additionalDestinations.filter((_, i) => i !== index));
                      }}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setAdditionalDestinations([...additionalDestinations, ''])}
                  className="text-blue-600 hover:underline text-sm"
                >
                  + Add another destination
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Progress Bar */}
      {primarySource && totalDocs > 0 && (
        <div className="bg-blue-500 text-white p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center">
            <span className="font-semibold">
              Document {currentIndex + 1} of {totalDocs}
            </span>
            <div className="flex items-center gap-4">
              <div className="w-64 bg-blue-700 rounded-full h-2">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / totalDocs) * 100}%` }}
                />
              </div>
              <span>{Math.round(((currentIndex + 1) / totalDocs) * 100)}%</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content Area */}
      {currentSourceDoc && (
        <div className="border border-gray-300 rounded-lg overflow-hidden mb-6">
          <div className="bg-gray-100 px-4 py-3 flex justify-between items-center">
            <span className="font-semibold">
              Current Document: {primarySource}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0 || processing}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300"
              >
                ← Previous
              </button>
              <button
                onClick={() => setCurrentIndex(Math.min(totalDocs - 1, currentIndex + 1))}
                disabled={currentIndex >= totalDocs - 1 || processing}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300"
              >
                Next →
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 divide-x divide-gray-300">
            {/* Source Data */}
            <div className="p-4">
              <h3 className="font-semibold mb-2">Source Data</h3>
              <div className="space-y-4">
                <JsonViewer 
                  data={sourceDocuments[primarySource]} 
                  title={`Primary: ${primarySource}`}
                />
                
                {Object.entries(sourceDocuments)
                  .filter(([key]) => key !== primarySource)
                  .map(([collection, docs]) => (
                    <JsonViewer 
                      key={collection}
                      data={docs} 
                      title={`Related: ${collection}`}
                    />
                  ))}
              </div>
            </div>
            
            {/* Field Mapping */}
            <div className="p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Field Mapping</h3>
                <button
                  onClick={applyAutoMapping}
                  className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  title="Auto-map fields based on documents.json defaults"
                >
                  Auto-map Fields
                </button>
              </div>
              <div className="space-y-4">
                {primaryDestination && destinationSchemas[primaryDestination] && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">
                      {primaryDestination} (Primary)
                    </h4>
                    <MappingFields
                      schema={destinationSchemas[primaryDestination]}
                      collection={primaryDestination}
                      fieldOptions={extractFieldOptions()}
                      mappings={fieldMappings[primaryDestination] || {}}
                      defaultMapping={defaultMappings[primaryDestination]}
                      sourceDocuments={sourceDocuments}
                      onMappingChange={(collection, newMappings) => {
                        setFieldMappings({
                          ...fieldMappings,
                          [collection]: newMappings
                        });
                      }}
                    />
                  </div>
                )}
                
                {additionalDestinations.map(dest => 
                  destinationSchemas[dest] && (
                    <div key={dest}>
                      <h4 className="font-medium text-gray-700 mb-2 mt-4">
                        {dest}
                      </h4>
                      <MappingFields
                        schema={destinationSchemas[dest]}
                        collection={dest}
                        fieldOptions={extractFieldOptions()}
                        mappings={fieldMappings[dest] || {}}
                        defaultMapping={defaultMappings[dest]}
                        sourceDocuments={sourceDocuments}
                        onMappingChange={(collection, newMappings) => {
                          setFieldMappings({
                            ...fieldMappings,
                            [collection]: newMappings
                          });
                        }}
                      />
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <button
          onClick={generatePreview}
          disabled={!primaryDestination || processing}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-semibold"
        >
          Preview Migration
        </button>
        <button
          onClick={processCurrent}
          disabled={!primaryDestination || processing}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
        >
          {processing ? 'Processing...' : 'Process & Continue'}
        </button>
        <button
          onClick={() => setShowSaveMappingModal(true)}
          disabled={!primaryDestination || !fieldMappings[primaryDestination]}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
        >
          Save Mapping
        </button>
      </div>
      
      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Migration Preview</h3>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {Object.entries(previewData).map(([collection, doc]) => (
                <div key={collection} className="mb-4">
                  <JsonViewer 
                    data={doc} 
                    title={`${collection} (${collection === primaryDestination ? 'Primary' : 'Additional'})`}
                  />
                </div>
              ))}
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  processCurrent();
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Confirm & Process
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Save Mapping Modal */}
      {showSaveMappingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Save Migration Mapping</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mapping Name
              </label>
              <input
                type="text"
                value={mappingName}
                onChange={(e) => setMappingName(e.target.value)}
                placeholder="e.g., Functions to Clean Schema"
                className="w-full p-2 border rounded"
                autoFocus
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={mappingDescription}
                onChange={(e) => setMappingDescription(e.target.value)}
                placeholder="Describe when to use this mapping..."
                className="w-full p-2 border rounded"
                rows={3}
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={saveMapping}
                disabled={!mappingName.trim()}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                Save Mapping
              </button>
              <button
                onClick={() => {
                  setShowSaveMappingModal(false);
                  setMappingName('');
                  setMappingDescription('');
                }}
                className="flex-1 border px-4 py-2 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Sub-component for mapping fields
function MappingFields({ 
  schema, 
  collection,
  fieldOptions, 
  mappings, 
  defaultMapping,
  sourceDocuments,
  onMappingChange 
}: {
  schema: any;
  collection: string;
  fieldOptions: any[];
  mappings: Record<string, any>;
  defaultMapping?: any;
  sourceDocuments: Record<string, any>;
  onMappingChange: (collection: string, mappings: Record<string, any>) => void;
}) {
  const [expandedArrays, setExpandedArrays] = useState<Record<string, boolean>>({});
  const [arrayItemCounts, setArrayItemCounts] = useState<Record<string, number>>({});
  
  // Convert fieldOptions to the format expected by FieldMappingSelector
  const convertedOptions = fieldOptions.map(opt => ({
    source: opt.label.split('.')[0],
    path: opt.value,
    displayPath: opt.label,
    value: opt.sampleValue,
    type: opt.type
  }));
  
  // Get nested value from object using dot notation
  const getNestedValue = (obj: any, path: string): any => {
    if (!obj) return null;
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (key.includes('[') && key.includes(']')) {
        // Handle array index notation
        const [arrayKey, indexStr] = key.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        current = current?.[arrayKey]?.[index];
      } else {
        current = current?.[key];
      }
    }
    
    return current;
  };
  
  // Set nested value in object using dot notation
  const setNestedValue = (obj: any, path: string, value: any): any => {
    const keys = path.split('.');
    const result = { ...obj };
    let current = result;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      
      if (key.includes('[') && key.includes(']')) {
        // Handle array index notation
        const [arrayKey, indexStr] = key.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        
        if (!current[arrayKey]) {
          current[arrayKey] = [];
        }
        if (!current[arrayKey][index]) {
          current[arrayKey][index] = {};
        }
        current = current[arrayKey][index];
      } else {
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
    }
    
    const lastKey = keys[keys.length - 1];
    if (lastKey.includes('[') && lastKey.includes(']')) {
      const [arrayKey, indexStr] = lastKey.split('[');
      const index = parseInt(indexStr.replace(']', ''));
      if (!current[arrayKey]) {
        current[arrayKey] = [];
      }
      current[arrayKey][index] = value;
    } else {
      current[lastKey] = value;
    }
    
    return result;
  };
  
  // Function to get the current value for a field
  const getCurrentValue = (fieldPath: string) => {
    const mapping = getNestedValue(mappings, fieldPath);
    if (mapping?.customValue !== undefined) {
      return mapping.customValue;
    }
    if (mapping?.source) {
      const [collection, ...pathParts] = mapping.source.split('.');
      const sourceDoc = sourceDocuments[collection];
      if (sourceDoc) {
        if (Array.isArray(sourceDoc)) {
          return getValueByPath(sourceDoc[0], pathParts.join('.'));
        } else {
          return getValueByPath(sourceDoc, pathParts.join('.'));
        }
      }
    }
    // Try to get value from default mapping
    const defaultValue = getNestedValue(defaultMapping, fieldPath);
    if (defaultValue && typeof defaultValue === 'string') {
      if (defaultValue.includes(':') && !defaultValue.startsWith('TODO:') && !defaultValue.startsWith('Computed:')) {
        const [sourceCollection, sourcePath] = defaultValue.split(':').map(s => s.trim());
        const sourceDoc = sourceDocuments[sourceCollection];
        if (sourceDoc) {
          if (Array.isArray(sourceDoc)) {
            return getValueByPath(sourceDoc[0], sourcePath);
          } else {
            return getValueByPath(sourceDoc, sourcePath);
          }
        }
      }
    }
    return null;
  };
  
  // Helper function to get display text for schema value
  const getSchemaDisplayText = (defaultValue: any): string => {
    if (typeof defaultValue === 'string') {
      return defaultValue;
    }
    return String(defaultValue || '');
  };
  
  // Render field based on type
  const renderField = (path: string, value: any, defaultValue: any, level = 0) => {
    const indent = level * 20;
    
    // Handle arrays
    if (Array.isArray(value)) {
      const isExpanded = expandedArrays[path] || false;
      const itemCount = arrayItemCounts[path] || 1;
      const arrayTemplate = value[0] || {};
      
      return (
        <div key={path} className="border rounded p-3 bg-gray-50" style={{ marginLeft: `${indent}px` }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpandedArrays({ ...expandedArrays, [path]: !isExpanded })}
                className="text-gray-600 hover:text-gray-800"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
              <span className="font-medium text-sm">{path}</span>
              <span className="text-xs text-gray-500">(Array - {itemCount} item{itemCount !== 1 ? 's' : ''})</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setArrayItemCounts({ ...arrayItemCounts, [path]: itemCount + 1 });
                  setExpandedArrays({ ...expandedArrays, [path]: true });
                }}
                className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
              >
                + Add Item
              </button>
              {itemCount > 1 && (
                <button
                  onClick={() => {
                    setArrayItemCounts({ ...arrayItemCounts, [path]: itemCount - 1 });
                    // Remove the last item's mappings
                    const newMappings = { ...mappings };
                    const lastIndex = itemCount - 1;
                    // Remove mappings for the last item
                    Object.keys(newMappings).forEach(key => {
                      if (key.startsWith(`${path}[${lastIndex}]`)) {
                        delete newMappings[key];
                      }
                    });
                    onMappingChange(collection, newMappings);
                  }}
                  className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  - Remove Last
                </button>
              )}
            </div>
          </div>
          
          {isExpanded && (
            <div className="mt-3 space-y-4">
              {Array.from({ length: itemCount }).map((_, index) => (
                <div key={index} className="border-l-2 border-gray-300 pl-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">Item {index + 1}</div>
                  {typeof arrayTemplate === 'object' && arrayTemplate !== null
                    ? Object.entries(arrayTemplate).map(([key, val]) => 
                        renderField(`${path}[${index}].${key}`, val, getNestedValue(defaultValue, `[0].${key}`), level + 1)
                      )
                    : renderField(`${path}[${index}]`, arrayTemplate, defaultValue, level + 1)
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    // Handle nested objects
    if (typeof value === 'object' && value !== null) {
      return (
        <div key={path} className="space-y-2" style={{ marginLeft: `${indent}px` }}>
          {Object.entries(value).map(([key, val]) => 
            renderField(`${path}.${key}`, val, getNestedValue(defaultValue, key), level)
          )}
        </div>
      );
    }
    
    // Handle simple fields
    let fieldType: 'text' | 'number' | 'date' | 'select' = 'text';
    if (path.toLowerCase().includes('date') || path.toLowerCase().includes('at')) {
      fieldType = 'date';
    } else if (typeof value === 'number' || path.toLowerCase().includes('amount') || path.toLowerCase().includes('count')) {
      fieldType = 'number';
    } else if (typeof value === 'boolean') {
      fieldType = 'select';
    }
    
    return (
      <div key={path} className="border rounded p-3" style={{ marginLeft: `${indent}px` }}>
        <FieldMappingSelector
          fieldName={path}
          fieldPath={path}
          currentValue={getCurrentValue(path)}
          allOptions={convertedOptions}
          onMappingChange={(fieldPath, sourcePath, customValue) => {
            const newMappings = { ...mappings };
            if (customValue !== undefined) {
              setNestedValue(newMappings, path, {
                customValue,
                source: null
              });
            } else if (sourcePath) {
              setNestedValue(newMappings, path, {
                source: sourcePath,
                customValue: undefined
              });
            } else {
              setNestedValue(newMappings, path, {});
            }
            onMappingChange(collection, newMappings);
          }}
          fieldType={fieldType}
          selectOptions={fieldType === 'select' && typeof value === 'boolean' ? [
            { value: 'true', label: 'True' },
            { value: 'false', label: 'False' }
          ] : undefined}
        />
        <div className="text-xs text-gray-500 mt-1">
          {getSchemaDisplayText(defaultValue)}
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-3">
      {Object.entries(schema).map(([field, value]) => 
        renderField(field, value, defaultMapping?.[field] || value)
      )}
    </div>
  );
}