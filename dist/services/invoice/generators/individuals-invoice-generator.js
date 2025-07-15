"use strict";
/**
 * Invoice generator for individuals registrations
 * Handles generation of invoices for individual attendees with their tickets
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndividualsInvoiceGenerator = void 0;
const base_invoice_generator_1 = require("./base-invoice-generator");
const registration_processor_1 = require("../processors/registration-processor");
const payment_processor_1 = require("../processors/payment-processor");
const line_item_builder_1 = require("../builders/line-item-builder");
const fee_calculator_1 = require("../calculators/fee-calculator");
const monetary_1 = require("../calculators/monetary");
class IndividualsInvoiceGenerator extends base_invoice_generator_1.BaseInvoiceGenerator {
    constructor() {
        super();
        this.registrationProcessor = new registration_processor_1.RegistrationProcessor();
        this.paymentProcessor = new payment_processor_1.PaymentProcessor();
    }
    /**
     * Generate an invoice for individuals registration
     */
    async generateInvoice(options) {
        // Validate options
        this.validateOptions(options);
        const { payment, registration } = options;
        // Process registration data
        const processedData = this.registrationProcessor.process(registration);
        // Process payment data
        const paymentInfo = this.paymentProcessor.process(payment);
        // Generate line items
        const items = this.generateLineItems(options);
        // Calculate totals
        const paymentAmount = (0, monetary_1.getMonetaryValue)(payment.grossAmount || payment.amount || 0);
        const itemsSubtotal = this.calculateItemsSubtotal(items);
        // Use payment amount to calculate fees if we have it, otherwise calculate from items
        let totals;
        if (paymentAmount > 0 && paymentAmount > itemsSubtotal) {
            // We have the full payment amount, work backwards to get fees
            totals = (0, fee_calculator_1.calculateCustomerInvoiceTotalsFromTotal)(paymentAmount, paymentInfo.source);
        }
        else {
            // Calculate fees from subtotal
            totals = (0, fee_calculator_1.calculateCustomerInvoiceTotals)(itemsSubtotal, paymentInfo.source);
        }
        // Extract billing details
        const billTo = this.extractBillTo(options);
        // Get dates
        const invoiceDate = this.getInvoiceDate(options);
        const dueDate = this.calculateDueDate(invoiceDate);
        // Build the invoice
        const invoice = {
            invoiceType: 'customer',
            invoiceNumber: this.getInvoiceNumber(options),
            paymentId: payment._id?.toString() || payment.paymentId,
            registrationId: registration._id?.toString() || registration.registrationId,
            date: invoiceDate,
            dueDate: dueDate,
            billTo: billTo,
            supplier: this.getSupplier(),
            items: items,
            subtotal: totals.subtotal,
            processingFees: totals.processingFees,
            gstIncluded: totals.gstIncluded,
            totalBeforeGST: totals.totalBeforeGST,
            total: totals.total,
            payment: paymentInfo,
            status: this.getInvoiceStatus(payment.status),
            notes: ''
        };
        return invoice;
    }
    /**
     * Generate line items for individuals invoice
     */
    generateLineItems(options) {
        const { registration } = options;
        // Process registration to get attendees and tickets
        const processedData = this.registrationProcessor.process(registration);
        const { attendees, confirmationNumber } = processedData;
        // Get function name
        const functionName = this.getFunctionName(options);
        // Build line items
        const builder = new line_item_builder_1.LineItemBuilder();
        // Add confirmation header
        builder.addConfirmationHeader(confirmationNumber || 'N/A', functionName);
        // Add attendees with their tickets
        builder.addAttendees(attendees);
        // Add any unassigned tickets
        builder.addUnassignedTickets(processedData.tickets);
        return builder.build();
    }
    /**
     * Extract billing information for individuals registration
     */
    extractBillTo(options) {
        const { registration } = options;
        // Use registration processor to extract billing details
        const billingDetails = this.registrationProcessor.extractBillingDetails(registration);
        // Convert to InvoiceBillTo format
        return {
            businessName: billingDetails.businessName,
            businessNumber: billingDetails.businessNumber,
            firstName: billingDetails.firstName || 'Unknown',
            lastName: billingDetails.lastName || 'Customer',
            email: billingDetails.email || 'no-email@lodgetix.io',
            addressLine1: billingDetails.addressLine1,
            addressLine2: billingDetails.addressLine2,
            city: billingDetails.city,
            postalCode: billingDetails.postalCode,
            stateProvince: billingDetails.stateProvince,
            country: billingDetails.country
        };
    }
    /**
     * Calculate subtotal from line items
     */
    calculateItemsSubtotal(items) {
        let subtotal = 0;
        items.forEach(item => {
            // Add main item total if it has one
            if (item.total) {
                subtotal += item.total;
            }
            // Add sub-item totals
            if (item.subItems) {
                item.subItems.forEach(subItem => {
                    const itemTotal = (subItem.quantity || 0) * (subItem.price || 0);
                    subtotal += itemTotal;
                });
            }
        });
        return subtotal;
    }
}
exports.IndividualsInvoiceGenerator = IndividualsInvoiceGenerator;
