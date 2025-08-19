'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ArrowLeft, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import SimpleDatabaseSelector from '@/components/SimpleDatabaseSelector';

interface PaymentImport {
  _id: string;
  squarePaymentId: string;
  amount: number;
  amountFormatted: string;
  customerEmail?: string;
  customerName?: string;
  createdAt: string;
  status: string;
  cardBrand?: string;
  last4?: string;
  orderReference?: string;
  metadata?: any;
}

interface Registration {
  id: string;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  confirmation_number?: string;
  total_amount: number;
  registration_type: string;
  created_at: string;
  payment_status?: string;
}

interface MatchResult {
  registration: Registration;
  matchScore: number;
  matchedFields: string[];
}

export default function PaymentMatchingPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = params.id as string;

  const [payment, setPayment] = useState<PaymentImport | null>(null);
  const [searchResults, setSearchResults] = useState<MatchResult[]>([]);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [matching, setMatching] = useState(false);

  // Search form state
  const [searchEmail, setSearchEmail] = useState('');
  const [searchAmount, setSearchAmount] = useState('');
  const [searchConfirmation, setSearchConfirmation] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchPaymentId, setSearchPaymentId] = useState('');

  useEffect(() => {
    fetchPayment();
  }, [paymentId]);

  const fetchPayment = async () => {
    try {
      const response = await fetch(`/api/payment-imports/${paymentId}`);
      const data = await response.json();
      setPayment(data);
      
      // Pre-fill search fields
      setSearchEmail(data.customerEmail || '');
      setSearchAmount(data.amount.toString());
      setSearchName(data.customerName || '');
      
      // Auto-search with email AND amount for better matching
      if (data.customerEmail && data.amount) {
        searchRegistrations({ 
          email: data.customerEmail,
          amount: { value: data.amount, tolerance: 1 }
        });
      }
    } catch (error) {
      console.error('Error fetching payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchRegistrations = async (criteria?: any) => {
    setSearching(true);
    try {
      const searchCriteria = criteria || {
        email: searchEmail,
        amount: searchAmount ? { value: parseFloat(searchAmount), tolerance: 1 } : undefined,
        confirmationNumber: searchConfirmation || undefined,
        customerName: searchName || undefined,
        paymentId: searchPaymentId || undefined
      };

      const response = await fetch('/api/payment-imports/search-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchCriteria })
      });

      const data = await response.json();
      setSearchResults(data.registrations || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const matchPayment = async () => {
    if (!selectedRegistration || !payment) return;

    setMatching(true);
    try {
      const response = await fetch('/api/import-queue/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentImportId: payment._id,
          registrationId: selectedRegistration.id,
          matchingCriteria: [
            {
              field: 'email',
              paymentValue: payment.customerEmail,
              registrationValue: selectedRegistration.email,
              matchType: 'exact',
              weight: 0.4,
              matched: payment.customerEmail === selectedRegistration.email
            },
            {
              field: 'amount',
              paymentValue: payment.amount,
              registrationValue: selectedRegistration.total_amount,
              matchType: 'range',
              weight: 0.3,
              matched: Math.abs(payment.amount - selectedRegistration.total_amount) < 1
            }
          ]
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert('Payment matched successfully! Queue ID: ' + result.queueId);
        router.push('/import-queue');
      } else {
        const error = await response.json();
        alert('Failed to match payment: ' + error.message);
      }
    } catch (error) {
      console.error('Match error:', error);
      alert('Failed to match payment');
    } finally {
      setMatching(false);
    }
  };

  const getMatchBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-500">Exact Payment ID Match</Badge>;
    if (score >= 80) return <Badge className="bg-green-500">Payment ID Match</Badge>;
    if (score >= 70) return <Badge className="bg-blue-500">Email + Amount Match</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-500">Partial Match</Badge>;
    return <Badge variant="secondary">Poor Match</Badge>;
  };

  const getFieldIcon = (matched: boolean) => {
    return matched ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Payment not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/payment-import')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Payment Import
        </Button>
        
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold">Match Payment to Registration</h1>
          <SimpleDatabaseSelector className="w-64" />
        </div>
        <p className="text-muted-foreground">
          Find and match the registration for this Square payment
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Details */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
              <CardDescription>Square Payment Information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-muted-foreground">Payment ID</Label>
                  <p className="font-mono text-sm break-all">{payment.squarePaymentId}</p>
                </div>
                
                <div>
                  <Label className="text-sm text-muted-foreground">Amount</Label>
                  <p className="text-2xl font-bold">{payment.amountFormatted}</p>
                </div>
                
                <div>
                  <Label className="text-sm text-muted-foreground">Customer</Label>
                  <p className="font-medium">{payment.customerName || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{payment.customerEmail || 'No email'}</p>
                </div>
                
                <div>
                  <Label className="text-sm text-muted-foreground">Date</Label>
                  <p className="text-sm">{format(new Date(payment.createdAt), 'MMM d, yyyy h:mm a')}</p>
                </div>
                
                {payment.cardBrand && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Payment Method</Label>
                    <p className="text-sm">{payment.cardBrand} ending in {payment.last4}</p>
                  </div>
                )}
                
                {payment.orderReference && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Order Reference</Label>
                    <p className="font-mono text-sm break-all">{payment.orderReference}</p>
                  </div>
                )}
              </div>
              
              <Separator className="my-4" />
              
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Payment Gateway Response</Label>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                    {JSON.stringify((payment as any).paymentGatewayData || (payment as any).rawSquareData || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Results */}
        <div className="lg:col-span-2">
          <Tabs>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger>Search Registrations</TabsTrigger>
              <TabsTrigger>Manual Entry</TabsTrigger>
            </TabsList>
            
            <TabsContent className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Search Criteria</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Email</Label>
                      <Input
                        value={searchEmail}
                        onChange={(e) => setSearchEmail(e.target.value)}
                        placeholder="customer@example.com"
                      />
                    </div>
                    
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        value={searchAmount}
                        onChange={(e) => setSearchAmount(e.target.value)}
                        placeholder="100.00"
                      />
                    </div>
                    
                    <div>
                      <Label>Confirmation Number</Label>
                      <Input
                        value={searchConfirmation}
                        onChange={(e) => setSearchConfirmation(e.target.value)}
                        placeholder="IND-123456"
                      />
                    </div>
                    
                    <div>
                      <Label>Customer Name</Label>
                      <Input
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <Label>Payment ID (Stripe/Square)</Label>
                      <Input
                        value={searchPaymentId}
                        onChange={(e) => setSearchPaymentId(e.target.value)}
                        placeholder="pi_3RbB3uCari1bgsWq0CGtr1gj"
                        className="font-mono"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Search by Stripe Payment Intent ID or Square Payment ID
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => searchRegistrations()} 
                    className="mt-4 w-full"
                    disabled={searching}
                  >
                    {searching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Search Registrations
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Search Results</CardTitle>
                    <CardDescription>
                      Found {searchResults.length} potential matches
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Registration</TableHead>
                          <TableHead>Match Score</TableHead>
                          <TableHead>Matched Fields</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.map((result, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {result.registration.full_name || 
                                   `${result.registration.first_name} ${result.registration.last_name}`}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {result.registration.email}
                                </p>
                                <p className="text-sm">
                                  ${(Number(result.registration.total_amount) || 0).toFixed(2)} • 
                                  {result.registration.confirmation_number || 'No confirmation'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getMatchBadge(result.matchScore)}
                                <span className="text-sm font-medium">
                                  {result.matchScore}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {result.matchedFields.map((field) => (
                                  <Badge key={field} variant="outline" className="text-xs">
                                    {field}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => setSelectedRegistration(result.registration)}
                                variant={selectedRegistration?.id === result.registration.id ? 'default' : 'outline'}
                              >
                                Select
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Selected Registration */}
              {selectedRegistration && (
                <Card className="border-primary">
                  <CardHeader>
                    <CardTitle>Selected Registration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>Name:</strong> {selectedRegistration.full_name}</p>
                      <p><strong>Email:</strong> {selectedRegistration.email}</p>
                      <p><strong>Amount:</strong> ${(Number(selectedRegistration.total_amount) || 0).toFixed(2)}</p>
                      <p><strong>Type:</strong> {selectedRegistration.registration_type}</p>
                      <p><strong>Confirmation:</strong> {selectedRegistration.confirmation_number || 'None'}</p>
                    </div>
                    
                    <Button 
                      onClick={matchPayment}
                      className="mt-4 w-full"
                      disabled={matching}
                    >
                      {matching ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Matching...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Confirm Match
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Manual Registration ID</CardTitle>
                  <CardDescription>
                    Enter a Supabase registration ID to match manually
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Input
                      placeholder="Enter registration ID"
                      className="font-mono"
                    />
                    <Button className="w-full">
                      Verify and Match
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}