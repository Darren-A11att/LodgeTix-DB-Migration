export interface EmailAttachment {
  filename: string;
  contentBase64: string;
  contentType?: string; // default 'application/pdf'
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
}

export interface EmailClient {
  send(options: SendEmailOptions): Promise<{ id?: string; idempotencyKey?: string }>;
}

