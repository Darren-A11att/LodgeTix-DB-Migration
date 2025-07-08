"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvoice = createInvoice;
exports.createInvoiceWithSequence = createInvoiceWithSequence;
exports.calculateInvoiceTotals = calculateInvoiceTotals;
const invoice_1 = require("../constants/invoice");
const invoice_sequence_1 = require("./invoice-sequence");
function createInvoice(params) {
    const { items } = params;
    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    // Calculate processing fees (2.5% of subtotal as example)
    const processingFees = Math.round(subtotal * 0.025 * 100) / 100;
    // Calculate GST (10% of subtotal + fees)
    const totalBeforeGST = subtotal + processingFees;
    const gstIncluded = Math.round(totalBeforeGST * 0.10 * 100) / 100;
    // Total
    const total = Math.round((subtotal + processingFees) * 100) / 100;
    return {
        invoiceNumber: params.invoiceNumber || '', // Will be set by createInvoiceWithSequence if not provided
        date: params.date,
        status: params.status,
        supplier: invoice_1.DEFAULT_INVOICE_SUPPLIER,
        billTo: params.billTo,
        items: params.items,
        subtotal,
        processingFees,
        gstIncluded,
        total,
        payment: params.payment,
        paymentId: params.paymentId,
        registrationId: params.registrationId,
        createdAt: new Date(),
        updatedAt: new Date()
    };
}
async function createInvoiceWithSequence(params) {
    const { db, ...invoiceParams } = params;
    // Generate invoice number if not provided
    if (!invoiceParams.invoiceNumber) {
        const invoiceSequence = new invoice_sequence_1.InvoiceSequence(db);
        invoiceParams.invoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber();
    }
    return createInvoice(invoiceParams);
}
function calculateInvoiceTotals(items) {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const processingFees = Math.round(subtotal * 0.025 * 100) / 100;
    const totalBeforeGST = subtotal + processingFees;
    const gstIncluded = Math.round(totalBeforeGST * 0.10 * 100) / 100;
    const total = Math.round((subtotal + processingFees) * 100) / 100;
    return {
        subtotal,
        processingFees,
        gstIncluded,
        total
    };
}
//# sourceMappingURL=invoice-helpers.js.map