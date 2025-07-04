import { NextRequest, NextResponse } from 'next/server';
import { sendInvoiceEmail } from '@/services/email-service';
import { Invoice } from '@/types/invoice';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get('pdf') as File;
    const invoiceData = formData.get('invoice') as string;
    const recipientEmail = formData.get('recipientEmail') as string;
    const recipientName = formData.get('recipientName') as string;
    const functionName = formData.get('functionName') as string | null;

    if (!pdfFile || !invoiceData || !recipientEmail || !recipientName) {
      return NextResponse.json(
        { error: 'Missing required fields: pdf, invoice, recipientEmail, or recipientName' },
        { status: 400 }
      );
    }

    // Parse invoice data
    let invoice: Invoice;
    try {
      invoice = JSON.parse(invoiceData);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid invoice data format' },
        { status: 400 }
      );
    }

    // Convert File to Blob
    const arrayBuffer = await pdfFile.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });

    // Send email with attachment
    await sendInvoiceEmail({
      invoice,
      pdfBlob: blob,
      recipientEmail,
      recipientName,
      functionName: functionName || undefined
    });

    return NextResponse.json({
      success: true,
      message: `Invoice email sent successfully to ${recipientEmail}`,
      invoiceNumber: invoice.invoiceNumber
    });
  } catch (error) {
    console.error('Error sending invoice email:', error);
    return NextResponse.json(
      { error: 'Failed to send invoice email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}