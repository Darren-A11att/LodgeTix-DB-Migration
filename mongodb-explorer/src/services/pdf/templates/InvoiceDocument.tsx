import React from 'react';

export interface InvoiceViewProps {
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

export const InvoiceDocument: React.FC<InvoiceViewProps> = (d) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="title">Tax Invoice</div>
          <div className="muted">Date: {new Date(d.date).toLocaleDateString()}</div>
          <div className="muted">Invoice No: {d.invoiceNumber}</div>
          <div className="muted">Status: {d.status}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><strong>{d.organization?.name}</strong></div>
          {d.organization?.abn && <div>ABN: {d.organization.abn}</div>}
          {d.organization?.address && <div>{d.organization.address}</div>}
          {d.organization?.issuedBy && <div>Issued By: {d.organization.issuedBy}</div>}
        </div>
      </div>

      <div className="grid">
        <div>
          <div className="section-title">Bill To</div>
          <div>{d.customer?.name}</div>
          {d.customer?.email && <div className="muted">{d.customer.email}</div>}
          {d.customer?.address && <div className="muted">{d.customer.address}</div>}
        </div>
        <div>
          <div className="section-title">Event Details</div>
          <div>Event: {d.event?.name}</div>
          <div>Confirmation: {d.registration?.confirmationNumber}</div>
        </div>
      </div>

      <div className="section-title">Items</div>
      <table>
        <thead>
          <tr><th>Description</th><th className="right">Qty</th><th className="right">Unit Price</th><th className="right">Total</th></tr>
        </thead>
        <tbody>
          {d.items.map((it, idx) => (
            <tr key={idx}>
              <td>{it.description}</td>
              <td className="right">{it.quantity}</td>
              <td className="right">${it.unitPrice.toFixed(2)}</td>
              <td className="right">${it.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td></td><td></td><td className="right">Subtotal:</td><td className="right">${d.subtotal.toFixed(2)}</td></tr>
          <tr><td></td><td></td><td className="right">GST (10%):</td><td className="right">${d.gstAmount.toFixed(2)}</td></tr>
          <tr><td></td><td></td><td className="right"><strong>Total:</strong></td><td className="right"><strong>${d.totalAmount.toFixed(2)}</strong></td></tr>
        </tfoot>
      </table>

      <div className="section-title">Payment</div>
      <div className="muted">Method: {d.payment?.method} | Date: {new Date(d.payment?.date).toLocaleDateString()} | Amount: ${d.totalAmount.toFixed(2)}</div>
    </div>
  );
};

export default InvoiceDocument;

