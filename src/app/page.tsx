'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiService, { Collection } from '@/lib/api';

export default function Home() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const data = await apiService.getCollections();
      setCollections(data);
    } catch (err) {
      setError('Failed to load collections');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setSearchLoading(true);
      const response = await apiService.globalSearch(searchQuery);
      setSearchResults(response.results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const totalDocuments = collections.reduce((sum, col) => sum + col.count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading collections...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
        MongoDB Database Explorer
      </h1>

      {/* Global Search Form */}
      <div className="mb-8 max-w-2xl mx-auto">
        <form onSubmit={handleGlobalSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Global search: Enter ID, email, name, or confirmation number..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={searchLoading}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400"
          >
            {searchLoading ? 'Searching...' : 'Search All'}
          </button>
          {searchResults.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Search Results ({searchResults.length})</h2>
          <div className="space-y-3">
            {searchResults.map((result, index) => (
              <div key={index} className="bg-white p-4 rounded border border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-semibold text-blue-600">{result.collection}</span>
                  <Link
                    href={`/collections/${result.collection}/documents/${result.document._id}`}
                    className="text-sm text-blue-500 hover:underline"
                  >
                    View Document →
                  </Link>
                </div>
                <div className="text-sm text-gray-600">
                  <div>ID: {result.document._id}</div>
                  {result.document.confirmationNumber && (
                    <div>Confirmation: {result.document.confirmationNumber}</div>
                  )}
                  {result.document.customerEmail && (
                    <div>Email: {result.document.customerEmail}</div>
                  )}
                  {result.document.primaryAttendee && (
                    <div>Name: {result.document.primaryAttendee}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-500 text-white p-4 rounded-lg mb-8 text-center font-semibold">
        Total Collections: {collections.length} | Total Documents: {totalDocuments.toLocaleString()}
      </div>

      <div className="mb-8 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Reports & Tools</h2>
        <div className="flex gap-4 flex-wrap">
          <Link
            href="/reports/proclamation-banquet"
            className="inline-block px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
          >
            📊 Proclamation Banquet Sales Report
          </Link>
          <Link
            href="/reconciliation"
            className="inline-block px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            🔍 Data Reconciliation Dashboard
          </Link>
          <Link
            href="/invoices/approval"
            className="inline-block px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            ✅ Invoice Approval (Old)
          </Link>
          <Link
            href="/invoices/list"
            className="inline-block px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
          >
            📋 Invoice Matches List
          </Link>
          <Link
            href="/invoices/matches"
            className="inline-block px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
          >
            📄 Process Invoice Matches
          </Link>
          <Link
            href="/migration"
            className="inline-block px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors"
          >
            🔄 Data Migration Tool
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {collections.map((collection) => (
          <Link
            key={collection.name}
            href={collection.name === 'payments' ? '/collections/payments' : `/collections/${collection.name}`}
            className={`block p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border-2 ${
              collection.name === 'payments' 
                ? 'bg-gradient-to-br from-blue-50 to-purple-50 border-blue-300 hover:border-purple-400' 
                : 'bg-white border-transparent hover:border-blue-500'
            }`}
          >
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {collection.name}
              {collection.name === 'payments' && (
                <span className="ml-2 text-sm font-normal text-purple-600">(Enhanced View)</span>
              )}
            </h3>
            <p className="text-gray-600">
              {collection.count.toLocaleString()} documents
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
