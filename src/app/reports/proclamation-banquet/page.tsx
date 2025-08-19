'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

interface Registration {
  _id: string;
  registrationType?: string;
  confirmationNumber?: string;
  lodgeName?: string;
  attendeeCount?: number;
  tableCount?: number;
  packageId?: string;
  totalAmount?: number;
  createdAt?: string;
  metadata?: any;
}

interface RegistrationResponse {
  documents: Registration[];
  total: number;
  totalAttendees: number;
}

export default function ProclamationBanquetReport() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [totalAttendees, setTotalAttendees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      // First, let's fetch from the registrations collection
      const response = await axios.get(
        `http://localhost:3006/api/reports/proclamation-banquet`
      );
      
      setRegistrations(response.data.registrations);
      setTotalAttendees(response.data.totalAttendees);
    } catch (error) {
      console.error('Error fetching registrations:', error);
      setError('Failed to fetch registration data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">Loading proclamation banquet data...</div>
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
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Proclamation Banquet Sales Report</h1>
            <p className="text-gray-600 mb-4">Specific report for Grand Proclamation banquet sales and attendee analysis</p>
            <Link href="/reports" className="text-blue-600 hover:underline">
              ← Back to Reports
            </Link>
          </div>
          <div className="flex flex-col items-end">
            <label className="text-sm font-medium text-gray-700 mb-1">Database</label>
            <SimpleDatabaseSelector className="w-48" />
          </div>
        </div>
      </div>

      <div className="bg-blue-100 border-l-4 border-blue-500 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold">Total Attendees (Lodge Registrations)</p>
            <p className="text-3xl font-bold text-blue-700">{totalAttendees}</p>
          </div>
          <div>
            <p className="text-lg font-semibold">Total Lodge Registrations</p>
            <p className="text-3xl font-bold text-blue-700">{registrations.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registration ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confirmation #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lodge Name</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Attendee Count</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Table Count</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Package ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {registrations.map((registration) => (
              <tr key={registration._id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono">
                  <Link
                    href={`/collections/registrations/documents/${registration._id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {registration._id}
                  </Link>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                  {registration.confirmationNumber || 'N/A'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  {registration.lodgeName || 'N/A'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-center font-semibold">
                  {registration.attendeeCount || 0}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                  {registration.tableCount || 0}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  {registration.packageId || 'N/A'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(registration.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-right">
                Totals:
              </td>
              <td className="px-4 py-3 text-sm font-bold text-center">
                {totalAttendees}
              </td>
              <td className="px-4 py-3 text-sm font-bold text-center">
                {registrations.reduce((sum, reg) => sum + (reg.tableCount || 0), 0)}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <p>* This report shows only lodge registrations with registrationType = "lodge"</p>
        <p>* Individual registrations are not included in this count</p>
      </div>
    </div>
  );
}