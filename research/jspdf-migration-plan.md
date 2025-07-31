# jsPDF Migration Plan: Replacing Puppeteer While Keeping It as Fallback

## Overview

This migration plan details the step-by-step process to implement jsPDF as the primary PDF generation solution while maintaining Puppeteer as a fallback option. The implementation follows best practices for maintainability, testability, and gradual rollout.

## Migration Strategy

- **Approach**: Feature flag-based implementation
- **Timeline**: 5-7 days
- **Risk**: Low (Puppeteer remains as fallback)
- **Testing**: Side-by-side comparison before full switch

## Prerequisites

### 1. Install Required Dependencies

```bash
# In the mongodb-explorer directory
cd mongodb-explorer
npm install jspdf html2canvas

# Also install types for TypeScript
npm install --save-dev @types/jspdf @types/html2canvas
```

### 2. Environment Configuration

Create environment variable for PDF engine selection:

```bash
# .env.local
PDF_ENGINE=jspdf  # Options: 'jspdf' or 'puppeteer'
```

## Step-by-Step Implementation

### Step 1: Create PDF Engine Interface

Create a new file to define the PDF engine interface:

**File**: `src/types/pdf-engine.ts`

```typescript
export interface PDFEngine {
  generatePDF(element: HTMLElement, filename: string): Promise<Blob>;
  isAvailable(): Promise<boolean>;
  name: string;
}

export interface PDFGeneratorOptions {
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}
```

### Step 2: Implement jsPDF Engine

Create the jsPDF implementation:

**File**: `src/utils/pdf-engines/jspdf-engine.ts`

```typescript
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PDFEngine, PDFGeneratorOptions } from '@/types/pdf-engine';

export class JsPDFEngine implements PDFEngine {
  name = 'jspdf';

  async isAvailable(): Promise<boolean> {
    // jsPDF works everywhere, no special requirements
    return true;
  }

  async generatePDF(
    element: HTMLElement, 
    filename: string, 
    options?: PDFGeneratorOptions
  ): Promise<Blob> {
    try {
      // Default options
      const defaultOptions: PDFGeneratorOptions = {
        format: 'a4',
        orientation: 'portrait',
        margin: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10
        }
      };

      const finalOptions = { ...defaultOptions, ...options };

      // Create jsPDF instance
      const pdf = new jsPDF({
        orientation: finalOptions.orientation,
        unit: 'mm',
        format: finalOptions.format
      });

      // Use html2canvas to render the element
      const canvas = await html2canvas(element, {
        scale: 2, // Higher quality
        useCORS: true, // Handle external images
        logging: false, // Disable console logs
        backgroundColor: '#ffffff', // Ensure white background
      });

      // Calculate dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      // Add image to PDF
      const imgData = canvas.toDataURL('image/png');
      let position = 0;

      // First page
      pdf.addImage(
        imgData, 
        'PNG', 
        finalOptions.margin.left, 
        finalOptions.margin.top, 
        imgWidth - (finalOptions.margin.left + finalOptions.margin.right), 
        imgHeight
      );
      heightLeft -= pageHeight;

      // Add new pages if content is longer than one page
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(
          imgData, 
          'PNG', 
          finalOptions.margin.left, 
          position + finalOptions.margin.top, 
          imgWidth - (finalOptions.margin.left + finalOptions.margin.right), 
          imgHeight
        );
        heightLeft -= pageHeight;
      }

      // Return as Blob
      return pdf.output('blob');
    } catch (error) {
      console.error('jsPDF generation failed:', error);
      throw new Error(`Failed to generate PDF with jsPDF: ${error.message}`);
    }
  }
}
```

### Step 3: Update Puppeteer Engine

Wrap existing Puppeteer logic in the engine interface:

**File**: `src/utils/pdf-engines/puppeteer-engine.ts`

```typescript
import { PDFEngine, PDFGeneratorOptions } from '@/types/pdf-engine';

export class PuppeteerEngine implements PDFEngine {
  name = 'puppeteer';

  async isAvailable(): Promise<boolean> {
    // Check if we're in a server environment where Puppeteer can run
    return typeof window === 'undefined' && process.env.VERCEL !== '1';
  }

  async generatePDF(
    element: HTMLElement, 
    filename: string,
    options?: PDFGeneratorOptions
  ): Promise<Blob> {
    try {
      // Extract HTML and styles (existing logic)
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              ${Array.from(document.styleSheets)
                .map(sheet => {
                  try {
                    return Array.from(sheet.cssRules)
                      .map(rule => rule.cssText)
                      .join('\n');
                  } catch (e) {
                    return '';
                  }
                })
                .join('\n')}
            </style>
          </head>
          <body style="margin: 0; padding: 0; background: white;">
            ${element.outerHTML}
          </body>
        </html>
      `;

      // Call existing Puppeteer endpoint
      const response = await fetch('/api/invoices/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ html, filename }),
      });

      if (!response.ok) {
        throw new Error(`Puppeteer API failed: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Puppeteer generation failed:', error);
      throw new Error(`Failed to generate PDF with Puppeteer: ${error.message}`);
    }
  }
}
```

### Step 4: Create PDF Engine Factory

Implement factory pattern for engine selection:

**File**: `src/utils/pdf-engines/pdf-engine-factory.ts`

```typescript
import { PDFEngine } from '@/types/pdf-engine';
import { JsPDFEngine } from './jspdf-engine';
import { PuppeteerEngine } from './puppeteer-engine';

export class PDFEngineFactory {
  private static jspdfEngine: JsPDFEngine;
  private static puppeteerEngine: PuppeteerEngine;

  static async getEngine(preferredEngine?: string): Promise<PDFEngine> {
    // Initialize engines if not already done
    if (!this.jspdfEngine) {
      this.jspdfEngine = new JsPDFEngine();
    }
    if (!this.puppeteerEngine) {
      this.puppeteerEngine = new PuppeteerEngine();
    }

    // Determine which engine to use
    const enginePreference = preferredEngine || process.env.NEXT_PUBLIC_PDF_ENGINE || 'jspdf';

    // Try preferred engine first
    if (enginePreference === 'jspdf' && await this.jspdfEngine.isAvailable()) {
      console.log('Using jsPDF engine for PDF generation');
      return this.jspdfEngine;
    }

    if (enginePreference === 'puppeteer' && await this.puppeteerEngine.isAvailable()) {
      console.log('Using Puppeteer engine for PDF generation');
      return this.puppeteerEngine;
    }

    // Fallback logic
    if (await this.jspdfEngine.isAvailable()) {
      console.log('Falling back to jsPDF engine');
      return this.jspdfEngine;
    }

    if (await this.puppeteerEngine.isAvailable()) {
      console.log('Falling back to Puppeteer engine');
      return this.puppeteerEngine;
    }

    throw new Error('No PDF engine available');
  }

  static async getAllEngines(): Promise<PDFEngine[]> {
    if (!this.jspdfEngine) {
      this.jspdfEngine = new JsPDFEngine();
    }
    if (!this.puppeteerEngine) {
      this.puppeteerEngine = new PuppeteerEngine();
    }

    return [this.jspdfEngine, this.puppeteerEngine];
  }
}
```

### Step 5: Update PDF Generator Utility

Replace the existing pdf-generator.ts:

**File**: `src/utils/pdf-generator.ts`

```typescript
import { PDFEngineFactory } from './pdf-engines/pdf-engine-factory';

/**
 * Generate a PDF from HTML content using the configured engine
 * @param element - The DOM element to convert to PDF
 * @param filename - The filename for the PDF (without extension)
 * @returns Promise<Blob> - The PDF as a blob
 */
export async function generatePDF(
  element: HTMLElement,
  filename: string
): Promise<Blob> {
  try {
    // Get the appropriate PDF engine
    const engine = await PDFEngineFactory.getEngine();
    
    console.log(`Generating PDF using ${engine.name} engine for: ${filename}`);
    
    // Generate PDF using selected engine
    const blob = await engine.generatePDF(element, filename);
    
    console.log(`Successfully generated PDF with ${engine.name}`);
    return blob;
  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Try fallback engine if primary fails
    const engines = await PDFEngineFactory.getAllEngines();
    const currentEngine = await PDFEngineFactory.getEngine();
    
    for (const engine of engines) {
      if (engine.name !== currentEngine.name && await engine.isAvailable()) {
        console.log(`Retrying with ${engine.name} engine`);
        try {
          return await engine.generatePDF(element, filename);
        } catch (fallbackError) {
          console.error(`Fallback ${engine.name} also failed:`, fallbackError);
        }
      }
    }
    
    throw new Error('All PDF generation engines failed');
  }
}

/**
 * Download a PDF from a DOM element
 * @param element - The DOM element to convert to PDF
 * @param filename - The filename for the PDF (without extension)
 */
export async function downloadPDF(
  element: HTMLElement,
  filename: string
): Promise<void> {
  try {
    const blob = await generatePDF(element, filename);
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw new Error('Failed to download PDF');
  }
}

/**
 * Generate PDFs for both customer and supplier invoices
 * @param customerElement - The customer invoice DOM element
 * @param supplierElement - The supplier invoice DOM element
 * @param customerFilename - The filename for the customer PDF
 * @param supplierFilename - The filename for the supplier PDF
 * @returns Promise<{ customerPdf: Blob, supplierPdf: Blob }>
 */
export async function generateInvoicePDFs(
  customerElement: HTMLElement,
  supplierElement: HTMLElement,
  customerFilename: string,
  supplierFilename: string
): Promise<{ customerPdf: Blob; supplierPdf: Blob }> {
  const [customerPdf, supplierPdf] = await Promise.all([
    generatePDF(customerElement, customerFilename),
    generatePDF(supplierElement, supplierFilename)
  ]);

  return { customerPdf, supplierPdf };
}
```

### Step 6: Add Engine Toggle UI (Optional)

Add a toggle for testing different engines:

**File**: `src/components/PDFEngineToggle.tsx`

```typescript
import React, { useState, useEffect } from 'react';

interface PDFEngineToggleProps {
  onEngineChange?: (engine: string) => void;
}

export const PDFEngineToggle: React.FC<PDFEngineToggleProps> = ({ onEngineChange }) => {
  const [currentEngine, setCurrentEngine] = useState('jspdf');

  useEffect(() => {
    // Load preference from localStorage
    const saved = localStorage.getItem('pdfEngine') || 'jspdf';
    setCurrentEngine(saved);
  }, []);

  const handleChange = (engine: string) => {
    setCurrentEngine(engine);
    localStorage.setItem('pdfEngine', engine);
    onEngineChange?.(engine);
  };

  // Only show in development mode
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border rounded-lg shadow-lg p-4 z-50">
      <h4 className="text-sm font-semibold mb-2">PDF Engine</h4>
      <div className="space-y-2">
        <label className="flex items-center">
          <input
            type="radio"
            value="jspdf"
            checked={currentEngine === 'jspdf'}
            onChange={(e) => handleChange(e.target.value)}
            className="mr-2"
          />
          <span className="text-sm">jsPDF (Recommended)</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            value="puppeteer"
            checked={currentEngine === 'puppeteer'}
            onChange={(e) => handleChange(e.target.value)}
            className="mr-2"
          />
          <span className="text-sm">Puppeteer (Legacy)</span>
        </label>
      </div>
    </div>
  );
};
```

### Step 7: Update Invoice Component Styles

Ensure invoice component is optimized for jsPDF:

**File**: `src/components/Invoice.tsx` (modifications)

```typescript
// Add these style adjustments at the top of InvoiceComponent

const InvoiceComponent: React.FC<InvoiceComponentProps> = ({ invoice, className = '', logoBase64, confirmationNumber, functionName }) => {
  // Add print-friendly styles
  const printStyles = `
    @media print {
      .invoice-container {
        width: 210mm;
        margin: 0;
        padding: 10mm;
      }
    }
  `;

  // Ensure all colors are RGB for better PDF compatibility
  const styles = {
    text: { color: 'rgb(0, 0, 0)' },
    textGray600: { color: 'rgb(75, 85, 99)' },
    textGray500: { color: 'rgb(107, 114, 128)' },
    textGray700: { color: 'rgb(55, 65, 81)' },
    textBlue600: { color: 'rgb(37, 99, 235)' },
    bgGray50: { backgroundColor: 'rgb(249, 250, 251)' },
    bgGray100: { backgroundColor: 'rgb(243, 244, 246)' },
    borderGray300: { borderColor: 'rgb(209, 213, 219)' },
    borderGray200: { borderColor: 'rgb(229, 231, 235)' }
  };

  // ... rest of component
```

### Step 8: Testing Strategy

Create test utilities for comparing outputs:

**File**: `src/utils/pdf-test-utils.ts`

```typescript
export async function comparePDFEngines(element: HTMLElement, filename: string) {
  const { JsPDFEngine } = await import('./pdf-engines/jspdf-engine');
  const { PuppeteerEngine } = await import('./pdf-engines/puppeteer-engine');

  const jspdf = new JsPDFEngine();
  const puppeteer = new PuppeteerEngine();

  console.log('Generating PDFs with both engines for comparison...');

  try {
    const [jspdfBlob, puppeteerBlob] = await Promise.all([
      jspdf.generatePDF(element, `${filename}-jspdf`),
      puppeteer.generatePDF(element, `${filename}-puppeteer`)
    ]);

    console.log('jsPDF size:', jspdfBlob.size);
    console.log('Puppeteer size:', puppeteerBlob.size);

    // Download both for visual comparison
    const downloads = [
      { blob: jspdfBlob, name: `${filename}-jspdf.pdf` },
      { blob: puppeteerBlob, name: `${filename}-puppeteer.pdf` }
    ];

    downloads.forEach(({ blob, name }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    });

    console.log('Both PDFs downloaded for comparison');
  } catch (error) {
    console.error('Comparison failed:', error);
  }
}
```

## Migration Steps

### Phase 1: Setup (Day 1)
1. Install dependencies
2. Create all new files as specified above
3. Keep existing Puppeteer implementation untouched

### Phase 2: Implementation (Days 2-3)
1. Implement jsPDF engine
2. Implement Puppeteer wrapper engine
3. Create factory and update pdf-generator.ts
4. Add environment configuration

### Phase 3: Testing (Days 4-5)
1. Test jsPDF generation in development
2. Compare output quality with Puppeteer
3. Test fallback mechanism
4. Performance testing

### Phase 4: Gradual Rollout (Days 6-7)
1. Deploy with PDF_ENGINE=puppeteer (no change)
2. Test with select users using PDF_ENGINE=jspdf
3. Monitor for issues
4. Switch to jsPDF as default when confident

## Best Practices Implemented

### 1. **SOLID Principles**
- Single Responsibility: Each engine handles only PDF generation
- Open/Closed: New engines can be added without modifying existing code
- Interface Segregation: Clean PDFEngine interface
- Dependency Inversion: Components depend on interface, not implementations

### 2. **Error Handling**
- Graceful fallback between engines
- Detailed error messages
- Console logging for debugging

### 3. **Performance**
- Lazy loading of engines
- Singleton pattern for engine instances
- Efficient canvas rendering settings

### 4. **Maintainability**
- Clear separation of concerns
- Well-documented code
- Type safety throughout

### 5. **Testing**
- Side-by-side comparison utility
- Environment-based configuration
- Development mode toggle

## Configuration Options

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_PDF_ENGINE=jspdf  # or 'puppeteer'
```

### Runtime Configuration
```javascript
// Force specific engine for a session
window.localStorage.setItem('pdfEngine', 'puppeteer');
```

## Rollback Plan

If issues arise with jsPDF:

1. **Immediate**: Change PDF_ENGINE=puppeteer in environment
2. **User-level**: Use localStorage override
3. **Code-level**: No code changes needed, Puppeteer remains intact

## Success Metrics

- PDF generation time < 2 seconds
- File size comparable to Puppeteer (±20%)
- Visual fidelity acceptable for invoices
- Zero failures in production

## Post-Migration

Once jsPDF is stable (2-4 weeks):
1. Remove Puppeteer engine code
2. Remove Puppeteer dependencies
3. Simplify factory to only use jsPDF
4. Remove toggle UI

This gradual approach ensures zero downtime and maintains the ability to instantly revert if needed.