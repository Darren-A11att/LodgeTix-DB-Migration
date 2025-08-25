'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

interface TicketRow {
  ticketNumber: string;
  price: number;
  quantity: number;
  status: string;
  attendeeId: string | null;
  customerName: string | null;
  businessName: string | null;
  registrationId: string | null;
  paymentId: string | null;
  createdAt: string;
}

interface EventTicketDetails {
  eventTicket: {
    eventTicketId: string;
    name: string;
    description: string;
    price: number;
  };
  tickets: TicketRow[];
  summary: {
    totalTickets: number;
    totalQuantity: number;
    totalRevenue: number;
    byStatus: {
      active: number;
      cancelled: number;
      other: number;
    };
    byPaymentStatus: {
      paid: number;
      pending: number;
      failed: number;
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
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'quantity'>('date');
  const [filterStatus, setFilterStatus] = useState<string>('all');

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

    const headers = ['Ticket Number', 'Status', 'Price', 'Quantity', 'Customer Name', 'Business Name', 'Attendee ID', 'Registration ID', 'Payment ID', 'Date'];
    const rows = details.tickets.map(ticket => [
      ticket.ticketNumber || '',
      ticket.status || '',
      ticket.price.toFixed(2),
      ticket.quantity,
      ticket.customerName || '',
      ticket.businessName || '',
      ticket.attendeeId || '',
      ticket.registrationId || '',
      ticket.paymentId || '',
      formatDate(ticket.createdAt)
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-ticket-${eventTicketId}-tickets.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8">Loading details...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!details) return <div className="p-8">No data available</div>;

  // Filter and sort tickets
  let filteredTickets = [...details.tickets];
  if (filterStatus !== 'all') {
    filteredTickets = filteredTickets.filter(ticket => 
      filterStatus === 'other' 
        ? !['active', 'cancelled'].includes(ticket.status)
        : ticket.status === filterStatus
    );
  }

  // Sort tickets
  filteredTickets.sort((a, b) => {
    switch (sortBy) {
      case 'status':
        return a.status.localeCompare(b.status);
      case 'quantity':
        return b.quantity - a.quantity;
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
          <p className="text-sm text-gray-600 mb-1">Total Tickets</p>
          <p className="text-3xl font-bold">{details.summary.totalTickets}</p>
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Active:</span>
              <span className="font-medium">{details.summary.byStatus.active}</span>
            </div>
            <div className="flex justify-between">
              <span>Cancelled:</span>
              <span className="font-medium">{details.summary.byStatus.cancelled}</span>
            </div>
            {details.summary.byStatus.other > 0 && (
              <div className="flex justify-between">
                <span>Other:</span>
                <span className="font-medium">{details.summary.byStatus.other}</span>
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
            <label className="text-sm font-medium mr-2">Filter by Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border rounded px-3 py-1"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
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
              <option value="status">Status</option>
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

      {/* Tickets Table */}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Ticket Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Quantity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Customer Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Business Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Attendee ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Registration ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Payment ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTickets.map((ticket, index) => (
              <tr key={ticket.ticketNumber || index} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono">
                  {ticket.ticketNumber || '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    ticket.status === 'active' ? 'bg-green-100 text-green-800' :
                    ticket.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {ticket.status || 'unknown'}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-right">
                  {formatCurrency(ticket.price)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium">
                  {ticket.quantity}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  {ticket.customerName || '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  {ticket.businessName || '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono">
                  {ticket.attendeeId || '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono">
                  {ticket.registrationId || '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono">
                  {ticket.paymentId || '-'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(ticket.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}