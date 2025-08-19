/**
 * PDF Generator Service
 * 
 * Handles PDF generation with fallback support for different environments
 * Primary: PDFKit (server-based, higher quality)
 * Fallback: jsPDF (browser-only fallback)
 */


export interface PDFGeneratorOptions {
  invoiceData: any;
  preferredEngine?: 'pdfkit' | 'jspdf';
}

export class PDFGeneratorService {
  /**
   * Generate PDF with automatic fallback
   */
  static async generatePDF(options: PDFGeneratorOptions): Promise<Buffer> {
    const { invoiceData, preferredEngine = 'pdfkit' } = options;
    
    // Try PDFKit first if preferred
    if (preferredEngine === 'pdfkit') {
      try {
        return await this.generateWithPDFKit(invoiceData);
      } catch (error) {
        console.warn('PDFKit failed:', (error as any)?.message || error);
        // Server fallback: Puppeteer
        if (typeof window === 'undefined') {
          try {
            return await this.generateWithPuppeteer(invoiceData);
          } catch (pErr) {
            console.warn('Puppeteer fallback also failed:', (pErr as any)?.message || pErr);
          }
        } else {
          // Browser fallback: jsPDF
          return await this.generateWithJsPDF(invoiceData);
        }
        throw error;
      }
    }
    
    // Use jsPDF directly (browser-only)
    if (typeof window !== 'undefined') {
      return await this.generateWithJsPDF(invoiceData);
    }
    // On server, try Puppeteer as a direct engine when preferredEngine is not pdfkit
    return await this.generateWithPuppeteer(invoiceData);
  }
  
  /**
   * Generate PDF using PDFKit (Node.js style)
   */
  private static async generateWithPDFKit(invoiceData: any): Promise<Buffer> {
    // Dynamic import to avoid build issues
    let PDFDocument: any;
    
    if (typeof window === 'undefined') {
      // Server environment - use dynamic import with fallback for CJS/ESM interop
      try {
        const mod: any = await import('pdfkit');
        PDFDocument = mod?.default || mod; // Support both default and named export
      } catch (error) {
        console.error('[PDFKit] Failed to load PDFKit:', error);
        throw new Error('PDFKit not available in server environment');
      }
    } else {
      // Browser environment
      const mod = await import('pdfkit/js/pdfkit.standalone');
      PDFDocument = mod.default;
    }
    
    if (!PDFDocument) {
      throw new Error('PDFKit not available');
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Configure PDFKit with minimal options to avoid font file issues
        const doc = new PDFDocument({ 
          size: 'A4', 
          margin: 50,
          autoFirstPage: true
        });
        
        const chunks: any[] = [];
        
        doc.on('data', (chunk: any) => chunks.push(chunk));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
        doc.on('error', reject);
        
        // Create a safe font method that handles Next.js environment
        const safeFont = (fontName: string) => {
          try {
            return doc.font(fontName);
          } catch (error) {
            console.warn(`[PDFKit] Font '${fontName}' not available, using default`);
            // Don't call font() at all if it fails - PDFKit will use its default
            return doc;
          }
        };
        
        // Attach safe font method to doc for use in renderInvoiceContent
        (doc as any).safeFont = safeFont;
        
        // Generate invoice content
        this.renderInvoiceContent(doc, invoiceData);
        
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Generate PDF using jsPDF (works everywhere)
   */
  private static async generateWithJsPDF(invoiceData: any): Promise<Buffer> {
    // Lazy-load jsPDF to avoid server-side import issues
    const mod = await import('jspdf');
    const { jsPDF } = mod as any;

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
    addressLines.forEach((line: string) => {
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
    invoiceData.items.forEach((item: any) => {
      // Handle long descriptions
      const descLines = doc.splitTextToSize(item.description, 90);
      descLines.forEach((line: string, index: number) => {
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
  
  /**
   * Render invoice content for PDFKit
   */
  private static renderInvoiceContent(doc: any, invoiceData: any): void {
    // Use safeFont if available, otherwise use regular font method
    const setFont = doc.safeFont || ((fontName: string) => doc.font(fontName));
    // Header
    doc.fontSize(20).text('Tax Invoice', 50, 50);
    
    // Invoice details
    doc.fontSize(10);
    doc.text(`Date: ${invoiceData.date.toLocaleDateString()}`, 50, 100);
    doc.text(`Invoice No: ${invoiceData.invoiceNumber}`, 50, 115);
    doc.text(`Status: ${invoiceData.status}`, 50, 130);
    
    // Bill To
    setFont('Helvetica-Bold').fontSize(12).text('Bill To:', 50, 160);
    setFont('Helvetica').fontSize(10);
    doc.text(invoiceData.customer.name, 50, 180);
    doc.text(invoiceData.customer.email, 50, 195);
    if (invoiceData.customer.address) {
      doc.text(invoiceData.customer.address, 50, 210);
    }
    
    // From
    setFont('Helvetica-Bold').fontSize(12).text('From:', 350, 160);
    setFont('Helvetica').fontSize(10);
    doc.text(invoiceData.organization.name, 350, 180);
    doc.text(`ABN: ${invoiceData.organization.abn}`, 350, 195);
    doc.text(invoiceData.organization.address, 350, 210);
    doc.text(`Issued By: ${invoiceData.organization.issuedBy}`, 350, 225);
    
    // Event details
    let yPos = 260;
    setFont('Helvetica-Bold').fontSize(12).text('Event Details:', 50, yPos);
    yPos += 20;
    setFont('Helvetica').fontSize(10);
    doc.text(`Event: ${invoiceData.event.name}`, 50, yPos);
    doc.text(`Confirmation: ${invoiceData.registration.confirmationNumber}`, 350, yPos);
    yPos += 30;
    
    // Items table
    setFont('Helvetica-Bold').fontSize(12).text('Items:', 50, yPos);
    yPos += 20;
    
    // Table header
    doc.fontSize(10).fillColor('#666');
    doc.text('Description', 50, yPos);
    doc.text('Qty', 350, yPos);
    doc.text('Unit Price', 400, yPos);
    doc.text('Total', 480, yPos);
    
    // Line
    yPos += 15;
    doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
    yPos += 10;
    
    // Items
    doc.fillColor('#000');
    invoiceData.items.forEach((item: any) => {
      const lines = doc.heightOfString(item.description, { width: 280 }) / doc.currentLineHeight();
      if (lines > 1) {
        doc.text(item.description, 50, yPos, { width: 280 });
      } else {
        doc.text(item.description, 50, yPos);
      }
      doc.text(String(item.quantity), 350, yPos);
      doc.text(`$${item.unitPrice.toFixed(2)}`, 400, yPos);
      doc.text(`$${item.total.toFixed(2)}`, 480, yPos);
      yPos += 20 * Math.ceil(lines);
    });
    
    // Totals
    yPos += 10;
    doc.moveTo(350, yPos).lineTo(550, yPos).stroke();
    yPos += 10;
    
    doc.text('Subtotal:', 350, yPos);
    doc.text(`$${invoiceData.subtotal.toFixed(2)}`, 480, yPos);
    yPos += 20;
    
    doc.text('GST (10%):', 350, yPos);
    doc.text(`$${invoiceData.gstAmount.toFixed(2)}`, 480, yPos);
    yPos += 20;
    
    setFont('Helvetica-Bold').fontSize(12).text('Total:', 350, yPos);
    doc.text(`$${invoiceData.totalAmount.toFixed(2)}`, 480, yPos);
    
    // Payment info
    yPos += 40;
    setFont('Helvetica-Bold').fontSize(10);
    doc.text('Payment Information', 50, yPos);
    yPos += 15;
    setFont('Helvetica').text(`Method: ${invoiceData.payment.method}`, 50, yPos);
    doc.text(`Date: ${invoiceData.payment.date.toLocaleDateString()}`, 200, yPos);
    doc.text(`Amount: $${invoiceData.totalAmount.toFixed(2)}`, 350, yPos);
  }
  
  /**
   * Generate PDF using Puppeteer on the server by rendering a simple HTML template
   */
  private static async generateWithPuppeteer(invoiceData: any): Promise<Buffer> {
    if (typeof window !== 'undefined') {
      throw new Error('Puppeteer generation is server-only');
    }
    const { default: puppeteer } = await import('puppeteer');

    const html = this.buildInvoiceHtml(invoiceData);

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  /**
   * Minimal, self-contained HTML for Puppeteer rendering
   */
  private static buildInvoiceHtml(invoiceData: any): string {
    const css = `
      body { font-family: Arial, sans-serif; color: #111; }
      .container { padding: 16px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; }
      .title { font-size: 22px; font-weight: 700; }
      .muted { color:#666; }
      .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top: 12px; }
      .section-title { font-weight:700; margin: 16px 0 8px; }
      table { width:100%; border-collapse: collapse; }
      th, td { text-align:left; padding:6px 4px; }
      thead th { color:#666; font-weight:600; border-bottom:1px solid #ddd; }
      tfoot td { border-top: 1px solid #ddd; }
      .right { text-align:right; }
    `;
    const esc = (s:any) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const itemsRows = (invoiceData.items || []).map((it:any) => `
      <tr>
        <td>${esc(it.description)}</td>
        <td class="right">${esc(it.quantity)}</td>
        <td class="right">$${Number(it.unitPrice).toFixed(2)}</td>
        <td class="right">$${Number(it.total).toFixed(2)}</td>
      </tr>
    `).join('');
    return `<!doctype html>
    <html><head><meta charset="utf-8"/><style>${css}</style></head>
    <body><div class="container">
      <div class="header">
        <div>
          <div class="title">Tax Invoice</div>
          <div class="muted">Date: ${esc(new Date(invoiceData.date).toLocaleDateString())}</div>
          <div class="muted">Invoice No: ${esc(invoiceData.invoiceNumber)}</div>
          <div class="muted">Status: ${esc(invoiceData.status)}</div>
        </div>
        <div class="right">
          <div><strong>${esc(invoiceData.organization?.name)}</strong></div>
          <div>ABN: ${esc(invoiceData.organization?.abn)}</div>
          <div>${esc(invoiceData.organization?.address)}</div>
          <div>Issued By: ${esc(invoiceData.organization?.issuedBy)}</div>
        </div>
      </div>
      <div class="grid">
        <div>
          <div class="section-title">Bill To</div>
          <div>${esc(invoiceData.customer?.name)}</div>
          <div class="muted">${esc(invoiceData.customer?.email || '')}</div>
          <div class="muted">${esc(invoiceData.customer?.address || '')}</div>
        </div>
        <div>
          <div class="section-title">Event Details</div>
          <div>Event: ${esc(invoiceData.event?.name)}</div>
          <div>Confirmation: ${esc(invoiceData.registration?.confirmationNumber)}</div>
        </div>
      </div>
      <div class="section-title">Items</div>
      <table>
        <thead>
          <tr><th>Description</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Total</th></tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
        <tfoot>
          <tr><td></td><td></td><td class="right">Subtotal:</td><td class="right">$${Number(invoiceData.subtotal).toFixed(2)}</td></tr>
          <tr><td></td><td></td><td class="right">GST (10%):</td><td class="right">$${Number(invoiceData.gstAmount).toFixed(2)}</td></tr>
          <tr><td></td><td></td><td class="right"><strong>Total:</strong></td><td class="right"><strong>$${Number(invoiceData.totalAmount).toFixed(2)}</strong></td></tr>
        </tfoot>
      </table>
      <div class="section-title">Payment</div>
      <div class="muted">Method: ${esc(invoiceData.payment?.method)} | Date: ${esc(new Date(invoiceData.payment?.date).toLocaleDateString())} | Amount: $${Number(invoiceData.totalAmount).toFixed(2)}</div>
    </div></body></html>`;
  }
}

export default PDFGeneratorService;
