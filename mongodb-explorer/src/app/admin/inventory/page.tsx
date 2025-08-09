'use client';

import DataTable from '@/components/admin/DataTable';

export default function InventoryPage() {
  const columns = [
    { key: 'sku', label: 'SKU' },
    { key: 'stocked_quantity', label: 'Stock Quantity' },
    { key: 'reserved_quantity', label: 'Reserved' },
    { key: 'is_kit', label: 'Is Kit', render: (value: boolean) => value ? 'Yes' : 'No' },
    { key: 'updatedAt', label: 'Last Updated', render: (value: string) => value ? new Date(value).toLocaleDateString() : 'N/A' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Inventory</h1>
      <DataTable 
        collection="inventoryItems" 
        columns={columns}
        searchFields={['sku']}
      />
    </div>
  );
}