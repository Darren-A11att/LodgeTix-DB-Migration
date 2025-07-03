import { InvoiceSupplier } from '../types/invoice';

// Customer Invoice Supplier (default)
export const DEFAULT_INVOICE_SUPPLIER: InvoiceSupplier = {
  name: 'United Grand Lodge of NSW & ACT',
  abn: '93 230 340 687',
  address: 'Level 5, 279 Castlereagh St Sydney NSW 2000',
  issuedBy: 'LodgeTix as Agent'
};

// Supplier Invoice Suppliers
export const LODGETIX_DARREN_SUPPLIER: InvoiceSupplier = {
  name: 'LodgeTix',
  abn: '21 013 997 842',
  address: '110/54a Blackwall Point Rd, Chiswick NSW 2046',
  issuedBy: 'Darren Allatt as Sole Trader'
};

export const LODGETIX_WINDING_STAIR_SUPPLIER: InvoiceSupplier = {
  name: 'LodgeTix / Lodge Tickets',
  abn: '94 687 923 128',
  address: '110/54a Blackwall Point Rd, Chiswick NSW 2046',
  issuedBy: 'Winding Stair Pty Limited (ACN: 687 923 128)'
};

// Helper function to get supplier based on payment source
export const getSupplierInvoiceSupplier = (paymentSourceFile?: string): InvoiceSupplier => {
  if (paymentSourceFile === 'Stripe - LodgeTix Darren Export.csv') {
    return LODGETIX_DARREN_SUPPLIER;
  }
  return LODGETIX_WINDING_STAIR_SUPPLIER;
};

export const INVOICE_AGENT_TEXT = 'Issued by: LodgeTix as Agent';