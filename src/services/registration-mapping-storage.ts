export interface RegistrationFieldMapping {
  id: string;
  name: string;
  description?: string;
  registrationType?: string; // individuals, lodge, delegation
  mappings: Record<string, {
    source: string | null;
    customValue?: any;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

class RegistrationMappingStorageService {
  private readonly STORAGE_KEY = 'registration_field_mappings';

  /**
   * Get all saved registration field mappings
   */
  getAllMappings(): RegistrationFieldMapping[] {
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
      console.error('Error loading registration field mappings:', error);
      return [];
    }
  }

  /**
   * Get a specific field mapping by ID
   */
  getMapping(id: string): RegistrationFieldMapping | null {
    const mappings = this.getAllMappings();
    return mappings.find(m => m.id === id) || null;
  }

  /**
   * Save a new field mapping
   */
  saveMapping(
    name: string, 
    mappings: Record<string, { source: string | null; customValue?: any }>,
    description?: string,
    registrationType?: string
  ): RegistrationFieldMapping {
    const allMappings = this.getAllMappings();
    
    const newMapping: RegistrationFieldMapping = {
      id: `reg_mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      registrationType,
      mappings,
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
  updateMapping(id: string, updates: Partial<Omit<RegistrationFieldMapping, 'id' | 'createdAt'>>): RegistrationFieldMapping | null {
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
   * Apply a saved mapping to registration data
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
        // Extract value from source
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
    
    return result;
  }

  /**
   * Get fields that have null values and mapped values
   */
  getMappedNullFields(registrationData: any, mappingId: string, paymentData: any, relatedDocuments?: any): Array<{
    field: string;
    mappedValue: any;
  }> {
    const mapping = this.getMapping(mappingId);
    if (!mapping) return [];
    
    const nullFields: Array<{ field: string; mappedValue: any }> = [];
    
    Object.entries(mapping.mappings).forEach(([fieldPath, mappingConfig]) => {
      const currentValue = this.getNestedValue(registrationData, fieldPath);
      
      if (currentValue === null || currentValue === undefined || currentValue === '') {
        let mappedValue;
        
        if (mappingConfig.customValue !== undefined) {
          mappedValue = mappingConfig.customValue;
        } else if (mappingConfig.source) {
          if (mappingConfig.source.startsWith('payment.')) {
            mappedValue = this.getNestedValue(paymentData, mappingConfig.source.replace('payment.', ''));
          } else if (mappingConfig.source.startsWith('registration.')) {
            mappedValue = this.getNestedValue(registrationData, mappingConfig.source.replace('registration.', ''));
          } else if (mappingConfig.source.startsWith('related.') && relatedDocuments) {
            mappedValue = this.getNestedValue(relatedDocuments, mappingConfig.source.replace('related.', ''));
          }
        }
        
        if (mappedValue !== undefined && mappedValue !== null) {
          nullFields.push({ field: fieldPath, mappedValue });
        }
      }
    });
    
    return nullFields;
  }

  /**
   * Private helper methods
   */
  private saveMappings(mappings: RegistrationFieldMapping[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(mappings));
    } catch (error) {
      console.error('Error saving registration field mappings:', error);
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
export const registrationMappingStorage = new RegistrationMappingStorageService();