import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { assertInternalAuth } from '../../_lib/auth';
import PdfGenerator from '@/services/pdf/generator';
import { ReactPdfRenderer } from '@/services/pdf/renderers/react-pdf-renderer';
import InvoiceDocument from '@/services/pdf/templates/InvoiceDocument';

type DocType = 'invoice'; // extend with other types later

function buildRenderer(type: DocType, props: any) {
  switch (type) {
    case 'invoice':
      return new ReactPdfRenderer(() => (
        React.createElement(InvoiceDocument, props)
      ), props?.invoiceNumber || 'invoice');
    default:
      throw new Error(`Unsupported document type: ${type}`);
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = assertInternalAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const { type, props, includePdf = false } = body as { type: DocType; props: any; includePdf?: boolean };
    if (!type || !props) {
      return NextResponse.json({ error: 'type and props are required' }, { status: 400 });
    }

    const renderer = buildRenderer(type, props);
    const pdfBuffer = await PdfGenerator.generate({ renderer, preferredEngine: 'puppeteer' });

    if (includePdf) {
      return NextResponse.json({
        success: true,
        filename: `${renderer.getTitle?.() || 'document'}.pdf`,
        pdfBase64: Buffer.from(pdfBuffer).toString('base64')
      });
    }

    // default: return as application/pdf
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${renderer.getTitle?.() || 'document'}.pdf"`
      }
    });
  } catch (error: any) {
    console.error('[internal/documents/generate] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate document' }, { status: 500 });
  }
}

