'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

interface Payment {
  _id: string;
  transactionId: string;
  timestamp: string;
  status: string;
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
  currency: string;
  customerName?: string;
  customerEmail?: string;
  cardBrand?: string;
  cardLast4?: string;
  eventDescription?: string;
  source: string;
  sourceFile: string;
}

interface PaymentResponse {
  documents: Payment[];
  total: number;
  limit: number;
  skip: number;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'square' | 'stripe'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'failed' | 'refunded'>('all');
  
  const limit = 20;

  useEffect(() => {
    fetchPayments();
  }, [page]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await axios.get<PaymentResponse>(
        `http://localhost:3006/api/collections/payments/documents?limit=${limit}&skip=${page * limit}`
      );
      setPayments(response.data.documents);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching payments:', error);
      setError('Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(payment => {
    if (filter !== 'all' && payment.source !== filter) return false;
    if (statusFilter !== 'all' && payment.status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(total / limit);

  const formatCurrency = (amount: number, currency: string = 'AUD') => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'square':
        return 'bg-blue-100 text-blue-800';
      case 'stripe':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && payments.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">Loading payments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8 text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Payments</h1>
          <SimpleDatabaseSelector className="w-64" />
        </div>
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Collections
        </Link>
      </div>

      <div className="mb-4 flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Source</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Sources</option>
            <option value="square">Square</option>
            <option value="stripe">Stripe</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Card</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredPayments.map((payment) => (
              <tr key={payment._id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  {formatDate(payment.timestamp)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono">
                  {payment.transactionId}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <div>
                    <div className="font-medium">{payment.customerName || 'N/A'}</div>
                    {payment.customerEmail && (
                      <div className="text-gray-500 text-xs">{payment.customerEmail}</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  {formatCurrency(payment.grossAmount, payment.currency)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatCurrency(payment.feeAmount, payment.currency)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                    {payment.status}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSourceColor(payment.source)}`}>
                    {payment.source}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  {payment.cardBrand && payment.cardLast4 && (
                    <span className="text-gray-600">
                      {payment.cardBrand} ****{payment.cardLast4}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <Link
                    href={`/collections/payments/documents/${payment._id}`}
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm text-gray-700">
          Showing {filteredPayments.length} of {total} payments
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300"
          >
            Previous
          </button>
          <span className="px-4 py-2">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}