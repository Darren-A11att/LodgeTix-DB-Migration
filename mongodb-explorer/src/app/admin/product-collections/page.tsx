'use client';

import DataTable from '@/components/admin/DataTable';

export default function ProductCollectionsPage() {
  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'handle', label: 'Handle' },
    { 
      key: 'metadata.lodgetix_function_id', 
      label: 'LodgeTix Function',
      render: (value: string) => value ? (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
          {value}
        </span>
      ) : (
        <span className="text-gray-400">-</span>
      )
    },
    { 
      key: 'metadata.venue', 
      label: 'Venue',
      render: (value: string) => value || '-'
    },
    { 
      key: 'metadata.date', 
      label: 'Date',
      render: (value: string) => value ? new Date(value).toLocaleDateString() : '-'
    },
    { 
      key: 'created_at', 
      label: 'Created',
      render: (value: string) => new Date(value).toLocaleDateString()
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Product Collections</h1>
      <p className="text-gray-600 mb-6">Organize products into collections (maps to LodgeTix functions)</p>
      <DataTable 
        collection="product_collections"
        columns={columns}
        searchableFields={['title', 'handle']}
      />
    </div>
  );
}