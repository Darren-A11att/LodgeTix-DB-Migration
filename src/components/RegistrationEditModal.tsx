'use client';

import { useState, useEffect } from 'react';
import FieldMappingSelector from './FieldMappingSelector';
import { extractAllFieldOptions, extractRelatedDocumentFields, getValueByPath } from '@/utils/field-extractor';
import { registrationMappingStorage, RegistrationFieldMapping } from '@/services/registration-mapping-storage';
import RelatedDocuments from './RelatedDocuments';
import apiService from '@/lib/api';

interface RegistrationEditModalProps {
  registration: any;
  onSave: (updatedRegistration: any) => Promise<void>;
  onClose: () => void;
  paymentData?: any;
  relatedDocuments?: any;
}

export default function RegistrationEditModal({ registration, onSave, onClose, paymentData, relatedDocuments }: RegistrationEditModalProps) {
  const [editedData, setEditedData] = useState<any>({});
  const [rawJson, setRawJson] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [fieldMappings, setFieldMappings] = useState<Record<string, { source: string | null; customValue?: any }>>({});
  const [savedMappings, setSavedMappings] = useState<RegistrationFieldMapping[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const [showSaveMappingModal, setShowSaveMappingModal] = useState(false);
  const [mappingName, setMappingName] = useState('');
  const [mappingDescription, setMappingDescription] = useState('');
  const [highlightedFields, setHighlightedFields] = useState<string[]>([]);
  const [applyMappedValues, setApplyMappedValues] = useState(false);
  
  const tabs = [
    'Basic Information',
    'Customer Details', 
    'Financial Information',
    'Booking Contact',
    'Field Mapping',
    'Raw JSON'
  ];

  useEffect(() => {
    // Initialize with current registration data
    setEditedData(JSON.parse(JSON.stringify(registration)));
    setRawJson(JSON.stringify(registration, null, 2));
    
    // Load saved mappings
    const mappings = registrationMappingStorage.getAllMappings();
    setSavedMappings(mappings);
    
    // Check for null fields that have mapped values
    if (selectedMappingId && paymentData) {
      const nullFields = registrationMappingStorage.getMappedNullFields(
        registration,
        selectedMappingId,
        paymentData,
        relatedDocuments
      );
      setHighlightedFields(nullFields.map(f => f.field));
    }
  }, [registration, selectedMappingId, paymentData, relatedDocuments]);

  const updateField = (path: string, value: any) => {
    const keys = path.split('.');
    const newData = { ...editedData };
    let current = newData;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setEditedData(newData);
    setRawJson(JSON.stringify(newData, null, 2));
  };

  const getFieldValue = (path: string) => {
    const keys = path.split('.');
    let current = editedData;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return '';
      }
    }
    
    return current;
  };

  const handleRawJsonChange = (value: string) => {
    setRawJson(value);
    setJsonError('');
    
    try {
      const parsed = JSON.parse(value);
      setEditedData(parsed);
    } catch (err) {
      setJsonError('Invalid JSON: ' + (err as Error).message);
    }
  };

  const handleFieldMappingChange = (fieldPath: string, sourcePath: string | null, customValue?: any) => {
    setFieldMappings(prev => ({
      ...prev,
      [fieldPath]: { source: sourcePath, customValue }
    }));
    
    // Update the field value immediately if mapping is applied
    if (sourcePath || customValue !== undefined) {
      if (customValue !== undefined) {
        updateField(fieldPath, customValue);
      } else if (sourcePath) {
        let value;
        if (sourcePath.startsWith('payment.') && paymentData) {
          value = getValueByPath(paymentData, sourcePath.replace('payment.', ''));
        } else if (sourcePath.startsWith('registration.')) {
          value = getValueByPath(editedData, sourcePath.replace('registration.', ''));
        } else if (sourcePath.startsWith('related.') && relatedDocuments) {
          value = getValueByPath(relatedDocuments, sourcePath.replace('related.', ''));
        }
        if (value !== undefined) {
          updateField(fieldPath, value);
        }
      }
    }
  };

  const handleSave = async () => {
    if (jsonError) {
      alert('Please fix JSON errors before saving');
      return;
    }

    try {
      setLoading(true);
      
      // Apply mapped values if requested
      if (applyMappedValues && selectedMappingId && paymentData) {
        const mappedData = registrationMappingStorage.applyMapping(
          selectedMappingId,
          paymentData,
          editedData,
          relatedDocuments
        );
        
        // Merge mapped data with edited data
        const mergedData = { ...editedData };
        Object.entries(mappedData).forEach(([path, value]) => {
          const keys = path.split('.');
          let current = mergedData;
          
          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
              current[keys[i]] = {};
            }
            current = current[keys[i]];
          }
          
          current[keys[keys.length - 1]] = value;
        });
        
        await onSave(mergedData);
      } else {
        await onSave(editedData);
      }
      
      onClose();
    } catch (error) {
      alert('Failed to save: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: any) => {
    const num = parseFloat(value?.$numberDecimal || value || 0);
    return num.toFixed(2);
  };

  const parseCurrency = (value: string) => {
    const num = parseFloat(value);
    return { $numberDecimal: num.toFixed(2) };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Edit Registration</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              disabled={loading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div>
          <div className="flex border-b">
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`px-4 py-2 font-medium text-sm ${
                  activeTab === index 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
            {/* Basic Information Tab */}
            {activeTab === 0 && (
              <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={highlightedFields.includes('registrationId') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Registration ID"
                    fieldPath="registrationId"
                    currentValue={getFieldValue('registrationId')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('confirmationNumber') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Confirmation Number"
                    fieldPath="confirmationNumber"
                    currentValue={getFieldValue('confirmationNumber')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={getFieldValue('status') || ''}
                    onChange={(e) => updateField('status', e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select status</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={getFieldValue('paymentStatus') || ''}
                    onChange={(e) => updateField('paymentStatus', e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Select status</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
                <div className={highlightedFields.includes('stripePaymentIntentId') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Stripe Payment Intent ID"
                    fieldPath="stripePaymentIntentId"
                    currentValue={getFieldValue('stripePaymentIntentId')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('squarePaymentId') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Square Payment ID"
                    fieldPath="squarePaymentId"
                    currentValue={getFieldValue('squarePaymentId')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('functionName') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Function Name"
                    fieldPath="functionName"
                    currentValue={getFieldValue('functionName')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('eventId') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Event ID"
                    fieldPath="eventId"
                    currentValue={getFieldValue('eventId')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
              </div>
              </div>
            )}

            {/* Customer Details Tab */}
            {activeTab === 1 && (
              <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={highlightedFields.includes('customerName') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Customer Name"
                    fieldPath="customerName"
                    currentValue={getFieldValue('customerName')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('customerEmail') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Customer Email"
                    fieldPath="customerEmail"
                    currentValue={getFieldValue('customerEmail')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('primaryAttendee') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Primary Attendee"
                    fieldPath="primaryAttendee"
                    currentValue={getFieldValue('primaryAttendee')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('customerId') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Customer ID"
                    fieldPath="customerId"
                    currentValue={getFieldValue('customerId')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('organisationName') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Organisation Name"
                    fieldPath="organisationName"
                    currentValue={getFieldValue('organisationName')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('organisationNumber') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Organisation Number"
                    fieldPath="organisationNumber"
                    currentValue={getFieldValue('organisationNumber')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
              </div>
              </div>
            )}

            {/* Financial Information Tab */}
            {activeTab === 2 && (
              <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={highlightedFields.includes('totalAmountPaid') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Total Amount Paid"
                    fieldPath="totalAmountPaid"
                    currentValue={getFieldValue('totalAmountPaid')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('totalAmount') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Total Amount"
                    fieldPath="totalAmount"
                    currentValue={getFieldValue('totalAmount')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('subtotal') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Subtotal"
                    fieldPath="subtotal"
                    currentValue={getFieldValue('subtotal')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('stripeFee') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Stripe Fee"
                    fieldPath="stripeFee"
                    currentValue={getFieldValue('stripeFee')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('squareFee') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Square Fee"
                    fieldPath="squareFee"
                    currentValue={getFieldValue('squareFee')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('platformFeeAmount') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Platform Fee Amount"
                    fieldPath="platformFeeAmount"
                    currentValue={getFieldValue('platformFeeAmount')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('totalPricePaid') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Total Price Paid"
                    fieldPath="totalPricePaid"
                    currentValue={getFieldValue('totalPricePaid')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Includes Processing Fee
                  </label>
                  <select
                    value={getFieldValue('includesProcessingFee') ? 'true' : 'false'}
                    onChange={(e) => updateField('includesProcessingFee', e.target.value === 'true')}
                    className="w-full p-2 border rounded"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
              </div>
              </div>
            )}

            {/* Booking Contact Tab */}
            {activeTab === 3 && (
              <div className="p-6 space-y-4">
              <h3 className="font-semibold mb-4">Booking Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className={highlightedFields.includes('registrationData.bookingContact.firstName') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="First Name"
                    fieldPath="registrationData.bookingContact.firstName"
                    currentValue={getFieldValue('registrationData.bookingContact.firstName')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('registrationData.bookingContact.lastName') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Last Name"
                    fieldPath="registrationData.bookingContact.lastName"
                    currentValue={getFieldValue('registrationData.bookingContact.lastName')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('registrationData.bookingContact.email') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Email"
                    fieldPath="registrationData.bookingContact.email"
                    currentValue={getFieldValue('registrationData.bookingContact.email')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('registrationData.bookingContact.emailAddress') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Email Address (Alt)"
                    fieldPath="registrationData.bookingContact.emailAddress"
                    currentValue={getFieldValue('registrationData.bookingContact.emailAddress')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('registrationData.bookingContact.phone') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Phone"
                    fieldPath="registrationData.bookingContact.phone"
                    currentValue={getFieldValue('registrationData.bookingContact.phone')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('registrationData.bookingContact.mobileNumber') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Mobile Number"
                    fieldPath="registrationData.bookingContact.mobileNumber"
                    currentValue={getFieldValue('registrationData.bookingContact.mobileNumber')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('registrationData.bookingContact.addressLine1') ? 'ring-2 ring-red-500 rounded col-span-2' : 'col-span-2'}>
                  <FieldMappingSelector
                    fieldName="Address Line 1"
                    fieldPath="registrationData.bookingContact.addressLine1"
                    currentValue={getFieldValue('registrationData.bookingContact.addressLine1')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('registrationData.bookingContact.city') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="City"
                    fieldPath="registrationData.bookingContact.city"
                    currentValue={getFieldValue('registrationData.bookingContact.city')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('registrationData.bookingContact.stateProvince') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="State/Province"
                    fieldPath="registrationData.bookingContact.stateProvince"
                    currentValue={getFieldValue('registrationData.bookingContact.stateProvince')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('registrationData.bookingContact.postalCode') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Postal Code"
                    fieldPath="registrationData.bookingContact.postalCode"
                    currentValue={getFieldValue('registrationData.bookingContact.postalCode')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
                <div className={highlightedFields.includes('registrationData.bookingContact.country') ? 'ring-2 ring-red-500 rounded' : ''}>
                  <FieldMappingSelector
                    fieldName="Country"
                    fieldPath="registrationData.bookingContact.country"
                    currentValue={getFieldValue('registrationData.bookingContact.country')}
                    allOptions={[
                      ...extractAllFieldOptions(paymentData, editedData),
                      ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
                    ]}
                    onMappingChange={handleFieldMappingChange}
                  />
                </div>
              </div>
              </div>
            )}

            {/* Field Mapping Tab */}
            {activeTab === 4 && (
              <div className="p-6 space-y-4">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Field Mapping Configuration</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Configure how fields are automatically populated from payment data, related documents, or custom values.
                  </p>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mapping Template</label>
                    <div className="flex gap-2">
                      <select
                        value={selectedMappingId || ''}
                        onChange={(e) => {
                          const mappingId = e.target.value || null;
                          setSelectedMappingId(mappingId);
                          
                          if (mappingId) {
                            const mapping = registrationMappingStorage.getMapping(mappingId);
                            if (mapping) {
                              setFieldMappings(mapping.mappings);
                              
                              // Check for null fields
                              if (paymentData) {
                                const nullFields = registrationMappingStorage.getMappedNullFields(
                                  editedData,
                                  mappingId,
                                  paymentData,
                                  relatedDocuments
                                );
                                setHighlightedFields(nullFields.map(f => f.field));
                              }
                            }
                          } else {
                            setFieldMappings({});
                            setHighlightedFields([]);
                          }
                        }}
                        className="flex-1 text-sm px-3 py-2 border rounded"
                      >
                        <option value="">Select a mapping template...</option>
                        {savedMappings
                          .filter(mapping => !mapping.registrationType || mapping.registrationType === registration.registrationType)
                          .map(mapping => (
                            <option key={mapping.id} value={mapping.id}>
                              {mapping.name}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => setShowSaveMappingModal(true)}
                        className="px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
                        title="Save current mappings as template"
                      >
                        Save Template
                      </button>
                    </div>
                  </div>
                  
                  {highlightedFields.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                      <h4 className="font-medium text-yellow-800 mb-2">Fields with Mapped Values</h4>
                      <p className="text-sm text-yellow-700 mb-3">
                        The following fields are empty but have values available from the selected mapping:
                      </p>
                      <ul className="text-sm text-yellow-700 list-disc list-inside mb-3">
                        {highlightedFields.map(field => (
                          <li key={field}>{field}</li>
                        ))}
                      </ul>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={applyMappedValues}
                          onChange={(e) => setApplyMappedValues(e.target.checked)}
                          className="rounded text-yellow-600"
                        />
                        <span className="text-sm text-yellow-700">Apply mapped values when saving</span>
                      </label>
                    </div>
                  )}
                  
                  <div className="bg-gray-50 p-4 rounded">
                    <h4 className="font-medium text-gray-700 mb-2">How Field Mapping Works</h4>
                    <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                      <li>Fields with red borders have null values but mapped data available</li>
                      <li>Use the field selectors in each tab to map fields to payment or related document data</li>
                      <li>Save your mappings as templates for reuse</li>
                      <li>Check "Apply mapped values" to automatically fill empty fields when saving</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Raw JSON Tab */}
            {activeTab === 5 && (
              <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Edit Raw JSON
                  </label>
                  <textarea
                    value={rawJson}
                    onChange={(e) => handleRawJsonChange(e.target.value)}
                    className={`w-full h-96 p-3 border rounded font-mono text-sm ${
                      jsonError ? 'border-red-500' : 'border-gray-300'
                    }`}
                    spellCheck={false}
                  />
                  {jsonError && (
                    <p className="mt-1 text-sm text-red-600">{jsonError}</p>
                  )}
                </div>
              </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !!jsonError}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Save Mapping Modal */}
      {showSaveMappingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Save Field Mapping Template</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={mappingName}
                  onChange={(e) => setMappingName(e.target.value)}
                  placeholder="e.g., Individual Registration Mapping"
                  className="w-full p-2 border rounded"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={mappingDescription}
                  onChange={(e) => setMappingDescription(e.target.value)}
                  placeholder="Describe when to use this mapping..."
                  className="w-full p-2 border rounded h-20"
                />
              </div>
              
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-1">This template will save mappings for:</p>
                <ul className="list-disc list-inside">
                  <li>{Object.keys(fieldMappings).length} field mappings</li>
                  <li>Registration type: {registration.registrationType || 'All'}</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSaveMappingModal(false);
                  setMappingName('');
                  setMappingDescription('');
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!mappingName.trim()) {
                    alert('Please enter a template name');
                    return;
                  }
                  
                  const newMapping = registrationMappingStorage.saveMapping(
                    mappingName,
                    fieldMappings,
                    mappingDescription,
                    registration.registrationType
                  );
                  
                  setSavedMappings([...savedMappings, newMapping]);
                  setSelectedMappingId(newMapping.id);
                  setShowSaveMappingModal(false);
                  setMappingName('');
                  setMappingDescription('');
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}