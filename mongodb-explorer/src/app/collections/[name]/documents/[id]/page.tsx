'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import apiService from '@/lib/api';

export default function DocumentPage() {
  const params = useParams();
  const collectionName = params.name as string;
  const documentId = params.id as string;
  
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (collectionName && documentId) {
      fetchDocument();
    }
  }, [collectionName, documentId]);

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const data = await apiService.getDocument(collectionName, documentId);
      setDocument(data);
    } catch (err) {
      setError('Failed to load document');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading document...</div>
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

  if (!document) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Document not found</div>
      </div>
    );
  }

  const fields = Object.entries(document);

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/" className="text-blue-500 hover:underline">
          Collections
        </Link>
        <span className="text-gray-400">/</span>
        <Link href={`/collections/${collectionName}`} className="text-blue-500 hover:underline">
          {collectionName}
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600">{documentId}</span>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Document Details
        </h1>

        <div className="bg-gray-50 p-4 rounded-md mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-semibold text-gray-600">Collection:</span>{' '}
              <span className="text-gray-800">{collectionName}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-600">Document ID:</span>{' '}
              <span className="text-gray-800 font-mono">{documentId}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-600">Total Fields:</span>{' '}
              <span className="text-gray-800">{fields.length}</span>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Fields</h2>
          <div className="space-y-2">
            {fields.map(([key, value]) => (
              <div key={key} className="border rounded-md overflow-hidden">
                <div className="bg-gray-800 text-white px-4 py-2 font-mono text-sm">
                  {key}
                </div>
                <div className="bg-gray-50 p-4">
                  <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mb-2">
                    {getType(value)}
                  </span>
                  <pre className="mt-2 text-sm overflow-x-auto font-mono whitespace-pre-wrap">
                    {formatFieldValue(value)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Raw JSON</h2>
          <div className="bg-gray-900 text-green-400 p-6 rounded-md overflow-x-auto">
            <pre className="text-sm font-mono">
              {JSON.stringify(document, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </main>
  );
}

function getType(value: any): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function formatFieldValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}