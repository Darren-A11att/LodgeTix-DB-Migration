import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import UnifiedInvoiceService from '@/services/unified-invoice-service';

export async function POST(request: NextRequest) {
  let client: MongoClient | null = null;
  try {
    const body = await request.json();
    const { paymentId } = body || {};
    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    const uri = process.env.MONGODB_URI!;
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1');

    const invoiceService = new UnifiedInvoiceService(db);
    const { invoiceNumber, pdfBuffer } = await invoiceService.generatePreview(paymentId);

    return NextResponse.json({
      success: true,
      invoiceNumber,
      pdfBase64: pdfBuffer.toString('base64')
    });
  } catch (error) {
    console.error('Invoice preview error:', error);
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 });
  } finally {
    if (client) await client.close();
  }
}

