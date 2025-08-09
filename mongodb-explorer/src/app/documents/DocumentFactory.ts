import type { DocumentType } from './DocumentTypes';
import { InvoiceDocumentType } from '@/domain/documents/invoice/InvoiceDocumentType';
import { ReceiptDocumentType } from '@/domain/documents/receipt/ReceiptDocumentType';

export type SupportedDocType = 'invoice' | 'receipt';

export class DocumentFactory {
  static get(type: SupportedDocType): DocumentType<any, any> {
    switch (type) {
      case 'invoice':
        return new InvoiceDocumentType();
      case 'receipt':
        return new ReceiptDocumentType();
      default:
        throw new Error(`Unsupported document type: ${type}`);
    }
  }
}

export default DocumentFactory;
