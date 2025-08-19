import React from 'react';
import { ReactPdfRenderer } from '@/services/pdf/renderers/react-pdf-renderer';
import PdfGenerator from '@/services/pdf/generator';
import generateAndDistribute, { DistributionActions, DistributionResult } from '@/services/pdf/distribution';
import type { DocumentType, DocContext } from './DocumentTypes';

export class DocumentOrchestrator<TInput, TData> {
  constructor(private doc: DocumentType<TInput, TData>, private ctx: DocContext) {}

  async render(input: TInput, preferredEngine: 'puppeteer' | 'pdfkit' = 'puppeteer'): Promise<{ filename: string; pdfBuffer: Buffer; data: TData; }> {
    const raw = await this.doc.load(input, this.ctx);
    const data = await this.doc.transform(raw, this.ctx);
    this.doc.validate(data);
    const title = this.doc.title(data) || 'document';
    const renderer = new ReactPdfRenderer(() => this.doc.template(data), title);
    const pdfBuffer = await PdfGenerator.generate({ renderer, preferredEngine });
    return { filename: `${title}.pdf`, pdfBuffer, data };
  }

  async renderAndDistribute(input: TInput, actions: DistributionActions, preferredEngine: 'puppeteer' | 'pdfkit' = 'puppeteer'): Promise<{ data: TData; result: DistributionResult; }> {
    const raw = await this.doc.load(input, this.ctx);
    const data = await this.doc.transform(raw, this.ctx);
    this.doc.validate(data);
    const title = this.doc.title(data) || 'document';
    const renderer = new ReactPdfRenderer(() => this.doc.template(data), title);
    const result = await generateAndDistribute(renderer, actions);
    if (this.doc.onPersist) await this.doc.onPersist(data, result, this.ctx);
    return { data, result };
  }
}

export default DocumentOrchestrator;

