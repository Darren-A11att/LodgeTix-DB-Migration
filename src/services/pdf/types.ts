export interface PdfRenderer {
  /**
   * Render content using PDFKit. Called when using the PDFKit engine.
   */
  renderPdfKit(doc: any): void;

  /**
   * Return an HTML string suitable for headless browser rendering (Puppeteer).
   * Optional – only needed for Puppeteer fallback.
   */
  renderHtml?(): string;

  /**
   * Optional title or filename hint (without extension)
   */
  getTitle?(): string;
}

export type PdfEngine = 'pdfkit' | 'puppeteer';

export interface PdfGenerateOptions {
  renderer: PdfRenderer;
  preferredEngine?: PdfEngine; // default: 'pdfkit'
}

