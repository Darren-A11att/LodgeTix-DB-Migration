'use client';

import DataTable from '@/components/admin/DataTable';

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
      <h1 className="text-2xl font-bold mb-6">Vendors</h1>
      <DataTable 
        collection="vendors" 
        columns={columns}
        searchFields={['name', 'email']}
      />
    </div>
  );
}