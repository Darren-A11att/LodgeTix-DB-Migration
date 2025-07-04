import React, { useState, useEffect } from 'react';
import { FieldOption, getSmartSuggestions } from '@/utils/field-extractor';

interface FieldMappingSelectorProps {
  fieldName: string;
  fieldPath: string;
  currentValue: any;
  allOptions: FieldOption[];
  onMappingChange: (fieldPath: string, sourcePath: string | null, customValue?: any) => void;
  fieldType?: 'text' | 'number' | 'date' | 'select';
  selectOptions?: { value: string; label: string }[];
}

export default function FieldMappingSelector({
  fieldName,
  fieldPath,
  currentValue,
  allOptions,
  onMappingChange,
  fieldType = 'text',
  selectOptions
}: FieldMappingSelectorProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState(currentValue || '');
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [mappedSourcePath, setMappedSourcePath] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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
    
    // Check if current value matches any option
    const matchingOption = allOptions.find(opt => opt.value === currentValue);
    if (matchingOption) {
      setSelectedPath(matchingOption.path);
      setIsCustom(false);
    } else if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
      setIsCustom(true);
      setCustomValue(currentValue);
    }
  }, [currentValue, allOptions]);

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
      return customValue;
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
          {isCustom ? 'Manual entry' : (String(getDisplayValue() || 'Not set'))}
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
              <span className="text-gray-700">{customValue || `Click to enter ${fieldName.toLowerCase()}`}</span>
            </div>
          )
        )}
      </div>

      {(selectedPath || mappedSourcePath) && !isCustom && (
        <div className="mt-1 text-xs text-gray-600">
          Mapped to: <span className="font-mono">{mappedSourcePath || allOptions.find(opt => opt.path === selectedPath)?.displayPath || selectedPath}</span>
        </div>
      )}
      
      {isCustom && !isEditing && (
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-purple-600">Custom value</span>
          <button
            onClick={() => {
              setIsCustom(false);
              setSearchTerm('');
              setSelectedPath('');
              onMappingChange(fieldPath, null, '');
            }}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Clear custom value
          </button>
        </div>
      )}
    </div>
  );
}