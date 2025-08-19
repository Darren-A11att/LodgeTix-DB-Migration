'use client';

import DataTable from '@/components/admin/DataTable';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

export default function CustomersPage() {
  const columns = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'has_account', label: 'Has Account', render: (value: boolean) => value ? 'Yes' : 'No' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        <SimpleDatabaseSelector className="w-64" />
      </div>
      <DataTable 
        collection="customers" 
        columns={columns}
        searchFields={['first_name', 'last_name', 'email']}
      />
    </div>
  );
}