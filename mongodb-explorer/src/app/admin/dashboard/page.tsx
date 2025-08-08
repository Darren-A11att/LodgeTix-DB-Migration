'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardMetrics {
  ordersToProcess: number;
  lowStockItems: number;
  pendingRefunds: number;
  todaysRevenue: number;
  newCustomers: number;
  activeCartsTotal: number;
  todaysOrders: number;
  awaitingFulfillment: number;
}

interface RecentOrder {
  _id: string;
  display_id: string;
  customer_email: string;
  total: number;
  status: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    ordersToProcess: 0,
    lowStockItems: 0,
    pendingRefunds: 0,
    todaysRevenue: 0,
    newCustomers: 0,
    activeCartsTotal: 0,
    todaysOrders: 0,
    awaitingFulfillment: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch metrics
      const metricsRes = await fetch('/api/admin/dashboard/metrics');
      const metricsData = await metricsRes.json();
      setMetrics(metricsData);

      // Fetch recent orders
      const ordersRes = await fetch('/api/admin/orders?limit=5');
      const ordersData = await ordersRes.json();
      setRecentOrders(ordersData.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { 
      label: 'Add Product', 
      href: '/admin/products', 
      icon: '📦',
      color: 'bg-blue-500 hover:bg-blue-600' 
    },
    { 
      label: 'Process Orders', 
      href: '/admin/orders?status=pending', 
      icon: '📋',
      color: 'bg-green-500 hover:bg-green-600' 
    },
    { 
      label: 'View Reports', 
      href: '/admin/reports', 
      icon: '📊',
      color: 'bg-purple-500 hover:bg-purple-600' 
    },
    { 
      label: 'Manage Inventory', 
      href: '/admin/inventory', 
      icon: '📈',
      color: 'bg-orange-500 hover:bg-orange-600' 
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Commerce Dashboard</h1>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Orders to Process"
          value={metrics.ordersToProcess}
          href="/admin/orders?status=pending"
          icon="📦"
          trend={metrics.ordersToProcess > 0 ? 'warning' : 'success'}
        />
        <MetricCard
          title="Low Stock Items"
          value={metrics.lowStockItems}
          href="/admin/inventory?stock=low"
          icon="⚠️"
          trend={metrics.lowStockItems > 5 ? 'danger' : 'warning'}
        />
        <MetricCard
          title="Today's Revenue"
          value={`$${metrics.todaysRevenue.toFixed(2)}`}
          href="/admin/orders?date=today"
          icon="💰"
          trend="success"
        />
        <MetricCard
          title="Awaiting Fulfillment"
          value={metrics.awaitingFulfillment}
          href="/admin/orders?status=awaiting_fulfillment"
          icon="🚚"
          trend={metrics.awaitingFulfillment > 10 ? 'warning' : 'normal'}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`${action.color} text-white rounded-lg p-4 text-center transition-colors`}
            >
              <div className="text-2xl mb-2">{action.icon}</div>
              <div className="text-sm font-medium">{action.label}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Orders & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Recent Orders</h2>
              <Link href="/admin/orders" className="text-blue-600 hover:text-blue-800 text-sm">
                View All →
              </Link>
            </div>
          </div>
          <div className="divide-y">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order._id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">#{order.display_id || order._id.slice(-6)}</div>
                      <div className="text-sm text-gray-600">{order.customer_email}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${(order.total / 100).toFixed(2)}</div>
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                No recent orders
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Today's Activity</h2>
          </div>
          <div className="p-6 space-y-4">
            <StatItem label="New Orders" value={metrics.todaysOrders} />
            <StatItem label="New Customers" value={metrics.newCustomers} />
            <StatItem label="Active Carts" value={metrics.activeCartsTotal} />
            <StatItem label="Pending Refunds" value={metrics.pendingRefunds} />
          </div>
        </div>
      </div>

      {/* Additional Tools */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Management Tools</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/products?type=bundle"
            className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 border"
          >
            Manage Bundles
          </Link>
          <Link
            href="/admin/vendors"
            className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 border"
          >
            Vendor Dashboard
          </Link>
          <Link
            href="/admin/reports/daily"
            className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 border"
          >
            Daily Report
          </Link>
          <Link
            href="/admin/customers/support"
            className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 border"
          >
            Customer Support
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, href, icon, trend }: any) {
  const trendColors = {
    success: 'text-green-600 bg-green-50',
    warning: 'text-yellow-600 bg-yellow-50',
    danger: 'text-red-600 bg-red-50',
    normal: 'text-gray-600 bg-gray-50',
  };

  return (
    <Link href={href} className="block">
      <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={`text-2xl p-2 rounded-lg ${trendColors[trend || 'normal']}`}>
            {icon}
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    shipped: 'bg-purple-100 text-purple-800',
  };

  return (
    <span className={`inline-block px-2 py-1 text-xs rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function StatItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-lg">{value}</span>
    </div>
  );
}