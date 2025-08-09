import { NextRequest, NextResponse } from 'next/server';
import { assertInternalAuth } from '../../_lib/auth';
import { connectMongoDB } from '@/lib/mongodb';
import DocumentFactory from '@/app/documents/DocumentFactory';
import DocumentOrchestrator from '@/app/documents/DocumentOrchestrator';

export async function POST(req: NextRequest) {
  const unauthorized = assertInternalAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const { type, input, actions, preferredEngine } = body || {};
    if (!type || !input) {
      return NextResponse.json({ error: 'type and input are required' }, { status: 400 });
    }

    const { db } = await connectMongoDB();
    const doc = DocumentFactory.get(type);
    const orchestrator = new DocumentOrchestrator(doc, { db });
    const { data, result } = await orchestrator.renderAndDistribute(input, actions || {}, preferredEngine || 'puppeteer');

    return NextResponse.json({ success: true, filename: result.filename, uploadedUrl: result.uploadedUrl, uploadedPath: result.uploadedPath, email: result.email, external: result.external });
  } catch (error: any) {
    console.error('[internal/documents/generate-and-distribute] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate and distribute' }, { status: 500 });
  }
}

