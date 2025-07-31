#!/usr/bin/env node

/**
 * Invoice Processor Server
 * 
 * This server runs after payment and registration imports to automatically:
 * 1. Find matched payments and registrations
 * 2. Generate invoices
 * 3. Create PDF files
 * 4. Store them in the database
 * 
 * Can be run standalone or integrated into the import workflow
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient, ObjectId } = require('mongodb');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');

class InvoiceProcessor {
  constructor() {
    this.db = null;
    this.client = null;
    this.config = {
      batchSize: 50,
      outputDir: path.join(__dirname, '../invoices'),
      logoPath: path.join(__dirname, '../assets/freemasons-logo.png'),
      // Invoice settings
      invoicePrefix: 'LTIV-',
      gstRate: 0.1, // 10% GST
      // Organization details
      organization: {
        name: 'United Grand Lodge of NSW & ACT',
        abn: '93 230 340 687',
        address: 'Level 5, 279 Castlereagh St Sydney NSW 2000',
        issuedBy: 'LodgeTix as Agent'
      }
    };
  }

  async connect() {
    this.client = new MongoClient(process.env.MONGODB_URI);
    await this.client.connect();
    this.db = this.client.db(process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1');
    console.log('Connected to MongoDB');
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('Disconnected from MongoDB');
    }
  }

  /**
   * Main processing function
   */
  async processInvoices(options = {}) {
    const {
      dryRun = false,
      specificPaymentId = null,
      dateFrom = null,
      dateTo = null,
      regenerate = false
    } = options;

    try {
      console.log('=== INVOICE PROCESSOR STARTING ===\n');
      
      // Ensure output directory exists
      await fs.mkdir(this.config.outputDir, { recursive: true });

      // Find payments that need invoice processing
      const payments = await this.findPaymentsForInvoicing({
        specificPaymentId,
        dateFrom,
        dateTo,
        regenerate
      });

      console.log(`Found ${payments.length} payments to process\n`);

      let processed = 0;
      let failed = 0;

      // Process in batches
      for (let i = 0; i < payments.length; i += this.config.batchSize) {
        const batch = payments.slice(i, i + this.config.batchSize);
        
        for (const payment of batch) {
          try {
            console.log(`Processing payment ${payment.paymentId || payment.squarePaymentId}...`);
            
            if (dryRun) {
              console.log('  [DRY RUN] Would generate invoice');
              processed++;
              continue;
            }

            // Generate invoice data
            const invoiceData = await this.generateInvoiceData(payment);
            
            // Create PDF
            const pdfBuffer = await this.createInvoicePDF(invoiceData);
            
            // Save to file system
            const filename = `${invoiceData.invoiceNumber}.pdf`;
            const filepath = path.join(this.config.outputDir, filename);
            await fs.writeFile(filepath, pdfBuffer);
            
            // Update database
            await this.updatePaymentWithInvoice(payment._id, {
              invoiceNumber: invoiceData.invoiceNumber,
              invoiceDate: invoiceData.date,
              invoiceAmount: invoiceData.totalAmount,
              invoicePath: filepath,
              invoiceCreated: true,
              invoiceCreatedAt: new Date()
            });
            
            console.log(`  ✓ Generated invoice ${invoiceData.invoiceNumber}`);
            processed++;
            
          } catch (error) {
            console.error(`  ✗ Failed to process payment ${payment._id}:`, error.message);
            failed++;
          }
        }
      }

      console.log('\n=== PROCESSING COMPLETE ===');
      console.log(`Processed: ${processed}`);
      console.log(`Failed: ${failed}`);
      console.log(`Total: ${payments.length}`);

      return {
        processed,
        failed,
        total: payments.length
      };

    } catch (error) {
      console.error('Invoice processing failed:', error);
      throw error;
    }
  }

  /**
   * Find payments that need invoicing
   */
  async findPaymentsForInvoicing({ specificPaymentId, dateFrom, dateTo, regenerate }) {
    const query = {
      // Must have a matched registration
      matchedRegistrationId: { $exists: true, $ne: null },
      // Must be paid
      status: 'paid'
    };

    // Add filters
    if (specificPaymentId) {
      query._id = new ObjectId(specificPaymentId);
    }

    if (!regenerate) {
      // Only process payments without invoices
      query.invoiceCreated = { $ne: true };
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    return await this.db.collection('payments')
      .find(query)
      .sort({ createdAt: 1 })
      .toArray();
  }

  /**
   * Generate invoice data from payment and registration
   */
  async generateInvoiceData(payment) {
    // Get registration details
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

    // Generate invoice number
    const invoiceCount = await this.db.collection('counters').findOneAndUpdate(
      { _id: 'invoiceNumber' },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    
    const invoiceNumber = `${this.config.invoicePrefix}${String(invoiceCount.value).padStart(9, '0')}`;

    // Calculate amounts
    const subtotal = payment.amount;
    const gstAmount = Math.round(subtotal * this.config.gstRate * 100) / 100;
    const totalAmount = subtotal; // Assuming amount includes GST

    // Build invoice data
    const invoiceData = {
      invoiceNumber,
      date: new Date(),
      status: 'Paid',
      
      // Customer details
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

      // Event details
      event: {
        name: event?.name || 'Event',
        date: event?.startDate || registration.registrationDate,
        location: event?.location || ''
      },

      // Registration details
      registration: {
        id: registration.registrationId,
        confirmationNumber: registration.confirmationNumber,
        type: registration.registrationType,
        attendeeCount: registration.attendeeCount || 1
      },

      // Line items from tickets
      items: this.buildLineItems(registration),

      // Payment details
      payment: {
        method: payment.paymentMethod || 'Card',
        paymentId: payment.paymentId || payment.squarePaymentId,
        transactionId: payment.transactionId,
        date: payment.createdAt
      },

      // Amounts
      subtotal: subtotal - gstAmount,
      gstAmount,
      totalAmount,

      // Organization details
      organization: this.config.organization
    };

    return invoiceData;
  }

  /**
   * Build line items from registration tickets
   */
  buildLineItems(registration) {
    const items = [];
    const tickets = registration.registrationData?.tickets || 
                   registration.registrationData?.selectedTickets || 
                   [];

    // Group tickets by type
    const ticketGroups = {};
    
    tickets.forEach(ticket => {
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
   * Create PDF using PDFKit
   */
  async createInvoicePDF(invoiceData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Header
        doc.fontSize(20).text('Tax Invoice', 50, 50);
        
        // Logo (if exists)
        try {
          doc.image(this.config.logoPath, 450, 40, { width: 100 });
        } catch (e) {
          // Logo not found, skip
        }

        // Invoice details
        doc.fontSize(10);
        doc.text(`Date: ${invoiceData.date.toLocaleDateString()}`, 50, 100);
        doc.text(`Invoice No: ${invoiceData.invoiceNumber}`, 50, 115);
        doc.text(`Status: ${invoiceData.status}`, 50, 130);

        // Bill To section
        doc.fontSize(12).text('Bill To:', 50, 160);
        doc.fontSize(10);
        doc.text(invoiceData.customer.name, 50, 180);
        doc.text(invoiceData.customer.email, 50, 195);
        if (invoiceData.customer.address) {
          doc.text(invoiceData.customer.address, 50, 210);
        }

        // From section
        doc.fontSize(12).text('From:', 300, 160);
        doc.fontSize(10);
        doc.text(invoiceData.organization.name, 300, 180);
        doc.text(`ABN: ${invoiceData.organization.abn}`, 300, 195);
        doc.text(invoiceData.organization.address, 300, 210);
        doc.text(`Issued By: ${invoiceData.organization.issuedBy}`, 300, 225);

        // Items table
        let yPosition = 260;
        doc.fontSize(12).text('Items:', 50, yPosition);
        yPosition += 20;

        // Table header
        doc.fontSize(10);
        doc.text('Description', 50, yPosition);
        doc.text('Qty', 350, yPosition);
        doc.text('Unit Price', 400, yPosition);
        doc.text('Total', 480, yPosition);
        
        // Draw line
        yPosition += 15;
        doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
        yPosition += 10;

        // Table rows
        invoiceData.items.forEach(item => {
          doc.text(item.description, 50, yPosition);
          doc.text(String(item.quantity), 350, yPosition);
          doc.text(`$${item.unitPrice.toFixed(2)}`, 400, yPosition);
          doc.text(`$${item.total.toFixed(2)}`, 480, yPosition);
          yPosition += 20;
        });

        // Totals
        yPosition += 10;
        doc.moveTo(350, yPosition).lineTo(550, yPosition).stroke();
        yPosition += 10;

        doc.text('Subtotal:', 350, yPosition);
        doc.text(`$${invoiceData.subtotal.toFixed(2)}`, 480, yPosition);
        yPosition += 20;

        doc.text('GST (10%):', 350, yPosition);
        doc.text(`$${invoiceData.gstAmount.toFixed(2)}`, 480, yPosition);
        yPosition += 20;

        doc.fontSize(12);
        doc.text('Total:', 350, yPosition);
        doc.text(`$${invoiceData.totalAmount.toFixed(2)}`, 480, yPosition);

        // Payment info
        yPosition += 40;
        doc.fontSize(10);
        doc.text('Payment Information', 50, yPosition);
        yPosition += 15;
        doc.text(`Method: ${invoiceData.payment.method}`, 50, yPosition);
        doc.text(`Date: ${invoiceData.payment.date.toLocaleDateString()}`, 200, yPosition);
        doc.text(`Amount: $${invoiceData.totalAmount.toFixed(2)}`, 350, yPosition);

        // End document
        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Update payment record with invoice details
   */
  async updatePaymentWithInvoice(paymentId, invoiceDetails) {
    await this.db.collection('payments').updateOne(
      { _id: paymentId },
      { $set: invoiceDetails }
    );
  }

  /**
   * Run as standalone server
   */
  async runServer(port = 3010) {
    const express = require('express');
    const app = express();
    
    app.use(express.json());

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'invoice-processor' });
    });

    // Process invoices endpoint
    app.post('/process-invoices', async (req, res) => {
      try {
        const result = await this.processInvoices(req.body);
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Process single invoice
    app.post('/process-invoice/:paymentId', async (req, res) => {
      try {
        const result = await this.processInvoices({
          specificPaymentId: req.params.paymentId
        });
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.listen(port, () => {
      console.log(`Invoice processor server running on port ${port}`);
    });
  }
}

// CLI interface
async function main() {
  const processor = new InvoiceProcessor();
  const args = process.argv.slice(2);
  
  try {
    await processor.connect();

    if (args.includes('--server')) {
      // Run as server
      const port = args[args.indexOf('--server') + 1] || 3010;
      await processor.runServer(port);
    } else {
      // Run once
      const options = {
        dryRun: args.includes('--dry-run'),
        regenerate: args.includes('--regenerate')
      };

      // Date filters
      const dateFromIndex = args.indexOf('--from');
      if (dateFromIndex !== -1) {
        options.dateFrom = args[dateFromIndex + 1];
      }

      const dateToIndex = args.indexOf('--to');
      if (dateToIndex !== -1) {
        options.dateTo = args[dateToIndex + 1];
      }

      // Specific payment
      const paymentIndex = args.indexOf('--payment');
      if (paymentIndex !== -1) {
        options.specificPaymentId = args[paymentIndex + 1];
      }

      await processor.processInvoices(options);
      await processor.disconnect();
    }
  } catch (error) {
    console.error('Error:', error);
    await processor.disconnect();
    process.exit(1);
  }
}

// Help text
if (process.argv.includes('--help')) {
  console.log(`
Invoice Processor - Generate invoices for matched payments

Usage:
  node invoice-processor-server.js [options]

Options:
  --server [port]     Run as HTTP server (default port: 3010)
  --dry-run          Show what would be done without generating invoices
  --regenerate       Regenerate existing invoices
  --from <date>      Process payments from this date
  --to <date>        Process payments to this date
  --payment <id>     Process specific payment by ID
  --help             Show this help

Examples:
  # Run as server
  node invoice-processor-server.js --server 3010
  
  # Process all pending invoices
  node invoice-processor-server.js
  
  # Dry run for last 7 days
  node invoice-processor-server.js --dry-run --from 2024-01-01
  
  # Regenerate specific invoice
  node invoice-processor-server.js --payment 65abc123def --regenerate
`);
  process.exit(0);
}

// Export for use in other scripts
module.exports = { InvoiceProcessor };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}