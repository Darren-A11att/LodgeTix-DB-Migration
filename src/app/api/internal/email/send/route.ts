import { NextRequest, NextResponse } from 'next/server';
import { assertInternalAuth } from '../../_lib/auth';
import { sendEmail } from '@/services/email';

export async function POST(req: NextRequest) {
  const unauthorized = assertInternalAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const { to, subject, html, text, from, cc, bcc, attachments } = body || {};
    if (!to || !subject) {
      return NextResponse.json({ error: 'to and subject are required' }, { status: 400 });
    }
    const result = await sendEmail({ to, subject, html, text, from, cc, bcc, attachments });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[internal/email/send] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to send email' }, { status: 500 });
  }
}

