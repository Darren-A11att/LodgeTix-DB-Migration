'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import apiService from '@/lib/api';

declare global {
  interface Window {
    matchDetailsLogged?: boolean;
  }
}

interface InvoiceMatch {
  payment: any;
  registration: any;
  invoice: any;
  matchConfidence: number;
  matchDetails?: any[];
}

interface MatchesResponse {
  matches: InvoiceMatch[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Helper to convert MongoDB Decimal128 to number
const toNumber = (value: number | { $numberDecimal: string } | undefined): number => {
  if (value === undefined) return 0;
  return typeof value === 'object' && value.$numberDecimal 
    ? parseFloat(value.$numberDecimal)
    : value;
};

export default function InvoicesListPage() {
  const [matches, setMatches] = useState<InvoiceMatch[]>([]);
  const [processedInvoices, setProcessedInvoices] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'processed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filterConfidence, setFilterConfidence] = useState<number>(0);
  const [showProcessedOnly, setShowProcessedOnly] = useState(false);
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const router = useRouter();
  const limit = 50;

  useEffect(() => {
    if (viewMode === 'all') {
      fetchAllMatches();
    } else {
      fetchProcessedInvoices();
    }
  }, [currentPage, viewMode]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const data = await apiService.getInvoiceMatches(limit, currentPage * limit);
      setMatches(data.matches);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to find email in payment object
  const findEmailInPayment = (payment: any): string | null => {
    if (!payment) return null;
    
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
    const searchObject = (obj: any, depth: number = 0): string | null => {
      // Limit depth to prevent infinite recursion
      if (depth > 3) return null;
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          
          // Check if the key contains 'email' (case insensitive)
          if (key.toLowerCase().includes('email') && typeof value === 'string' && value.includes('@')) {
            return value;
          }
          
          // Recursively search nested objects (like originalData)
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const found = searchObject(value, depth + 1);
            if (found) return found;
          }
        }
      }
      return null;
    };
    
    return searchObject(payment);
  };

  const fetchAllMatches = async () => {
    try {
      setLoading(true);
      // Fetch all payments with their match information
      const skip = currentPage * limit;
      const paymentsData = await apiService.getDocuments('payments', skip, limit);
      const payments = paymentsData.documents || [];
      
      // Debug: Log first few payments to see structure
      console.log(`Found ${payments.length} payments`);
      payments.slice(0, 3).forEach((payment, index) => {
        console.log(`Payment ${index}:`, {
          _id: payment._id,
          transactionId: payment.transactionId,
          paymentId: payment.paymentId,
          customerEmail: payment.customerEmail,
          'Customer Email': payment['Customer Email'],
          amount: payment.amount || payment.grossAmount,
          timestamp: payment.timestamp,
          source: payment.source,
          customerName: payment.customerName,
          hasOriginalData: !!payment.originalData,
          originalDataCustomerEmail: payment.originalData?.['Customer Email'],
          allTopLevelKeys: Object.keys(payment).sort()
        });
      });
      
      // For each payment, get its registration match
      const matchesWithStatus = await Promise.all(payments.map(async (payment: any) => {
        // Find email using partial match
        const paymentEmail = findEmailInPayment(payment);
        
        // Try to find a registration match
        const registrationQuery = {
          $or: [
            { stripePaymentIntentId: payment.transactionId },
            { confirmationNumber: payment.transactionId },
            { 'paymentInfo.transactionId': payment.transactionId },
            ...(paymentEmail ? [
              { customerEmail: paymentEmail },
              { email: paymentEmail }
            ] : [])
          ]
        };
        
        let registration = null;
        let matchConfidence = 0;
        
        try {
          const regData = await apiService.searchDocuments('registrations', registrationQuery);
          if (regData.documents && regData.documents.length > 0) {
            registration = regData.documents[0];
            // Simple confidence calculation
            if (payment.transactionId && registration.stripePaymentIntentId === payment.transactionId) {
              matchConfidence = 100;
            } else if (paymentEmail && (registration.customerEmail === paymentEmail || registration.email === paymentEmail)) {
              matchConfidence = 80;
            } else {
              matchConfidence = 50;
            }
          }
        } catch (err) {
          console.error('Error fetching registration:', err);
        }
        
        // Determine payment status
        const getPaymentStatus = () => {
          if (payment.status) return payment.status;
          if (payment.refunded || payment.isRefunded) return 'refunded';
          if (payment.declined || payment.isDeclined) return 'declined';
          if (payment.paid || payment.isPaid || payment.captured) return 'paid';
          if (payment.pending || payment.isPending) return 'pending';
          if (payment.failed || payment.isFailed) return 'failed';
          // Default to paid if we have an amount
          if (payment.amount || payment.grossAmount) return 'paid';
          return 'unknown';
        };
        
        return {
          payment: {
            ...payment,
            customerEmail: paymentEmail, // Use the found email
            invoiceCreated: payment.invoiceCreated || false,
            invoiceDeclined: payment.invoiceDeclined || false,
            invoiceNumber: payment.invoiceNumber || null,
            paymentStatus: getPaymentStatus()
          },
          registration,
          invoice: null,
          matchConfidence,
          isProcessed: payment.invoiceCreated || false,
          isDeclined: payment.invoiceDeclined || false
        };
      }));
      
      setMatches(matchesWithStatus);
      setTotal(paymentsData.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load all payments');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProcessedInvoices = async () => {
    try {
      setLoading(true);
      // Fetch from the invoices collection using the documents API
      const skip = currentPage * limit;
      const data = await apiService.getDocuments('invoices', skip, limit);
      setProcessedInvoices(data.documents || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load processed invoices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchClick = (index: number) => {
    // Navigate to the matches page with the specific payment ID
    const match = matches[index];
    if (match && match.payment && match.payment._id) {
      router.push(`/invoices/matches?paymentId=${match.payment._id}`);
    } else {
      // Fallback to index-based navigation
      router.push(`/invoices/matches?index=${currentPage * limit + index}`);
    }
  };

  const getMatchMethodDisplay = (match: InvoiceMatch) => {
    // Debug log to see what we're getting
    if (matches.length > 0 && !window.matchDetailsLogged) {
      console.log('Sample match object:', matches[0]);
      window.matchDetailsLogged = true;
    }
    
    if (!match.matchDetails || !Array.isArray(match.matchDetails) || match.matchDetails.length === 0) {
      return 'No Match';
    }
    
    // Find the highest weighted match type
    const sortedDetails = [...match.matchDetails].sort((a, b) => b.weight - a.weight);
    const primaryMatch = sortedDetails[0];
    
    // Create display based on value type
    const typeDisplayMap = {
      'paymentId': 'Payment ID',
      'registrationId': 'Registration ID',
      'confirmationNumber': 'Confirmation Number',
      'email': 'Email',
      'amount': 'Amount',
      'accountId': 'Account ID',
      'name': 'Name',
      'address': 'Address',
      'timestamp': 'Timestamp'
    };
    
    const primaryType = typeDisplayMap[primaryMatch.valueType] || primaryMatch.valueType;
    const matchCount = match.matchDetails.length;
    
    if (matchCount > 1) {
      return `${primaryType} +${matchCount - 1} more`;
    }
    return primaryType;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'bg-green-100 text-green-800'; // Payment ID or Confirmation matches
    if (confidence >= 50) return 'bg-yellow-100 text-yellow-800'; // Needs review
    if (confidence >= 30) return 'bg-orange-100 text-orange-800'; // Email match - manual review required
    return 'bg-red-100 text-red-800'; // No match or very low confidence
  };

  const getPaymentStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case 'paid':
      case 'captured':
      case 'succeeded':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'declined':
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
      case 'refund':
        return 'bg-purple-100 text-purple-800';
      case 'cancelled':
      case 'canceled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const totalPages = Math.ceil(total / limit);
  const filteredMatches = matches
    .filter(m => {
      // Apply invoice status filter
      if (showProcessedOnly) return m.isProcessed;
      if (filterConfidence === -1) return !m.isProcessed && !m.isDeclined;
      if (filterConfidence > 0) return m.matchConfidence >= filterConfidence;
      
      // Apply payment status filter
      if (filterPaymentStatus !== 'all') {
        if (filterPaymentStatus === 'paid') return m.payment.paymentStatus === 'paid';
        if (filterPaymentStatus === 'refunded') return m.payment.paymentStatus === 'refunded';
        if (filterPaymentStatus === 'declined') return m.payment.paymentStatus === 'declined' || m.payment.paymentStatus === 'failed';
        if (filterPaymentStatus === 'pending') return m.payment.paymentStatus === 'pending';
      }
      
      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === 'date') {
        aValue = new Date(a.payment.timestamp || a.payment.createdAt).getTime();
        bValue = new Date(b.payment.timestamp || b.payment.createdAt).getTime();
      } else if (sortBy === 'amount') {
        aValue = toNumber(a.payment.amount || a.payment.grossAmount || 0);
        bValue = toNumber(b.payment.amount || b.payment.grossAmount || 0);
      }
      
      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading invoice matches...</div>
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

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          {viewMode === 'all' ? 'All Payment Matches' : 'Processed Invoices'}
        </h1>
        <div className="flex gap-4">
          <div className="bg-white rounded-lg shadow px-1 py-1 flex">
            <button
              onClick={() => {
                setViewMode('all');
                setCurrentPage(0);
              }}
              className={`px-4 py-2 rounded ${
                viewMode === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              All Payments
            </button>
            <button
              onClick={() => {
                setViewMode('processed');
                setCurrentPage(0);
              }}
              className={`px-4 py-2 rounded ${
                viewMode === 'processed' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Invoices Only
            </button>
          </div>
          <Link 
            href="/invoices/matches"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Process Matches →
          </Link>
        </div>
      </div>

      {viewMode === 'all' ? (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-800">{total}</div>
              <div className="text-sm text-gray-600">Total Payments</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {matches.filter(m => m.payment.paymentStatus === 'paid').length}
              </div>
              <div className="text-sm text-gray-600">Paid</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {matches.filter(m => m.payment.paymentStatus === 'refunded').length}
              </div>
              <div className="text-sm text-gray-600">Refunded</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {matches.filter(m => m.payment.paymentStatus === 'declined' || m.payment.paymentStatus === 'failed').length}
              </div>
              <div className="text-sm text-gray-600">Declined/Failed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {matches.filter(m => m.payment.paymentStatus === 'pending').length}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center mt-4 pt-4 border-t">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {matches.filter(m => m.isProcessed).length}
              </div>
              <div className="text-sm text-gray-600">Invoices Created</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {matches.filter(m => !m.isProcessed && !m.isDeclined).length}
              </div>
              <div className="text-sm text-gray-600">Awaiting Invoice</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {matches.filter(m => m.matchConfidence >= 80).length}
              </div>
              <div className="text-sm text-gray-600">Good Matches (80%+)</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-800">{total}</div>
              <div className="text-sm text-gray-600">Total Processed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {processedInvoices.filter(inv => inv.invoiceType === 'customer').length}
              </div>
              <div className="text-sm text-gray-600">Customer Invoices</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {processedInvoices.filter(inv => inv.invoiceType === 'supplier').length}
              </div>
              <div className="text-sm text-gray-600">Supplier Invoices</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                ${processedInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Total Value</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      {viewMode === 'all' && (
        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">
              Show:
            </label>
            <select
              value={showProcessedOnly ? 'processed' : filterConfidence > 0 ? filterConfidence : 'all'}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'all') {
                  setShowProcessedOnly(false);
                  setFilterConfidence(0);
                } else if (value === 'processed') {
                  setShowProcessedOnly(true);
                  setFilterConfidence(0);
                } else if (value === 'unprocessed') {
                  setShowProcessedOnly(false);
                  setFilterConfidence(-1); // Special value for unprocessed only
                } else {
                  setShowProcessedOnly(false);
                  setFilterConfidence(Number(value));
                }
              }}
              className="border rounded px-3 py-1 text-sm"
            >
              <option value="all">All Payments</option>
              <option value="unprocessed">Unprocessed Only</option>
              <option value="processed">Processed Only</option>
              <option value={50}>Confidence 50%+</option>
              <option value={70}>Confidence 70%+</option>
              <option value={90}>Confidence 90%+</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">
              Payment Status:
            </label>
            <select
              value={filterPaymentStatus}
              onChange={(e) => setFilterPaymentStatus(e.target.value)}
              className="border rounded px-3 py-1 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid Only</option>
              <option value="refunded">Refunded Only</option>
              <option value="declined">Declined/Failed</option>
              <option value="pending">Pending Only</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">
              Sort by:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
              className="border rounded px-3 py-1 text-sm"
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50 flex items-center gap-1"
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
              {sortBy === 'date' 
                ? (sortOrder === 'desc' ? 'Newest' : 'Oldest')
                : (sortOrder === 'desc' ? 'Highest' : 'Lowest')
              }
            </button>
          </div>
          
          <span className="text-sm text-gray-600">
            Showing {filteredMatches.length} of {matches.length} payments
          </span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {viewMode === 'all' ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Match Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMatches.map((match, index) => (
                <tr 
                  key={match.payment._id || index} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    const actualIndex = matches.findIndex(m => m.payment._id === match.payment._id);
                    handleMatchClick(actualIndex);
                  }}
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 break-all">
                      {match.payment.transactionId || match.payment.paymentId || match.payment._id || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500 break-words">
                      {match.payment.customerEmail || findEmailInPayment(match.payment) || 'No email'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(match.payment.timestamp || match.payment.createdAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(match.payment.timestamp || match.payment.createdAt).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {match.registration ? (
                      <>
                        <div className="text-sm font-medium text-gray-900 break-words">
                          {match.registration.confirmationNumber || 'No confirmation #'}
                        </div>
                        <div className="text-sm text-gray-500 break-words max-w-xs">
                          {match.registration.primaryAttendee || match.registration.customerName || 'Unknown'}
                        </div>
                      </>
                    ) : (
                      <span className="text-sm text-red-600">No match found</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      ${toNumber(match.payment.amount || match.payment.grossAmount || 0)}
                    </div>
                    {match.registration && (
                      <div className="text-sm text-gray-500">
                        ${toNumber(match.registration.totalAmountPaid || match.registration.totalAmount)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {getMatchMethodDisplay(match)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getConfidenceColor(match.matchConfidence)}`}>
                      {match.matchConfidence}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getPaymentStatusColor(match.payment.paymentStatus || 'unknown')}`}>
                      {match.payment.paymentStatus || 'unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {match.isProcessed ? (
                      <div>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Processed
                        </span>
                        {match.payment.invoiceNumber && (
                          <div className="text-xs text-gray-600 mt-1">
                            Invoice: {match.payment.invoiceNumber}
                          </div>
                        )}
                      </div>
                    ) : match.isDeclined ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        Declined
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        Unprocessed
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Find the actual index in the full matches array
                        const actualIndex = matches.findIndex(m => m.payment._id === match.payment._id);
                        handleMatchClick(actualIndex);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      {match.isProcessed ? 'Reprocess →' : 'Process →'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processedInvoices.map((invoice, index) => (
                <tr 
                  key={invoice._id || index} 
                  className="hover:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {invoice.invoiceNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      invoice.invoiceType === 'customer' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {invoice.invoiceType === 'customer' ? 'Customer' : 'Supplier'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {invoice.billTo?.businessName || 
                       `${invoice.billTo?.firstName || ''} ${invoice.billTo?.lastName || ''}`.trim() || 
                       'Unknown'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {invoice.billTo?.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(invoice.date || invoice.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      ${toNumber(invoice.total)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                      Processed
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {
                        // TODO: Implement view/download invoice
                        console.log('View invoice:', invoice);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button 
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            Previous
          </button>
          <span className="text-gray-700">
            Page {currentPage + 1} of {totalPages} | Total: {total} matches
          </span>
          <button 
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}