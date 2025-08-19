import { ImportQueueItem, ValidationErrorItem } from '../types/payment-import';

/**
 * Import Validation Service
 * 
 * Comprehensive validation for payment imports and queue items
 * Ensures data integrity before importing to main database
 */

export class ImportValidationService {
  /**
   * Validate an import queue item
   */
  static validateQueueItem(item: ImportQueueItem): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    
    // Run all validation checks
    errors.push(...this.validatePaymentData(item));
    errors.push(...this.validateRegistrationData(item));
    errors.push(...this.validateAmountMatch(item));
    errors.push(...this.validateCustomerMatch(item));
    errors.push(...this.validateDateConsistency(item));
    errors.push(...this.validateDuplicates(item));
    errors.push(...this.validateBusinessRules(item));
    
    return errors;
  }
  
  /**
   * Validate payment data
   */
  private static validatePaymentData(item: ImportQueueItem): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    const payment = item.paymentData;
    
    // Required fields
    if (!payment.squarePaymentId) {
      errors.push({
        field: 'paymentId',
        message: 'Payment ID is required',
        severity: 'error'
      });
    }
    
    if (!payment.amount || payment.amount <= 0) {
      errors.push({
        field: 'amount',
        message: 'Payment amount must be greater than 0',
        severity: 'error'
      });
    }
    
    if (!payment.currency) {
      errors.push({
        field: 'currency',
        message: 'Payment currency is required',
        severity: 'error'
      });
    }
    
    if (!payment.status) {
      errors.push({
        field: 'status',
        message: 'Payment status is required',
        severity: 'error'
      });
    }
    
    // Status validation - only allow completed/paid payments
    const validStatuses = ['COMPLETED', 'APPROVED', 'completed', 'approved', 'paid', 'succeeded', 'success'];
    if (payment.status && !validStatuses.includes(payment.status)) {
      errors.push({
        field: 'status',
        message: `Payment status '${payment.status}' is not valid for import. Only completed/paid payments are allowed.`,
        severity: 'error'
      });
    }
    
    // Date validation
    if (!payment.createdAt) {
      errors.push({
        field: 'createdAt',
        message: 'Payment date is required',
        severity: 'error'
      });
    } else {
      const paymentDate = new Date(payment.createdAt);
      const now = new Date();
      
      if (paymentDate > now) {
        errors.push({
          field: 'createdAt',
          message: 'Payment date cannot be in the future',
          severity: 'error'
        });
      }
      
      // Warn if payment is very old
      const daysDiff = (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        errors.push({
          field: 'createdAt',
          message: 'Payment is over 1 year old',
          severity: 'warning'
        });
      }
    }
    
    // Customer information
    if (!payment.customerEmail && !payment.customerName) {
      errors.push({
        field: 'customer',
        message: 'No customer information available',
        severity: 'warning'
      });
    }
    
    if (payment.customerEmail && !this.isValidEmail(payment.customerEmail)) {
      errors.push({
        field: 'customerEmail',
        message: 'Invalid email format',
        severity: 'error'
      });
    }
    
    return errors;
  }
  
  /**
   * Validate registration data
   */
  private static validateRegistrationData(item: ImportQueueItem): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    const registration = item.registrationData;
    
    // Required fields
    if (!registration.id) {
      errors.push({
        field: 'registrationId',
        message: 'Registration ID is required',
        severity: 'error'
      });
    }
    
    if (!registration.email) {
      errors.push({
        field: 'email',
        message: 'Registration email is required',
        severity: 'error'
      });
    } else if (!this.isValidEmail(registration.email)) {
      errors.push({
        field: 'email',
        message: 'Invalid registration email format',
        severity: 'error'
      });
    }
    
    if (!registration.registration_type) {
      errors.push({
        field: 'registrationType',
        message: 'Registration type is required',
        severity: 'error'
      });
    }
    
    // Amount validation
    if (registration.total_amount === undefined || registration.total_amount === null) {
      errors.push({
        field: 'totalAmount',
        message: 'Registration amount is required',
        severity: 'error'
      });
    } else if (registration.total_amount < 0) {
      errors.push({
        field: 'totalAmount',
        message: 'Registration amount cannot be negative',
        severity: 'error'
      });
    }
    
    // Name validation
    if (!registration.full_name && !registration.first_name && !registration.last_name) {
      errors.push({
        field: 'name',
        message: 'Registration has no name information',
        severity: 'warning'
      });
    }
    
    // Confirmation number
    if (!registration.confirmation_number && !item.generatedConfirmationNumber) {
      errors.push({
        field: 'confirmationNumber',
        message: 'No confirmation number available',
        severity: 'warning'
      });
    }
    
    return errors;
  }
  
  /**
   * Validate amount match between payment and registration
   */
  private static validateAmountMatch(item: ImportQueueItem): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    
    const paymentAmount = item.paymentData.amount;
    const registrationAmount = item.registrationData.total_amount;
    
    if (paymentAmount && registrationAmount) {
      const difference = Math.abs(paymentAmount - registrationAmount);
      const percentDiff = (difference / paymentAmount) * 100;
      
      if (difference > 0.01) { // More than 1 cent difference
        if (percentDiff > 5) {
          errors.push({
            field: 'amount',
            message: `Amount mismatch: Payment $${paymentAmount.toFixed(2)} vs Registration $${registrationAmount.toFixed(2)} (${percentDiff.toFixed(1)}% difference)`,
            severity: 'error'
          });
        } else if (percentDiff > 1) {
          errors.push({
            field: 'amount',
            message: `Minor amount difference: Payment $${paymentAmount.toFixed(2)} vs Registration $${registrationAmount.toFixed(2)}`,
            severity: 'warning'
          });
        }
      }
    }
    
    return errors;
  }
  
  /**
   * Validate customer information match
   */
  private static validateCustomerMatch(item: ImportQueueItem): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    
    const paymentEmail = item.paymentData.customerEmail?.toLowerCase();
    const registrationEmail = item.registrationData.email?.toLowerCase();
    
    if (paymentEmail && registrationEmail && paymentEmail !== registrationEmail) {
      errors.push({
        field: 'email',
        message: `Email mismatch: Payment '${paymentEmail}' vs Registration '${registrationEmail}'`,
        severity: 'warning'
      });
    }
    
    // Name validation
    const paymentName = item.paymentData.customerName?.toLowerCase();
    const registrationName = (
      item.registrationData.full_name || 
      `${item.registrationData.first_name || ''} ${item.registrationData.last_name || ''}`
    ).toLowerCase().trim();
    
    if (paymentName && registrationName) {
      const similarity = this.calculateNameSimilarity(paymentName, registrationName);
      
      if (similarity < 0.5) {
        errors.push({
          field: 'name',
          message: `Name mismatch: Payment '${item.paymentData.customerName}' vs Registration '${registrationName}'`,
          severity: 'warning'
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Validate date consistency
   */
  private static validateDateConsistency(item: ImportQueueItem): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    
    const paymentDate = new Date(item.paymentData.createdAt);
    const registrationDate = new Date(item.registrationData.created_at);
    
    // Payment should not be before registration
    if (paymentDate < registrationDate) {
      const daysDiff = Math.abs((registrationDate.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 1) { // More than 1 day before
        errors.push({
          field: 'date',
          message: `Payment date is ${Math.floor(daysDiff)} days before registration date`,
          severity: daysDiff > 7 ? 'error' : 'warning'
        });
      }
    }
    
    // Payment should be within reasonable time after registration
    const daysDiff = (paymentDate.getTime() - registrationDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
      errors.push({
        field: 'date',
        message: `Payment is ${Math.floor(daysDiff)} days after registration`,
        severity: 'warning'
      });
    }
    
    return errors;
  }
  
  /**
   * Check for potential duplicates
   */
  private static validateDuplicates(item: ImportQueueItem): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    
    // This would typically check against the database
    // For now, we'll just add a placeholder check
    if (item.paymentData.metadata?.possibleDuplicate) {
      errors.push({
        field: 'duplicate',
        message: 'This payment may already exist in the system',
        severity: 'warning'
      });
    }
    
    return errors;
  }
  
  /**
   * Validate business rules
   */
  private static validateBusinessRules(item: ImportQueueItem): ValidationErrorItem[] {
    const errors: ValidationErrorItem[] = [];
    
    // Match score validation
    if (item.matchScore < 40) {
      errors.push({
        field: 'matchScore',
        message: `Low match confidence score: ${item.matchScore}%`,
        severity: 'warning'
      });
    }
    
    // Registration type specific rules
    const regType = item.registrationData.registration_type?.toLowerCase();
    
    if (regType === 'lodge' && item.registrationData.total_amount < 100) {
      errors.push({
        field: 'amount',
        message: 'Lodge registration amount seems unusually low',
        severity: 'warning'
      });
    }
    
    if (regType === 'individual' && item.registrationData.total_amount > 1000) {
      errors.push({
        field: 'amount',
        message: 'Individual registration amount seems unusually high',
        severity: 'warning'
      });
    }
    
    // Payment method validation
    if (item.paymentData.paymentMethod === 'CASH') {
      errors.push({
        field: 'paymentMethod',
        message: 'Cash payments require manual verification',
        severity: 'warning'
      });
    }
    
    return errors;
  }
  
  /**
   * Email validation helper
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Calculate name similarity
   */
  private static calculateNameSimilarity(name1: string, name2: string): number {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    
    if (n1 === n2) return 1;
    
    // Simple character overlap ratio
    const chars1 = new Set(n1.split(''));
    const chars2 = new Set(n2.split(''));
    const intersection = new Set([...chars1].filter(x => chars2.has(x)));
    const union = new Set([...chars1, ...chars2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Get validation summary
   */
  static getValidationSummary(errors: ValidationErrorItem[]): {
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    criticalErrors: ValidationErrorItem[];
    warnings: ValidationErrorItem[];
  } {
    const criticalErrors = errors.filter(e => e.severity === 'error');
    const warnings = errors.filter(e => e.severity === 'warning');
    
    return {
      isValid: criticalErrors.length === 0,
      errorCount: criticalErrors.length,
      warningCount: warnings.length,
      criticalErrors,
      warnings
    };
  }
}