'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  collection: string;
  document: any;
  matchField: string;
}

export default function QuickSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Open search with Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Perform search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300); // Debounce

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    
    // Navigate to appropriate page
    if (result.collection === 'orders') {
      router.push(`/admin/orders?id=${result.document._id}`);
    } else if (result.collection === 'products') {
      router.push(`/admin/products?id=${result.document._id}`);
    } else if (result.collection === 'customers') {
      router.push(`/admin/customers?id=${result.document._id}`);
    } else {
      router.push(`/admin/${result.collection}`);
    }
  };

  const getResultLabel = (result: SearchResult) => {
    const doc = result.document;
    
    switch (result.collection) {
      case 'orders':
        return `Order #${doc.display_id || doc._id.slice(-6)} - ${doc.customer_email}`;
      case 'products':
        return `${doc.title || doc.name} (${doc.type || 'standard'})`;
      case 'customers':
        return `${doc.first_name} ${doc.last_name} - ${doc.email}`;
      case 'vendors':
        return `${doc.name} - ${doc.email}`;
      default:
        return doc.title || doc.name || doc.email || doc._id;
    }
  };

  const getResultIcon = (collection: string) => {
    const icons: Record<string, string> = {
      orders: '📦',
      products: '🛍️',
      customers: '👤',
      vendors: '🏢',
      payments: '💳',
      carts: '🛒',
      inventory: '📈',
    };
    return icons[collection] || '📄';
  };

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 z-40 px-4 py-2 bg-white shadow-lg rounded-lg border flex items-center gap-2 hover:shadow-xl transition-shadow"
      >
        <span className="text-gray-500">🔍</span>
        <span className="text-sm text-gray-600">Quick Search</span>
        <kbd className="px-2 py-0.5 text-xs bg-gray-100 rounded">⌘K</kbd>
      </button>

      {/* Search modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-start justify-center pt-20">
          <div ref={searchRef} className="bg-white rounded-lg shadow-2xl w-full max-w-2xl">
            {/* Search input */}
            <div className="p-4 border-b">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search orders, products, customers..."
                className="w-full px-4 py-2 text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {loading && (
                <div className="p-8 text-center text-gray-500">
                  Searching...
                </div>
              )}

              {!loading && query && results.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No results found for "{query}"
                </div>
              )}

              {!loading && results.length > 0 && (
                <div className="py-2">
                  {results.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleResultClick(result)}
                      className="w-full px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-left"
                    >
                      <span className="text-2xl">{getResultIcon(result.collection)}</span>
                      <div className="flex-1">
                        <div className="font-medium">{getResultLabel(result)}</div>
                        <div className="text-sm text-gray-500">
                          {result.collection} • {result.matchField}
                        </div>
                      </div>
                      <span className="text-gray-400">→</span>
                    </button>
                  ))}
                </div>
              )}

              {!query && (
                <div className="p-4 text-sm text-gray-500">
                  <div className="mb-2 font-medium">Quick tips:</div>
                  <ul className="space-y-1">
                    <li>• Search by order number, email, or customer name</li>
                    <li>• Find products by name, SKU, or type</li>
                    <li>• Look up customers by name or email</li>
                    <li>• Press ESC to close</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}