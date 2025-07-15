"use strict";
/**
 * Base abstract class for all invoice generators
 * Provides common functionality and defines the contract for invoice generation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseInvoiceGenerator = void 0;
const invoice_1 = require("../../../constants/invoice");
class BaseInvoiceGenerator {
    /**
     * Get the invoice type (customer or supplier)
     * Subclasses can override if needed
     */
    getInvoiceType() {
        return 'customer';
    }
    /**
     * Get the default supplier information
     * Can be overridden by subclasses if they use different suppliers
     */
    getSupplier() {
        return invoice_1.DEFAULT_INVOICE_SUPPLIER;
    }
    /**
     * Generate invoice number
     * Uses provided invoice numbers or generates a temporary one
     */
    getInvoiceNumber(options) {
        if (this.getInvoiceType() === 'customer') {
            return options.invoiceNumbers?.customerInvoiceNumber || this.generateTemporaryInvoiceNumber('LTIV');
        }
        else {
            return options.invoiceNumbers?.supplierInvoiceNumber || this.generateTemporaryInvoiceNumber('LTSP');
        }
    }
    /**
     * Generate a temporary invoice number for previews
     */
    generateTemporaryInvoiceNumber(prefix) {
        const timestamp = Date.now().toString(36).toUpperCase();
        return `${prefix}-TEMP-${timestamp}`;
    }
    /**
     * Get invoice date from payment
     */
    getInvoiceDate(options) {
        const { payment } = options;
        // Try various date fields
        const dateValue = payment.paymentDate ||
            payment.timestamp ||
            payment.createdAt ||
            new Date();
        // Ensure it's a Date object
        if (dateValue instanceof Date) {
            return dateValue;
        }
        // Try to parse string date
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    /**
     * Calculate due date (default: 30 days from invoice date)
     */
    calculateDueDate(invoiceDate, daysUntilDue = 30) {
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + daysUntilDue);
        return dueDate;
    }
    /**
     * Get invoice status based on payment status
     */
    getInvoiceStatus(paymentStatus) {
        const normalized = (paymentStatus || '').toLowerCase();
        if (['paid', 'completed', 'succeeded', 'success'].includes(normalized)) {
            return 'paid';
        }
        if (['cancelled', 'canceled', 'failed', 'refunded'].includes(normalized)) {
            return 'cancelled';
        }
        return 'pending';
    }
    /**
     * Validate required options
     */
    validateOptions(options) {
        if (!options.payment) {
            throw new Error('Payment data is required for invoice generation');
        }
        if (!options.registration) {
            throw new Error('Registration data is required for invoice generation');
        }
    }
    /**
     * Get function name with fallback
     */
    getFunctionName(options) {
        return options.functionName ||
            options.registration.functionName ||
            options.relatedDocuments?.functionDetails?.name ||
            'Event';
    }
    /**
     * Format currency amount for display
     */
    formatCurrency(amount, currency = 'AUD') {
        const formatter = new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return formatter.format(amount);
    }
    /**
     * Check if this is a lodge registration
     */
    isLodgeRegistration(options) {
        const registrationType = options.registration.registrationType ||
            options.registration.type ||
            '';
        return registrationType.toLowerCase() === 'lodge';
    }
    /**
     * Check if this is an individuals registration
     */
    isIndividualsRegistration(options) {
        const registrationType = options.registration.registrationType ||
            options.registration.type ||
            '';
        return registrationType.toLowerCase() === 'individuals';
    }
    /**
     * Get confirmation number with fallback
     */
    getConfirmationNumber(options) {
        return options.registration.confirmationNumber || 'N/A';
    }
}
exports.BaseInvoiceGenerator = BaseInvoiceGenerator;
