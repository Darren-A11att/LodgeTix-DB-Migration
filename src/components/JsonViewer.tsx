'use client';

import { useState } from 'react';

interface JsonViewerProps {
  data: any;
  title?: string;
  maxHeight?: string;
}

export default function JsonViewer({ data, title, maxHeight = 'max-h-96' }: JsonViewerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);
  const highlighted = searchTerm
    ? jsonString.replace(
        new RegExp(`(${searchTerm})`, 'gi'),
        '<mark class="bg-yellow-300">$1</mark>'
      )
    : jsonString;

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {title && (
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
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="px-2 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              {isCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
        </div>
      )}
      {!isCollapsed && (
        <pre
          className={`bg-gray-50 p-3 text-xs overflow-auto ${maxHeight}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      )}
    </div>
  );
}