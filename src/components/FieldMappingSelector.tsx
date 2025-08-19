import React, { useState, useEffect } from 'react';
import { FieldOption, getSmartSuggestions, getValueByPath } from '@/utils/field-extractor';
import ComputationBuilder, { ComputationDefinition } from './ComputationBuilder';

interface FieldMappingSelectorProps {
  fieldName: string;
  fieldPath: string;
  currentValue: any;
  allOptions: FieldOption[];
  onMappingChange: (fieldPath: string, sourcePath: string | null, customValue?: any) => void;
  fieldType?: 'text' | 'number' | 'date' | 'select';
  selectOptions?: { value: string; label: string }[];
  sourceDocuments?: Record<string, any>;
}

export default function FieldMappingSelector({
  fieldName,
  fieldPath,
  currentValue,
  allOptions,
  onMappingChange,
  fieldType = 'text',
  selectOptions,
  sourceDocuments
}: FieldMappingSelectorProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState(currentValue || '');
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [mappedSourcePath, setMappedSourcePath] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [valueType, setValueType] = useState<'manual' | 'now' | 'computed'>('manual');
  const [showComputationBuilder, setShowComputationBuilder] = useState(false);
  const [computedValue, setComputedValue] = useState<any>(null);

  // Execute computation to show preview
  const executeComputation = (computation: ComputationDefinition): any => {
    if (!sourceDocuments) return null;
    
    try {
      const allData = { 
        payment: sourceDocuments.payments || sourceDocuments.payment,
        registration: sourceDocuments.registrations || sourceDocuments.registration,
        ...sourceDocuments 
      };
      
      switch (computation.type) {
        case 'count': {
          if (computation.sources.length > 0) {
            const arrayPath = computation.sources[0];
            // Fix path to handle both 'registration' and 'registrations'
            let value = getValueByPath(allData, arrayPath);
            
            // If not found, try with 's' appended to the source
            if (value === undefined && arrayPath.startsWith('registration.')) {
              const alternativePath = arrayPath.replace('registration.', 'registrations.');
              value = getValueByPath(allData, alternativePath);
            } else if (value === undefined && arrayPath.startsWith('payment.')) {
              const alternativePath = arrayPath.replace('payment.', 'payments.');
              value = getValueByPath(allData, alternativePath);
            }
            
            return Array.isArray(value) ? value.length : 0;
          }
          return 0;
        }
        
        case 'sum': {
          let sum = 0;
          computation.sources.forEach(source => {
            const value = getValueByPath(allData, source);
            if (Array.isArray(value)) {
              sum += value.reduce((acc, item) => acc + (typeof item === 'number' ? item : 0), 0);
            } else if (typeof value === 'number') {
              sum += value;
            }
          });
          return sum;
        }
        
        case 'arithmetic': {
          if (computation.sources.length > 0) {
            const value = getValueByPath(allData, computation.sources[0]);
            const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
            const operand = computation.parameters?.operand || 0;
            
            switch (computation.parameters?.operator) {
              case '+': return numValue + operand;
              case '-': return numValue - operand;
              case '*': return numValue * operand;
              case '/': return operand !== 0 ? numValue / operand : 0;
              default: return numValue;
            }
          }
          return 0;
        }

        case 'expression': {
          if (!computation.parameters?.expression || computation.parameters.expression.trim() === '') {
            return 0;
          }
          
          
          // Replace field references with actual values
          let expression = computation.parameters.expression;
          const fieldPattern = /\{([^}]+)\}/g;
          const matches = expression.match(fieldPattern);
          
          if (matches) {
            matches.forEach(match => {
              const fieldPath = match.slice(1, -1); // Remove { and }
              let value = getValueByPath(allData, fieldPath);
              
              // Handle MongoDB $numberDecimal format
              if (value && typeof value === 'object' && '$numberDecimal' in value) {
                value = value.$numberDecimal;
              }
              
              const numValue = parseFloat(value) || 0;
              expression = expression.replace(match, numValue.toString());
            });
          }
          
          // Check if the expression is valid after replacements
          expression = expression.trim();
          
          // Remove trailing operators
          expression = expression.replace(/[\+\-\*\/]\s*$/, '').trim();
          
          if (!expression || expression === '') {
            return 0;
          }
          
          // Check for incomplete expressions (e.g., "5 + " or "10 - ")
          if (/[\+\-\*\/]\s*$/.test(expression)) {
            return 0;
          }
          
          try {
            // Safely evaluate the mathematical expression
            const result = new Function('return ' + expression)();
            return isNaN(result) ? 0 : result;
          } catch (error) {
            console.error('Error evaluating expression:', expression, error);
            return 0;
          }
        }
        
        case 'concat': {
          const values: string[] = [];
          computation.sources.forEach(source => {
            const value = getValueByPath(allData, source);
            if (value !== null && value !== undefined) {
              values.push(String(value));
            }
          });
          return values.join(computation.parameters?.separator || ' ');
        }
        
        case 'now':
          return new Date().toISOString();
          
        case 'minDate':
        case 'maxDate': {
          const dates = computation.sources
            .map(source => {
              const value = getValueByPath(allData, source);
              return value ? new Date(value) : null;
            })
            .filter(date => date && !isNaN(date.getTime()));
            
          if (dates.length === 0) return null;
          
          const timestamp = computation.type === 'minDate' 
            ? Math.min(...dates.map(d => d!.getTime()))
            : Math.max(...dates.map(d => d!.getTime()));
            
          return new Date(timestamp).toISOString();
        }
        
        default:
          return null;
      }
    } catch (error) {
      console.error('Error executing computation:', error);
      return null;
    }
  };

  // Get smart suggestions for this field
  const suggestions = getSmartSuggestions(fieldPath.split('.').pop() || '', allOptions);
  
  // Filter options based on search
  const filteredOptions = searchTerm
    ? allOptions.filter(opt => 
        opt.displayPath.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(opt.value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : suggestions.length > 0 ? suggestions : allOptions.slice(0, 20);

  useEffect(() => {
    // Don't override if we already have a selected path
    if (selectedPath) return;
    
    // Check if current value is a computation
    if (typeof currentValue === 'object' && currentValue?.$compute) {
      setIsCustom(true);
      setValueType('computed');
      setCustomValue(currentValue);
      // Don't auto-show the computation builder, just calculate the result
      // Execute the computation to show the result
      const result = executeComputation(currentValue.$compute);
      setComputedValue(result);
      return;
    }
    
    // Check if current value is a "now" marker
    if (typeof currentValue === 'object' && currentValue?.$now) {
      setIsCustom(true);
      setValueType('now');
      setCustomValue('Current date/time');
      return;
    }
    
    // Check if current value matches any option
    const matchingOption = allOptions.find(opt => opt.value === currentValue);
    if (matchingOption) {
      setSelectedPath(matchingOption.path);
      setMappedSourcePath(matchingOption.displayPath);
      setIsCustom(false);
    } else if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
      setIsCustom(true);
      setCustomValue(currentValue);
    }
  }, [currentValue, allOptions]);

  // Recalculate computed value when source documents change
  useEffect(() => {
    if (valueType === 'computed' && customValue?.$compute && sourceDocuments) {
      const result = executeComputation(customValue.$compute);
      setComputedValue(result);
    }
  }, [sourceDocuments, valueType, customValue]);

  const handleMappingSelect = (option: FieldOption) => {
    setSelectedPath(option.path);
    setMappedSourcePath(option.displayPath);
    setIsCustom(false);
    setShowDropdown(false);
    setSearchTerm('');
    setIsEditing(false);
    // Pass the displayPath which includes the source prefix (e.g., "payment.amount")
    onMappingChange(fieldPath, option.displayPath);
  };

  const handleCustomValueChange = (value: any) => {
    // If it's a number field and the value contains currency symbols, parse it
    if (fieldType === 'number' && typeof value === 'string') {
      // Remove currency symbols and parse as number
      const cleanedValue = value.replace(/[^0-9.-]/g, '');
      const numericValue = parseFloat(cleanedValue);
      const finalValue = isNaN(numericValue) ? 0 : numericValue;
      setCustomValue(finalValue);
      onMappingChange(fieldPath, null, finalValue);
    } else if (fieldType === 'date' && valueType === 'now') {
      // For "now" dates, store a special marker
      const nowValue = { $now: true };
      setCustomValue('Current date/time');
      onMappingChange(fieldPath, null, nowValue);
    } else if (fieldType === 'date' && value) {
      // For date fields, ensure proper ISO format
      const dateValue = new Date(value).toISOString();
      setCustomValue(value);
      onMappingChange(fieldPath, null, dateValue);
    } else {
      setCustomValue(value);
      onMappingChange(fieldPath, null, value);
    }
  };

  const handleUseCustomValue = () => {
    setIsCustom(true);
    setSelectedPath('');
    setShowDropdown(false);
    setIsEditing(true);
    // Use the search term as the initial custom value if available
    let initialValue = searchTerm || customValue || currentValue || '';
    
    // If it's a number field and the value contains currency symbols, parse it
    if (fieldType === 'number' && typeof initialValue === 'string') {
      const cleanedValue = initialValue.replace(/[^0-9.-]/g, '');
      const numericValue = parseFloat(cleanedValue);
      initialValue = isNaN(numericValue) ? 0 : numericValue;
    }
    
    setCustomValue(initialValue);
    onMappingChange(fieldPath, null, initialValue);
  };

  const getDisplayValue = () => {
    if (isCustom) {
      if (typeof customValue === 'object' && customValue?.$compute) {
        return computedValue !== null ? String(computedValue) : 'Computed value';
      }
      if (typeof customValue === 'object' && customValue?.$now) {
        return 'Current date/time';
      }
      // Ensure we never return an object
      if (typeof customValue === 'object' && customValue !== null) {
        return JSON.stringify(customValue);
      }
      return String(customValue || '');
    }
    if (mappedSourcePath) {
      // Show the mapped path even if value is empty
      const option = allOptions.find(opt => opt.displayPath === mappedSourcePath);
      if (option) {
        const val = option.value;
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val);
        }
        return val || `[Empty: ${mappedSourcePath}]`;
      }
    }
    const option = allOptions.find(opt => opt.path === selectedPath);
    if (option) {
      const val = option.value;
      if (typeof val === 'object' && val !== null) {
        return JSON.stringify(val);
      }
      return val;
    }
    
    // Handle currentValue
    if (typeof currentValue === 'object' && currentValue !== null) {
      if (currentValue.$compute) {
        return computedValue !== null ? computedValue : 'Computed value';
      }
      if (currentValue.$now) {
        return 'Current date/time';
      }
      return JSON.stringify(currentValue);
    }
    return currentValue;
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {fieldName}
      </label>
      
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-gray-600">Current: </span>
        <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded flex items-center gap-2">
          {(() => {
            if (isCustom && valueType === 'computed') {
              return computedValue !== null ? computedValue : 'Computed value';
            }
            if (isCustom && valueType === 'now') {
              return 'Current date/time';
            }
            if (isCustom) {
              return customValue || 'Manual entry';
            }
            const displayVal = getDisplayValue();
            if (displayVal === null || displayVal === undefined || displayVal === '') {
              return 'Not set';
            }
            if (typeof displayVal === 'object') {
              return JSON.stringify(displayVal);
            }
            return String(displayVal);
          })()}
          {(selectedPath || isCustom || mappedSourcePath) && (
            <button
              onClick={() => {
                setSelectedPath('');
                setMappedSourcePath('');
                setIsCustom(false);
                setCustomValue('');
                setSearchTerm('');
                onMappingChange(fieldPath, null, '');
              }}
              className="text-gray-500 hover:text-red-600 transition-colors"
              title="Remove mapping"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </span>
      </div>

      <div className="relative">
        {!isCustom || isEditing ? (
          <>
            <input
              type={isCustom && isEditing && fieldType === 'date' ? 'date' : 'text'}
              placeholder={isCustom && isEditing ? `Enter custom ${fieldName.toLowerCase()}` : "Search for field to map..."}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={isCustom && isEditing ? customValue : searchTerm}
              onChange={(e) => {
                if (isCustom && isEditing) {
                  // For number fields, allow typing currency symbols but handle parsing in handleCustomValueChange
                  handleCustomValueChange(e.target.value);
                } else {
                  setSearchTerm(e.target.value);
                }
              }}
              onFocus={() => {
                if (!isCustom) setShowDropdown(true);
              }}
              onBlur={() => {
                if (!isCustom) {
                  setTimeout(() => setShowDropdown(false), 200);
                } else if (isEditing) {
                  setIsEditing(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isCustom && isEditing) {
                  setIsEditing(false);
                }
              }}
            />
            
            {showDropdown && !isCustom && (
              <div className="absolute z-10 w-[200%] mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {/* Always show "Use custom value" option when there's a search term */}
                {searchTerm && (
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-purple-50 border-b"
                    onClick={handleUseCustomValue}
                  >
                    <div className="text-sm font-medium text-purple-600">Use custom value</div>
                    <div className="text-xs text-gray-600 break-words whitespace-normal">"{searchTerm}"</div>
                  </button>
                )}
                
                {/* For date fields, show special options */}
                {fieldType === 'date' && !searchTerm && (
                  <>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-green-50 border-b"
                      onClick={() => {
                        setIsCustom(true);
                        setValueType('now');
                        setSelectedPath('');
                        setShowDropdown(false);
                        handleCustomValueChange(new Date().toISOString());
                      }}
                    >
                      <div className="text-sm font-medium text-green-600">Use current date/time</div>
                      <div className="text-xs text-gray-600">Set to now when migrating</div>
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-purple-50 border-b"
                      onClick={() => {
                        setIsCustom(true);
                        setValueType('manual');
                        setSelectedPath('');
                        setShowDropdown(false);
                        setIsEditing(true);
                      }}
                    >
                      <div className="text-sm font-medium text-purple-600">Enter specific date</div>
                      <div className="text-xs text-gray-600">Choose a date manually</div>
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b"
                      onClick={() => {
                        setIsCustom(true);
                        setValueType('computed');
                        setSelectedPath('');
                        setShowDropdown(false);
                        setShowComputationBuilder(true);
                      }}
                    >
                      <div className="text-sm font-medium text-blue-600">Compute from other fields</div>
                      <div className="text-xs text-gray-600">Calculate earliest/latest date from events</div>
                    </button>
                  </>
                )}
                
                {/* Show computed option for all field types */}
                {!searchTerm && fieldType !== 'select' && (
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b"
                    onClick={() => {
                      setIsCustom(true);
                      setValueType('computed');
                      setSelectedPath('');
                      setShowDropdown(false);
                      setShowComputationBuilder(true);
                    }}
                  >
                    <div className="text-sm font-medium text-blue-600">Compute value</div>
                    <div className="text-xs text-gray-600">
                      {fieldType === 'number' ? 'Sum, count, or calculate' : 
                       fieldType === 'text' ? 'Concatenate or lookup' : 
                       'Define a computation'}
                    </div>
                  </button>
                )}
                
                {filteredOptions.length === 0 && !searchTerm ? (
                  <div className="px-3 py-2 text-sm text-gray-500">No matching fields found</div>
                ) : (
                  filteredOptions.map((option, index) => (
                    <button
                      key={`${option.source}-${option.path}-${index}`}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0"
                      onClick={() => handleMappingSelect(option)}
                    >
                      <div className="text-sm font-medium break-words whitespace-normal">{option.displayPath}</div>
                      <div className="text-xs text-gray-600 break-words whitespace-normal">
                        {(() => {
                          const val = typeof option.value === 'object' && option.value !== null 
                            ? JSON.stringify(option.value) 
                            : String(option.value);
                          return val;
                        })()}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        ) : (
          fieldType === 'select' && selectOptions ? (
            <select
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={customValue}
              onChange={(e) => handleCustomValueChange(e.target.value)}
              onClick={() => setIsEditing(true)}
            >
              <option value="">Select...</option>
              {selectOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <div 
              className="w-full px-3 py-2 border rounded-md bg-white cursor-pointer hover:bg-gray-50"
              onClick={() => setIsEditing(true)}
            >
              <span className="text-gray-700">
                {(() => {
                  if (typeof customValue === 'object' && customValue?.$compute) {
                    return computedValue !== null ? String(computedValue) : 'Computed value';
                  }
                  if (typeof customValue === 'object' && customValue?.$now) {
                    return 'Current date/time';
                  }
                  if (typeof customValue === 'object' && customValue !== null) {
                    return JSON.stringify(customValue);
                  }
                  return customValue || `Click to enter ${fieldName.toLowerCase()}`;
                })()}
              </span>
            </div>
          )
        )}
      </div>

      {(selectedPath || mappedSourcePath) && !isCustom && (
        <div className="mt-1 text-xs text-gray-600">
          Mapped to: <span className="font-mono">{mappedSourcePath || allOptions.find(opt => opt.path === selectedPath)?.displayPath || selectedPath}</span>
          {(() => {
            const option = allOptions.find(opt => opt.displayPath === mappedSourcePath || opt.path === selectedPath);
            if (option && option.value !== undefined) {
              const valueStr = typeof option.value === 'object' ? 
                JSON.stringify(option.value) : String(option.value);
              return (
                <span className="text-gray-500 ml-2">
                  (Current: {valueStr.length > 50 ? valueStr.substring(0, 50) + '...' : valueStr})
                </span>
              );
            }
            return null;
          })()}
        </div>
      )}
      
      {isCustom && !isEditing && (
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-purple-600">
            {valueType === 'now' ? 'Current date/time' : 
             valueType === 'computed' ? `Computed value: ${computedValue !== null ? computedValue : 'calculating...'}` :
             'Custom value'}
          </span>
          <div className="flex gap-2">
            {valueType === 'computed' && !showComputationBuilder && (
              <button
                onClick={() => setShowComputationBuilder(true)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Edit computation
              </button>
            )}
            <button
              onClick={() => {
                setIsCustom(false);
                setSearchTerm('');
                setSelectedPath('');
                setValueType('manual');
                setComputedValue(null);
                setShowComputationBuilder(false);
                onMappingChange(fieldPath, null, '');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Clear {valueType === 'computed' ? 'computation' : 'custom value'}
            </button>
          </div>
        </div>
      )}
      
      {/* Computation Builder */}
      {showComputationBuilder && (
        <div>
          <ComputationBuilder
            fieldName={fieldName}
            fieldType={fieldType}
            allOptions={allOptions}
            onComputationChange={(computation) => {
              if (computation) {
                const result = executeComputation(computation);
                setComputedValue(result);
                
                // Always store the computation definition, not just the result
                onMappingChange(fieldPath, null, { $compute: computation });
                setCustomValue({ $compute: computation });
                setValueType('computed');
                
                // If this is triggered by the save button (computation has all required fields),
                // hide the computation builder
                if (computation.type && computation.sources !== undefined) {
                  setShowComputationBuilder(false);
                }
              } else {
                // Remove computation
                setShowComputationBuilder(false);
                setIsCustom(false);
                setComputedValue(null);
                setValueType('manual');
                onMappingChange(fieldPath, null, '');
              }
            }}
            initialComputation={
              typeof customValue === 'object' && customValue?.$compute 
                ? customValue.$compute 
                : undefined
            }
            registrationData={sourceDocuments?.registrations || sourceDocuments?.registration}
            paymentData={sourceDocuments?.payments || sourceDocuments?.payment}
          />
          {computedValue !== null && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
              <span className="text-green-800">Current result: <strong>{computedValue}</strong></span>
              {valueType === 'computed' && typeof customValue === 'object' && customValue?.$compute?.type === 'count' && (
                <span className="text-xs text-green-600 ml-2">
                  (This will be recalculated for each document when the mapping is applied)
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}