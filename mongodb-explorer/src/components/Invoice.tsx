import React from 'react';
import { Invoice } from '../types/invoice';

interface InvoiceComponentProps {
  invoice: Invoice;
  className?: string;
  logoBase64?: string;
  confirmationNumber?: string;
  functionName?: string;
}

const InvoiceComponent: React.FC<InvoiceComponentProps> = ({ invoice, className = '', logoBase64, confirmationNumber, functionName }) => {
  // RGB color styles for PDF compatibility - avoiding oklch colors entirely
  const styles = {
    // Text colors
    text: { color: 'rgb(0, 0, 0)' },
    textGray500: { color: 'rgb(107, 114, 128)' },
    textGray600: { color: 'rgb(75, 85, 99)' },
    textGray700: { color: 'rgb(55, 65, 81)' },
    textBlue600: { color: 'rgb(37, 99, 235)' },
    textGreen600: { color: 'rgb(22, 163, 74)' },
    textYellow600: { color: 'rgb(202, 138, 4)' },
    textRed600: { color: 'rgb(220, 38, 38)' },
    
    // Background colors
    bgWhite: { backgroundColor: 'rgb(255, 255, 255)' },
    bgGray50: { backgroundColor: 'rgb(249, 250, 251)' },
    bgGray100: { backgroundColor: 'rgb(243, 244, 246)' },
    
    // Border colors
    borderGray200: { borderColor: 'rgb(229, 231, 235)' },
    borderGray300: { borderColor: 'rgb(209, 213, 219)' },
    
    // Typography - Adjusted for PDF
    text2xl: { fontSize: '1.25rem', fontWeight: '700' },
    textBase: { fontSize: '0.875rem', fontWeight: '600' },
    textSm: { fontSize: '0.8125rem' },
    textXs: { fontSize: '0.75rem' },
    fontBold: { fontWeight: '700' },
    fontSemibold: { fontWeight: '600' },
    fontMedium: { fontWeight: '500' },
    
    // Spacing - Reduced for PDF
    mb1: { marginBottom: '0.125rem' },
    mb2: { marginBottom: '0.25rem' },
    mb3: { marginBottom: '0.5rem' },
    mb6: { marginBottom: '1rem' },
    mt1: { marginTop: '0.125rem' },
    mt2: { marginTop: '0.25rem' },
    mt6: { marginTop: '1rem' },
    mt8: { marginTop: '1.5rem' },
    p2: { padding: '0.25rem' },
    p8: { padding: '1.5rem' },
    py1: { paddingTop: '0.125rem', paddingBottom: '0.125rem' },
    py2: { paddingTop: '0.25rem', paddingBottom: '0.25rem' },
    pt4: { paddingTop: '0.75rem' },
    pt6: { paddingTop: '1rem' },
    pb3: { paddingBottom: '0.5rem' },
    pl4: { paddingLeft: '0.75rem' },
    
    // Layout
    flex: { display: 'flex' },
    flexBetween: { display: 'flex', justifyContent: 'space-between' },
    flexEnd: { display: 'flex', justifyContent: 'flex-end' },
    flexWrap: { display: 'flex', flexWrap: 'wrap' },
    grid: { display: 'grid' },
    gridCols2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
    gap6: { gap: '1.5rem' },
    gapX6: { columnGap: '1.5rem' },
    gapY1: { rowGap: '0.25rem' },
    
    // Width
    wFull: { width: '100%' },
    w12: { width: '3rem' },
    w20: { width: '5rem' },
    w48: { width: '12rem' },
    
    // Borders
    borderB: { borderBottomWidth: '1px', borderBottomStyle: 'solid' },
    borderT: { borderTopWidth: '1px', borderTopStyle: 'solid' },
    borderT2: { borderTopWidth: '2px', borderTopStyle: 'solid' },
    
    // Other
    rounded: { borderRadius: '0.375rem' },
    underline: { textDecoration: 'underline' },
    fontMono: { fontFamily: 'monospace' },
    textRight: { textAlign: 'right' as const },
    textLeft: { textAlign: 'left' as const },
    itemsStart: { alignItems: 'flex-start' },
    itemsCenter: { alignItems: 'center' }
  };

  // Helper function to combine multiple style objects
  const combineStyles = (...styleObjects: any[]) => {
    return Object.assign({}, ...styleObjects);
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
    <div style={combineStyles(styles.bgWhite, styles.p8, { lineHeight: '1.3', fontSize: '0.875rem' })}>
      {/* Header with Logo */}
      <div style={combineStyles(styles.flexBetween, styles.itemsStart, styles.mb6)}>
        <h1 style={combineStyles(styles.text2xl, styles.text)}>Tax Invoice</h1>
        {invoice.invoiceType === 'customer' && (
          <img 
            src={logoBase64 || "/images/lodgetix-logo.svg"} 
            alt="LodgeTix Logo" 
            style={{ height: '50px', width: 'auto' }}
          />
        )}
      </div>

      {/* Bill To and Supplier Section */}
      <div style={combineStyles(styles.gridCols2, styles.gap6, styles.mb6)}>
        {/* Bill To Section (Customer - Left Side) */}
        <div>
          <h2 style={combineStyles(styles.textBase, styles.mb1, styles.text)}>Bill To:</h2>
          {invoice.billTo.businessName && (
            <>
              <p style={combineStyles(styles.textSm, styles.fontMedium)}>{invoice.billTo.businessName}</p>
              {invoice.billTo.businessNumber && (
                <p style={combineStyles(styles.textXs, styles.textGray600)}>ABN: {invoice.billTo.businessNumber}</p>
              )}
            </>
          )}
          {(invoice.billTo.firstName || invoice.billTo.lastName) && (
            <p style={combineStyles(styles.textSm, styles.fontMedium)}>{invoice.billTo.firstName} {invoice.billTo.lastName}</p>
          )}
          {invoice.billTo.email && (
            <p style={combineStyles(styles.textXs, styles.textGray600)}>{invoice.billTo.email}</p>
          )}
          {invoice.billTo.addressLine1 && (
            <p style={combineStyles(styles.textXs, styles.textGray600)}>{invoice.billTo.addressLine1}</p>
          )}
          {(invoice.billTo.city || invoice.billTo.postalCode) && (
            <p style={combineStyles(styles.textXs, styles.textGray600)}>
              {invoice.billTo.city} {invoice.billTo.postalCode}
            </p>
          )}
          {(invoice.billTo.stateProvince || invoice.billTo.country) && (
            <p style={combineStyles(styles.textXs, styles.textGray600)}>
              {invoice.billTo.stateProvince}{invoice.billTo.stateProvince && invoice.billTo.country && ', '}{invoice.billTo.country}
            </p>
          )}
        </div>

        {/* Supplier Section (Right Side) */}
        <div>
          <h2 style={combineStyles(styles.textBase, styles.mb1, styles.text)}>From:</h2>
          {invoice.supplier.name && (
            <p style={combineStyles(styles.textSm, styles.fontMedium)}>{invoice.supplier.name}</p>
          )}
          {invoice.supplier.abn && (
            <p style={combineStyles(styles.textXs, styles.textGray600)}>ABN: {invoice.supplier.abn}</p>
          )}
          {invoice.supplier.address && (
            <p style={combineStyles(styles.textXs, styles.textGray600)}>{invoice.supplier.address}</p>
          )}
          {invoice.invoiceType !== 'supplier' && invoice.supplier.issuedBy && (
            <p style={combineStyles(styles.textXs, styles.textGray500, styles.mt1)}>Issued By: {invoice.supplier.issuedBy}</p>
          )}
        </div>
      </div>

      {/* Invoice Details */}
      <div style={combineStyles(styles.flexBetween, styles.itemsCenter, styles.mb6, styles.pb3, styles.borderB, styles.borderGray200)}>
        <div style={combineStyles(styles.flex, styles.itemsCenter, { gap: '1rem' })}>
          <span style={styles.textXs}>
            <span style={styles.fontSemibold}>Date:</span> {formatDate(invoice.date)}
          </span>
          <span style={styles.textXs}>
            <span style={styles.fontSemibold}>Status:</span>{' '}
            <span style={combineStyles(styles.fontMedium, getStatusStyle(invoice.status))}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </span>
          </span>
          <span style={styles.textXs}>
            <span style={styles.fontSemibold}>Invoice No:</span> {invoice.invoiceNumber || '[To be assigned]'}
          </span>
        </div>
      </div>

      {/* Items Table */}
      <div style={styles.mb6}>
        <h3 style={combineStyles(styles.textBase, styles.fontSemibold, styles.mb3)}>Items:</h3>
        <table style={combineStyles(styles.wFull, styles.textSm, { borderCollapse: 'collapse' })}>
          <thead>
            <tr style={combineStyles(styles.borderB, styles.borderGray300)}>
              <th style={combineStyles(styles.textLeft, styles.py1, styles.textXs, styles.fontSemibold, styles.text)}>Description</th>
              <th style={combineStyles(styles.textRight, styles.py1, styles.w12, styles.textXs, styles.fontSemibold, styles.text)}>Qty</th>
              <th style={combineStyles(styles.textRight, styles.py1, styles.w20, styles.textXs, styles.fontSemibold, styles.text)}>Unit Price</th>
              <th style={combineStyles(styles.textRight, styles.py1, styles.w20, styles.textXs, styles.fontSemibold, styles.text)}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => {
              // Check if this is a sub-item (starts with spaces or -)
              const isSubItem = item.description.startsWith('  ') || item.description.startsWith('-');
              
              // Check if both quantity and price are "not set" (0 or falsy)
              const hideAmounts = toNumber(item.quantity) === 0 && toNumber(item.price) === 0;
              
              return (
                <tr key={index} style={combineStyles(styles.borderB, styles.borderGray200)}>
                  <td style={combineStyles(styles.py1, styles.textXs, isSubItem ? styles.pl4 : {})}>
                    {item.description}
                  </td>
                  <td style={combineStyles(styles.textRight, styles.py1, styles.textXs)}>
                    {hideAmounts ? '' : toNumber(item.quantity)}
                  </td>
                  <td style={combineStyles(styles.textRight, styles.py1, styles.textXs)}>
                    {hideAmounts ? '' : formatCurrency(item.price)}
                  </td>
                  <td style={combineStyles(styles.textRight, styles.py1, styles.textXs)}>
                    {hideAmounts ? '' : formatCurrency(toNumber(item.price) * toNumber(item.quantity))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals Section */}
      <div style={styles.flexEnd}>
        <div style={styles.w48}>
          <div style={combineStyles(styles.flexBetween, styles.py1, styles.textXs)}>
            <span>Subtotal:</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div style={combineStyles(styles.flexBetween, styles.py1, styles.textXs)}>
            <span>Processing Fees:</span>
            <span>{formatCurrency(invoice.processingFees)}</span>
          </div>
          <div style={combineStyles(styles.flexBetween, styles.py2, styles.fontBold, styles.textSm, styles.borderT, styles.borderGray300)}>
            <span>Total:</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
          <div style={combineStyles(styles.flexBetween, styles.py1, styles.textXs, styles.textGray600)}>
            <span>GST Included:</span>
            <span>{formatCurrency(toNumber(invoice.total) / 11)}</span>
          </div>
        </div>
      </div>

      {/* Payment Information Section */}
      {invoice.payment && (
        <div style={combineStyles(styles.mt6, styles.pt4, styles.borderT, styles.borderGray200)}>
          <h3 style={combineStyles(styles.textSm, styles.fontSemibold, styles.mb2)}>Payment Information</h3>
          <div style={combineStyles(styles.bgGray50, styles.p2, styles.rounded)}>
            <div style={combineStyles(styles.flexWrap, styles.textXs, styles.gapX6, styles.gapY1)}>
              <div>
                <span style={styles.textGray600}>Method: </span>
                <span style={styles.fontMedium}>
                  {invoice.payment.method ? 
                    invoice.payment.method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                    'Unknown Method'
                  }
                  {invoice.payment.last4 ? ` ending in ${invoice.payment.last4}` : ''}
                </span>
              </div>
              <div>
                <span style={styles.textGray600}>Gateway: </span>
                <span style={styles.fontMedium}>
                  {invoice.payment.source ? 
                    invoice.payment.source.charAt(0).toUpperCase() + invoice.payment.source.slice(1) : 
                    'Unknown'
                  }
                </span>
              </div>
              <div>
                <span style={styles.textGray600}>Date: </span>
                <span style={styles.fontMedium}>{formatDate(invoice.payment.paidDate)}</span>
              </div>
              <div>
                <span style={styles.textGray600}>Amount: </span>
                <span style={styles.fontMedium}>{formatCurrency(invoice.payment.amount)}</span>
              </div>
              <div>
                <span style={styles.textGray600}>Payment ID: </span>
                <span style={combineStyles(styles.fontMedium, styles.fontMono)}>{invoice.payment.paymentId || invoice.payment.transactionId}</span>
              </div>
              {invoice.payment.statementDescriptor && (
                <div>
                  <span style={styles.textGray600}>Statement: </span>
                  <span style={styles.fontMedium}>{invoice.payment.statementDescriptor}</span>
                </div>
              )}
            </div>
            {invoice.payment.receiptUrl && (
                <div style={styles.mt2}>
                  <a 
                    href={invoice.payment.receiptUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={combineStyles(styles.textBlue600, styles.underline, styles.textXs)}
                  >
                    View Payment Receipt
                  </a>
                </div>
              )}
            </div>
        </div>
      )}

      {/* Credit Note Section for Refunded Payments */}
      {(() => {
        if (!invoice.payment) return false;
        const rawStatus = (invoice.payment as any)?.status ?? (invoice.payment as any)?.Status ?? (invoice.payment as any)?.originalData?.status ?? (invoice.payment as any)?.originalData?.Status ?? '';
        const statusStr = String(rawStatus).toLowerCase();
        return statusStr === 'refunded';
      })() && (
        <div style={combineStyles(styles.mt8, styles.pt6, styles.borderT2, styles.borderGray200)}>
          {/* Credit Note Header */}
          <div style={combineStyles(styles.flexBetween, styles.itemsStart, styles.mb6)}>
            <h1 style={combineStyles(styles.text2xl, styles.text)}>CREDIT NOTE</h1>
            <div style={styles.textRight}>
              <div style={styles.textSm}>
                <span style={styles.fontSemibold}>Credit Note No:</span> LTCN-{invoice.invoiceNumber?.replace('LTIV-', '') || invoice.invoiceNumber}
              </div>
            </div>
          </div>
          
          {/* Credit Note Items Table */}
          <div style={styles.mb6}>
            <table style={combineStyles(styles.wFull, styles.textSm)}>
              <thead>
                <tr style={combineStyles(styles.borderB, styles.borderGray300)}>
                  <th style={combineStyles(styles.textLeft, styles.py2, styles.textXs, styles.fontSemibold, styles.text)}>Description</th>
                  <th style={combineStyles(styles.textRight, styles.py2, styles.w12, styles.textXs, styles.fontSemibold, styles.text)}>Qty</th>
                  <th style={combineStyles(styles.textRight, styles.py2, styles.w20, styles.textXs, styles.fontSemibold, styles.text)}>Unit Price</th>
                  <th style={combineStyles(styles.textRight, styles.py2, styles.w20, styles.textXs, styles.fontSemibold, styles.text)}>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr style={combineStyles(styles.borderB, styles.borderGray200)}>
                  <td style={combineStyles(styles.py2, styles.textXs)}>
                    Refund of Registration {confirmationNumber || invoice.invoiceNumber} for {functionName || 'Grand Proclamation 2025'}
                  </td>
                  <td style={combineStyles(styles.textRight, styles.py2, styles.textXs)}>1</td>
                  <td style={combineStyles(styles.textRight, styles.py2, styles.textXs)}>{formatCurrency(-toNumber(invoice.total))}</td>
                  <td style={combineStyles(styles.textRight, styles.py2, styles.textXs)}>{formatCurrency(-toNumber(invoice.total))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Credit Note Totals */}
          <div style={styles.flexEnd}>
            <div style={styles.w48}>
              <div style={combineStyles(styles.flexBetween, styles.py2, styles.fontBold, styles.textSm, styles.borderT, styles.borderGray300)}>
                <span>Total:</span>
                <span>{formatCurrency(-toNumber(invoice.total))}</span>
              </div>
              <div style={combineStyles(styles.flexBetween, styles.py1, styles.textXs, styles.textGray600)}>
                <span>GST Included:</span>
                <span>{formatCurrency(-toNumber(invoice.total) / 11)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceComponent;
