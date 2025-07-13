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

      {/* Quick Actions */}
      <div className="mb-8 max-w-4xl mx-auto">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link 
              href="/payment-import"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Payment Import
            </Link>
            <Link 
              href="/import-queue"
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Import Queue
            </Link>
            <Link 
              href="/duplicate-finder"
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              Duplicate Finder
            </Link>
            <Link 
              href="/match-analyzer"
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Match Analyzer
            </Link>
          </div>
        </div>
      </div>

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
          <Link
            href="/tools"
            className="inline-block px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
          >
            🛠️ Tools & Scripts
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
