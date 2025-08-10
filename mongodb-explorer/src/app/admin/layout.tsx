import Link from 'next/link';
import QuickSearch from '@/components/admin/QuickSearch';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const menuItems = [
    { name: '📊 Dashboard', path: '/admin/dashboard', highlight: true },
    { name: '🎯 Setup Wizard', path: '/admin/setup-wizard', highlight: true },
    { name: '📦 Orders', path: '/admin/orders' },
    { name: '🛍️ Products', path: '/admin/products' },
    { name: '📂 Collections', path: '/admin/product-collections' },
    { name: '👥 Customers', path: '/admin/customers' },
    { name: '📈 Inventory', path: '/admin/inventory' },
    { name: '🏢 Vendors', path: '/admin/vendors' },
    { name: '🛒 Carts', path: '/admin/carts' },
    { name: '💳 Payments', path: '/admin/payments' },
    { name: '🏦 Gateways', path: '/admin/payment-gateways' },
    { name: '🚚 Fulfillments', path: '/admin/fulfillments' },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-800 text-white p-4">
        <Link href="/admin/dashboard" className="block mb-6">
          <h2 className="text-xl font-bold">Commerce Admin</h2>
        </Link>
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`block px-4 py-2 rounded transition-colors ${
                item.highlight 
                  ? 'bg-blue-600 hover:bg-blue-700 font-medium' 
                  : 'hover:bg-gray-700'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8 bg-gray-50">
        {children}
      </main>
      <QuickSearch />
    </div>
  );
}