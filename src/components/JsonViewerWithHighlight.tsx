import React, { useState } from 'react';

interface JsonViewerWithHighlightProps {
  data: any;
  title?: string;
  maxHeight?: string;
  highlightPaths?: string[];
  highlightColor?: string;
}

export default function JsonViewerWithHighlight({ 
  data, 
  title = 'JSON Data', 
  maxHeight = 'max-h-96',
  highlightPaths = [],
  highlightColor = 'bg-yellow-200'
}: JsonViewerWithHighlightProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const shouldHighlight = (path: string, value: any): boolean => {
    // Only highlight exact path matches
    return highlightPaths.includes(path);
  };

  const renderJson = (obj: any, indent: number = 0, path: string = ''): React.ReactNode => {
    if (obj === null) return <span className="text-gray-500">null</span>;
    if (obj === undefined) return <span className="text-gray-500">undefined</span>;

    const spaces = ' '.repeat(indent * 2);

    if (typeof obj !== 'object') {
      const valueStr = typeof obj === 'string' ? `"${obj}"` : String(obj);
      const isHighlighted = shouldHighlight(path, obj);
      
      if (!searchTerm || valueStr.toLowerCase().includes(searchTerm.toLowerCase())) {
        return (
          <span className={isHighlighted ? `${highlightColor} px-1 -mx-1 rounded font-semibold` : ''}>
            <span className={
              typeof obj === 'string' ? 'text-green-700' :
              typeof obj === 'number' ? 'text-blue-600' :
              typeof obj === 'boolean' ? 'text-purple-600' :
              'text-gray-800'
            }>
              {valueStr}
            </span>
          </span>
        );
      }
      return null;
    }

    const isArray = Array.isArray(obj);
    const entries = isArray ? obj.map((v, i) => [i, v]) : Object.entries(obj);

    return (
      <>
        <span className="text-gray-800">{isArray ? '[' : '{'}</span>
        {entries.length > 0 && (
          <>
            {'\n'}
            {entries.map(([key, value], index) => {
              const currentPath = path ? `${path}.${key}` : String(key);
              const keyStr = isArray ? '' : `"${key}": `;
              const isKeyHighlighted = shouldHighlight(currentPath, value);
              
              const rendered = (
                <React.Fragment key={key}>
                  {spaces}  
                  {!isArray && <span className="text-blue-800">{keyStr}</span>}
                  {renderJson(value, indent + 1, currentPath)}
                  {index < entries.length - 1 ? ',' : ''}
                  {'\n'}
                </React.Fragment>
              );

              if (!searchTerm || 
                  keyStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  JSON.stringify(value).toLowerCase().includes(searchTerm.toLowerCase())) {
                return rendered;
              }
              return null;
            })}
            {spaces}
          </>
        )}
        <span className="text-gray-800">{isArray ? ']' : '}'}</span>
      </>
    );
  };

  if (isCollapsed) {
    return (
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-3 py-2 flex justify-between items-center">
          <h3 className="font-semibold text-gray-700">{title}</h3>
          <button
            onClick={() => setIsCollapsed(false)}
            className="px-2 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Expand
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="bg-gray-100 px-3 py-2 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">{title}</h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-2 py-1 text-sm border rounded"
          />
          <button
            onClick={handleCopy}
            className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            title="Copy JSON"
          >
            {isCopied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="px-2 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Collapse
          </button>
        </div>
      </div>
      <pre className={`bg-gray-50 p-3 text-xs overflow-auto ${maxHeight}`}>
        {renderJson(data)}
      </pre>
    </div>
  );
}