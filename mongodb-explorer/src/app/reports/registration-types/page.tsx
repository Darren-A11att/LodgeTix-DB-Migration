'use client';

import { useState, useEffect } from 'react';

interface TypeBreakdown {
  registrationType: string;
  count: number;
  totalAmount: number;
  avgAmount: number;
  registrations: Array<{
    registrationId: string;
    confirmationNumber: string;
    lodgeName?: string;
    lodgeNumber?: string;
    totalAmountPaid: number;
    createdAt: string;
    attendeeCount: number;
  }>;
}

interface LodgeBreakdown {
  lodgeName: string;
  lodgeNumber: string;
  count: number;
  totalAmount: number;
  avgAmount: number;
  totalAttendees: number;
}

interface ReportData {
  summary: {
    totalRegistrations: number;
    totalRevenue: number;
    avgRevenuePerRegistration: number;
    dateRange: {
      startDate: string;
      endDate: string;
    };
  };
  typeBreakdown: TypeBreakdown[];
  lodgeBreakdown: LodgeBreakdown[];
  generatedAt: string;
}

export default function RegistrationTypesReport() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showSamples, setShowSamples] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/reports/registration-types?${params}`);
      if (!response.ok) throw new Error('Failed to fetch report');
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('format', 'csv');
    
    window.open(`/api/reports/registration-types?${params}`, '_blank');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number, total: number) => {
    return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '0%';
  };

  if (loading) return <div className="p-8">Loading report...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!data) return <div className="p-8">No data available</div>;

  const individualData = data.typeBreakdown.find(t => t.registrationType === 'individual');
  const lodgeData = data.typeBreakdown.find(t => t.registrationType === 'lodge');

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Registration Types Report</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={fetchReport}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Apply Filters
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Executive Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Total Registrations</p>
              <p className="text-2xl font-bold">{data.summary.totalRegistrations.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(data.summary.totalRevenue)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Average Revenue per Registration</p>
              <p className="text-2xl font-bold">{formatCurrency(data.summary.avgRevenuePerRegistration)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Registration Type Breakdown</h3>
            <div className="space-y-4">
              {data.typeBreakdown.map((type) => (
                <div key={type.registrationType} className="border-b pb-4 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold capitalize">{type.registrationType} Registrations</h4>
                      <p className="text-sm text-gray-600">
                        {type.count.toLocaleString()} registrations ({formatPercentage(type.count, data.summary.totalRegistrations)})
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedType(type.registrationType);
                        setShowSamples(true);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View Samples
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total Revenue</p>
                      <p className="font-medium">{formatCurrency(type.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Average Revenue</p>
                      <p className="font-medium">{formatCurrency(type.avgAmount)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Visual Breakdown</h3>
            <div className="space-y-4">
              {data.typeBreakdown.map((type) => {
                const percentage = (type.count / data.summary.totalRegistrations) * 100;
                return (
                  <div key={type.registrationType}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium capitalize">{type.registrationType}</span>
                      <span className="text-sm text-gray-600">{formatPercentage(type.count, data.summary.totalRegistrations)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-8">
                      <div
                        className={`h-8 rounded-full flex items-center justify-center text-white text-sm ${
                          type.registrationType === 'individual' ? 'bg-blue-600' : 'bg-green-600'
                        }`}
                        style={{ width: `${percentage}%` }}
                      >
                        {type.count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {data.lodgeBreakdown.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Top Lodges by Registration Count</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Lodge Name</th>
                    <th className="text-left py-2">Lodge #</th>
                    <th className="text-right py-2">Registrations</th>
                    <th className="text-right py-2">Total Revenue</th>
                    <th className="text-right py-2">Avg Revenue</th>
                    <th className="text-right py-2">Total Attendees</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lodgeBreakdown.map((lodge, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2">{lodge.lodgeName || 'Unknown'}</td>
                      <td className="py-2">{lodge.lodgeNumber || '-'}</td>
                      <td className="text-right py-2">{lodge.count}</td>
                      <td className="text-right py-2">{formatCurrency(lodge.totalAmount)}</td>
                      <td className="text-right py-2">{formatCurrency(lodge.avgAmount)}</td>
                      <td className="text-right py-2">{lodge.totalAttendees}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showSamples && selectedType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">
                  Sample {selectedType} Registrations
                </h3>
                <button
                  onClick={() => {
                    setShowSamples(false);
                    setSelectedType(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {data.typeBreakdown
                  .find(t => t.registrationType === selectedType)
                  ?.registrations.map((reg, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Registration ID</p>
                          <p className="font-medium">{reg.registrationId}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Confirmation #</p>
                          <p className="font-medium">{reg.confirmationNumber}</p>
                        </div>
                        {reg.lodgeName && (
                          <div>
                            <p className="text-gray-600">Lodge</p>
                            <p className="font-medium">{reg.lodgeName} #{reg.lodgeNumber}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-gray-600">Amount Paid</p>
                          <p className="font-medium">{formatCurrency(reg.totalAmountPaid)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Attendees</p>
                          <p className="font-medium">{reg.attendeeCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Date</p>
                          <p className="font-medium">
                            {new Date(reg.createdAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}