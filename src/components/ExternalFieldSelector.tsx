import React, { useState, useEffect } from 'react';
import apiService from '@/lib/api';

interface ExternalFieldSelectorProps {
  onFieldSelect: (path: string, value: any) => void;
  onClose: () => void;
  mode?: 'search' | 'related';
  relatedDocuments?: any;
}

interface SearchResult {
  collection: string;
  document: any;
}

export default function ExternalFieldSelector({ 
  onFieldSelect, 
  onClose,
  mode = 'search',
  relatedDocuments 
}: ExternalFieldSelectorProps) {
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    if (mode === 'related') {
      return {
        eventTickets: true,
        events: true,
        packages: true,
        lodges: true,
        customers: true,
        bookingContacts: true,
        functions: true
      } as Record<string, boolean>;
    }
    return {} as Record<string, boolean>;
  });

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const response = await apiService.getCollections();
      const collectionNames = response.map((col: any) => col.name).sort();
      setCollections(collectionNames);
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    }
  };

  const searchDocuments = async () => {
    if (!selectedCollection || !searchQuery.trim()) return;

    setLoading(true);
    try {
      // Try the search endpoint first
      const response = await apiService.searchDocuments(selectedCollection, {
        $or: [
          { name: { $regex: searchQuery, $options: 'i' } },
          { functionName: { $regex: searchQuery, $options: 'i' } },
          { lodgeName: { $regex: searchQuery, $options: 'i' } },
          { organisationName: { $regex: searchQuery, $options: 'i' } },
          { eventName: { $regex: searchQuery, $options: 'i' } },
          { ticketName: { $regex: searchQuery, $options: 'i' } },
          { packageName: { $regex: searchQuery, $options: 'i' } },
          { title: { $regex: searchQuery, $options: 'i' } },
          { displayName: { $regex: searchQuery, $options: 'i' } }
        ]
      });
      
      setSearchResults(response.documents || []);
    } catch (error: any) {
      console.error('Search failed:', error);
      
      // If search endpoint doesn't exist, try regular documents endpoint with search
      if (error.response?.status === 404) {
        try {
          const response = await apiService.getDocuments(selectedCollection, 0, 20, searchQuery);
          setSearchResults(response.documents || []);
        } catch (fallbackError) {
          console.error('Fallback search failed:', fallbackError);
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentSelect = (doc: any) => {
    setSelectedDocument(doc);
    setSearchResults([]);
  };

  const togglePath = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  const handleRelatedFieldSelect = (docType: string, docIndex: number, fieldPath: string, value: any) => {
    const fullPath = `related.${docType}[${docIndex}].${fieldPath}`;
    onFieldSelect(fullPath, value);
  };

  const renderFieldTree = (obj: any, path: string = '', level: number = 0, docType?: string, docIndex?: number) => {
    if (!obj || typeof obj !== 'object') return null;

    const skipFields = ['_id', '__v', 'createdAt', 'updatedAt'];

    return Object.entries(obj).map(([key, value]) => {
      if (skipFields.includes(key)) return null;

      const currentPath = path ? `${path}.${key}` : key;
      const isObject = value && typeof value === 'object' && !Array.isArray(value);
      const isArray = Array.isArray(value);
      const isExpanded = expandedPaths.has(currentPath);

      return (
        <div key={currentPath} style={{ marginLeft: `${level * 20}px` }}>
          <div className="flex items-center hover:bg-gray-50 rounded px-2 py-1">
            {(isObject || isArray) && (
              <button
                onClick={() => togglePath(currentPath)}
                className="mr-2 text-gray-500"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            
            <div className="flex-1 flex items-center justify-between">
              <span className="text-sm font-mono">{key}</span>
              {!isObject && !isArray && (
                <>
                  <span className="text-xs text-gray-500 mx-2">
                    {typeof value === 'string' && value.length > 50
                      ? value.substring(0, 50) + '...'
                      : String(value)}
                  </span>
                  <button
                    onClick={() => {
                      if (mode === 'related' && docType !== undefined && docIndex !== undefined) {
                        handleRelatedFieldSelect(docType, docIndex, currentPath, value);
                      } else {
                        const externalPath = `external.${selectedCollection}.${currentPath}`;
                        onFieldSelect(externalPath, value);
                      }
                    }}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Use
                  </button>
                </>
              )}
            </div>
          </div>

          {isExpanded && (isObject || isArray) && (
            <div>
              {isArray && value.length > 0 && typeof value[0] === 'object' ? (
                renderFieldTree(value[0], `${currentPath}[0]`, level + 1, docType, docIndex)
              ) : isObject ? (
                renderFieldTree(value, currentPath, level + 1, docType, docIndex)
              ) : null}
            </div>
          )}
        </div>
      );
    });
  };

  const getDisplayName = (doc: any) => {
    return doc.name || doc.functionName || doc.lodgeName || doc.organisationName || 
           doc.eventName || doc.ticketName || doc.packageName || doc.title || 
           doc.displayName || doc._id || 'Unnamed Document';
  };

  const renderRelatedSection = (sectionName: string, documents: any[], displayNameFn?: (doc: any, index: number) => string) => {
    if (!documents || documents.length === 0) return null;
    
    const sectionTitles: Record<string, string> = {
      eventTickets: 'Event Tickets',
      events: 'Events',
      packages: 'Packages',
      lodges: 'Lodges',
      customers: 'Customers',
      bookingContacts: 'Booking Contacts',
      functions: 'Functions'
    };
    
    return (
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection(sectionName)}
          className="w-full bg-gray-100 px-4 py-2 flex justify-between items-center hover:bg-gray-200"
        >
          <h4 className="font-semibold">{sectionTitles[sectionName]} ({documents.length})</h4>
          <svg
            className={`w-5 h-5 transform transition-transform ${expandedSections[sectionName] ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {expandedSections[sectionName] && (
          <div className="p-4 space-y-4">
            {documents.map((doc: any, index: number) => (
              <div key={index} className="border rounded">
                <div className="bg-gray-50 px-3 py-2">
                  <h5 className="font-medium text-sm">
                    {displayNameFn ? displayNameFn(doc, index) : getDisplayName(doc)}
                  </h5>
                </div>
                <div className="p-2">
                  {renderFieldTree(doc, '', 0, sectionName, index)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[600px] max-h-[80vh] flex flex-col">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{mode === 'related' ? 'Select Related Field' : 'Select External Field'}</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {mode === 'related' ? (
            // Related Documents Mode
            <>
              {relatedDocuments?.relatedDocuments ? (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  {renderRelatedSection('eventTickets', relatedDocuments.relatedDocuments.eventTickets || [])}
                  {renderRelatedSection('events', relatedDocuments.relatedDocuments.events || [])}
                  {renderRelatedSection('packages', relatedDocuments.relatedDocuments.packages || [])}
                  {renderRelatedSection('lodges', relatedDocuments.relatedDocuments.lodges || [])}
                  {renderRelatedSection('customers', relatedDocuments.relatedDocuments.customers || [], 
                    (doc, index) => `${doc.firstName || ''} ${doc.lastName || ''}`.trim() || `Customer ${index + 1}`)}
                  {renderRelatedSection('bookingContacts', relatedDocuments.relatedDocuments.bookingContacts || [],
                    (doc, index) => `${doc.firstName || ''} ${doc.lastName || ''}`.trim() || `Contact ${index + 1}`)}
                  {renderRelatedSection('functions', relatedDocuments.relatedDocuments.functions || [],
                    (doc, index) => doc.name || doc.functionName || `Function ${index + 1}`)}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No related documents available
                </div>
              )}
            </>
          ) : (
            // Search Mode (existing code)
            <>
          {/* Collection Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Collection
            </label>
            <select
              value={selectedCollection}
              onChange={(e) => {
                setSelectedCollection(e.target.value);
                setSearchResults([]);
                setSelectedDocument(null);
              }}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a collection...</option>
              {collections.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          {selectedCollection && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Documents
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchDocuments()}
                  placeholder="Search by name fields..."
                  className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={searchDocuments}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border rounded-md max-h-48 overflow-y-auto">
              {searchResults.map((doc, index) => (
                <button
                  key={index}
                  onClick={() => handleDocumentSelect(doc)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0"
                >
                  <div className="font-medium text-sm">{getDisplayName(doc)}</div>
                  <div className="text-xs text-gray-600">
                    ID: {doc._id}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Document Fields */}
          {selectedDocument && (
            <div className="border rounded-md">
              <div className="bg-gray-50 px-3 py-2 border-b">
                <div className="font-medium text-sm">{getDisplayName(selectedDocument)}</div>
                <div className="text-xs text-gray-600">Select a field to use</div>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {renderFieldTree(selectedDocument)}
              </div>
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}