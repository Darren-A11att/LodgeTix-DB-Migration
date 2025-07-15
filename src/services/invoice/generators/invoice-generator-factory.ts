/**
 * Factory for creating invoice generators based on registration type
 */

import { BaseInvoiceGenerator } from './base-invoice-generator';
import { IndividualsInvoiceGenerator } from './individuals-invoice-generator';
import { LodgeInvoiceGenerator } from './lodge-invoice-generator';

export class InvoiceGeneratorFactory {
  private generators: Map<string, BaseInvoiceGenerator>;

  constructor() {
    this.generators = new Map();
    this.registerGenerators();
  }

  private registerGenerators(): void {
    this.generators.set('Individual', new IndividualsInvoiceGenerator());
    this.generators.set('Lodge', new LodgeInvoiceGenerator());
    this.generators.set('Delegation', new LodgeInvoiceGenerator()); // Use Lodge generator for Delegations
  }

  getGenerator(registrationType: string): BaseInvoiceGenerator {
    const generator = this.generators.get(registrationType);
    
    if (!generator) {
      // Default to individuals generator if type not found
      console.warn(`No generator found for type: ${registrationType}, using Individual generator`);
      return this.generators.get('Individual')!;
    }
    
    return generator;
  }

  /**
   * Get generator based on registration data
   */
  getGeneratorForRegistration(registration: any): BaseInvoiceGenerator {
    const type = this.determineRegistrationType(registration);
    return this.getGenerator(type);
  }

  private determineRegistrationType(registration: any): string {
    const regType = registration.registrationType || 
                   registration.registrationData?.type ||
                   registration.type;

    if (regType?.toLowerCase().includes('lodge')) return 'Lodge';
    if (regType?.toLowerCase().includes('delegation')) return 'Delegation';
    return 'Individual';
  }
}