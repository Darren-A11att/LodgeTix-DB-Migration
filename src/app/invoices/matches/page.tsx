'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import JsonViewer from '@/components/JsonViewer';
import JsonViewerWithHighlight from '@/components/JsonViewerWithHighlight';
import EditableJsonViewer from '@/components/EditableJsonViewer';
import InvoiceComponent from '@/components/Invoice';
import FieldMappingSelector from '@/components/FieldMappingSelector';
import RegistrationEditModal from '@/components/RegistrationEditModal';
import LineItemManager from '@/components/LineItemManager';
import RelatedDocuments from '@/components/RelatedDocuments';
import ManualMatchModal from '@/components/ManualMatchModal';
import { extractAllFieldOptions, extractRelatedDocumentFields, getSmartSuggestions, getValueByPath } from '@/utils/field-extractor';
import { fieldMappingStorage, FieldMapping, ArrayMapping } from '@/services/field-mapping-storage';
import { registrationMappingStorage } from '@/services/registration-mapping-storage';
import apiService from '@/lib/api';
import { getSupplierInvoiceSupplier, DEFAULT_INVOICE_SUPPLIER } from '../../../constants/invoice';
import { loadLogoAsBase64 } from '@/utils/logo-base64';
import { getMonetaryValue, formatMoney } from '@/utils/monetary';

interface MatchDetail {
  valueType: 'paymentId' | 'registrationId' | 'confirmationNumber' | 'email' | 'amount' | 'accountId' | 'name' | 'address' | 'timestamp';
  paymentField: string;
  registrationPaths: string[];
  value: any;
  weight: number;
}

interface InvoiceMatch {
  payment: any;
  registration: any;
  invoice: any;
  matchConfidence: number;
  matchDetails?: MatchDetail[];
}

interface MatchesResponse {
  matches: InvoiceMatch[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export default function InvoiceMatchesPage() {
  const searchParams = useSearchParams();
  const [currentMatch, setCurrentMatch] = useState<InvoiceMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(() => {
    const indexParam = searchParams.get('index');
    return indexParam ? parseInt(indexParam, 10) : 0;
  });
  const [total, setTotal] = useState(0);
  const [paymentId] = useState(() => searchParams.get('paymentId'));
  const [processing, setProcessing] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineComments, setDeclineComments] = useState('');
  
  // Registration search states
  const [showRegistrationSearchModal, setShowRegistrationSearchModal] = useState(false);
  const [registrationSearchQuery, setRegistrationSearchQuery] = useState('');
  const [registrationSearchResults, setRegistrationSearchResults] = useState<any[]>([]);
  const [registrationSearchLoading, setRegistrationSearchLoading] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<any | null>(null);
  const [useRawTextSearch, setUseRawTextSearch] = useState(false);
  
  // Payment search states
  const [showPaymentSearchModal, setShowPaymentSearchModal] = useState(false);
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [paymentSearchResults, setPaymentSearchResults] = useState<any[]>([]);
  const [paymentSearchLoading, setPaymentSearchLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  
  // Invoice preview modal states
  const [showInvoicePreviewModal, setShowInvoicePreviewModal] = useState(false);
  
  // Logo state for PDF generation
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [editableInvoice, setEditableInvoice] = useState<any>(null);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [fieldMappingConfig, setFieldMappingConfig] = useState<Record<string, { source: string | null; customValue?: any }>>({});
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  
  // Invoice type states
  const [activeInvoiceType, setActiveInvoiceType] = useState<'customer' | 'supplier'>('customer');
  const [customerInvoice, setCustomerInvoice] = useState<any>(null);
  const [supplierInvoice, setSupplierInvoice] = useState<any>(null);
  const [customerFieldMappingConfig, setCustomerFieldMappingConfig] = useState<Record<string, { source: string | null; customValue?: any }>>({});
  const [supplierFieldMappingConfig, setSupplierFieldMappingConfig] = useState<Record<string, { source: string | null; customValue?: any }>>({});
  
  // Registration edit modal states
  const [showRegistrationEditModal, setShowRegistrationEditModal] = useState(false);
  const [showRelatedDocuments, setShowRelatedDocuments] = useState(false);
  
  // Invoice processing status states
  const [processedInvoices, setProcessedInvoices] = useState<any[]>([]);
  const [loadingInvoiceStatus, setLoadingInvoiceStatus] = useState(false);
  
  // Field mapping states
  const [savedMappings, setSavedMappings] = useState<FieldMapping[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const [showSaveMappingModal, setShowSaveMappingModal] = useState(false);
  const [mappingName, setMappingName] = useState('');
  const [mappingDescription, setMappingDescription] = useState('');
  
  // Manual match modal state
  const [showManualMatchModal, setShowManualMatchModal] = useState(false);
  const [manualMatchPayment, setManualMatchPayment] = useState<any>(null);
  const [manualMatchRegistration, setManualMatchRegistration] = useState<any>(null);
  
  // Array mapping states
  const [arrayMappings, setArrayMappings] = useState<ArrayMapping[]>([]);
  
  // Separate mapping states for customer and supplier
  const [customerSelectedMappingId, setCustomerSelectedMappingId] = useState<string | null>(null);
  const [supplierSelectedMappingId, setSupplierSelectedMappingId] = useState<string | null>(null);
  const [customerArrayMappings, setCustomerArrayMappings] = useState<ArrayMapping[]>([]);
  const [supplierArrayMappings, setSupplierArrayMappings] = useState<ArrayMapping[]>([]);
  
  // Related documents state
  const [relatedDocuments, setRelatedDocuments] = useState<any>(null);
  const [loadingRelatedDocs, setLoadingRelatedDocs] = useState(false);
  
  // Registration field mapping state
  const [registrationNullFields, setRegistrationNullFields] = useState<string[]>([]);

  useEffect(() => {
    fetchCurrentPayment();
  }, [currentIndex, paymentId]);

  useEffect(() => {
    // Load saved mappings and create defaults if needed
    fieldMappingStorage.createDefaultMappings();
    const mappings = fieldMappingStorage.getAllMappings();
    setSavedMappings(mappings);
    
    // Load logo for PDF generation
    loadLogoAsBase64().then(base64 => {
      setLogoBase64(base64);
    }).catch(err => {
      console.error('Failed to load logo:', err);
    });
  }, []);
  
  // Check for registration null fields with available mappings
  useEffect(() => {
    const effectiveRegistration = selectedRegistration || currentMatch?.registration;
    const effectivePayment = selectedPayment || currentMatch?.payment;
    
    if (effectiveRegistration && effectivePayment) {
      // Get all registration mappings for this registration type
      const registrationMappings = registrationMappingStorage.getAllMappings()
        .filter(mapping => !mapping.registrationType || mapping.registrationType === effectiveRegistration.registrationType);
      
      // Check each mapping for null fields
      const nullFieldsSet = new Set<string>();
      
      registrationMappings.forEach(mapping => {
        const nullFields = registrationMappingStorage.getMappedNullFields(
          effectiveRegistration,
          mapping.id,
          effectivePayment,
          relatedDocuments
        );
        
        nullFields.forEach(field => nullFieldsSet.add(field.field));
      });
      
      setRegistrationNullFields(Array.from(nullFieldsSet));
    } else {
      setRegistrationNullFields([]);
    }
  }, [currentMatch, selectedRegistration, selectedPayment, relatedDocuments]);

  // Fetch invoice processing status when payment changes
  useEffect(() => {
    const fetchInvoiceStatus = async () => {
      const effectivePayment = selectedPayment || currentMatch?.payment;
      if (!effectivePayment?._id) return;
      
      setLoadingInvoiceStatus(true);
      try {
        const result = await apiService.searchInvoicesByPaymentId(effectivePayment._id);
        setProcessedInvoices(result.invoices || []);
      } catch (error) {
        console.error('Error fetching invoice status:', error);
        setProcessedInvoices([]);
      } finally {
        setLoadingInvoiceStatus(false);
      }
    };
    
    fetchInvoiceStatus();
  }, [selectedPayment, currentMatch]);

  const generateInvoiceNumbers = async (paymentDate: Date) => {
    try {
      const response = await fetch('/api/invoices/generate-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentDate })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Invoice generation failed:', data);
        throw new Error(data.details || 'Failed to generate invoice numbers');
      }
      
      return {
        customerInvoiceNumber: data.customerInvoiceNumber,
        supplierInvoiceNumber: data.supplierInvoiceNumber
      };
    } catch (error) {
      console.error('Error generating invoice numbers:', error);
      // Fallback to local generation if API fails
      const date = new Date(paymentDate);
      const yy = date.getFullYear().toString().slice(-2);
      const mm = (date.getMonth() + 1).toString().padStart(2, '0');
      const dd = date.getDate().toString().padStart(2, '0');
      const tempSequence = Math.floor(Math.random() * 900) + 100;
      const paddedSequence = tempSequence.toString().padStart(3, '0');
      
      return {
        customerInvoiceNumber: `LTIV-${yy}${mm}${dd}${paddedSequence}`,
        supplierInvoiceNumber: `LTSP-${yy}${mm}${dd}${paddedSequence}`
      };
    }
  };

  const fetchCurrentPayment = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Reset manual selections when moving to a new payment
      setSelectedRegistration(null);
      setSelectedPayment(null);
      
      // If we have a paymentId, fetch that specific payment
      if (paymentId) {
        // Fetch the specific payment
        const payment = await apiService.getDocument('payments', paymentId);
        
        // Try to find a registration match
        let registration = null;
        let matchConfidence = 0;
        
        if (payment) {
          // First, check if there's a registration that was manually matched to this payment
          try {
            const manualMatchQuery = { matchedPaymentId: payment._id };
            console.log('Searching for manually matched registration with query:', manualMatchQuery);
            const manualMatchData = await apiService.searchDocuments('registrations', manualMatchQuery);
            console.log('Manual match search result:', manualMatchData);
            
            // The search API returns { results: [...] } not { documents: [...] }
            const documents = manualMatchData.results || manualMatchData.documents || [];
            
            if (documents.length > 0) {
              // Found a manually matched registration
              registration = documents[0];
              matchConfidence = 100; // Manual matches have 100% confidence
              console.log('Found manually matched registration:', registration._id);
            } else {
              // No manual match found, try automatic matching
              const registrationQuery = {
                $or: [
                  { stripePaymentIntentId: payment.transactionId },
                  { stripePaymentIntentId: payment.paymentId },
                  { confirmationNumber: payment.transactionId },
                  { 'paymentInfo.transactionId': payment.transactionId },
                  { customerEmail: payment.customerEmail },
                  { email: payment.customerEmail }
                ]
              };
              
              const regData = await apiService.searchDocuments('registrations', registrationQuery);
              if (regData.documents && regData.documents.length > 0) {
                registration = regData.documents[0];
                // Simple confidence calculation
                if (payment.paymentId && registration.stripePaymentIntentId === payment.paymentId) {
                  matchConfidence = 100;
                } else if (payment.transactionId && registration.stripePaymentIntentId === payment.transactionId) {
                  matchConfidence = 100;
                } else if (payment.customerEmail === registration.customerEmail) {
                  matchConfidence = 80;
                } else {
                  matchConfidence = 50;
                }
              }
            }
          } catch (err) {
            console.error('Error fetching registration:', err);
          }
        }
        
        const match = {
          payment,
          registration,
          invoice: null,
          matchConfidence
        };
        
        setCurrentMatch(match);
        setTotal(1); // Single payment mode
        
        // Initialize customer invoice for single payment
        if (payment) {
          const fullName = payment.customerName || registration?.customerName || registration?.primaryAttendee || 'Unknown Customer';
          const nameParts = fullName.split(' ');
          
          // Generate invoice numbers based on payment date
          const paymentDate = new Date(payment.timestamp);
          const { customerInvoiceNumber, supplierInvoiceNumber } = await generateInvoiceNumbers(paymentDate);
          
          console.log('Generated invoice numbers:', { customerInvoiceNumber, supplierInvoiceNumber });
          
          const initialCustomerInvoice = {
            invoiceType: 'customer' as const,
            invoiceNumber: customerInvoiceNumber,
            paymentId: payment._id,
            registrationId: registration?._id,
            date: payment.timestamp || new Date().toISOString(),
            dueDate: payment.timestamp || new Date().toISOString(),
            status: 'paid' as const,
            supplier: DEFAULT_INVOICE_SUPPLIER,
            billTo: {
              firstName: nameParts[0] || '',
              lastName: nameParts.slice(1).join(' ') || '',
              email: payment.customerEmail || registration?.customerEmail || '',
            },
            items: [],
            subtotal: 0,
            processingFees: 0,
            total: 0,
            payment: {
              method: 'credit_card',
              transactionId: payment.transactionId,
              paidDate: payment.timestamp,
              amount: getMonetaryValue(payment.amount) || getMonetaryValue(payment.grossAmount) || 0,
              currency: 'AUD',
              status: 'completed',
              source: payment.source
            }
          };
          
          setCustomerInvoice(initialCustomerInvoice);
          setEditableInvoice(initialCustomerInvoice); // Set editable invoice to show the invoice number
          
          // Generate supplier invoice with the matching number
          if (customerInvoiceNumber) {
            const supplierInvoiceData = transformToSupplierInvoice(initialCustomerInvoice, payment);
            if (supplierInvoiceData) {
              setSupplierInvoice({
                ...supplierInvoiceData,
                invoiceNumber: supplierInvoiceNumber
              });
            }
          }
        }
      } else {
        // Fallback to index-based fetching
        const data = await apiService.getInvoiceMatches(1, currentIndex);
        
        if (data.matches.length > 0) {
          setCurrentMatch(data.matches[0]);
          
          // Initialize customer invoice when a new match is loaded
          const match = data.matches[0];
          if (match.payment && match.invoice) {
          const fullName = match.payment.customerName || match.registration?.customerName || match.registration?.primaryAttendee || 'Unknown Customer';
          const nameParts = fullName.split(' ');
          
          // Generate invoice numbers based on payment date
          const paymentDate = new Date(match.payment.timestamp);
          const { customerInvoiceNumber, supplierInvoiceNumber } = await generateInvoiceNumbers(paymentDate);
          
          const initialCustomerInvoice = {
            ...match.invoice,
            invoiceType: 'customer' as const,
            invoiceNumber: customerInvoiceNumber,
            paymentId: match.payment._id,
            registrationId: match.registration?._id,
            billTo: {
              businessName: match.registration?.businessName || '',
              businessNumber: match.registration?.businessNumber || '',
              firstName: nameParts[0] || 'Unknown',
              lastName: nameParts.slice(1).join(' ') || 'Customer',
              email: match.payment.customerEmail || match.registration?.customerEmail || 'no-email@lodgetix.io',
              addressLine1: match.registration?.addressLine1 || '',
              city: match.registration?.city || '',
              postalCode: match.registration?.postalCode || '',
              stateProvince: match.registration?.stateProvince || '',
              country: match.registration?.country || 'Australia'
            },
            items: [
              {
                description: match.registration ? 
                  `Registration for ${match.registration.functionName || 'Event'} - Confirmation: ${match.registration.confirmationNumber}` :
                  'Payment - No registration linked',
                quantity: 1,
                price: getMonetaryValue(match.payment.amount) || 0,
                total: getMonetaryValue(match.payment.amount) || 0
              }
            ],
            subtotal: getMonetaryValue(match.payment.amount) || 0,
            total: getMonetaryValue(match.payment.amount) || 0,
            payment: {
              method: 'credit_card',
              transactionId: match.payment.transactionId,
              paidDate: match.payment.timestamp,
              amount: getMonetaryValue(match.payment.amount) || 0,
              currency: 'AUD',
              status: 'completed',
              source: match.payment.source
            }
          };
          
          setCustomerInvoice(initialCustomerInvoice);
          setEditableInvoice(initialCustomerInvoice); // Set editable invoice to show the invoice number
          
          // Generate supplier invoice with the matching number
          if (customerInvoiceNumber) {
            const supplierInvoiceData = transformToSupplierInvoice(initialCustomerInvoice, match.payment);
            if (supplierInvoiceData) {
              setSupplierInvoice({
                ...supplierInvoiceData,
                invoiceNumber: supplierInvoiceNumber
              });
            }
          }
        }
        } else {
          setCurrentMatch(null);
          setCustomerInvoice(null);
          setSupplierInvoice(null);
        }
        
        setTotal(data.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const searchForRegistration = async () => {
    if (!registrationSearchQuery.trim()) return;
    
    try {
      setRegistrationSearchLoading(true);
      
      if (useRawTextSearch) {
        // Use raw text search that searches all fields
        const results = await apiService.rawTextSearch('registrations', registrationSearchQuery);
        
        // Transform results to match expected format
        const registrationResults = results.matches && results.matches.length > 0 
          ? results.matches.map((match: any) => ({
              collection: 'registrations',
              document: match.document,
              id: match.document._id,
              highlight: match.matchedFields || [],
              score: match.score || 0
            }))
          : results.documents.map((doc: any) => ({
              collection: 'registrations',
              document: doc,
              id: doc._id,
              highlight: [],
              score: 0
            }));
        
        setRegistrationSearchResults(registrationResults);
      } else {
        // Use regular indexed search
        const results = await apiService.globalSearch(registrationSearchQuery);
        
        // Filter to only show registrations
        const registrationResults = results.results.filter(
          result => result.collection === 'registrations'
        );
        
        setRegistrationSearchResults(registrationResults);
      }
    } catch (err) {
      console.error('Search error:', err);
      setRegistrationSearchResults([]);
    } finally {
      setRegistrationSearchLoading(false);
    }
  };

  const searchForPayment = async () => {
    if (!paymentSearchQuery.trim()) return;
    
    try {
      setPaymentSearchLoading(true);
      const results = await apiService.globalSearch(paymentSearchQuery);
      
      // Filter to only show payments
      const paymentResults = results.results.filter(
        result => result.collection === 'payments'
      );
      
      setPaymentSearchResults(paymentResults);
    } catch (err) {
      console.error('Search error:', err);
      setPaymentSearchResults([]);
    } finally {
      setPaymentSearchLoading(false);
    }
  };

  const handleSelectRegistration = (registration: any) => {
    // Show manual match modal instead of directly setting the registration
    setManualMatchRegistration(registration.document);
    setManualMatchPayment(effectivePayment);
    setShowManualMatchModal(true);
    setShowRegistrationSearchModal(false);
    setRegistrationSearchQuery('');
    setRegistrationSearchResults([]);
  };

  const handleSelectPayment = (payment: any) => {
    setSelectedPayment(payment.document);
    setShowPaymentSearchModal(false);
    setPaymentSearchQuery('');
    setPaymentSearchResults([]);
  };

  const handleManualMatch = async (matchCriteria: any[]) => {
    try {
      console.log('Matching payment:', manualMatchPayment._id, 'to registration:', manualMatchRegistration._id);
      
      const response = await fetch('/api/payments/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: manualMatchPayment._id,
          registrationId: manualMatchRegistration._id,
          matchCriteria: matchCriteria,
          matchedBy: 'manual',
          matchedAt: new Date().toISOString()
        }),
      });

      const responseData = await response.json();
      console.log('Match response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to match payment and registration');
      }

      // Update the local state to reflect the match
      setSelectedRegistration(manualMatchRegistration);
      
      // Update the current match object to reflect the new relationship
      if (currentMatch) {
        setCurrentMatch({
          ...currentMatch,
          registration: manualMatchRegistration,
          matchConfidence: 100,
          matchDetails: matchCriteria.map(criteria => ({
            valueType: 'manual',
            paymentField: criteria.paymentField,
            registrationPaths: [criteria.registrationField],
            value: criteria.paymentValue,
            weight: 100
          }))
        });
        
        // Generate invoice numbers based on payment date
        const paymentDate = new Date(manualMatchPayment.timestamp);
        const { customerInvoiceNumber, supplierInvoiceNumber } = await generateInvoiceNumbers(paymentDate);
        
        // Create initial customer invoice for the new match
        const initialCustomerInvoice = {
          invoiceType: 'customer' as const,
          invoiceNumber: customerInvoiceNumber,
          date: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          billTo: {
            businessName: manualMatchRegistration.organisation?.name || '',
            businessNumber: manualMatchRegistration.organisation?.abn || '',
            firstName: manualMatchRegistration.customerName || manualMatchRegistration.registrationData?.bookingContact?.firstName || '',
            lastName: manualMatchRegistration.registrationData?.bookingContact?.lastName || '',
            email: manualMatchRegistration.customerEmail || manualMatchRegistration.registrationData?.bookingContact?.email || '',
            addressLine1: manualMatchRegistration.organisation?.address || '',
            city: manualMatchRegistration.organisation?.city || '',
            postalCode: manualMatchRegistration.organisation?.postalCode || '',
            stateProvince: manualMatchRegistration.organisation?.state || '',
            country: manualMatchRegistration.organisation?.country || 'Australia'
          },
          supplier: DEFAULT_INVOICE_SUPPLIER,
          items: [
            {
              name: manualMatchRegistration.functionName || 'Event',
              description: manualMatchRegistration.confirmationNumber ? 
                `Registration for ${manualMatchRegistration.functionName || 'Event'} - Confirmation: ${manualMatchRegistration.confirmationNumber}` :
                'Payment - Registration linked',
              quantity: 1,
              price: getMonetaryValue(manualMatchPayment.amount) || 0,
              total: getMonetaryValue(manualMatchPayment.amount) || 0
            }
          ],
          subtotal: getMonetaryValue(manualMatchPayment.amount) || 0,
          total: getMonetaryValue(manualMatchPayment.amount) || 0,
          payment: {
            method: 'credit_card',
            transactionId: manualMatchPayment.transactionId,
            paidDate: manualMatchPayment.timestamp,
            amount: getMonetaryValue(manualMatchPayment.amount) || 0,
            currency: 'AUD',
            status: 'completed',
            source: manualMatchPayment.source
          }
        };
        
        setCustomerInvoice(initialCustomerInvoice);
        setEditableInvoice(initialCustomerInvoice); // Set editable invoice to show the invoice number
        
        // Generate supplier invoice with the matching number
        if (customerInvoiceNumber) {
          const supplierInvoiceData = transformToSupplierInvoice(initialCustomerInvoice, manualMatchPayment);
          if (supplierInvoiceData) {
            setSupplierInvoice({
              ...supplierInvoiceData,
              invoiceNumber: supplierInvoiceNumber
            });
          }
        }
      }
      
      alert('Payment and registration successfully matched!');
    } catch (error) {
      console.error('Failed to match:', error);
      throw error;
    }
  };

  const fetchRelatedDocuments = async (registrationId: string) => {
    try {
      setLoadingRelatedDocs(true);
      const response = await apiService.getRegistrationRelatedDocuments(registrationId);
      setRelatedDocuments(response);
    } catch (error) {
      console.error('Failed to fetch related documents:', error);
      setRelatedDocuments(null);
    } finally {
      setLoadingRelatedDocs(false);
    }
  };

  // Transform invoice data for supplier invoice
  const transformToSupplierInvoice = (customerInvoice: any, payment?: any) => {
    if (!customerInvoice) return null;
    
    // Get the appropriate supplier based on payment source
    const supplierDetails = getSupplierInvoiceSupplier(payment?.sourceFile);
    
    // Generate supplier invoice number if customer invoice has one or generate a temporary one
    let supplierInvoiceNumber = '';
    if (customerInvoice.invoiceNumber) {
      supplierInvoiceNumber = customerInvoice.invoiceNumber.replace(/^LTIV-/, 'LTSP-');
    } else {
      // Generate a temporary invoice number for preview
      const timestamp = Date.now().toString(36).toUpperCase();
      supplierInvoiceNumber = `LTSP-TEMP-${timestamp}`;
    }
    
    const supplierInvoice = {
      ...customerInvoice,
      invoiceType: 'supplier' as const,
      invoiceNumber: supplierInvoiceNumber,
      date: customerInvoice.date, // Keep the same date as customer invoice
      dueDate: customerInvoice.dueDate, // Keep the same due date
      billTo: {
        // For supplier invoices, bill to is always UGLNSW (the customer invoice supplier)
        businessName: DEFAULT_INVOICE_SUPPLIER.name,
        businessNumber: DEFAULT_INVOICE_SUPPLIER.abn,
        firstName: '', 
        lastName: '',
        email: '', 
        addressLine1: DEFAULT_INVOICE_SUPPLIER.address,
        city: 'Sydney',
        postalCode: '2000',
        stateProvince: 'NSW',
        country: 'Australia'
      },
      supplier: supplierDetails, // LodgeTix as the supplier
      items: [], // Start with empty array - supplier items will be added separately
      processingFees: 0, // No additional fees on supplier invoice
      subtotal: 0, // Will be recalculated based on supplier items
      total: 0 // Will be recalculated based on supplier items
    };
    
    return supplierInvoice;
  };
  
  // Calculate software utilization fee (customize as needed)
  const calculateSoftwareUtilizationFee = (invoice: any) => {
    // Example: 2% of invoice total
    return (invoice.total || 0) * 0.02;
  };

  const handleApprove = async () => {
    const paymentToUse = selectedPayment || currentMatch?.payment;
    if (!paymentToUse) return;
    
    try {
      setProcessing(true);
      
      // Use selected registration if manually chosen, otherwise use the matched one
      const registrationToUse = selectedRegistration || currentMatch?.registration;
      
      // Update the invoice with the correct registration details
      // Check if billTo has the new format (with firstName/lastName) or old format (with name)
      const hasNewBillToFormat = currentMatch!.invoice.billTo && 'firstName' in currentMatch!.invoice.billTo;
      
      const invoiceToCreate = {
        ...currentMatch!.invoice,
        paymentId: paymentToUse._id?.toString(),
        registrationId: registrationToUse?._id?.toString(),
        // Only override billTo if it's using the old format
        ...(hasNewBillToFormat ? {} : {
          billTo: {
            businessName: registrationToUse?.businessName || '',
            businessNumber: registrationToUse?.businessNumber || '',
            firstName: (() => {
              const fullName = paymentToUse.customerName || registrationToUse?.customerName || registrationToUse?.primaryAttendee || 'Unknown Customer';
              const nameParts = fullName.split(' ');
              return nameParts[0] || 'Unknown';
            })(),
            lastName: (() => {
              const fullName = paymentToUse.customerName || registrationToUse?.customerName || registrationToUse?.primaryAttendee || 'Unknown Customer';
              const nameParts = fullName.split(' ');
              return nameParts.slice(1).join(' ') || 'Customer';
            })(),
            email: paymentToUse.customerEmail || registrationToUse?.customerEmail || 'no-email@lodgetix.io',
            addressLine1: registrationToUse?.addressLine1 || '',
            city: registrationToUse?.city || '',
            postalCode: registrationToUse?.postalCode || '',
            stateProvince: registrationToUse?.stateProvince || '',
            country: registrationToUse?.country || 'Australia'
          }
        }),
        items: [
          {
            description: registrationToUse ? 
              `Registration for ${registrationToUse.functionName || 'Event'} - Confirmation: ${registrationToUse.confirmationNumber}` :
              'Payment - No registration linked',
            quantity: 1,
            price: getMonetaryValue(paymentToUse.amount) || 0,
            total: getMonetaryValue(paymentToUse.amount) || 0
          }
        ],
        subtotal: getMonetaryValue(paymentToUse.amount) || 0,
        total: getMonetaryValue(paymentToUse.amount) || 0,
        payment: {
          method: 'credit_card',
          transactionId: paymentToUse.transactionId,
          paidDate: paymentToUse.timestamp,
          amount: getMonetaryValue(paymentToUse.amount) || 0,
          currency: 'AUD',
          status: 'completed',
          source: paymentToUse.source
        }
      };
      
      // Create customer invoice
      const customerResult = await apiService.createInvoice({
        payment: paymentToUse,
        registration: registrationToUse,
        invoice: { ...invoiceToCreate, invoiceType: 'customer' }
      });
      
      // Create supplier invoice if we have both customer and supplier data
      if (customerInvoice && supplierInvoice) {
        const supplierToCreate = {
          ...supplierInvoice,
          paymentId: paymentToUse._id?.toString(),
          registrationId: registrationToUse?._id?.toString(),
          relatedInvoiceId: customerResult._id // Link to customer invoice
        };
        
        const supplierResult = await apiService.createInvoice({
          payment: paymentToUse,
          registration: registrationToUse,
          invoice: supplierToCreate
        });
        
        alert(`Invoices created successfully!\nCustomer Invoice: ${customerResult.invoiceNumber}\nSupplier Invoice: ${supplierResult.invoiceNumber}`);
      } else {
        alert(`Invoice created successfully! Invoice Number: ${customerResult.invoiceNumber}`);
      }
      
      // Move to next payment
      if (currentIndex < total - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        alert('All payments processed!');
      }
    } catch (err) {
      alert('Failed to create invoice: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleDecline = () => {
    setShowDeclineModal(true);
  };

  const handleRegistrationUpdate = async (updatedRegistration: any) => {
    try {
      const registrationId = (selectedRegistration || currentMatch?.registration)?._id;
      if (!registrationId) return;
      
      await apiService.updateRegistration(registrationId, updatedRegistration);
      
      // Update the local state with the new registration data
      if (selectedRegistration) {
        setSelectedRegistration(updatedRegistration);
      } else if (currentMatch) {
        setCurrentMatch({
          ...currentMatch,
          registration: updatedRegistration
        });
      }
      
      alert('Registration updated successfully!');
    } catch (error) {
      throw error; // Let the modal handle the error
    }
  };

  const confirmDecline = async () => {
    const paymentToUse = selectedPayment || currentMatch?.payment;
    const registrationToUse = selectedRegistration || currentMatch?.registration;
    
    if (!paymentToUse) return;
    
    const declineData = {
      timestamp: new Date().toISOString(),
      paymentId: paymentToUse._id,
      registrationId: registrationToUse?._id,
      declineReason: declineComments,
      payment: paymentToUse,
      registration: registrationToUse
    };
    
    // Create a blob and download link
    const blob = new Blob([JSON.stringify(declineData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `declined-invoice-${today}-${paymentToUse._id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Close modal and move to next
    setShowDeclineModal(false);
    setDeclineComments('');
    
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading payment...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    );
  }

  if (!currentMatch) {
    return (
      <main className="mx-auto px-4 py-8 w-[80%]">
        <div className="mb-6">
          <Link href="/" className="text-blue-500 hover:underline">
            ← Back to Home
          </Link>
        </div>
        <div className="text-center text-gray-600 py-12">
          <h2 className="text-2xl font-semibold mb-4">All payments have been processed!</h2>
          <p>There are no more payments requiring invoice creation.</p>
        </div>
      </main>
    );
  }

  const effectivePayment = selectedPayment || currentMatch.payment;
  const effectiveRegistration = selectedRegistration || currentMatch.registration;
  const hasRegistration = !!effectiveRegistration;
  const hasPaymentOverride = !!selectedPayment;
  const hasRegistrationOverride = !!selectedRegistration;
  
  // Helper function to handle field mapping changes in the modal
  const handleFieldMappingChange = (fieldPath: string, source: string | null, customValue?: any) => {
    // Update the mapping configuration
    setFieldMappingConfig(prev => ({
      ...prev,
      [fieldPath]: { source, customValue }
    }));
    
    // Also update the type-specific mapping config
    if (activeInvoiceType === 'customer') {
      setCustomerFieldMappingConfig(prev => ({
        ...prev,
        [fieldPath]: { source, customValue }
      }));
    } else {
      setSupplierFieldMappingConfig(prev => ({
        ...prev,
        [fieldPath]: { source, customValue }
      }));
    }
    
    // Update the invoice value
    let value = customValue;
    if (customValue === undefined && source) {
      // Remove the source prefix from the path
      const cleanPath = source.replace(/^(payment|registration|related)\./, '');
      const sourceData = source.startsWith('payment') ? effectivePayment : 
                        source.startsWith('registration') ? effectiveRegistration :
                        source.startsWith('related') ? relatedDocuments : null;
      value = sourceData ? getValueByPath(sourceData, cleanPath) : null;
    }
    
    // Handle nested paths
    const pathParts = fieldPath.split('.');
    if (pathParts.length > 1) {
      const newInvoice = { ...editableInvoice };
      let current = newInvoice;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) {
          current[pathParts[i]] = {};
        }
        current = current[pathParts[i]];
      }
      
      current[pathParts[pathParts.length - 1]] = value;
      setEditableInvoice(newInvoice);
      
      // Save to type-specific state
      if (activeInvoiceType === 'customer') {
        setCustomerInvoice(newInvoice);
      } else {
        setSupplierInvoice(newInvoice);
      }
    } else {
      const updatedInvoice = { ...editableInvoice, [fieldPath]: value };
      setEditableInvoice(updatedInvoice);
      
      // Save to type-specific state
      if (activeInvoiceType === 'customer') {
        setCustomerInvoice(updatedInvoice);
      } else {
        setSupplierInvoice(updatedInvoice);
      }
    }
    
    // Auto-calculate processing fees if subtotal or total changes
    if (fieldPath === 'subtotal' || fieldPath === 'total') {
      const currentInvoice = editableInvoice;
      const subtotal = fieldPath === 'subtotal' ? value : (currentInvoice.subtotal || 0);
      const total = fieldPath === 'total' ? value : (currentInvoice.total || 0);
      
      // Ensure both values are numbers, handling currency symbols
      const parseCurrency = (value: any): number => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          // Remove currency symbols and commas
          const cleanValue = value.replace(/[$,]/g, '').trim();
          return parseFloat(cleanValue) || 0;
        }
        return 0;
      };
      
      const subtotalNum = parseCurrency(subtotal);
      const totalNum = parseCurrency(total);
      
      // Calculate processing fees as total - subtotal, rounded to 2 decimal places
      const processingFees = Math.round((totalNum - subtotalNum) * 100) / 100;
      
      // Update the invoice with calculated processing fees
      const invoiceWithFees = {
        ...editableInvoice,
        [fieldPath]: value,
        processingFees: processingFees
      };
      
      setEditableInvoice(invoiceWithFees);
      
      // Save to type-specific state
      if (activeInvoiceType === 'customer') {
        setCustomerInvoice(invoiceWithFees);
      } else {
        setSupplierInvoice(invoiceWithFees);
      }
      
      // Update the processing fees field mapping config to show it was auto-calculated
      setFieldMappingConfig(prev => ({
        ...prev,
        processingFees: { 
          source: null, 
          customValue: processingFees,
          isCalculated: true,
          formula: 'total - subtotal'
        }
      }));
    }
  };
  
  // Get highlight fields from match details
  const getHighlightFields = () => {
    if (!currentMatch?.matchDetails || hasPaymentOverride || hasRegistrationOverride) {
      return { paymentFields: [], registrationFields: [] };
    }
    
    const paymentFields: string[] = [];
    const registrationFields: string[] = [];
    
    for (const detail of currentMatch.matchDetails) {
      paymentFields.push(detail.paymentField);
      registrationFields.push(...detail.registrationPaths);
    }
    
    // Debug logging
    if (paymentFields.length > 0 || registrationFields.length > 0) {
      console.log('Match Details:', currentMatch.matchDetails);
      console.log('Highlight Payment Fields:', paymentFields);
      console.log('Highlight Registration Fields:', registrationFields);
    }
    
    return { 
      paymentFields: [...new Set(paymentFields)],
      registrationFields: [...new Set(registrationFields)]
    };
  };
  
  const { paymentFields: highlightPaymentFields, registrationFields: highlightRegistrationFields } = getHighlightFields();

  return (
    <main className="mx-auto px-4 py-8 w-[80%]">
      <div className="mb-6">
        <Link href="/" className="text-blue-500 hover:underline">
          ← Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-800 mb-4">
        Process Payment to Invoice
      </h1>

      {/* Progress Bar */}
      <div className="bg-blue-500 text-white p-4 rounded-lg mb-6">
        <div className="flex justify-between items-center">
          <span className="font-semibold">
            Payment {currentIndex + 1} of {total}
          </span>
          <div className="flex items-center gap-4">
            <div className="w-64 bg-blue-700 rounded-full h-2">
              <div 
                className="bg-white h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
              />
            </div>
            <span>{Math.round(((currentIndex + 1) / total) * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0 || processing}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        
        <div className="flex gap-2">
          <button
            onClick={handleSkip}
            disabled={processing}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:bg-gray-300"
          >
            Skip →
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="border border-gray-300 rounded-lg overflow-hidden mb-6">
        {/* Match Confidence Header */}
        <div className="bg-gray-100 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="font-semibold">
              Payment ID: {effectivePayment._id}
            </span>
            <span className={`px-3 py-1 rounded text-sm ${
              hasRegistration ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-800'
            }`}>
              {hasRegistration ? 
                (hasRegistrationOverride ? 'Manual Match' : `${currentMatch.matchConfidence}% Match`) : 
                'No Match Found'}
            </span>
            {(hasPaymentOverride || hasRegistrationOverride) && (
              <span className="px-3 py-1 rounded text-sm bg-purple-100 text-purple-800">
                Manual Override Active
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600">
            {new Date(effectivePayment.timestamp).toLocaleDateString()}
          </div>
        </div>

        {/* Match Details */}
        {currentMatch.matchDetails && currentMatch.matchDetails.length > 0 && !hasPaymentOverride && !hasRegistrationOverride && (
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
            <div className="text-sm">
              <span className="font-semibold text-gray-700">Matched Fields (Total Confidence: {currentMatch.matchConfidence}%):</span>
              <div className="mt-2 space-y-1">
                {currentMatch.matchDetails.map((detail, index) => (
                  <div key={index} className="flex items-start gap-2 text-green-700">
                    <span className="font-mono text-xs min-w-[120px]">{detail.valueType} (+{detail.weight}%):</span>
                    <div className="flex-1">
                      <span className="text-xs font-semibold">{detail.value}</span>
                      <div className="text-xs text-gray-600">
                        Payment: {detail.paymentField} → Registration: {detail.registrationPaths.join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Invoice Processing Status */}
        {(loadingInvoiceStatus || processedInvoices.length > 0) && (
          <div className="bg-blue-50 px-4 py-3 border-b border-gray-300">
            <div className="text-sm">
              <span className="font-semibold text-gray-700">Invoice Processing Status:</span>
              {loadingInvoiceStatus ? (
                <div className="mt-2 text-gray-600">Loading invoice status...</div>
              ) : processedInvoices.length > 0 ? (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 text-green-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold">Payment has been processed</span>
                  </div>
                  {processedInvoices.map((invoice, index) => (
                    <div key={index} className="ml-7 space-y-1 text-xs">
                      <div className="flex items-center gap-4">
                        <span className="text-gray-600">Invoice #:</span>
                        <span className="font-mono font-semibold">{invoice.invoiceNumber}</span>
                        <span className="text-gray-600">Type:</span>
                        <span className="font-semibold capitalize">{invoice.invoiceType}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-600">Date:</span>
                        <span>{new Date(invoice.date).toLocaleDateString()}</span>
                        <span className="text-gray-600">Total:</span>
                        <span className="font-semibold">{formatMoney(invoice.total)}</span>
                      </div>
                      {invoice.billTo && (
                        <div className="flex items-center gap-4">
                          <span className="text-gray-600">Billed to:</span>
                          <span>{invoice.billTo.businessName || `${invoice.billTo.firstName} ${invoice.billTo.lastName}`}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2 text-amber-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Payment not yet processed - no invoice created</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3-column layout */}
        <div className="grid grid-cols-3 divide-x divide-gray-300">
          {/* Payment Column */}
          <div className="p-4">
            <div className="mb-2 flex justify-between items-center">
              <div className="flex items-center gap-2">
                {hasPaymentOverride && (
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Override</span>
                )}
              </div>
              <button
                onClick={() => setShowPaymentSearchModal(true)}
                className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Search Payments
              </button>
            </div>
            <JsonViewerWithHighlight 
              data={effectivePayment} 
              title={hasPaymentOverride ? "Selected Payment" : "Current Payment"} 
              maxHeight="max-h-[900px]"
              highlightPaths={hasPaymentOverride ? [] : highlightPaymentFields}
              highlightColor="bg-yellow-200"
            />
            {hasPaymentOverride && (
              <button
                onClick={() => setSelectedPayment(null)}
                className="mt-2 text-sm text-red-600 hover:underline"
              >
                Clear payment override
              </button>
            )}
          </div>

          {/* Registration Column */}
          <div className="p-4">
            <div className="mb-2 flex justify-between items-center">
              <div>
                {effectiveRegistration && (
                  <button
                    onClick={() => setShowRelatedDocuments(!showRelatedDocuments)}
                    className="text-sm px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    {showRelatedDocuments ? 'Hide' : 'Show'} Related Docs
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {effectiveRegistration && !effectiveRegistration.confirmationNumber && (
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/registrations/${effectiveRegistration._id}/confirmation-number`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            registrationType: effectiveRegistration.registrationType
                          })
                        });
                        
                        if (!response.ok) {
                          throw new Error('Failed to generate confirmation number');
                        }
                        
                        const data = await response.json();
                        
                        // Update local state
                        const updatedRegistration = {
                          ...effectiveRegistration,
                          confirmationNumber: data.confirmationNumber
                        };
                        
                        if (selectedRegistration) {
                          setSelectedRegistration(updatedRegistration);
                        } else if (currentMatch) {
                          setCurrentMatch({
                            ...currentMatch,
                            registration: updatedRegistration
                          });
                        }
                        
                        alert(`Confirmation number generated: ${data.confirmationNumber}`);
                      } catch (error) {
                        alert('Failed to generate confirmation number: ' + (error as Error).message);
                      }
                    }}
                    className="text-sm px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Generate Confirmation #
                  </button>
                )}
                {effectiveRegistration && (
                  <button
                    onClick={() => setShowRegistrationEditModal(true)}
                    className={`text-sm px-3 py-1 rounded ${
                      registrationNullFields.length > 0 
                        ? 'bg-red-500 text-white hover:bg-red-600 ring-2 ring-red-300 animate-pulse' 
                        : 'bg-purple-500 text-white hover:bg-purple-600'
                    }`}
                  >
                    Form Editor {registrationNullFields.length > 0 && `(${registrationNullFields.length})`}
                  </button>
                )}
                <button
                  onClick={() => setShowRegistrationSearchModal(true)}
                  className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Search Registrations
                </button>
              </div>
            </div>
            {effectiveRegistration ? (
              <div>
                {effectiveRegistration.confirmationNumber && (
                  <div className="mb-2 bg-green-50 border border-green-200 rounded px-3 py-2 text-sm">
                    <span className="font-medium text-green-800">Confirmation Number: </span>
                    <span className="font-mono text-green-900">{effectiveRegistration.confirmationNumber}</span>
                  </div>
                )}
                {registrationNullFields.length > 0 && (
                  <div className="mb-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm">
                    <span className="font-medium text-red-800">Missing Fields: </span>
                    <span className="text-red-700">
                      {registrationNullFields.length} field{registrationNullFields.length !== 1 ? 's' : ''} can be auto-filled from mapped data. 
                      Click Form Editor to review.
                    </span>
                  </div>
                )}
                <EditableJsonViewer 
                  data={effectiveRegistration} 
                  title={hasRegistrationOverride ? "Selected Registration" : "Matched Registration"} 
                  maxHeight="max-h-[900px]"
                  highlightPaths={hasRegistrationOverride ? [] : highlightRegistrationFields}
                  onChange={async (newData) => {
                    try {
                      // Update the registration in the database
                      await apiService.updateRegistration(effectiveRegistration._id, newData);
                      
                      // Update local state
                      if (selectedRegistration) {
                        setSelectedRegistration(newData);
                      } else if (currentMatch) {
                        setCurrentMatch({
                          ...currentMatch,
                          registration: newData
                        });
                      }
                      
                      alert('Registration updated successfully!');
                    } catch (error) {
                      alert('Failed to update registration: ' + (error as Error).message);
                      // Revert by re-fetching if needed
                      fetchCurrentPayment();
                    }
                  }}
                />
                {hasRegistrationOverride && (
                  <button
                    onClick={() => setSelectedRegistration(null)}
                    className="mt-2 text-sm text-red-600 hover:underline"
                  >
                    Clear registration override
                  </button>
                )}
                {showRelatedDocuments && (
                  <div className="mt-4">
                    <RelatedDocuments 
                      registrationId={effectiveRegistration._id}
                      onFieldSelect={(path, value) => {
                        console.log('Selected field from related document:', path, value);
                        // You can use this to populate invoice fields if needed
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg">
                <div className="bg-gray-100 px-3 py-2">
                  <h3 className="font-semibold text-gray-700">Registration</h3>
                </div>
                <div className="bg-red-50 p-4">
                  <p className="text-red-600 mb-4">No matching registration found</p>
                  <button
                    onClick={() => setShowRegistrationSearchModal(true)}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Search for Registration
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Invoice Preview Column */}
          <div className="p-4 flex flex-col h-full">
            <div className="mb-2 flex flex-col items-end gap-2">
              {savedMappings.length > 0 && (
                <select
                  value={selectedMappingId || ''}
                  onChange={(e) => setSelectedMappingId(e.target.value || null)}
                  className="text-sm px-3 py-1 border rounded"
                >
                  <option value="">Select a mapping template...</option>
                  {savedMappings.map(mapping => (
                    <option key={mapping.id} value={mapping.id}>
                      {mapping.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => {
                  console.log('Preview button clicked. customerInvoice:', customerInvoice);
                  console.log('supplierInvoice:', supplierInvoice);
                  
                  // If we already have invoices, use them
                  if (customerInvoice) {
                    setEditableInvoice(customerInvoice);
                    setActiveInvoiceType('customer');
                    setShowInvoicePreviewModal(true);
                    
                    // Fetch related documents if we have a registration
                    if (effectiveRegistration?._id) {
                      fetchRelatedDocuments(effectiveRegistration._id);
                    }
                    return;
                  }
                  
                  // Otherwise, create new invoices
                  // Extract name parts from payment or registration
                  const fullName = effectivePayment.customerName || effectiveRegistration?.customerName || effectiveRegistration?.primaryAttendee || 'Unknown Customer';
                  const nameParts = fullName.split(' ');
                  const firstName = nameParts[0] || 'Unknown';
                  const lastName = nameParts.slice(1).join(' ') || 'Customer';
                  
                  // Apply selected mapping if one is chosen
                  let invoiceData = {
                    ...currentMatch.invoice,
                    paymentId: effectivePayment._id,
                    registrationId: effectiveRegistration?._id,
                  };
                  
                  if (selectedMappingId) {
                    // Apply the selected mapping
                    const mappedData = fieldMappingStorage.applyMapping(
                      selectedMappingId,
                      effectivePayment,
                      effectiveRegistration
                    );
                    invoiceData = { ...invoiceData, ...mappedData };
                    
                    // Load array mappings and line item mappings if present
                    const selectedMapping = savedMappings.find(m => m.id === selectedMappingId);
                    if (selectedMapping) {
                      // Set field mapping config including line items
                      const fullConfig = {
                        ...selectedMapping.mappings,
                        lineItems: selectedMapping.lineItems
                      };
                      setFieldMappingConfig(fullConfig);
                      setCustomerFieldMappingConfig(fullConfig);
                      
                      // Load array mappings
                      if (selectedMapping.arrayMappings) {
                        setArrayMappings(selectedMapping.arrayMappings);
                        setCustomerArrayMappings(selectedMapping.arrayMappings);
                      }
                    }
                  } else {
                    // Use default mapping - clear any previous template data
                    setFieldMappingConfig({});
                    setCustomerFieldMappingConfig({});
                    setArrayMappings([]);
                    setCustomerArrayMappings([]);
                    
                    invoiceData.billTo = {
                      businessName: effectiveRegistration?.businessName || '',
                      businessNumber: effectiveRegistration?.businessNumber || '',
                      firstName: firstName,
                      lastName: lastName,
                      email: effectivePayment.customerEmail || effectiveRegistration?.customerEmail || 'no-email@lodgetix.io',
                      addressLine1: effectiveRegistration?.addressLine1 || '',
                      city: effectiveRegistration?.city || '',
                      postalCode: effectiveRegistration?.postalCode || '',
                      stateProvince: effectiveRegistration?.stateProvince || '',
                      country: effectiveRegistration?.country || 'Australia'
                    };
                  }
                  
                  const invoice = {
                    ...invoiceData,
                    supplier: DEFAULT_INVOICE_SUPPLIER,
                    status: 'paid', // Add default status
                    date: new Date().toISOString(),
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    invoiceNumber: customerInvoice?.invoiceNumber || invoiceData.invoiceNumber || '[To be assigned]',
                    processingFees: 0,
                    items: [
                      {
                        description: effectiveRegistration ? 
                          `Registration for ${effectiveRegistration.functionName || 'Event'} - Confirmation: ${effectiveRegistration.confirmationNumber}` :
                          'Payment - No registration linked',
                        quantity: 1,
                        price: getMonetaryValue(effectivePayment.amount) || 0,
                        total: getMonetaryValue(effectivePayment.amount) || 0
                      }
                    ],
                    subtotal: getMonetaryValue(effectivePayment.amount) || 0,
                    total: getMonetaryValue(effectivePayment.amount) || 0,
                    payment: {
                      method: effectivePayment.paymentMethod || 'credit_card',
                      transactionId: effectivePayment.transactionId || effectivePayment.paymentId || '',
                      paidDate: effectivePayment.timestamp || effectivePayment.createdAt || new Date().toISOString(),
                      amount: getMonetaryValue(effectivePayment.amount) || 0,
                      currency: 'AUD',
                      status: 'completed',
                      source: effectivePayment.source || 'unknown'
                    }
                  };
                  // Set up customer invoice
                  const customerInvoiceData = { ...invoice, invoiceType: 'customer' as const };
                  setEditableInvoice(customerInvoiceData);
                  setCustomerInvoice(customerInvoiceData);
                  setFieldMappings({});
                  setFieldMappingConfig({});
                  setCustomerFieldMappingConfig({});
                  setActiveInvoiceType('customer');
                  
                  // Auto-select appropriate mapping based on payment source and registration type
                  if (!selectedMappingId && effectivePayment && effectiveRegistration) {
                    const paymentSource = effectivePayment.source; // 'stripe' or 'square'
                    const registrationType = effectiveRegistration.registrationType; // 'individuals', 'lodge', 'delegation'
                    
                    // Find matching mapping
                    const autoMapping = savedMappings.find(mapping => {
                      const mappingName = mapping.name.toLowerCase();
                      const hasCorrectSource = mappingName.includes(paymentSource?.toLowerCase() || '');
                      const hasCorrectType = registrationType && (
                        (registrationType === 'individuals' && mappingName.includes('individuals')) ||
                        (registrationType === 'lodge' && mappingName.includes('lodge')) ||
                        (registrationType === 'delegation' && mappingName.includes('delegation'))
                      );
                      return hasCorrectSource && hasCorrectType;
                    });
                    
                    if (autoMapping) {
                      setSelectedMappingId(autoMapping.id);
                      setCustomerSelectedMappingId(autoMapping.id); // Save for customer specifically
                      // Apply the mapping to the initial invoice
                      const mappedData = fieldMappingStorage.applyMapping(
                        autoMapping.id,
                        effectivePayment,
                        effectiveRegistration,
                        relatedDocuments
                      );
                      const customerInvoiceWithMapping = { ...customerInvoiceData, ...mappedData };
                      setEditableInvoice(customerInvoiceWithMapping);
                      setCustomerInvoice(customerInvoiceWithMapping);
                      // Store the mapping configuration including line items
                      const fullConfig = {
                        ...autoMapping.mappings,
                        lineItems: autoMapping.lineItems
                      };
                      setFieldMappingConfig(fullConfig);
                      setCustomerFieldMappingConfig(fullConfig);
                      
                      // Load array mappings if present
                      if (autoMapping.arrayMappings) {
                        setArrayMappings(autoMapping.arrayMappings);
                        setCustomerArrayMappings(autoMapping.arrayMappings); // Save for customer specifically
                      }
                    }
                  }
                  
                  setShowInvoicePreviewModal(true);
                  
                  // Fetch related documents if we have a registration
                  if (effectiveRegistration?._id) {
                    fetchRelatedDocuments(effectiveRegistration._id);
                  }
                }}
                className="text-sm px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                Preview Rendered Invoice
              </button>
            </div>
            <div className="flex-1 max-h-[900px] overflow-y-auto space-y-4">
              {/* Customer Invoice Preview */}
              {(() => {
                const fullName = effectivePayment.customerName || effectiveRegistration?.customerName || effectiveRegistration?.primaryAttendee || 'Unknown Customer';
                const nameParts = fullName.split(' ');
                const defaultCustomerInvoice = {
                  ...currentMatch.invoice,
                  invoiceType: 'customer',
                  paymentId: effectivePayment._id,
                  registrationId: effectiveRegistration?._id,
                  billTo: {
                    businessName: effectiveRegistration?.businessName || '',
                    businessNumber: effectiveRegistration?.businessNumber || '',
                    firstName: nameParts[0] || 'Unknown',
                    lastName: nameParts.slice(1).join(' ') || 'Customer',
                    email: effectivePayment.customerEmail || effectiveRegistration?.customerEmail || 'no-email@lodgetix.io',
                    addressLine1: effectiveRegistration?.addressLine1 || '',
                    city: effectiveRegistration?.city || '',
                    postalCode: effectiveRegistration?.postalCode || '',
                    stateProvince: effectiveRegistration?.stateProvince || '',
                    country: effectiveRegistration?.country || 'Australia'
                  },
                  items: [
                    {
                      description: effectiveRegistration ? 
                        `Registration for ${effectiveRegistration.functionName || 'Event'} - Confirmation: ${effectiveRegistration.confirmationNumber}` :
                        'Payment - No registration linked',
                      quantity: 1,
                      price: effectivePayment.amount || 0,
                      total: effectivePayment.amount || 0
                    }
                  ],
                  subtotal: effectivePayment.amount || 0,
                  total: effectivePayment.amount || 0,
                  payment: {
                    method: 'credit_card',
                    transactionId: effectivePayment.transactionId,
                    paidDate: effectivePayment.timestamp,
                    amount: effectivePayment.amount || 0,
                    currency: 'AUD',
                    status: 'completed',
                    source: effectivePayment.source
                  }
                };
                
                return (
                  <JsonViewer 
                    data={customerInvoice || defaultCustomerInvoice} 
                    title="Customer Invoice Preview" 
                  />
                );
              })()}

              {/* Supplier Invoice Preview */}
              {(() => {
                // Create default supplier invoice if not already created
                const defaultSupplierInvoice = customerInvoice ? transformToSupplierInvoice(customerInvoice, effectivePayment) : null;
                
                if (defaultSupplierInvoice && (!defaultSupplierInvoice.items || defaultSupplierInvoice.items.length === 0)) {
                  defaultSupplierInvoice.items = [
                    {
                      description: 'Payment Processing Fee Reimbursement',
                      quantity: 1,
                      price: effectivePayment?.fees || 0
                    },
                    {
                      description: 'Software Utilization Fee',
                      quantity: 1,
                      price: calculateSoftwareUtilizationFee({ total: effectivePayment?.amount || 0 })
                    }
                  ];
                  const subtotal = defaultSupplierInvoice.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                  defaultSupplierInvoice.subtotal = subtotal;
                  defaultSupplierInvoice.total = subtotal;
                }
                
                return (supplierInvoice || defaultSupplierInvoice) ? (
                  <JsonViewer 
                    data={supplierInvoice || defaultSupplierInvoice} 
                    title="Supplier Invoice Preview" 
                  />
                ) : null;
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <button
          onClick={handleApprove}
          disabled={processing}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
        >
          {processing ? 'Creating Invoice...' : 'Create Invoice'}
        </button>
        <button
          onClick={handleDecline}
          disabled={processing}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-semibold"
        >
          Decline & Log
        </button>
      </div>

      {/* Registration Search Modal */}
      {showRegistrationSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <h3 className="text-lg font-semibold mb-4">Search for Registration</h3>
            
            <div className="mb-4">
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={registrationSearchQuery}
                  onChange={(e) => setRegistrationSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchForRegistration()}
                  placeholder="Search by confirmation number, email, name..."
                  className="flex-1 p-2 border rounded"
                  autoFocus
                />
                <button
                  onClick={searchForRegistration}
                  disabled={registrationSearchLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                  {registrationSearchLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rawTextSearch"
                  checked={useRawTextSearch}
                  onChange={(e) => setUseRawTextSearch(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="rawTextSearch" className="text-sm text-gray-700 cursor-pointer">
                  Use raw text search (searches all fields, useful for corrupted data)
                </label>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[50vh] mb-4">
              {registrationSearchResults.length > 0 ? (
                <div className="space-y-2">
                  {registrationSearchResults.map((result, index) => (
                    <div 
                      key={index}
                      className="border rounded p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleSelectRegistration(result)}
                    >
                      <div className="font-semibold">
                        {result.document.confirmationNumber || 'No confirmation number'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {result.document.customerName || result.document.primaryAttendee || 'Unknown'} - 
                        {result.document.customerEmail || 'No email'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {result.document.functionName || 'Unknown event'} - 
                        Amount: {formatMoney(result.document.totalAmountPaid || result.document.totalAmount)}
                      </div>
                      {useRawTextSearch && result.highlight && result.highlight.length > 0 && (
                        <div className="mt-2 text-xs bg-yellow-50 p-2 rounded">
                          <div className="font-medium text-yellow-800 mb-1">Matched in {result.highlight.length} field(s):</div>
                          {result.highlight.slice(0, 3).map((match: any, idx: number) => (
                            <div key={idx} className="text-yellow-700">
                              <span className="font-medium">{match.field}:</span> {match.snippet}
                            </div>
                          ))}
                          {result.highlight.length > 3 && (
                            <div className="text-yellow-600 italic">...and {result.highlight.length - 3} more</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : registrationSearchQuery && !registrationSearchLoading ? (
                <p className="text-gray-500 text-center py-4">No registrations found</p>
              ) : null}
            </div>

            <button
              onClick={() => {
                setShowRegistrationSearchModal(false);
                setRegistrationSearchQuery('');
                setRegistrationSearchResults([]);
              }}
              className="w-full border px-4 py-2 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Payment Search Modal */}
      {showPaymentSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <h3 className="text-lg font-semibold mb-4">Search for Payment</h3>
            
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={paymentSearchQuery}
                onChange={(e) => setPaymentSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchForPayment()}
                placeholder="Search by payment ID, email, amount..."
                className="flex-1 p-2 border rounded"
                autoFocus
              />
              <button
                onClick={searchForPayment}
                disabled={paymentSearchLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
              >
                {paymentSearchLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            <div className="overflow-y-auto max-h-[50vh] mb-4">
              {paymentSearchResults.length > 0 ? (
                <div className="space-y-2">
                  {paymentSearchResults.map((result, index) => (
                    <div 
                      key={index}
                      className="border rounded p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleSelectPayment(result)}
                    >
                      <div className="font-semibold">
                        Payment: {result.document.transactionId || result.document.paymentId || 'No ID'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {result.document.customerName || result.document.customerEmail || 'Unknown'} - 
                        {formatMoney(result.document.amount)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(result.document.timestamp).toLocaleDateString()} - 
                        {result.document.source || 'Unknown source'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : paymentSearchQuery && !paymentSearchLoading ? (
                <p className="text-gray-500 text-center py-4">No payments found</p>
              ) : null}
            </div>

            <button
              onClick={() => {
                setShowPaymentSearchModal(false);
                setPaymentSearchQuery('');
                setPaymentSearchResults([]);
              }}
              className="w-full border px-4 py-2 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Decline Invoice</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for declining this invoice.
            </p>
            <textarea
              value={declineComments}
              onChange={(e) => setDeclineComments(e.target.value)}
              placeholder="Enter decline reason..."
              className="w-full p-3 border rounded-lg mb-4"
              rows={4}
            />
            <div className="flex gap-2">
              <button
                onClick={confirmDecline}
                disabled={!declineComments.trim()}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                Confirm Decline
              </button>
              <button
                onClick={() => {
                  setShowDeclineModal(false);
                  setDeclineComments('');
                }}
                className="flex-1 border px-4 py-2 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {showInvoicePreviewModal && editableInvoice && (() => {
        // Compute all field options including related documents
        const allFieldOptions = [
          ...extractAllFieldOptions(effectivePayment, effectiveRegistration),
          ...(relatedDocuments ? extractRelatedDocumentFields(relatedDocuments) : [])
        ];
        
        // Create sourceDocuments object for FieldMappingSelector
        const sourceDocuments = {
          registrations: effectiveRegistration,
          payments: effectivePayment,
          ...(relatedDocuments || {})
        };
        
        return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg h-[90vh] flex flex-col" style={{ width: 'fit-content' }}>
            {/* Invoice Type Toggle */}
            <div className="p-4 border-b bg-gray-50">
              <div className="flex justify-center space-x-1 bg-white rounded-lg p-1 w-fit mx-auto">
                <button
                  onClick={() => {
                    setActiveInvoiceType('customer');
                    if (customerInvoice) {
                      let invoiceToSet = customerInvoice;
                      
                      // If there's a saved mapping, reapply it to hydrate field values
                      if (customerSelectedMappingId) {
                        const mapping = fieldMappingStorage.getMapping(customerSelectedMappingId);
                        if (mapping) {
                          const mappedData = fieldMappingStorage.applyMapping(
                            customerSelectedMappingId,
                            effectivePayment,
                            effectiveRegistration,
                            relatedDocuments
                          );
                          
                          // Merge the mapped data with the existing invoice
                          invoiceToSet = {
                            ...customerInvoice,
                            ...mappedData
                          };
                        }
                      }
                      
                      setEditableInvoice(invoiceToSet);
                      setCustomerInvoice(invoiceToSet); // Also update the customer invoice state
                      // Restore customer field mapping config
                      setFieldMappingConfig(customerFieldMappingConfig);
                      // Restore customer mapping selection
                      setSelectedMappingId(customerSelectedMappingId);
                      setArrayMappings(customerArrayMappings);
                    }
                  }}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeInvoiceType === 'customer'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Customer Invoice
                </button>
                <button
                  onClick={() => {
                    setActiveInvoiceType('supplier');
                    if (!supplierInvoice && customerInvoice) {
                      // Create supplier invoice from customer invoice
                      const newSupplierInvoice = transformToSupplierInvoice(customerInvoice, effectivePayment);
                      
                      if (newSupplierInvoice) {
                        // Only add default line items if there are no items yet
                        if (!newSupplierInvoice.items || newSupplierInvoice.items.length === 0) {
                        newSupplierInvoice.items = [
                          {
                            description: 'Payment Processing Fee Reimbursement',
                            quantity: 1,
                            price: customerInvoice.processingFees || 0
                          },
                          {
                            description: 'Software Utilization Fee',
                            quantity: 1,
                            price: calculateSoftwareUtilizationFee(customerInvoice)
                          }
                        ];
                        }
                        
                        // Recalculate totals
                        const subtotal = newSupplierInvoice.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                        newSupplierInvoice.subtotal = subtotal;
                        newSupplierInvoice.total = subtotal;
                        
                        setSupplierInvoice(newSupplierInvoice);
                        setEditableInvoice(newSupplierInvoice);
                        
                        // Restore supplier field mapping config
                        setFieldMappingConfig(supplierFieldMappingConfig);
                        // Restore supplier mapping selection
                        setSelectedMappingId(supplierSelectedMappingId);
                        setArrayMappings(supplierArrayMappings);
                      }
                    } else if (supplierInvoice) {
                      let invoiceToSet = supplierInvoice;
                      
                      // If there's a saved mapping, reapply it to hydrate field values
                      if (supplierSelectedMappingId) {
                        const mapping = fieldMappingStorage.getMapping(supplierSelectedMappingId);
                        if (mapping) {
                          const mappedData = fieldMappingStorage.applyMapping(
                            supplierSelectedMappingId,
                            effectivePayment,
                            effectiveRegistration,
                            relatedDocuments
                          );
                          
                          // Merge the mapped data with the existing invoice
                          invoiceToSet = {
                            ...supplierInvoice,
                            ...mappedData
                          };
                        }
                      }
                      
                      setEditableInvoice(invoiceToSet);
                      setSupplierInvoice(invoiceToSet); // Also update the supplier invoice state
                      // Restore supplier field mapping config
                      setFieldMappingConfig(supplierFieldMappingConfig);
                      // Restore supplier mapping selection
                      setSelectedMappingId(supplierSelectedMappingId);
                      setArrayMappings(supplierArrayMappings);
                    }
                  }}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeInvoiceType === 'supplier'
                      ? 'bg-purple-500 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Supplier Invoice
                </button>
              </div>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              {/* Left side - Field Mapping Controls */}
              <div className="w-[500px] border-r flex flex-col">
                <div className="p-6 pb-4 border-b">
                  <h3 className="text-lg font-semibold">Field Mapping - {activeInvoiceType === 'customer' ? 'Customer' : 'Supplier'}</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  {/* Mapping Template Selector */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mapping Template</label>
                    <div className="flex gap-2">
                      <select
                        value={selectedMappingId || ''}
                        onChange={(e) => {
                          const mappingId = e.target.value || null;
                          setSelectedMappingId(mappingId);
                          
                          // Save the mapping selection for the current invoice type
                          if (activeInvoiceType === 'customer') {
                            setCustomerSelectedMappingId(mappingId);
                          } else {
                            setSupplierSelectedMappingId(mappingId);
                          }
                          
                          if (mappingId) {
                            // Get the mapping configuration
                            const mapping = fieldMappingStorage.getMapping(mappingId);
                            console.log('Selected mapping:', mapping);
                            console.log('Mapping has items?', mapping.items);
                            console.log('Mapping has arrayMappings?', mapping.arrayMappings);
                            console.log('Current invoice items:', editableInvoice.items);
                            
                            if (mapping) {
                              // Store the mapping configuration
                              setFieldMappingConfig(mapping.mappings);
                              
                              // Apply the selected mapping
                              const mappedData = fieldMappingStorage.applyMapping(
                                mappingId,
                                effectivePayment,
                                effectiveRegistration,
                                relatedDocuments
                              );
                              console.log('Mapped data:', mappedData);
                              console.log('Mapped data items:', mappedData.items);
                              
                              // Update the editable invoice with mapped data
                              const updatedInvoice = {
                                ...editableInvoice,
                                ...mappedData
                              };
                              console.log('Updated invoice:', updatedInvoice);
                              console.log('Updated invoice items:', updatedInvoice.items);
                              
                              setEditableInvoice(updatedInvoice);
                              
                              // Also update the type-specific invoice state
                              if (activeInvoiceType === 'customer') {
                                setCustomerInvoice(updatedInvoice);
                              } else {
                                setSupplierInvoice(updatedInvoice);
                              }
                              
                              // Set array mappings if present
                              if (mapping.arrayMappings && mapping.arrayMappings.length > 0) {
                                console.log('Setting array mappings:', mapping.arrayMappings);
                                setArrayMappings(mapping.arrayMappings);
                                
                                // Save array mappings for the current invoice type
                                if (activeInvoiceType === 'customer') {
                                  setCustomerArrayMappings(mapping.arrayMappings);
                                } else {
                                  setSupplierArrayMappings(mapping.arrayMappings);
                                }
                              } else {
                                // Clear array mappings for the current invoice type
                                if (activeInvoiceType === 'customer') {
                                  setCustomerArrayMappings([]);
                                } else {
                                  setSupplierArrayMappings([]);
                                }
                                
                                if (!updatedInvoice.items || updatedInvoice.items.length === 0 || 
                                        (updatedInvoice.items.length === 1 && updatedInvoice.items[0].description.includes('Registration for Event'))) {
                                  // If no items were loaded and we have a generic item, this might be an old mapping
                                  // that needs to be re-saved with items
                                  console.warn('This mapping appears to be missing saved line items. Please configure the line items and re-save the mapping.');
                                }
                              }
                            }
                          } else {
                            // Clear the mapping configuration if no mapping selected
                            setFieldMappingConfig({});
                            setArrayMappings([]);
                            
                            // Clear array mappings for the current invoice type
                            if (activeInvoiceType === 'customer') {
                              setCustomerArrayMappings([]);
                            } else {
                              setSupplierArrayMappings([]);
                            }
                          }
                        }}
                        className="flex-1 text-sm px-3 py-2 border rounded"
                      >
                        <option value="">Select a mapping template...</option>
                        {savedMappings
                          .filter(mapping => !mapping.invoiceType || mapping.invoiceType === activeInvoiceType)
                          .map(mapping => (
                            <option key={mapping.id} value={mapping.id}>
                              {mapping.name}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => setShowSaveMappingModal(true)}
                        className="px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
                        title="Create new mapping template"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {/* Invoice Details Section */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Invoice Details</h4>
                      <FieldMappingSelector
                        fieldName="Invoice Date"
                        fieldPath="date"
                        currentValue={editableInvoice.date}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        fieldType="date"
                      />
                      <FieldMappingSelector
                        fieldName="Status"
                        fieldPath="status"
                        currentValue={editableInvoice.status}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        fieldType="select"
                        selectOptions={[
                          { value: 'paid', label: 'Paid' },
                          { value: 'pending', label: 'Pending' },
                          { value: 'overdue', label: 'Overdue' },
                          { value: 'cancelled', label: 'Cancelled' }
                        ]}
                      />
                    </div>

                    {/* Bill To Section */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Bill To Information</h4>
                      <FieldMappingSelector
                        fieldName="Business Name"
                        fieldPath="billTo.businessName"
                        currentValue={editableInvoice.billTo?.businessName}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Business Number (ABN)"
                        fieldPath="billTo.businessNumber"
                        currentValue={editableInvoice.billTo?.businessNumber}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="First Name"
                        fieldPath="billTo.firstName"
                        currentValue={editableInvoice.billTo?.firstName}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Last Name"
                        fieldPath="billTo.lastName"
                        currentValue={editableInvoice.billTo?.lastName}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Email"
                        fieldPath="billTo.email"
                        currentValue={editableInvoice.billTo?.email}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Address Line 1"
                        fieldPath="billTo.addressLine1"
                        currentValue={editableInvoice.billTo?.addressLine1}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="City"
                        fieldPath="billTo.city"
                        currentValue={editableInvoice.billTo?.city}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Postal Code"
                        fieldPath="billTo.postalCode"
                        currentValue={editableInvoice.billTo?.postalCode}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="State/Province"
                        fieldPath="billTo.stateProvince"
                        currentValue={editableInvoice.billTo?.stateProvince}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Country"
                        fieldPath="billTo.country"
                        currentValue={editableInvoice.billTo?.country}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                    </div>
                    
                    {/* Payment Information Section */}
                    <div>
                      <h4 className="font-medium text-gray-700 mb-3">Payment Information</h4>
                      <FieldMappingSelector
                        fieldName="Payment Method"
                        fieldPath="payment.method"
                        currentValue={editableInvoice.payment?.method}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        fieldType="select"
                        selectOptions={[
                          { value: 'credit_card', label: 'Credit Card' },
                          { value: 'debit_card', label: 'Debit Card' },
                          { value: 'bank_transfer', label: 'Bank Transfer' },
                          { value: 'paypal', label: 'PayPal' },
                          { value: 'stripe', label: 'Stripe' },
                          { value: 'other', label: 'Other' }
                        ]}
                      />
                      <FieldMappingSelector
                        fieldName="Transaction ID"
                        fieldPath="payment.transactionId"
                        currentValue={editableInvoice.payment?.transactionId}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Paid Date"
                        fieldPath="payment.paidDate"
                        currentValue={editableInvoice.payment?.paidDate}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        fieldType="date"
                      />
                      <FieldMappingSelector
                        fieldName="Amount Paid"
                        fieldPath="payment.amount"
                        currentValue={editableInvoice.payment?.amount}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        fieldType="number"
                      />
                      <FieldMappingSelector
                        fieldName="Currency"
                        fieldPath="payment.currency"
                        currentValue={editableInvoice.payment?.currency}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Card Last 4"
                        fieldPath="payment.last4"
                        currentValue={editableInvoice.payment?.last4}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Card Brand"
                        fieldPath="payment.cardBrand"
                        currentValue={editableInvoice.payment?.cardBrand}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Receipt URL"
                        fieldPath="payment.receiptUrl"
                        currentValue={editableInvoice.payment?.receiptUrl}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Payment Status"
                        fieldPath="payment.status"
                        currentValue={editableInvoice.payment?.status}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        fieldType="select"
                        selectOptions={[
                          { value: 'completed', label: 'Completed' },
                          { value: 'processing', label: 'Processing' },
                          { value: 'failed', label: 'Failed' },
                          { value: 'refunded', label: 'Refunded' }
                        ]}
                      />
                      <FieldMappingSelector
                        fieldName="Payment Source"
                        fieldPath="payment.source"
                        currentValue={editableInvoice.payment?.source}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                      <FieldMappingSelector
                        fieldName="Statement Descriptor"
                        fieldPath="payment.statementDescriptor"
                        currentValue={editableInvoice.payment?.statementDescriptor}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        sourceDocuments={sourceDocuments}
                      />
                    </div>
                  </div>
                  
                  {/* Financial Fields Section */}
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-700 mb-3">Financial Fields</h4>
                    <div className="space-y-3">
                      <FieldMappingSelector
                        fieldName="Subtotal"
                        fieldPath="subtotal"
                        currentValue={editableInvoice.subtotal}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        fieldType="number"
                      />
                      
                      <FieldMappingSelector
                        fieldName="Total"
                        fieldPath="total"
                        currentValue={editableInvoice.total}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        fieldType="number"
                      />
                      
                      {/* Processing Fees - Auto-calculated */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Processing Fees (Auto-calculated)
                        </label>
                        <div className="bg-gray-50 p-3 rounded border border-gray-200">
                          <div className="text-sm text-gray-600 mb-1">
                            Formula: Total - Subtotal
                          </div>
                          <div className="text-lg font-medium">
                            {typeof editableInvoice.processingFees === 'number' 
                              ? `$${editableInvoice.processingFees.toFixed(2)}` 
                              : '$0.00'}
                          </div>
                          {fieldMappingConfig.processingFees?.isCalculated && (
                            <div className="text-xs text-gray-500 mt-1">
                              Automatically calculated from mapped values
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Validation Fields Section */}
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-700 mb-3">Validation Fields (from Payment)</h4>
                    <div className="space-y-3">
                      <FieldMappingSelector
                        fieldName="Payment Subtotal"
                        fieldPath="validation.paymentSubtotal"
                        currentValue={fieldMappingConfig['validation.paymentSubtotal']?.customValue}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        fieldType="number"
                      />
                      <FieldMappingSelector
                        fieldName="Payment Processing Fees"
                        fieldPath="validation.paymentProcessingFees"
                        currentValue={fieldMappingConfig['validation.paymentProcessingFees']?.customValue}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        fieldType="number"
                      />
                      <FieldMappingSelector
                        fieldName="Payment Total"
                        fieldPath="validation.paymentTotal"
                        currentValue={fieldMappingConfig['validation.paymentTotal']?.customValue}
                        allOptions={allFieldOptions}
                        onMappingChange={handleFieldMappingChange}
                        fieldType="number"
                      />
                    </div>
                    
                    {/* Validation Summary */}
                    {editableInvoice && (
                      <div className="mt-4 p-3 bg-gray-50 rounded text-xs">
                        <div className="font-medium mb-2">Validation Summary</div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <div className="flex items-center gap-2">
                              <span>${(typeof editableInvoice.subtotal === 'number' ? editableInvoice.subtotal : 0).toFixed(2)}</span>
                              {fieldMappingConfig['validation.paymentSubtotal']?.source && (
                                <span className={`${
                                  Math.abs((editableInvoice.subtotal || 0) - 
                                    (getValueByPath(fieldMappingConfig['validation.paymentSubtotal'].source.includes('payment') ? effectivePayment : effectiveRegistration, 
                                      fieldMappingConfig['validation.paymentSubtotal'].source) || 0)) < 0.01
                                    ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {Math.abs((editableInvoice.subtotal || 0) - 
                                    (getValueByPath(fieldMappingConfig['validation.paymentSubtotal'].source.includes('payment') ? effectivePayment : effectiveRegistration, 
                                      fieldMappingConfig['validation.paymentSubtotal'].source) || 0)) < 0.01 ? '✓' : '✗'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span>Processing Fees:</span>
                            <div className="flex items-center gap-2">
                              <span>${(typeof editableInvoice.processingFees === 'number' ? editableInvoice.processingFees : 0).toFixed(2)}</span>
                              {fieldMappingConfig['validation.paymentProcessingFees']?.source && (
                                <span className={`${
                                  Math.abs((editableInvoice.processingFees || 0) - 
                                    (getValueByPath(fieldMappingConfig['validation.paymentProcessingFees'].source.includes('payment') ? effectivePayment : effectiveRegistration, 
                                      fieldMappingConfig['validation.paymentProcessingFees'].source) || 0)) < 0.01
                                    ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {Math.abs((editableInvoice.processingFees || 0) - 
                                    (getValueByPath(fieldMappingConfig['validation.paymentProcessingFees'].source.includes('payment') ? effectivePayment : effectiveRegistration, 
                                      fieldMappingConfig['validation.paymentProcessingFees'].source) || 0)) < 0.01 ? '✓' : '✗'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Total:</span>
                            <div className="flex items-center gap-2">
                              <span>${(typeof editableInvoice.total === 'number' ? editableInvoice.total : 0).toFixed(2)}</span>
                              {fieldMappingConfig['validation.paymentTotal']?.source && (
                                <span className={`${
                                  Math.abs((editableInvoice.total || 0) - 
                                    (getValueByPath(fieldMappingConfig['validation.paymentTotal'].source.includes('payment') ? effectivePayment : effectiveRegistration, 
                                      fieldMappingConfig['validation.paymentTotal'].source) || 0)) < 0.01
                                    ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {Math.abs((editableInvoice.total || 0) - 
                                    (getValueByPath(fieldMappingConfig['validation.paymentTotal'].source.includes('payment') ? effectivePayment : effectiveRegistration, 
                                      fieldMappingConfig['validation.paymentTotal'].source) || 0)) < 0.01 ? '✓' : '✗'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Center - Invoice Preview */}
              <div className="w-[844px] flex flex-col items-center p-6 overflow-y-auto bg-gray-50">
                <div className="flex items-center justify-between mb-4 w-full max-w-[794px]">
                  <h3 className="text-lg font-semibold">Invoice Preview</h3>
                  <button
                    onClick={async () => {
                      const invoiceWrapper = document.getElementById('invoice-preview');
                      const invoiceElement = invoiceWrapper?.querySelector('.bg-white.p-8') as HTMLElement;
                      if (invoiceElement) {
                        try {
                          // Wait a moment for any pending renders
                          await new Promise(resolve => setTimeout(resolve, 100));
                          
                          const { downloadPDF } = await import('@/utils/pdf-generator');
                          const filename = editableInvoice.invoiceNumber || `invoice_${Date.now()}`;
                          console.log('Downloading PDF with filename:', filename);
                          await downloadPDF(invoiceElement, filename);
                        } catch (error) {
                          console.error('Error downloading PDF:', error);
                          alert('Failed to download PDF. Please try again.');
                        }
                      }
                    }}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download PDF
                  </button>
                </div>
                {/* A4 size container: 210mm x 297mm at 96dpi = 794px x 1123px */}
                <div id="invoice-preview" className="bg-white shadow-lg" style={{ width: '794px', minHeight: '1123px' }}>
                  {editableInvoice ? (
                    <InvoiceComponent 
                      invoice={{
                        ...editableInvoice,
                        billTo: fieldMappings.billTo || editableInvoice.billTo || {}
                      }} 
                      className="h-full"
                      logoBase64={logoBase64}
                    />
                  ) : (
                    <div className="p-8 text-gray-500">No invoice data available</div>
                  )}
                </div>
              </div>

              {/* Right side - Tools */}
              <div className="w-[500px] border-l flex flex-col">
                <div className="p-6 pb-4 border-b">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Tools</h3>
                    <button
                      onClick={() => {
                        setShowInvoicePreviewModal(false);
                        setEditableInvoice(null);
                        setFieldMappings({});
                        // Reset all mapping states
                        setSelectedMappingId(null);
                        setCustomerSelectedMappingId(null);
                        setSupplierSelectedMappingId(null);
                        setArrayMappings([]);
                        setCustomerArrayMappings([]);
                        setSupplierArrayMappings([]);
                        setFieldMappingConfig({});
                        setCustomerFieldMappingConfig({});
                        setSupplierFieldMappingConfig({});
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  <LineItemManager
                    items={editableInvoice.items || []}
                    onItemsChange={(items) => {
                      console.log('LineItemManager onItemsChange - items:', items);
                      // Note: LineItemManager already includes sub-items in the item price
                      const subtotal = items.reduce((sum, item) => {
                        const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
                        const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
                        console.log('Item:', item.description, 'Qty:', qty, 'Price:', price);
                        return sum + (qty * price);
                      }, 0);
                      const processingFees = typeof editableInvoice.processingFees === 'number' ? editableInvoice.processingFees : parseFloat(editableInvoice.processingFees) || 0;
                      const updatedInvoice = {
                        ...editableInvoice,
                        items,
                        subtotal,
                        total: subtotal + processingFees
                      };
                      
                      setEditableInvoice(updatedInvoice);
                      
                      // Save to type-specific state
                      if (activeInvoiceType === 'customer') {
                        setCustomerInvoice(updatedInvoice);
                      } else {
                        setSupplierInvoice(updatedInvoice);
                      }
                    }}
                    registrationData={effectiveRegistration}
                    paymentData={effectivePayment}
                    allOptions={allFieldOptions}
                    lineItemMappings={
                      activeInvoiceType === 'customer' 
                        ? customerFieldMappingConfig.lineItems 
                        : supplierFieldMappingConfig.lineItems
                    }
                    onLineItemMappingsChange={(mappings) => {
                      if (activeInvoiceType === 'customer') {
                        setCustomerFieldMappingConfig(prev => ({
                          ...prev,
                          lineItems: mappings
                        }));
                      } else {
                        setSupplierFieldMappingConfig(prev => ({
                          ...prev,
                          lineItems: mappings
                        }));
                      }
                      // Also update the general fieldMappingConfig for compatibility
                      setFieldMappingConfig(prev => ({
                        ...prev,
                        lineItems: mappings
                      }));
                    }}
                    relatedDocuments={relatedDocuments}
                    loadingRelatedDocs={loadingRelatedDocs}
                    arrayMappings={
                      activeInvoiceType === 'customer' 
                        ? customerArrayMappings 
                        : supplierArrayMappings
                    }
                    onArrayMappingsChange={(mappings) => {
                      if (activeInvoiceType === 'customer') {
                        setCustomerArrayMappings(mappings);
                      } else {
                        setSupplierArrayMappings(mappings);
                      }
                      // Also update the general arrayMappings for compatibility
                      setArrayMappings(mappings);
                    }}
                  />
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-6 pt-4 border-t bg-gray-50">
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      setIsCreatingInvoice(true);
                      
                      // First, create the invoice in the database to get the actual invoice number
                      const response = await fetch('/api/invoices/create', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          payment: effectivePayment,
                          registration: effectiveRegistration,
                          invoice: editableInvoice,
                          customerInvoice: customerInvoice,
                          supplierInvoice: supplierInvoice
                        }),
                      });
                      
                      const result = await response.json();
                      
                      if (!response.ok) {
                        throw new Error(result.error || 'Failed to create invoice');
                      }
                      
                      // Update the invoice with the actual invoice numbers
                      const customerInvoiceNumber = result.customerInvoiceNumber;
                      const supplierInvoiceNumber = result.supplierInvoiceNumber;
                      
                      const updatedCustomerInvoice = customerInvoice ? {
                        ...customerInvoice,
                        invoiceNumber: customerInvoiceNumber
                      } : null;
                      const updatedSupplierInvoice = supplierInvoice ? {
                        ...supplierInvoice,
                        invoiceNumber: supplierInvoiceNumber
                      } : null;
                      
                      // Update the state with actual invoice numbers
                      if (updatedCustomerInvoice) {
                        setCustomerInvoice(updatedCustomerInvoice);
                      }
                      
                      // Save the current invoice type to restore later
                      const originalInvoiceType = activeInvoiceType;
                      
                      // Make sure we start with customer invoice for PDF generation
                      if (updatedCustomerInvoice) {
                        setActiveInvoiceType('customer');
                        setEditableInvoice(updatedCustomerInvoice);
                      }
                      
                      // Wait for re-render with new invoice number and logo to load
                      await new Promise(resolve => setTimeout(resolve, 500));
                      
                      // Import PDF generator
                      const { generatePDF } = await import('@/utils/pdf-generator');
                      
                      // Generate PDFs for both customer and supplier invoices
                      let customerPdfBlob: Blob | null = null;
                      let supplierPdfBlob: Blob | null = null;
                      
                      // Generate customer PDF
                      if (updatedCustomerInvoice) {
                        const invoiceWrapper = document.getElementById('invoice-preview');
                        const customerInvoiceElement = invoiceWrapper?.querySelector('.bg-white.p-8') as HTMLElement;
                        if (customerInvoiceElement) {
                          customerPdfBlob = await generatePDF(customerInvoiceElement, updatedCustomerInvoice.invoiceNumber);
                          
                          // Download customer PDF locally
                          const customerUrl = URL.createObjectURL(customerPdfBlob);
                          const customerLink = document.createElement('a');
                          customerLink.href = customerUrl;
                          customerLink.download = `${updatedCustomerInvoice.invoiceNumber}.pdf`;
                          document.body.appendChild(customerLink);
                          customerLink.click();
                          document.body.removeChild(customerLink);
                          URL.revokeObjectURL(customerUrl);
                        }
                      }
                      
                      // Generate supplier PDF if exists
                      if (updatedSupplierInvoice) {
                        // Temporarily switch to supplier invoice view
                        setActiveInvoiceType('supplier');
                        setEditableInvoice(updatedSupplierInvoice);
                        
                        // Wait for re-render
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        const invoiceWrapper = document.getElementById('invoice-preview');
                        const supplierInvoiceElement = invoiceWrapper?.querySelector('.bg-white.p-8') as HTMLElement;
                        if (supplierInvoiceElement) {
                          supplierPdfBlob = await generatePDF(supplierInvoiceElement, updatedSupplierInvoice.invoiceNumber);
                          
                          // Download supplier PDF locally
                          const supplierUrl = URL.createObjectURL(supplierPdfBlob);
                          const supplierLink = document.createElement('a');
                          supplierLink.href = supplierUrl;
                          supplierLink.download = `${updatedSupplierInvoice.invoiceNumber}.pdf`;
                          document.body.appendChild(supplierLink);
                          supplierLink.click();
                          document.body.removeChild(supplierLink);
                          URL.revokeObjectURL(supplierUrl);
                        }
                        
                      }
                      
                      
                      // Upload customer PDF to Supabase if available (optional - will fail silently if not configured)
                      if (customerPdfBlob && updatedCustomerInvoice) {
                        try {
                          const formData = new FormData();
                          formData.append('pdf', new File([customerPdfBlob], `${updatedCustomerInvoice.invoiceNumber}.pdf`, { type: 'application/pdf' }));
                          formData.append('invoiceNumber', updatedCustomerInvoice.invoiceNumber);
                          formData.append('invoiceType', 'customer');
                          
                          const uploadResponse = await fetch('/api/invoices/pdf', {
                            method: 'POST',
                            body: formData
                          });
                          
                          if (!uploadResponse.ok) {
                            console.warn('PDF upload to Supabase is not configured or failed - this is optional');
                          } else {
                            console.log('PDF uploaded to Supabase successfully');
                          }
                        } catch (error) {
                          console.warn('PDF upload to Supabase is not configured - this is optional', error);
                        }
                      }
                      
                      // Send email with customer invoice PDF if available (optional - will fail silently if not configured)
                      if (customerPdfBlob && updatedCustomerInvoice) {
                        try {
                          let functionName = effectiveRegistration?.functionName;
                          
                          // Always fetch function name from functions collection when we have a functionId
                          // This ensures we get the correct name even if the registration has outdated data
                          if (effectiveRegistration?.functionId) {
                            try {
                              const functionDoc = await apiService.getFunctionById(effectiveRegistration.functionId);
                              functionName = functionDoc.name;
                            } catch (error) {
                              console.warn('Failed to fetch function name:', error);
                              // Fall back to registration's functionName if fetch fails
                              functionName = effectiveRegistration?.functionName;
                            }
                          }
                          
                          const formData = new FormData();
                          formData.append('pdf', new File([customerPdfBlob], `${updatedCustomerInvoice.invoiceNumber}.pdf`, { type: 'application/pdf' }));
                          formData.append('invoice', JSON.stringify(updatedCustomerInvoice));
                          formData.append('recipientEmail', updatedCustomerInvoice.billTo.email);
                          formData.append('recipientName', `${updatedCustomerInvoice.billTo.firstName} ${updatedCustomerInvoice.billTo.lastName}`);
                          if (functionName) {
                            formData.append('functionName', functionName);
                          }
                          
                          const emailResponse = await fetch('/api/invoices/email', {
                            method: 'POST',
                            body: formData
                          });
                          
                          if (!emailResponse.ok) {
                            console.warn('Email service is not configured or failed - this is optional');
                          } else {
                            console.log('Invoice email sent successfully');
                          }
                        } catch (error) {
                          console.warn('Email service is not configured - this is optional', error);
                        }
                      }
                      
                      // Restore the original invoice view
                      if (originalInvoiceType === 'supplier' && updatedSupplierInvoice) {
                        setActiveInvoiceType('supplier');
                        setEditableInvoice(updatedSupplierInvoice);
                      } else if (updatedCustomerInvoice) {
                        setActiveInvoiceType('customer');
                        setEditableInvoice(updatedCustomerInvoice);
                      }
                      
                      // Show success message
                      const invoiceNumbers = [];
                      if (customerInvoiceNumber) invoiceNumbers.push(`Customer: ${customerInvoiceNumber}`);
                      if (supplierInvoiceNumber) invoiceNumbers.push(`Supplier: ${supplierInvoiceNumber}`);
                      
                      alert(`Invoice created successfully!\n${invoiceNumbers.join('\n')}\n\nPDFs have been downloaded to your computer.`);
                      
                      // Close the modal
                      setShowInvoicePreviewModal(false);
                      setEditableInvoice(null);
                      setFieldMappings({});
                      
                    } catch (error: any) {
                      console.error('Error creating invoice:', error);
                      alert(`Failed to create invoice: ${error.message}`);
                    } finally {
                      setIsCreatingInvoice(false);
                    }
                  }}
                  disabled={isCreatingInvoice}
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
                </button>
                <button
                  onClick={() => {
                    // Apply the mapped invoice for creation (one-off)
                    setCurrentMatch({
                      ...currentMatch!,
                      invoice: editableInvoice
                    });
                    setShowInvoicePreviewModal(false);
                  }}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Save One Off
                </button>
                <button
                  onClick={() => {
                    setShowSaveMappingModal(true);
                  }}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Save & Update Map
                </button>
                <button
                  onClick={() => {
                    setShowInvoicePreviewModal(false);
                    setEditableInvoice(null);
                    setFieldMappings({});
                  }}
                  className="flex-1 border px-4 py-2 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Registration Edit Modal */}
      {showRegistrationEditModal && effectiveRegistration && (
        <RegistrationEditModal
          registration={effectiveRegistration}
          onSave={handleRegistrationUpdate}
          onClose={() => setShowRegistrationEditModal(false)}
        />
      )}

      {/* Save Mapping Modal */}
      {showSaveMappingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Save Field Mapping Template</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={mappingName}
                onChange={(e) => setMappingName(e.target.value)}
                placeholder="e.g., Standard Business Mapping"
                className="w-full p-2 border rounded"
                autoFocus
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={mappingDescription}
                onChange={(e) => setMappingDescription(e.target.value)}
                placeholder="Describe when to use this mapping..."
                className="w-full p-2 border rounded"
                rows={3}
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!mappingName.trim()) {
                    alert('Please enter a template name');
                    return;
                  }
                  
                  // Create a complete mapping object WITHOUT resolved items
                  const mappingToSave = {
                    ...fieldMappingConfig
                    // Don't include items - they will be regenerated from mappings
                  };
                  
                  // Use the actual field mapping configuration that was tracked
                  const savedMapping = fieldMappingStorage.saveMapping(
                    mappingName.trim(),
                    mappingToSave,
                    mappingDescription.trim(),
                    fieldMappingConfig.lineItems,
                    activeInvoiceType,
                    arrayMappings
                  );
                  
                  // Update local state
                  setSavedMappings([...savedMappings, savedMapping]);
                  setSelectedMappingId(savedMapping.id);
                  
                  // Close modals
                  setShowSaveMappingModal(false);
                  setMappingName('');
                  setMappingDescription('');
                  
                  alert(`Mapping template "${savedMapping.name}" saved successfully!`);
                }}
                disabled={!mappingName.trim()}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                Save Template
              </button>
              <button
                onClick={() => {
                  setShowSaveMappingModal(false);
                  setMappingName('');
                  setMappingDescription('');
                }}
                className="flex-1 border px-4 py-2 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Match Modal */}
      {showManualMatchModal && manualMatchPayment && manualMatchRegistration && (
        <ManualMatchModal
          isOpen={showManualMatchModal}
          onClose={() => {
            setShowManualMatchModal(false);
            setManualMatchPayment(null);
            setManualMatchRegistration(null);
          }}
          payment={manualMatchPayment}
          registration={manualMatchRegistration}
          onMatch={handleManualMatch}
        />
      )}
    </main>
  );
}