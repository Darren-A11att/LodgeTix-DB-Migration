'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import apiService, { DocumentsResponse } from '@/lib/api';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

export default function CollectionPage() {
  const params = useParams();
  const router = useRouter();
  const collectionName = params.name as string;
  
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const limit = 20;

  useEffect(() => {
    if (collectionName) {
      fetchDocuments();
    }
  }, [collectionName, currentPage, searchQuery]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await apiService.getDocuments(
        collectionName,
        currentPage * limit,
        limit,
        searchQuery
      );
      setDocuments(response.documents);
      setTotalDocuments(response.total);
    } catch (err) {
      setError('Failed to load documents');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(0); // Reset to first page
    setSearchQuery(searchInput);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setCurrentPage(0);
  };

  const totalPages = Math.ceil(totalDocuments / limit);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading documents...</div>
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

  const fieldNames = documents.length > 0 
    ? Object.keys(documents[0]).slice(0, 5) 
    : [];

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <Link href="/" className="text-blue-500 hover:underline">
          ← Back to Collections
        </Link>
        <SimpleDatabaseSelector className="w-64" />
      </div>

      <h1 className="text-3xl font-bold text-gray-800 mb-8">
        {collectionName}
      </h1>

      {/* Search Form */}
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by ID, email, name, or confirmation number..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Search
          </button>
        </form>
        {searchQuery && (
          <p className="mt-2 text-sm text-gray-600">
            Searching for: <span className="font-semibold">{searchQuery}</span>
          </p>
        )}
      </div>

      <div className="bg-blue-500 text-white p-4 rounded-lg mb-8 text-center font-semibold">
        Total Documents: {totalDocuments} | 
        Showing: {currentPage * limit + 1}-{Math.min((currentPage + 1) * limit, totalDocuments)}
        {searchQuery && <span className="ml-2">| Filtered results</span>}
      </div>

      {documents.length === 0 ? (
        <div className="text-center text-gray-600 py-12">
          No documents in this collection
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 text-white">
                <tr>
                  {fieldNames.map(field => (
                    <th key={field} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      {field}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc, index) => (
                  <tr key={doc._id || index} className="hover:bg-gray-50">
                    {fieldNames.map(field => (
                      <td key={field} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="max-w-xs truncate font-mono">
                          {formatValue(doc[field])}
                        </div>
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/collections/${collectionName}/documents/${doc._id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button 
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            Previous
          </button>
          <span className="text-gray-700">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button 
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}

function formatValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object' && value._id) return value._id;
  if (Array.isArray(value)) return `[Array: ${value.length} items]`;
  if (typeof value === 'object') return '{Object}';
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...';
  }
  return String(value);
}