import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { InvoiceSequence } from '@/utils/invoice-sequence';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payment, registration, customerInvoice, supplierInvoice } = body;
    
    if (!payment || !registration) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectMongoDB();
    const invoiceSequence = new InvoiceSequence(db);
    
    // Use payment date for invoice number generation
    const paymentDate = payment.timestamp ? new Date(payment.timestamp) : new Date();
    
    // Generate customer invoice number
    const customerInvoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber(paymentDate);
    
    // Generate supplier invoice number (same number, different prefix)
    const supplierInvoiceNumber = customerInvoiceNumber.replace('LTIV-', 'LTSP-');
    
    // Return the generated invoice numbers
    // We're not saving the invoices here - that happens when they're actually finalized
    return NextResponse.json({
      success: true,
      customerInvoiceNumber,
      supplierInvoiceNumber
    });
    
  } catch (error) {
    console.error('Error generating invoice numbers:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice numbers' },
      { status: 500 }
    );
  }
}