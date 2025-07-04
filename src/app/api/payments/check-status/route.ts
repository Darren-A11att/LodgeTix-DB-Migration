import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }
    
    // Get the API port from the port config or use default
    const apiPort = process.env.API_PORT || '3006';
    
    // Search for payments with this email
    const paymentsUrl = `http://localhost:${apiPort}/api/collections/payments/search`;
    const paymentsResponse = await fetch(paymentsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: {
          $or: [
            { customerEmail: email },
            { email: email },
            { 'customer.email': email }
          ]
        }
      }),
    });
    
    if (!paymentsResponse.ok) {
      throw new Error('Failed to search payments');
    }
    
    const paymentsData = await paymentsResponse.json();
    const payments = paymentsData.documents || [];
    
    // Check for invoices with this email
    const invoicesUrl = `http://localhost:${apiPort}/api/collections/invoices/search`;
    const invoicesResponse = await fetch(invoicesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: {
          'billTo.email': email
        }
      }),
    });
    
    const invoicesData = invoicesResponse.ok ? await invoicesResponse.json() : { documents: [] };
    const invoices = invoicesData.documents || [];
    
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
      email,
      payments: payments.map((p: any) => ({
        id: p._id,
        transactionId: p.transactionId || p.paymentId,
        amount: p.amount || p.grossAmount,
        date: p.timestamp || p.createdAt,
        invoiceCreated: p.invoiceCreated || false,
        invoiceDeclined: p.invoiceDeclined || false,
        invoiceNumber: p.invoiceNumber || null,
        invoiceId: p.invoiceId || null,
        customerEmail: findEmailInPayment(p)
      })),
      invoices: invoices.map((i: any) => ({
        id: i._id,
        invoiceNumber: i.invoiceNumber,
        paymentId: i.paymentId,
        total: i.total,
        date: i.date || i.createdAt,
        type: i.invoiceType
      })),
      summary: {
        totalPayments: payments.length,
        processedPayments: payments.filter((p: any) => p.invoiceCreated).length,
        declinedPayments: payments.filter((p: any) => p.invoiceDeclined).length,
        totalInvoices: invoices.length
      }
    };
    
    return NextResponse.json(results);
    
  } catch (error) {
    console.error('Error checking payment status:', error);
    return NextResponse.json(
      { error: 'Failed to check payment status' },
      { status: 500 }
    );
  }
}