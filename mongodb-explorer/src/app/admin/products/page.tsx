import DataTable from '@/components/admin/DataTable';

export default function ProductsPage() {
  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'handle', label: 'Handle' },
    { 
      key: 'type', 
      label: 'Type',
      render: (value: string) => {
        const typeColors: Record<string, string> = {
          bundle: 'bg-purple-100 text-purple-800',
          kit: 'bg-blue-100 text-blue-800',
          standard: 'bg-gray-100 text-gray-800'
        };
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[value] || 'bg-gray-100 text-gray-800'}`}>
            {value}
          </span>
        );
      }
    },
    { key: 'status', label: 'Status' },
    { key: 'vendor_handle', label: 'Vendor' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Products</h1>
      <p className="text-gray-600 mb-4">Manage products including bundles and kits</p>
      <DataTable 
        collection="products" 
        columns={columns}
        searchFields={['title', 'handle', 'type']}
      />
    </div>
  );
}