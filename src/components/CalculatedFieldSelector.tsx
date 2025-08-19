import React, { useState, useEffect } from 'react';

interface CalculatedFieldSelectorProps {
  fieldName: string;
  fieldPath: string;
  currentValue: any;
  allOptions: Array<{ path: string; value: any; display: string }>;
  onMappingChange: (fieldPath: string, value: any, mappingConfig: any) => void;
}

const CalculatedFieldSelector: React.FC<CalculatedFieldSelectorProps> = ({
  fieldName,
  fieldPath,
  currentValue,
  allOptions,
  onMappingChange
}) => {
  const [isCalculated, setIsCalculated] = useState(false);
  const [field1Path, setField1Path] = useState('');
  const [field2Path, setField2Path] = useState('');
  const [operation, setOperation] = useState<'subtract' | 'add' | 'multiply' | 'divide'>('subtract');
  const [customValue, setCustomValue] = useState('');

  // Format value for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return value.toFixed(2);
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && '$numberDecimal' in value) {
      return parseFloat(value.$numberDecimal).toFixed(2);
    }
    return String(value);
  };

  // Get numeric value from field option
  const getNumericValue = (fieldPath: string): number => {
    const option = allOptions.find(opt => opt.path === fieldPath);
    if (!option) return 0;
    
    const val = option.value;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      // Handle currency strings like "$123.45" or "123.45"
      const numStr = val.replace(/[^0-9.-]/g, '');
      return parseFloat(numStr) || 0;
    }
    if (val && typeof val === 'object' && '$numberDecimal' in val) {
      return parseFloat(val.$numberDecimal) || 0;
    }
    return 0;
  };

  // Calculate the result based on selected fields and operation
  const calculateResult = () => {
    if (!field1Path || !field2Path) return null;

    const value1 = getNumericValue(field1Path);
    const value2 = getNumericValue(field2Path);

    switch (operation) {
      case 'subtract':
        return value1 - value2;
      case 'add':
        return value1 + value2;
      case 'multiply':
        return value1 * value2;
      case 'divide':
        return value2 !== 0 ? value1 / value2 : 0;
      default:
        return 0;
    }
  };

  // Update the field value when calculation changes
  useEffect(() => {
    if (isCalculated && field1Path && field2Path) {
      const result = calculateResult();
      if (result !== null) {
        onMappingChange(fieldPath, result, {
          type: 'calculated',
          field1: field1Path,
          field2: field2Path,
          operation: operation
        });
      }
    }
  }, [field1Path, field2Path, operation, isCalculated]);

  const handleModeChange = (calculated: boolean) => {
    setIsCalculated(calculated);
    if (!calculated) {
      // Reset to simple mapping
      setField1Path('');
      setField2Path('');
      setCustomValue('');
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{fieldName}</label>
      
      {/* Mode selector */}
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => handleModeChange(false)}
          className={`px-3 py-1 text-xs rounded ${!isCalculated ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Map Field
        </button>
        <button
          type="button"
          onClick={() => handleModeChange(true)}
          className={`px-3 py-1 text-xs rounded ${isCalculated ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Calculate
        </button>
      </div>

      {!isCalculated ? (
        // Simple field mapping
        <div className="flex gap-2">
          <select
            value={field1Path || 'custom'}
            onChange={(e) => {
              const selectedPath = e.target.value;
              if (selectedPath === 'custom') {
                setField1Path('custom');
                // Don't update the value yet, wait for custom input
              } else if (selectedPath) {
                setField1Path(selectedPath);
                const option = allOptions.find(opt => opt.path === selectedPath);
                if (option) {
                  onMappingChange(fieldPath, option.value, { source: selectedPath });
                }
              } else {
                setField1Path('');
                onMappingChange(fieldPath, null, { source: null });
              }
            }}
            className="flex-1 text-sm px-2 py-1 border rounded"
          >
            <option value="">Select field...</option>
            <option value="custom">Custom value</option>
            {allOptions.map((option, index) => (
              <option key={`${option.path}-${index}`} value={option.path}>
                {option.display} {option.value !== null && option.value !== undefined ? `(${formatValue(option.value)})` : ''}
              </option>
            ))}
          </select>
          {field1Path === 'custom' && (
            <input
              type="number"
              value={customValue}
              onChange={(e) => {
                setCustomValue(e.target.value);
                const numValue = parseFloat(e.target.value);
                if (!isNaN(numValue)) {
                  onMappingChange(fieldPath, numValue, { source: null, customValue: numValue });
                }
              }}
              placeholder="Enter value"
              className="flex-1 text-sm px-2 py-1 border rounded"
            />
          )}
        </div>
      ) : (
        // Calculated field
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={field1Path}
              onChange={(e) => setField1Path(e.target.value)}
              className="flex-1 text-sm px-2 py-1 border rounded"
            >
              <option value="">Select first field...</option>
              {allOptions
                .filter(opt => {
                  const numVal = getNumericValue(opt.path);
                  return !isNaN(numVal);
                })
                .map((option, index) => (
                  <option key={`field1-${option.path}-${index}`} value={option.path}>
                    {option.display} ({formatValue(option.value)})
                  </option>
                ))}
            </select>
            
            <select
              value={operation}
              onChange={(e) => setOperation(e.target.value as any)}
              className="w-20 text-sm px-2 py-1 border rounded"
            >
              <option value="subtract">−</option>
              <option value="add">+</option>
              <option value="multiply">×</option>
              <option value="divide">÷</option>
            </select>
            
            <select
              value={field2Path}
              onChange={(e) => setField2Path(e.target.value)}
              className="flex-1 text-sm px-2 py-1 border rounded"
            >
              <option value="">Select second field...</option>
              {allOptions
                .filter(opt => {
                  const numVal = getNumericValue(opt.path);
                  return !isNaN(numVal);
                })
                .map((option, index) => (
                  <option key={`field2-${option.path}-${index}`} value={option.path}>
                    {option.display} ({formatValue(option.value)})
                  </option>
                ))}
            </select>
          </div>
          
          {field1Path && field2Path && (
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              Result: {calculateResult()?.toFixed(2) || '0.00'}
            </div>
          )}
        </div>
      )}
      
      {currentValue !== null && currentValue !== undefined && (
        <div className="mt-1 text-xs text-gray-500">
          Current: {typeof currentValue === 'number' ? currentValue.toFixed(2) : currentValue}
        </div>
      )}
    </div>
  );
};

export default CalculatedFieldSelector;