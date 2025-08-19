import React from 'react';
import type { PdfRenderer } from '../types';

export class ReactPdfRenderer implements PdfRenderer {
  constructor(
    private elementFactory: () => React.ReactElement,
    private title?: string
  ) {}

  getTitle() { return this.title || 'document'; }

  // For strict parity with screen rendering, we rely on HTML + Puppeteer.
  // If the generator attempts PDFKit first, this will throw and trigger fallback.
  renderPdfKit(_doc: any): void {
    throw new Error('ReactPdfRenderer does not implement PDFKit drawing. Use Puppeteer/HTML.');
  }

  renderHtml(): string {
    // Dynamically import server-side rendering only when needed
    const { renderDocumentToHtml } = require('../react/render-to-html.server');
    return renderDocumentToHtml(this.elementFactory(), { title: this.getTitle() });
  }
}

export default ReactPdfRenderer;

