import React, { useState, useEffect } from 'react';
import { FieldOption, getValueByPath } from '@/utils/field-extractor';
import ExternalFieldSelector from './ExternalFieldSelector';

export interface DescriptionSegment {
  id: string;
  type: 'field' | 'text';
  value: string; // field path for 'field' type, static text for 'text' type
}

interface CompoundDescriptionBuilderProps {
  fieldName: string;
  segments: DescriptionSegment[];
  onSegmentsChange: (segments: DescriptionSegment[]) => void;
  allOptions: FieldOption[];
  paymentData: any;
  registrationData: any;
  relatedDocuments?: any;
  loadingRelatedDocs?: boolean;
}

export default function CompoundDescriptionBuilder({
  fieldName,
  segments,
  onSegmentsChange,
  allOptions,
  paymentData,
  registrationData,
  relatedDocuments,
  loadingRelatedDocs
}: CompoundDescriptionBuilderProps) {
  const [isBuilding, setIsBuilding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);
  const [addingFieldAt, setAddingFieldAt] = useState<number | null>(null);
  const [showExternalFieldSelector, setShowExternalFieldSelector] = useState(false);

  // Filter options based on search
  const filteredOptions = searchTerm
    ? allOptions.filter(opt => 
        opt.displayPath.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(opt.value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allOptions.slice(0, 50); // Show more options in the wider dropdown

  // Calculate preview value with automatic spacing
  const previewValue = segments.map((segment, index) => {
    let value = '';
    
    if (segment.type === 'text') {
      value = segment.value;
    } else {
      // Resolve field value
      if (segment.value.startsWith('external.')) {
        // For external fields, show the path for now (would need actual data lookup)
        value = `{${segment.value}}`;
      } else if (segment.value.startsWith('related.')) {
        // For related fields, try to resolve from relatedDocuments
        if (relatedDocuments?.relatedDocuments) {
          const cleanPath = segment.value.replace(/^related\./, '');
          console.log('Resolving related field:', {
            segmentValue: segment.value,
            cleanPath,
            relatedDocuments: relatedDocuments.relatedDocuments,
            value: getValueByPath(relatedDocuments.relatedDocuments, cleanPath)
          });
          const resolvedValue = getValueByPath(relatedDocuments.relatedDocuments, cleanPath);
          value = resolvedValue !== undefined && resolvedValue !== null ? String(resolvedValue) : `{${segment.value}}`;
        } else {
          console.log('No relatedDocuments available for:', segment.value);
          value = `{${segment.value}}`;
        }
      } else {
        // Handle fields with source prefix (payment., registration.)
        const cleanPath = segment.value.replace(/^(payment|registration)\./, '');
        const sourceData = segment.value.startsWith('payment') ? paymentData : 
                          segment.value.startsWith('registration') ? registrationData : null;
        if (sourceData) {
          const resolvedValue = getValueByPath(sourceData, cleanPath);
          value = resolvedValue !== undefined && resolvedValue !== null ? String(resolvedValue) : `{${segment.value}}`;
        } else {
          // Fallback for fields without prefix
          const source = segment.value.includes('payment') ? paymentData : registrationData;
          const resolvedValue = getValueByPath(source, segment.value);
          value = resolvedValue !== undefined && resolvedValue !== null ? String(resolvedValue) : `{${segment.value}}`;
        }
      }
    }
    
    // Add automatic spacing between segments
    if (index > 0 && value && segments[index - 1]) {
      const prevSegment = segments[index - 1];
      const prevIsText = prevSegment.type === 'text';
      const prevValue = prevIsText ? prevSegment.value : '';
      
      // Don't add space if previous segment ends with space or current starts with space
      if (prevIsText && prevValue.endsWith(' ')) {
        return value;
      }
      if (segment.type === 'text' && segment.value.startsWith(' ')) {
        return value;
      }
      
      // Add space between segments
      return ' ' + value;
    }
    
    return value;
  }).join('');

  const addSegment = (type: 'field' | 'text', value: string = '') => {
    const newSegment: DescriptionSegment = {
      id: `seg_${Date.now()}_${Math.random()}`,
      type,
      value
    };
    
    if (addingFieldAt !== null) {
      const newSegments = [...segments];
      newSegments.splice(addingFieldAt, 0, newSegment);
      onSegmentsChange(newSegments);
      setAddingFieldAt(null);
    } else {
      onSegmentsChange([...segments, newSegment]);
    }
  };

  const updateSegment = (id: string, value: string) => {
    onSegmentsChange(segments.map(seg => 
      seg.id === id ? { ...seg, value } : seg
    ));
  };

  const removeSegment = (id: string) => {
    onSegmentsChange(segments.filter(seg => seg.id !== id));
  };

  const moveSegment = (id: string, direction: 'left' | 'right') => {
    const index = segments.findIndex(seg => seg.id === id);
    if (index === -1) return;
    
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= segments.length) return;
    
    const newSegments = [...segments];
    [newSegments[index], newSegments[newIndex]] = [newSegments[newIndex], newSegments[index]];
    onSegmentsChange(newSegments);
  };

  const handleFieldSelect = (option: FieldOption) => {
    // Use displayPath which includes the source prefix (e.g., "payment.amount")
    addSegment('field', option.displayPath);
    setShowFieldDropdown(false);
    setSearchTerm('');
  };

  if (!isBuilding) {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {fieldName}
        </label>
        <div 
          className="w-full px-3 py-2 border rounded-md bg-white cursor-pointer hover:bg-gray-50"
          onClick={() => setIsBuilding(true)}
        >
          <span className={previewValue ? "text-gray-700" : "text-gray-400"}>
            {previewValue || `Click to build ${fieldName.toLowerCase()}`}
          </span>
        </div>
        {segments.length > 0 && (
          <div className="mt-1 text-xs text-gray-600">
            {segments.length} segment{segments.length !== 1 ? 's' : ''} configured
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {fieldName} Builder
        </label>
        <button
          onClick={() => setIsBuilding(false)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Done
        </button>
      </div>

      {/* Preview */}
      <div className="p-3 bg-gray-50 rounded-md mb-3">
        <div className="text-xs text-gray-600 mb-1">Preview:</div>
        <div className="font-mono text-sm">
          {previewValue || <span className="text-gray-400">Empty description</span>}
        </div>
      </div>

      {/* Segments */}
      <div className="space-y-2 mb-3">
        {segments.length === 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            No segments yet. Add fields or text below.
          </div>
        )}
        
        {segments.map((segment, index) => (
          <div key={segment.id} className="flex items-center gap-2">
            <div className="flex-1">
              {segment.type === 'text' ? (
                <input
                  type="text"
                  value={segment.value}
                  onChange={(e) => updateSegment(segment.id, e.target.value)}
                  placeholder="Enter text..."
                  className="w-full px-2 py-1 border rounded text-sm"
                />
              ) : (
                <div className="px-2 py-1 bg-blue-50 border border-blue-200 rounded text-sm">
                  <span className="text-blue-700 font-mono">{segment.value}</span>
                  <span className="text-blue-600 ml-2">
                    → {(() => {
                      if (segment.value.startsWith('external.')) return 'external field';
                      if (segment.value.startsWith('related.')) {
                        if (relatedDocuments?.relatedDocuments) {
                          const cleanPath = segment.value.replace(/^related\./, '');
                          const value = getValueByPath(relatedDocuments.relatedDocuments, cleanPath);
                          return value !== undefined && value !== null ? String(value) : 'null';
                        }
                        return 'loading...';
                      }
                      // Handle fields with source prefix
                      const cleanPath = segment.value.replace(/^(payment|registration)\./, '');
                      const sourceData = segment.value.startsWith('payment') ? paymentData : 
                                       segment.value.startsWith('registration') ? registrationData : null;
                      if (sourceData) {
                        const value = getValueByPath(sourceData, cleanPath);
                        return value !== undefined && value !== null ? String(value) : 'null';
                      }
                      // Fallback
                      const source = segment.value.includes('payment') ? paymentData : registrationData;
                      const value = getValueByPath(source, segment.value);
                      return value !== undefined && value !== null ? String(value) : 'null';
                    })()}
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => moveSegment(segment.id, 'left')}
                disabled={index === 0}
                className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                title="Move left"
              >
                ←
              </button>
              <button
                onClick={() => moveSegment(segment.id, 'right')}
                disabled={index === segments.length - 1}
                className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                title="Move right"
              >
                →
              </button>
              <button
                onClick={() => removeSegment(segment.id)}
                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                title="Remove this segment"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <button
            onClick={() => {
              setShowFieldDropdown(!showFieldDropdown);
              setAddingFieldAt(segments.length);
            }}
            className="w-full px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            + Add Field
          </button>
          
          {showFieldDropdown && (
            <div className="absolute z-10 w-[200%] mt-1 bg-white border rounded-md shadow-lg max-h-96 overflow-y-auto">
              <div className="p-2 border-b">
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm"
                  autoFocus
                />
              </div>
              
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No matching fields found</div>
              ) : (
                filteredOptions.map((option, index) => (
                  <button
                    key={`${option.source}-${option.path}-${index}`}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0 text-sm"
                    onClick={() => handleFieldSelect(option)}
                  >
                    <div className="font-medium break-words whitespace-normal">{option.displayPath}</div>
                    <div className="text-xs text-gray-600 break-words whitespace-normal">
                      {String(option.value)}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        
        <button
          onClick={() => addSegment('text')}
          className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
        >
          + Add Text
        </button>
        
        <button
          onClick={() => setShowExternalFieldSelector(true)}
          className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
        >
          + Add Related Field
        </button>
      </div>
      
      {/* External Field Selector Modal */}
      {showExternalFieldSelector && (
        <ExternalFieldSelector
          mode="related"
          relatedDocuments={relatedDocuments}
          onFieldSelect={(path, value) => {
            addSegment('field', path);
            setShowExternalFieldSelector(false);
          }}
          onClose={() => setShowExternalFieldSelector(false)}
        />
      )}
    </div>
  );
}