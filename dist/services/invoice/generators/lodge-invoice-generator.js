"use strict";
/**
 * Invoice generator for lodge registrations
 * Handles generation of invoices for lodge/organization registrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LodgeInvoiceGenerator = void 0;
const base_invoice_generator_1 = require("./base-invoice-generator");
const registration_processor_1 = require("../processors/registration-processor");
const payment_processor_1 = require("../processors/payment-processor");
const line_item_builder_1 = require("../builders/line-item-builder");
const fee_calculator_1 = require("../calculators/fee-calculator");
const monetary_1 = require("../calculators/monetary");
class LodgeInvoiceGenerator extends base_invoice_generator_1.BaseInvoiceGenerator {
    constructor() {
        super();
        this.registrationProcessor = new registration_processor_1.RegistrationProcessor();
        this.paymentProcessor = new payment_processor_1.PaymentProcessor();
    }
    /**
     * Generate an invoice for lodge registration
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
     * Generate line items for lodge invoice
     */
    generateLineItems(options) {
        const { registration } = options;
        // Process registration to get lodge info and tickets
        const processedData = this.registrationProcessor.process(registration);
        const { attendees, tickets, lodgeInfo, confirmationNumber } = processedData;
        // Get function name
        const functionName = this.getFunctionName(options);
        // Get lodge name
        const lodgeName = this.extractLodgeName(registration, lodgeInfo);
        // Build line items
        const builder = new line_item_builder_1.LineItemBuilder();
        // Add lodge header
        builder.addLodgeHeader(confirmationNumber || 'N/A', lodgeName, functionName);
        // For lodge registrations, we typically show aggregate information
        // rather than individual attendees
        if (attendees.length > 0 || tickets.length > 0) {
            // Calculate member count and average price
            const memberCount = attendees.length || 1;
            const totalTicketValue = tickets.reduce((sum, ticket) => sum + (ticket.price * ticket.quantity), 0);
            const pricePerMember = memberCount > 0 ? totalTicketValue / memberCount : totalTicketValue;
            // Add lodge registration line item
            builder.addLodgeItems(lodgeName, memberCount, pricePerMember);
        }
        else {
            // Fallback: add tickets directly if no attendee information
            tickets.forEach(ticket => {
                builder.addLineItem(ticket.name, ticket.quantity, ticket.price);
            });
        }
        return builder.build();
    }
    /**
     * Extract billing information for lodge registration
     * Lodge registrations prioritize metadata.billingDetails
     */
    extractBillTo(options) {
        const { registration } = options;
        // Use registration processor to extract billing details
        const billingDetails = this.registrationProcessor.extractBillingDetails(registration);
        // For lodge registrations, we don't use addressLine1 if it duplicates business name
        const addressLine1 = billingDetails.addressLine1;
        const shouldSkipAddress = addressLine1 &&
            billingDetails.businessName &&
            addressLine1.toLowerCase() === billingDetails.businessName.toLowerCase();
        // Convert to InvoiceBillTo format
        return {
            businessName: billingDetails.businessName,
            businessNumber: billingDetails.businessNumber,
            firstName: billingDetails.firstName || '',
            lastName: billingDetails.lastName || '',
            email: billingDetails.email || 'no-email@lodgetix.io',
            addressLine1: shouldSkipAddress ? '' : addressLine1,
            addressLine2: billingDetails.addressLine2,
            city: billingDetails.city,
            postalCode: billingDetails.postalCode,
            stateProvince: billingDetails.stateProvince,
            country: billingDetails.country
        };
    }
    /**
     * Extract lodge name from registration
     */
    extractLodgeName(registration, lodgeInfo) {
        // Try various sources for lodge name
        const lodgeName = lodgeInfo?.lodgeName ||
            registration.lodgeName ||
            registration.registrationData?.lodge?.name ||
            registration.organisation?.name ||
            registration.businessName ||
            registration.metadata?.billingDetails?.businessName ||
            'Lodge';
        return lodgeName;
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
exports.LodgeInvoiceGenerator = LodgeInvoiceGenerator;
