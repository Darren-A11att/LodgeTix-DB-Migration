'use client';

import EnhancedDataTable from '@/components/admin/EnhancedDataTable';
import { useState } from 'react';

export default function OrdersPage() {
  const [showOrderDetails, setShowOrderDetails] = useState<any>(null);

  const columns = [
    { 
      key: 'display_id', 
      label: 'Order #',
      render: (value: string, item: any) => (
        <span className="font-medium">#{value || item._id.slice(-6)}</span>
      )
    },
    { 
      key: 'customer_email', 
      label: 'Customer',
      render: (value: string, item: any) => (
        <div>
          <div className="font-medium">{value}</div>
          {item.customer_name && (
            <div className="text-xs text-gray-500">{item.customer_name}</div>
          )}
        </div>
      )
    },
    { 
      key: 'total', 
      label: 'Total',
      render: (value: number) => (
        <span className="font-medium">${((value || 0) / 100).toFixed(2)}</span>
      )
    },
    { 
      key: 'payment_status', 
      label: 'Payment',
      render: (value: string) => {
        const statusColors: Record<string, string> = {
          captured: 'bg-green-100 text-green-800',
          pending: 'bg-yellow-100 text-yellow-800',
          failed: 'bg-red-100 text-red-800',
          refunded: 'bg-gray-100 text-gray-800',
        };
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${statusColors[value] || 'bg-gray-100'}`}>
            {value || 'pending'}
          </span>
        );
      }
    },
    { 
      key: 'fulfillment_status', 
      label: 'Fulfillment',
      render: (value: string) => {
        const statusColors: Record<string, string> = {
          fulfilled: 'bg-green-100 text-green-800',
          partially_fulfilled: 'bg-blue-100 text-blue-800',
          not_fulfilled: 'bg-yellow-100 text-yellow-800',
          shipped: 'bg-purple-100 text-purple-800',
        };
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${statusColors[value] || 'bg-gray-100'}`}>
            {value || 'not_fulfilled'}
          </span>
        );
      }
    },
    { 
      key: 'createdAt', 
      label: 'Date',
      render: (value: string) => value ? new Date(value).toLocaleDateString() : 'N/A'
    },
  ];

  const bulkActions = [
    { 
      label: 'Print Labels', 
      action: 'print_labels',
      icon: '🖨️',
      variant: 'primary' as const
    },
    { 
      label: 'Mark as Fulfilled', 
      action: 'mark_fulfilled',
      icon: '✅',
      variant: 'primary' as const
    },
    { 
      label: 'Send Confirmation', 
      action: 'send_confirmation',
      icon: '📧',
      variant: 'secondary' as const
    },
    { 
      label: 'Export Selected', 
      action: 'export',
      icon: '📥',
      variant: 'secondary' as const
    },
  ];

  const statusFilters = [
    { value: 'pending', label: 'Pending', count: 12, color: 'yellow' },
    { value: 'processing', label: 'Processing', count: 5, color: 'blue' },
    { value: 'shipped', label: 'Shipped', count: 8, color: 'purple' },
    { value: 'completed', label: 'Completed', count: 156, color: 'green' },
    { value: 'cancelled', label: 'Cancelled', count: 3, color: 'red' },
  ];

  const expandedRow = (order: any) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Order Items */}
      <div className="lg:col-span-2">
        <h3 className="font-semibold mb-3">Order Items</h3>
        <div className="space-y-2">
          {(order.items || []).map((item: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center p-3 bg-white rounded border">
              <div>
                <div className="font-medium">{item.title || 'Product'}</div>
                <div className="text-sm text-gray-500">
                  {item.variant_title && <span>{item.variant_title} • </span>}
                  Qty: {item.quantity}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">
                  ${((item.unit_price || 0) / 100).toFixed(2)}
                </div>
                {item.quantity > 1 && (
                  <div className="text-xs text-gray-500">
                    ${((item.unit_price * item.quantity) / 100).toFixed(2)} total
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Order Totals */}
        <div className="mt-4 pt-4 border-t space-y-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>${((order.subtotal || 0) / 100).toFixed(2)}</span>
          </div>
          {order.shipping_total > 0 && (
            <div className="flex justify-between">
              <span>Shipping:</span>
              <span>${(order.shipping_total / 100).toFixed(2)}</span>
            </div>
          )}
          {order.tax_total > 0 && (
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>${(order.tax_total / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-lg">
            <span>Total:</span>
            <span>${((order.total || 0) / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Customer & Actions */}
      <div className="space-y-4">
        {/* Customer Info */}
        <div className="bg-white p-4 rounded border">
          <h3 className="font-semibold mb-2">Customer</h3>
          <div className="space-y-1 text-sm">
            <div>{order.customer_email}</div>
            {order.customer_phone && <div>{order.customer_phone}</div>}
            {order.shipping_address && (
              <div className="mt-2 pt-2 border-t">
                <div className="font-medium">Shipping Address:</div>
                <div>{order.shipping_address.address_1}</div>
                {order.shipping_address.address_2 && <div>{order.shipping_address.address_2}</div>}
                <div>
                  {order.shipping_address.city}, {order.shipping_address.province} {order.shipping_address.postal_code}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white p-4 rounded border">
          <h3 className="font-semibold mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
              📧 Send Confirmation Email
            </button>
            <button className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm">
              ✅ Mark as Fulfilled
            </button>
            <button className="w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm">
              🖨️ Print Packing Slip
            </button>
            <button className="w-full px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm">
              💳 Issue Refund
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white p-4 rounded border">
          <h3 className="font-semibold mb-2">Timeline</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Created:</span>
              <span>{new Date(order.createdAt).toLocaleString()}</span>
            </div>
            {order.paid_at && (
              <div className="flex justify-between">
                <span>Paid:</span>
                <span>{new Date(order.paid_at).toLocaleString()}</span>
              </div>
            )}
            {order.fulfilled_at && (
              <div className="flex justify-between">
                <span>Fulfilled:</span>
                <span>{new Date(order.fulfilled_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-gray-600">Manage and process customer orders</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
            📥 Import Orders
          </button>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            ➕ Create Order
          </button>
        </div>
      </div>

      <EnhancedDataTable 
        collection="orders" 
        columns={columns}
        searchFields={['display_id', 'customer_email', 'customer_name']}
        bulkActions={bulkActions}
        statusFilters={statusFilters}
        defaultStatus="pending"
        expandedRow={expandedRow}
      />
    </div>
  );
}