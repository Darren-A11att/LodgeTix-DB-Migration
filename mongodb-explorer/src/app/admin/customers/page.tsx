'use client';

import DataTable from '@/components/admin/DataTable';

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
      <h1 className="text-2xl font-bold mb-6">Customers</h1>
      <DataTable 
        collection="customers" 
        columns={columns}
        searchFields={['first_name', 'last_name', 'email']}
      />
    </div>
  );
}