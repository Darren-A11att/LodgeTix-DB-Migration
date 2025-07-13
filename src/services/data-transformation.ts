import { PaymentImport } from '../types/payment-import';

/**
 * Data Transformation Service
 * 
 * Handles transforming data between different formats:
 * - Square payments to standardized format
 * - Supabase registrations to MongoDB format
 * - Field mapping and normalization
 */

export class DataTransformationService {
  /**
   * Transform Square payment to standardized payment format
   */
  static transformSquarePayment(squarePayment: any): {
    paymentId: string;
    source: 'square';
    amount: number;
    currency: string;
    status: string;
    customerEmail?: string;
    customerName?: string;
    paymentMethod?: string;
    cardBrand?: string;
    last4?: string;
    createdAt: Date;
    metadata: Record<string, any>;
  } {
    // Parse amount from smallest currency unit
    const amount = squarePayment.amountMoney 
      ? parseInt(squarePayment.amountMoney.amount) / 100 
      : 0;
    
    // Extract customer name
    let customerName = undefined;
    if (squarePayment.shippingAddress) {
      const { firstName = '', lastName = '' } = squarePayment.shippingAddress;
      customerName = `${firstName} ${lastName}`.trim() || undefined;
    } else if (squarePayment.billingAddress) {
      const { firstName = '', lastName = '' } = squarePayment.billingAddress;
      customerName = `${firstName} ${lastName}`.trim() || undefined;
    }
    
    return {
      paymentId: squarePayment.id,
      source: 'square',
      amount,
      currency: squarePayment.amountMoney?.currency || 'USD',
      status: mapSquareStatus(squarePayment.status),
      customerEmail: squarePayment.buyerEmailAddress,
      customerName,
      paymentMethod: squarePayment.sourceType,
      cardBrand: squarePayment.cardDetails?.card?.cardBrand,
      last4: squarePayment.cardDetails?.card?.last4,
      createdAt: new Date(squarePayment.createdAt),
      metadata: {
        locationId: squarePayment.locationId,
        orderId: squarePayment.orderId,
        receiptUrl: squarePayment.receiptUrl,
        customerId: squarePayment.customerId,
        raw: squarePayment
      }
    };
  }
  
  /**
   * Transform Supabase registration to MongoDB format
   */
  static transformSupabaseRegistration(supabaseReg: any): {
    registrationId: string;
    confirmationNumber?: string;
    registrationType: string;
    email: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    totalAmount: number;
    status: string;
    attendees: any[];
    createdAt: Date;
    metadata: Record<string, any>;
  } {
    // Handle different name field formats
    let fullName = supabaseReg.full_name;
    let firstName = supabaseReg.first_name;
    let lastName = supabaseReg.last_name;
    
    if (!fullName && firstName && lastName) {
      fullName = `${firstName} ${lastName}`.trim();
    } else if (fullName && !firstName && !lastName) {
      const parts = fullName.split(' ');
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }
    
    return {
      registrationId: supabaseReg.id,
      confirmationNumber: supabaseReg.confirmation_number,
      registrationType: normalizeRegistrationType(supabaseReg.registration_type),
      email: supabaseReg.email,
      fullName,
      firstName,
      lastName,
      totalAmount: parseFloat(supabaseReg.total_amount || '0'),
      status: supabaseReg.payment_status || supabaseReg.status || 'pending',
      attendees: supabaseReg.attendees || [],
      createdAt: new Date(supabaseReg.created_at),
      metadata: {
        eventId: supabaseReg.event_id,
        lodgeId: supabaseReg.lodge_id,
        ticketTypeId: supabaseReg.ticket_type_id,
        raw: supabaseReg
      }
    };
  }
  
  /**
   * Transform payment import for matching
   */
  static preparePaymentForMatching(payment: PaymentImport): {
    searchableEmail: string;
    searchableAmount: number;
    searchableName: string;
    searchableDate: Date;
    searchableReference?: string;
  } {
    return {
      searchableEmail: (payment.customerEmail || '').toLowerCase().trim(),
      searchableAmount: payment.amount,
      searchableName: (payment.customerName || '').toLowerCase().trim(),
      searchableDate: new Date(payment.createdAt),
      searchableReference: payment.orderReference
    };
  }
  
  /**
   * Merge payment and registration data
   */
  static mergePaymentAndRegistration(
    payment: any,
    registration: any
  ): {
    // Payment fields
    paymentId: string;
    paymentSource: string;
    paymentAmount: number;
    paymentCurrency: string;
    paymentStatus: string;
    paymentMethod?: string;
    paymentDate: Date;
    
    // Registration fields
    registrationId: string;
    confirmationNumber: string;
    registrationType: string;
    
    // Customer fields
    customerEmail: string;
    customerName: string;
    
    // Combined metadata
    metadata: Record<string, any>;
  } {
    return {
      // Payment fields
      paymentId: payment.squarePaymentId || payment.paymentId,
      paymentSource: payment.source || 'square',
      paymentAmount: payment.amount,
      paymentCurrency: payment.currency || 'USD',
      paymentStatus: payment.status,
      paymentMethod: payment.paymentMethod,
      paymentDate: new Date(payment.createdAt),
      
      // Registration fields
      registrationId: registration.id || registration.registrationId,
      confirmationNumber: registration.confirmation_number || registration.confirmationNumber,
      registrationType: registration.registration_type || registration.registrationType,
      
      // Customer fields - prefer registration data as it's more reliable
      customerEmail: registration.email || payment.customerEmail,
      customerName: registration.full_name || registration.fullName || payment.customerName,
      
      // Combined metadata
      metadata: {
        payment: payment.metadata || {},
        registration: registration.metadata || {},
        matchedAt: new Date(),
        matchMethod: 'manual'
      }
    };
  }
  
  /**
   * Validate transformed data
   */
  static validateTransformedData(data: any): {
    isValid: boolean;
    errors: Array<{ field: string; message: string }>;
    warnings: Array<{ field: string; message: string }>;
  } {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];
    
    // Required fields
    if (!data.customerEmail) {
      errors.push({ field: 'customerEmail', message: 'Email is required' });
    }
    
    if (!data.paymentAmount || data.paymentAmount <= 0) {
      errors.push({ field: 'paymentAmount', message: 'Valid payment amount is required' });
    }
    
    if (!data.registrationId) {
      errors.push({ field: 'registrationId', message: 'Registration ID is required' });
    }
    
    // Warnings
    if (!data.confirmationNumber) {
      warnings.push({ field: 'confirmationNumber', message: 'No confirmation number - will be generated' });
    }
    
    if (!data.customerName) {
      warnings.push({ field: 'customerName', message: 'Customer name is missing' });
    }
    
    // Email validation
    if (data.customerEmail && !isValidEmail(data.customerEmail)) {
      errors.push({ field: 'customerEmail', message: 'Invalid email format' });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Helper functions
function mapSquareStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'COMPLETED': 'completed',
    'PENDING': 'pending',
    'FAILED': 'failed',
    'CANCELED': 'cancelled',
    'APPROVED': 'approved'
  };
  
  return statusMap[status] || status.toLowerCase();
}

function normalizeRegistrationType(type: string): string {
  if (!type) return 'unknown';
  
  const normalized = type.toLowerCase();
  if (normalized.includes('individual')) return 'individual';
  if (normalized.includes('lodge')) return 'lodge';
  if (normalized.includes('delegation')) return 'delegation';
  
  return normalized;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Export helper for field mapping configurations
export const FIELD_MAPPINGS = {
  payment: {
    square: {
      id: 'squarePaymentId',
      'amount_money.amount': 'amount',
      'amount_money.currency': 'currency',
      'buyer_email_address': 'customerEmail',
      'created_at': 'createdAt',
      'status': 'status',
      'source_type': 'paymentMethod',
      'card_details.card.brand': 'cardBrand',
      'card_details.card.last_4': 'last4'
    }
  },
  registration: {
    supabase: {
      id: 'registrationId',
      email: 'email',
      full_name: 'fullName',
      first_name: 'firstName',
      last_name: 'lastName',
      confirmation_number: 'confirmationNumber',
      registration_type: 'registrationType',
      total_amount: 'totalAmount',
      created_at: 'createdAt'
    }
  }
};