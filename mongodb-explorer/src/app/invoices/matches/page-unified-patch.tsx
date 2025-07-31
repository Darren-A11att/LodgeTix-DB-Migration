// This is a patch file showing how to update the InvoiceMatchesPage to use the unified invoice service
// Add this import at the top:
import { useUnifiedInvoice } from '@/hooks/useUnifiedInvoice';

// Add this hook inside the component:
const { createInvoice: createUnifiedInvoice, loading: unifiedLoading } = useUnifiedInvoice({
  onSuccess: (invoiceNumber, url) => {
    alert(`Invoice created successfully! Invoice Number: ${invoiceNumber}`);
    
    // Move to next payment
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      alert('All payments processed!');
    }
    
    // Refresh to show invoice details
    fetchCurrentPayment();
  },
  onError: (error) => {
    alert(`Failed to create invoice: ${error}`);
  }
});

// Replace the handleApprove function with this simplified version:
const handleApprove = async () => {
  const paymentToUse = selectedPayment || currentMatch?.payment;
  if (!paymentToUse?._id) {
    alert('No payment selected');
    return;
  }
  
  try {
    setProcessing(true);
    
    // If manual registration selected, update the payment's match first
    if (selectedRegistration && selectedRegistration._id !== currentMatch?.registration?._id) {
      await apiService.updateDocument('payments', paymentToUse._id, {
        matchedRegistrationId: selectedRegistration._id,
        matchedBy: 'manual',
        matchConfidence: 100,
        matchedAt: new Date()
      });
    }
    
    // Create invoice using unified service
    await createUnifiedInvoice(paymentToUse._id, true); // true = send email
    
  } catch (err) {
    console.error('Error in handleApprove:', err);
    alert('Failed to process: ' + (err instanceof Error ? err.message : 'Unknown error'));
  } finally {
    setProcessing(false);
  }
};

// Update the button to use the new loading state:
<button
  onClick={handleApprove}
  disabled={processing || unifiedLoading}
  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
>
  {(processing || unifiedLoading) ? 'Creating Invoice...' : 'Create Invoice'}
</button>

// For the modal "Create Invoice" button, replace its onClick with:
onClick={async () => {
  setIsCreatingInvoice(true);
  try {
    const paymentToUse = selectedPayment || currentMatch?.payment;
    if (!paymentToUse?._id) {
      throw new Error('No payment selected');
    }
    
    // Create invoice without sending email since it's from preview
    await createUnifiedInvoice(paymentToUse._id, false);
    setShowInvoicePreviewModal(false);
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    alert(`Failed to create invoice: ${error.message}`);
  } finally {
    setIsCreatingInvoice(false);
  }
}