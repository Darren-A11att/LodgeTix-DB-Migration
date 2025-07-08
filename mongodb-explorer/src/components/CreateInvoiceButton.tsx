'use client';

import React, { useState } from 'react';

interface CreateInvoiceButtonProps {
  payment: any;
  registration: any;
  customerInvoice: any;
  supplierInvoice?: any;
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
}

export function CreateInvoiceButton({
  payment,
  registration,
  customerInvoice,
  supplierInvoice,
  onSuccess,
  onError
}: CreateInvoiceButtonProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState<string>('');

  const handleCreateInvoice = async () => {
    try {
      setIsCreating(true);
      setStatus('Creating invoice...');
      
      console.log('=== CREATE INVOICE BUTTON CLICKED ===');
      console.log('Payment:', payment._id);
      console.log('Registration:', registration._id);
      
      // Use the atomic endpoint
      const response = await fetch('/api/invoices/create-atomic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment,
          registration,
          customerInvoice,
          supplierInvoice
        }),
      });
      
      const result = await response.json();
      console.log('API Response:', result);
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create invoice');
      }
      
      // Success!
      setStatus('Invoice created successfully!');
      console.log('✅ Invoice created successfully');
      console.log('- Invoice ID:', result.invoiceId);
      console.log('- Customer Invoice:', result.customerInvoiceNumber);
      console.log('- Supplier Invoice:', result.supplierInvoiceNumber);
      console.log('- Transactions:', result.transactionCount);
      
      // Show detailed status
      const statusDetails = result.status;
      console.log('\nDetailed Status:');
      console.log('- Invoice Numbers Generated:', statusDetails.invoiceNumbersGenerated);
      console.log('- Invoices Inserted:', statusDetails.invoicesInserted);
      console.log('- Transactions Created:', statusDetails.transactionsCreated);
      console.log('- Payment Updated:', statusDetails.paymentUpdated);
      console.log('- Registration Updated:', statusDetails.registrationUpdated);
      console.log('- Transaction IDs:', statusDetails.transactionIds);
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      // Now proceed with PDF generation and other post-creation tasks
      // This would be handled by the parent component
      
    } catch (error: any) {
      console.error('❌ Error creating invoice:', error);
      setStatus(`Error: ${error.message}`);
      
      if (onError) {
        onError(error);
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleCreateInvoice}
        disabled={isCreating}
        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isCreating ? 'Creating...' : 'Create Invoice (Atomic)'}
      </button>
      {status && (
        <div className={`text-sm ${status.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {status}
        </div>
      )}
    </div>
  );
}