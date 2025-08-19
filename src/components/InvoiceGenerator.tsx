'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Send, Upload, RefreshCw } from 'lucide-react';

interface InvoiceGeneratorProps {
  paymentId: string;
  onInvoiceGenerated?: (invoiceNumber: string, url?: string) => void;
  existingInvoice?: {
    invoiceNumber?: string;
    invoiceUrl?: string;
    invoiceCreated?: boolean;
  };
}

export const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({
  paymentId,
  onInvoiceGenerated,
  existingInvoice
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const generateInvoice = async (options: {
    sendEmail?: boolean;
    regenerate?: boolean;
  } = {}) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

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
            sendEmail: options.sendEmail !== false,
            regenerate: options.regenerate || false,
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

      setSuccess(true);
      onInvoiceGenerated?.(data.invoiceNumber, data.url);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const hasInvoice = existingInvoice?.invoiceCreated;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {!hasInvoice ? (
          <>
            <Button
              onClick={() => generateInvoice({ sendEmail: false })}
              disabled={loading}
              variant="outline"
            >
              <Download className="w-4 h-4 mr-2" />
              Generate & Download
            </Button>
            <Button
              onClick={() => generateInvoice({ sendEmail: true })}
              disabled={loading}
              variant="default"
            >
              <Send className="w-4 h-4 mr-2" />
              Generate & Send
            </Button>
          </>
        ) : (
          <>
            <div className="text-sm text-gray-600">
              Invoice: <span className="font-mono">{existingInvoice.invoiceNumber}</span>
            </div>
            <Button
              onClick={() => generateInvoice({ regenerate: true, sendEmail: false })}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
            {existingInvoice.invoiceUrl && (
              <Button
                onClick={() => window.open(existingInvoice.invoiceUrl, '_blank')}
                variant="outline"
                size="sm"
              >
                <Upload className="w-4 h-4 mr-2" />
                View
              </Button>
            )}
          </>
        )}
      </div>

      {loading && (
        <div className="text-sm text-gray-600">Generating invoice...</div>
      )}

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      {success && (
        <div className="text-sm text-green-600">
          Invoice generated successfully!
        </div>
      )}
    </div>
  );
};