'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Download, RefreshCw, Search, FileCheck, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

interface PaymentImport {
  _id: string;
  squarePaymentId: string;
  amount: number;
  amountFormatted: string;
  customerEmail?: string;
  customerName?: string;
  createdAt: string;
  processingStatus: 'pending' | 'matched' | 'imported' | 'failed' | 'skipped';
  matchedRegistrationId?: string;
}

interface ImportStats {
  total: number;
  pending: number;
  matched: number;
  imported: number;
  failed: number;
  skipped: number;
}

export default function PaymentImportPage() {
  const [payments, setPayments] = useState<PaymentImport[]>([]);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchPayments();
    fetchStats();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await fetch('/api/payment-imports');
      const data = await response.json();
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/payment-imports/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const importFromSquare = async () => {
    setImporting(true);
    try {
      const response = await fetch('/api/payment-imports/square', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`Import completed! Imported: ${result.imported}, Skipped: ${result.skipped}`);
        fetchPayments();
        fetchStats();
      } else {
        alert(`Import failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'default',
      matched: 'secondary',
      imported: 'secondary',
      failed: 'destructive',
      skipped: 'outline'
    };
    
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = searchTerm === '' || 
      payment.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.squarePaymentId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || payment.processingStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-3xl font-bold">Payment Import</h1>
              <p className="text-muted-foreground">
                Import payments from Square and match them to registrations
              </p>
            </div>
          </div>
          <SimpleDatabaseSelector className="w-64" />
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Matched</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.matched}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Imported</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.imported}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Skipped</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.skipped}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <Button 
              onClick={importFromSquare} 
              disabled={importing}
              className="md:w-auto"
            >
              {importing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Import from Square
                </>
              )}
            </Button>
            
            <div className="flex-1 flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by email, name, or payment ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="matched">Matched</option>
                <option value="imported">Imported</option>
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Imported Payments</CardTitle>
          <CardDescription>
            Click on a payment to match it with a registration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading payments...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payments found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment._id}>
                    <TableCell className="font-mono text-sm">
                      {payment.squarePaymentId}
                    </TableCell>
                    <TableCell>
                      {format(new Date(payment.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {payment.customerName || 'Unknown'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {payment.customerEmail || 'No email'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.amountFormatted}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.processingStatus)}</TableCell>
                    <TableCell>
                      {payment.processingStatus === 'pending' && (
                        <Link href={`/payment-import/match/${payment._id}`}>
                          <Button size="sm" variant="outline">
                            <Search className="mr-2 h-4 w-4" />
                            Match
                          </Button>
                        </Link>
                      )}
                      {payment.processingStatus === 'matched' && (
                        <Link href={`/import-queue?paymentId=${payment._id}`}>
                          <Button size="sm" variant="outline">
                            <FileCheck className="mr-2 h-4 w-4" />
                            Review
                          </Button>
                        </Link>
                      )}
                      {payment.processingStatus === 'imported' && (
                        <span className="text-sm text-green-600">✓ Imported</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}