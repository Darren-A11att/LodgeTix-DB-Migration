import { NextRequest, NextResponse } from 'next/server';
import { assertInternalAuth } from '../../_lib/auth';
import { uploadBuffer } from '@/services/storage/supabase-storage';

export async function POST(req: NextRequest) {
  const unauthorized = assertInternalAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const { bucket = 'documents', path, base64, contentType = 'application/pdf', makePublic = true } = body || {};
    if (!path || !base64) {
      return NextResponse.json({ error: 'path and base64 are required' }, { status: 400 });
    }
    const buffer = Buffer.from(base64, 'base64');
    const { publicUrl, path: uploadedPath } = await uploadBuffer(bucket, path, buffer, contentType, makePublic);
    return NextResponse.json({ success: true, publicUrl, path: uploadedPath });
  } catch (error: any) {
    console.error('[internal/storage/upload] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to upload' }, { status: 500 });
  }
}

