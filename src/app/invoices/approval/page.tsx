'use client';

import { useState, useEffect } from 'react';
import InvoiceComponent from '@/components/Invoice';

interface InvoicePreview {
  invoiceNumber: string;
  date: Date;
  status: string;
  supplier: any;
  billTo: any;
  items: any[];
  subtotal: number;
  processingFees: number;
  gstIncluded: number;
  total: number;
  payment?: any;
  paymentId?: string;
  registrationId?: string;
  matchDetails: {
    confidence: number;
    method: string;
    issues: string[];
  };
  paymentDetails: {
    source: string;
    originalPaymentId: string;
    timestamp: Date;
  };
  registrationDetails: {
    registrationId: string;
    confirmationNumber: string;
    functionName: string;
    attendeeCount: number;
  };
}

export default function InvoiceApprovalPage() {
  const [previews, setPreviews] = useState<InvoicePreview[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [statistics, setStatistics] = useState<any>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declineComments, setDeclineComments] = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [minConfidence, setMinConfidence] = useState(50);

  useEffect(() => {
    fetchPendingInvoices();
  }, [minConfidence]);

  const fetchPendingInvoices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/pending?minConfidence=${minConfidence}`);
      const data = await response.json();
      
      if (data.success) {
        setPreviews(data.data.previews);
        setStatistics(data.data.statistics);
      }
    } catch (error) {
      console.error('Error fetching pending invoices:', error);
      alert('Failed to fetch pending invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!currentPreview) return;
    
    try {
      setProcessing(true);
      const response = await fetch(`/api/invoices/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoicePreview: currentPreview,
          paymentId: currentPreview.paymentId,
          registrationId: currentPreview.registrationId,
          matchConfidence: currentPreview.matchDetails.confidence,
          matchMethod: currentPreview.matchDetails.method
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Invoice approved and created successfully!');
        // Remove from list and move to next
        const newPreviews = [...previews];
        newPreviews.splice(currentIndex, 1);
        setPreviews(newPreviews);
        if (currentIndex >= newPreviews.length && currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        }
      } else {
        alert(`Failed to approve invoice: ${data.error}`);
      }
    } catch (error) {
      console.error('Error approving invoice:', error);
      alert('Failed to approve invoice');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!currentPreview || !declineReason) {
      alert('Please provide a reason for declining');
      return;
    }
    
    try {
      setProcessing(true);
      const response = await fetch(`/api/invoices/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: currentPreview.paymentId,
          registrationId: currentPreview.registrationId,
          reason: declineReason,
          comments: declineComments,
          invoicePreview: currentPreview
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Invoice declined and logged');
        setShowDeclineModal(false);
        setDeclineReason('');
        setDeclineComments('');
        
        // Remove from list and move to next
        const newPreviews = [...previews];
        newPreviews.splice(currentIndex, 1);
        setPreviews(newPreviews);
        if (currentIndex >= newPreviews.length && currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        }
      } else {
        alert(`Failed to decline invoice: ${data.error}`);
      }
    } catch (error) {
      console.error('Error declining invoice:', error);
      alert('Failed to decline invoice');
    } finally {
      setProcessing(false);
    }
  };

  const currentPreview = previews[currentIndex];

  if (loading) {
    return <div className="p-8">Loading pending invoices...</div>;
  }

  if (previews.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Invoice Approval</h1>
        <p>No pending invoices to approve with confidence &gt;= {minConfidence}%</p>
        <div className="mt-4">
          <label className="block">
            Minimum Confidence Level:
            <select 
              value={minConfidence} 
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="ml-2 border rounded p-1"
            >
              <option value={0}>All matches</option>
              <option value={50}>50% and above</option>
              <option value={70}>70% and above</option>
              <option value={90}>90% and above</option>
            </select>
          </label>
        </div>
        {statistics && (
          <div className="mt-8 p-4 bg-gray-100 rounded">
            <h2 className="font-bold mb-2">Match Statistics</h2>
            <p>Total Payments: {statistics.total}</p>
            <p>Matched: {statistics.matched}</p>
            <p>Unmatched: {statistics.unmatched}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Invoice Approval</h1>
        <p className="text-gray-600">
          Reviewing {currentIndex + 1} of {previews.length} pending invoices
        </p>
        <p className="text-sm text-gray-500">
          Processing payments from earliest to latest to ensure proper invoice numbering
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left side - Invoice Preview */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Invoice Preview</h2>
          {currentPreview && (
            <InvoiceComponent 
              invoice={currentPreview as any} 
              className="shadow-lg"
            />
          )}
        </div>

        {/* Right side - Match Details and Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Match Details</h2>
          
          {currentPreview && (
            <div className="space-y-4">
              {/* Match Confidence */}
              <div className="p-4 bg-gray-50 rounded">
                <h3 className="font-semibold mb-2">Match Confidence</h3>
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold">
                    {currentPreview.matchDetails.confidence}%
                  </div>
                  <div className={`px-3 py-1 rounded text-sm ${
                    currentPreview.matchDetails.confidence >= 90 ? 'bg-green-100 text-green-800' :
                    currentPreview.matchDetails.confidence >= 70 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {currentPreview.matchDetails.method}
                  </div>
                </div>
                {currentPreview.matchDetails.issues.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-red-600">Issues:</p>
                    <ul className="text-sm text-red-600">
                      {currentPreview.matchDetails.issues.map((issue, i) => (
                        <li key={i}>• {issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Payment Details */}
              <div className="p-4 bg-gray-50 rounded">
                <h3 className="font-semibold mb-2">Payment Details</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="font-medium">Source:</dt>
                  <dd>{currentPreview.paymentDetails.source}</dd>
                  <dt className="font-medium">Payment ID:</dt>
                  <dd className="font-mono text-xs">{currentPreview.paymentDetails.originalPaymentId}</dd>
                  <dt className="font-medium">Payment Date:</dt>
                  <dd className="font-semibold text-blue-600">
                    {new Date(currentPreview.paymentDetails.timestamp).toLocaleDateString('en-AU', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </dd>
                  <dt className="font-medium">Time:</dt>
                  <dd>{new Date(currentPreview.paymentDetails.timestamp).toLocaleTimeString()}</dd>
                </dl>
              </div>

              {/* Registration Details */}
              <div className="p-4 bg-gray-50 rounded">
                <h3 className="font-semibold mb-2">Registration Details</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="font-medium">Confirmation:</dt>
                  <dd>{currentPreview.registrationDetails.confirmationNumber}</dd>
                  <dt className="font-medium">Function:</dt>
                  <dd>{currentPreview.registrationDetails.functionName}</dd>
                  <dt className="font-medium">Attendees:</dt>
                  <dd>{currentPreview.registrationDetails.attendeeCount}</dd>
                </dl>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Approve & Create Invoice
                </button>
                <button
                  onClick={() => setShowDeclineModal(true)}
                  disabled={processing}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentIndex(Math.min(previews.length - 1, currentIndex + 1))}
                  disabled={currentIndex === previews.length - 1}
                  className="px-4 py-2 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Decline Invoice</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Reason for declining *
                </label>
                <select 
                  value={declineReason} 
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="w-full border rounded p-2"
                >
                  <option value="">Select a reason</option>
                  <option value="no_match">No matching registration</option>
                  <option value="amount_mismatch">Amount mismatch</option>
                  <option value="duplicate">Duplicate invoice</option>
                  <option value="data_quality">Poor data quality</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Additional comments
                </label>
                <textarea 
                  value={declineComments} 
                  onChange={(e) => setDeclineComments(e.target.value)}
                  className="w-full border rounded p-2"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDecline}
                  disabled={!declineReason || processing}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm Decline
                </button>
                <button
                  onClick={() => {
                    setShowDeclineModal(false);
                    setDeclineReason('');
                    setDeclineComments('');
                  }}
                  className="flex-1 border px-4 py-2 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}