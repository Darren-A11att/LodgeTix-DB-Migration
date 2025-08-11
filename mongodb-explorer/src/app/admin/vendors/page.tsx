'use client';

import DataTable from '@/components/admin/DataTable';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

export default function VendorsPage() {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'commission_rate', label: 'Commission %' },
    { key: 'status', label: 'Status' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Vendors</h1>
        <SimpleDatabaseSelector className="w-64" />
      </div>
      <DataTable 
        collection="vendors" 
        columns={columns}
        searchFields={['name', 'email']}
      />
    </div>
  );
}