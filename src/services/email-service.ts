import { Resend } from 'resend';
import { Invoice } from '../types/invoice';

// Initialize Resend client only if API key is available
let resend: Resend | null = null;

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded content
}

interface SendInvoiceEmailParams {
  invoice: Invoice;
  pdfBlob: Blob;
  recipientEmail: string;
  recipientName: string;
  functionName?: string;
}

interface EmailMetadata {
  id: string;
  idempotencyKey: string;
  service: string;
  from: string;
  sent: Date;
  scheduled_at?: string;
  to: string;
  cc?: string;
  bcc?: string;
  reply_to?: string;
  subject: string;
  attachments: string[];
  tags?: Array<{ name: string; value: string }>;
  plainContent: object;
  htmlContent: object;
}

/**
 * Convert a Blob to Base64 string (works in Node.js environment)
 */
async function blobToBase64(blob: Blob): Promise<string> {
  // Convert Blob to ArrayBuffer
  const arrayBuffer = await blob.arrayBuffer();
  
  // Convert ArrayBuffer to Buffer
  const buffer = Buffer.from(arrayBuffer);
  
  // Convert Buffer to Base64
  return buffer.toString('base64');
}

/**
 * Send an invoice email with PDF attachment
 */
export async function sendInvoiceEmail({
  invoice,
  pdfBlob,
  recipientEmail,
  recipientName,
  functionName
}: SendInvoiceEmailParams): Promise<EmailMetadata> {
  console.log('✉️ Email Service: sendInvoiceEmail called');
  console.log('✉️ Parameters received:', {
    hasInvoice: !!invoice,
    invoiceNumber: invoice?.invoiceNumber,
    hasPdfBlob: !!pdfBlob,
    recipientEmail,
    recipientName,
    functionName,
    functionNameType: typeof functionName
  });
  
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  try {
    // Convert PDF blob to base64
    const base64Content = await blobToBase64(pdfBlob);

    // Extract function name from invoice items if not provided
    let eventName = functionName;
    console.log('✉️ Initial eventName from parameter:', eventName);
    
    // If no function name provided, try to extract from invoice items
    if (!eventName && invoice.items && invoice.items.length > 0) {
      console.log('✉️ No functionName provided, attempting to extract from invoice items');
      console.log('✉️ Invoice items:', JSON.stringify(invoice.items, null, 2));
      
      // Look for function name in the first item's description
      // Format is usually: "IND-123456XX | Individuals for [Function Name]"
      const firstItem = invoice.items[0];
      if (firstItem.description) {
        console.log('✉️ First item description:', firstItem.description);
        const match = firstItem.description.match(/for\s+(.+?)(?:\s*\||$)/i);
        if (match && match[1]) {
          eventName = match[1].trim();
          console.log('✉️ Extracted function name from invoice:', eventName);
        } else {
          console.log('✉️ Could not extract function name from description');
        }
      }
    }
    
    // For now, always use "Grand Proclamation 2025" as the function name
    eventName = 'Grand Proclamation 2025';
    console.log('✉️ Final eventName to use in email:', eventName);

    // Create plain text version of the email
    const emailText = `Dear ${recipientName},

Thank you for registering for ${eventName}. Please find attached your tax invoice issued by LodgeTix as Agent for ${invoice.supplier.name}.

If you have any questions or need any further assistance please do not hesitate to contact LodgeTix:

By email: support@lodgetix.io
By phone: 0408 925 926

Sincerely,

LodgeTix Customer Support

---
This is a transactional email. Need help? Email: support@lodgetix.io or Phone: 0408 925 926`;

    // Create the email HTML content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header {
            background-color: #ffffff;
            padding: 20px;
            border-bottom: 1px solid #e5e7eb;
            text-align: center;
          }
          .logo-container {
            display: inline-flex;
            align-items: center;
            font-size: 20px;
            font-weight: bold;
            color: #1e3a8a;
          }
          .content {
            padding: 30px 20px;
          }
          .footer {
            background-color: #1e3a8a;
            color: #ffffff;
            padding: 20px;
            text-align: center;
            font-size: 14px;
          }
          .footer p {
            margin: 5px 0;
            color: #ffffff;
          }
          .footer a {
            color: #ffffff !important;
            text-decoration: none;
          }
          a {
            color: #ffffff;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <!-- Header -->
          <div class="header">
            <div class="logo-container">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>
                <path d="M13 5v2"></path>
                <path d="M13 17v2"></path>
                <path d="M13 11v2"></path>
              </svg>
              <span>LodgeTix</span>
            </div>
          </div>
          
          <!-- Content -->
          <div class="content">
            <p>Dear ${recipientName},</p>
            
            <p>Thank you for registering for ${eventName}. Please find attached your tax invoice issued by LodgeTix as Agent for ${invoice.supplier.name}.</p>
            
            <p>If you have any questions or need any further assistance please do not hesitate to contact LodgeTix:</p>
            
            <p style="margin-left: 20px;">
              By email: <a href="mailto:support@lodgetix.io" style="color: #1e3a8a;">support@lodgetix.io</a><br>
              By phone: <a href="tel:0408925926" style="color: #1e3a8a;">0408 925 926</a>
            </p>
            
            <p style="margin-top: 30px;">
              Sincerely,<br><br>
              LodgeTix Customer Support
            </p>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p>This is a transactional email. Need help? Email: <a href="mailto:support@lodgetix.io">support@lodgetix.io</a> or Phone: <a href="tel:0408925926">0408 925 926</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Build email options
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'invoices@lodgetix.io';
    const fromName = 'LodgeTix as Agent for UGL NSW & ACT';
    const fromFormatted = `${fromName} <${fromEmail}>`;
    const toFormatted = `${recipientName} <${recipientEmail}>`;
    const subject = `Tax Invoice ${invoice.invoiceNumber} for ${eventName}`;
    const attachmentFilename = `${invoice.invoiceNumber}.pdf`;
    
    const emailOptions: any = {
      from: fromFormatted,
      to: toFormatted,
      subject: subject,
      html: emailHtml,
      text: emailText,
      attachments: [
        {
          filename: attachmentFilename,
          content: base64Content
        }
      ]
    };

    // Add BCC if configured
    let bccFormatted: string | undefined;
    if (process.env.RESEND_BCC_EMAIL) {
      bccFormatted = process.env.RESEND_BCC_EMAIL;
      emailOptions.bcc = bccFormatted;
    }

    // Generate idempotency key using invoice number and type
    const idempotencyKey = `invoice-email/${invoice.invoiceType}/${invoice.invoiceNumber}`;
    
    console.log('Sending invoice email with idempotency key:', idempotencyKey);

    const { data, error } = await resend.emails.send(emailOptions, {
      idempotencyKey
    });

    if (error) {
      console.error('Error sending email:', error);
      throw error;
    }

    console.log('Email sent successfully:', data, 'with idempotency key:', idempotencyKey);
    
    // Build and return email metadata
    const emailMetadata: EmailMetadata = {
      id: data?.id || '',
      idempotencyKey: idempotencyKey,
      service: 'resend',
      from: fromFormatted,
      sent: new Date(),
      scheduled_at: undefined, // Not using scheduled emails
      to: toFormatted,
      cc: undefined, // Not using CC
      bcc: bccFormatted,
      reply_to: undefined, // Using default reply-to
      subject: subject,
      attachments: [attachmentFilename],
      tags: undefined, // Not using tags
      plainContent: { text: emailText },
      htmlContent: { html: emailHtml }
    };
    
    return emailMetadata;
  } catch (error) {
    console.error('Failed to send invoice email:', error);
    throw error;
  }
}

/**
 * Send a test email to verify Resend configuration
 */
export async function sendTestEmail(recipientEmail: string): Promise<void> {
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'test@lodgetix.io',
      to: recipientEmail,
      subject: 'Test Email - LodgeTix Invoice System',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Test Email</h2>
          <p>This is a test email from the LodgeTix invoice system.</p>
          <p>If you received this email, your Resend configuration is working correctly!</p>
        </div>
      `
    });

    if (error) {
      console.error('Error sending test email:', error);
      throw error;
    }

    console.log('Test email sent successfully:', data);
  } catch (error) {
    console.error('Failed to send test email:', error);
    throw error;
  }
}