import type { PdfGenerateOptions, PdfRenderer } from './types';

/**
 * Generic server-side PDF generator.
 * - Prefers PDFKit for high quality and speed.
 * - Falls back to Puppeteer (HTML → PDF) if PDFKit fails and HTML is available.
 */
export class PdfGenerator {
  static async generate(options: PdfGenerateOptions): Promise<Buffer> {
    const { renderer, preferredEngine = 'pdfkit' } = options;

    if (preferredEngine === 'pdfkit') {
      try {
        return await this.generateWithPdfKit(renderer);
      } catch (err) {
        // On server, try Puppeteer fallback only if renderer provides HTML
        if (typeof window === 'undefined' && typeof renderer.renderHtml === 'function') {
          try {
            return await this.generateWithPuppeteer(renderer);
          } catch (pErr) {
            // Re-throw original error to aid debugging if both fail
            throw err;
          }
        }
        throw err;
      }
    }

    // Direct Puppeteer path if explicitly requested
    return await this.generateWithPuppeteer(renderer);
  }

  private static async generateWithPdfKit(renderer: PdfRenderer): Promise<Buffer> {
    if (typeof window !== 'undefined') {
      throw new Error('PDFKit generation must run on server');
    }

    // Dynamic import for ESM/CJS interop
    const mod: any = await import('pdfkit');
    const PDFDocument = mod?.default || mod;
    if (!PDFDocument) throw new Error('Failed to load pdfkit');

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50, autoFirstPage: true });
        const chunks: any[] = [];

        doc.on('data', (chunk: any) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Provide a safe font wrapper – renderers can call doc.safeFont(name)
        const safeFont = (fontName: string) => {
          try {
            return (doc as any).font(fontName);
          } catch {
            return doc; // default font
          }
        };
        (doc as any).safeFont = safeFont;

        renderer.renderPdfKit(doc);
        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  private static async generateWithPuppeteer(renderer: PdfRenderer): Promise<Buffer> {
    if (typeof window !== 'undefined') {
      throw new Error('Puppeteer generation is server-only');
    }
    if (typeof renderer.renderHtml !== 'function') {
      throw new Error('Renderer does not support HTML rendering for Puppeteer');
    }

    const { default: puppeteer } = await import('puppeteer');
    const html = renderer.renderHtml();

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html!, { waitUntil: 'networkidle0' });
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
      });
      return pdfBuffer as Buffer;
    } finally {
      await browser.close();
    }
  }
}

export default PdfGenerator;

