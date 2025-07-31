/**
 * JavaScript wrapper for the Unified Invoice Service
 * This provides a CommonJS interface to the TypeScript service
 */

const { createClient } = require('@supabase/supabase-js');
const { jsPDF } = require('jspdf');

class InvoiceServiceWrapper {
  constructor(db) {
    this.db = db;
    this.config = {
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
    
    // Initialize Supabase if credentials available
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
    }
  }

  async batchProcessInvoices(options = {}) {
    const query = {
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
      errors: []
    };

    console.log(`Found ${payments.length} payments to process`);

    for (const payment of payments) {
      try {
        const result = await this.generateInvoice({
          paymentId: payment._id.toString(),
          saveToFile: true,
          uploadToSupabase: true,
          sendEmail: true,
          regenerate: options.regenerate
        });

        if (result.success) {
          results.processed++;
          console.log(`✓ Processed invoice for payment ${payment._id}`);
        } else {
          results.failed++;
          results.errors.push(`Payment ${payment._id}: ${result.error}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Payment ${payment._id}: ${error.message}`);
      }
    }

    return results;
  }

  async generateInvoice(options) {
    try {
      const { ObjectId } = require('mongodb');
      
      // Get payment and registration data
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

      // Generate invoice data
      const invoiceData = await this.generateInvoiceData(payment);

      // Create PDF
      const pdfBuffer = await this.createPDF(invoiceData);

      // Handle based on options
      let fileUrl;

      if (options.saveToFile) {
        await this.saveToFileSystem(invoiceData.invoiceNumber, pdfBuffer);
      }

      if (options.uploadToSupabase && this.supabase) {
        fileUrl = await this.uploadToSupabase(invoiceData.invoiceNumber, pdfBuffer);
      }

      // Update payment record
      await this.db.collection('payments').updateOne(
        { _id: payment._id },
        { 
          $set: {
            invoiceNumber: invoiceData.invoiceNumber,
            invoiceDate: invoiceData.date,
            invoiceAmount: invoiceData.totalAmount,
            invoiceUrl: fileUrl,
            invoiceCreated: true,
            invoiceCreatedAt: new Date()
          }
        }
      );

      // Send email if requested
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
      console.error('Error generating invoice:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateInvoiceData(payment) {
    const { ObjectId } = require('mongodb');
    
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

  buildLineItems(registration) {
    const items = [];
    const tickets = registration.registrationData?.tickets || [];

    // Group tickets by type
    const ticketGroups = {};
    
    tickets.forEach((ticket) => {
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

  async createPDF(invoiceData) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Set default font
    doc.setFont('helvetica');
    
    let y = 20;
    
    // Header
    doc.setFontSize(20);
    doc.text('Tax Invoice', 20, y);
    y += 15;
    
    // Invoice details
    doc.setFontSize(10);
    doc.text(`Date: ${invoiceData.date.toLocaleDateString()}`, 20, y);
    y += 7;
    doc.text(`Invoice No: ${invoiceData.invoiceNumber}`, 20, y);
    y += 7;
    doc.text(`Status: ${invoiceData.status}`, 20, y);
    y += 15;
    
    // Bill To
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 7;
    doc.text(invoiceData.customer.name, 20, y);
    y += 7;
    doc.text(invoiceData.customer.email, 20, y);
    if (invoiceData.customer.address) {
      y += 7;
      doc.text(invoiceData.customer.address, 20, y);
    }
    
    // From (right side)
    let fromY = y - 21; // Align with Bill To
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('From:', 120, fromY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    fromY += 7;
    doc.text(invoiceData.organization.name, 120, fromY);
    fromY += 7;
    doc.text(`ABN: ${invoiceData.organization.abn}`, 120, fromY);
    fromY += 7;
    
    // Split address if too long
    const addressLines = doc.splitTextToSize(invoiceData.organization.address, 70);
    addressLines.forEach((line) => {
      doc.text(line, 120, fromY);
      fromY += 7;
    });
    
    doc.text(`Issued By: ${invoiceData.organization.issuedBy}`, 120, fromY);
    
    // Move y to after both sections
    y = Math.max(y, fromY) + 15;
    
    // Event details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Event Details:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 7;
    doc.text(`Event: ${invoiceData.event.name}`, 20, y);
    doc.text(`Confirmation: ${invoiceData.registration.confirmationNumber}`, 120, y);
    y += 15;
    
    // Items table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Items:', 20, y);
    y += 7;
    
    // Table header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('Description', 20, y);
    doc.text('Qty', 120, y);
    doc.text('Unit Price', 140, y);
    doc.text('Total', 170, y);
    doc.setTextColor(0);
    
    // Line
    y += 2;
    doc.line(20, y, 190, y);
    y += 5;
    
    // Items
    invoiceData.items.forEach((item) => {
      // Handle long descriptions
      const descLines = doc.splitTextToSize(item.description, 90);
      descLines.forEach((line, index) => {
        if (index === 0) {
          doc.text(line, 20, y);
          doc.text(String(item.quantity), 120, y);
          doc.text(`$${item.unitPrice.toFixed(2)}`, 140, y);
          doc.text(`$${item.total.toFixed(2)}`, 170, y);
        } else {
          y += 5;
          doc.text(line, 20, y);
        }
      });
      y += 7;
    });
    
    // Totals
    y += 3;
    doc.line(120, y, 190, y);
    y += 7;
    
    doc.text('Subtotal:', 120, y);
    doc.text(`$${invoiceData.subtotal.toFixed(2)}`, 170, y);
    y += 7;
    
    doc.text('GST (10%):', 120, y);
    doc.text(`$${invoiceData.gstAmount.toFixed(2)}`, 170, y);
    y += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Total:', 120, y);
    doc.text(`$${invoiceData.totalAmount.toFixed(2)}`, 170, y);
    
    // Payment info
    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Payment Information', 20, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Method: ${invoiceData.payment.method}`, 20, y);
    doc.text(`Date: ${invoiceData.payment.date.toLocaleDateString()}`, 70, y);
    doc.text(`Amount: $${invoiceData.totalAmount.toFixed(2)}`, 120, y);
    
    // Convert to buffer
    const pdfData = doc.output('arraybuffer');
    return Buffer.from(pdfData);
  }

  async saveToFileSystem(invoiceNumber, pdfBuffer) {
    const fs = require('fs/promises');
    const path = require('path');
    
    const outputDir = path.join(process.cwd(), 'invoices');
    await fs.mkdir(outputDir, { recursive: true });
    
    const filepath = path.join(outputDir, `${invoiceNumber}.pdf`);
    await fs.writeFile(filepath, pdfBuffer);
    
    console.log(`[InvoiceService] Saved to file: ${filepath}`);
  }

  async uploadToSupabase(invoiceNumber, pdfBuffer) {
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

  async sendInvoiceEmail(invoiceData, pdfBuffer) {
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
}

module.exports = InvoiceServiceWrapper;