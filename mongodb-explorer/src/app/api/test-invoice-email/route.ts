import { NextRequest, NextResponse } from 'next/server';
import { sendInvoiceEmail } from '@/services/email-service';
import { Invoice } from '@/types/invoice';

export async function POST(request: NextRequest) {
  try {
    // Create a test invoice
    const testInvoice: Invoice = {
      invoiceNumber: 'TEST-001',
      date: new Date(),
      status: 'paid',
      supplier: {
        name: 'Test Supplier',
        abn: '12 345 678 901',
        address: '123 Test Street, Sydney NSW 2000'
      },
      billTo: {
        name: 'Test Customer',
        email: 'darren@allatt.me',
        phone: '+61 400 000 000'
      },
      items: [
        {
          description: 'Test Item',
          quantity: 1,
          price: 100
        }
      ],
      subtotal: 100,
      processingFees: 2.50,
      gstIncluded: 10.23,
      total: 102.50,
      payment: {
        method: 'credit_card',
        transactionId: 'test_123',
        paidDate: new Date(),
        amount: 102.50,
        currency: 'AUD',
        status: 'completed',
        source: 'test'
      }
    };

    // Create a simple test PDF content
    const pdfContent = 'Test PDF Content';
    const pdfBlob = new Blob([pdfContent], { type: 'application/pdf' });

    await sendInvoiceEmail({
      invoice: testInvoice,
      pdfBlob,
      recipientEmail: 'darren@allatt.me',
      recipientName: 'Darren Allatt'
    });
    
    return NextResponse.json({
      success: true,
      message: 'Test invoice email sent to darren@allatt.me'
    });
  } catch (error) {
    console.error('Error sending test invoice email:', error);
    return NextResponse.json(
      { error: 'Failed to send test invoice email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}