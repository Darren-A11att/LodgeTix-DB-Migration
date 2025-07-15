"use strict";
/**
 * Factory for creating invoice generators based on registration type
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceGeneratorFactory = void 0;
const individuals_invoice_generator_1 = require("./individuals-invoice-generator");
const lodge_invoice_generator_1 = require("./lodge-invoice-generator");
class InvoiceGeneratorFactory {
    constructor() {
        this.generators = new Map();
        this.registerGenerators();
    }
    registerGenerators() {
        this.generators.set('Individual', new individuals_invoice_generator_1.IndividualsInvoiceGenerator());
        this.generators.set('Lodge', new lodge_invoice_generator_1.LodgeInvoiceGenerator());
        this.generators.set('Delegation', new lodge_invoice_generator_1.LodgeInvoiceGenerator()); // Use Lodge generator for Delegations
    }
    getGenerator(registrationType) {
        const generator = this.generators.get(registrationType);
        if (!generator) {
            // Default to individuals generator if type not found
            console.warn(`No generator found for type: ${registrationType}, using Individual generator`);
            return this.generators.get('Individual');
        }
        return generator;
    }
    /**
     * Get generator based on registration data
     */
    getGeneratorForRegistration(registration) {
        const type = this.determineRegistrationType(registration);
        return this.getGenerator(type);
    }
    determineRegistrationType(registration) {
        const regType = registration.registrationType ||
            registration.registrationData?.type ||
            registration.type;
        if (regType?.toLowerCase().includes('lodge'))
            return 'Lodge';
        if (regType?.toLowerCase().includes('delegation'))
            return 'Delegation';
        return 'Individual';
    }
}
exports.InvoiceGeneratorFactory = InvoiceGeneratorFactory;
