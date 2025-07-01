import React from 'react';
import { Invoice } from '../types/invoice';

interface InvoiceComponentProps {
  invoice: Invoice;
  className?: string;
}

const InvoiceComponent: React.FC<InvoiceComponentProps> = ({ invoice, className = '' }) => {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      case 'overdue':
        return 'text-red-600';
      case 'cancelled':
        return 'text-gray-500';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className={`bg-white p-8 shadow-lg rounded-lg ${className}`}>
      {/* Header */}
      <h1 className="text-3xl font-bold text-center mb-8">Tax Invoice</h1>

      {/* Supplier and Bill To Section */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Supplier Section */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Supplier:</h2>
          <p className="font-medium">{invoice.supplier.name}</p>
          <p className="text-sm text-gray-600">ABN: {invoice.supplier.abn}</p>
          <p className="text-sm text-gray-600">{invoice.supplier.address}</p>
          <p className="text-sm text-gray-500 mt-2">{invoice.supplier.issuedBy}</p>
        </div>

        {/* Bill To Section */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Bill To:</h2>
          {invoice.billTo.businessName && (
            <>
              <p className="font-medium">{invoice.billTo.businessName}</p>
              {invoice.billTo.businessNumber && (
                <p className="text-sm text-gray-600">ABN: {invoice.billTo.businessNumber}</p>
              )}
            </>
          )}
          <p className="font-medium">{invoice.billTo.firstName} {invoice.billTo.lastName}</p>
          <p className="text-sm text-gray-600">{invoice.billTo.email}</p>
          <p className="text-sm text-gray-600">{invoice.billTo.addressLine1}</p>
          <p className="text-sm text-gray-600">
            {invoice.billTo.city} {invoice.billTo.postalCode}
          </p>
          <p className="text-sm text-gray-600">
            {invoice.billTo.stateProvince}, {invoice.billTo.country}
          </p>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b">
        <div className="flex items-center space-x-6">
          <span className="text-sm">
            <span className="font-semibold">Date:</span> {formatDate(invoice.date)}
          </span>
          <span className="text-sm">
            <span className="font-semibold">Status:</span>{' '}
            <span className={`font-medium ${getStatusColor(invoice.status)}`}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </span>
          </span>
          <span className="text-sm">
            <span className="font-semibold">Invoice No:</span> {invoice.invoiceNumber}
          </span>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Items:</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Description</th>
              <th className="text-center py-2 w-20">Qty</th>
              <th className="text-right py-2 w-32">Unit Price</th>
              <th className="text-right py-2 w-32">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index} className="border-b">
                <td className="py-3">{item.description}</td>
                <td className="text-center py-3">{item.quantity}</td>
                <td className="text-right py-3">{formatCurrency(item.price)}</td>
                <td className="text-right py-3">{formatCurrency(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals Section */}
      <div className="flex justify-end">
        <div className="w-64">
          <div className="flex justify-between py-2">
            <span>Subtotal:</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span>Processing Fees:</span>
            <span>{formatCurrency(invoice.processingFees)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span>GST Included:</span>
            <span>{formatCurrency(invoice.gstIncluded)}</span>
          </div>
          <div className="flex justify-between py-3 font-bold text-lg border-t">
            <span>Total:</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
        </div>
      </div>

      {/* Payment Information Section */}
      {invoice.payment && (
        <div className="mt-8 pt-8 border-t">
          <h3 className="text-lg font-semibold mb-4">Payment Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Payment Method</p>
              <p className="font-medium">
                {invoice.payment.cardBrand ? `${invoice.payment.cardBrand} ` : ''}
                {invoice.payment.method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                {invoice.payment.last4 ? ` ending in ${invoice.payment.last4}` : ''}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Transaction ID</p>
              <p className="font-medium font-mono text-sm">{invoice.payment.transactionId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Date</p>
              <p className="font-medium">{formatDate(invoice.payment.paidDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Amount Paid</p>
              <p className="font-medium">{formatCurrency(invoice.payment.amount)}</p>
            </div>
          </div>
          {invoice.payment.receiptUrl && (
            <div className="mt-4">
              <a 
                href={invoice.payment.receiptUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline text-sm"
              >
                View Payment Receipt
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InvoiceComponent;