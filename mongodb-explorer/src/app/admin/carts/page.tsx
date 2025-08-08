import DataTable from '@/components/admin/DataTable';

export default function CartsPage() {
  const columns = [
    { key: 'email', label: 'Email' },
    { key: 'customer_id', label: 'Customer ID' },
    { key: 'payment_session', label: 'Payment Session' },
    { key: 'completed_at', label: 'Completed', render: (value: string) => value ? new Date(value).toLocaleDateString() : 'Active' },
    { key: 'updatedAt', label: 'Updated', render: (value: string) => value ? new Date(value).toLocaleDateString() : 'N/A' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Carts</h1>
      <DataTable 
        collection="carts" 
        columns={columns}
        searchFields={['email', 'customer_id']}
      />
    </div>
  );
}