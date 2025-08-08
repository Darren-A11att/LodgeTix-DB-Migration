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

    // Check for localStorage preference (for testing)
    if (typeof window !== 'undefined' && !preferredEngine) {
      preferredEngine = localStorage.getItem('pdfEngine') || undefined;
    }

    // Determine which engine to use (prefer server-based by default)
    const enginePreference = preferredEngine || process.env.NEXT_PUBLIC_PDF_ENGINE || 'puppeteer';

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
