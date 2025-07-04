import React, { useState, useEffect } from 'react';
import { extractAllFieldOptions } from '@/utils/field-extractor';

interface TemplateBuilderProps {
  template: string;
  onChange: (template: string) => void;
  availableFields: string[];
  sampleData?: any;
  placeholder?: string;
}

export default function TemplateBuilder({
  template,
  onChange,
  availableFields,
  sampleData,
  placeholder = "Enter template with {field} placeholders"
}: TemplateBuilderProps) {
  const [preview, setPreview] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Process template with sample data
  useEffect(() => {
    if (sampleData) {
      const processed = processTemplate(template, sampleData);
      setPreview(processed);
    }
  }, [template, sampleData]);

  const processTemplate = (templateStr: string, data: any): string => {
    if (!templateStr || !data) return templateStr;
    
    return templateStr.replace(/\{([^}]+)\}/g, (match, fieldPath) => {
      const parts = fieldPath.split('.');
      let value = data;
      
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          return match; // Keep original placeholder if field not found
        }
      }
      
      return value?.toString() || '';
    });
  };

  const insertField = (field: string) => {
    const beforeCursor = template.slice(0, cursorPosition);
    const afterCursor = template.slice(cursorPosition);
    const newTemplate = `${beforeCursor}{${field}}${afterCursor}`;
    onChange(newTemplate);
    setCursorPosition(cursorPosition + field.length + 2); // +2 for the braces
    setShowFieldPicker(false);
    setSearchTerm('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setCursorPosition(e.target.selectionStart || 0);
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    setCursorPosition((e.target as HTMLInputElement).selectionStart || 0);
  };

  const handleInputKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCursorPosition((e.target as HTMLInputElement).selectionStart || 0);
  };

  const filteredFields = availableFields.filter(field => 
    field.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Template
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={template}
            onChange={handleInputChange}
            onClick={handleInputClick}
            onKeyUp={handleInputKeyUp}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowFieldPicker(!showFieldPicker)}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Insert Field
          </button>
        </div>
        
        {showFieldPicker && (
          <div className="absolute top-full mt-1 w-[200%] bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-60 overflow-hidden">
            <div className="p-2 border-b border-gray-200">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search fields..."
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredFields.length > 0 ? (
                filteredFields.map((field) => (
                  <button
                    key={field}
                    onClick={() => insertField(field)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center justify-between group"
                  >
                    <span className="font-mono text-xs break-words whitespace-normal">{field}</span>
                    <span className="text-gray-400 group-hover:text-gray-600 break-words whitespace-normal">
                      {`{${field}}`}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No fields found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {preview && sampleData && (
        <div className="bg-gray-50 p-3 rounded-md">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Preview
          </label>
          <div className="text-sm text-gray-900 font-mono">
            {preview}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500">
        Use {'{'}fieldName{'}'} to insert field values. Example: {'{'}firstName{'}'} {'{'}lastName{'}'}
      </div>
    </div>
  );
}