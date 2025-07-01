import { InvoiceSupplier } from '../types/invoice';

export const DEFAULT_INVOICE_SUPPLIER: InvoiceSupplier = {
  name: 'United Grand Lodge of NSW & ACT',
  abn: '93 230 340 687',
  address: 'Level 5, 279 Castlereagh St Sydney NSW 2000',
  issuedBy: 'LodgeTix as Agent'
};

export const INVOICE_AGENT_TEXT = 'Issued by: LodgeTix as Agent';