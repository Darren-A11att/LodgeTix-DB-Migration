import { NextRequest, NextResponse } from 'next/server';

export function assertInternalAuth(req: NextRequest): NextResponse | null {
  const headerKey = req.headers.get('x-internal-key') || '';
  const envKey = process.env.INTERNAL_API_KEY || '';
  if (!envKey) return null; // if not set, do not block locally
  if (headerKey !== envKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

