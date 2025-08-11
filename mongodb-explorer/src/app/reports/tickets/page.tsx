'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import apiService from '@/lib/api';
import TicketEditModal from '@/components/TicketEditModal';
import OwnerEditModal from '@/components/OwnerEditModal';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

interface Ticket {
  ticketNumber: string;
  name: string;
  quantity: number;
  price: number;
  ownerType: string;
  ownerName: string;
  ownerId?: string;
  attendeeType: string;
  partnerOfName: string;
  lodgeNameNumber: string;
  confirmationNumber: string;
  invoiceNumber: string;
  paymentStatus: string;
  registrationId: string;
  registrationDate: string;
}

interface TicketsReportData {
  tickets: Ticket[];
  total: number;
  summary: {
    totalTickets: number;
    lodgeTickets: number;
    individualTickets: number;
    totalValue: number;
  };
}

export default function TicketsReportPage() {
  const [data, setData] = useState<TicketsReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownerTypeFilter, setOwnerTypeFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [selectedOwnerType, setSelectedOwnerType] = useState<'attendee' | 'lodge' | null>(null);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState('main');

  useEffect(() => {
    console.log('🎫 MongoDB Explorer: Tickets Report Page loaded');
    console.log('🎫 MongoDB Explorer: Running on port', window.location.port);
    fetchTicketsData();
  }, [selectedDatabase]);

  useEffect(() => {
    if (data) {
      filterTickets();
    }
  }, [data, ownerTypeFilter, searchFilter]);

  const fetchTicketsData = async () => {
    try {
      setLoading(true);
      console.log('🎫 MongoDB Explorer: Fetching tickets data from API...');
      const url = selectedDatabase === 'lodgetix' 
        ? '/reports/tickets?database=lodgetix'
        : '/reports/tickets';
      const result = await apiService.get(url);
      console.log('🎫 MongoDB Explorer: Received tickets data:', {
        totalTickets: result.tickets.length,
        summary: result.summary,
        database: selectedDatabase
      });
      setData(result);
      setFilteredTickets(result.tickets);
    } catch (err) {
      console.error('🎫 MongoDB Explorer: Error fetching tickets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tickets report');
    } finally {
      setLoading(false);
    }
  };

  const filterTickets = () => {
    if (!data) return;
    
    let filtered = data.tickets;
    
    if (ownerTypeFilter) {
      filtered = filtered.filter(t => t.ownerType === ownerTypeFilter);
    }
    
    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      filtered = filtered.filter(t => 
        (t.ticketNumber && t.ticketNumber.toLowerCase().includes(search)) ||
        (t.name && t.name.toLowerCase().includes(search)) ||
        (t.ownerName && t.ownerName.toLowerCase().includes(search)) ||
        (t.lodgeNameNumber && t.lodgeNameNumber.toLowerCase().includes(search)) ||
        (t.confirmationNumber && t.confirmationNumber.toLowerCase().includes(search)) ||
        (t.invoiceNumber && t.invoiceNumber.toLowerCase().includes(search))
      );
    }
    
    setFilteredTickets(filtered);
  };

  const exportToCSV = () => {
    const headers = ['Ticket Number', 'Name', 'Quantity', 'Price', 'Owner Type', 'Owner Name', 'Attendee Type', 'Partner Of', 'Lodge Name/Number', 'Confirmation Number', 'Invoice Number', 'Payment Status'];
    const csvContent = [
      headers.join(','),
      ...filteredTickets.map(t => [
        t.ticketNumber || '',
        `"${(t.name || '').replace(/"/g, '""')}"`,
        t.quantity,
        t.price || 0,
        t.ownerType || '',
        `"${(t.ownerName || '').replace(/"/g, '""')}"`,
        t.attendeeType || '',
        `"${(t.partnerOfName || '').replace(/"/g, '""')}"`,
        `"${(t.lodgeNameNumber || '').replace(/"/g, '""')}"`,
        t.confirmationNumber || '',
        t.invoiceNumber || '',
        t.paymentStatus || ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleTicketClick = (ticketNumber: string) => {
    setSelectedTicketId(ticketNumber);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTicketId(null);
  };

  const handleModalSave = () => {
    // Refresh the tickets data after save
    fetchTicketsData();
  };

  const handleOwnerClick = (ticket: Ticket) => {
    if (ticket.ownerId && ticket.ownerType && (ticket.ownerType === 'attendee' || ticket.ownerType === 'lodge')) {
      setSelectedOwnerId(ticket.ownerId);
      setSelectedOwnerType(ticket.ownerType as 'attendee' | 'lodge');
      setIsOwnerModalOpen(true);
    }
  };

  const handleOwnerModalClose = () => {
    setIsOwnerModalOpen(false);
    setSelectedOwnerId(null);
    setSelectedOwnerType(null);
  };

  const handleOwnerModalSave = () => {
    // Refresh the tickets data after save
    fetchTicketsData();
  };

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-gray-600">Loading tickets report...</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/reports" className="text-blue-500 hover:underline">
            ← Back to Reports
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Error: {error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-full mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/reports" className="text-blue-500 hover:underline">
          ← Back to Reports
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Tickets Report</h1>
            <p className="text-gray-600">All tickets from registrations with owner details and invoice information</p>
          </div>
          <div className="flex flex-col items-end">
            <label className="text-sm font-medium text-gray-700 mb-1">Database</label>
            <SimpleDatabaseSelector className="w-48" />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Tickets</p>
            <p className="text-2xl font-bold text-blue-600">{data.summary.totalTickets.toLocaleString()}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Lodge Tickets</p>
            <p className="text-2xl font-bold text-green-600">{data.summary.lodgeTickets.toLocaleString()}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Individual Tickets</p>
            <p className="text-2xl font-bold text-purple-600">{data.summary.individualTickets.toLocaleString()}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Value</p>
            <p className="text-2xl font-bold text-yellow-600">
              ${data.summary.totalValue.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Filters and Export */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search tickets..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner Type</label>
            <select
              value={ownerTypeFilter}
              onChange={(e) => setOwnerTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="lodge">Lodge</option>
              <option value="individual">Individual</option>
              <option value="attendee">Attendee</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Export to CSV
            </button>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          Showing {filteredTickets.length} of {data?.total || 0} tickets
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        <table className="min-w-full table-auto">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ticket Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Qty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attendee Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Partner Of
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lodge Name/Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confirmation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-4 text-center text-gray-500">
                    No tickets found
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.ticketNumber ? (
                        <button
                          onClick={() => handleTicketClick(ticket.ticketNumber)}
                          className="text-blue-500 hover:text-blue-700 hover:underline"
                        >
                          {ticket.ticketNumber}
                        </button>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${(Number(ticket.price) || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        ticket.ownerType === 'lodge' 
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {ticket.ownerType || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.ownerName && ticket.ownerId ? (
                        <button
                          onClick={() => handleOwnerClick(ticket)}
                          className="text-blue-500 hover:text-blue-700 hover:underline"
                        >
                          {ticket.ownerName}
                        </button>
                      ) : ticket.ownerName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        ticket.attendeeType === 'mason' 
                          ? 'bg-purple-100 text-purple-800'
                          : ticket.attendeeType === 'partner'
                          ? 'bg-pink-100 text-pink-800'
                          : ticket.attendeeType === 'guest'
                          ? 'bg-gray-100 text-gray-800'
                          : ticket.attendeeType === 'lodge'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {ticket.attendeeType || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.partnerOfName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.lodgeNameNumber || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.confirmationNumber ? (
                        <Link
                          href={`/collections/registrations/documents/${ticket.registrationId}`}
                          className="text-blue-500 hover:underline"
                        >
                          {ticket.confirmationNumber}
                        </Link>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ticket.invoiceNumber || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        ticket.paymentStatus === 'paid' 
                          ? 'bg-green-100 text-green-800'
                          : ticket.paymentStatus === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : ticket.paymentStatus === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {ticket.paymentStatus || 'unknown'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
      </div>

      {selectedTicketId && (
        <TicketEditModal
          ticketId={selectedTicketId}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}

      {selectedOwnerId && selectedOwnerType && (
        <OwnerEditModal
          ownerId={selectedOwnerId}
          ownerType={selectedOwnerType}
          isOpen={isOwnerModalOpen}
          onClose={handleOwnerModalClose}
          onSave={handleOwnerModalSave}
        />
      )}
    </main>
  );
}