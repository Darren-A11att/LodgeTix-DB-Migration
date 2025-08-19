'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

interface BanquetReport {
  summary: {
    totalTransactions: number;
    totalRevenue: number;
    totalQuantity: number;
    averagePrice: number;
  };
  breakdownByDescription: Record<string, {
    count: number;
    revenue: number;
    quantity: number;
  }>;
  breakdownByMonth: Record<string, {
    count: number;
    revenue: number;
  }>;
  transactions: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    description: string;
    quantity: number;
    price: number;
    customerName: string;
    customerEmail: string;
  }>;
}

export default function BanquetReportPage() {
  const [report, setReport] = useState<BanquetReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/reports/banquet-transactions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch report');
      
      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const downloadCSV = async () => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('format', 'csv');
    
    const response = await fetch(`/api/reports/banquet-transactions?${params}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `banquet-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8">Loading report...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!report) return <div className="p-8">No data available</div>;

  return (
    <main className="p-8">
      <div className="mb-6">
        <Link href="/" className="text-blue-500 hover:underline">
          ← Back to Home
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Banquet Transactions Report</h1>
            <p className="text-gray-600">Analyze all transactions containing "banquet" in the description</p>
          </div>
          <div className="flex flex-col items-end">
            <label className="text-sm font-medium text-gray-700 mb-1">Database</label>
            <SimpleDatabaseSelector className="w-48" />
          </div>
        </div>
        <div className="flex gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchReport}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Update Report
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={downloadCSV}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Download CSV
            </button>
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Summary</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Transactions</p>
            <p className="text-2xl font-bold">{report.summary.totalTransactions}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Revenue</p>
            <p className="text-2xl font-bold">${report.summary.totalRevenue.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Quantity</p>
            <p className="text-2xl font-bold">{report.summary.totalQuantity}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Average Price</p>
            <p className="text-2xl font-bold">${report.summary.averagePrice.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Breakdown by Description */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Breakdown by Description</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Description</th>
              <th className="text-right py-2">Count</th>
              <th className="text-right py-2">Quantity</th>
              <th className="text-right py-2">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(report.breakdownByDescription).map(([desc, data]) => (
              <tr key={desc} className="border-b">
                <td className="py-2">{desc}</td>
                <td className="text-right py-2">{data.count}</td>
                <td className="text-right py-2">{data.quantity}</td>
                <td className="text-right py-2">${data.revenue.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Monthly Breakdown</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Month</th>
              <th className="text-right py-2">Transactions</th>
              <th className="text-right py-2">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(report.breakdownByMonth)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([month, data]) => (
                <tr key={month} className="border-b">
                  <td className="py-2">{month}</td>
                  <td className="text-right py-2">{data.count}</td>
                  <td className="text-right py-2">${data.revenue.toFixed(2)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Transaction Details */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Transaction Details</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Invoice #</th>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Price</th>
                <th className="text-left py-2">Customer</th>
              </tr>
            </thead>
            <tbody>
              {report.transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b">
                  <td className="py-2">{transaction.invoiceNumber}</td>
                  <td className="py-2">{new Date(transaction.invoiceDate).toLocaleDateString()}</td>
                  <td className="py-2">{transaction.description}</td>
                  <td className="text-right py-2">{transaction.quantity}</td>
                  <td className="text-right py-2">${transaction.price.toFixed(2)}</td>
                  <td className="py-2">{transaction.customerName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}