'use client';

import Link from 'next/link';
import { useState } from 'react';

interface Report {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  category: 'financial' | 'operational' | 'reconciliation' | 'other';
  status: 'active' | 'beta' | 'legacy';
}

const reports: Report[] = [
  {
    id: 'event-tickets',
    title: 'Event Tickets Sales Report',
    description: 'Comprehensive analysis of event ticket sales, revenue, attendee counts, and capacity utilization. Track performance across all events with detailed metrics.',
    icon: '🎟️',
    href: '/reports/event-tickets',
    category: 'financial',
    status: 'active'
  },
  {
    id: 'registration-types',
    title: 'Registration Types Report',
    description: 'Analyze registration breakdown by type (individual vs lodge), with counts, revenue analysis, and top lodge statistics.',
    icon: '👥',
    href: '/reports/registration-types',
    category: 'operational',
    status: 'active'
  },
  {
    id: 'banquet-transactions',
    title: 'Banquet Transactions Report',
    description: 'Analyze all transactions containing "banquet" in the description. Includes revenue analysis, monthly trends, and CSV export.',
    icon: '🍽️',
    href: '/reports/banquet',
    category: 'financial',
    status: 'active'
  },
  {
    id: 'proclamation-banquet',
    title: 'Proclamation Banquet Sales Report',
    description: 'Specific report for Grand Proclamation banquet sales and attendee analysis.',
    icon: '📊',
    href: '/reports/proclamation-banquet',
    category: 'financial',
    status: 'active'
  },
  {
    id: 'reconciliation',
    title: 'Data Reconciliation Dashboard',
    description: 'Compare and reconcile data between different sources to identify discrepancies.',
    icon: '🔍',
    href: '/reconciliation',
    category: 'reconciliation',
    status: 'active'
  },
  {
    id: 'invoice-matches',
    title: 'Invoice Matches Report',
    description: 'View all payments and their registration matches for invoice creation.',
    icon: '📋',
    href: '/invoices/list',
    category: 'operational',
    status: 'active'
  },
  {
    id: 'invoice-approval-old',
    title: 'Invoice Approval (Legacy)',
    description: 'Original invoice approval system for processing invoices.',
    icon: '✅',
    href: '/invoices/approval',
    category: 'operational',
    status: 'legacy'
  }
];

const categories = {
  financial: { name: 'Financial Reports', color: 'blue' },
  operational: { name: 'Operational Reports', color: 'green' },
  reconciliation: { name: 'Reconciliation', color: 'purple' },
  other: { name: 'Other Reports', color: 'gray' }
};

export default function ReportsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReports = reports.filter(report => {
    const matchesCategory = selectedCategory === 'all' || report.category === selectedCategory;
    const matchesSearch = report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getStatusBadge = (status: Report['status']) => {
    switch (status) {
      case 'active':
        return <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>;
      case 'beta':
        return <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Beta</span>;
      case 'legacy':
        return <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">Legacy</span>;
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/" className="text-blue-500 hover:underline">
          ← Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-800 mb-2">Reports Center</h1>
      <p className="text-gray-600 mb-8">Access all available reports and analytics tools</p>

      {/* Search and Filter Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Reports
            </button>
            {Object.entries(categories).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedCategory === key
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600">Total Reports</p>
          <p className="text-2xl font-bold">{reports.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600">Active Reports</p>
          <p className="text-2xl font-bold text-green-600">
            {reports.filter(r => r.status === 'active').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600">Categories</p>
          <p className="text-2xl font-bold">{Object.keys(categories).length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600">Legacy Reports</p>
          <p className="text-2xl font-bold text-gray-600">
            {reports.filter(r => r.status === 'legacy').length}
          </p>
        </div>
      </div>

      {/* Reports Grid */}
      {filteredReports.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No reports found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => (
            <Link
              key={report.id}
              href={report.href}
              className="block bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border-2 border-transparent hover:border-blue-500"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl">{report.icon}</span>
                {getStatusBadge(report.status)}
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {report.title}
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                {report.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {categories[report.category].name}
                </span>
                <span className="text-blue-500 text-sm">
                  View Report →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Add New Report Section */}
      <div className="mt-12 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <h2 className="text-lg font-semibold mb-2">Need a Custom Report?</h2>
        <p className="text-gray-600 mb-4">
          If you need a specific report that's not listed here, you can request a custom report or use the MongoDB Explorer to query data directly.
        </p>
        <div className="flex gap-4">
          <Link
            href="/collections/transactions"
            className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Explore Transactions
          </Link>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Browse Collections
          </Link>
        </div>
      </div>
    </main>
  );
}