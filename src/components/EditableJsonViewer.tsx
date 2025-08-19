'use client';

import { useState, useEffect } from 'react';

interface EditableJsonViewerProps {
  data: any;
  title?: string;
  maxHeight?: string;
  onChange?: (newData: any) => void;
  highlightPaths?: string[];
}

export default function EditableJsonViewer({ 
  data, 
  title, 
  maxHeight = 'max-h-96',
  onChange,
  highlightPaths = []
}: EditableJsonViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [parseError, setParseError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const formatted = JSON.stringify(data, null, 2);
    setJsonText(formatted);
    setOriginalText(formatted);
    setParseError('');
  }, [data]);

  const handleEdit = () => {
    setIsEditing(true);
    setOriginalText(jsonText);
  };

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setParseError('');
      if (onChange) {
        onChange(parsed);
      }
      setIsEditing(false);
      setOriginalText(jsonText);
    } catch (err) {
      setParseError(`JSON Error: ${(err as Error).message}`);
    }
  };

  const handleCancel = () => {
    setJsonText(originalText);
    setParseError('');
    setIsEditing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Apply syntax highlighting for view mode
  const highlightJson = (text: string) => {
    if (!text) return '';
    
    // First escape HTML
    let highlighted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Apply JSON syntax highlighting
    highlighted = highlighted
      // Property names
      .replace(/"([^"]+)":/g, '<span class="text-blue-700">"$1"</span>:')
      // String values
      .replace(/: "([^"]*?)"/g, ': <span class="text-green-700">"$1"</span>')
      // Numbers
      .replace(/: (-?\d+\.?\d*)/g, ': <span class="text-purple-700">$1</span>')
      // Booleans
      .replace(/: (true|false)/g, ': <span class="text-orange-600">$1</span>')
      // Null
      .replace(/: (null)/g, ': <span class="text-gray-500">$1</span>');
    
    // Highlight specified paths if provided
    if (highlightPaths.length > 0 && !isEditing) {
      highlightPaths.forEach(path => {
        const pathParts = path.split('.');
        const lastPart = pathParts[pathParts.length - 1];
        
        // Escape special regex characters in the field name
        const escapedPart = lastPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Create patterns for different value types
        const patterns = [
          // String values: "fieldName": "value"
          new RegExp(`(<span class="text-blue-700">)"(${escapedPart})"(</span>)(:\\s*)(<span class="text-green-700">"[^"]*?"</span>)`, 'g'),
          // Number values: "fieldName": 123
          new RegExp(`(<span class="text-blue-700">)"(${escapedPart})"(</span>)(:\\s*)(<span class="text-purple-700">-?\\d+\\.?\\d*</span>)`, 'g'),
          // Boolean values: "fieldName": true/false
          new RegExp(`(<span class="text-blue-700">)"(${escapedPart})"(</span>)(:\\s*)(<span class="text-orange-600">(?:true|false)</span>)`, 'g'),
          // Null values: "fieldName": null
          new RegExp(`(<span class="text-blue-700">)"(${escapedPart})"(</span>)(:\\s*)(<span class="text-gray-500">null</span>)`, 'g'),
          // Object/Array values: "fieldName": { or [
          new RegExp(`(<span class="text-blue-700">)"(${escapedPart})"(</span>)(:\\s*)(\\{|\\[)`, 'g')
        ];
        
        patterns.forEach(pattern => {
          highlighted = highlighted.replace(
            pattern,
            (match, p1, p2, p3, p4, p5) => {
              // Highlight the field name with yellow background and bold
              const highlightedField = `<span class="bg-yellow-200 font-bold text-blue-700">"${p2}"</span>`;
              // For object/array patterns, p5 is undefined, so we handle it differently
              return p5 !== undefined ? `${highlightedField}${p4}${p5}` : `${highlightedField}${p4}`;
            }
          );
        });
      });
    }
    
    return highlighted;
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {title && (
        <div className="bg-gray-100 px-3 py-2 flex justify-between items-center">
          <h3 className="font-semibold text-gray-700">{title}</h3>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={handleEdit}
                  className="px-2 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Edit
                </button>
                <button
                  onClick={handleCopy}
                  className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                  title="Copy JSON"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={!!parseError}
                  className="px-2 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-2 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
      
      <div className={`${isEditing ? '' : maxHeight} overflow-auto`}>
        {isEditing ? (
          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              // Try to parse to check for errors
              try {
                JSON.parse(e.target.value);
                setParseError('');
              } catch (err) {
                setParseError(`JSON Error: ${(err as Error).message}`);
              }
            }}
            className="w-full p-3 text-xs font-mono bg-gray-50 border-0 outline-none resize-none"
            spellCheck={false}
            style={{ 
              minHeight: maxHeight === 'max-h-[900px]' ? '900px' : '400px',
              height: '100%'
            }}
          />
        ) : (
          <pre
            className="bg-gray-50 p-3 text-xs font-mono"
            dangerouslySetInnerHTML={{ __html: highlightJson(jsonText) }}
          />
        )}
      </div>
      {parseError && isEditing && (
        <div className="bg-red-50 border-t border-red-200 px-3 py-2">
          <p className="text-xs text-red-600 font-mono">{parseError}</p>
        </div>
      )}
    </div>
  );
}