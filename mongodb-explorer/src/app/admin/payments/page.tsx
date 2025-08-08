import DataTable from '@/components/admin/DataTable';

export default function PaymentsPage() {
  const columns = [
    { key: 'cart_id', label: 'Cart ID' },
    { key: 'amount', label: 'Amount', render: (value: number) => `$${(value / 100 || 0).toFixed(2)}` },
    { key: 'currency_code', label: 'Currency' },
    { key: 'provider_id', label: 'Provider' },
    { key: 'captured_at', label: 'Captured', render: (value: string) => value ? new Date(value).toLocaleDateString() : 'Not captured' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Payments</h1>
      <DataTable 
        collection="payments" 
        columns={columns}
        searchFields={['cart_id', 'provider_id']}
      />
    </div>
  );
}