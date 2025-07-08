import { NextRequest, NextResponse } from 'next/server';
import { uploadPDFToSupabase } from '@/services/pdf-storage';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get('pdf') as File;
    const invoiceNumber = formData.get('invoiceNumber') as string;
    const invoiceType = formData.get('invoiceType') as string;

    if (!pdfFile || !invoiceNumber || !invoiceType) {
      return NextResponse.json(
        { error: 'Missing required fields: pdf, invoiceNumber, or invoiceType' },
        { status: 400 }
      );
    }

    if (invoiceType !== 'customer' && invoiceType !== 'supplier') {
      return NextResponse.json(
        { error: 'Invalid invoice type. Must be "customer" or "supplier"' },
        { status: 400 }
      );
    }

    // Convert File to Blob
    const arrayBuffer = await pdfFile.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });

    // Upload to Supabase
    const publicUrl = await uploadPDFToSupabase(
      blob,
      invoiceNumber,
      invoiceType as 'customer' | 'supplier'
    );

    return NextResponse.json({
      success: true,
      url: publicUrl,
      invoiceNumber,
      invoiceType
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    return NextResponse.json(
      { error: 'Failed to upload PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}