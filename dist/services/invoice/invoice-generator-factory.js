"use strict";
/**
 * Factory for creating appropriate invoice generators based on registration type
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceGeneratorFactory = void 0;
const individuals_invoice_generator_1 = require("./generators/individuals-invoice-generator");
const lodge_invoice_generator_1 = require("./generators/lodge-invoice-generator");
const supplier_invoice_transformer_1 = require("./generators/supplier-invoice-transformer");
class InvoiceGeneratorFactory {
    /**
     * Create an appropriate invoice generator based on registration type
     */
    static create(registrationType) {
        const type = registrationType.toLowerCase();
        switch (type) {
            case 'individuals':
            case 'individual':
                return new individuals_invoice_generator_1.IndividualsInvoiceGenerator();
            case 'lodge':
            case 'organisation':
            case 'organization':
                return new lodge_invoice_generator_1.LodgeInvoiceGenerator();
            case 'supplier':
                return new supplier_invoice_transformer_1.SupplierInvoiceTransformer();
            case 'delegation':
                // Delegations are similar to lodge registrations
                return new lodge_invoice_generator_1.LodgeInvoiceGenerator();
            default:
                throw new Error(`Unknown registration type: ${registrationType}`);
        }
    }
    /**
     * Create an invoice generator from a registration object
     */
    static createFromRegistration(registration) {
        // Determine registration type from various fields
        const registrationType = registration.registrationType ||
            registration.type ||
            registration.registrationData?.type ||
            'individuals'; // Default to individuals
        return this.create(registrationType);
    }
    /**
     * Create a supplier invoice generator
     */
    static createSupplierGenerator() {
        return new supplier_invoice_transformer_1.SupplierInvoiceTransformer();
    }
    /**
     * Determine if a registration is for individuals
     */
    static isIndividualsRegistration(registration) {
        const type = (registration.registrationType ||
            registration.type ||
            registration.registrationData?.type ||
            '').toLowerCase();
        return type === 'individuals' || type === 'individual';
    }
    /**
     * Determine if a registration is for a lodge
     */
    static isLodgeRegistration(registration) {
        const type = (registration.registrationType ||
            registration.type ||
            registration.registrationData?.type ||
            '').toLowerCase();
        return type === 'lodge' || type === 'organisation' || type === 'organization';
    }
    /**
     * Get a human-readable registration type
     */
    static getRegistrationTypeDisplay(registration) {
        if (this.isIndividualsRegistration(registration)) {
            return 'Individuals';
        }
        if (this.isLodgeRegistration(registration)) {
            return 'Lodge';
        }
        const type = registration.registrationType ||
            registration.type ||
            registration.registrationData?.type ||
            'Unknown';
        // Capitalize first letter
        return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }
}
exports.InvoiceGeneratorFactory = InvoiceGeneratorFactory;
