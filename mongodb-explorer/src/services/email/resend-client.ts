import { Resend } from 'resend';
import type { EmailAttachment, EmailClient, SendEmailOptions } from './types';

function toBase64(content: Buffer | string): string {
  return Buffer.isBuffer(content) ? content.toString('base64') : Buffer.from(content).toString('base64');
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class ResendEmailClient implements EmailClient {
  private client: Resend;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom?: string) {
    this.client = new Resend(apiKey);
    this.defaultFrom = defaultFrom || process.env.RESEND_FROM_EMAIL || 'no-reply@lodgetix.io';
  }

  async send(options: SendEmailOptions): Promise<{ id?: string; idempotencyKey?: string }> {
    const idempotencyKey = randomId();

    const attachments = (options.attachments || []).map((a: EmailAttachment) => ({
      filename: a.filename,
      content: a.contentBase64,
    }));

    const payload: any = {
      from: options.from || this.defaultFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments,
    };
    if (options.cc) payload.cc = options.cc;
    if (options.bcc) payload.bcc = options.bcc;

    const { data, error } = await this.client.emails.send(payload, { idempotencyKey });
    if (error) throw error;
    return { id: data?.id, idempotencyKey };
  }
}

export function createDefaultResendClient(): EmailClient | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new ResendEmailClient(key, process.env.RESEND_FROM_EMAIL);
}

export function bufferToBase64(buf: Buffer): string { return toBase64(buf); }

