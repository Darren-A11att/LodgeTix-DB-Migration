// Re-export from main project
export { 
  generateConfirmationNumber,
  generateForPaymentMatch,
  batchGenerateForPaymentMatches,
  isValidConfirmationNumber,
  getTypeFromConfirmationNumber
} from '@/services/reversed-timestamp-confirmation';
