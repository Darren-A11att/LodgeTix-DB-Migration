export interface ArrayItemConfig {
  descriptionTemplate: string; // e.g., "{title} {firstName} {lastName} - {attendeeType}"
  descriptionSegments?: Array<{
    id: string;
    type: 'field' | 'text';
    value: string;
  }>;
  quantity: { type: 'fixed' | 'field'; value: string | number };
  unitPrice: { type: 'fixed' | 'field'; value: string | number };
}

export interface ArrayChildMapping {
  path: string; // e.g., "registrationData.selectedTickets"
  relationshipKey: string; // e.g., "attendeeId" - field that matches parent
  parentKey: string; // e.g., "attendeeId" - field in parent to match against
  
  lookups?: Array<{
    localField: string; // e.g., "event_ticket_id"
    collection: string; // e.g., "event_tickets"
    foreignField: string; // e.g., "_id"
    includeFields: string[]; // e.g., ["name", "price"]
  }>;
  
  itemConfig: ArrayItemConfig & {
    unitPrice: { type: 'fixed' | 'field' | 'lookup'; value: string | number };
  };
}

export interface ArrayMapping {
  id: string;
  enabled: boolean;
  parentArray: {
    path: string; // e.g., "registrationData.attendees"
    itemConfig: ArrayItemConfig;
    keyField: string; // e.g., "attendeeId" - the ID field in parent
  };
  childArrays?: ArrayChildMapping[];
}

export interface FieldMapping {
  id: string;
  name: string;
  description?: string;
  invoiceType?: 'customer' | 'supplier'; // Type of invoice this mapping is for
  mappings: Record<string, {
    source: string | null;
    customValue?: any;
  }>;
  lineItems?: Record<string, {
    descriptionSegments?: Array<{
      id: string;
      type: 'field' | 'text';
      value: string;
    }>;
    quantityMapping?: { source: string | null; customValue?: any };
    priceMapping?: { source: string | null; customValue?: any };
    subItems?: Record<string, {
      descriptionSegments?: Array<{
        id: string;
        type: 'field' | 'text';
        value: string;
      }>;
      quantityMapping?: { source: string | null; customValue?: any };
      priceMapping?: { source: string | null; customValue?: any };
    }>;
  }>;
  items?: any[]; // Saved line items
  arrayMappings?: ArrayMapping[]; // New field for array-based line item mappings
  createdAt: Date;
  updatedAt: Date;
}

class FieldMappingStorageService {
  private readonly STORAGE_KEY = 'invoice_field_mappings';

  /**
   * Get all saved field mappings
   */
  getAllMappings(): FieldMapping[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const mappings = JSON.parse(stored);
      // Convert date strings back to Date objects
      return mappings.map((mapping: any) => ({
        ...mapping,
        createdAt: new Date(mapping.createdAt),
        updatedAt: new Date(mapping.updatedAt)
      }));
    } catch (error) {
      console.error('Error loading field mappings:', error);
      return [];
    }
  }

  /**
   * Get a specific field mapping by ID
   */
  getMapping(id: string): FieldMapping | null {
    const mappings = this.getAllMappings();
    return mappings.find(m => m.id === id) || null;
  }

  /**
   * Save a new field mapping
   */
  saveMapping(
    name: string, 
    mappings: Record<string, { source: string | null; customValue?: any }> & { items?: any[] }, 
    description?: string, 
    lineItems?: FieldMapping['lineItems'],
    invoiceType?: 'customer' | 'supplier',
    arrayMappings?: ArrayMapping[]
  ): FieldMapping {
    const allMappings = this.getAllMappings();
    
    // Extract items from mappings if present
    const { items, ...fieldMappings } = mappings;
    
    const newMapping: FieldMapping = {
      id: `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      invoiceType,
      mappings: fieldMappings,
      lineItems,
      items, // Save the actual line items
      arrayMappings,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    allMappings.push(newMapping);
    this.saveMappings(allMappings);
    
    return newMapping;
  }

  /**
   * Update an existing field mapping
   */
  updateMapping(id: string, updates: Partial<Omit<FieldMapping, 'id' | 'createdAt'>>): FieldMapping | null {
    const allMappings = this.getAllMappings();
    const index = allMappings.findIndex(m => m.id === id);
    
    if (index === -1) return null;
    
    allMappings[index] = {
      ...allMappings[index],
      ...updates,
      updatedAt: new Date()
    };
    
    this.saveMappings(allMappings);
    return allMappings[index];
  }

  /**
   * Delete a field mapping
   */
  deleteMapping(id: string): boolean {
    const allMappings = this.getAllMappings();
    const filtered = allMappings.filter(m => m.id !== id);
    
    if (filtered.length === allMappings.length) return false;
    
    this.saveMappings(filtered);
    return true;
  }

  /**
   * Apply a saved mapping to current invoice data
   */
  applyMapping(mappingId: string, paymentData: any, registrationData: any, relatedDocuments?: any): Record<string, any> {
    const mapping = this.getMapping(mappingId);
    if (!mapping) return {};
    
    const result: Record<string, any> = {};
    
    Object.entries(mapping.mappings).forEach(([fieldPath, mappingConfig]) => {
      if (mappingConfig.customValue !== undefined) {
        // Use custom value
        this.setNestedValue(result, fieldPath, mappingConfig.customValue);
      } else if (mappingConfig.source) {
        // Extract value from source based on prefix
        let value;
        if (mappingConfig.source.startsWith('payment.')) {
          value = this.getNestedValue(paymentData, mappingConfig.source.replace('payment.', ''));
        } else if (mappingConfig.source.startsWith('registration.')) {
          value = this.getNestedValue(registrationData, mappingConfig.source.replace('registration.', ''));
        } else if (mappingConfig.source.startsWith('related.') && relatedDocuments) {
          value = this.getNestedValue(relatedDocuments, mappingConfig.source.replace('related.', ''));
        }
        
        if (value !== undefined) {
          this.setNestedValue(result, fieldPath, value);
        }
      }
    });
    
    // Include line item mappings if present
    if (mapping.lineItems) {
      result.lineItems = mapping.lineItems;
    }
    
    // Include line items if present in the mapping
    if (mapping.items) {
      result.items = mapping.items;
    }
    
    // Include array mappings if present
    if (mapping.arrayMappings) {
      result.arrayMappings = mapping.arrayMappings;
    }
    
    return result;
  }

  /**
   * Create default field mappings
   */
  createDefaultMappings(): void {
    const existingMappings = this.getAllMappings();
    
    // Only create defaults if none exist
    if (existingMappings.length === 0) {
      // Default mapping (current standard)
      this.saveMapping(
        'Default Mapping',
        {
          'billTo.businessName': { source: 'registration.businessName' },
          'billTo.businessNumber': { source: 'registration.businessNumber' },
          'billTo.firstName': { source: 'registration.primaryAttendee.firstName' },
          'billTo.lastName': { source: 'registration.primaryAttendee.lastName' },
          'billTo.email': { source: 'payment.customerEmail' },
          'billTo.addressLine1': { source: 'registration.addressLine1' },
          'billTo.city': { source: 'registration.city' },
          'billTo.postalCode': { source: 'registration.postalCode' },
          'billTo.stateProvince': { source: 'registration.stateProvince' },
          'billTo.country': { source: 'registration.country' }
        },
        'Default mapping using registration and payment data',
        undefined,
        'customer'
      );

      // Stripe + Individuals Registration
      this.saveMapping(
        'Stripe + Individuals Registration',
        {
          'billTo.businessName': { source: null, customValue: '' },
          'billTo.businessNumber': { source: null, customValue: '' },
          'billTo.firstName': { source: 'registration.firstName' },
          'billTo.lastName': { source: 'registration.lastName' },
          'billTo.email': { source: 'payment.email' },
          'billTo.addressLine1': { source: 'registration.address.line1' },
          'billTo.city': { source: 'registration.address.city' },
          'billTo.postalCode': { source: 'registration.address.postal_code' },
          'billTo.stateProvince': { source: 'registration.address.state' },
          'billTo.country': { source: 'registration.address.country' }
        },
        'Mapping for Stripe payments with individual registrations',
        undefined,
        'customer'
      );

      // Stripe + Lodge Registration
      this.saveMapping(
        'Stripe + Lodge Registration',
        {
          'billTo.businessName': { source: 'registration.lodgeName' },
          'billTo.businessNumber': { source: 'registration.lodgeNumber' },
          'billTo.firstName': { source: 'registration.contactFirstName' },
          'billTo.lastName': { source: 'registration.contactLastName' },
          'billTo.email': { source: 'payment.email' },
          'billTo.addressLine1': { source: 'registration.lodgeAddress.line1' },
          'billTo.city': { source: 'registration.lodgeAddress.city' },
          'billTo.postalCode': { source: 'registration.lodgeAddress.postal_code' },
          'billTo.stateProvince': { source: 'registration.lodgeAddress.state' },
          'billTo.country': { source: 'registration.lodgeAddress.country' }
        },
        'Mapping for Stripe payments with lodge registrations'
      );

      // Square + Individuals Registration
      this.saveMapping(
        'Square + Individuals Registration',
        {
          'billTo.businessName': { source: null, customValue: '' },
          'billTo.businessNumber': { source: null, customValue: '' },
          'billTo.firstName': { source: 'registration.given_name' },
          'billTo.lastName': { source: 'registration.family_name' },
          'billTo.email': { source: 'payment.buyer_email_address' },
          'billTo.addressLine1': { source: 'registration.address_line_1' },
          'billTo.city': { source: 'registration.locality' },
          'billTo.postalCode': { source: 'registration.postal_code' },
          'billTo.stateProvince': { source: 'registration.administrative_district_level_1' },
          'billTo.country': { source: 'registration.country' }
        },
        'Mapping for Square payments with individual registrations'
      );

      // Square + Lodge Registration
      this.saveMapping(
        'Square + Lodge Registration',
        {
          'billTo.businessName': { source: 'registration.organization_name' },
          'billTo.businessNumber': { source: 'registration.organization_id' },
          'billTo.firstName': { source: 'registration.contact_given_name' },
          'billTo.lastName': { source: 'registration.contact_family_name' },
          'billTo.email': { source: 'payment.buyer_email_address' },
          'billTo.addressLine1': { source: 'registration.organization_address_line_1' },
          'billTo.city': { source: 'registration.organization_locality' },
          'billTo.postalCode': { source: 'registration.organization_postal_code' },
          'billTo.stateProvince': { source: 'registration.organization_administrative_district_level_1' },
          'billTo.country': { source: 'registration.organization_country' }
        },
        'Mapping for Square payments with lodge registrations',
        undefined,
        'customer'
      );
      
      // Default Supplier Invoice Mapping
      this.saveMapping(
        'Default Supplier Mapping',
        {
          'billTo.businessName': { source: null, customValue: 'Grand Lodge' },
          'billTo.businessNumber': { source: null, customValue: 'ABN 123456789' },
          'billTo.firstName': { source: null, customValue: 'Accounts' },
          'billTo.lastName': { source: null, customValue: 'Payable' },
          'billTo.email': { source: null, customValue: 'accounts@grandlodge.com' },
          'billTo.addressLine1': { source: null, customValue: '123 Lodge Street' },
          'billTo.city': { source: null, customValue: 'Sydney' },
          'billTo.postalCode': { source: null, customValue: '2000' },
          'billTo.stateProvince': { source: null, customValue: 'NSW' },
          'billTo.country': { source: null, customValue: 'Australia' },
          'processingFees': { source: 'payment.fees' }
        },
        'Default mapping for supplier invoices',
        undefined,
        'supplier'
      );
    }
  }

  /**
   * Private helper methods
   */
  private saveMappings(mappings: FieldMapping[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(mappings));
    } catch (error) {
      console.error('Error saving field mappings:', error);
    }
  }

  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    
    const parts = path.split(/\.|\[|\]/).filter(Boolean);
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      const index = Number(part);
      if (!isNaN(index)) {
        current = current[index];
      } else {
        current = current[part];
      }
    }
    
    return current;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    const lastPart = parts.pop()!;
    
    let current = obj;
    for (const part of parts) {
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[lastPart] = value;
  }
}

// Export singleton instance
export const fieldMappingStorage = new FieldMappingStorageService();