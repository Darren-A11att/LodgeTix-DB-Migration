import React from 'react';
import { Invoice } from '../types/invoice';

interface InvoiceComponentProps {
  invoice: Invoice;
  className?: string;
  logoBase64?: string;
}

const InvoiceComponent: React.FC<InvoiceComponentProps> = ({ invoice, className = '', logoBase64 }) => {
  // RGB color styles for PDF compatibility
  const styles = {
    text: { color: '#000000' },
    textGray600: { color: '#4b5563' },
    textGray500: { color: '#6b7280' },
    textGray700: { color: '#374151' },
    textBlue600: { color: '#2563eb' },
    bgGray50: { backgroundColor: '#f9fafb' },
    bgGray100: { backgroundColor: '#f3f4f6' },
    borderGray300: { borderColor: '#d1d5db' },
    borderGray200: { borderColor: '#e5e7eb' }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Helper to convert MongoDB Decimal128 to number
  const toNumber = (value: number | { $numberDecimal: string }): number => {
    return typeof value === 'object' && value.$numberDecimal 
      ? parseFloat(value.$numberDecimal)
      : value as number;
  };

  const formatCurrency = (amount: number | { $numberDecimal: string }) => {
    const numericAmount = toNumber(amount);
    
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(numericAmount);
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
  
  const getStatusStyle = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return { color: '#16a34a' }; // green-600
      case 'pending':
        return { color: '#ca8a04' }; // yellow-600
      case 'overdue':
        return { color: '#dc2626' }; // red-600
      case 'cancelled':
        return { color: '#6b7280' }; // gray-500
      default:
        return { color: '#374151' }; // gray-700
    }
  };

  return (
    <div className={`bg-white p-8 ${className}`} style={{ backgroundColor: '#ffffff' }}>
      {/* Header with Logo */}
      <div className="flex justify-between items-start mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#000000' }}>Tax Invoice</h1>
        {invoice.invoiceType === 'customer' && (
          <img 
            src={logoBase64 || "/images/lodgetix-logo.svg"} 
            alt="LodgeTix Logo" 
            style={{ height: '50px', width: 'auto' }}
          />
        )}
      </div>

      {/* Bill To and Supplier Section */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Bill To Section (Customer - Left Side) */}
        <div>
          <h2 className="text-base font-semibold mb-1" style={{ color: '#000000' }}>Bill To:</h2>
          {invoice.billTo.businessName && (
            <>
              <p className="text-sm font-medium">{invoice.billTo.businessName}</p>
              {invoice.billTo.businessNumber && (
                <p className="text-xs text-gray-600" style={styles.textGray600}>ABN: {invoice.billTo.businessNumber}</p>
              )}
            </>
          )}
          {(invoice.billTo.firstName || invoice.billTo.lastName) && (
            <p className="text-sm font-medium">{invoice.billTo.firstName} {invoice.billTo.lastName}</p>
          )}
          {invoice.billTo.email && (
            <p className="text-xs text-gray-600" style={styles.textGray600}>{invoice.billTo.email}</p>
          )}
          {invoice.billTo.addressLine1 && (
            <p className="text-xs text-gray-600" style={styles.textGray600}>{invoice.billTo.addressLine1}</p>
          )}
          {(invoice.billTo.city || invoice.billTo.postalCode) && (
            <p className="text-xs text-gray-600" style={styles.textGray600}>
              {invoice.billTo.city} {invoice.billTo.postalCode}
            </p>
          )}
          {(invoice.billTo.stateProvince || invoice.billTo.country) && (
            <p className="text-xs text-gray-600" style={styles.textGray600}>
              {invoice.billTo.stateProvince}{invoice.billTo.stateProvince && invoice.billTo.country && ', '}{invoice.billTo.country}
            </p>
          )}
        </div>

        {/* Supplier Section (Right Side) */}
        <div>
          <h2 className="text-base font-semibold mb-1" style={styles.text}>From:</h2>
          {invoice.supplier.name && (
            <p className="text-sm font-medium">{invoice.supplier.name}</p>
          )}
          {invoice.supplier.abn && (
            <p className="text-xs text-gray-600" style={styles.textGray600}>ABN: {invoice.supplier.abn}</p>
          )}
          {invoice.supplier.address && (
            <p className="text-xs text-gray-600" style={styles.textGray600}>{invoice.supplier.address}</p>
          )}
          {invoice.invoiceType !== 'supplier' && invoice.supplier.issuedBy && (
            <p className="text-xs text-gray-500 mt-1" style={styles.textGray500}>Issued By: {invoice.supplier.issuedBy}</p>
          )}
        </div>
      </div>

      {/* Invoice Details */}
      <div className="flex justify-between items-center mb-6 pb-3 border-b" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#e5e7eb' }}>
        <div className="flex items-center space-x-4">
          <span className="text-xs">
            <span className="font-semibold">Date:</span> {formatDate(invoice.date)}
          </span>
          <span className="text-xs">
            <span className="font-semibold">Status:</span>{' '}
            <span className={`font-medium ${getStatusColor(invoice.status)}`} style={getStatusStyle(invoice.status)}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </span>
          </span>
          <span className="text-xs">
            <span className="font-semibold">Invoice No:</span> {invoice.invoiceNumber || '[To be assigned]'}
          </span>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-6">
        <h3 className="text-base font-semibold mb-3">Items:</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#d1d5db' }}>
              <th className="text-left py-2 text-xs font-semibold" style={styles.text}>Description</th>
              <th className="text-right py-2 w-12 text-xs font-semibold" style={styles.text}>Qty</th>
              <th className="text-right py-2 w-20 text-xs font-semibold" style={styles.text}>Unit Price</th>
              <th className="text-right py-2 w-20 text-xs font-semibold" style={styles.text}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => {
              // Check if this is a sub-item (starts with spaces or -)
              const isSubItem = item.description.startsWith('  ') || item.description.startsWith('-');
              
              // Check if both quantity and price are "not set" (0 or falsy)
              const hideAmounts = toNumber(item.quantity) === 0 && toNumber(item.price) === 0;
              
              return (
                <tr key={index} className="border-b border-gray-200" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#e5e7eb' }}>
                  <td className={`py-2 text-xs ${isSubItem ? 'pl-4' : ''}`}>
                    {item.description}
                  </td>
                  <td className="text-right py-2 text-xs">
                    {hideAmounts ? '' : toNumber(item.quantity)}
                  </td>
                  <td className="text-right py-2 text-xs">
                    {hideAmounts ? '' : formatCurrency(item.price)}
                  </td>
                  <td className="text-right py-2 text-xs">
                    {hideAmounts ? '' : formatCurrency(toNumber(item.price) * toNumber(item.quantity))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals Section */}
      <div className="flex justify-end">
        <div className="w-48">
          <div className="flex justify-between py-1 text-xs">
            <span>Subtotal:</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between py-1 text-xs">
            <span>Processing Fees:</span>
            <span>{formatCurrency(invoice.processingFees)}</span>
          </div>
          <div className="flex justify-between py-2 font-bold text-sm border-t border-gray-300" style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#d1d5db' }}>
            <span>Total:</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
          <div className="flex justify-between py-1 text-xs text-gray-600" style={styles.textGray600}>
            <span>GST Included:</span>
            <span>{formatCurrency(toNumber(invoice.total) / 11)}</span>
          </div>
        </div>
      </div>

      {/* Payment Information Section */}
      {invoice.payment && (
        <div className="mt-6 pt-4 border-t" style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#e5e7eb' }}>
          <h3 className="text-sm font-semibold mb-2">Payment Information</h3>
          <div className="bg-gray-50 p-2 rounded-md" style={{ backgroundColor: '#f9fafb' }}>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <div>
                <span className="text-gray-600" style={styles.textGray600}>Method: </span>
                <span className="font-medium">
                  {invoice.payment.method ? 
                    invoice.payment.method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                    'Unknown Method'
                  }
                  {invoice.payment.last4 ? ` ending in ${invoice.payment.last4}` : ''}
                </span>
              </div>
              <div>
                <span className="text-gray-600" style={styles.textGray600}>Gateway: </span>
                <span className="font-medium">
                  {invoice.payment.source ? 
                    invoice.payment.source.charAt(0).toUpperCase() + invoice.payment.source.slice(1) : 
                    'Unknown'
                  }
                </span>
              </div>
              <div>
                <span className="text-gray-600" style={styles.textGray600}>Date: </span>
                <span className="font-medium">{formatDate(invoice.payment.paidDate)}</span>
              </div>
              <div>
                <span className="text-gray-600" style={styles.textGray600}>Amount: </span>
                <span className="font-medium">{formatCurrency(invoice.payment.amount)}</span>
              </div>
              <div>
                <span className="text-gray-600" style={styles.textGray600}>Payment ID: </span>
                <span className="font-medium font-mono">{invoice.payment.paymentId || invoice.payment.transactionId}</span>
              </div>
              {invoice.payment.statementDescriptor && (
                <div>
                  <span className="text-gray-600" style={styles.textGray600}>Statement: </span>
                  <span className="font-medium">{invoice.payment.statementDescriptor}</span>
                </div>
              )}
            </div>
            {invoice.payment.receiptUrl && (
                <div className="mt-2">
                  <a 
                    href={invoice.payment.receiptUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline text-xs"
                    style={styles.textBlue600}
                  >
                    View Payment Receipt
                  </a>
                </div>
              )}
            </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceComponent;