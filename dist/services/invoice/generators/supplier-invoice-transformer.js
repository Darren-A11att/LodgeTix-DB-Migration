"use strict";
/**
 * Supplier invoice transformer
 * Transforms customer invoices into supplier invoices with appropriate fees
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierInvoiceTransformer = void 0;
const base_invoice_generator_1 = require("./base-invoice-generator");
const payment_processor_1 = require("../processors/payment-processor");
const line_item_builder_1 = require("../builders/line-item-builder");
const fee_calculator_1 = require("../calculators/fee-calculator");
const invoice_1 = require("../../../constants/invoice");
class SupplierInvoiceTransformer extends base_invoice_generator_1.BaseInvoiceGenerator {
    constructor() {
        super();
        this.paymentProcessor = new payment_processor_1.PaymentProcessor();
    }
    /**
     * Transform a customer invoice into a supplier invoice
     */
    async generateInvoice(options) {
        // Validate that we have a customer invoice to transform
        if (!options.customerInvoice) {
            throw new Error('Customer invoice is required for supplier invoice generation');
        }
        const { payment, registration, customerInvoice } = options;
        // Process payment data to get source
        const paymentInfo = this.paymentProcessor.process(payment);
        // Get the appropriate supplier based on payment source
        const supplierDetails = (0, invoice_1.getSupplierInvoiceSupplier)(payment.sourceFile);
        // Generate line items
        const items = this.generateLineItems(options);
        // Calculate totals for supplier invoice
        const totals = (0, fee_calculator_1.calculateSupplierInvoiceTotals)(customerInvoice.total, customerInvoice.processingFees, paymentInfo.source);
        // Extract billing details (bill to UGLNSW for supplier invoices)
        const billTo = this.extractBillTo(options);
        // Get dates (use same as customer invoice)
        const invoiceDate = customerInvoice.date instanceof Date
            ? customerInvoice.date
            : new Date(customerInvoice.date);
        const dueDate = customerInvoice.dueDate instanceof Date
            ? customerInvoice.dueDate
            : customerInvoice.dueDate
                ? new Date(customerInvoice.dueDate)
                : this.calculateDueDate(invoiceDate);
        // Build the supplier invoice
        const invoice = {
            invoiceType: 'supplier',
            invoiceNumber: this.getInvoiceNumber(options),
            paymentId: payment._id?.toString() || payment.paymentId,
            registrationId: registration._id?.toString() || registration.registrationId,
            relatedInvoiceId: customerInvoice.invoiceNumber, // Link to customer invoice
            date: invoiceDate,
            dueDate: dueDate,
            billTo: billTo,
            supplier: supplierDetails, // LodgeTix as supplier
            items: items,
            subtotal: totals.subtotal,
            processingFees: 0, // No processing fees on supplier invoice
            gstIncluded: totals.gstIncluded,
            totalBeforeGST: totals.subtotal,
            total: totals.total,
            payment: {
                ...paymentInfo,
                // Override payment details for supplier invoice
                amount: totals.total,
                status: 'pending' // Supplier invoices are pending payment from UGLNSW
            },
            status: 'pending', // Supplier invoices start as pending
            notes: `Related to Customer Invoice: ${customerInvoice.invoiceNumber}`
        };
        return invoice;
    }
    /**
     * Generate line items for supplier invoice
     */
    generateLineItems(options) {
        const { customerInvoice, payment } = options;
        if (!customerInvoice) {
            throw new Error('Customer invoice is required for line item generation');
        }
        // Process payment to get source
        const paymentInfo = this.paymentProcessor.process(payment);
        // Calculate fees
        const totals = (0, fee_calculator_1.calculateSupplierInvoiceTotals)(customerInvoice.total, customerInvoice.processingFees, paymentInfo.source);
        // Build line items
        const builder = new line_item_builder_1.LineItemBuilder();
        // Add processing fees reimbursement
        if (totals.processingFeesReimbursement > 0) {
            builder.addProcessingFeesReimbursement(totals.processingFeesReimbursement);
        }
        // Add software utilization fee
        if (totals.softwareUtilizationFee > 0) {
            builder.addSoftwareUtilizationFee(totals.softwareUtilizationFee);
        }
        return builder.build();
    }
    /**
     * Extract billing information for supplier invoice
     * For supplier invoices, bill to is always UGLNSW
     */
    extractBillTo(options) {
        // Supplier invoices always bill to UGLNSW
        return {
            businessName: invoice_1.DEFAULT_INVOICE_SUPPLIER.name,
            businessNumber: invoice_1.DEFAULT_INVOICE_SUPPLIER.abn,
            firstName: '',
            lastName: '',
            email: 'accounting@masonicnswact.com', // You may want to configure this
            addressLine1: invoice_1.DEFAULT_INVOICE_SUPPLIER.address,
            city: 'Sydney',
            postalCode: '2000',
            stateProvince: 'NSW',
            country: 'Australia'
        };
    }
    /**
     * Override to return supplier invoice type
     */
    getInvoiceType() {
        return 'supplier';
    }
    /**
     * Generate supplier invoice number from customer invoice number
     */
    getInvoiceNumber(options) {
        // If we have invoice numbers provided, use them
        if (options.invoiceNumbers?.supplierInvoiceNumber) {
            return options.invoiceNumbers.supplierInvoiceNumber;
        }
        // If we have a customer invoice number, transform it
        if (options.customerInvoice?.invoiceNumber) {
            return options.customerInvoice.invoiceNumber.replace(/^LTIV-/, 'LTSP-');
        }
        // Otherwise generate a temporary one
        return this.generateTemporaryInvoiceNumber('LTSP');
    }
}
exports.SupplierInvoiceTransformer = SupplierInvoiceTransformer;
