"use strict";
/**
 * Repository for fetching invoice-related data from MongoDB
 * Follows the same patterns as existing server code
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceDataRepository = void 0;
const mongodb_1 = require("mongodb");
class InvoiceDataRepository {
    constructor(db) {
        this.db = db;
        this.paymentsCollection = db.collection('payments');
        this.registrationsCollection = db.collection('registrations');
    }
    /**
     * Fetch a payment by various ID fields
     * Follows the same pattern as server.ts payment queries
     */
    async getPayment(paymentId) {
        const payment = await this.paymentsCollection.findOne({
            $or: [
                { paymentId },
                { _id: paymentId },
                { transactionId: paymentId },
                { stripePaymentIntentId: paymentId },
                { squarePaymentId: paymentId }
            ]
        });
        return payment;
    }
    /**
     * Fetch a registration by confirmation number
     * Follows the existing server pattern
     */
    async getRegistrationByConfirmation(confirmationNumber) {
        const registration = await this.registrationsCollection.findOne({
            confirmationNumber
        });
        return registration;
    }
    /**
     * Fetch a registration by payment ID
     * Uses the same $or pattern as PaymentRegistrationMatcher
     */
    async getRegistrationByPaymentId(paymentId) {
        const registration = await this.registrationsCollection.findOne({
            $or: [
                { stripePaymentIntentId: paymentId },
                { stripe_payment_intent_id: paymentId },
                { squarePaymentId: paymentId },
                { square_payment_id: paymentId },
                { 'registrationData.squarePaymentId': paymentId },
                { 'registrationData.square_payment_id': paymentId },
                { 'metadata.squarePaymentId': paymentId }
            ]
        });
        return registration;
    }
    /**
     * Fetch unmatched payments for invoice generation
     * Same query as used in server.ts
     */
    async getUnmatchedPayments(limit = 100) {
        const payments = await this.paymentsCollection.find({
            $and: [
                {
                    $or: [
                        { invoiceCreated: { $ne: true } },
                        { invoiceCreated: { $exists: false } }
                    ]
                },
                {
                    $or: [
                        { invoiceDeclined: { $ne: true } },
                        { invoiceDeclined: { $exists: false } }
                    ]
                }
            ]
        })
            .sort({ timestamp: 1 })
            .limit(limit)
            .toArray();
        return payments;
    }
    /**
     * Fetch payment and matching registration
     * Combines logic from multiple server patterns
     */
    async getPaymentWithRegistration(paymentId) {
        const payment = await this.getPayment(paymentId);
        if (!payment) {
            return { payment: null, registration: null };
        }
        // Try to find registration by confirmation number first
        let registration = null;
        // Extract confirmation number from payment metadata or description
        const confirmationNumber = payment.metadata?.confirmationNumber ||
            payment.description?.match(/[A-Z]{3}-\d{6}[A-Z]{2}/)?.[0];
        if (confirmationNumber) {
            registration = await this.getRegistrationByConfirmation(confirmationNumber);
        }
        // If not found by confirmation, try by payment ID
        if (!registration) {
            registration = await this.getRegistrationByPaymentId(paymentId);
        }
        return { payment, registration };
    }
    /**
     * Update payment with invoice information
     * Follows the pattern from server.ts
     */
    async updatePaymentWithInvoice(paymentId, invoiceId, invoiceNumber) {
        const result = await this.paymentsCollection.updateOne({ paymentId }, {
            $set: {
                invoiceId,
                invoiceNumber,
                invoiceCreated: true,
                invoiceCreatedAt: new Date()
            }
        });
        return result.modifiedCount > 0;
    }
    /**
     * Get function details by ID
     * Used for fetching function names
     */
    async getFunctionDetails(functionId) {
        const functionsCollection = this.db.collection('functions');
        return functionsCollection.findOne({ _id: new mongodb_1.ObjectId(functionId) });
    }
}
exports.InvoiceDataRepository = InvoiceDataRepository;
