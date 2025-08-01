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
import { getSupplierInvoiceSupplier, DEFAULT_INVOICE_SUPPLIER } from '@/constants/invoice';
import { loadLogoAsBase64 } from '@/utils/logo-base64';
import { getMonetaryValue, formatMoney, roundToMoney } from '@/utils/monetary';
import { useUnifiedInvoice } from '@/hooks/useUnifiedInvoice';

interface MatchDetail {
  valueType: 'paymentId' | 'registrationId' | 'confirmationNumber' | 'email' | 'amount' | 'accountId' | 'name' | 'address' | 'timestamp' | 'manual';
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
  const [fieldMappingConfig, setFieldMappingConfig] = useState<Record<string, any>>({});
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  
  // Invoice type states
  const [activeInvoiceType, setActiveInvoiceType] = useState<'customer' | 'supplier'>('customer');
  const [customerInvoice, setCustomerInvoice] = useState<any>(null);
  const [supplierInvoice, setSupplierInvoice] = useState<any>(null);
  const [customerFieldMappingConfig, setCustomerFieldMappingConfig] = useState<Record<string, any>>({});
  const [supplierFieldMappingConfig, setSupplierFieldMappingConfig] = useState<Record<string, any>>({});
  
  // Registration edit modal states
  const [showRegistrationEditModal, setShowRegistrationEditModal] = useState(false);
  const [showRelatedDocuments, setShowRelatedDocuments] = useState(false);
  
  // Invoice processing status states
  const [processedInvoices, setProcessedInvoices] = useState<any[]>([]);
  const [loadingInvoiceStatus, setLoadingInvoiceStatus] = useState(false);

  // Unified invoice service hook
  const { createInvoice: createUnifiedInvoice, loading: unifiedLoading } = useUnifiedInvoice({
    onSuccess: (invoiceNumber, url) => {
      alert(`Invoice created successfully! Invoice Number: ${invoiceNumber}`);
      
      // Move to next payment if not in single payment mode
      if (!paymentId && currentIndex < total - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (!paymentId) {
        alert('All payments processed!');
      }
      
      // Refresh to show invoice details
      fetchCurrentPayment();
    },
    onError: (error) => {
      alert(`Failed to create invoice: ${error}`);
    }
  });
  
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

  // Generate custom individuals/lodge invoice for JSON preview
  useEffect(() => {
    const generateCustomInvoiceForPreview = async () => {
      const effectiveRegistration = selectedRegistration || currentMatch?.registration;
      const effectivePayment = selectedPayment || currentMatch?.payment;
      
      if (effectiveRegistration && effectivePayment && 
          (effectiveRegistration.registrationType === 'individuals' || effectiveRegistration.registrationType === 'lodge')) {
        try {
          // Create a base invoice structure similar to the button handler
          const invoiceNumbers = await generateInvoiceNumbers(new Date(effectivePayment.timestamp || effectivePayment.createdAt || new Date()));
          const baseInvoice = {
            customerInvoiceNumber: invoiceNumbers.customerInvoiceNumber,
            supplierInvoiceNumber: invoiceNumbers.supplierInvoiceNumber,
            paymentId: effectivePayment.paymentId || effectivePayment._id,
            registrationId: effectiveRegistration._id,
            // Additional base properties that might be needed
            date: effectivePayment.timestamp || effectivePayment.createdAt || new Date().toISOString(),
            status: 'paid'
          };
          
          let customInvoice;
          if (effectiveRegistration.registrationType === 'individuals') {
            customInvoice = await generateCustomIndividualsInvoice(effectiveRegistration, effectivePayment, baseInvoice);
          } else if (effectiveRegistration.registrationType === 'lodge') {
            customInvoice = await generateCustomLodgeInvoice(effectiveRegistration, effectivePayment, baseInvoice);
          }
          
          if (customInvoice) {
            setCustomerInvoice(customInvoice);
            
            // Generate supplier invoice from customer invoice
            const supplierInvoiceData = transformToSupplierInvoice(customInvoice, effectivePayment, effectiveRegistration);
            setSupplierInvoice(supplierInvoiceData);
            
            console.log('🔄 Auto-generated invoice for JSON preview:', {
              registrationId: effectiveRegistration._id,
              confirmationNumber: effectiveRegistration.confirmationNumber,
              registrationType: effectiveRegistration.registrationType
            });
          }
        } catch (error) {
          console.error('❌ Error auto-generating invoice for JSON preview:', error);
          // Fall back to default behavior if custom generation fails
        }
      }
    };
    
    generateCustomInvoiceForPreview();
  }, [selectedRegistration, selectedPayment, currentMatch]);

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

  const fetchFunctionName = async (functionId: string) => {
    try {
      const response = await fetch(`/api/functions/${functionId}`);
      if (!response.ok) {
        console.error('Failed to fetch function:', response.status, response.statusText);
        return 'Unknown Function';
      }
      const functionDoc = await response.json();
      return functionDoc?.name || 'Unknown Function';
    } catch (error) {
      console.error('Error fetching function name:', error);
      return 'Unknown Function';
    }
  };

  const generateCustomLodgeInvoice = async (effectiveRegistration: any, effectivePayment: any, baseInvoice: any) => {
    try {
      console.log('🏛️ LODGE LOGIC TRIGGERED (JSON Preview)', {
        registrationId: effectiveRegistration._id,
        confirmationNumber: effectiveRegistration.confirmationNumber,
        lodgeName: effectiveRegistration.registrationData?.lodgeDetails?.lodgeName,
        paymentAmount: getMonetaryValue(effectivePayment.grossAmount || effectivePayment.amount)
      });
      
      // Fetch function name from database using functionId
      const functionName = effectiveRegistration.functionId 
        ? await fetchFunctionName(effectiveRegistration.functionId)
        : 'Event';
      
      // Construct lodge display from registration data
      const lodgeDetails = effectiveRegistration.registrationData?.lodgeDetails || {};
      const lodgeName = lodgeDetails.lodgeName || effectiveRegistration.registrationData?.lodgeName || '';
      const lodgeNumber = lodgeDetails.lodgeNumber || effectiveRegistration.registrationData?.lodgeNumber || '';
      const lodgeDisplay = lodgeName && lodgeNumber ? `${lodgeName} ${lodgeNumber}` : lodgeName || 'Lodge';
      
      console.log('📋 Function name for lodge registration (JSON Preview):', {
        functionId: effectiveRegistration.functionId,
        functionName,
        lodgeName: effectiveRegistration.registrationData?.lodgeName,
        lodgeDisplay
      });
      
      // Get lodge info and tickets from registration data
      const allTickets = effectiveRegistration.registrationData?.tickets || [];
      
      console.log('🏛️ Processing lodge tickets (JSON Preview):', {
        totalTickets: allTickets.length,
        ticketDetails: allTickets.map((t: any) => ({
          name: t.name,
          price: t.price,
          quantity: t.quantity
        }))
      });
      
      // Create line items
      const items = [];
      
      // First item: Registration line - Confirmation number | Lodge for Function Name
      items.push({
        description: `${effectiveRegistration.confirmationNumber} | Lodge for ${functionName}`,
        quantity: 0,
        price: 0,
        total: 0
      });
      
      // Process tickets - for lodge registrations, tickets are usually owned by the registration
      let subtotal = 0;
      
      // Add all tickets
      allTickets.forEach((ticket: any) => {
        const ticketPrice = roundToMoney(ticket.price || 0);
        const ticketQuantity = ticket.quantity || 1;
        const ticketTotal = roundToMoney(ticketQuantity * ticketPrice);
        subtotal = roundToMoney(subtotal + ticketTotal);
        
        console.log(`💰 Adding ticket to lodge invoice (JSON Preview):`, {
          ticketName: ticket.name,
          quantity: ticketQuantity,
          price: ticketPrice,
          ticketTotal,
          runningSubtotal: subtotal
        });
        
        items.push({
          description: `  - ${ticket.name || 'Ticket'}`,
          quantity: ticketQuantity,
          price: ticketPrice,
          total: ticketTotal
        });
      });
      
      // Calculate processing fees and totals
      const totalAmount = roundToMoney(getMonetaryValue(effectivePayment.grossAmount || effectivePayment.amount) || 0);
      const processingFees = roundToMoney(Math.max(0, totalAmount - subtotal));
      const gst = roundToMoney(totalAmount / 11);
      
      console.log('🧮 Final calculations for lodge (JSON Preview):', {
        subtotal,
        totalAmount,
        processingFees,
        gst,
        itemsCount: items.length,
        paymentSource: effectivePayment.source || 'unknown'
      });
      
      // Create billTo from bookingContact for lodge registrations
      // First try metadata.billingDetails for backward compatibility, then bookingContact
      const billingDetails = effectiveRegistration.registrationData?.metadata?.billingDetails || 
                            effectiveRegistration.registrationData?.bookingContact || {};
      
      // For lodge registrations, use billing details from metadata or bookingContact
      const billTo = {
        firstName: billingDetails.firstName || '',
        lastName: billingDetails.lastName || '',
        businessName: billingDetails.businessName || lodgeDisplay,
        businessNumber: billingDetails.businessNumber || effectiveRegistration.registrationData?.lodgeABN || '',
        addressLine1: billingDetails.addressLine1 || '',
        addressLine2: billingDetails.addressLine2 || '',
        city: billingDetails.city || billingDetails.suburb || '',
        postalCode: billingDetails.postcode || billingDetails.postalCode || '',
        stateProvince: billingDetails.stateProvince || billingDetails.stateTerritory?.name || '',
        country: billingDetails.country === 'AU' ? 'Australia' : (billingDetails.country?.isoCode === 'AU' ? 'Australia' : (billingDetails.country?.name || billingDetails.country || 'Australia')),
        email: billingDetails.emailAddress || billingDetails.email || '',
        phone: billingDetails.phone || billingDetails.mobileNumber || ''
      };
      
      // Create payment info with custom format
      // Get funding info from originalData fallback
      const fundingInfo = effectivePayment.funding || (effectivePayment.originalData && effectivePayment.originalData["Card Funding"]);
      
      // Build payment method parts
      let paymentParts = [];
      
      // Add card brand (e.g., "Visa")
      if (effectivePayment.cardBrand) {
        paymentParts.push(effectivePayment.cardBrand);
      }
      
      // Add funding info (e.g., "credit") - remove "card" from it
      if (fundingInfo) {
        const cleanedFunding = fundingInfo.toLowerCase().replace(/\s*card\s*/gi, '').trim();
        if (cleanedFunding) {
          paymentParts.push(cleanedFunding);
        }
      }
      
      // Add payment method type if different from what we already have
      if (effectivePayment.paymentMethodType && 
          !effectivePayment.paymentMethodType.toLowerCase().includes('card')) {
        paymentParts.push(effectivePayment.paymentMethodType);
      }
      
      // Add last 4 digits
      const last4 = effectivePayment.cardLast4 || effectivePayment.last4;
      if (last4) {
        paymentParts.push(last4);
      }
      
      const paymentMethod = paymentParts.join(' ');
      
      // Override the invoice data with lodge-specific structure
      const customInvoice = {
        ...baseInvoice,
        invoiceNumber: baseInvoice.customerInvoiceNumber || baseInvoice.invoiceNumber || '[To be assigned]',
        invoiceType: 'customer',
        status: 'paid',
        date: effectivePayment.timestamp || effectivePayment.createdAt || new Date().toISOString(),
        supplier: DEFAULT_INVOICE_SUPPLIER,
        billTo,
        items,
        subtotal,
        processingFees,
        total: totalAmount,
        gst,
        payment: {
          method: paymentMethod || 'credit_card',
          gateway: effectivePayment.source === 'stripe' ? 'Stripe' : effectivePayment.source === 'square' ? 'Square' : (effectivePayment.source || 'unknown'),
          source: effectivePayment.source || 'unknown',
          cardBrand: effectivePayment.cardBrand || '',
          last4: effectivePayment.cardLast4 || effectivePayment.last4 || '',
          amount: totalAmount,
          paymentId: effectivePayment.paymentId || effectivePayment._id || '',
          transactionId: effectivePayment.transactionId || effectivePayment.paymentId || '',
          paidDate: effectivePayment.timestamp || effectivePayment.createdAt || new Date().toISOString(),
          receiptUrl: effectivePayment.receiptUrl || '',
          statementDescriptor: effectivePayment.statementDescriptor || '',
          status: effectivePayment.Status?.toLowerCase() || effectivePayment.status || 'completed'
        }
      };
      
      console.log('✅ LODGE INVOICE GENERATED (JSON Preview):', {
        confirmationNumber: effectiveRegistration.confirmationNumber,
        functionName,
        lodgeDisplay,
        totalItems: items.length,
        subtotal,
        processingFees,
        totalAmount,
        paymentMethod,
        gateway: effectivePayment.source,
        billToEmail: billTo.email,
        success: true
      });
      
      return customInvoice;
      
    } catch (error) {
      console.error('❌ ERROR in lodge invoice generation (JSON Preview):', {
        registrationId: effectiveRegistration._id,
        confirmationNumber: effectiveRegistration.confirmationNumber,
        error: error.message,
        stack: error.stack,
        effectiveRegistration: {
          functionId: effectiveRegistration.functionId,
          registrationType: effectiveRegistration.registrationType,
          hasTickets: !!effectiveRegistration.registrationData?.tickets?.length
        }
      });
      throw error;
    }
  };

  const generateCustomIndividualsInvoice = async (effectiveRegistration: any, effectivePayment: any, baseInvoice: any) => {
    try {
      console.log('🎯 INDIVIDUALS LOGIC TRIGGERED (JSON Preview)', {
        registrationId: effectiveRegistration._id,
        confirmationNumber: effectiveRegistration.confirmationNumber,
        functionId: effectiveRegistration.functionId,
        paymentAmount: getMonetaryValue(effectivePayment.grossAmount || effectivePayment.amount)
      });
      
      // Fetch function name from database using functionId
      const functionName = effectiveRegistration.functionId 
        ? await fetchFunctionName(effectiveRegistration.functionId)
        : 'Event';
      
      console.log('📋 Function name lookup result (JSON Preview):', {
        functionId: effectiveRegistration.functionId,
        functionName,
        fallbackUsed: !effectiveRegistration.functionId
      });
      
      // Get attendees and tickets from registration data
      const attendees = effectiveRegistration.registrationData?.attendees || [];
      const allTickets = effectiveRegistration.registrationData?.tickets || [];
      
      console.log('👥 Processing attendees and tickets (JSON Preview):', {
        attendeesCount: attendees.length,
        totalTickets: allTickets.length,
        attendeeNames: attendees.map((a: any) => `${a.firstName} ${a.lastName}`),
        ticketOwnership: allTickets.map((t: any) => ({
          name: t.name,
          ownerType: t.ownerType,
          ownerId: t.ownerId,
          price: t.price,
          quantity: t.quantity
        }))
      });
      
      // Create line items
      const items = [];
      
      // First item: Registration line - Confirmation number | Individuals for Function Name
      items.push({
        description: `${effectiveRegistration.confirmationNumber} | Individuals for ${functionName}`,
        quantity: 0,
        price: 0,
        total: 0
      });
      
      // Process attendees and their tickets
      let subtotal = 0;
      attendees.forEach((attendee: any) => {
        // Add attendee line
        const attendeeName = `${attendee.title || ''} ${attendee.firstName || ''} ${attendee.lastName || ''}`.trim();
        const lodgeInfo = attendee.lodgeNameNumber || '';
        items.push({
          description: `${attendeeName} | ${lodgeInfo}`,
          quantity: 0,
          price: 0,
          total: 0
        });
        
        // Add tickets for this attendee with fallback strategy
        // First try exact match
        let attendeeTickets = allTickets.filter((ticket: any) => 
          ticket.ownerType === 'attendee' && ticket.ownerId === attendee.attendeeId
        );
        
        // If no exact match, try string comparison (in case of type mismatch)
        if (attendeeTickets.length === 0) {
          attendeeTickets = allTickets.filter((ticket: any) => 
            ticket.ownerType === 'attendee' && String(ticket.ownerId) === String(attendee.attendeeId)
          );
          if (attendeeTickets.length > 0) {
            console.log(`🔧 Found tickets using string comparison for attendee ${attendeeName}:`, {
              ticketCount: attendeeTickets.length,
              matchedTickets: attendeeTickets.map(t => ({ name: t.name, ownerId: t.ownerId }))
            });
          }
        }
        
        console.log(`🎫 Ticket filtering for attendee ${attendeeName} (JSON Preview):`, {
          attendeeId: attendee.attendeeId,
          directMatchTickets: attendeeTickets.length,
          ticketDetails: attendeeTickets.map(t => ({ name: t.name, price: t.price, quantity: t.quantity })),
          // Enhanced debugging info
          allTicketsOwnership: allTickets.map(t => ({ 
            name: t.name, 
            ownerType: t.ownerType, 
            ownerId: t.ownerId,
            ownerIdMatch: t.ownerId === attendee.attendeeId ? 'MATCH' : 'NO_MATCH'
          }))
        });
        
        // Fallback: If no tickets found and this is an 'individuals' registration,
        // check if tickets are owned by the registration itself and assign to primary attendee
        if (attendeeTickets.length === 0 && effectiveRegistration.registrationType === 'individuals') {
          const registrationOwnedTickets = allTickets.filter((ticket: any) => {
            // Try exact ID match first
            const exactMatch = (ticket.ownerType === 'registration' && ticket.ownerId === effectiveRegistration._id) ||
                              (ticket.ownerType === 'attendee' && ticket.ownerId === effectiveRegistration._id);
            
            // Try string comparison as fallback
            const stringMatch = (ticket.ownerType === 'registration' && String(ticket.ownerId) === String(effectiveRegistration._id)) ||
                               (ticket.ownerType === 'attendee' && String(ticket.ownerId) === String(effectiveRegistration._id));
            
            return exactMatch || stringMatch;
          });
          
          console.log('🔄 Applying fallback ticket assignment (JSON Preview):', {
            attendeeName,
            registrationId: effectiveRegistration._id,
            registrationOwnedTickets: registrationOwnedTickets.length,
            isPrimaryAttendee: attendees.indexOf(attendee) === 0,
            fallbackTickets: registrationOwnedTickets.map(t => ({ name: t.name, price: t.price })),
            // Enhanced debugging for registration fallback
            registrationTicketDetails: registrationOwnedTickets.map(t => ({
              name: t.name,
              ownerType: t.ownerType,
              ownerId: t.ownerId,
              expectedRegistrationId: effectiveRegistration._id,
              ownerIdMatch: String(t.ownerId) === String(effectiveRegistration._id) ? 'MATCH' : 'NO_MATCH'
            }))
          });
          
          // For individuals registration, assign all registration-owned tickets to the first attendee
          if (registrationOwnedTickets.length > 0 && attendees.indexOf(attendee) === 0) {
            attendeeTickets = registrationOwnedTickets;
            console.log('✅ Fallback tickets assigned to primary attendee (JSON Preview):', {
              assignedTickets: attendeeTickets.length
            });
          } else if (attendeeTickets.length === 0 && attendees.indexOf(attendee) === 0) {
            // Final fallback strategy - assign tickets based on registration association
            let finalFallbackTickets = [];
            
            // 1. Find tickets without proper ownership
            const unassignedTickets = allTickets.filter((ticket: any) => 
              !ticket.ownerType || !ticket.ownerId || 
              (ticket.ownerType !== 'attendee' && ticket.ownerType !== 'registration')
            );
            
            // 2. If no unassigned tickets, look for any tickets that should belong to this registration
            if (unassignedTickets.length === 0) {
              // Check if there are tickets that might belong to this registration but have wrong ownership
              const potentialTickets = allTickets.filter((ticket: any) => {
                // Look for tickets that might be misassigned but belong to this registration's attendees
                const belongsToRegistration = ticket.ownerType === 'attendee' && 
                  attendees.some(att => String(ticket.ownerId) === String(att.attendeeId));
                return !belongsToRegistration && ticket.eventTicketId;
              });
              
              if (potentialTickets.length > 0) {
                console.log('🔍 Found potentially misassigned tickets for registration:', {
                  registrationId: effectiveRegistration._id,
                  potentialTickets: potentialTickets.map(t => ({ 
                    name: t.name, 
                    ownerType: t.ownerType, 
                    ownerId: t.ownerId,
                    eventTicketId: t.eventTicketId
                  }))
                });
                finalFallbackTickets = potentialTickets;
              }
            } else {
              finalFallbackTickets = unassignedTickets;
            }
            
            if (finalFallbackTickets.length > 0) {
              attendeeTickets = finalFallbackTickets;
              console.log('🔄 Final fallback: assigning tickets to primary attendee (JSON Preview):', {
                ticketCount: finalFallbackTickets.length,
                ticketNames: finalFallbackTickets.map(t => t.name),
                assignmentReason: unassignedTickets.length > 0 ? 'unassigned_tickets' : 'potential_misassignment'
              });
            }
          }
        }
        
        attendeeTickets.forEach((ticket: any) => {
          const ticketPrice = roundToMoney(ticket.price || 0);
          const ticketTotal = roundToMoney((ticket.quantity || 1) * ticketPrice);
          subtotal = roundToMoney(subtotal + ticketTotal);
          console.log(`💰 Adding ticket to invoice (JSON Preview):`, {
            attendeeName,
            ticketName: ticket.name,
            quantity: ticket.quantity || 1,
            price: ticketPrice,
            ticketTotal,
            runningSubtotal: subtotal
          });
          items.push({
            description: `  - ${ticket.name || 'Ticket'}`,
            quantity: ticket.quantity || 1,
            price: ticketPrice,
            total: ticketTotal
          });
        });
      });
      
      // Calculate processing fees and totals
      const totalAmount = roundToMoney(getMonetaryValue(effectivePayment.grossAmount || effectivePayment.amount) || 0);
      const processingFees = roundToMoney(Math.max(0, totalAmount - subtotal));
      const gst = roundToMoney(totalAmount / 11);
      
      console.log('🧮 Final calculations (JSON Preview):', {
        subtotal,
        totalAmount,
        processingFees,
        gst,
        itemsCount: items.length,
        paymentSource: effectivePayment.source || 'unknown'
      });
      
      // Create billTo from bookingContact
      const bookingContact = effectiveRegistration.registrationData?.bookingContact || {};
      
      // Ensure clean billTo fields - replace any placeholder values with empty strings
      const cleanBusinessName = bookingContact.businessName && bookingContact.businessName !== '-----' ? bookingContact.businessName : '';
      const cleanBusinessNumber = bookingContact.businessNumber && bookingContact.businessNumber !== '-----' ? bookingContact.businessNumber : '';
      
      const billTo = {
        firstName: bookingContact.firstName || '',
        lastName: bookingContact.lastName || '',
        businessName: cleanBusinessName,
        businessNumber: cleanBusinessNumber,
        addressLine1: bookingContact.addressLine1 || '',
        addressLine2: bookingContact.addressLine2 || '',
        city: bookingContact.city || '',
        postalCode: bookingContact.postalCode || '',
        stateProvince: bookingContact.stateProvince || '',
        country: bookingContact.country || '',
        email: bookingContact.email || bookingContact.emailAddress || '',
        phone: bookingContact.phone || bookingContact.mobileNumber || ''
      };
      
      // Create payment info with custom format
      // Get funding info from originalData fallback
      const fundingInfo = effectivePayment.funding || (effectivePayment.originalData && effectivePayment.originalData["Card Funding"]);
      
      // Build payment method parts
      let paymentParts = [];
      
      // Add card brand (e.g., "Visa")
      if (effectivePayment.cardBrand) {
        paymentParts.push(effectivePayment.cardBrand);
      }
      
      // Add funding info (e.g., "credit") - remove "card" from it
      if (fundingInfo) {
        const cleanedFunding = fundingInfo.toLowerCase().replace(/\s*card\s*/gi, '').trim();
        if (cleanedFunding) {
          paymentParts.push(cleanedFunding);
        }
      }
      
      // Add payment method type if different from what we already have
      if (effectivePayment.paymentMethodType && 
          !effectivePayment.paymentMethodType.toLowerCase().includes('card')) {
        paymentParts.push(effectivePayment.paymentMethodType);
      }
      
      // Add last 4 digits
      const last4 = effectivePayment.cardLast4 || effectivePayment.last4;
      if (last4) {
        paymentParts.push(last4);
      }
      
      const paymentMethod = paymentParts.join(' ');
      
      // Override the invoice data with individuals-specific structure
      const customInvoice = {
        ...baseInvoice,
        invoiceNumber: baseInvoice.customerInvoiceNumber || baseInvoice.invoiceNumber || '[To be assigned]',
        invoiceType: 'customer',
        status: 'paid',
        date: effectivePayment.timestamp || effectivePayment.createdAt || new Date().toISOString(),
        supplier: DEFAULT_INVOICE_SUPPLIER,
        billTo,
        items,
        subtotal,
        processingFees,
        total: totalAmount,
        gst,
        payment: {
          method: paymentMethod || 'credit_card',
          gateway: effectivePayment.source === 'stripe' ? 'Stripe' : effectivePayment.source === 'square' ? 'Square' : (effectivePayment.source || 'unknown'),
          source: effectivePayment.source || 'unknown',
          cardBrand: effectivePayment.cardBrand || '',
          last4: effectivePayment.cardLast4 || effectivePayment.last4 || '',
          amount: totalAmount,
          paymentId: effectivePayment.paymentId || effectivePayment._id || '',
          transactionId: effectivePayment.transactionId || effectivePayment.paymentId || '',
          paidDate: effectivePayment.timestamp || effectivePayment.createdAt || new Date().toISOString(),
          receiptUrl: effectivePayment.receiptUrl || '',
          statementDescriptor: effectivePayment.statementDescriptor || '',
          status: effectivePayment.Status?.toLowerCase() || effectivePayment.status || 'completed'
        }
      };
      
      console.log('✅ INDIVIDUALS INVOICE GENERATED (JSON Preview):', {
        confirmationNumber: effectiveRegistration.confirmationNumber,
        functionName,
        attendeesProcessed: attendees.length,
        totalItems: items.length,
        subtotal,
        processingFees,
        totalAmount,
        paymentMethod,
        gateway: effectivePayment.source,
        billToEmail: billTo.email,
        success: true
      });
      
      return customInvoice;
      
    } catch (error) {
      console.error('❌ ERROR in individuals invoice generation (JSON Preview):', {
        registrationId: effectiveRegistration._id,
        confirmationNumber: effectiveRegistration.confirmationNumber,
        error: error.message,
        stack: error.stack,
        effectiveRegistration: {
          functionId: effectiveRegistration.functionId,
          registrationType: effectiveRegistration.registrationType,
          hasAttendees: !!effectiveRegistration.registrationData?.attendees?.length,
          hasTickets: !!effectiveRegistration.registrationData?.tickets?.length
        }
      });
      throw error;
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
        
        console.log('🔍 Fetched payment:', {
          _id: payment?._id,
          paymentId: payment?.paymentId,
          transactionId: payment?.transactionId,
          customerEmail: payment?.customerEmail,
          amount: payment?.amount
        });
        
        // Try to find a registration match
        let registration = null;
        let matchConfidence = 0;
        
        if (payment) {
          // First, check if payment has a matchedRegistrationId
          if (payment.matchedRegistrationId) {
            try {
              console.log('Payment has matchedRegistrationId:', payment.matchedRegistrationId);
              const registrationData = await apiService.getDocument('registrations', payment.matchedRegistrationId);
              
              if (registrationData) {
                registration = registrationData;
                matchConfidence = payment.matchConfidence || 100;
                console.log('Found matched registration:', registration._id);
              }
            } catch (error) {
              console.error('Error fetching matched registration:', error);
            }
          }
          
          if (!registration) {
            // No match found from stored ID, try automatic matching
            try {
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
              
              console.log('🔍 Searching for registration with query:', JSON.stringify(registrationQuery, null, 2));
              
              const regData = await apiService.searchDocuments('registrations', registrationQuery);
              
              // Handle both 'documents' and 'results' response formats
              const documents = regData.documents || regData.results || [];
              console.log('🔍 Registration search result:', {
                found: documents.length,
                documents: documents
              });
              
              if (documents.length > 0) {
                registration = documents[0];
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
            } catch (err) {
              console.error('Error fetching registration:', err);
            }
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
            paymentId: payment.paymentId || payment._id,
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
              status: payment.Status?.toLowerCase() || payment.status || 'completed',
              source: payment.source || 'unknown'
            }
          };
          
          setCustomerInvoice(initialCustomerInvoice);
          setEditableInvoice(initialCustomerInvoice); // Set editable invoice to show the invoice number
          
          // Generate supplier invoice with the matching number
          if (customerInvoiceNumber) {
            const supplierInvoiceData = transformToSupplierInvoice(initialCustomerInvoice, payment, registration);
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
            paymentId: match.payment.paymentId || match.payment._id,
            registrationId: match.registration?._id,
            supplier: DEFAULT_INVOICE_SUPPLIER,
            billTo: {
              businessName: (match.registration?.businessName && match.registration?.businessName !== '-----') ? match.registration?.businessName : '',
              businessNumber: (match.registration?.businessNumber && match.registration?.businessNumber !== '-----') ? match.registration?.businessNumber : '',
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
              status: match.payment.Status?.toLowerCase() || match.payment.status || 'completed',
              source: match.payment.source || 'unknown'
            }
          };
          
          setCustomerInvoice(initialCustomerInvoice);
          setEditableInvoice(initialCustomerInvoice); // Set editable invoice to show the invoice number
          
          // Generate supplier invoice with the matching number
          if (customerInvoiceNumber) {
            const supplierInvoiceData = transformToSupplierInvoice(initialCustomerInvoice, match.payment, match.registration);
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
        const registrationResults = (results as any).matches && (results as any).matches.length > 0 
          ? (results as any).matches.map((match: any) => ({
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
      
      const response = await fetch('/api/matches/unified', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: manualMatchPayment._id,
          registrationId: manualMatchRegistration._id,
          confidence: 100,
          method: 'manual'
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
            businessName: (manualMatchRegistration.organisation?.name && manualMatchRegistration.organisation?.name !== '-----') ? manualMatchRegistration.organisation?.name : '',
            businessNumber: (manualMatchRegistration.organisation?.abn && manualMatchRegistration.organisation?.abn !== '-----') ? manualMatchRegistration.organisation?.abn : '',
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
            source: manualMatchPayment.source || 'unknown'
          }
        };
        
        setCustomerInvoice(initialCustomerInvoice);
        setEditableInvoice(initialCustomerInvoice); // Set editable invoice to show the invoice number
        
        // Generate supplier invoice with the matching number
        if (customerInvoiceNumber) {
          const supplierInvoiceData = transformToSupplierInvoice(initialCustomerInvoice, manualMatchPayment, selectedRegistration);
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
  const transformToSupplierInvoice = (customerInvoice: any, payment?: any, registration?: any) => {
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
    
    // Generate supplier invoice items with correct structure
    const customerInvoiceSubtotal = customerInvoice?.subtotal || 0;
    const effectiveRegistration = registration || selectedRegistration || currentMatch?.registration;
    const effectivePayment = payment || selectedPayment || currentMatch?.payment;
    const supplierItems = generateSupplierInvoiceItems(
      effectivePayment,
      effectiveRegistration,
      customerInvoiceSubtotal
    );
    
    const subtotal = roundToMoney(supplierItems.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0));
    const gst = roundToMoney(subtotal / 11); // Calculate GST for supplier invoice
    const total = roundToMoney(subtotal); // Total includes GST for supplier invoice
    
    // Get payment method for supplier invoice
    const paymentMethod = effectivePayment?.paymentMethod || 
      (effectivePayment?.cardLastFour ? `Visa credit card ${effectivePayment.cardLastFour}` : 'credit_card');
    
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
      items: supplierItems, // Add the correct line items automatically
      processingFees: roundToMoney(0), // No additional fees on supplier invoice
      subtotal: subtotal, // Calculate based on supplier items
      gst: gst, // Add GST calculation
      total: total, // Calculate based on supplier items
      payment: {
        method: paymentMethod,
        gateway: effectivePayment?.source === 'stripe' ? 'Stripe' : effectivePayment?.source === 'square' ? 'Square' : (effectivePayment?.source || 'unknown'),
        source: effectivePayment?.source || 'unknown',
        cardBrand: effectivePayment?.cardBrand || '',
        last4: effectivePayment?.cardLast4 || effectivePayment?.last4 || '',
        amount: roundToMoney(total),
        paymentId: effectivePayment?.paymentId || effectivePayment?._id || '',
        transactionId: effectivePayment?.transactionId || effectivePayment?.paymentId || '',
        paidDate: effectivePayment?.timestamp || effectivePayment?.createdAt || new Date().toISOString(),
        receiptUrl: effectivePayment?.receiptUrl || '',
        statementDescriptor: effectivePayment?.statementDescriptor || ''
      }
    };
    
    return supplierInvoice;
  };
  
  // Calculate software utilization fee based on payment and customer invoice
  const calculateSoftwareUtilizationFee = (payment: any, customerInvoiceSubtotal: number) => {
    // Software utilisation fee = payment.grossAmount - payment.feeAmount - customer invoice subtotal
    const grossAmount = roundToMoney(payment?.grossAmount || payment?.amount || 0);
    const feeAmount = roundToMoney(payment?.feeAmount || payment?.fees || 0);
    const customerSubtotal = roundToMoney(customerInvoiceSubtotal);
    return roundToMoney(grossAmount - feeAmount - customerSubtotal);
  };

  // Generate supplier invoice line items with correct structure
  const generateSupplierInvoiceItems = (payment: any, registration: any, customerInvoiceSubtotal: number) => {
    const confirmationNumber = registration?.confirmationNumber || 'N/A';
    const paymentGateway = payment?.source || (payment?.sourceFile?.includes('square') ? 'Square' : 'Stripe');
    const paymentId = payment?.paymentId || payment?._id || 'N/A';
    const feeAmount = roundToMoney(payment?.feeAmount || payment?.fees || 0);
    
    return [
      {
        description: `Software utilisation fee for registration: ${confirmationNumber}`,
        quantity: 1,
        price: roundToMoney(calculateSoftwareUtilizationFee(payment, customerInvoiceSubtotal))
      },
      {
        description: `${paymentGateway.charAt(0).toUpperCase() + paymentGateway.slice(1).toLowerCase()} processing fee reimbursement for ${paymentId}`,
        quantity: 1,
        price: feeAmount
      }
    ];
  };

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
      paymentId: paymentToUse.paymentId || paymentToUse._id,
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
        <div className="mb-6 flex gap-4">
          <Link href="/" className="text-blue-500 hover:underline">
            ← Back to Home
          </Link>
          {searchParams.get('page') && (
            <Link 
              href={`/invoices/list?page=${searchParams.get('page')}`} 
              className="text-blue-500 hover:underline"
            >
              ← Back to List
            </Link>
          )}
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
      <div className="mb-6 flex gap-4">
        <Link href="/" className="text-blue-500 hover:underline">
          ← Back to Home
        </Link>
        {searchParams.get('paymentId') && (
          <Link 
            href={`/invoices/list${searchParams.get('page') ? `?page=${searchParams.get('page')}` : ''}`} 
            className="text-blue-500 hover:underline"
          >
            ← Back to List
          </Link>
        )}
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
                onClick={async () => {
                  console.log('Preview button clicked. customerInvoice:', customerInvoice);
                  console.log('supplierInvoice:', supplierInvoice);
                  
                  // For individuals/lodge registrations, always ensure we have the proper custom invoice
                  if ((effectiveRegistration?.registrationType === 'individuals' || effectiveRegistration?.registrationType === 'lodge') && effectivePayment) {
                    try {
                      console.log(`🔄 Ensuring proper ${effectiveRegistration.registrationType} invoice before preview...`);
                      
                      // If we don't have a customer invoice or it's incomplete, generate it
                      if (!customerInvoice) {
                        const invoiceNumbers = await generateInvoiceNumbers(new Date(effectivePayment.timestamp || effectivePayment.createdAt || new Date()));
                        const baseInvoice = {
                          customerInvoiceNumber: invoiceNumbers.customerInvoiceNumber,
                          supplierInvoiceNumber: invoiceNumbers.supplierInvoiceNumber,
                          paymentId: effectivePayment.paymentId || effectivePayment._id,
                          registrationId: effectiveRegistration._id,
                          date: effectivePayment.timestamp || effectivePayment.createdAt || new Date().toISOString(),
                          status: 'paid'
                        };
                        
                        let customInvoice;
                        if (effectiveRegistration.registrationType === 'individuals') {
                          customInvoice = await generateCustomIndividualsInvoice(effectiveRegistration, effectivePayment, baseInvoice);
                        } else if (effectiveRegistration.registrationType === 'lodge') {
                          customInvoice = await generateCustomLodgeInvoice(effectiveRegistration, effectivePayment, baseInvoice);
                        }
                        
                        if (customInvoice) {
                          setCustomerInvoice(customInvoice);
                          setEditableInvoice(customInvoice);
                        }
                        
                        // Generate supplier invoice
                        const supplierInvoiceData = transformToSupplierInvoice(customInvoice, effectivePayment, effectiveRegistration);
                        setSupplierInvoice(supplierInvoiceData);
                      } else {
                        // Use existing customer invoice
                        setEditableInvoice(customerInvoice);
                      }
                      
                      setActiveInvoiceType('customer');
                      setShowInvoicePreviewModal(true);
                      
                      // Fetch related documents if we have a registration
                      if (effectiveRegistration?._id) {
                        fetchRelatedDocuments(effectiveRegistration._id);
                      }
                      return;
                    } catch (error) {
                      console.error('❌ Error generating individuals invoice for preview:', error);
                      // Fall through to standard logic if generation fails
                    }
                  }
                  
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
                    paymentId: effectivePayment.paymentId || effectivePayment._id,
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
                      setFieldMappingConfig(selectedMapping.mappings);
                      setCustomerFieldMappingConfig(selectedMapping.mappings);
                      
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
                      businessName: (effectiveRegistration?.businessName && effectiveRegistration?.businessName !== '-----') ? effectiveRegistration?.businessName : '',
                      businessNumber: (effectiveRegistration?.businessNumber && effectiveRegistration?.businessNumber !== '-----') ? effectiveRegistration?.businessNumber : '',
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
                  
                  // Create standard invoice for now (async logic moved to button handler)
                  const invoice = {
                    ...invoiceData,
                    supplier: DEFAULT_INVOICE_SUPPLIER,
                    status: 'paid',
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
                      source: effectivePayment.source || 'unknown' || 'unknown'
                    }
                  };
                  // Set up customer invoice with custom logic for individuals
                  let customerInvoiceData = { ...invoice, invoiceType: 'customer' as const };
                  
                  // Apply custom structure for 'individuals' or 'lodge' registration type
                  if (effectiveRegistration?.registrationType === 'individuals' || effectiveRegistration?.registrationType === 'lodge') {
                    console.log('🎯 CUSTOM REGISTRATION TYPE LOGIC TRIGGERED', {
                      registrationType: effectiveRegistration.registrationType,
                      registrationId: effectiveRegistration._id,
                      confirmationNumber: effectiveRegistration.confirmationNumber,
                      functionId: effectiveRegistration.functionId,
                      paymentAmount: getMonetaryValue(effectivePayment.grossAmount || effectivePayment.amount)
                    });
                    
                    try {
                      // Generate invoice numbers
                      const invoiceNumbers = await generateInvoiceNumbers(new Date(effectivePayment.timestamp || effectivePayment.createdAt || new Date()));
                      const baseInvoice = {
                        ...customerInvoiceData,
                        customerInvoiceNumber: invoiceNumbers.customerInvoiceNumber,
                        supplierInvoiceNumber: invoiceNumbers.supplierInvoiceNumber,
                        paymentId: effectivePayment.paymentId || effectivePayment._id,
                        registrationId: effectiveRegistration._id,
                        date: effectivePayment.timestamp || effectivePayment.createdAt || new Date().toISOString(),
                        status: 'paid'
                      };
                      
                      // Use appropriate generator based on registration type
                      let customInvoice;
                      if (effectiveRegistration.registrationType === 'individuals') {
                        customInvoice = await generateCustomIndividualsInvoice(effectiveRegistration, effectivePayment, baseInvoice);
                      } else if (effectiveRegistration.registrationType === 'lodge') {
                        customInvoice = await generateCustomLodgeInvoice(effectiveRegistration, effectivePayment, baseInvoice);
                      }
                      
                      if (customInvoice) {
                        customerInvoiceData = customInvoice;
                      }
                    } catch (error) {
                      console.error(`❌ ERROR in ${effectiveRegistration.registrationType} invoice generation:`, {
                        registrationId: effectiveRegistration._id,
                        confirmationNumber: effectiveRegistration.confirmationNumber,
                        error: error.message,
                        stack: error.stack,
                        effectiveRegistration: {
                          functionId: effectiveRegistration.functionId,
                          registrationType: effectiveRegistration.registrationType,
                          hasAttendees: !!effectiveRegistration.registrationData?.attendees?.length,
                          hasTickets: !!effectiveRegistration.registrationData?.tickets?.length
                        }
                      });
                      // Re-throw the error to maintain existing error handling
                      throw error;
                    }
                  }
                  
                  console.log('🎯 SETTING EDITABLE INVOICE:', customerInvoiceData);
                  console.log('🎯 SUPPLIER OBJECT:', customerInvoiceData?.supplier);
                  setEditableInvoice(customerInvoiceData);
                  setCustomerInvoice(customerInvoiceData);
                  
                  // Generate supplier invoice from customer invoice
                  const supplierInvoiceData = transformToSupplierInvoice(customerInvoiceData, effectivePayment, effectiveRegistration);
                  setSupplierInvoice(supplierInvoiceData);
                  
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
                      
                      // Generate supplier invoice from mapped customer invoice
                      const supplierInvoiceData = transformToSupplierInvoice(customerInvoiceWithMapping, effectivePayment, effectiveRegistration);
                      setSupplierInvoice(supplierInvoiceData);
                      // Store the mapping configuration including line items
                      const fullConfig = {
                        ...autoMapping.mappings,
                        lineItems: autoMapping.lineItems
                      };
                      setFieldMappingConfig(autoMapping.mappings);
                      setCustomerFieldMappingConfig(autoMapping.mappings);
                      
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
                // If customerInvoice state exists (set by useEffect for individuals), use it
                // Otherwise fall back to basic invoice structure for non-individuals registrations
                let invoiceData = customerInvoice;
                
                if (!invoiceData) {
                  const fullName = effectivePayment.customerName || effectiveRegistration?.customerName || effectiveRegistration?.primaryAttendee || 'Unknown Customer';
                  const nameParts = fullName.split(' ');
                  invoiceData = {
                    ...currentMatch.invoice,
                    invoiceType: 'customer',
                    paymentId: effectivePayment.paymentId || effectivePayment._id,
                    registrationId: effectiveRegistration?._id,
                    supplier: DEFAULT_INVOICE_SUPPLIER,
                    billTo: {
                      businessName: (effectiveRegistration?.businessName && effectiveRegistration?.businessName !== '-----') ? effectiveRegistration?.businessName : '',
                      businessNumber: (effectiveRegistration?.businessNumber && effectiveRegistration?.businessNumber !== '-----') ? effectiveRegistration?.businessNumber : '',
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
                      source: effectivePayment.source || 'unknown'
                    }
                  };
                }
                
                return (
                  <JsonViewer 
                    data={invoiceData} 
                    title="Customer Invoice Preview" 
                  />
                );
              })()}

              {/* Supplier Invoice Preview */}
              {(() => {
                // Create default supplier invoice if not already created
                const defaultSupplierInvoice = customerInvoice ? transformToSupplierInvoice(customerInvoice, effectivePayment, effectiveRegistration) : null;
                
                // The transformToSupplierInvoice function now automatically generates the correct items
                
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
          disabled={processing || unifiedLoading}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
        >
          {(processing || unifiedLoading) ? 'Creating Invoice...' : 'Create Invoice'}
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
                        Payment: {result.document.paymentId || result.document.transactionId || 'No ID'}
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
                      
                      // Generate supplier invoice from updated customer invoice
                      const supplierInvoiceData = transformToSupplierInvoice(invoiceToSet, effectivePayment, effectiveRegistration);
                      setSupplierInvoice(supplierInvoiceData);
                      
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
                      const newSupplierInvoice = transformToSupplierInvoice(customerInvoice, effectivePayment, effectiveRegistration);
                      
                      if (newSupplierInvoice) {
                        // The transformToSupplierInvoice function now automatically generates the correct items and totals
                        
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
                            console.log('Mapping has items?', mapping?.items);
                            console.log('Mapping has arrayMappings?', mapping?.arrayMappings);
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
                          {(fieldMappingConfig.processingFees as any)?.isCalculated && (
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
                      // Try to find the invoice component's root div
                      let invoiceElement = invoiceWrapper?.querySelector('div[style*="backgroundColor"]') as HTMLElement;
                      if (!invoiceElement && invoiceWrapper) {
                        // Fallback: get the first child div
                        invoiceElement = invoiceWrapper.querySelector('div') as HTMLElement;
                      }
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
                  {editableInvoice ? (() => {
                    const invoiceData = {
                      ...editableInvoice,
                      billTo: fieldMappings.billTo || editableInvoice.billTo || {}
                    };
                    console.log('🎯 INVOICE DATA PASSED TO COMPONENT:', invoiceData);
                    console.log('🎯 PAYMENT OBJECT:', invoiceData?.payment);
                    console.log('🎯 PAYMENT SOURCE:', invoiceData?.payment?.source);
                    
                    return (
                      <InvoiceComponent 
                        invoice={invoiceData} 
                        className="h-full"
                        logoBase64={logoBase64}
                        confirmationNumber={invoiceData.invoiceNumber}
                        functionName="Grand Proclamation 2025"
                      />
                    );
                  })() : (
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