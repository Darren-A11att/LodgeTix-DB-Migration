import { Resend } from 'resend';

export interface EmailAttachment {
  filename: string;
  contentBase64: string; // base64-encoded content
  contentType?: string;  // default application/pdf
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string; // defaults to RESEND_FROM_EMAIL
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
}

let resend: Resend | null = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

function ensureResend() {
  if (!resend) throw new Error('RESEND_API_KEY is not configured');
  return resend;
}

export async function sendEmail(options: SendEmailOptions): Promise<any> {
  const client = ensureResend();
  const from = options.from || process.env.RESEND_FROM_EMAIL || 'no-reply@lodgetix.io';

  // Map attachments to Resend shape (filename + base64 content)
  const attachments = (options.attachments || []).map(a => ({
    filename: a.filename,
    content: a.contentBase64,
  }));

  const payload: any = {
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments,
  };
  if (options.cc) payload.cc = options.cc;
  if (options.bcc) payload.bcc = options.bcc;

  const idempotencyKey = cryptoRandomId();
  const { data, error } = await client.emails.send(payload, { idempotencyKey });
  if (error) throw error;
  return { data, idempotencyKey };
}

export function bufferToBase64(buffer: Buffer): string {
  return Buffer.from(buffer).toString('base64');
}

function cryptoRandomId(): string {
  // Simple idempotency key generator
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

