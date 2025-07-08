'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface ReconciliationData {
  ticketCounts: {
    fromRegistrations: number;
    fromTickets: number;
    fromPayments: number;
    discrepancies: any[];
  };
  paymentStatus: {
    totalRegistrations: number;
    registrationsWithPayments: number;
    registrationsWithoutPayments: number;
    paymentsWithoutRegistrations: number;
    totalPaymentAmount: number;
    totalRegistrationAmount: number;
  };
  dataQuality: {
    duplicateRegistrations: number;
    missingAttendeeInfo: number;
    invalidEmails: number;
    missingLodgeInfo: number;
  };
}

export default function ReconciliationDashboard() {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReconciliationData();
  }, []);

  const fetchReconciliationData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3006/api/reconciliation');
      setData(response.data);
    } catch (error) {
      console.error('Error fetching reconciliation data:', error);
      setError('Failed to fetch reconciliation data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">Analyzing data inconsistencies...</div>
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

  if (!data) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Data Reconciliation Dashboard</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Collections
        </Link>
      </div>

      {/* Ticket Count Reconciliation */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Ticket Count Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-600">From Registrations</h3>
            <p className="text-3xl font-bold text-blue-600">{data.ticketCounts.fromRegistrations}</p>
            <p className="text-sm text-gray-500">Sum of attendeeCount</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-600">From Tickets Collection</h3>
            <p className="text-3xl font-bold text-green-600">{data.ticketCounts.fromTickets}</p>
            <p className="text-sm text-gray-500">Individual ticket records</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-600">From Payments</h3>
            <p className="text-3xl font-bold text-purple-600">{data.ticketCounts.fromPayments}</p>
            <p className="text-sm text-gray-500">Payment metadata</p>
          </div>
        </div>
        
        {data.ticketCounts.discrepancies.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
            <h4 className="font-medium text-red-800">Discrepancies Found:</h4>
            <ul className="mt-2 text-sm text-red-700">
              {data.ticketCounts.discrepancies.map((disc, idx) => (
                <li key={idx}>• {disc}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Payment Status */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Payment Reconciliation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-4">Registration Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Registrations:</span>
                <span className="font-semibold">{data.paymentStatus.totalRegistrations}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">With Payments:</span>
                <span className="font-semibold text-green-600">{data.paymentStatus.registrationsWithPayments}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Without Payments:</span>
                <span className="font-semibold text-red-600">{data.paymentStatus.registrationsWithoutPayments}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Orphaned Payments:</span>
                <span className="font-semibold text-orange-600">{data.paymentStatus.paymentsWithoutRegistrations}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-4">Financial Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Payment Amount:</span>
                <span className="font-semibold">{formatCurrency(data.paymentStatus.totalPaymentAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Registration Amount:</span>
                <span className="font-semibold">{formatCurrency(data.paymentStatus.totalRegistrationAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600">Difference:</span>
                <span className={`font-bold ${
                  Math.abs(data.paymentStatus.totalPaymentAmount - data.paymentStatus.totalRegistrationAmount) < 1 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {formatCurrency(data.paymentStatus.totalPaymentAmount - data.paymentStatus.totalRegistrationAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Quality Issues */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Data Quality Issues</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg ${data.dataQuality.duplicateRegistrations > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <h4 className="font-medium text-gray-700">Duplicate Registrations</h4>
            <p className={`text-2xl font-bold ${data.dataQuality.duplicateRegistrations > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.dataQuality.duplicateRegistrations}
            </p>
          </div>
          <div className={`p-4 rounded-lg ${data.dataQuality.missingAttendeeInfo > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <h4 className="font-medium text-gray-700">Missing Attendee Info</h4>
            <p className={`text-2xl font-bold ${data.dataQuality.missingAttendeeInfo > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.dataQuality.missingAttendeeInfo}
            </p>
          </div>
          <div className={`p-4 rounded-lg ${data.dataQuality.invalidEmails > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <h4 className="font-medium text-gray-700">Invalid Emails</h4>
            <p className={`text-2xl font-bold ${data.dataQuality.invalidEmails > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.dataQuality.invalidEmails}
            </p>
          </div>
          <div className={`p-4 rounded-lg ${data.dataQuality.missingLodgeInfo > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <h4 className="font-medium text-gray-700">Missing Lodge Info</h4>
            <p className={`text-2xl font-bold ${data.dataQuality.missingLodgeInfo > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.dataQuality.missingLodgeInfo}
            </p>
          </div>
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Next Steps</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Review registrations without payments</li>
          <li>Match orphaned payments to registrations</li>
          <li>Resolve duplicate registrations</li>
          <li>Fill in missing attendee information</li>
          <li>Validate and clean email addresses</li>
          <li>Create individual ticket records for each attendee</li>
        </ol>
        
        <div className="mt-4 flex gap-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Start Data Cleanup
          </button>
          <button className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
            Export Issues Report
          </button>
        </div>
      </div>
    </div>
  );
}