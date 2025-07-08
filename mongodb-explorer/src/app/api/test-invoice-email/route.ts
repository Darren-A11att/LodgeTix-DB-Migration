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
        address: '123 Test Street, Sydney NSW 2000',
        issuedBy: 'Test Issuer'
      },
      billTo: {
        firstName: 'Test',
        lastName: 'Customer',
        email: 'darren@allatt.me',
        addressLine1: '456 Customer Street',
        city: 'Sydney',
        postalCode: '2000',
        stateProvince: 'NSW',
        country: 'AU'
      },
      items: [
        {
          description: 'Test Item',
          quantity: 1,
          price: 100
        }
      ],
      subtotal: 100,
      processingFees: 0,
      gstIncluded: 10,
      total: 100
    };

    // Create a test PDF blob (simple placeholder)
    const pdfContent = 'This is a test PDF content';
    const pdfBlob = new Blob([pdfContent], { type: 'application/pdf' });

    // Send the email
    const result = await sendInvoiceEmail({
      pdfBlob,
      invoice: testInvoice,
      recipientEmail: 'darren@allatt.me',
      recipientName: 'Test Customer'
    });

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      emailId: result.id
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}