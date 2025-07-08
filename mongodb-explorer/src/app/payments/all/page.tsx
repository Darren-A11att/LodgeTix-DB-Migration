'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import apiService from '@/lib/api';

export default function AllPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterStatus, setFilterStatus] = useState<'all' | 'processed' | 'unprocessed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const limit = 50;

  useEffect(() => {
    fetchPayments();
  }, [currentPage, searchQuery]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const skip = currentPage * limit;
      
      if (searchQuery) {
        // Use search endpoint
        const response = await fetch(`/api/payments/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        setPayments(data.payments || []);
        setTotal(data.totalFound || 0);
      } else {
        // Get all payments
        const data = await apiService.getDocuments('payments', skip, limit);
        const processedPayments = data.documents.map((p: any) => {
          // Helper to find email in payment object
          const findEmail = (payment: any): string | null => {
            // Priority 1: Check customerEmail field
            if (payment.customerEmail && payment.customerEmail.includes('@')) {
              return payment.customerEmail;
            }
            
            // Priority 2: Check "Customer Email" field (with space)
            if (payment['Customer Email'] && payment['Customer Email'].includes('@')) {
              return payment['Customer Email'];
            }
            
            // Priority 3: Check common email field variations
            if (payment.email && payment.email.includes('@')) return payment.email;
            if (payment.customer?.email && payment.customer.email.includes('@')) return payment.customer.email;
            
            // Priority 4: Search for any field containing 'email' in its name
            const searchObj = (obj: any, depth: number = 0): string | null => {
              if (depth > 3) return null;
              
              for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                  const value = obj[key];
                  if (key.toLowerCase().includes('email') && typeof value === 'string' && value.includes('@')) {
                    return value;
                  }
                  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    const found = searchObj(value, depth + 1);
                    if (found) return found;
                  }
                }
              }
              return null;
            };
            
            return searchObj(payment);
          };
          
          return {
            id: p._id,
            transactionId: p.transactionId || p.paymentId,
            amount: p.amount || p.grossAmount,
            date: p.timestamp || p.createdAt,
            customerEmail: findEmail(p),
            customerName: p.customerName || p.customer?.name,
            invoiceCreated: p.invoiceCreated || false,
            invoiceDeclined: p.invoiceDeclined || false,
            invoiceNumber: p.invoiceNumber || null,
            status: p.invoiceCreated ? 'Processed' : p.invoiceDeclined ? 'Declined' : 'Unprocessed'
          };
        });
        setPayments(processedPayments);
        setTotal(data.total || 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(p => {
    if (filterStatus === 'processed') return p.invoiceCreated;
    if (filterStatus === 'unprocessed') return !p.invoiceCreated && !p.invoiceDeclined;
    return true;
  });

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading payments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="text-blue-500 hover:underline">
          ← Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-800 mb-8">All Payments</h1>

      {/* Search and Filter */}
      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Search by email, name, or transaction ID..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(0);
          }}
          className="flex-1 px-4 py-2 border rounded-lg"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">All Payments</option>
          <option value="processed">Processed Only</option>
          <option value="unprocessed">Unprocessed Only</option>
        </select>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-800">{total}</div>
            <div className="text-sm text-gray-600">Total Payments</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {payments.filter(p => p.invoiceCreated).length}
            </div>
            <div className="text-sm text-gray-600">Processed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">
              {payments.filter(p => !p.invoiceCreated && !p.invoiceDeclined).length}
            </div>
            <div className="text-sm text-gray-600">Unprocessed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {payments.filter(p => p.invoiceDeclined).length}
            </div>
            <div className="text-sm text-gray-600">Declined</div>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transaction ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice #
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPayments.map((payment) => (
              <tr key={payment.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {payment.transactionId}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{payment.customerName || 'Unknown'}</div>
                  <div className="text-sm text-gray-500">{payment.customerEmail}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    ${payment.amount || 0}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {new Date(payment.date).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    payment.status === 'Processed' ? 'bg-green-100 text-green-800' :
                    payment.status === 'Declined' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {payment.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {payment.invoiceNumber || '-'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button 
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-300"
          >
            Previous
          </button>
          <span className="text-gray-700">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button 
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-300"
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}