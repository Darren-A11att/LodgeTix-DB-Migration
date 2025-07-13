'use client';

import { useState, useEffect } from 'react';
import BackButton from '@/components/BackButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PendingImport {
  _id: string;
  registrationId: string;
  confirmationNumber?: string;
  registrationType?: string;
  totalAmountPaid?: number;
  paymentStatus: string;
  pendingSince: string;
  checkCount: number;
  lastCheckDate: string;
  reason: string;
  squarePaymentId?: string;
  stripePaymentIntentId?: string;
  previouslyFailed?: boolean;
}

interface ProcessingResult {
  resolved: number;
  stillPending: number;
  failed: number;
  apiChecked: number;
}

export default function PendingImportsPage() {
  const [pendingImports, setPendingImports] = useState<PendingImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedImport, setSelectedImport] = useState<PendingImport | null>(null);
  const [filter, setFilter] = useState<'all' | 'no-payment' | 'with-payment'>('all');
  const [lastResult, setLastResult] = useState<ProcessingResult | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    noPaymentId: 0,
    withPaymentId: 0,
    previouslyFailed: 0,
    avgDaysPending: 0
  });

  useEffect(() => {
    fetchPendingImports();
  }, []);

  const fetchPendingImports = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tools/pending-imports');
      const data = await response.json();
      setPendingImports(data.imports || []);
      setStats(data.stats || {
        total: 0,
        noPaymentId: 0,
        withPaymentId: 0,
        previouslyFailed: 0,
        avgDaysPending: 0
      });
    } catch (error) {
      console.error('Failed to fetch pending imports:', error);
    } finally {
      setLoading(false);
    }
  };

  const processPendingImports = async (maxRetries: number = 5, batchSize: number = 50) => {
    setProcessing(true);
    setLastResult(null);
    try {
      const response = await fetch('/api/tools/pending-imports/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxRetries, batchSize })
      });
      const result = await response.json();
      setLastResult(result);
      await fetchPendingImports();
    } catch (error) {
      console.error('Failed to process imports:', error);
    } finally {
      setProcessing(false);
    }
  };

  const moveToFailed = async (importId: string) => {
    try {
      const response = await fetch(`/api/tools/pending-imports/${importId}/fail`, {
        method: 'POST'
      });
      if (response.ok) {
        await fetchPendingImports();
      }
    } catch (error) {
      console.error('Failed to move import:', error);
    }
  };

  const retryImport = async (importId: string) => {
    try {
      const response = await fetch(`/api/tools/pending-imports/${importId}/retry`, {
        method: 'POST'
      });
      if (response.ok) {
        await fetchPendingImports();
      }
    } catch (error) {
      console.error('Failed to retry import:', error);
    }
  };

  const filteredImports = filter === 'all' 
    ? pendingImports
    : filter === 'no-payment'
    ? pendingImports.filter(i => !i.squarePaymentId && !i.stripePaymentIntentId)
    : pendingImports.filter(i => i.squarePaymentId || i.stripePaymentIntentId);

  const getDaysPending = (date: string) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getReasonBadge = (reason: string) => {
    if (reason.includes('No payment ID')) {
      return <Badge variant="outline" className="border-gray-500">No Payment ID</Badge>;
    }
    if (reason.includes('Square')) {
      return <Badge variant="outline" className="border-green-500 text-green-700">Square Issue</Badge>;
    }
    if (reason.includes('Stripe')) {
      return <Badge variant="outline" className="border-blue-500 text-blue-700">Stripe Issue</Badge>;
    }
    return <Badge variant="outline">{reason.substring(0, 20)}...</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading pending imports...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold">Process Pending Imports</h1>
          <p className="text-gray-600 mt-1">Review and process registrations waiting for payment verification</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">No Payment ID</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.noPaymentId}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">With Payment ID</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.withPaymentId}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Previously Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.previouslyFailed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Days Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDaysPending.toFixed(1)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Processing Result Alert */}
      {lastResult && (
        <Alert className="mb-6">
          <AlertTitle>Processing Complete</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              <div>✅ Resolved: {lastResult.resolved} registrations</div>
              <div>⏳ Still pending: {lastResult.stillPending} registrations</div>
              <div>❌ Failed: {lastResult.failed} registrations</div>
              {lastResult.apiChecked > 0 && (
                <div>🔍 Checked Square API: {lastResult.apiChecked} times</div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Actions Bar */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Filter:</span>
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All ({stats.total})
              </Button>
              <Button
                variant={filter === 'no-payment' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('no-payment')}
              >
                No Payment ID ({stats.noPaymentId})
              </Button>
              <Button
                variant={filter === 'with-payment' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('with-payment')}
              >
                With Payment ID ({stats.withPaymentId})
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => processPendingImports(5, 50)}
              disabled={processing}
            >
              {processing ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Process Batch
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPendingImports}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Pending Imports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Imports</CardTitle>
          <CardDescription>
            Registrations waiting for payment verification. The system will periodically check for matching payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Registration</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Pending Since</TableHead>
                <TableHead>Checks</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Payment IDs</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredImports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No pending imports found
                  </TableCell>
                </TableRow>
              ) : (
                filteredImports.map((importItem) => (
                  <TableRow key={importItem._id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {importItem.confirmationNumber || 'No confirmation'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {importItem.registrationType || 'Unknown type'}
                        </div>
                        {importItem.previouslyFailed && (
                          <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
                            Previously Failed
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        ${typeof importItem.totalAmountPaid === 'number' ? importItem.totalAmountPaid.toFixed(2) : '0.00'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          {new Date(importItem.pendingSince).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getDaysPending(importItem.pendingSince)} days
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{importItem.checkCount}</div>
                        <div className="text-xs text-gray-500">
                          Last: {new Date(importItem.lastCheckDate).toLocaleDateString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getReasonBadge(importItem.reason)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs">
                        {importItem.squarePaymentId && (
                          <div className="font-mono truncate max-w-[150px]" title={importItem.squarePaymentId}>
                            SQ: {importItem.squarePaymentId}
                          </div>
                        )}
                        {importItem.stripePaymentIntentId && (
                          <div className="font-mono truncate max-w-[150px]" title={importItem.stripePaymentIntentId}>
                            ST: {importItem.stripePaymentIntentId}
                          </div>
                        )}
                        {!importItem.squarePaymentId && !importItem.stripePaymentIntentId && (
                          <span className="text-gray-500">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryImport(importItem._id)}
                          title="Check for payment now"
                        >
                          Retry
                        </Button>
                        {importItem.checkCount >= 4 && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => moveToFailed(importItem._id)}
                            title="Move to failed registrations"
                          >
                            Fail
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedImport(importItem)}
                        >
                          Details
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold">Pending Import Details</h2>
                <button
                  onClick={() => setSelectedImport(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Registration Information</h3>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Registration ID</dt>
                      <dd className="font-mono text-xs">{selectedImport.registrationId}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Confirmation Number</dt>
                      <dd>{selectedImport.confirmationNumber || 'None'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Type</dt>
                      <dd>{selectedImport.registrationType || 'Unknown'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Amount</dt>
                      <dd>${typeof selectedImport.totalAmountPaid === 'number' ? selectedImport.totalAmountPaid.toFixed(2) : '0.00'}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Payment Information</h3>
                  <dl className="space-y-2 text-sm">
                    {selectedImport.squarePaymentId && (
                      <div>
                        <dt className="text-gray-500">Square Payment ID</dt>
                        <dd className="font-mono text-xs break-all">{selectedImport.squarePaymentId}</dd>
                      </div>
                    )}
                    {selectedImport.stripePaymentIntentId && (
                      <div>
                        <dt className="text-gray-500">Stripe Payment Intent ID</dt>
                        <dd className="font-mono text-xs break-all">{selectedImport.stripePaymentIntentId}</dd>
                      </div>
                    )}
                    {!selectedImport.squarePaymentId && !selectedImport.stripePaymentIntentId && (
                      <dd className="text-gray-500 italic">No payment IDs found</dd>
                    )}
                  </dl>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Processing Status</h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Pending Since</dt>
                      <dd>{new Date(selectedImport.pendingSince).toLocaleString()} ({getDaysPending(selectedImport.pendingSince)} days)</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Check Count</dt>
                      <dd>{selectedImport.checkCount} attempts</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Last Check</dt>
                      <dd>{new Date(selectedImport.lastCheckDate).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Reason</dt>
                      <dd className="text-red-600">{selectedImport.reason}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setSelectedImport(null)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    retryImport(selectedImport._id);
                    setSelectedImport(null);
                  }}
                >
                  Retry Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}