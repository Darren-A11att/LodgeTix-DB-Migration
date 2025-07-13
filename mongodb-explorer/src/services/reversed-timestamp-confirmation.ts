// Re-export from main project
export { 
  generateConfirmationNumber,
  generateForPaymentMatch,
  batchGenerateForPaymentMatches,
  isValidConfirmationNumber,
  getTypeFromConfirmationNumber
} from '../../../src/services/reversed-timestamp-confirmation';