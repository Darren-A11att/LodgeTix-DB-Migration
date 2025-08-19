/**
 * Factory for creating appropriate invoice generators based on registration type
 * Updated to use normalized invoice generators
 */

import { BaseInvoiceGenerator } from './generators/base-invoice-generator';
import { NormalizedIndividualsInvoiceGenerator } from './generators/individuals-invoice-generator-normalized';
import { NormalizedLodgeInvoiceGenerator } from './generators/lodge-invoice-generator-normalized';
import { SupplierInvoiceTransformer } from './generators/supplier-invoice-transformer';
import { RegistrationData } from './types';

export class NormalizedInvoiceGeneratorFactory {
  /**
   * Create an appropriate invoice generator based on registration type
   */
  static create(registrationType: string): BaseInvoiceGenerator {
    const type = registrationType.toLowerCase();
    
    switch (type) {
      case 'individuals':
      case 'individual':
        return new NormalizedIndividualsInvoiceGenerator();
        
      case 'lodge':
      case 'organisation':
      case 'organization':
        return new NormalizedLodgeInvoiceGenerator();
        
      case 'supplier':
        return new SupplierInvoiceTransformer();
        
      case 'delegation':
        // Delegations are similar to lodge registrations
        return new NormalizedLodgeInvoiceGenerator();
        
      default:
        throw new Error(`Unknown registration type: ${registrationType}`);
    }
  }

  /**
   * Create an invoice generator from a registration object
   */
  static createFromRegistration(registration: RegistrationData): BaseInvoiceGenerator {
    // Determine registration type from various fields
    const registrationType = 
      registration.registrationType || 
      registration.type ||
      registration.registrationData?.type ||
      'individuals'; // Default to individuals
    
    return this.create(registrationType);
  }

  /**
   * Create a supplier invoice generator
   */
  static createSupplierGenerator(): SupplierInvoiceTransformer {
    return new SupplierInvoiceTransformer();
  }

  /**
   * Determine if a registration is for individuals
   */
  static isIndividualsRegistration(registration: RegistrationData): boolean {
    const type = (
      registration.registrationType || 
      registration.type ||
      registration.registrationData?.type ||
      ''
    ).toLowerCase();
    
    return type === 'individuals' || type === 'individual';
  }

  /**
   * Determine if a registration is for a lodge
   */
  static isLodgeRegistration(registration: RegistrationData): boolean {
    const type = (
      registration.registrationType || 
      registration.type ||
      registration.registrationData?.type ||
      ''
    ).toLowerCase();
    
    return type === 'lodge' || type === 'organisation' || type === 'organization';
  }

  /**
   * Get a human-readable registration type
   */
  static getRegistrationTypeDisplay(registration: RegistrationData): string {
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