'use client';

import React, { useState, useEffect } from 'react';
import { getMonetaryValue, formatMoney } from '../utils/monetary';

interface MatchCriteria {
  paymentField: string;
  paymentValue: any;
  registrationField: string;
  registrationValue: any;
}

interface ManualMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
  registration: any;
  onMatch: (criteria: MatchCriteria[]) => Promise<void>;
}

export default function ManualMatchModal({ isOpen, onClose, payment, registration, onMatch }: ManualMatchModalProps) {
  const [matchCriteria, setMatchCriteria] = useState<MatchCriteria[]>([]);
  const [paymentFields, setPaymentFields] = useState<string[]>([]);
  const [registrationFields, setRegistrationFields] = useState<string[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [selectedPaymentField, setSelectedPaymentField] = useState('');
  const [selectedRegistrationField, setSelectedRegistrationField] = useState('');

  useEffect(() => {
    if (payment && registration) {
      // Extract all fields from payment and registration
      const pFields = extractFields(payment, '');
      const rFields = extractFields(registration, '');
      setPaymentFields(pFields);
      setRegistrationFields(rFields);
      
      // Auto-detect potential matches
      autoDetectMatches(payment, registration, pFields, rFields);
    }
  }, [payment, registration]);

  const extractFields = (obj: any, prefix: string): string[] => {
    const fields: string[] = [];
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && key !== '_id') {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        
        if (value !== null && value !== undefined) {
          if (typeof value === 'object' && !Array.isArray(value) && !value.$numberDecimal) {
            // Recursively extract nested fields
            fields.push(...extractFields(value, fieldPath));
          } else if (!Array.isArray(value)) {
            fields.push(fieldPath);
          }
        }
      }
    }
    
    return fields.sort();
  };

  const getFieldValue = (obj: any, path: string): any => {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  };

  const autoDetectMatches = (payment: any, registration: any, pFields: string[], rFields: string[]) => {
    const detected: MatchCriteria[] = [];
    
    // Check for common ID matches
    const idMappings = [
      { payment: 'paymentId', registration: 'stripePaymentIntentId' },
      { payment: 'paymentId', registration: 'squarePaymentId' },
      { payment: 'paymentIntent', registration: 'stripePaymentIntentId' },
      { payment: 'transactionId', registration: 'transactionId' },
      { payment: 'referenceId', registration: 'referenceId' },
    ];
    
    for (const mapping of idMappings) {
      const pValue = getFieldValue(payment, mapping.payment);
      const rValue = getFieldValue(registration, mapping.registration);
      
      if (pValue && rValue && pValue === rValue) {
        detected.push({
          paymentField: mapping.payment,
          paymentValue: pValue,
          registrationField: mapping.registration,
          registrationValue: rValue
        });
      }
    }
    
    // Check for email matches
    const paymentEmail = getFieldValue(payment, 'customerEmail') || getFieldValue(payment, 'email');
    const registrationEmail = getFieldValue(registration, 'customerEmail') || getFieldValue(registration, 'email');
    
    if (paymentEmail && registrationEmail && paymentEmail.toLowerCase() === registrationEmail.toLowerCase()) {
      detected.push({
        paymentField: payment.customerEmail ? 'customerEmail' : 'email',
        paymentValue: paymentEmail,
        registrationField: registration.customerEmail ? 'customerEmail' : 'email',
        registrationValue: registrationEmail
      });
    }
    
    // Check for amount matches
    const paymentAmount = getMonetaryValue(payment.amount);
    const registrationAmount = getMonetaryValue(registration.totalAmount || registration.totalAmountPaid);
    
    if (paymentAmount && registrationAmount && Math.abs(paymentAmount - registrationAmount) < 0.01) {
      detected.push({
        paymentField: 'amount',
        paymentValue: paymentAmount,
        registrationField: registration.totalAmount ? 'totalAmount' : 'totalAmountPaid',
        registrationValue: registrationAmount
      });
    }
    
    setMatchCriteria(detected);
  };

  const addMatchCriteria = () => {
    if (selectedPaymentField && selectedRegistrationField) {
      const paymentValue = getFieldValue(payment, selectedPaymentField);
      const registrationValue = getFieldValue(registration, selectedRegistrationField);
      
      if (paymentValue !== undefined && registrationValue !== undefined) {
        setMatchCriteria([...matchCriteria, {
          paymentField: selectedPaymentField,
          paymentValue,
          registrationField: selectedRegistrationField,
          registrationValue
        }]);
        
        setSelectedPaymentField('');
        setSelectedRegistrationField('');
      }
    }
  };

  const removeMatchCriteria = (index: number) => {
    setMatchCriteria(matchCriteria.filter((_, i) => i !== index));
  };

  const handleMatch = async () => {
    if (matchCriteria.length === 0) {
      alert('Please specify at least one matching criteria');
      return;
    }
    
    setIsMatching(true);
    try {
      await onMatch(matchCriteria);
      onClose();
    } catch (error) {
      console.error('Failed to match:', error);
      alert('Failed to match payment and registration');
    } finally {
      setIsMatching(false);
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object' && value.$numberDecimal) return formatMoney(value);
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold">Manual Match Payment and Registration</h2>
          <p className="text-gray-600 mt-1">Define the criteria that link this payment to the registration</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {/* Payment and Registration Summary */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded">
              <h3 className="font-semibold text-lg mb-2">Payment</h3>
              <div className="text-sm space-y-1">
                <div><span className="font-medium">ID:</span> {payment._id}</div>
                <div><span className="font-medium">Amount:</span> {formatMoney(payment.amount)}</div>
                <div><span className="font-medium">Date:</span> {new Date(payment.timestamp || payment.createdAt).toLocaleDateString()}</div>
                {payment.customerEmail && <div><span className="font-medium">Email:</span> {payment.customerEmail}</div>}
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded">
              <h3 className="font-semibold text-lg mb-2">Registration</h3>
              <div className="text-sm space-y-1">
                <div><span className="font-medium">ID:</span> {registration._id}</div>
                <div><span className="font-medium">Amount:</span> {formatMoney(registration.totalAmount || registration.totalAmountPaid)}</div>
                <div><span className="font-medium">Date:</span> {new Date(registration.createdAt).toLocaleDateString()}</div>
                {registration.customerEmail && <div><span className="font-medium">Email:</span> {registration.customerEmail}</div>}
              </div>
            </div>
          </div>
          
          {/* Match Criteria */}
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-3">Match Criteria</h3>
            
            {matchCriteria.length > 0 && (
              <div className="space-y-2 mb-4">
                {matchCriteria.map((criteria, index) => (
                  <div key={index} className="bg-green-50 border border-green-200 rounded p-3 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm">
                        <span className="font-medium">Payment:</span> {criteria.paymentField} = {formatValue(criteria.paymentValue)}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Registration:</span> {criteria.registrationField} = {formatValue(criteria.registrationValue)}
                      </div>
                    </div>
                    <button
                      onClick={() => removeMatchCriteria(index)}
                      className="ml-4 text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add New Criteria */}
            <div className="bg-gray-50 p-4 rounded">
              <h4 className="font-medium mb-3">Add Match Criteria</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Field</label>
                  <select
                    value={selectedPaymentField}
                    onChange={(e) => setSelectedPaymentField(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Select field...</option>
                    {paymentFields.map(field => (
                      <option key={field} value={field}>
                        {field} = {formatValue(getFieldValue(payment, field))}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Registration Field</label>
                  <select
                    value={selectedRegistrationField}
                    onChange={(e) => setSelectedRegistrationField(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Select field...</option>
                    {registrationFields.map(field => (
                      <option key={field} value={field}>
                        {field} = {formatValue(getFieldValue(registration, field))}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <button
                onClick={addMatchCriteria}
                disabled={!selectedPaymentField || !selectedRegistrationField}
                className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
              >
                Add Criteria
              </button>
            </div>
          </div>
          
          {/* Match Preview */}
          {matchCriteria.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <h4 className="font-medium mb-2">Match Summary</h4>
              <p className="text-sm">
                This will link Payment <span className="font-mono">{payment._id}</span> to Registration <span className="font-mono">{registration._id}</span> based on {matchCriteria.length} matching criteria.
              </p>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMatch}
            disabled={matchCriteria.length === 0 || isMatching}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            {isMatching ? 'Matching...' : 'Confirm Match'}
          </button>
        </div>
      </div>
    </div>
  );
}