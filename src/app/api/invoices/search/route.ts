import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get('paymentId');
    
    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    // Get the API port from the port config or use default
    const apiPort = process.env.API_PORT || '3006';
    
    // Search for invoices with this payment ID
    const invoicesUrl = `http://localhost:${apiPort}/api/collections/invoices/search`;
    const invoicesResponse = await fetch(invoicesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: { paymentId }
      }),
    });
    
    if (!invoicesResponse.ok) {
      throw new Error('Failed to search invoices');
    }
    
    const invoicesData = await invoicesResponse.json();
    const invoices = invoicesData.documents || [];
    
    return NextResponse.json({ 
      invoices,
      count: invoices.length 
    });
  } catch (error) {
    console.error('Error searching invoices:', error);
    return NextResponse.json({ error: 'Failed to search invoices' }, { status: 500 });
  }
}