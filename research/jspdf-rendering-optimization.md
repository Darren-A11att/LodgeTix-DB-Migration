# jsPDF Rendering Optimization Guide

## Current Issues and Solutions

Based on the invoice rendering issues, here are the key optimizations implemented:

### 1. **Canvas Scale and DPI Settings**

The most critical factor for text clarity is the `scale` parameter in html2canvas:

```javascript
const canvas = await html2canvas(element, {
  scale: 2, // Doubled from 1 to 2 for better quality
  dpi: 192, // Higher DPI for better text rendering
  letterRendering: true, // Improved text rendering
  // ... other options
});
```

### 2. **Image Format: PNG vs JPEG**

Changed from JPEG to PNG for better text quality:

```javascript
// Before (blurry text due to JPEG compression)
canvas.toDataURL('image/jpeg', 0.95)

// After (crisp text with PNG)
canvas.toDataURL('image/png')
```

### 3. **Sub-pixel Rendering Fix**

Added onclone callback to ensure integer positioning:

```javascript
onclone: (clonedDoc) => {
  const clonedElement = clonedDoc.querySelector('[data-pdf-element]');
  if (clonedElement) {
    clonedElement.style.position = 'relative';
    clonedElement.style.transform = 'translateZ(0)';
  }
}
```

### 4. **Multi-page Handling Improvement**

Implemented proper page splitting for long invoices:

```javascript
// Create temporary canvas for each page section
const pageCanvas = document.createElement('canvas');
// Copy only the relevant portion
ctx.drawImage(canvas, 0, canvasSourceY, canvas.width, canvasSourceHeight, ...);
```

## CSS Optimizations

### 1. **Font Rendering**

```css
.invoice-pdf {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

### 2. **Force Hardware Acceleration**

```css
.invoice-pdf * {
  transform: translateZ(0);
  backface-visibility: hidden;
}
```

### 3. **Consistent Line Heights**

```css
.invoice-pdf p, .invoice-pdf div, .invoice-pdf span {
  line-height: 1.5;
}
```

## Invoice Component Modifications

Add these to your Invoice component:

```tsx
const InvoiceComponent: React.FC<InvoiceComponentProps> = (props) => {
  // Add data-pdf-element for targeting in html2canvas
  return (
    <div 
      className="invoice-pdf bg-white p-8" 
      data-pdf-element
      style={{
        width: '794px', // A4 width at 96 DPI
        minHeight: '1123px', // A4 height at 96 DPI
        margin: '0 auto',
        fontFamily: 'Arial, sans-serif', // Consistent font
        fontSize: '14px',
        lineHeight: '1.5',
        color: '#000000', // Pure black for better contrast
      }}
    >
      {/* Invoice content */}
    </div>
  );
};
```

## Alternative Solution: Using pdf.html()

If issues persist, consider using jsPDF's newer `pdf.html()` method:

```javascript
async generatePDF(element: HTMLElement, filename: string): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  return new Promise((resolve, reject) => {
    pdf.html(element, {
      callback: function(pdf) {
        const blob = pdf.output('blob');
        resolve(blob);
      },
      x: 10,
      y: 10,
      width: 190, // A4 width minus margins
      windowWidth: 794, // Element width
      html2canvas: {
        scale: 2,
        logging: false,
        dpi: 192,
        letterRendering: true
      }
    });
  });
}
```

## Testing Recommendations

1. **Test with Different Content Lengths**
   - Single page invoices
   - Multi-page invoices
   - Invoices with many line items

2. **Test Different Browsers**
   - Chrome/Edge (Chromium)
   - Firefox
   - Safari

3. **Test Different Screen Resolutions**
   - Standard displays
   - Retina/HiDPI displays

## Performance Considerations

1. **Canvas Size**: Higher scale = larger canvas = more memory
2. **Image Format**: PNG is larger than JPEG but better for text
3. **Compression**: Use 'FAST' compression to maintain quality

## Debugging Tips

1. **Enable html2canvas logging temporarily**:
   ```javascript
   logging: true // See what html2canvas is doing
   ```

2. **Check canvas dimensions**:
   ```javascript
   console.log('Canvas size:', canvas.width, 'x', canvas.height);
   ```

3. **Save canvas as image for inspection**:
   ```javascript
   // Debug: save canvas as image
   const link = document.createElement('a');
   link.download = 'canvas-debug.png';
   link.href = canvas.toDataURL();
   link.click();
   ```

## Known Issues and Workarounds

1. **Fonts not rendering correctly**
   - Use web-safe fonts (Arial, Helvetica, Times New Roman)
   - Ensure fonts are loaded before generating PDF

2. **CSS Grid/Flexbox issues**
   - Use tables for invoice layout when possible
   - Ensure explicit widths on columns

3. **Shadow and gradient issues**
   - Avoid CSS shadows and gradients
   - Use solid borders instead

## Final Checklist

- [ ] Scale set to 2 or higher
- [ ] Using PNG format instead of JPEG
- [ ] Integer positioning (no sub-pixels)
- [ ] Web-safe fonts
- [ ] Explicit dimensions on containers
- [ ] No CSS transforms except translateZ(0)
- [ ] High contrast colors (#000 on #fff)
- [ ] Tables instead of complex CSS layouts