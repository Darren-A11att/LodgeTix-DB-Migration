'use client';

import DataTable from '@/components/admin/DataTable';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

export default function PaymentGatewaysPage() {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    { 
      key: 'provider', 
      label: 'Provider',
      render: (value: string) => {
        const providerColors: Record<string, string> = {
          stripe: 'bg-purple-100 text-purple-800',
          square: 'bg-green-100 text-green-800',
          paypal: 'bg-blue-100 text-blue-800',
          manual: 'bg-gray-100 text-gray-800'
        };
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${providerColors[value] || 'bg-gray-100 text-gray-800'}`}>
            {value}
          </span>
        );
      }
    },
    { 
      key: 'account_type', 
      label: 'Account Type',
      render: (value: string) => {
        const typeColors: Record<string, string> = {
          platform: 'bg-indigo-100 text-indigo-800',
          connect: 'bg-yellow-100 text-yellow-800',
          merchant: 'bg-cyan-100 text-cyan-800'
        };
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[value] || 'bg-gray-100 text-gray-800'}`}>
            {value}
          </span>
        );
      }
    },
    { 
      key: 'is_active', 
      label: 'Status',
      render: (value: boolean) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      )
    },
    { 
      key: 'is_default', 
      label: 'Default',
      render: (value: boolean) => value ? (
        <span className="text-green-600">✓</span>
      ) : (
        <span className="text-gray-400">-</span>
      )
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Payment Gateways</h1>
          <p className="text-gray-600">Configure payment gateway accounts for processing transactions</p>
        </div>
        <SimpleDatabaseSelector className="w-64" />
      </div>
      <div className="mb-6"></div>
      <DataTable 
        collection="payment_gateways"
        columns={columns}
        searchableFields={['name', 'code', 'provider']}
      />
    </div>
  );
}