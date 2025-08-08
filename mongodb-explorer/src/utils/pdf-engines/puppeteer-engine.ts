import { PDFEngine, PDFGeneratorOptions } from '@/types/pdf-engine';

export class PuppeteerEngine implements PDFEngine {
  name = 'puppeteer';

  async isAvailable(): Promise<boolean> {
    // This engine calls our API route, so it can run in both
    // browser and server environments as long as fetch is available.
    return true;
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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Puppeteer API failed: ${errorData.error || response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Puppeteer generation failed:', error);
      throw new Error(`Failed to generate PDF with Puppeteer: ${(error as Error).message}`);
    }
  }
}
