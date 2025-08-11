'use client';

import DataTable from '@/components/admin/DataTable';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

export default function FulfillmentsPage() {
  const columns = [
    { key: 'vendor_id', label: 'Vendor ID' },
    { key: 'order_id', label: 'Order ID' },
    { key: 'status', label: 'Status' },
    { key: 'shipped_at', label: 'Shipped', render: (value: string) => value ? new Date(value).toLocaleDateString() : 'Not shipped' },
    { key: 'delivered_at', label: 'Delivered', render: (value: string) => value ? new Date(value).toLocaleDateString() : 'Not delivered' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Fulfillments</h1>
        <SimpleDatabaseSelector className="w-64" />
      </div>
      <DataTable 
        collection="fulfillments" 
        columns={columns}
        searchFields={['order_id', 'status', 'vendor_id']}
      />
    </div>
  );
}