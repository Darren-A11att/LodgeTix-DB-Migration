import React, { useState, useEffect } from 'react';
import { ArrayMapping, ArrayChildMapping } from '@/services/field-mapping-storage';
import { extractAllFieldOptions, getValueByPath, extractNestedStructure, NestedField } from '@/utils/field-extractor';
import TemplateBuilder from './TemplateBuilder';

interface ArrayRelationshipBuilderProps {
  arrayMapping: ArrayMapping | null;
  onChange: (mapping: ArrayMapping) => void;
  registrationData?: any;
  paymentData?: any;
  onCancel: () => void;
}

export default function ArrayRelationshipBuilder({
  arrayMapping,
  onChange,
  registrationData,
  paymentData,
  onCancel
}: ArrayRelationshipBuilderProps) {
  const [mapping, setMapping] = useState<ArrayMapping>(arrayMapping || {
    id: `array_mapping_${Date.now()}`,
    enabled: true,
    parentArray: {
      path: '',
      itemConfig: {
        descriptionTemplate: '',
        quantity: { type: 'fixed', value: 1 },
        unitPrice: { type: 'fixed', value: 0 }
      },
      keyField: ''
    },
    childArrays: []
  });

  // State for navigation path
  const [navigationPath, setNavigationPath] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  
  // Extract root level structure
  const rootFields: NestedField[] = [];
  if (registrationData) {
    rootFields.push({
      name: 'registration',
      path: '',
      displayPath: 'registration',
      type: 'object',
      children: extractNestedStructure(registrationData, 'registration'),
      value: registrationData
    });
  }
  if (paymentData) {
    rootFields.push({
      name: 'payment',
      path: '',
      displayPath: 'payment',
      type: 'object',
      children: extractNestedStructure(paymentData, 'payment'),
      value: paymentData
    });
  }
  
  // Keep the old array extraction for backward compatibility with child arrays
  const allData = { registration: registrationData, payment: paymentData };
  const arrayFields = extractAllFieldOptions(paymentData, registrationData)
    .filter(field => {
      // Use displayPath which contains the full path including source prefix
      const pathToCheck = field.displayPath;
      let value;
      
      if (pathToCheck.startsWith('payment.')) {
        value = getValueByPath(paymentData, pathToCheck.replace('payment.', ''));
      } else if (pathToCheck.startsWith('registration.')) {
        value = getValueByPath(registrationData, pathToCheck.replace('registration.', ''));
      }
      
      return Array.isArray(value);
    });

  // Get fields from selected parent array
  const [parentArrayFields, setParentArrayFields] = useState<string[]>([]);
  const [parentSampleData, setParentSampleData] = useState<any>(null);

  useEffect(() => {
    if (mapping.parentArray.path) {
      let value;
      
      if (mapping.parentArray.path.startsWith('payment.')) {
        value = getValueByPath(paymentData, mapping.parentArray.path.replace('payment.', ''));
      } else if (mapping.parentArray.path.startsWith('registration.')) {
        value = getValueByPath(registrationData, mapping.parentArray.path.replace('registration.', ''));
      }
      
      if (Array.isArray(value) && value.length > 0) {
        const firstItem = value[0];
        setParentSampleData(firstItem);
        setParentArrayFields(Object.keys(firstItem));
      }
    }
  }, [mapping.parentArray.path, paymentData, registrationData]);

  const updateParentArray = (field: keyof typeof mapping.parentArray, value: any) => {
    setMapping({
      ...mapping,
      parentArray: {
        ...mapping.parentArray,
        [field]: value
      }
    });
  };

  const updateParentItemConfig = (field: keyof typeof mapping.parentArray.itemConfig, value: any) => {
    setMapping({
      ...mapping,
      parentArray: {
        ...mapping.parentArray,
        itemConfig: {
          ...mapping.parentArray.itemConfig,
          [field]: value
        }
      }
    });
  };

  const addChildArray = () => {
    const newChild: ArrayChildMapping = {
      path: '',
      relationshipKey: '',
      parentKey: mapping.parentArray.keyField,
      itemConfig: {
        descriptionTemplate: '',
        quantity: { type: 'fixed', value: 1 },
        unitPrice: { type: 'fixed', value: 0 }
      },
      lookups: []
    };
    
    setMapping({
      ...mapping,
      childArrays: [...(mapping.childArrays || []), newChild]
    });
  };

  const updateChildArray = (index: number, updates: Partial<ArrayChildMapping>) => {
    const updatedChildren = [...(mapping.childArrays || [])];
    updatedChildren[index] = { ...updatedChildren[index], ...updates };
    setMapping({
      ...mapping,
      childArrays: updatedChildren
    });
  };

  const removeChildArray = (index: number) => {
    setMapping({
      ...mapping,
      childArrays: mapping.childArrays?.filter((_, i) => i !== index) || []
    });
  };

  const handleSave = () => {
    onChange(mapping);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">Array Relationship Builder</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure how arrays in your data map to line items and sub-items
          </p>
        </div>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {/* Parent Array Configuration */}
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="font-medium text-gray-900 mb-3">Parent Array</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Array Field
                </label>
                
                {/* Breadcrumb path display */}
                {navigationPath.length > 0 && (
                  <div className="text-xs text-gray-600 mb-2">
                    Path: {navigationPath.join(' → ')}
                    <button
                      onClick={() => {
                        setNavigationPath([]);
                        setSelectedPaths([]);
                      }}
                      className="ml-2 text-blue-600 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
                
                {/* Dynamic dropdown navigation */}
                <div className="space-y-2">
                  {(() => {
                    let currentLevel = rootFields;
                    const dropdowns = [];
                    
                    // Root level dropdown
                    dropdowns.push(
                      <select
                        key="root"
                        value={selectedPaths[0] || ''}
                        onChange={(e) => {
                          const selected = e.target.value;
                          if (selected) {
                            const field = rootFields.find(f => f.name === selected);
                            if (field?.type === 'array') {
                              updateParentArray('path', field.displayPath);
                              setNavigationPath([field.name]);
                              setSelectedPaths([selected]);
                            } else {
                              setSelectedPaths([selected]);
                              setNavigationPath([selected]);
                            }
                          } else {
                            setSelectedPaths([]);
                            setNavigationPath([]);
                            updateParentArray('path', '');
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="">Select source...</option>
                        {rootFields.map(field => (
                          <option key={field.name} value={field.name}>
                            {field.type === 'object' ? '📁' : '📋'} {field.name}
                          </option>
                        ))}
                      </select>
                    );
                    
                    // Navigate through selected paths
                    for (let i = 0; i < selectedPaths.length; i++) {
                      const field = currentLevel.find(f => f.name === selectedPaths[i]);
                      if (field && field.type === 'object' && field.children) {
                        currentLevel = field.children;
                        // Only show dropdown if there are objects or arrays to navigate to
                        const hasNavigableChildren = currentLevel.some(f => f.type === 'object' || f.type === 'array');
                        if (!hasNavigableChildren) continue;
                        
                        // Add dropdown for this level
                        dropdowns.push(
                          <select
                            key={`level-${i+1}`}
                            value={selectedPaths[i+1] || ''}
                            onChange={(e) => {
                              const selected = e.target.value;
                              const newPaths = [...selectedPaths.slice(0, i+1)];
                              const newNavPaths = [...navigationPath.slice(0, i+1)];
                              
                              if (selected) {
                                const selectedField = currentLevel.find(f => f.name === selected);
                                newPaths.push(selected);
                                newNavPaths.push(selected);
                                
                                if (selectedField?.type === 'array') {
                                  // This is an array - set it as the parent array
                                  updateParentArray('path', selectedField.displayPath);
                                  setNavigationPath(newNavPaths);
                                  setSelectedPaths(newPaths);
                                } else {
                                  // This is an object - allow further navigation
                                  setSelectedPaths(newPaths);
                                  setNavigationPath(newNavPaths);
                                  updateParentArray('path', '');
                                }
                              } else {
                                setSelectedPaths(newPaths);
                                setNavigationPath(newNavPaths);
                                updateParentArray('path', '');
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">Select field...</option>
                            {currentLevel
                              .filter(field => field.type === 'object' || field.type === 'array')
                              .map(field => (
                                <option key={field.name} value={field.name}>
                                  {field.type === 'object' ? '📁' : `📋 [${field.arrayLength} items]`} {field.name}
                                </option>
                              ))}
                          </select>
                        );
                      }
                    }
                    
                    return dropdowns;
                  })()}
                </div>
                
                {/* Show current selection */}
                {mapping.parentArray.path && (
                  <div className="mt-2 text-sm text-green-600">
                    Selected array: {mapping.parentArray.path}
                  </div>
                )}
              </div>

              {mapping.parentArray.path && parentArrayFields.length > 0 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Key Field (for relationships)
                    </label>
                    <select
                      value={mapping.parentArray.keyField}
                      onChange={(e) => updateParentArray('keyField', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select key field...</option>
                      {parentArrayFields.map(field => {
                        const value = parentSampleData?.[field];
                        const displayValue = value !== undefined ? 
                          (typeof value === 'object' ? JSON.stringify(value) : String(value)) : 
                          'null';
                        return (
                          <option key={field} value={field}>
                            {field}: {displayValue.length > 50 ? displayValue.substring(0, 50) + '...' : displayValue}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <TemplateBuilder
                      template={mapping.parentArray.itemConfig.descriptionTemplate}
                      onChange={(template) => updateParentItemConfig('descriptionTemplate', template)}
                      availableFields={parentArrayFields}
                      sampleData={parentSampleData}
                      placeholder="e.g., {title} {firstName} {lastName} - {attendeeType}"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={mapping.parentArray.itemConfig.quantity.type}
                          onChange={(e) => updateParentItemConfig('quantity', {
                            type: e.target.value as 'fixed' | 'field' | 'blank',
                            value: e.target.value === 'fixed' ? 1 : e.target.value === 'blank' ? null : ''
                          })}
                          className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="fixed">Fixed</option>
                          <option value="field">Field</option>
                          <option value="blank">Blank</option>
                        </select>
                        {mapping.parentArray.itemConfig.quantity.type === 'fixed' ? (
                          <input
                            type="number"
                            value={mapping.parentArray.itemConfig.quantity.value as number}
                            onChange={(e) => updateParentItemConfig('quantity', {
                              ...mapping.parentArray.itemConfig.quantity,
                              value: parseFloat(e.target.value) || 0
                            })}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
                          />
                        ) : mapping.parentArray.itemConfig.quantity.type === 'field' ? (
                          <select
                            value={mapping.parentArray.itemConfig.quantity.value as string}
                            onChange={(e) => updateParentItemConfig('quantity', {
                              ...mapping.parentArray.itemConfig.quantity,
                              value: e.target.value
                            })}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">Select field...</option>
                            {parentArrayFields.map(field => {
                              const value = parentSampleData?.[field];
                              const displayValue = value !== undefined ? 
                                (typeof value === 'object' ? JSON.stringify(value) : String(value)) : 
                                'null';
                              return (
                                <option key={field} value={field}>
                                  {field}: {displayValue.length > 30 ? displayValue.substring(0, 30) + '...' : displayValue}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <span className="flex-1 px-2 py-1 text-gray-500 text-sm">Will not display quantity</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit Price
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={mapping.parentArray.itemConfig.unitPrice.type}
                          onChange={(e) => updateParentItemConfig('unitPrice', {
                            type: e.target.value as 'fixed' | 'field' | 'blank',
                            value: e.target.value === 'fixed' ? 0 : e.target.value === 'blank' ? null : ''
                          })}
                          className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="fixed">Fixed</option>
                          <option value="field">Field</option>
                          <option value="blank">Blank</option>
                        </select>
                        {mapping.parentArray.itemConfig.unitPrice.type === 'fixed' ? (
                          <input
                            type="number"
                            value={mapping.parentArray.itemConfig.unitPrice.value as number}
                            onChange={(e) => updateParentItemConfig('unitPrice', {
                              ...mapping.parentArray.itemConfig.unitPrice,
                              value: parseFloat(e.target.value) || 0
                            })}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
                          />
                        ) : mapping.parentArray.itemConfig.unitPrice.type === 'field' ? (
                          <select
                            value={mapping.parentArray.itemConfig.unitPrice.value as string}
                            onChange={(e) => updateParentItemConfig('unitPrice', {
                              ...mapping.parentArray.itemConfig.unitPrice,
                              value: e.target.value
                            })}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">Select field...</option>
                            {parentArrayFields.map(field => {
                              const value = parentSampleData?.[field];
                              const displayValue = value !== undefined ? 
                                (typeof value === 'object' ? JSON.stringify(value) : String(value)) : 
                                'null';
                              return (
                                <option key={field} value={field}>
                                  {field}: {displayValue.length > 30 ? displayValue.substring(0, 30) + '...' : displayValue}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <span className="flex-1 px-2 py-1 text-gray-500 text-sm">Will not display price</span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Child Arrays */}
          {mapping.parentArray.path && mapping.parentArray.keyField && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-gray-900">Sub-items Configuration</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newChild: ArrayChildMapping = {
                        path: '',
                        relationshipKey: '',
                        parentKey: mapping.parentArray.keyField,
                        itemConfig: {
                          descriptionTemplate: '',
                          quantity: { type: 'fixed', value: 1 },
                          unitPrice: { type: 'fixed', value: 0 }
                        },
                        lookups: [],
                        isNested: true
                      };
                      setMapping({
                        ...mapping,
                        childArrays: [...(mapping.childArrays || []), newChild]
                      });
                    }}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                  >
                    + Add Nested Sub-items
                  </button>
                  <button
                    onClick={() => {
                      const newChild: ArrayChildMapping = {
                        path: '',
                        relationshipKey: '',
                        parentKey: mapping.parentArray.keyField,
                        itemConfig: {
                          descriptionTemplate: '',
                          quantity: { type: 'fixed', value: 1 },
                          unitPrice: { type: 'fixed', value: 0 }
                        },
                        lookups: [],
                        isNested: false
                      };
                      setMapping({
                        ...mapping,
                        childArrays: [...(mapping.childArrays || []), newChild]
                      });
                    }}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                  >
                    + Add Related Array Items
                  </button>
                </div>
              </div>

              {mapping.childArrays?.map((child, index) => (
                <ChildArrayConfig
                  key={index}
                  child={child}
                  index={index}
                  parentKeyField={mapping.parentArray.keyField}
                  parentArrayPath={mapping.parentArray.path}
                  arrayFields={arrayFields}
                  allData={allData}
                  registrationData={registrationData}
                  paymentData={paymentData}
                  onChange={(updates) => updateChildArray(index, updates)}
                  onRemove={() => removeChildArray(index)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Preview Section */}
        {mapping.parentArray.path && mapping.parentArray.keyField && (
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="font-medium text-gray-900 mb-2">Preview</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div className="font-medium">Sample Output:</div>
              {(() => {
                const parentArray = getValueByPath({ registration: registrationData, payment: paymentData }, mapping.parentArray.path);
                if (!Array.isArray(parentArray) || parentArray.length === 0) {
                  return <div className="italic">No data available for preview</div>;
                }
                
                const firstParent = parentArray[0];
                const parentDesc = mapping.parentArray.itemConfig.descriptionTemplate
                  .replace(/\{([^}]+)\}/g, (match, field) => firstParent[field] || `[${field}]`);
                
                return (
                  <div className="font-mono text-xs bg-white p-2 rounded border border-gray-200">
                    <div>{parentDesc}</div>
                    {mapping.childArrays?.map((childConfig, idx) => {
                      const childArray = getValueByPath({ registration: registrationData, payment: paymentData }, childConfig.path);
                      if (!Array.isArray(childArray)) return null;
                      
                      const parentKeyValue = firstParent[mapping.parentArray.keyField];
                      const relatedChildren = childArray.filter(
                        child => child[childConfig.relationshipKey] === parentKeyValue
                      );
                      
                      return relatedChildren.slice(0, 2).map((child, childIdx) => {
                        const childDesc = childConfig.itemConfig.descriptionTemplate
                          .replace(/\{([^}]+)\}/g, (match, field) => child[field] || `[${field}]`);
                        return (
                          <div key={`${idx}-${childIdx}`} className="pl-4 text-gray-600">
                            - {childDesc}
                          </div>
                        );
                      });
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={!mapping.parentArray.path || !mapping.parentArray.keyField}
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

// Child Array Configuration Component
function ChildArrayConfig({
  child,
  index,
  parentKeyField,
  parentArrayPath,
  arrayFields,
  allData,
  registrationData,
  paymentData,
  onChange,
  onRemove
}: {
  child: ArrayChildMapping;
  index: number;
  parentKeyField: string;
  parentArrayPath: string;
  arrayFields: any[];
  allData: any;
  registrationData?: any;
  paymentData?: any;
  onChange: (updates: Partial<ArrayChildMapping>) => void;
  onRemove: () => void;
}) {
  const [childArrayFields, setChildArrayFields] = useState<string[]>([]);
  const [childSampleData, setChildSampleData] = useState<any>(null);
  const [showLookupConfig, setShowLookupConfig] = useState(false);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [nestedArrays, setNestedArrays] = useState<any[]>([]);
  const [relatedArrays, setRelatedArrays] = useState<any[]>([]);
  
  // Navigation state for related arrays
  const [relatedNavigationPath, setRelatedNavigationPath] = useState<string[]>([]);
  const [relatedSelectedPaths, setRelatedSelectedPaths] = useState<string[]>([]);
  
  // State for lookup collection fields
  const [lookupCollectionFields, setLookupCollectionFields] = useState<Record<string, any[]>>({});
  
  // Fetch fields for existing lookup collections
  useEffect(() => {
    const loadLookupFields = async () => {
      if (child.lookups && showLookupConfig) {
        for (const lookup of child.lookups) {
          if (lookup.collection && !lookupCollectionFields[lookup.collection]) {
            await fetchLookupCollectionFields(lookup.collection);
          }
        }
      }
    };
    loadLookupFields();
  }, [showLookupConfig, child.lookups?.length]);

  useEffect(() => {
    // Check for nested arrays within parent items
    const parentPath = parentArrayPath;
    const nested: any[] = [];
    
    if (parentPath) {
      const parentArray = getValueByPath(allData, parentPath);
      if (Array.isArray(parentArray) && parentArray.length > 0) {
        const firstParentItem = parentArray[0];
        
        // Find arrays nested within parent items
        Object.entries(firstParentItem).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            nested.push({
              displayPath: `${parentPath}[].${key}`,
              name: key,
              isNested: true,
              arrayLength: value.length
            });
          }
        });
      }
    }
    
    setNestedArrays(nested);
    
    // Related arrays are all arrays in the data (excluding the parent itself)
    const related = arrayFields.filter(field => 
      field.displayPath !== parentArrayPath
    );
    setRelatedArrays(related);
  }, [parentArrayPath, arrayFields]);

  useEffect(() => {
    if (child.path) {
      const value = getValueByPath(allData, child.path);
      
      if (Array.isArray(value) && value.length > 0) {
        const firstItem = value[0];
        setChildSampleData(firstItem);
        setChildArrayFields(Object.keys(firstItem));
        
        // Get all available fields including lookups
        const baseFields = Object.keys(firstItem);
        
        // Add lookup fields with collection prefix
        const lookupFields: string[] = [];
        if (child.lookups) {
          child.lookups.forEach(lookup => {
            if (lookup.collection && lookupCollectionFields[lookup.collection]) {
              lookupCollectionFields[lookup.collection].forEach(field => {
                lookupFields.push(`${lookup.collection}.${field.name}`);
              });
            }
          });
        }
        
        setAvailableFields([...baseFields, ...lookupFields]);
      } else {
        setChildArrayFields([]);
        setChildSampleData(null);
        setAvailableFields([]);
      }
    }
  }, [child.path, child.lookups, allData, lookupCollectionFields]);

  // Update available fields when lookup collection fields are loaded
  useEffect(() => {
    if (childArrayFields.length > 0 && child.lookups) {
      const baseFields = childArrayFields;
      const lookupFields: string[] = [];
      
      child.lookups.forEach(lookup => {
        if (lookup.collection && lookupCollectionFields[lookup.collection]) {
          lookupCollectionFields[lookup.collection].forEach(field => {
            lookupFields.push(`${lookup.collection}.${field.name}`);
          });
        }
      });
      
      setAvailableFields([...baseFields, ...lookupFields]);
    }
  }, [lookupCollectionFields, child.lookups, childArrayFields]);

  const addLookup = () => {
    const newLookup = {
      localField: '',
      collection: 'eventTickets',
      foreignField: '',
      includeFields: [] // Will be populated automatically with all fields
    };
    onChange({
      lookups: [...(child.lookups || []), newLookup]
    });
    
    // Immediately fetch fields for the default collection
    if (!lookupCollectionFields['eventTickets']) {
      fetchLookupCollectionFields('eventTickets');
    }
  };

  const updateLookup = (lookupIndex: number, updates: any) => {
    const updatedLookups = [...(child.lookups || [])];
    updatedLookups[lookupIndex] = { ...updatedLookups[lookupIndex], ...updates };
    onChange({ lookups: updatedLookups });
  };

  const removeLookup = (lookupIndex: number) => {
    const updatedLookups = (child.lookups || []).filter((_, i) => i !== lookupIndex);
    onChange({ lookups: updatedLookups });
  };
  
  // Fetch sample fields from lookup collection
  const fetchLookupCollectionFields = async (collection: string) => {
    try {
      const response = await fetch(`/api/collections/${collection}/documents?limit=5`);
      if (response.ok) {
        const data = await response.json();
        if (data.documents && data.documents.length > 0) {
          // Get all unique field names from all documents
          const fieldMap = new Map<string, Set<any>>();
          
          data.documents.forEach((doc: any) => {
            Object.entries(doc).forEach(([key, value]) => {
              if (!fieldMap.has(key)) {
                fieldMap.set(key, new Set());
              }
              fieldMap.get(key)!.add(value);
            });
          });
          
          // Convert to array with unique values
          const fields = Array.from(fieldMap.entries()).map(([key, valueSet]) => {
            const values = Array.from(valueSet);
            const displayValues = values.map(v => 
              typeof v === 'object' ? JSON.stringify(v).substring(0, 30) : String(v).substring(0, 30)
            );
            return {
              name: key,
              values: values,
              displayValue: displayValues.join(', ')
            };
          });
          
          setLookupCollectionFields(prev => ({
            ...prev,
            [collection]: fields
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch collection fields:', error);
    }
  };

  return (
    <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
      <div className="flex justify-between items-start mb-3">
        <h5 className="font-medium text-gray-900">
          {child.isNested ? 'Nested Sub-items' : 'Related Array Items'} {index + 1}
        </h5>
        <button
          onClick={onRemove}
          className="text-red-600 hover:text-red-800 text-sm"
        >
          Remove
        </button>
      </div>

      <div className="space-y-3">
        {child.isNested && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Nested Array Field
            </label>
            <select
              value={child.path}
              onChange={(e) => onChange({ path: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Select an array...</option>
              {nestedArrays.length > 0 ? (
                nestedArrays.map(field => (
                  <option key={field.displayPath} value={field.displayPath}>
                    {field.name} [{field.arrayLength} items]
                  </option>
                ))
              ) : (
                <option disabled>No nested arrays found in parent items</option>
              )}
            </select>
            
            {child.path && (
              <div className="mt-1 text-xs text-gray-500">
                Each parent item has its own instance of this array
              </div>
            )}
          </div>
        )}

        {/* Navigation for related arrays */}
        {!child.isNested && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Select Related Array
            </label>
            
            {/* Current selection display */}
            {child.path && (
              <div className="mb-2 text-sm text-green-600">
                Selected: {child.path}
              </div>
            )}
            
            {/* Breadcrumb path display */}
            {relatedNavigationPath.length > 0 && (
              <div className="text-xs text-gray-600">
                Path: {relatedNavigationPath.join(' → ')}
                <button
                  onClick={() => {
                    setRelatedNavigationPath([]);
                    setRelatedSelectedPaths([]);
                    onChange({ path: '' });
                  }}
                  className="ml-2 text-blue-600 hover:underline"
                >
                  Clear
                </button>
              </div>
            )}
            
            {/* Dynamic dropdown navigation */}
            <div className="space-y-2">
              {(() => {
                // Extract root level structure
                const rootFields: NestedField[] = [];
                if (registrationData) {
                  rootFields.push({
                    name: 'registration',
                    path: '',
                    displayPath: 'registration',
                    type: 'object',
                    children: extractNestedStructure(registrationData, 'registration'),
                    value: registrationData
                  });
                }
                if (paymentData) {
                  rootFields.push({
                    name: 'payment',
                    path: '',
                    displayPath: 'payment',
                    type: 'object',
                    children: extractNestedStructure(paymentData, 'payment'),
                    value: paymentData
                  });
                }
                
                let currentLevel = rootFields;
                const dropdowns = [];
                
                // Root level dropdown
                dropdowns.push(
                  <select
                    key="root"
                    value={relatedSelectedPaths[0] || ''}
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected) {
                        const field = rootFields.find(f => f.name === selected);
                        if (field?.type === 'array') {
                          onChange({ path: field.displayPath });
                          setRelatedNavigationPath([field.name]);
                          setRelatedSelectedPaths([selected]);
                        } else {
                          setRelatedSelectedPaths([selected]);
                          setRelatedNavigationPath([selected]);
                          onChange({ path: '' });
                        }
                      } else {
                        setRelatedSelectedPaths([]);
                        setRelatedNavigationPath([]);
                        onChange({ path: '' });
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select source...</option>
                    {rootFields.map(field => (
                      <option key={field.name} value={field.name}>
                        {field.type === 'object' ? '📁' : '📋'} {field.name}
                      </option>
                    ))}
                  </select>
                );
                
                // Navigate through selected paths
                for (let i = 0; i < relatedSelectedPaths.length; i++) {
                  const field = currentLevel.find(f => f.name === relatedSelectedPaths[i]);
                  if (field && field.type === 'object' && field.children) {
                    currentLevel = field.children;
                    // Only show dropdown if there are objects or arrays to navigate to
                    const hasNavigableChildren = currentLevel.some(f => f.type === 'object' || f.type === 'array');
                    if (!hasNavigableChildren) continue;
                    
                    // Add dropdown for this level
                    dropdowns.push(
                      <select
                        key={`level-${i+1}`}
                        value={relatedSelectedPaths[i+1] || ''}
                        onChange={(e) => {
                          const selected = e.target.value;
                          const newPaths = [...relatedSelectedPaths.slice(0, i+1)];
                          const newNavPaths = [...relatedNavigationPath.slice(0, i+1)];
                          
                          if (selected) {
                            const selectedField = currentLevel.find(f => f.name === selected);
                            newPaths.push(selected);
                            newNavPaths.push(selected);
                            
                            if (selectedField?.type === 'array') {
                              // This is an array - set it as the child array
                              onChange({ path: selectedField.displayPath });
                              setRelatedNavigationPath(newNavPaths);
                              setRelatedSelectedPaths(newPaths);
                            } else {
                              // This is an object - allow further navigation
                              setRelatedSelectedPaths(newPaths);
                              setRelatedNavigationPath(newNavPaths);
                              onChange({ path: '' });
                            }
                          } else {
                            setRelatedSelectedPaths(newPaths);
                            setRelatedNavigationPath(newNavPaths);
                            onChange({ path: '' });
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="">Select field...</option>
                        {currentLevel
                          .filter(field => field.type === 'object' || field.type === 'array')
                          .map(field => (
                            <option key={field.name} value={field.name}>
                              {field.type === 'object' ? '📁' : `📋 [${field.arrayLength} items]`} {field.name}
                            </option>
                          ))}
                      </select>
                    );
                  }
                }
                
                return dropdowns;
              })()}
            </div>
          </div>
        )}
        
        {child.path && childArrayFields.length > 0 && (
          <>
            {!child.isNested && (
              <div className="bg-yellow-50 p-2 rounded text-xs text-yellow-800 mb-3">
                <strong>Relationship Configuration:</strong> Select which field in each array links them together
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Key Field
                </label>
                <input
                  type="text"
                  value={parentKeyField}
                  disabled
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm bg-gray-100"
                  title="This is the key field from the parent array"
                />
                <div className="text-xs text-gray-500 mt-1">From parent array</div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Child Linking Field
                </label>
                <select
                  value={child.relationshipKey}
                  onChange={(e) => onChange({ relationshipKey: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                  title="Select the field in this array that matches the parent key"
                >
                  <option value="">Select linking field...</option>
                  {childArrayFields.map(field => {
                    const value = childSampleData?.[field];
                    const displayValue = value !== undefined ? 
                      (typeof value === 'object' ? JSON.stringify(value) : String(value)) : 
                      'null';
                    return (
                      <option key={field} value={field}>
                        {field}: {displayValue.length > 50 ? displayValue.substring(0, 50) + '...' : displayValue}
                      </option>
                    );
                  })}
                </select>
                <div className="text-xs text-gray-500 mt-1">Field that matches parent key</div>
              </div>
            </div>

            {/* External Lookups Section */}
            <div className="bg-white p-3 rounded-md border border-blue-200">
              <div className="flex justify-between items-center mb-2">
                <h6 className="text-sm font-medium text-gray-700">External Lookups</h6>
                <button
                  onClick={() => {
                    setShowLookupConfig(!showLookupConfig);
                    // When showing config, fetch fields for all lookups
                    if (!showLookupConfig && child.lookups) {
                      child.lookups.forEach(lookup => {
                        if (lookup.collection && !lookupCollectionFields[lookup.collection]) {
                          fetchLookupCollectionFields(lookup.collection);
                        }
                      });
                    }
                  }}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  {showLookupConfig ? 'Hide' : 'Configure'}
                </button>
              </div>
              
              {showLookupConfig && (
                <div className="space-y-2">
                  {child.lookups?.map((lookup, lookupIndex) => (
                    <div key={lookupIndex} className="bg-gray-50 p-2 rounded text-xs space-y-1">
                      <div className="grid grid-cols-2 gap-1 mb-1">
                        <div>
                          <label className="text-xs text-gray-600">Local field (from {child.path?.split('.').pop()})</label>
                          <select
                            value={lookup.localField}
                            onChange={(e) => updateLookup(lookupIndex, { localField: e.target.value })}
                            className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                          >
                            <option value="">Select field...</option>
                            {childArrayFields.map(field => (
                              <option key={field} value={field}>{field}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Collection</label>
                          <select
                            value={lookup.collection}
                            onChange={(e) => {
                              updateLookup(lookupIndex, { collection: e.target.value });
                              // Fetch fields from the selected collection
                              if (e.target.value && !lookupCollectionFields[e.target.value]) {
                                fetchLookupCollectionFields(e.target.value);
                              }
                            }}
                            className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                          >
                            <option value="eventTickets">eventTickets</option>
                            <option value="products">products</option>
                            <option value="functions">functions</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-gray-600">Match field in {lookup.collection}:</span>
                        {lookupCollectionFields[lookup.collection] ? (
                          <select
                            value={lookup.foreignField || ''}
                            onChange={(e) => updateLookup(lookupIndex, { foreignField: e.target.value })}
                            className="flex-1 px-1 py-0.5 border border-gray-300 rounded text-xs"
                          >
                            <option value="">Select field...</option>
                            {lookupCollectionFields[lookup.collection].map((field: any) => (
                              <option key={field.name} value={field.name}>
                                {field.name}: {field.displayValue}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={lookup.foreignField || ''}
                            onChange={(e) => updateLookup(lookupIndex, { foreignField: e.target.value })}
                            placeholder="e.g., eventTicketId"
                            className="flex-1 px-1 py-0.5 border border-gray-300 rounded text-xs"
                          />
                        )}
                        <button
                          onClick={() => removeLookup(lookupIndex)}
                          className="text-red-600 hover:text-red-800"
                        >
                          ×
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        {lookup.localField && lookup.foreignField && lookup.collection && (
                          <div>Will match where {lookup.localField} = {lookup.collection}.{lookup.foreignField}</div>
                        )}
                        {lookup.collection && (
                          <div>All fields from {lookup.collection} will be available in the template with prefix: {lookup.collection}.</div>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addLookup}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    + Add lookup
                  </button>
                </div>
              )}
            </div>

            <div>
              <TemplateBuilder
                template={child.itemConfig.descriptionTemplate}
                onChange={(template) => onChange({
                  itemConfig: { ...child.itemConfig, descriptionTemplate: template }
                })}
                availableFields={availableFields}
                sampleData={childSampleData}
                placeholder="e.g., {name} - {ticketType}"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <div className="flex gap-1">
                  <select
                    value={child.itemConfig.quantity.type}
                    onChange={(e) => onChange({
                      itemConfig: {
                        ...child.itemConfig,
                        quantity: {
                          type: e.target.value as 'fixed' | 'field' | 'blank',
                          value: e.target.value === 'fixed' ? 1 : e.target.value === 'blank' ? null : ''
                        }
                      }
                    })}
                    className="w-20 px-1 py-0.5 border border-gray-300 rounded-md text-xs"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="field">Field</option>
                    <option value="blank">Blank</option>
                  </select>
                  {child.itemConfig.quantity.type === 'fixed' ? (
                    <input
                      type="number"
                      value={child.itemConfig.quantity.value as number}
                      onChange={(e) => onChange({
                        itemConfig: {
                          ...child.itemConfig,
                          quantity: {
                            ...child.itemConfig.quantity,
                            value: parseFloat(e.target.value) || 0
                          }
                        }
                      })}
                      className="flex-1 px-1 py-0.5 border border-gray-300 rounded-md text-xs"
                    />
                  ) : (
                    <select
                      value={child.itemConfig.quantity.value as string}
                      onChange={(e) => onChange({
                        itemConfig: {
                          ...child.itemConfig,
                          quantity: {
                            ...child.itemConfig.quantity,
                            value: e.target.value
                          }
                        }
                      })}
                      className="flex-1 px-1 py-0.5 border border-gray-300 rounded-md text-xs"
                    >
                      <option value="">Select field...</option>
                      {availableFields.map(field => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Unit Price
                </label>
                <div className="flex gap-1">
                  <select
                    value={child.itemConfig.unitPrice.type}
                    onChange={(e) => {
                      const newType = e.target.value as 'fixed' | 'field' | 'lookup' | 'blank';
                      onChange({
                        itemConfig: {
                          ...child.itemConfig,
                          unitPrice: {
                            type: newType,
                            value: newType === 'fixed' ? 0 : newType === 'blank' ? null : '',
                            lookupField: newType === 'lookup' ? '' : undefined
                          } as any
                        }
                      })
                    }}
                    className="w-20 px-1 py-0.5 border border-gray-300 rounded-md text-xs"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="field">Field</option>
                    <option value="lookup">Lookup</option>
                    <option value="blank">Blank</option>
                  </select>
                  {child.itemConfig.unitPrice.type === 'fixed' ? (
                    <input
                      type="number"
                      value={child.itemConfig.unitPrice.value as number}
                      onChange={(e) => onChange({
                        itemConfig: {
                          ...child.itemConfig,
                          unitPrice: {
                            ...child.itemConfig.unitPrice,
                            value: parseFloat(e.target.value) || 0
                          }
                        }
                      })}
                      className="flex-1 px-1 py-0.5 border border-gray-300 rounded-md text-xs"
                    />
                  ) : (
                    <select
                      value={(child.itemConfig.unitPrice as any).type === 'lookup' 
                        ? (child.itemConfig.unitPrice as any).lookupField || ''
                        : child.itemConfig.unitPrice.value as string}
                      onChange={(e) => onChange({
                        itemConfig: {
                          ...child.itemConfig,
                          unitPrice: {
                            ...child.itemConfig.unitPrice,
                            ...((child.itemConfig.unitPrice as any).type === 'lookup' 
                              ? { lookupField: e.target.value }
                              : { value: e.target.value })
                          }
                        }
                      })}
                      className="flex-1 px-1 py-0.5 border border-gray-300 rounded-md text-xs"
                    >
                      <option value="">Select field...</option>
                      {availableFields.map(field => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}