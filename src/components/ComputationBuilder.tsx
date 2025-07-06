import React, { useState, useEffect } from 'react';
import { FieldOption, extractNestedStructure, NestedField, getValueByPath } from '@/utils/field-extractor';

export interface ComputationDefinition {
  type: 'minDate' | 'maxDate' | 'sum' | 'count' | 'arithmetic' | 'concat' | 'lookup' | 'now' | 'expression';
  sources: string[];
  parameters?: {
    operator?: '+' | '-' | '*' | '/';
    operand?: number;
    separator?: string;
    collection?: string;
    lookupField?: string;
    returnField?: string;
    format?: string;
    expression?: string;
  };
}

interface ComputationBuilderProps {
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'select';
  allOptions: FieldOption[];
  onComputationChange: (computation: ComputationDefinition | null) => void;
  initialComputation?: ComputationDefinition;
  registrationData?: any;
  paymentData?: any;
}

const COMPUTATION_TYPES = {
  date: [
    { value: 'minDate', label: 'Earliest date from array', description: 'Find the earliest date from multiple date fields' },
    { value: 'maxDate', label: 'Latest date from array', description: 'Find the latest date from multiple date fields' },
    { value: 'now', label: 'Current date/time', description: 'Use the current date and time when migrating' }
  ],
  number: [
    { value: 'sum', label: 'Sum of fields', description: 'Add up multiple numeric fields' },
    { value: 'count', label: 'Count items', description: 'Count the number of items in an array' },
    { value: 'arithmetic', label: 'Calculate', description: 'Perform arithmetic operations on a field' },
    { value: 'expression', label: 'Expression', description: 'Build complex calculations with multiple fields' }
  ],
  text: [
    { value: 'concat', label: 'Concatenate', description: 'Join multiple text fields together' },
    { value: 'lookup', label: 'Lookup from collection', description: 'Fetch a value from another collection' }
  ]
};

export default function ComputationBuilder({
  fieldName,
  fieldType,
  allOptions,
  onComputationChange,
  initialComputation,
  registrationData,
  paymentData
}: ComputationBuilderProps) {
  const [computation, setComputation] = useState<ComputationDefinition>(
    initialComputation || { type: 'minDate', sources: [] }
  );
  const [selectedSources, setSelectedSources] = useState<string[]>(
    initialComputation?.sources || []
  );
  
  // State for drill-down navigation
  const [navigationPath, setNavigationPath] = useState<string[]>([]);
  const [expressionFieldSearch, setExpressionFieldSearch] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [showDrillDown, setShowDrillDown] = useState(false);
  
  // Extract root level structure
  const rootFields: NestedField[] = [];
  if (registrationData) {
    rootFields.push({
      name: 'registrations',
      path: '',
      displayPath: 'registrations',
      type: 'object',
      children: extractNestedStructure(registrationData, 'registrations'),
      value: registrationData
    });
  }
  if (paymentData) {
    rootFields.push({
      name: 'payments',
      path: '',
      displayPath: 'payments',
      type: 'object',
      children: extractNestedStructure(paymentData, 'payments'),
      value: paymentData
    });
  }

  useEffect(() => {
    setComputation(prev => ({ ...prev, sources: selectedSources }));
  }, [selectedSources]);

  const computationTypes = COMPUTATION_TYPES[fieldType] || [];

  const handleTypeChange = (type: ComputationDefinition['type']) => {
    const newComputation: ComputationDefinition = { type, sources: selectedSources };
    
    // Set default parameters based on type
    switch (type) {
      case 'concat':
        newComputation.parameters = { separator: ' ' };
        break;
      case 'arithmetic':
        newComputation.parameters = { operator: '+', operand: 0 };
        break;
      case 'expression':
        newComputation.parameters = { expression: '' };
        break;
      case 'lookup':
        newComputation.parameters = { collection: '', lookupField: '', returnField: '' };
        break;
    }
    
    setComputation(newComputation);
    onComputationChange(newComputation);
  };

  const handleParameterChange = (key: string, value: any) => {
    const newComputation = {
      ...computation,
      parameters: {
        ...computation.parameters,
        [key]: value
      }
    };
    setComputation(newComputation);
    onComputationChange(newComputation);
  };

  const addSource = (sourcePath: string) => {
    if (!selectedSources.includes(sourcePath)) {
      const newSources = [...selectedSources, sourcePath];
      setSelectedSources(newSources);
      const newComputation = { ...computation, sources: newSources };
      setComputation(newComputation);
      onComputationChange(newComputation);
    }
  };

  const removeSource = (index: number) => {
    const newSources = selectedSources.filter((_, i) => i !== index);
    setSelectedSources(newSources);
    const newComputation = { ...computation, sources: newSources };
    setComputation(newComputation);
    onComputationChange(newComputation);
  };

  // Filter options based on field type and computation type
  const filteredOptions = allOptions.filter(opt => {
    // For count operations, only show array fields
    if (computation.type === 'count') {
      return opt.type === 'array';
    }
    
    if (fieldType === 'date') {
      return opt.type === 'string' || opt.displayPath.toLowerCase().includes('date') || 
             opt.displayPath.toLowerCase().includes('time') || opt.displayPath.toLowerCase().includes('at');
    }
    if (fieldType === 'number') {
      return opt.type === 'number' || opt.displayPath.toLowerCase().includes('amount') || 
             opt.displayPath.toLowerCase().includes('count') || opt.displayPath.toLowerCase().includes('total');
    }
    return true;
  });

  return (
    <div className="bg-gray-50 border rounded-lg p-4 mt-2">
      <h4 className="font-medium text-sm text-gray-700 mb-3">Configure Computed Value</h4>
      
      {/* Computation Type Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-600 mb-2">Computation Type</label>
        <select
          value={computation.type}
          onChange={(e) => handleTypeChange(e.target.value as ComputationDefinition['type'])}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {computationTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {computationTypes.find(t => t.value === computation.type)?.description}
        </p>
      </div>

      {/* Source Fields Selection (except for 'now' and 'expression' types) */}
      {computation.type !== 'now' && computation.type !== 'expression' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Source Fields {computation.type === 'count' ? '(Select array field)' : ''}
          </label>
          
          {/* Selected Sources */}
          {selectedSources.length > 0 && (
            <div className="mb-2 space-y-1">
              {selectedSources.map((source, index) => (
                <div key={index} className="flex items-center gap-2 bg-white px-2 py-1 rounded border">
                  <span className="text-sm font-mono flex-1">{source}</span>
                  <button
                    onClick={() => removeSource(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Use drill-down navigation for count operations */}
          {computation.type === 'count' && (registrationData || paymentData) ? (
            <div className="space-y-2">
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
                            // This is an array - add it as source
                            addSource(field.displayPath);
                            setNavigationPath([field.name]);
                            setSelectedPaths([selected]);
                          } else {
                            setSelectedPaths([selected]);
                            setNavigationPath([selected]);
                          }
                        } else {
                          setSelectedPaths([]);
                          setNavigationPath([]);
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                                // This is an array - add it as source
                                addSource(selectedField.displayPath);
                                setNavigationPath(newNavPaths);
                                setSelectedPaths(newPaths);
                              } else {
                                // This is an object - allow further navigation
                                setSelectedPaths(newPaths);
                                setNavigationPath(newNavPaths);
                              }
                            } else {
                              setSelectedPaths(newPaths);
                              setNavigationPath(newNavPaths);
                            }
                          }}
                          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          ) : (
            /* Regular dropdown for non-count operations */
            (computation.type !== 'arithmetic' || selectedSources.length === 0) && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addSource(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a field to add...</option>
                {filteredOptions.map((opt, index) => (
                  <option 
                    key={`${opt.source}-${opt.path}-${index}`} 
                    value={opt.displayPath}
                    disabled={selectedSources.includes(opt.displayPath)}
                  >
                    {opt.displayPath} - {opt.type === 'array' ? `Array (${Array.isArray(opt.value) ? opt.value.length : 0} items)` : typeof opt.value === 'object' ? 'object' : String(opt.value || 'empty')}
                  </option>
                ))}
              </select>
            )
          )}
        </div>
      )}

      {/* Additional Parameters */}
      {computation.type === 'concat' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">Separator</label>
          <input
            type="text"
            value={computation.parameters?.separator || ' '}
            onChange={(e) => handleParameterChange('separator', e.target.value)}
            placeholder="Space"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {computation.type === 'arithmetic' && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Operation</label>
            <select
              value={computation.parameters?.operator || '+'}
              onChange={(e) => handleParameterChange('operator', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="+">Add (+)</option>
              <option value="-">Subtract (-)</option>
              <option value="*">Multiply (×)</option>
              <option value="/">Divide (÷)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">Value</label>
            <input
              type="number"
              value={computation.parameters?.operand || 0}
              onChange={(e) => handleParameterChange('operand', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {computation.type === 'expression' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Expression
            <span className="text-xs text-gray-500 ml-2">Use {`{field.path}`} to reference fields</span>
          </label>
          <textarea
            value={computation.parameters?.expression || ''}
            onChange={(e) => handleParameterChange('expression', e.target.value)}
            placeholder="e.g., {payment.grossAmount} - {payment.fees}"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            rows={3}
          />
          
          {/* Examples in a nice box */}
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-md p-3">
            <h4 className="text-xs font-semibold text-blue-900 mb-2">Expression Examples:</h4>
            <div className="space-y-1 text-xs text-blue-800">
              <div className="font-mono bg-white px-2 py-1 rounded">{`{payment.amount} * 0.1`} <span className="text-gray-600 ml-2">→ 10% of amount</span></div>
              <div className="font-mono bg-white px-2 py-1 rounded">{`{payment.grossAmount} - {payment.fees}`} <span className="text-gray-600 ml-2">→ Net amount</span></div>
              <div className="font-mono bg-white px-2 py-1 rounded">{`{registration.attendeeCount} * {registration.ticketPrice}`} <span className="text-gray-600 ml-2">→ Total ticket revenue</span></div>
            </div>
          </div>
          
          {/* Available fields with search */}
          <details className="mt-3" open>
            <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-800">
              Available Fields
            </summary>
            <div className="mt-2 border rounded-md p-2">
              {/* Search input */}
              <div className="mb-2">
                <input
                  type="text"
                  placeholder="Search fields..."
                  value={expressionFieldSearch}
                  onChange={(e) => setExpressionFieldSearch(e.target.value)}
                  className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              <div className="max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {/* Group fields by source */}
                  {['payment', 'registration', 'related'].map(source => {
                    const sourceFields = allOptions.filter(opt => {
                      if (typeof opt.value !== 'string') return false;
                      if (!opt.value.startsWith(source + '.')) return false;
                      
                      // Apply search filter
                      if (expressionFieldSearch) {
                        const searchLower = expressionFieldSearch.toLowerCase();
                        return opt.value.toLowerCase().includes(searchLower) || 
                               opt.displayPath.toLowerCase().includes(searchLower);
                      }
                      return true;
                    });
                    
                    if (sourceFields.length === 0) return null;
                    
                    return (
                      <div key={source}>
                        <p className="text-xs font-semibold text-gray-700 mb-1 capitalize">{source} Fields:</p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {sourceFields.map((option, index) => (
                            <button
                              key={`${option.value}-${index}`}
                              type="button"
                              onClick={() => {
                                const currentExpr = computation.parameters?.expression || '';
                                const newExpr = currentExpr + `{${option.value}}`;
                                handleParameterChange('expression', newExpr);
                              }}
                              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded font-mono"
                              title={option.displayPath}
                            >
                              {option.value}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Show no results message if search has no matches */}
                  {expressionFieldSearch && 
                   !allOptions.some(opt => 
                     typeof opt.value === 'string' &&
                     (opt.value.toLowerCase().includes(expressionFieldSearch.toLowerCase()) ||
                      opt.displayPath.toLowerCase().includes(expressionFieldSearch.toLowerCase()))
                   ) && (
                    <p className="text-xs text-gray-500 text-center py-2">
                      No fields found matching "{expressionFieldSearch}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          </details>
        </div>
      )}

      {computation.type === 'lookup' && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-2">Collection</label>
            <select
              value={computation.parameters?.collection || ''}
              onChange={(e) => handleParameterChange('collection', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select collection...</option>
              <option value="contacts">contacts</option>
              <option value="organisations">organisations</option>
              <option value="users">users</option>
              <option value="jurisdictions">jurisdictions</option>
              <option value="catalogObjects">catalogObjects</option>
              <option value="orders">orders</option>
              <option value="tickets">tickets</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-2">Lookup Field</label>
            <input
              type="text"
              value={computation.parameters?.lookupField || ''}
              onChange={(e) => handleParameterChange('lookupField', e.target.value)}
              placeholder="e.g., _id or email"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-2">Return Field</label>
            <input
              type="text"
              value={computation.parameters?.returnField || ''}
              onChange={(e) => handleParameterChange('returnField', e.target.value)}
              placeholder="e.g., name or email"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </>
      )}

      {/* Preview */}
      <div className="mt-4 p-3 bg-blue-50 rounded">
        <p className="text-xs font-medium text-blue-900 mb-1">Computation Preview:</p>
        <code className="text-xs text-blue-800">
          {computation.type === 'minDate' && `min(${selectedSources.join(', ')})`}
          {computation.type === 'maxDate' && `max(${selectedSources.join(', ')})`}
          {computation.type === 'sum' && `sum(${selectedSources.join(', ')})`}
          {computation.type === 'count' && `count(${selectedSources.join(', ')})`}
          {computation.type === 'concat' && `join(${selectedSources.join(', ')}, "${computation.parameters?.separator}")`}
          {computation.type === 'arithmetic' && selectedSources.length > 0 && 
            `${selectedSources[0]} ${computation.parameters?.operator} ${computation.parameters?.operand}`}
          {computation.type === 'expression' && computation.parameters?.expression}
          {computation.type === 'lookup' && 
            `lookup(${computation.parameters?.collection}, ${computation.parameters?.lookupField}, ${computation.parameters?.returnField})`}
          {computation.type === 'now' && 'new Date()'}
        </code>
        {computation.type === 'count' && selectedSources.length > 0 && (
          <p className="text-xs text-blue-700 mt-1">
            This will count the items in the selected array and set that value.
          </p>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button
          onClick={() => onComputationChange(null)}
          className="text-xs text-red-600 hover:text-red-800 underline"
        >
          Remove computation
        </button>
        <button
          onClick={() => {
            // Trigger the save and close the builder
            onComputationChange(computation);
          }}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save computation
        </button>
      </div>
    </div>
  );
}