import React from 'react';

export interface ReceiptViewProps {
  receiptNumber: string;
  date: Date | string;
  customer: { name: string; email?: string };
  payment: { method: string; date: Date | string; amount: number; reference?: string };
  organization: { name: string; abn?: string; address?: string; issuedBy?: string };
  note?: string;
}

export const ReceiptDocument: React.FC<ReceiptViewProps> = (d) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="title">Receipt</div>
          <div className="muted">Date: {new Date(d.date).toLocaleDateString()}</div>
          <div className="muted">Receipt No: {d.receiptNumber}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><strong>{d.organization?.name}</strong></div>
          {d.organization?.abn && <div>ABN: {d.organization.abn}</div>}
          {d.organization?.address && <div>{d.organization.address}</div>}
          {d.organization?.issuedBy && <div>Issued By: {d.organization.issuedBy}</div>}
        </div>
      </div>

      <div className="section-title">Customer</div>
      <div>{d.customer?.name}</div>
      {d.customer?.email && <div className="muted">{d.customer.email}</div>}

      <div className="section-title">Payment Details</div>
      <table>
        <tbody>
          <tr><td>Method</td><td>{d.payment.method}</td></tr>
          <tr><td>Date</td><td>{new Date(d.payment.date).toLocaleDateString()}</td></tr>
          <tr><td>Amount</td><td>${d.payment.amount.toFixed(2)}</td></tr>
          {d.payment.reference && <tr><td>Reference</td><td>{d.payment.reference}</td></tr>}
        </tbody>
      </table>

      {d.note && (
        <>
          <div className="section-title">Note</div>
          <div className="muted">{d.note}</div>
        </>
      )}
    </div>
  );
};

export default ReceiptDocument;

