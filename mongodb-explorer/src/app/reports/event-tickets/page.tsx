'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface EventTicketReport {
  summary: {
    totalTickets: number;
    activeTickets: number;
    ticketsWithSales: number;
    totalRevenue: number;
    totalAttendees: number;
    totalCapacity: number;
    overallUtilization: number;
  };
  monthlyRevenue: Record<string, number>;
  tickets: Array<{
    eventTicketId: string;
    eventId: string;
    name: string;
    description: string;
    status: string;
    price: number;
    totalCapacity: number;
    availableCount: number;
    soldCount: number;
    transactionCount: number;
    registrationCount: number;
    totalAttendees: number;
    totalRevenue: number;
    averageOrderValue: number;
    utilizationRate: number;
    monthlyRevenue: Record<string, number>;
    recentTransactions: Array<{
      transactionId: string;
      invoiceNumber: string;
      invoiceDate: string;
      quantity: number;
      price: number;
      customerName: string;
      customerEmail: string;
    }>;
    registrationsByType: {
      individuals: number;
      lodges: number;
      delegations: number;
    };
  }>;
}

export default function EventTicketsReportPage() {
  const [report, setReport] = useState<EventTicketReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [eventId, setEventId] = useState('');

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // Format currency with commas and dollar sign
  const formatCurrency = (num: number) => {
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (eventId) params.append('eventId', eventId);
      
      const response = await fetch(`/api/reports/event-tickets?${params}`);
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
    if (eventId) params.append('eventId', eventId);
    params.append('format', 'csv');
    
    const response = await fetch(`/api/reports/event-tickets?${params}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-tickets-sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    const isActive = status.toLowerCase() === 'active' || status === 'True';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
      }`}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const getUtilizationColor = (rate: number) => {
    if (rate >= 90) return 'text-red-600';
    if (rate >= 75) return 'text-yellow-600';
    if (rate >= 50) return 'text-blue-600';
    return 'text-gray-600';
  };

  if (loading) return <div className="p-8">Loading report...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!report) return <div className="p-8">No data available</div>;

  return (
    <main className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/reports" className="text-blue-500 hover:underline">
          ← Back to Reports
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Event Tickets Sales Report</h1>
        <p className="text-gray-600 mb-6">Comprehensive analysis of event ticket sales, revenue, and utilization</p>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Event ID (optional)</label>
              <input
                type="text"
                placeholder="Filter by event"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={fetchReport}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Update Report
              </button>
              <button
                onClick={downloadCSV}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Executive Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-600">Total Event Tickets</p>
            <p className="text-3xl font-bold">{formatNumber(report.summary.totalTickets)}</p>
            <p className="text-xs text-gray-500 mt-1">{formatNumber(report.summary.activeTickets)} active</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Revenue</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(report.summary.totalRevenue)}</p>
            <p className="text-xs text-gray-500 mt-1">{formatNumber(report.summary.ticketsWithSales)} tickets with sales</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Attendees</p>
            <p className="text-3xl font-bold">{formatNumber(report.summary.totalAttendees)}</p>
            <p className="text-xs text-gray-500 mt-1">of {formatNumber(report.summary.totalCapacity)} capacity</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Overall Utilization</p>
            <p className={`text-3xl font-bold ${getUtilizationColor(report.summary.overallUtilization)}`}>
              {report.summary.overallUtilization}%
            </p>
            <p className="text-xs text-gray-500 mt-1">seats filled</p>
          </div>
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      {Object.keys(report.monthlyRevenue).length > 0 && (
        <div className="bg-white border rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Monthly Revenue Trend</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Month</th>
                  <th className="text-right py-2">Revenue</th>
                  <th className="text-right py-2">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(report.monthlyRevenue)
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([month, revenue]) => {
                    const [year, monthNum] = month.split('-');
                    const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    const percentage = report.summary.totalRevenue > 0 
                      ? ((revenue / report.summary.totalRevenue) * 100).toFixed(1)
                      : 0;
                    return (
                      <tr key={month} className="border-b">
                        <td className="py-2">{monthName}</td>
                        <td className="text-right py-2">{formatCurrency(revenue)}</td>
                        <td className="text-right py-2">{percentage}%</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event Tickets Details */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Event Tickets Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Ticket Name</th>
                <th className="text-center py-2">Status</th>
                <th className="text-right py-2">Price</th>
                <th className="text-right py-2">Capacity</th>
                <th className="text-right py-2">Sold</th>
                <th className="text-center py-2">Individuals</th>
                <th className="text-center py-2">Lodges</th>
                <th className="text-center py-2">Delegations</th>
                <th className="text-right py-2">Revenue</th>
                <th className="text-right py-2">Utilization</th>
                <th className="text-center py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {report.tickets.map((ticket) => (
                <tr key={ticket.eventTicketId} className="border-b hover:bg-gray-50">
                  <td className="py-3">
                    <div>
                      <p className="font-medium">{ticket.name}</p>
                      {ticket.description && (
                        <p className="text-xs text-gray-500">{ticket.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="text-center py-3">
                    {getStatusBadge(ticket.status)}
                  </td>
                  <td className="text-right py-3">{formatCurrency(ticket.price)}</td>
                  <td className="text-right py-3">
                    {ticket.totalCapacity ? formatNumber(ticket.totalCapacity) : 'Unlimited'}
                  </td>
                  <td className="text-right py-3">
                    <p className="font-medium">{formatNumber(ticket.totalAttendees)}</p>
                  </td>
                  <td className="text-center py-3">
                    <span className="text-sm">{ticket.registrationsByType.individuals || 0}</span>
                  </td>
                  <td className="text-center py-3">
                    <span className="text-sm">{ticket.registrationsByType.lodges || 0}</span>
                  </td>
                  <td className="text-center py-3">
                    <span className="text-sm">{ticket.registrationsByType.delegations || 0}</span>
                  </td>
                  <td className="text-right py-3 font-medium">
                    {formatCurrency(ticket.totalRevenue)}
                  </td>
                  <td className="text-right py-3">
                    <span className={`font-medium ${getUtilizationColor(ticket.utilizationRate)}`}>
                      {ticket.utilizationRate}%
                    </span>
                  </td>
                  <td className="text-center py-3">
                    <Link
                      href={`/reports/event-tickets/${ticket.eventTicketId}`}
                      className="text-blue-500 hover:underline text-sm"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="py-3">Total</td>
                <td></td>
                <td></td>
                <td className="text-right py-3">{formatNumber(report.summary.totalCapacity)}</td>
                <td className="text-right py-3">{formatNumber(report.summary.totalAttendees)}</td>
                <td className="text-center py-3">
                  {report.tickets.reduce((sum, t) => sum + (t.registrationsByType.individuals || 0), 0)}
                </td>
                <td className="text-center py-3">
                  {report.tickets.reduce((sum, t) => sum + (t.registrationsByType.lodges || 0), 0)}
                </td>
                <td className="text-center py-3">
                  {report.tickets.reduce((sum, t) => sum + (t.registrationsByType.delegations || 0), 0)}
                </td>
                <td className="text-right py-3">{formatCurrency(report.summary.totalRevenue)}</td>
                <td className="text-right py-3">{report.summary.overallUtilization}%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </main>
  );
}