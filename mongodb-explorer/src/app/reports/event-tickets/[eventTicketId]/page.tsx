'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

interface Registration {
  registrationId: string;
  confirmationNumber: string;
  registrationType: string;
  bookingContact: {
    firstName: string;
    lastName: string;
    email: string;
  };
  paymentId?: string;
  createdAt: string;
  ticketQuantity: number;
  ticketRevenue: number;
}

interface EventTicketDetails {
  eventTicket: {
    eventTicketId: string;
    name: string;
    description: string;
    price: number;
  };
  registrations: Registration[];
  summary: {
    totalRegistrations: number;
    totalQuantity: number;
    totalRevenue: number;
    byType: {
      individuals: number;
      lodges: number;
      delegations: number;
      other: number;
    };
  };
}

export default function EventTicketDetailsPage() {
  const params = useParams();
  const eventTicketId = params.eventTicketId as string;
  const [details, setDetails] = useState<EventTicketDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'type' | 'quantity'>('date');
  const [filterType, setFilterType] = useState<string>('all');

  // Format currency
  const formatCurrency = (num: number) => {
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/reports/event-tickets/${eventTicketId}`);
      if (!response.ok) throw new Error('Failed to fetch details');
      
      const data = await response.json();
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [eventTicketId]);

  const downloadCSV = () => {
    if (!details) return;

    const headers = ['Registration ID', 'Payment ID', 'Type', 'Booking Contact', 'Email', 'Date', 'Quantity', 'Revenue'];
    const rows = details.registrations.map(reg => [
      reg.registrationId,
      reg.paymentId || '',
      reg.registrationType,
      `${reg.bookingContact.firstName} ${reg.bookingContact.lastName}`,
      reg.bookingContact.email,
      formatDate(reg.createdAt),
      reg.ticketQuantity,
      reg.ticketRevenue.toFixed(2)
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-ticket-${eventTicketId}-registrations.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8">Loading details...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!details) return <div className="p-8">No data available</div>;

  // Filter and sort registrations
  let filteredRegistrations = [...details.registrations];
  if (filterType !== 'all') {
    filteredRegistrations = filteredRegistrations.filter(reg => 
      filterType === 'other' 
        ? !['individuals', 'lodges', 'delegations'].includes(reg.registrationType)
        : reg.registrationType === filterType
    );
  }

  // Sort registrations
  filteredRegistrations.sort((a, b) => {
    switch (sortBy) {
      case 'type':
        return a.registrationType.localeCompare(b.registrationType);
      case 'quantity':
        return b.ticketQuantity - a.ticketQuantity;
      case 'date':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  return (
    <main className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/reports/event-tickets" className="text-blue-500 hover:underline">
          ← Back to Event Tickets Report
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{details.eventTicket.name}</h1>
            <p className="text-gray-600">{details.eventTicket.description || 'Event ticket registrations details'}</p>
            <p className="text-sm text-gray-500 mt-2">Ticket ID: {eventTicketId}</p>
          </div>
          <div className="flex flex-col items-end">
            <label className="text-sm font-medium text-gray-700 mb-1">Database</label>
            <SimpleDatabaseSelector className="w-48" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border rounded-lg p-6">
          <p className="text-sm text-gray-600 mb-1">Total Registrations</p>
          <p className="text-3xl font-bold">{details.summary.totalRegistrations}</p>
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Individuals:</span>
              <span className="font-medium">{details.summary.byType.individuals}</span>
            </div>
            <div className="flex justify-between">
              <span>Lodges:</span>
              <span className="font-medium">{details.summary.byType.lodges}</span>
            </div>
            <div className="flex justify-between">
              <span>Delegations:</span>
              <span className="font-medium">{details.summary.byType.delegations}</span>
            </div>
            {details.summary.byType.other > 0 && (
              <div className="flex justify-between">
                <span>Other:</span>
                <span className="font-medium">{details.summary.byType.other}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white border rounded-lg p-6">
          <p className="text-sm text-gray-600 mb-1">Total Quantity</p>
          <p className="text-3xl font-bold">{details.summary.totalQuantity}</p>
          <p className="text-xs text-gray-500 mt-1">tickets sold</p>
        </div>
        
        <div className="bg-white border rounded-lg p-6">
          <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(details.summary.totalRevenue)}</p>
          <p className="text-xs text-gray-500 mt-1">from this ticket type</p>
        </div>
        
        <div className="bg-white border rounded-lg p-6">
          <p className="text-sm text-gray-600 mb-1">Base Price</p>
          <p className="text-3xl font-bold">{formatCurrency(details.eventTicket.price)}</p>
          <p className="text-xs text-gray-500 mt-1">per ticket</p>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="text-sm font-medium mr-2">Filter by Type:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border rounded px-3 py-1"
            >
              <option value="all">All Types</option>
              <option value="individuals">Individuals</option>
              <option value="lodges">Lodges</option>
              <option value="delegations">Delegations</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium mr-2">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border rounded px-3 py-1"
            >
              <option value="date">Date (newest first)</option>
              <option value="type">Registration Type</option>
              <option value="quantity">Quantity</option>
            </select>
          </div>
          
          <div className="ml-auto">
            <button
              onClick={downloadCSV}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Registrations Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registration ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Booking Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Revenue
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRegistrations.map((reg) => (
              <tr key={reg.registrationId} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                  {reg.confirmationNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {reg.paymentId || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    reg.registrationType === 'individuals' ? 'bg-blue-100 text-blue-800' :
                    reg.registrationType === 'lodges' ? 'bg-purple-100 text-purple-800' :
                    reg.registrationType === 'delegations' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {reg.registrationType}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {reg.bookingContact.firstName} {reg.bookingContact.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{reg.bookingContact.email}</p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(reg.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                  {reg.ticketQuantity}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                  {formatCurrency(reg.ticketRevenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}