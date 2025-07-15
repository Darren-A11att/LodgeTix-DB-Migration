"use strict";
/**
 * Data service for fetching payments and registrations from MongoDB
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceDataService = void 0;
const mongodb_1 = require("@/lib/mongodb");
class InvoiceDataService {
    /**
     * Fetch a payment by ID
     */
    static async getPayment(paymentId) {
        const { db } = await (0, mongodb_1.connectMongoDB)();
        const payment = await db.collection('payments').findOne({
            $or: [
                { paymentId },
                { _id: paymentId },
                { transactionId: paymentId }
            ]
        });
        return payment;
    }
    /**
     * Fetch a registration by confirmation number
     */
    static async getRegistration(confirmationNumber) {
        const { db } = await (0, mongodb_1.connectMongoDB)();
        const registration = await db.collection('registrations').findOne({
            confirmationNumber
        });
        return registration;
    }
    /**
     * Fetch payment and registration for invoice generation
     */
    static async getInvoiceData(paymentId, confirmationNumber) {
        const { db } = await (0, mongodb_1.connectMongoDB)();
        // Get payment
        const payment = await this.getPayment(paymentId);
        if (!payment) {
            return { payment: null, registration: null };
        }
        // Try to find confirmation number from payment if not provided
        if (!confirmationNumber) {
            confirmationNumber = payment.metadata?.confirmationNumber ||
                payment.description?.match(/[A-Z]{3}-\d{6}[A-Z]{2}/)?.[0];
        }
        // Get registration
        const registration = confirmationNumber
            ? await this.getRegistration(confirmationNumber)
            : null;
        return { payment, registration };
    }
    /**
     * Fetch multiple payments and registrations
     */
    static async getBulkInvoiceData(paymentIds) {
        const results = await Promise.all(paymentIds.map(async (paymentId) => {
            const { payment, registration } = await this.getInvoiceData(paymentId);
            return { paymentId, payment, registration };
        }));
        return results;
    }
}
exports.InvoiceDataService = InvoiceDataService;
