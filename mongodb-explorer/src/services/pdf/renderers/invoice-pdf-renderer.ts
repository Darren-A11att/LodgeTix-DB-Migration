import type { PdfRenderer } from '../types';

export interface InvoiceRendererData {
  invoiceNumber: string;
  date: Date | string;
  status: string;
  customer: { name: string; email?: string; address?: string };
  event: { name: string };
  registration: { confirmationNumber: string };
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  payment: { method: string; date: Date | string };
  organization: { name: string; abn?: string; address?: string; issuedBy?: string };
}

export class InvoicePdfRenderer implements PdfRenderer {
  constructor(private data: InvoiceRendererData) {}

  getTitle() {
    return this.data.invoiceNumber || 'invoice';
  }

  renderPdfKit(doc: any): void {
    const setFont = (doc as any).safeFont || ((name: string) => (doc as any).font(name));

    // Header
    doc.fontSize(20).text('Tax Invoice', 50, 50);

    // Invoice details
    doc.fontSize(10);
    doc.text(`Date: ${new Date(this.data.date).toLocaleDateString()}`, 50, 100);
    doc.text(`Invoice No: ${this.data.invoiceNumber}`, 50, 115);
    doc.text(`Status: ${this.data.status}`, 50, 130);

    // Bill To
    setFont('Helvetica-Bold').fontSize(12).text('Bill To:', 50, 160);
    setFont('Helvetica').fontSize(10);
    doc.text(this.data.customer.name, 50, 180);
    if (this.data.customer.email) doc.text(this.data.customer.email, 50, 195);
    if (this.data.customer.address) doc.text(this.data.customer.address, 50, 210);

    // From
    setFont('Helvetica-Bold').fontSize(12).text('From:', 350, 160);
    setFont('Helvetica').fontSize(10);
    doc.text(this.data.organization.name, 350, 180);
    if (this.data.organization.abn) doc.text(`ABN: ${this.data.organization.abn}`, 350, 195);
    if (this.data.organization.address) doc.text(this.data.organization.address, 350, 210);
    if (this.data.organization.issuedBy) doc.text(`Issued By: ${this.data.organization.issuedBy}`, 350, 225);

    // Event details
    let yPos = 260;
    setFont('Helvetica-Bold').fontSize(12).text('Event Details:', 50, yPos);
    yPos += 20;
    setFont('Helvetica').fontSize(10);
    doc.text(`Event: ${this.data.event.name}`, 50, yPos);
    doc.text(`Confirmation: ${this.data.registration.confirmationNumber}`, 350, yPos);
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
    yPos += 15;
    doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
    yPos += 10;

    // Items
    doc.fillColor('#000');
    this.data.items.forEach((item) => {
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
    doc.text(`$${this.data.subtotal.toFixed(2)}`, 480, yPos);
    yPos += 20;
    doc.text('GST (10%):', 350, yPos);
    doc.text(`$${this.data.gstAmount.toFixed(2)}`, 480, yPos);
    yPos += 20;
    setFont('Helvetica-Bold').fontSize(12).text('Total:', 350, yPos);
    doc.text(`$${this.data.totalAmount.toFixed(2)}`, 480, yPos);

    // Payment info
    yPos += 40;
    setFont('Helvetica-Bold').fontSize(10);
    doc.text('Payment Information', 50, yPos);
    yPos += 15;
    setFont('Helvetica');
    doc.text(`Method: ${this.data.payment.method}`, 50, yPos);
    doc.text(`Date: ${new Date(this.data.payment.date).toLocaleDateString()}`, 200, yPos);
    doc.text(`Amount: $${this.data.totalAmount.toFixed(2)}`, 350, yPos);
  }

  renderHtml(): string {
    const d = this.data;
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
    const esc = (s: any) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const itemsRows = (d.items || []).map((it) => `
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
          <div class="muted">Date: ${esc(new Date(d.date).toLocaleDateString())}</div>
          <div class="muted">Invoice No: ${esc(d.invoiceNumber)}</div>
          <div class="muted">Status: ${esc(d.status)}</div>
        </div>
        <div class="right">
          <div><strong>${esc(d.organization?.name)}</strong></div>
          <div>${d.organization?.abn ? `ABN: ${esc(d.organization.abn)}` : ''}</div>
          <div>${esc(d.organization?.address || '')}</div>
          <div>${d.organization?.issuedBy ? `Issued By: ${esc(d.organization.issuedBy)}` : ''}</div>
        </div>
      </div>
      <div class="grid">
        <div>
          <div class="section-title">Bill To</div>
          <div>${esc(d.customer?.name)}</div>
          <div class="muted">${esc(d.customer?.email || '')}</div>
          <div class="muted">${esc(d.customer?.address || '')}</div>
        </div>
        <div>
          <div class="section-title">Event Details</div>
          <div>Event: ${esc(d.event?.name)}</div>
          <div>Confirmation: ${esc(d.registration?.confirmationNumber)}</div>
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
          <tr><td></td><td></td><td class="right">Subtotal:</td><td class="right">$${Number(d.subtotal).toFixed(2)}</td></tr>
          <tr><td></td><td></td><td class="right">GST (10%):</td><td class="right">$${Number(d.gstAmount).toFixed(2)}</td></tr>
          <tr><td></td><td></td><td class="right"><strong>Total:</strong></td><td class="right"><strong>$${Number(d.totalAmount).toFixed(2)}</strong></td></tr>
        </tfoot>
      </table>
      <div class="section-title">Payment</div>
      <div class="muted">Method: ${esc(d.payment?.method)} | Date: ${esc(new Date(d.payment?.date).toLocaleDateString())} | Amount: $${Number(d.totalAmount).toFixed(2)}</div>
    </div></body></html>`;
  }
}

export default InvoicePdfRenderer;

