'use client';

import { useState, useEffect } from 'react';
import BackButton from '@/components/BackButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PendingMatch {
  _id: string;
  registration: {
    registrationId: string;
    confirmationNumber?: string;
    type?: string;
    totalAmountPaid?: number;
    createdAt: string;
    squarePaymentId?: string;
    stripePaymentIntentId?: string;
  };
  payment: {
    paymentId: string;
    source: 'square' | 'stripe';
    status: string;
    grossAmount: number;
    customerName?: string;
    timestamp: string;
  };
  matchConfidence: 'high' | 'medium' | 'low';
  matchReason: string;
}

interface ReviewStats {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}

export default function ReviewMatchesPage() {
  const [matches, setMatches] = useState<PendingMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [stats, setStats] = useState<ReviewStats>({ total: 0, approved: 0, rejected: 0, pending: 0 });
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedMatch, setSelectedMatch] = useState<PendingMatch | null>(null);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tools/review-matches');
      const data = await response.json();
      setMatches(data.matches || []);
      setStats(data.stats || { total: 0, approved: 0, rejected: 0, pending: 0 });
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (matchId: string) => {
    setProcessing(matchId);
    try {
      const response = await fetch(`/api/tools/review-matches/${matchId}/approve`, {
        method: 'POST'
      });
      if (response.ok) {
        await fetchMatches();
      }
    } catch (error) {
      console.error('Failed to approve match:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (matchId: string, reason?: string) => {
    setProcessing(matchId);
    try {
      const response = await fetch(`/api/tools/review-matches/${matchId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (response.ok) {
        await fetchMatches();
      }
    } catch (error) {
      console.error('Failed to reject match:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkApprove = async (confidence: 'high' | 'medium' | 'low') => {
    const matchesToApprove = matches.filter(m => m.matchConfidence === confidence);
    setProcessing('bulk');
    try {
      const response = await fetch('/api/tools/review-matches/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchIds: matchesToApprove.map(m => m._id) })
      });
      if (response.ok) {
        await fetchMatches();
      }
    } catch (error) {
      console.error('Failed to bulk approve:', error);
    } finally {
      setProcessing(null);
    }
  };

  const filteredMatches = filter === 'all' 
    ? matches 
    : matches.filter(m => m.matchConfidence === filter);

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return <Badge variant="default" className="bg-green-500">High</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-yellow-500">Medium</Badge>;
      case 'low':
        return <Badge variant="outline" className="border-red-500 text-red-600">Low</Badge>;
      default:
        return <Badge>{confidence}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading matches...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold">Review Payment Matches</h1>
          <p className="text-gray-600 mt-1">Review and approve payment-registration matches before import</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Filter by confidence:</span>
            <div className="flex gap-2">
              {['all', 'high', 'medium', 'low'].map((level) => (
                <Button
                  key={level}
                  variant={filter === level ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(level as any)}
                  className="capitalize"
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkApprove('high')}
              disabled={processing === 'bulk' || matches.filter(m => m.matchConfidence === 'high').length === 0}
            >
              Approve All High Confidence
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMatches}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Matches Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Matches</CardTitle>
          <CardDescription>
            Review each match and approve or reject based on the confidence level and details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Confidence</TableHead>
                <TableHead>Registration</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Match Reason</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No matches found for review
                  </TableCell>
                </TableRow>
              ) : (
                filteredMatches.map((match) => (
                  <TableRow key={match._id} className="hover:bg-gray-50">
                    <TableCell>
                      {getConfidenceBadge(match.matchConfidence)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {match.registration.confirmationNumber || 'No confirmation'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {match.registration.type || 'Unknown type'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(match.registration.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {match.payment.source.toUpperCase()} Payment
                        </div>
                        <div className="text-sm text-gray-500">
                          {match.payment.customerName || 'Unknown customer'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(match.payment.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          ${match.payment.grossAmount.toFixed(2)}
                        </div>
                        {match.registration.totalAmountPaid && (
                          <div className="text-sm text-gray-500">
                            Reg: ${match.registration.totalAmountPaid.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-xs">
                        {match.matchReason}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApprove(match._id)}
                          disabled={processing === match._id}
                        >
                          {processing === match._id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          ) : (
                            'Approve'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(match._id)}
                          disabled={processing === match._id}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedMatch(match)}
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
      {selectedMatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold">Match Details</h2>
                <button
                  onClick={() => setSelectedMatch(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Registration Details</h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Confirmation Number</dt>
                      <dd className="font-medium">{selectedMatch.registration.confirmationNumber || 'None'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Registration ID</dt>
                      <dd className="font-mono text-xs">{selectedMatch.registration.registrationId}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Type</dt>
                      <dd>{selectedMatch.registration.type || 'Unknown'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Amount</dt>
                      <dd>${selectedMatch.registration.totalAmountPaid?.toFixed(2) || '0.00'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Created</dt>
                      <dd>{new Date(selectedMatch.registration.createdAt).toLocaleString()}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Payment Details</h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Payment ID</dt>
                      <dd className="font-mono text-xs">{selectedMatch.payment.paymentId}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Source</dt>
                      <dd>{selectedMatch.payment.source.toUpperCase()}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Status</dt>
                      <dd>{selectedMatch.payment.status}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Amount</dt>
                      <dd>${selectedMatch.payment.grossAmount.toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Customer</dt>
                      <dd>{selectedMatch.payment.customerName || 'Unknown'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Timestamp</dt>
                      <dd>{new Date(selectedMatch.payment.timestamp).toLocaleString()}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded">
                <h4 className="font-medium mb-2">Match Analysis</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Confidence: {getConfidenceBadge(selectedMatch.matchConfidence)}
                </p>
                <p className="text-sm text-gray-600">
                  {selectedMatch.matchReason}
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setSelectedMatch(null)}
                >
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleReject(selectedMatch._id);
                    setSelectedMatch(null);
                  }}
                >
                  Reject Match
                </Button>
                <Button
                  onClick={() => {
                    handleApprove(selectedMatch._id);
                    setSelectedMatch(null);
                  }}
                >
                  Approve Match
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}