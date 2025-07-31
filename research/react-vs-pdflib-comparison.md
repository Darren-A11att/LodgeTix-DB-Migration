# React/HTML vs pdf-lib: Invoice Code Comparison

## Overview
Your current React component is **363 lines**. The equivalent pdf-lib implementation would be approximately **800-1000 lines** with significantly more complexity.

## Side-by-Side Comparison

### 1. Invoice Header

#### Current React/HTML Approach
```tsx
// Simple, declarative, responsive
<div className="flex justify-between items-start mb-6">
  <h1 className="text-2xl font-bold">Tax Invoice</h1>
  {invoice.invoiceType === 'customer' && (
    <img 
      src={logoBase64 || "/images/lodgetix-logo.svg"} 
      alt="LodgeTix Logo" 
      style={{ height: '50px', width: 'auto' }}
    />
  )}
</div>
```

#### pdf-lib Equivalent
```typescript
// Manual positioning, no automatic layout
const pageWidth = 595; // A4 width in points
const pageHeight = 842; // A4 height in points
const margin = 50;
let currentY = pageHeight - margin; // Start from top

// Title
const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
const titleSize = 24;
const titleText = 'Tax Invoice';
const titleWidth = titleFont.widthOfTextAtSize(titleText, titleSize);

page.drawText(titleText, {
  x: margin,
  y: currentY - titleSize,
  size: titleSize,
  font: titleFont,
  color: rgb(0, 0, 0),
});

// Logo (if customer invoice)
if (invoice.invoiceType === 'customer') {
  const logoBytes = await fetch(logoBase64 || "/images/lodgetix-logo.svg").then(res => res.arrayBuffer());
  const logoImage = await pdfDoc.embedPng(logoBytes);
  const logoDims = logoImage.scale(0.5); // Scale to 50px height
  
  page.drawImage(logoImage, {
    x: pageWidth - margin - logoDims.width,
    y: currentY - logoDims.height,
    width: logoDims.width,
    height: logoDims.height,
  });
}

currentY -= 50; // Manual spacing
```

### 2. Bill To Section

#### Current React/HTML Approach
```tsx
// Automatic text wrapping, conditional rendering
<div>
  <h2 className="text-base font-semibold mb-1">Bill To:</h2>
  {invoice.billTo.businessName && (
    <>
      <p className="text-sm font-medium">{invoice.billTo.businessName}</p>
      {invoice.billTo.businessNumber && (
        <p className="text-xs text-gray-600">ABN: {invoice.billTo.businessNumber}</p>
      )}
    </>
  )}
  {(invoice.billTo.firstName || invoice.billTo.lastName) && (
    <p className="text-sm font-medium">{invoice.billTo.firstName} {invoice.billTo.lastName}</p>
  )}
  {invoice.billTo.email && (
    <p className="text-xs text-gray-600">{invoice.billTo.email}</p>
  )}
</div>
```

#### pdf-lib Equivalent
```typescript
// Manual text positioning, no automatic wrapping
const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

// "Bill To:" header
page.drawText('Bill To:', {
  x: margin,
  y: currentY,
  size: 12,
  font: boldFont,
  color: rgb(0, 0, 0),
});
currentY -= 18;

// Business name (if exists)
if (invoice.billTo.businessName) {
  page.drawText(invoice.billTo.businessName, {
    x: margin,
    y: currentY,
    size: 11,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  currentY -= 14;
  
  // ABN (if exists)
  if (invoice.billTo.businessNumber) {
    page.drawText(`ABN: ${invoice.billTo.businessNumber}`, {
      x: margin,
      y: currentY,
      size: 9,
      font: regularFont,
      color: rgb(0.4, 0.4, 0.4), // gray-600
    });
    currentY -= 12;
  }
}

// Person name (if exists)
if (invoice.billTo.firstName || invoice.billTo.lastName) {
  const fullName = `${invoice.billTo.firstName || ''} ${invoice.billTo.lastName || ''}`.trim();
  page.drawText(fullName, {
    x: margin,
    y: currentY,
    size: 11,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  currentY -= 14;
}

// Email (if exists)
if (invoice.billTo.email) {
  // Check if email fits on page, manually wrap if needed
  const emailWidth = regularFont.widthOfTextAtSize(invoice.billTo.email, 9);
  if (emailWidth > pageWidth - (margin * 2)) {
    // Manual text wrapping logic needed here...
  }
  
  page.drawText(invoice.billTo.email, {
    x: margin,
    y: currentY,
    size: 9,
    font: regularFont,
    color: rgb(0.4, 0.4, 0.4),
  });
  currentY -= 12;
}
```

### 3. Invoice Items Table

#### Current React/HTML Approach
```tsx
// Automatic table layout, responsive columns
<table className="w-full text-sm">
  <thead>
    <tr className="border-b border-gray-300">
      <th className="text-left py-2 text-xs font-semibold">Description</th>
      <th className="text-right py-2 w-12 text-xs font-semibold">Qty</th>
      <th className="text-right py-2 w-20 text-xs font-semibold">Unit Price</th>
      <th className="text-right py-2 w-20 text-xs font-semibold">Total</th>
    </tr>
  </thead>
  <tbody>
    {invoice.items.map((item, index) => (
      <tr key={index} className="border-b border-gray-200">
        <td className="py-2 text-xs">{item.description}</td>
        <td className="text-right py-2 text-xs">{item.quantity}</td>
        <td className="text-right py-2 text-xs">{formatCurrency(item.price)}</td>
        <td className="text-right py-2 text-xs">
          {formatCurrency(item.price * item.quantity)}
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

#### pdf-lib Equivalent
```typescript
// Manual table drawing - every line, every cell
const tableTop = currentY;
const colWidths = {
  description: 300,
  qty: 50,
  price: 80,
  total: 80
};
const tableWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);

// Draw table header border
page.drawRectangle({
  x: margin,
  y: currentY - 20,
  width: tableWidth,
  height: 20,
  borderColor: rgb(0.8, 0.8, 0.8),
  borderWidth: 1,
});

// Header text
page.drawText('Description', {
  x: margin + 5,
  y: currentY - 15,
  size: 10,
  font: boldFont,
  color: rgb(0, 0, 0),
});

page.drawText('Qty', {
  x: margin + colWidths.description + 5,
  y: currentY - 15,
  size: 10,
  font: boldFont,
  color: rgb(0, 0, 0),
});

page.drawText('Unit Price', {
  x: margin + colWidths.description + colWidths.qty + 5,
  y: currentY - 15,
  size: 10,
  font: boldFont,
  color: rgb(0, 0, 0),
});

page.drawText('Total', {
  x: margin + colWidths.description + colWidths.qty + colWidths.price + 5,
  y: currentY - 15,
  size: 10,
  font: boldFont,
  color: rgb(0, 0, 0),
});

currentY -= 25;

// Draw each item row
for (const item of invoice.items) {
  // Check if we need a new page
  if (currentY < 100) {
    const newPage = pdfDoc.addPage([pageWidth, pageHeight]);
    currentY = pageHeight - margin;
  }
  
  // Draw row border
  page.drawRectangle({
    x: margin,
    y: currentY - 20,
    width: tableWidth,
    height: 20,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 0.5,
  });
  
  // Description (with manual text wrapping if too long)
  const descWidth = regularFont.widthOfTextAtSize(item.description, 9);
  if (descWidth > colWidths.description - 10) {
    // Complex text wrapping logic needed...
    // Split text into lines, draw each line separately
  } else {
    page.drawText(item.description, {
      x: margin + 5,
      y: currentY - 15,
      size: 9,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
  }
  
  // Quantity (right-aligned)
  const qtyText = item.quantity.toString();
  const qtyWidth = regularFont.widthOfTextAtSize(qtyText, 9);
  page.drawText(qtyText, {
    x: margin + colWidths.description + colWidths.qty - qtyWidth - 5,
    y: currentY - 15,
    size: 9,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  
  // Price (right-aligned with currency formatting)
  const priceText = formatCurrency(item.price);
  const priceWidth = regularFont.widthOfTextAtSize(priceText, 9);
  page.drawText(priceText, {
    x: margin + colWidths.description + colWidths.qty + colWidths.price - priceWidth - 5,
    y: currentY - 15,
    size: 9,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  
  // Total (right-aligned)
  const totalText = formatCurrency(item.price * item.quantity);
  const totalWidth = regularFont.widthOfTextAtSize(totalText, 9);
  page.drawText(totalText, {
    x: margin + colWidths.description + colWidths.qty + colWidths.price + colWidths.total - totalWidth - 5,
    y: currentY - 15,
    size: 9,
    font: regularFont,
    color: rgb(0, 0, 0),
  });
  
  currentY -= 20;
}
```

## Key Differences Summary

### 1. **Code Volume**
- **React/HTML**: ~363 lines total
- **pdf-lib**: ~800-1000 lines (2.5-3x more)

### 2. **Complexity**
| Aspect | React/HTML | pdf-lib |
|--------|-----------|---------|
| Layout | Automatic (flexbox/grid) | Manual positioning |
| Text wrapping | Automatic | Manual calculation |
| Responsive | Built-in | Not applicable |
| Tables | HTML `<table>` | Draw each line |
| Spacing | CSS margins/padding | Calculate Y coordinates |
| Page breaks | N/A (single page) | Manual detection |
| Alignment | CSS text-align | Calculate X position |

### 3. **Development Time**
- **React/HTML**: 1-2 days for invoice component
- **pdf-lib**: 1-2 weeks for equivalent functionality

### 4. **Maintenance**
| Task | React/HTML | pdf-lib |
|------|-----------|---------|
| Add new field | Add 1 line | Calculate position, adjust all Y coordinates below |
| Change font size | Change CSS | Recalculate all spacing |
| Rearrange sections | Move JSX blocks | Recalculate entire layout |
| Fix alignment | Adjust CSS class | Manually calculate widths |

### 5. **Features You'd Lose**
- Automatic text wrapping
- Responsive layouts  
- CSS styling
- Easy conditional rendering
- Browser dev tools for debugging
- Reusable component patterns

### 6. **What You'd Gain**
- No Chrome/Puppeteer dependency
- Smaller runtime footprint
- Works on serverless
- Precise control (if needed)

## Conclusion

Moving from React/HTML to pdf-lib for invoices would be like:
- Going from WordPress to hand-coding HTML
- Going from React to vanilla JavaScript with manual DOM manipulation  
- Going from CSS Grid to absolute positioning everything

The development effort would increase by 3-5x, and maintenance would become a nightmare. Every small change would require recalculating positions throughout the document.