import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }
    
    // Get the API port from the port config or use default
    const apiPort = process.env.API_PORT || '3006';
    
    // Search for payments with flexible matching
    const paymentsUrl = `http://localhost:${apiPort}/api/collections/payments/search`;
    const paymentsResponse = await fetch(paymentsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: {
          $or: [
            // Unified payment structure fields
            { customerEmail: { $regex: query, $options: 'i' } },
            { customerName: { $regex: query, $options: 'i' } },
            { id: { $regex: query, $options: 'i' } },
            { sourcePaymentId: { $regex: query, $options: 'i' } },
            // Legacy fields for backward compatibility
            { email: { $regex: query, $options: 'i' } },
            { 'customer.email': { $regex: query, $options: 'i' } },
            { 'customer.name': { $regex: query, $options: 'i' } },
            { transactionId: { $regex: query, $options: 'i' } },
            { paymentId: { $regex: query, $options: 'i' } }
          ]
        }
      }),
    });
    
    if (!paymentsResponse.ok) {
      throw new Error('Failed to search payments');
    }
    
    const paymentsData = await paymentsResponse.json();
    const payments = paymentsData.documents || [];
    
    // Helper to find email in payment object
    const findEmailInPayment = (payment: any): string | null => {
      // Priority 1: Check customerEmail field
      if (payment.customerEmail && payment.customerEmail.includes('@')) {
        return payment.customerEmail;
      }
      
      // Priority 2: Check "Customer Email" field (with space)
      if (payment['Customer Email'] && payment['Customer Email'].includes('@')) {
        return payment['Customer Email'];
      }
      
      // Priority 3: Check common email field variations
      if (payment.email && payment.email.includes('@')) return payment.email;
      if (payment.customer?.email && payment.customer.email.includes('@')) return payment.customer.email;
      
      // Priority 4: Search for any field containing 'email' in its name
      const searchObj = (obj: any, depth: number = 0): string | null => {
        if (depth > 3) return null;
        
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (key.toLowerCase().includes('email') && typeof value === 'string' && value.includes('@')) {
              return value;
            }
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              const found = searchObj(value, depth + 1);
              if (found) return found;
            }
          }
        }
        return null;
      };
      
      return searchObj(payment);
    };
    
    // Process the results
    const results = {
      query,
      totalFound: payments.length,
      payments: payments.map((p: any) => ({
        id: p.id || p._id,                                        // Unified ID
        transactionId: p.id || p.sourcePaymentId || p.transactionId || p.paymentId, // Unified transaction ID
        amount: p.amount || p.grossAmount,                        // Unified amount
        date: p.createdAt || p.timestamp,                         // Unified timestamp
        customerEmail: p.customerEmail || findEmailInPayment(p),  // Unified customer email
        customerName: p.customerName || p.customer?.name,         // Unified customer name
        source: p.source,                                         // Unified source
        currency: p.currency,                                     // Unified currency
        status: p.status,                                         // Unified status
        invoiceCreated: p.invoiceCreated || false,
        invoiceDeclined: p.invoiceDeclined || false,
        invoiceNumber: p.invoiceNumber || null,
        processStatus: p.invoiceCreated ? 'Processed' : p.invoiceDeclined ? 'Declined' : 'Unprocessed'
      }))
    };
    
    return NextResponse.json(results);
    
  } catch (error) {
    console.error('Error searching payments:', error);
    return NextResponse.json(
      { error: 'Failed to search payments' },
      { status: 500 }
    );
  }
}