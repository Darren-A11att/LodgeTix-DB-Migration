'use client';

import DataTable from '@/components/admin/DataTable';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <SimpleDatabaseSelector className="w-64" />
      </div>
      <DataTable 
        collection="inventoryItems" 
        columns={columns}
        searchFields={['sku']}
      />
    </div>
  );
}