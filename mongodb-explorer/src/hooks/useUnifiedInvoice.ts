import { useState } from 'react';

interface UseUnifiedInvoiceOptions {
  onSuccess?: (invoiceNumber: string, url?: string) => void;
  onError?: (error: string) => void;
}

export function useUnifiedInvoice(options: UseUnifiedInvoiceOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createInvoice = async (paymentId: string, sendEmail: boolean = true) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId,
          options: {
            uploadToSupabase: true,
            sendEmail,
            includePdf: true
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate invoice');
      }

      // Download the PDF
      if (data.pdfBase64) {
        const pdfBlob = new Blob(
          [Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0))],
          { type: 'application/pdf' }
        );
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      options.onSuccess?.(data.invoiceNumber, data.url);
      return { success: true, invoiceNumber: data.invoiceNumber, url: data.url };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      options.onError?.(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    createInvoice,
    loading,
    error
  };
}