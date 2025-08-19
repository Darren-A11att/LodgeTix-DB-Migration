import PdfGenerator from './generator';
import type { PdfRenderer } from './types';
import { uploadBuffer } from '@/services/storage/supabase-storage';
import { bufferToBase64, sendEmail } from '@/services/email/resend-service';

export interface DistributionActions {
  upload?: {
    bucket?: string;           // default: 'documents'
    path?: string;             // e.g., `${year}/${month}/invoices/${title}.pdf`
    makePublic?: boolean;      // default true
  };
  email?: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachPdf?: boolean;       // default true
    attachmentName?: string;   // default based on renderer title
  };
  external?: {
    url: string;
    method?: 'POST' | 'PUT';
    headers?: Record<string, string>;
    // If provided, send multipart/form-data, else send application/pdf
    formFieldName?: string; // e.g., 'file'
    extraFormFields?: Record<string, string>;
  };
  downloadInBrowser?: boolean;  // if running in browser
}

export interface DistributionResult {
  pdfBuffer: Buffer;
  filename: string;
  uploadedUrl?: string;
  uploadedPath?: string;
  email?: { id?: string; idempotencyKey?: string };
  external?: { status: number };
}

export async function generateAndDistribute(
  renderer: PdfRenderer,
  actions: DistributionActions = {}
): Promise<DistributionResult> {
  const title = renderer.getTitle?.() || 'document';
  const filename = `${title}.pdf`;
  const pdfBuffer = await PdfGenerator.generate({ renderer, preferredEngine: 'pdfkit' });

  const result: DistributionResult = { pdfBuffer, filename };

  // Upload to Supabase
  if (actions.upload) {
    const bucket = actions.upload.bucket || 'documents';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const path = actions.upload.path || `${year}/${month}/${filename}`;
    const { publicUrl, path: uploadedPath } = await uploadBuffer(bucket, path, pdfBuffer, 'application/pdf', actions.upload.makePublic !== false);
    result.uploadedUrl = publicUrl;
    result.uploadedPath = uploadedPath;
  }

  // Send Email via Resend
  if (actions.email) {
    const attachPdf = actions.email.attachPdf !== false;
    const attachments = attachPdf ? [{ filename: actions.email.attachmentName || filename, contentBase64: bufferToBase64(pdfBuffer) }] : [];
    const { data, idempotencyKey } = await sendEmail({
      to: actions.email.to,
      subject: actions.email.subject,
      html: actions.email.html,
      text: actions.email.text,
      from: actions.email.from,
      cc: actions.email.cc,
      bcc: actions.email.bcc,
      attachments,
    });
    result.email = { id: data?.id, idempotencyKey };
  }

  // Send to external API
  if (actions.external) {
    const method = actions.external.method || 'POST';
    let response: Response;
    if (actions.external.formFieldName) {
      const form = new FormData();
      const file = new Blob([pdfBuffer], { type: 'application/pdf' });
      form.append(actions.external.formFieldName, file, filename);
      if (actions.external.extraFormFields) {
        for (const [k, v] of Object.entries(actions.external.extraFormFields)) form.append(k, v);
      }
      response = await fetch(actions.external.url, { method, body: form, headers: actions.external.headers });
    } else {
      response = await fetch(actions.external.url, { method, body: pdfBuffer as unknown as BodyInit, headers: { 'Content-Type': 'application/pdf', ...(actions.external.headers || {}) } });
    }
    result.external = { status: response.status };
  }

  // Client-side download
  if (actions.downloadInBrowser && typeof window !== 'undefined') {
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return result;
}

export default generateAndDistribute;

