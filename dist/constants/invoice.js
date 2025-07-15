"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVOICE_AGENT_TEXT = exports.getSupplierInvoiceSupplier = exports.LODGETIX_WINDING_STAIR_SUPPLIER = exports.LODGETIX_DARREN_SUPPLIER = exports.DEFAULT_INVOICE_SUPPLIER = void 0;
// Customer Invoice Supplier (default)
exports.DEFAULT_INVOICE_SUPPLIER = {
    name: 'United Grand Lodge of NSW & ACT',
    abn: '93 230 340 687',
    address: 'Level 5, 279 Castlereagh St Sydney NSW 2000',
    issuedBy: 'LodgeTix as Agent'
};
// Supplier Invoice Suppliers
exports.LODGETIX_DARREN_SUPPLIER = {
    name: 'LodgeTix',
    abn: '21 013 997 842',
    address: '110/54a Blackwall Point Rd, Chiswick NSW 2046',
    issuedBy: 'Darren Allatt as Sole Trader'
};
exports.LODGETIX_WINDING_STAIR_SUPPLIER = {
    name: 'LodgeTix / Lodge Tickets',
    abn: '94 687 923 128',
    address: '110/54a Blackwall Point Rd, Chiswick NSW 2046',
    issuedBy: 'Winding Stair Pty Limited (ACN: 687 923 128)'
};
// Helper function to get supplier based on payment source
const getSupplierInvoiceSupplier = (paymentSourceFile) => {
    if (paymentSourceFile === 'Stripe - LodgeTix Darren Export.csv') {
        return exports.LODGETIX_DARREN_SUPPLIER;
    }
    return exports.LODGETIX_WINDING_STAIR_SUPPLIER;
};
exports.getSupplierInvoiceSupplier = getSupplierInvoiceSupplier;
exports.INVOICE_AGENT_TEXT = 'Issued by: LodgeTix as Agent';
