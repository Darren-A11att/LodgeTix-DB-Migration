// Import and re-export from utils
import { 
  generateConfirmationNumber,
  isValidConfirmationNumber,
  getRegistrationTypeFromConfirmationNumber
} from '@/utils/confirmation-number';

export { 
  generateConfirmationNumber,
  isValidConfirmationNumber,
  getRegistrationTypeFromConfirmationNumber as getTypeFromConfirmationNumber
};

// Add stub implementations for missing functions
export function generateForPaymentMatch(payment: any) {
  return generateConfirmationNumber('individuals');
}

export function batchGenerateForPaymentMatches(payments: any[]) {
  return payments.map(p => generateForPaymentMatch(p));
}
