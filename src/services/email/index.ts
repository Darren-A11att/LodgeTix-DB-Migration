import type { EmailClient, SendEmailOptions } from './types';
import { createDefaultResendClient } from './resend-client';

let defaultClient: EmailClient | null = null;

export function getEmailClient(): EmailClient {
  if (!defaultClient) {
    const client = createDefaultResendClient();
    if (!client) throw new Error('RESEND_API_KEY is not configured');
    defaultClient = client;
  }
  return defaultClient;
}

export async function sendEmail(options: SendEmailOptions) {
  const client = getEmailClient();
  return client.send(options);
}

export type { EmailClient, SendEmailOptions } from './types';

