import React, { useState, useEffect } from 'react';
import { InvoiceItem } from '../types/invoice';
import CompoundDescriptionBuilder, { DescriptionSegment } from './CompoundDescriptionBuilder';
import FieldMappingSelector from './FieldMappingSelector';
import ArrayRelationshipBuilder from './ArrayRelationshipBuilder';
import { FieldOption, getValueByPath } from '@/utils/field-extractor';
import { ArrayMapping } from '@/services/field-mapping-storage';
import apiService from '@/lib/api';

interface LineItem extends InvoiceItem {
  id: string;
  type: 'registration' | 'attendee' | 'other' | 'array';
  descriptionSegments?: DescriptionSegment[];
  quantityMapping?: { source: string | null; customValue?: any };
  priceMapping?: { source: string | null; customValue?: any };
  subItems?: SubLineItem[];
  arrayMappingId?: string;
}

interface SubLineItem {
  id: string;
  description: string;
  descriptionSegments?: DescriptionSegment[];
  quantity: number;
  quantityMapping?: { source: string | null; customValue?: any };
  price: number;
  priceMapping?: { source: string | null; customValue?: any };
}

interface LineItemManagerProps {
  items: InvoiceItem[];
  onItemsChange: (items: InvoiceItem[]) => void;
  registrationData?: any;
  paymentData?: any;
  allOptions: FieldOption[];
  lineItemMappings?: Record<string, any>;
  onLineItemMappingsChange?: (mappings: Record<string, any>) => void;
  relatedDocuments?: any;
  loadingRelatedDocs?: boolean;
  arrayMappings?: ArrayMapping[];
  onArrayMappingsChange?: (mappings: ArrayMapping[]) => void;
}

// Helper function to convert value to number
const toNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove currency symbols and commas
    const cleanValue = value.replace(/[$,]/g, '').trim();
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (value && typeof value === 'object' && '$numberDecimal' in value) {
    return parseFloat(value.$numberDecimal) || 0;
  }
  return 0;
};

export default function LineItemManager({ 
  items, 
  onItemsChange, 
  registrationData, 
  paymentData,
  allOptions,
  lineItemMappings,
  onLineItemMappingsChange,
  relatedDocuments,
  loadingRelatedDocs,
  arrayMappings = [],
  onArrayMappingsChange
}: LineItemManagerProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    // Convert existing items to LineItems
    return items.map((item, index) => ({
      ...item,
      id: `item_${index}`,
      type: 'other' as const,
      descriptionSegments: [],
      subItems: []
    }));
  });
  
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showArrayBuilder, setShowArrayBuilder] = useState(false);
  const [editingArrayMapping, setEditingArrayMapping] = useState<ArrayMapping | null>(null);
  const [savedArrayMappings, setSavedArrayMappings] = useState<ArrayMapping[]>(arrayMappings);

  // Sync array mappings from parent when they change
  useEffect(() => {
    setSavedArrayMappings(arrayMappings);
  }, [arrayMappings]);

  // Sync items from parent when they change significantly (e.g., template load)
  useEffect(() => {
    // Check if items have descriptionSegments (indicates they're from a saved template)
    const hasTemplateStructure = items.some(item => 
      item.descriptionSegments && item.descriptionSegments.length > 0
    );
    
    if (hasTemplateStructure && items.length > 0) {
      // These are regenerated items from a template, sync them
      setLineItems(items.map((item, index) => ({
        ...item,
        id: item.id || `item_${index}`,
        type: item.type || 'other',
        descriptionSegments: item.descriptionSegments || [],
        subItems: item.subItems || []
      })));
    }
  }, [items]);

  // Process array mappings when data changes
  useEffect(() => {
    // Only process if we have data and mappings
    if (!registrationData && !paymentData) return;
    if (savedArrayMappings.length === 0) return;
    
    // Clear existing array-generated items first
    setLineItems(prevItems => prevItems.filter(item => item.type !== 'array'));
    
    // Process all enabled array mappings
    const processAllMappings = async () => {
      for (const mapping of savedArrayMappings) {
        if (mapping.enabled) {
          await processArrayMapping(mapping);
        }
      }
    };
    
    processAllMappings();
  }, [registrationData, paymentData, savedArrayMappings.length]); // Include length to trigger on changes

  // Update parent when line items change
  useEffect(() => {
    updateParentItems(lineItems);
  }, [lineItems]);

  const addLineItem = (type: LineItem['type']) => {
    if (type === 'array') {
      setShowArrayBuilder(true);
      setShowAddMenu(false);
      return;
    }
    
    const newItem: LineItem = {
      id: `item_${Date.now()}`,
      type,
      description: type === 'registration' ? 'Registration Fee' : 
                   type === 'attendee' ? 'Attendee Registration' : 
                   'Additional Item',
      descriptionSegments: [],
      quantity: 1,
      price: 0,
      subItems: []
    };
    
    const updatedItems = [...lineItems, newItem];
    setLineItems(updatedItems);
    updateParentItems(updatedItems);
    setShowAddMenu(false);
  };

  const addSubItem = (parentId: string) => {
    const updatedItems = lineItems.map(item => {
      if (item.id === parentId) {
        const newSubItem: SubLineItem = {
          id: `sub_${Date.now()}`,
          description: 'Sub-item',
          descriptionSegments: [],
          quantity: 1,
          price: 0
        };
        return {
          ...item,
          subItems: [...(item.subItems || []), newSubItem]
        };
      }
      return item;
    });
    
    setLineItems(updatedItems);
    updateParentItems(updatedItems);
  };

  const updateItem = (itemId: string, field: keyof LineItem, value: any) => {
    const updatedItems = lineItems.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    );
    setLineItems(updatedItems);
    updateParentItems(updatedItems);
  };

  const updateSubItem = (parentId: string, subItemId: string, field: keyof SubLineItem, value: any) => {
    const updatedItems = lineItems.map(item => {
      if (item.id === parentId) {
        return {
          ...item,
          subItems: item.subItems?.map(sub => 
            sub.id === subItemId ? { ...sub, [field]: value } : sub
          )
        };
      }
      return item;
    });
    
    setLineItems(updatedItems);
    updateParentItems(updatedItems);
  };

  const deleteItem = (itemId: string) => {
    const updatedItems = lineItems.filter(item => item.id !== itemId);
    setLineItems(updatedItems);
    updateParentItems(updatedItems);
  };

  const deleteSubItem = (parentId: string, subItemId: string) => {
    const updatedItems = lineItems.map(item => {
      if (item.id === parentId) {
        return {
          ...item,
          subItems: item.subItems?.filter(sub => sub.id !== subItemId)
        };
      }
      return item;
    });
    
    setLineItems(updatedItems);
    updateParentItems(updatedItems);
  };

  const updateParentItems = (items: LineItem[]) => {
    // Convert back to InvoiceItem format for parent component
    const invoiceItems: InvoiceItem[] = [];
    
    items.forEach(item => {
      // Resolve description from segments if available
      let description = item.description;
      if (item.descriptionSegments && item.descriptionSegments.length > 0) {
        description = resolveDescription(item.descriptionSegments);
      }
      
      // Resolve quantity and price from mappings if available
      let quantity = item.quantity;
      if (item.quantityMapping?.source) {
        const sourceData = item.quantityMapping.source.includes('payment') ? paymentData : registrationData;
        // Remove the source prefix (payment. or registration.) from the path
        const cleanPath = item.quantityMapping.source.replace(/^(payment|registration)\./, '');
        const value = getValueByPath(sourceData, cleanPath);
        quantity = value !== undefined ? toNumber(value) : item.quantity;
      } else if (item.quantityMapping?.customValue !== undefined) {
        quantity = toNumber(item.quantityMapping.customValue);
      }
        
      let price = item.price;
      if (item.priceMapping?.source) {
        const sourceData = item.priceMapping.source.includes('payment') ? paymentData : registrationData;
        // Remove the source prefix (payment. or registration.) from the path
        const cleanPath = item.priceMapping.source.replace(/^(payment|registration)\./, '');
        const value = getValueByPath(sourceData, cleanPath);
        price = value !== undefined ? toNumber(value) : item.price;
      } else if (item.priceMapping?.customValue !== undefined) {
        price = toNumber(item.priceMapping.customValue);
      }
      
      // Add main item
      invoiceItems.push({
        description,
        quantity: quantity,
        price: price
      });
      
      // Add sub-items as separate invoice items
      if (item.subItems && item.subItems.length > 0) {
        item.subItems.forEach(subItem => {
          let subDescription = subItem.description;
          if (subItem.descriptionSegments && subItem.descriptionSegments.length > 0) {
            subDescription = resolveDescription(subItem.descriptionSegments);
          }
          
          let subQuantity = subItem.quantity;
          if (subItem.quantityMapping?.source) {
            const sourceData = subItem.quantityMapping.source.includes('payment') ? paymentData : registrationData;
            // Remove the source prefix (payment. or registration.) from the path
            const cleanPath = subItem.quantityMapping.source.replace(/^(payment|registration)\./, '');
            const value = getValueByPath(sourceData, cleanPath);
            subQuantity = value !== undefined ? toNumber(value) : subItem.quantity;
          } else if (subItem.quantityMapping?.customValue !== undefined) {
            subQuantity = toNumber(subItem.quantityMapping.customValue);
          }
            
          let subPrice = subItem.price;
          if (subItem.priceMapping?.source) {
            const sourceData = subItem.priceMapping.source.includes('payment') ? paymentData : registrationData;
            // Remove the source prefix (payment. or registration.) from the path
            const cleanPath = subItem.priceMapping.source.replace(/^(payment|registration)\./, '');
            const value = getValueByPath(sourceData, cleanPath);
            subPrice = value !== undefined ? toNumber(value) : subItem.price;
          } else if (subItem.priceMapping?.customValue !== undefined) {
            subPrice = toNumber(subItem.priceMapping.customValue);
          }
          
          invoiceItems.push({
            description: `  - ${subDescription}`, // Indent sub-items
            quantity: subQuantity,
            price: subPrice
          });
        });
      }
    });
    
    onItemsChange(invoiceItems);
    
    // Update mappings if handler provided
    if (onLineItemMappingsChange) {
      const mappings: Record<string, any> = {};
      items.forEach(item => {
        mappings[item.id] = {
          descriptionSegments: item.descriptionSegments,
          quantityMapping: item.quantityMapping,
          priceMapping: item.priceMapping,
          subItems: item.subItems ? Object.fromEntries(
            item.subItems.map(sub => [sub.id, {
              descriptionSegments: sub.descriptionSegments,
              quantityMapping: sub.quantityMapping,
              priceMapping: sub.priceMapping
            }])
          ) : {}
        };
      });
      onLineItemMappingsChange(mappings);
    }
  };
  
  // Helper function to get resolved price from mapping
  const getResolvedPrice = (item: LineItem): number => {
    if (item.priceMapping?.source) {
      const sourceData = item.priceMapping.source.includes('payment') ? paymentData : registrationData;
      // Remove the source prefix (payment. or registration.) from the path
      const cleanPath = item.priceMapping.source.replace(/^(payment|registration)\./, '');
      const value = getValueByPath(sourceData, cleanPath);
      return value !== undefined ? toNumber(value) : item.price;
    } else if (item.priceMapping?.customValue !== undefined) {
      // Handle computation objects
      if (typeof item.priceMapping.customValue === 'object' && item.priceMapping.customValue?.$compute) {
        // Return the default price for now - computation will be handled during migration
        return item.price;
      }
      return toNumber(item.priceMapping.customValue);
    }
    return item.price;
  };
  
  // Helper function to get resolved quantity from mapping
  const getResolvedQuantity = (item: LineItem): number => {
    if (item.quantityMapping?.source) {
      const sourceData = item.quantityMapping.source.includes('payment') ? paymentData : registrationData;
      // Remove the source prefix (payment. or registration.) from the path
      const cleanPath = item.quantityMapping.source.replace(/^(payment|registration)\./, '');
      const value = getValueByPath(sourceData, cleanPath);
      return value !== undefined ? toNumber(value) : item.quantity;
    } else if (item.quantityMapping?.customValue !== undefined) {
      // Handle computation objects
      if (typeof item.quantityMapping.customValue === 'object' && item.quantityMapping.customValue?.$compute) {
        // Return the default quantity for now - computation will be handled during migration
        return item.quantity;
      }
      return toNumber(item.quantityMapping.customValue);
    }
    return item.quantity;
  };
  
  // Helper function to get resolved sub-item price
  const getResolvedSubPrice = (subItem: SubLineItem): number => {
    if (subItem.priceMapping?.source) {
      const sourceData = subItem.priceMapping.source.includes('payment') ? paymentData : registrationData;
      // Remove the source prefix (payment. or registration.) from the path
      const cleanPath = subItem.priceMapping.source.replace(/^(payment|registration)\./, '');
      const value = getValueByPath(sourceData, cleanPath);
      return value !== undefined ? toNumber(value) : subItem.price;
    } else if (subItem.priceMapping?.customValue !== undefined) {
      // Handle computation objects
      if (typeof subItem.priceMapping.customValue === 'object' && subItem.priceMapping.customValue?.$compute) {
        // Return the default price for now - computation will be handled during migration
        return subItem.price;
      }
      return toNumber(subItem.priceMapping.customValue);
    }
    return subItem.price;
  };
  
  // Helper function to get resolved sub-item quantity
  const getResolvedSubQuantity = (subItem: SubLineItem): number => {
    if (subItem.quantityMapping?.source) {
      const sourceData = subItem.quantityMapping.source.includes('payment') ? paymentData : registrationData;
      // Remove the source prefix (payment. or registration.) from the path
      const cleanPath = subItem.quantityMapping.source.replace(/^(payment|registration)\./, '');
      const value = getValueByPath(sourceData, cleanPath);
      return value !== undefined ? toNumber(value) : subItem.quantity;
    } else if (subItem.quantityMapping?.customValue !== undefined) {
      // Handle computation objects
      if (typeof subItem.quantityMapping.customValue === 'object' && subItem.quantityMapping.customValue?.$compute) {
        // Return the default quantity for now - computation will be handled during migration
        return subItem.quantity;
      }
      return toNumber(subItem.quantityMapping.customValue);
    }
    return subItem.quantity;
  };
  
  // Handler for saving array mapping
  const handleArrayMappingSave = (mapping: ArrayMapping) => {
    const updatedMappings = [...savedArrayMappings, mapping];
    setSavedArrayMappings(updatedMappings);
    
    if (onArrayMappingsChange) {
      onArrayMappingsChange(updatedMappings);
    }
    
    // Generate line items from the array mapping immediately
    processArrayMapping(mapping);
    
    setShowArrayBuilder(false);
    setEditingArrayMapping(null);
  };

  // Process array mapping to generate line items
  const processArrayMapping = async (mapping: ArrayMapping) => {
    if (!mapping.enabled) return;
    
    
    // Support both singular and plural forms
    const allData = { 
      registration: registrationData, 
      registrations: registrationData,
      payment: paymentData,
      payments: paymentData 
    };
    const parentArray = getValueByPath(allData, mapping.parentArray.path);
    
    
    if (!Array.isArray(parentArray)) {
      return;
    }
    
    const generatedItems: LineItem[] = [];
    const lookupCache = new Map<string, any>(); // Cache for lookup results
    
    for (const parentItem of parentArray) {
      // Process template for parent item
      const parentDescription = processTemplate(
        mapping.parentArray.itemConfig.descriptionTemplate,
        parentItem
      );
      
      // Get quantity and price for parent
      let parentQuantity: number;
      if (mapping.parentArray.itemConfig.quantity.type === 'blank') {
        parentQuantity = 0; // Will not display in invoice when both are 0
      } else if (mapping.parentArray.itemConfig.quantity.type === 'fixed') {
        parentQuantity = toNumber(mapping.parentArray.itemConfig.quantity.value);
      } else {
        parentQuantity = toNumber(parentItem[mapping.parentArray.itemConfig.quantity.value as string] || 0);
      }
        
      let parentPrice: number;
      if (mapping.parentArray.itemConfig.unitPrice.type === 'blank') {
        parentPrice = 0; // Will not display in invoice when both are 0
      } else if (mapping.parentArray.itemConfig.unitPrice.type === 'fixed') {
        parentPrice = toNumber(mapping.parentArray.itemConfig.unitPrice.value);
      } else {
        parentPrice = toNumber(parentItem[mapping.parentArray.itemConfig.unitPrice.value as string] || 0);
      }
      
      const parentLineItem: LineItem = {
        id: `array_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'array',
        description: parentDescription,
        quantity: parentQuantity,
        price: parentPrice,
        subItems: [],
        arrayMappingId: mapping.id
      };
      
      // Process child arrays
      if (mapping.childArrays) {
        for (const childConfig of mapping.childArrays) {
          let relatedChildren = [];
          
          // Check if this is a nested array
          if (childConfig.isNested) {
            // This is a nested array within the parent item
            const nestedPath = childConfig.path.includes('[]') 
              ? childConfig.path.split('[]')[1].replace(/^\./, '')
              : childConfig.path.split('.').pop() || '';
            const nestedArray = parentItem[nestedPath];
            if (Array.isArray(nestedArray)) {
              relatedChildren = nestedArray; // All items in nested array belong to this parent
            }
          } else {
            // This is a related array - filter by relationship key
            const childArray = getValueByPath(allData, childConfig.path);
            
            if (!Array.isArray(childArray)) {
              continue;
            }
            
            const parentKeyValue = parentItem[mapping.parentArray.keyField];
            
            relatedChildren = childArray.filter(
              child => child[childConfig.relationshipKey] === parentKeyValue
            );
          }
          
          for (const childItem of relatedChildren) {
            let enrichedChild = { ...childItem };
            
            // Perform lookups if configured
            if (childConfig.lookups) {
              for (const lookup of childConfig.lookups) {
                try {
                  const lookupValue = childItem[lookup.localField];
                  
                  if (lookupValue) {
                    const cacheKey = `${lookup.collection}:${lookupValue}`;
                    
                    // Check cache first
                    let lookupData = lookupCache.get(cacheKey);
                    
                    if (!lookupData) {
                      // Always use collections API for lookups
                      try {
                        const docsResponse = await fetch(`/api/collections/${lookup.collection}/documents?limit=100`);
                        if (docsResponse.ok) {
                          const { documents } = await docsResponse.json();
                          // Find matching document
                          lookupData = documents.find((doc: any) => {
                            const fieldValue = doc[lookup.foreignField];
                            // Handle comma-separated values
                            if (typeof fieldValue === 'string' && fieldValue.includes(',')) {
                              const values = fieldValue.split(',').map(v => v.trim());
                              return values.includes(lookupValue);
                            }
                            return fieldValue === lookupValue;
                          });
                          if (lookupData) {
                            lookupCache.set(cacheKey, lookupData);
                            console.log(`Found ${lookup.collection} document:`, lookupData);
                          } else {
                            console.log(`No ${lookup.collection} document found matching ${lookup.foreignField}=${lookupValue}`);
                          }
                        }
                      } catch (error) {
                        console.error('Lookup error:', error);
                      }
                    }
                    
                    if (lookupData) {
                      console.log('Adding lookup data:', lookupData);
                      // Add all fields from the lookup document with collection prefix
                      Object.entries(lookupData).forEach(([field, value]) => {
                        // Skip internal MongoDB fields
                        if (!field.startsWith('_')) {
                          const key = `${lookup.collection}.${field}`;
                          enrichedChild[key] = value;
                          console.log(`Added ${key} = ${value}`);
                        }
                      });
                    } else {
                      console.log('No lookup data found');
                    }
                  }
                } catch (error) {
                  console.error('Lookup failed:', error);
                }
              }
            }
            
            // Process child description
            console.log('Processing child template:', childConfig.itemConfig.descriptionTemplate);
            console.log('Enriched child data:', enrichedChild);
            const childDescription = processTemplate(
              childConfig.itemConfig.descriptionTemplate,
              enrichedChild
            );
            
            // Get quantity and price for child
            let childQuantity = 0;
            if (childConfig.itemConfig.quantity.type === 'blank') {
              childQuantity = 0; // Will not display in invoice when both are 0
            } else if (childConfig.itemConfig.quantity.type === 'fixed') {
              childQuantity = toNumber(childConfig.itemConfig.quantity.value);
            } else {
              childQuantity = toNumber(enrichedChild[childConfig.itemConfig.quantity.value as string] || 0);
            }
              
            let childPrice = 0;
            if (childConfig.itemConfig.unitPrice.type === 'blank') {
              childPrice = 0; // Will not display in invoice when both are 0
            } else if (childConfig.itemConfig.unitPrice.type === 'fixed') {
              childPrice = toNumber(childConfig.itemConfig.unitPrice.value);
            } else if (childConfig.itemConfig.unitPrice.type === 'field') {
              childPrice = toNumber(enrichedChild[childConfig.itemConfig.unitPrice.value as string] || 0);
            } else if (childConfig.itemConfig.unitPrice.type === 'lookup') {
              // For lookup type, use the lookupField if specified
              const lookupField = childConfig.itemConfig.unitPrice.lookupField || childConfig.itemConfig.unitPrice.value as string;
              childPrice = toNumber(enrichedChild[lookupField] || 0);
            }
            
            parentLineItem.subItems?.push({
              id: `sub_array_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              description: childDescription.startsWith('-') ? `  ${childDescription}` : `  - ${childDescription}`, // Avoid double dash
              quantity: childQuantity,
              price: childPrice
            });
          }
        }
      }
      
      generatedItems.push(parentLineItem);
    }
    
    console.log(`Generated ${generatedItems.length} line items from array mapping`);
    generatedItems.forEach(item => {
      console.log(`- ${item.description} (${item.subItems?.length || 0} sub-items)`);
    });
    
    // Add generated items to line items
    // First remove any existing items from this mapping to avoid duplicates
    setLineItems(prevItems => {
      const filteredItems = prevItems.filter(item => item.arrayMappingId !== mapping.id);
      const updatedItems = [...filteredItems, ...generatedItems];
      return updatedItems;
    });
  };

  // Process template string with data
  const processTemplate = (template: string, data: any): string => {
    if (!template || !data) return template;
    
    return template.replace(/\{([^}]+)\}/g, (match, fieldPath) => {
      // First, try to get the value using the full path as a key
      // This handles lookup fields that are stored as 'collection.field'
      if (data[fieldPath] !== undefined) {
        return data[fieldPath]?.toString() || '';
      }
      
      // If not found, try to traverse the path parts
      const parts = fieldPath.split('.');
      let value = data;
      
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          // If traversal fails, check if the full path exists as a key
          // This handles cases where lookup data is stored with dot notation
          const remainingPath = parts.slice(parts.indexOf(part)).join('.');
          if (data[remainingPath] !== undefined) {
            return data[remainingPath]?.toString() || '';
          }
          return '-'; // Return dash if field not found (better than empty string)
        }
      }
      
      return value?.toString() || '-';
    });
  };

  const resolveDescription = (segments: DescriptionSegment[]): string => {
    return segments.map((segment, index) => {
      let value = '';
      
      if (segment.type === 'text') {
        value = segment.value;
      } else {
        // Handle external fields
        if (segment.value.startsWith('external.')) {
          // For now, show the field path as placeholder
          // In production, you'd need to fetch the actual data
          value = `[${segment.value}]`;
        }
        // Handle related fields
        else if (segment.value.startsWith('related.')) {
          if (relatedDocuments?.relatedDocuments) {
            const cleanPath = segment.value.replace(/^related\./, '');
            const resolvedValue = getValueByPath(relatedDocuments.relatedDocuments, cleanPath);
            value = resolvedValue !== undefined && resolvedValue !== null ? String(resolvedValue) : '';
          } else {
            value = '';
          }
        }
        // Handle fields with source prefix (payment., registration.)
        else {
          const cleanPath = segment.value.replace(/^(payment|registration)\./, '');
          const sourceData = segment.value.startsWith('payment') ? paymentData : 
                            segment.value.startsWith('registration') ? registrationData : null;
          if (sourceData) {
            const resolvedValue = getValueByPath(sourceData, cleanPath);
            value = resolvedValue !== undefined && resolvedValue !== null ? String(resolvedValue) : '';
          } else {
            // Fallback for fields without prefix
            const source = segment.value.includes('payment') ? paymentData : registrationData;
            const resolvedValue = getValueByPath(source, segment.value);
            value = resolvedValue !== undefined && resolvedValue !== null ? String(resolvedValue) : '';
          }
        }
      }
      
      // Add automatic spacing between segments
      if (index > 0 && value && segments[index - 1]) {
        const prevSegment = segments[index - 1];
        const prevIsText = prevSegment.type === 'text';
        const prevValue = prevIsText ? prevSegment.value : '';
        
        // Don't add space if previous segment ends with space or current starts with space
        if (prevIsText && prevValue.endsWith(' ')) {
          return value;
        }
        if (segment.type === 'text' && segment.value.startsWith(' ')) {
          return value;
        }
        
        // Add space between segments
        return ' ' + value;
      }
      
      return value;
    }).join('');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-gray-700">Line Items</h4>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Line Item
          </button>
          
          {showAddMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border rounded-md shadow-lg z-10">
              <button
                onClick={() => addLineItem('registration')}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
              >
                Registration
              </button>
              <button
                onClick={() => addLineItem('attendee')}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
              >
                Attendee
              </button>
              <button
                onClick={() => addLineItem('array')}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center justify-between"
              >
                <span>From Array</span>
                <span className="text-xs text-gray-500">→</span>
              </button>
              <button
                onClick={() => addLineItem('other')}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
              >
                Other
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {lineItems.map((item, index) => (
          <div key={item.id} className="space-y-3">
            {/* Main Line Item */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  {item.type === 'array' ? (
                    <span className="flex items-center gap-2">
                      <span className="text-purple-600">Array:</span>
                      {item.description}
                    </span>
                  ) : (
                    `Line Item ${index + 1}`
                  )}
                </label>
                {item.type !== 'array' && (
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
              
              {item.type === 'array' ? (
                <div className="bg-purple-50 p-3 rounded-md">
                  <p className="text-sm text-gray-600">Generated from array mapping</p>
                  <p className="text-xs text-gray-500 mt-1">Template-based description</p>
                </div>
              ) : (
                <CompoundDescriptionBuilder
                  fieldName="Description"
                  segments={item.descriptionSegments || []}
                  onSegmentsChange={(segments) => updateItem(item.id, 'descriptionSegments', segments)}
                  allOptions={allOptions}
                  paymentData={paymentData}
                  registrationData={registrationData}
                  relatedDocuments={relatedDocuments}
                  loadingRelatedDocs={loadingRelatedDocs}
                />
              )}
              
              <div className="grid grid-cols-2 gap-3">
                {item.type === 'array' ? (
                  <>
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-xs text-gray-500">Quantity</span>
                      <p className="text-sm font-medium">{item.quantity}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-xs text-gray-500">Price</span>
                      <p className="text-sm font-medium">${item.price.toFixed(2)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <FieldMappingSelector
                      fieldName="Quantity"
                      fieldPath={`lineItem.${item.id}.quantity`}
                      currentValue={getResolvedQuantity(item)}
                      allOptions={allOptions}
                      onMappingChange={(field, source, customValue) => {
                    updateItem(item.id, 'quantityMapping', { source, customValue });
                    if (customValue !== undefined) {
                      // Don't try to convert computation objects to numbers
                      if (typeof customValue !== 'object' || !customValue?.$compute) {
                        updateItem(item.id, 'quantity', toNumber(customValue));
                      }
                    } else if (source) {
                      const sourceData = source.includes('payment') ? paymentData : registrationData;
                      const cleanPath = source.replace(/^(payment|registration)\./, '');
                      const value = getValueByPath(sourceData, cleanPath);
                      if (value !== undefined) updateItem(item.id, 'quantity', toNumber(value));
                    }
                  }}
                  fieldType="number"
                  sourceDocuments={{ registrations: registrationData, payments: paymentData }}
                />
                <FieldMappingSelector
                  fieldName="Price"
                  fieldPath={`lineItem.${item.id}.price`}
                  currentValue={getResolvedPrice(item)}
                  allOptions={allOptions}
                  onMappingChange={(field, source, customValue) => {
                    updateItem(item.id, 'priceMapping', { source, customValue });
                    if (customValue !== undefined) {
                      // Don't try to convert computation objects to numbers
                      if (typeof customValue !== 'object' || !customValue?.$compute) {
                        updateItem(item.id, 'price', toNumber(customValue));
                      }
                    } else if (source) {
                      const sourceData = source.includes('payment') ? paymentData : registrationData;
                      const cleanPath = source.replace(/^(payment|registration)\./, '');
                      const value = getValueByPath(sourceData, cleanPath);
                      if (value !== undefined) updateItem(item.id, 'price', toNumber(value));
                    }
                  }}
                  fieldType="number"
                  sourceDocuments={{ registrations: registrationData, payments: paymentData }}
                />
                  </>
                )}
              </div>
              
              <div className="text-sm text-gray-600">
                Total: ${(getResolvedQuantity(item) * getResolvedPrice(item)).toFixed(2)}
              </div>
            </div>

            {/* Sub-items */}
            {item.subItems && item.subItems.length > 0 && (
              <div className="ml-6 space-y-2 border-l-2 border-gray-200 pl-4">
                {item.subItems.map((subItem, subIndex) => (
                  <div key={subItem.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-gray-600">
                        {item.type === 'array' ? subItem.description : `Sub-item ${subIndex + 1}`}
                      </label>
                      {item.type !== 'array' && (
                        <button
                          onClick={() => deleteSubItem(item.id, subItem.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    {item.type !== 'array' && (
                      <CompoundDescriptionBuilder
                        fieldName="Sub-item Description"
                        segments={subItem.descriptionSegments || []}
                        onSegmentsChange={(segments) => updateSubItem(item.id, subItem.id, 'descriptionSegments', segments)}
                        allOptions={allOptions}
                        paymentData={paymentData}
                        registrationData={registrationData}
                        relatedDocuments={relatedDocuments}
                        loadingRelatedDocs={loadingRelatedDocs}
                      />
                    )}
                    
                    <div className="grid grid-cols-2 gap-2">
                      {item.type === 'array' ? (
                        <>
                          <div className="bg-gray-50 p-1 rounded">
                            <span className="text-xs text-gray-500">Qty</span>
                            <p className="text-xs font-medium">{subItem.quantity}</p>
                          </div>
                          <div className="bg-gray-50 p-1 rounded">
                            <span className="text-xs text-gray-500">Price</span>
                            <p className="text-xs font-medium">${subItem.price.toFixed(2)}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <FieldMappingSelector
                        fieldName="Qty"
                        fieldPath={`subItem.${subItem.id}.quantity`}
                        currentValue={getResolvedSubQuantity(subItem)}
                        allOptions={allOptions}
                        onMappingChange={(field, source, customValue) => {
                          updateSubItem(item.id, subItem.id, 'quantityMapping', { source, customValue });
                          if (customValue !== undefined) {
                            // Don't try to convert computation objects to numbers
                            if (typeof customValue !== 'object' || !customValue?.$compute) {
                              updateSubItem(item.id, subItem.id, 'quantity', toNumber(customValue));
                            }
                          } else if (source) {
                            const sourceData = source.includes('payment') ? paymentData : registrationData;
                            const cleanPath = source.replace(/^(payment|registration)\./, '');
                            const value = getValueByPath(sourceData, cleanPath);
                            if (value !== undefined) updateSubItem(item.id, subItem.id, 'quantity', toNumber(value));
                          }
                        }}
                        fieldType="number"
                        sourceDocuments={{ registrations: registrationData, payments: paymentData }}
                      />
                      <FieldMappingSelector
                        fieldName="Price"
                        fieldPath={`subItem.${subItem.id}.price`}
                        currentValue={getResolvedSubPrice(subItem)}
                        allOptions={allOptions}
                        onMappingChange={(field, source, customValue) => {
                          updateSubItem(item.id, subItem.id, 'priceMapping', { source, customValue });
                          if (customValue !== undefined) {
                            // Don't try to convert computation objects to numbers
                            if (typeof customValue !== 'object' || !customValue?.$compute) {
                              updateSubItem(item.id, subItem.id, 'price', toNumber(customValue));
                            }
                          } else if (source) {
                            const sourceData = source.includes('payment') ? paymentData : registrationData;
                            const cleanPath = source.replace(/^(payment|registration)\./, '');
                            const value = getValueByPath(sourceData, cleanPath);
                            if (value !== undefined) updateSubItem(item.id, subItem.id, 'price', toNumber(value));
                          }
                        }}
                        fieldType="number"
                        sourceDocuments={{ registrations: registrationData, payments: paymentData }}
                      />
                        </>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Total: ${(getResolvedSubQuantity(subItem) * getResolvedSubPrice(subItem)).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Sub-item Button */}
            {item.type !== 'array' && (
              <button
                onClick={() => addSubItem(item.id)}
                className="ml-6 text-sm text-blue-600 hover:text-blue-800"
              >
                + Add sub-item
              </button>
            )}
            
            {index < lineItems.length - 1 && <hr className="my-4" />}
          </div>
        ))}
      </div>

      {lineItems.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No line items yet. Click "Add Line Item" to start.
        </div>
      )}

      {/* Array Mappings Summary */}
      {savedArrayMappings.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-medium text-gray-700 mb-3">Active Array Mappings</h4>
          <div className="space-y-2">
            {savedArrayMappings.map((mapping, index) => (
              <div key={mapping.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={mapping.enabled}
                    onChange={(e) => {
                      const updated = [...savedArrayMappings];
                      updated[index] = { ...mapping, enabled: e.target.checked };
                      setSavedArrayMappings(updated);
                      if (onArrayMappingsChange) {
                        onArrayMappingsChange(updated);
                      }
                      // Re-process if enabling
                      if (e.target.checked) {
                        processArrayMapping(updated[index]);
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {mapping.parentArray.path.split('.').pop()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {mapping.childArrays?.length || 0} child array{mapping.childArrays?.length !== 1 ? 's' : ''} configured
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingArrayMapping(mapping);
                      setShowArrayBuilder(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      const updated = savedArrayMappings.filter(m => m.id !== mapping.id);
                      setSavedArrayMappings(updated);
                      if (onArrayMappingsChange) {
                        onArrayMappingsChange(updated);
                      }
                      // Remove related line items
                      const updatedItems = lineItems.filter(item => item.arrayMappingId !== mapping.id);
                      setLineItems(updatedItems);
                      updateParentItems(updatedItems);
                    }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Array Relationship Builder Modal */}
      {showArrayBuilder && (
        <ArrayRelationshipBuilder
          arrayMapping={editingArrayMapping}
          onChange={handleArrayMappingSave}
          registrationData={registrationData}
          paymentData={paymentData}
          onCancel={() => {
            setShowArrayBuilder(false);
            setEditingArrayMapping(null);
          }}
        />
      )}
    </div>
  );
}