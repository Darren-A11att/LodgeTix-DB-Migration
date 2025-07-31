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