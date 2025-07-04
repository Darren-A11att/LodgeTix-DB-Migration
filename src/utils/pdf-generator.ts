/**
 * Generate a PDF from HTML content using server-side rendering
 * @param element - The DOM element to convert to PDF
 * @param filename - The filename for the PDF (without extension)
 * @returns Promise<Blob> - The PDF as a blob
 */
export async function generatePDF(
  element: HTMLElement,
  filename: string
): Promise<Blob> {
  try {
    // Get the complete HTML including styles
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
                  // Handle cross-origin stylesheets
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

    // Send to server for PDF generation
    const response = await fetch('/api/invoices/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ html, filename }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF');
    }

    return await response.blob();
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
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