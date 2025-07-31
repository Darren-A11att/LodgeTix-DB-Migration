/**
 * Unified Invoice Service
 * 
 * Single service that handles invoice generation both in browser and server-side
 * - Generates PDF using PDFKit (works in both environments)
 * - Uploads to Supabase storage
 * - Sends emails
 * - Updates database records
 */

import { createClient } from '@supabase/supabase-js';
import { Db, ObjectId } from 'mongodb';
import PDFGeneratorService from './pdf-generator-service';

export interface InvoiceGenerationOptions {
  paymentId: string;
  saveToFile?: boolean; // For server-side file saving
  downloadInBrowser?: boolean; // For browser download
  uploadToSupabase?: boolean;
  sendEmail?: boolean;
  regenerate?: boolean;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  status: string;
  customer: {
    name: string;
    email: string;
    address?: string;
    phone?: string;
  };
  event: {
    name: string;
    date?: Date;
    location?: string;
  };
  registration: {
    id: string;
    confirmationNumber: string;
    type: string;
    attendeeCount: number;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  payment: {
    method: string;
    paymentId: string;
    transactionId?: string;
    date: Date;
  };
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  organization: {
    name: string;
    abn: string;
    address: string;
    issuedBy: string;
  };
}

export class UnifiedInvoiceService {
  private db: Db;
  private supabase: any;
  private config = {
    invoicePrefix: 'LTIV-',
    gstRate: 0.1,
    organization: {
      name: 'United Grand Lodge of NSW & ACT',
      abn: '93 230 340 687',
      address: 'Level 5, 279 Castlereagh St Sydney NSW 2000',
      issuedBy: 'LodgeTix as Agent'
    },
    storage: {
      bucket: 'invoices',
      folder: 'generated'
    }
  };

  constructor(db: Db) {
    this.db = db;
    
    // Initialize Supabase if credentials available
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
    }
  }

  /**
   * Main entry point - generates invoice for a payment
   */
  async generateInvoice(options: InvoiceGenerationOptions): Promise<{
    success: boolean;
    invoiceNumber?: string;
    pdfBuffer?: Buffer;
    url?: string;
    error?: string;
  }> {
    try {
      console.log(`[InvoiceService] Generating invoice for payment ${options.paymentId}`);

      // 1. Get payment and registration data
      const payment = await this.db.collection('payments').findOne({
        _id: new ObjectId(options.paymentId)
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (!payment.matchedRegistrationId) {
        throw new Error('Payment has no matched registration');
      }

      // Check if invoice already exists (unless regenerating)
      if (payment.invoiceCreated && !options.regenerate) {
        return {
          success: true,
          invoiceNumber: payment.invoiceNumber,
          url: payment.invoiceUrl,
          error: 'Invoice already exists'
        };
      }

      // 2. Generate invoice data
      const invoiceData = await this.generateInvoiceData(payment);

      // 3. Create PDF
      const pdfBuffer = await this.createPDF(invoiceData);

      // 4. Handle based on environment and options
      let fileUrl: string | undefined;

      if (options.saveToFile && typeof window === 'undefined') {
        // Server-side file saving
        await this.saveToFileSystem(invoiceData.invoiceNumber, pdfBuffer);
      }

      if (options.downloadInBrowser && typeof window !== 'undefined') {
        // Browser download
        this.downloadInBrowser(invoiceData.invoiceNumber, pdfBuffer);
      }

      if (options.uploadToSupabase && this.supabase) {
        // Upload to Supabase storage
        fileUrl = await this.uploadToSupabase(invoiceData.invoiceNumber, pdfBuffer);
      }

      // 5. Update payment record
      await this.updatePaymentRecord(payment._id, {
        invoiceNumber: invoiceData.invoiceNumber,
        invoiceDate: invoiceData.date,
        invoiceAmount: invoiceData.totalAmount,
        invoiceUrl: fileUrl,
        invoiceCreated: true,
        invoiceCreatedAt: new Date()
      });

      // 6. Send email if requested
      if (options.sendEmail && this.supabase && invoiceData.customer.email) {
        await this.sendInvoiceEmail(invoiceData, pdfBuffer);
      }

      return {
        success: true,
        invoiceNumber: invoiceData.invoiceNumber,
        pdfBuffer,
        url: fileUrl
      };

    } catch (error) {
      console.error('[InvoiceService] Error generating invoice:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate invoice data from payment and registration
   */
  private async generateInvoiceData(payment: any): Promise<InvoiceData> {
    // Get registration
    const registration = await this.db.collection('registrations').findOne({
      _id: new ObjectId(payment.matchedRegistrationId)
    });

    if (!registration) {
      throw new Error('Registration not found');
    }

    // Get event details
    const event = await this.db.collection('events').findOne({
      eventId: registration.functionId || registration.eventId
    });

    // Generate or get invoice number
    let invoiceNumber = payment.invoiceNumber;
    if (!invoiceNumber) {
      const counter = await this.db.collection('counters').findOneAndUpdate(
        { _id: 'invoiceNumber' },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: 'after' }
      );
      invoiceNumber = `${this.config.invoicePrefix}${String(counter.value).padStart(9, '0')}`;
    }

    // Calculate amounts
    const subtotal = payment.amount;
    const gstAmount = Math.round(subtotal * this.config.gstRate * 100) / 100;
    const totalAmount = subtotal;

    return {
      invoiceNumber,
      date: new Date(),
      status: 'Paid',
      customer: {
        name: registration.registrationData?.bookingContact?.name || 
              registration.registrationData?.attendees?.[0]?.name ||
              payment.customerName || 
              'Unknown Customer',
        email: registration.registrationData?.bookingContact?.email || 
               payment.customerEmail || 
               '',
        address: registration.registrationData?.bookingContact?.address || '',
        phone: registration.registrationData?.bookingContact?.phone || ''
      },
      event: {
        name: event?.name || 'Event',
        date: event?.startDate || registration.registrationDate,
        location: event?.location || ''
      },
      registration: {
        id: registration.registrationId,
        confirmationNumber: registration.confirmationNumber,
        type: registration.registrationType,
        attendeeCount: registration.attendeeCount || 1
      },
      items: this.buildLineItems(registration),
      payment: {
        method: payment.paymentMethod || 'Card',
        paymentId: payment.paymentId || payment.squarePaymentId,
        transactionId: payment.transactionId,
        date: payment.createdAt
      },
      subtotal: subtotal - gstAmount,
      gstAmount,
      totalAmount,
      organization: this.config.organization
    };
  }

  /**
   * Build line items from registration
   */
  private buildLineItems(registration: any): InvoiceData['items'] {
    const items: InvoiceData['items'] = [];
    const tickets = registration.registrationData?.tickets || [];

    // Group tickets by type
    const ticketGroups: Record<string, any> = {};
    
    tickets.forEach((ticket: any) => {
      const key = `${ticket.eventTicketId}-${ticket.price}`;
      if (!ticketGroups[key]) {
        ticketGroups[key] = {
          name: ticket.name || 'Ticket',
          price: ticket.price || 0,
          quantity: 0
        };
      }
      ticketGroups[key].quantity += ticket.quantity || 1;
    });

    // Convert to line items
    Object.values(ticketGroups).forEach(group => {
      items.push({
        description: group.name,
        quantity: group.quantity,
        unitPrice: group.price,
        total: group.price * group.quantity
      });
    });

    // If no tickets, create a single line item
    if (items.length === 0) {
      items.push({
        description: `${registration.registrationType} Registration`,
        quantity: registration.attendeeCount || 1,
        unitPrice: registration.totalAmountPaid || 0,
        total: registration.totalAmountPaid || 0
      });
    }

    return items;
  }

  /**
   * Create PDF using PDFKit with fallback to jsPDF
   */
  private async createPDF(invoiceData: InvoiceData): Promise<Buffer> {
    try {
      // Use the PDF generator service which handles environment detection and fallback
      return await PDFGeneratorService.generatePDF({
        invoiceData,
        // Try PDFKit first for better quality, but will fallback to jsPDF if it fails
        preferredEngine: 'pdfkit'
      });
    } catch (error) {
      console.error('[InvoiceService] PDF generation failed:', error);
      // Last resort: try jsPDF directly
      return await PDFGeneratorService.generatePDF({
        invoiceData,
        preferredEngine: 'jspdf'
      });
    }
  }

  /**
   * Save PDF to file system (server-side only)
   */
  private async saveToFileSystem(invoiceNumber: string, pdfBuffer: Buffer): Promise<void> {
    if (typeof window !== 'undefined') return;

    const fs = await import('fs/promises');
    const path = await import('path');
    
    const outputDir = path.join(process.cwd(), 'invoices');
    await fs.mkdir(outputDir, { recursive: true });
    
    const filepath = path.join(outputDir, `${invoiceNumber}.pdf`);
    await fs.writeFile(filepath, pdfBuffer);
    
    console.log(`[InvoiceService] Saved to file: ${filepath}`);
  }

  /**
   * Download PDF in browser
   */
  private downloadInBrowser(invoiceNumber: string, pdfBuffer: Buffer): void {
    if (typeof window === 'undefined') return;

    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`[InvoiceService] Downloaded: ${invoiceNumber}.pdf`);
  }

  /**
   * Upload PDF to Supabase storage
   */
  private async uploadToSupabase(invoiceNumber: string, pdfBuffer: Buffer): Promise<string> {
    const filename = `${this.config.storage.folder}/${invoiceNumber}.pdf`;
    
    const { data, error } = await this.supabase.storage
      .from(this.config.storage.bucket)
      .upload(filename, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      throw new Error(`Failed to upload to Supabase: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = this.supabase.storage
      .from(this.config.storage.bucket)
      .getPublicUrl(filename);

    console.log(`[InvoiceService] Uploaded to Supabase: ${publicUrl}`);
    return publicUrl;
  }

  /**
   * Send invoice email
   */
  private async sendInvoiceEmail(invoiceData: InvoiceData, pdfBuffer: Buffer): Promise<void> {
    // Use Supabase Edge Function or your email service
    const { error } = await this.supabase.functions.invoke('send-invoice-email', {
      body: {
        to: invoiceData.customer.email,
        customerName: invoiceData.customer.name,
        invoiceNumber: invoiceData.invoiceNumber,
        eventName: invoiceData.event.name,
        totalAmount: invoiceData.totalAmount,
        pdfBase64: pdfBuffer.toString('base64')
      }
    });

    if (error) {
      console.error('[InvoiceService] Failed to send email:', error);
      // Don't throw - email failure shouldn't stop invoice generation
    } else {
      console.log(`[InvoiceService] Email sent to ${invoiceData.customer.email}`);
    }
  }

  /**
   * Update payment record with invoice details
   */
  private async updatePaymentRecord(paymentId: ObjectId, updates: any): Promise<void> {
    await this.db.collection('payments').updateOne(
      { _id: paymentId },
      { $set: updates }
    );
  }

  /**
   * Batch process multiple invoices (for server-side automation)
   */
  async batchProcessInvoices(options: {
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    regenerate?: boolean;
  } = {}): Promise<{
    processed: number;
    failed: number;
    errors: string[];
  }> {
    const query: any = {
      matchedRegistrationId: { $exists: true, $ne: null },
      status: 'paid'
    };

    if (!options.regenerate) {
      query.invoiceCreated = { $ne: true };
    }

    if (options.dateFrom || options.dateTo) {
      query.createdAt = {};
      if (options.dateFrom) query.createdAt.$gte = options.dateFrom;
      if (options.dateTo) query.createdAt.$lte = options.dateTo;
    }

    const payments = await this.db.collection('payments')
      .find(query)
      .limit(options.limit || 1000)
      .toArray();

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const payment of payments) {
      const result = await this.generateInvoice({
        paymentId: payment._id.toString(),
        saveToFile: true,
        uploadToSupabase: true,
        sendEmail: true,
        regenerate: options.regenerate
      });

      if (result.success) {
        results.processed++;
      } else {
        results.failed++;
        results.errors.push(`Payment ${payment._id}: ${result.error}`);
      }
    }

    return results;
  }
}

// Export for use in both environments
export default UnifiedInvoiceService;