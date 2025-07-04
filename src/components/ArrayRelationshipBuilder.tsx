import React, { useState, useEffect } from 'react';
import { ArrayMapping, ArrayChildMapping } from '@/services/field-mapping-storage';
import { extractAllFieldOptions, getValueByPath } from '@/utils/field-extractor';
import TemplateBuilder from './TemplateBuilder';

interface ArrayRelationshipBuilderProps {
  arrayMapping: ArrayMapping | null;
  onChange: (mapping: ArrayMapping) => void;
  registrationData?: any;
  paymentData?: any;
  onCancel: () => void;
}

export default function ArrayRelationshipBuilder({
  arrayMapping,
  onChange,
  registrationData,
  paymentData,
  onCancel
}: ArrayRelationshipBuilderProps) {
  const [mapping, setMapping] = useState<ArrayMapping>(arrayMapping || {
    id: `array_mapping_${Date.now()}`,
    enabled: true,
    parentArray: {
      path: '',
      itemConfig: {
        descriptionTemplate: '',
        quantity: { type: 'fixed', value: 1 },
        unitPrice: { type: 'fixed', value: 0 }
      },
      keyField: ''
    },
    childArrays: []
  });

  // Extract available array fields
  const allData = { registration: registrationData, payment: paymentData };
  const arrayFields = extractAllFieldOptions(paymentData, registrationData)
    .filter(field => {
      // Use displayPath which contains the full path including source prefix
      const pathToCheck = field.displayPath;
      let value;
      
      if (pathToCheck.startsWith('payment.')) {
        value = getValueByPath(paymentData, pathToCheck.replace('payment.', ''));
      } else if (pathToCheck.startsWith('registration.')) {
        value = getValueByPath(registrationData, pathToCheck.replace('registration.', ''));
      }
      
      return Array.isArray(value);
    });

  // Get fields from selected parent array
  const [parentArrayFields, setParentArrayFields] = useState<string[]>([]);
  const [parentSampleData, setParentSampleData] = useState<any>(null);

  useEffect(() => {
    if (mapping.parentArray.path) {
      let value;
      
      if (mapping.parentArray.path.startsWith('payment.')) {
        value = getValueByPath(paymentData, mapping.parentArray.path.replace('payment.', ''));
      } else if (mapping.parentArray.path.startsWith('registration.')) {
        value = getValueByPath(registrationData, mapping.parentArray.path.replace('registration.', ''));
      }
      
      if (Array.isArray(value) && value.length > 0) {
        const firstItem = value[0];
        setParentSampleData(firstItem);
        setParentArrayFields(Object.keys(firstItem));
      }
    }
  }, [mapping.parentArray.path, paymentData, registrationData]);

  const updateParentArray = (field: keyof typeof mapping.parentArray, value: any) => {
    setMapping({
      ...mapping,
      parentArray: {
        ...mapping.parentArray,
        [field]: value
      }
    });
  };

  const updateParentItemConfig = (field: keyof typeof mapping.parentArray.itemConfig, value: any) => {
    setMapping({
      ...mapping,
      parentArray: {
        ...mapping.parentArray,
        itemConfig: {
          ...mapping.parentArray.itemConfig,
          [field]: value
        }
      }
    });
  };

  const addChildArray = () => {
    const newChild: ArrayChildMapping = {
      path: '',
      relationshipKey: '',
      parentKey: '',
      itemConfig: {
        descriptionTemplate: '',
        quantity: { type: 'fixed', value: 1 },
        unitPrice: { type: 'fixed', value: 0 }
      }
    };
    
    setMapping({
      ...mapping,
      childArrays: [...(mapping.childArrays || []), newChild]
    });
  };

  const updateChildArray = (index: number, updates: Partial<ArrayChildMapping>) => {
    const updatedChildren = [...(mapping.childArrays || [])];
    updatedChildren[index] = { ...updatedChildren[index], ...updates };
    setMapping({
      ...mapping,
      childArrays: updatedChildren
    });
  };

  const removeChildArray = (index: number) => {
    setMapping({
      ...mapping,
      childArrays: mapping.childArrays?.filter((_, i) => i !== index) || []
    });
  };

  const handleSave = () => {
    onChange(mapping);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">Array Relationship Builder</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure how arrays in your data map to line items and sub-items
          </p>
        </div>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {/* Parent Array Configuration */}
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="font-medium text-gray-900 mb-3">Parent Array</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Array Field
                </label>
                <select
                  value={mapping.parentArray.path}
                  onChange={(e) => updateParentArray('path', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select an array...</option>
                  {arrayFields.map(field => (
                    <option key={field.displayPath} value={field.displayPath}>
                      {field.displayPath} (array)
                    </option>
                  ))}
                </select>
              </div>

              {mapping.parentArray.path && parentArrayFields.length > 0 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Key Field (for relationships)
                    </label>
                    <select
                      value={mapping.parentArray.keyField}
                      onChange={(e) => updateParentArray('keyField', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select key field...</option>
                      {parentArrayFields.map(field => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <TemplateBuilder
                      template={mapping.parentArray.itemConfig.descriptionTemplate}
                      onChange={(template) => updateParentItemConfig('descriptionTemplate', template)}
                      availableFields={parentArrayFields}
                      sampleData={parentSampleData}
                      placeholder="e.g., {title} {firstName} {lastName} - {attendeeType}"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={mapping.parentArray.itemConfig.quantity.type}
                          onChange={(e) => updateParentItemConfig('quantity', {
                            type: e.target.value as 'fixed' | 'field',
                            value: e.target.value === 'fixed' ? 1 : ''
                          })}
                          className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="fixed">Fixed</option>
                          <option value="field">Field</option>
                        </select>
                        {mapping.parentArray.itemConfig.quantity.type === 'fixed' ? (
                          <input
                            type="number"
                            value={mapping.parentArray.itemConfig.quantity.value as number}
                            onChange={(e) => updateParentItemConfig('quantity', {
                              ...mapping.parentArray.itemConfig.quantity,
                              value: parseFloat(e.target.value) || 0
                            })}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
                          />
                        ) : (
                          <select
                            value={mapping.parentArray.itemConfig.quantity.value as string}
                            onChange={(e) => updateParentItemConfig('quantity', {
                              ...mapping.parentArray.itemConfig.quantity,
                              value: e.target.value
                            })}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">Select field...</option>
                            {parentArrayFields.map(field => (
                              <option key={field} value={field}>{field}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit Price
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={mapping.parentArray.itemConfig.unitPrice.type}
                          onChange={(e) => updateParentItemConfig('unitPrice', {
                            type: e.target.value as 'fixed' | 'field',
                            value: e.target.value === 'fixed' ? 0 : ''
                          })}
                          className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="fixed">Fixed</option>
                          <option value="field">Field</option>
                        </select>
                        {mapping.parentArray.itemConfig.unitPrice.type === 'fixed' ? (
                          <input
                            type="number"
                            value={mapping.parentArray.itemConfig.unitPrice.value as number}
                            onChange={(e) => updateParentItemConfig('unitPrice', {
                              ...mapping.parentArray.itemConfig.unitPrice,
                              value: parseFloat(e.target.value) || 0
                            })}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
                          />
                        ) : (
                          <select
                            value={mapping.parentArray.itemConfig.unitPrice.value as string}
                            onChange={(e) => updateParentItemConfig('unitPrice', {
                              ...mapping.parentArray.itemConfig.unitPrice,
                              value: e.target.value
                            })}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">Select field...</option>
                            {parentArrayFields.map(field => (
                              <option key={field} value={field}>{field}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Child Arrays */}
          {mapping.parentArray.path && mapping.parentArray.keyField && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-gray-900">Child Arrays (Sub-items)</h4>
                <button
                  onClick={addChildArray}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  Add Child Array
                </button>
              </div>

              {mapping.childArrays?.map((child, index) => (
                <ChildArrayConfig
                  key={index}
                  child={child}
                  index={index}
                  parentKeyField={mapping.parentArray.keyField}
                  arrayFields={arrayFields}
                  allData={allData}
                  onChange={(updates) => updateChildArray(index, updates)}
                  onRemove={() => removeChildArray(index)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={!mapping.parentArray.path || !mapping.parentArray.keyField}
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

// Child Array Configuration Component
function ChildArrayConfig({
  child,
  index,
  parentKeyField,
  arrayFields,
  allData,
  onChange,
  onRemove
}: {
  child: ArrayChildMapping;
  index: number;
  parentKeyField: string;
  arrayFields: any[];
  allData: any;
  onChange: (updates: Partial<ArrayChildMapping>) => void;
  onRemove: () => void;
}) {
  const [childArrayFields, setChildArrayFields] = useState<string[]>([]);
  const [childSampleData, setChildSampleData] = useState<any>(null);

  useEffect(() => {
    if (child.path) {
      const value = getValueByPath(allData, child.path);
      if (Array.isArray(value) && value.length > 0) {
        const firstItem = value[0];
        setChildSampleData(firstItem);
        setChildArrayFields(Object.keys(firstItem));
      }
    }
  }, [child.path]);

  return (
    <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
      <div className="flex justify-between items-start mb-3">
        <h5 className="font-medium text-gray-900">Child Array {index + 1}</h5>
        <button
          onClick={onRemove}
          className="text-red-600 hover:text-red-800 text-sm"
        >
          Remove
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Child Array
          </label>
          <select
            value={child.path}
            onChange={(e) => onChange({ path: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">Select an array...</option>
            {arrayFields.map(field => (
              <option key={field.value} value={field.value}>
                {field.label} ({field.value})
              </option>
            ))}
          </select>
        </div>

        {child.path && childArrayFields.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Child Key Field (matches parent)
                </label>
                <select
                  value={child.relationshipKey}
                  onChange={(e) => onChange({ relationshipKey: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select field...</option>
                  {childArrayFields.map(field => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Key Field
                </label>
                <input
                  type="text"
                  value={parentKeyField}
                  disabled
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm bg-gray-100"
                />
              </div>
            </div>

            <div>
              <TemplateBuilder
                template={child.itemConfig.descriptionTemplate}
                onChange={(template) => onChange({
                  itemConfig: { ...child.itemConfig, descriptionTemplate: template }
                })}
                availableFields={childArrayFields}
                sampleData={childSampleData}
                placeholder="e.g., {name} - {ticketType}"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}