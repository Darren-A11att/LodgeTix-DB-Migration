import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import UnifiedInvoiceService from '@/services/unified-invoice-service';

// GET /api/invoices/:paymentId/pdf
// Returns a server-rendered PDF for the specified payment without side effects
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;

  if (!paymentId) {
    return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
  }

  try {
    const { db } = await connectMongoDB();
    const invoiceService = new UnifiedInvoiceService(db);

    // Generate a preview (no DB writes, no emails, no uploads)
    const { invoiceNumber, pdfBuffer } = await invoiceService.generatePreview(paymentId);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoiceNumber}.pdf"`
      }
    });
  } catch (error: any) {
    console.error('[Invoice PDF API] Error:', error);
    const message = error?.message || 'Failed to generate invoice PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

