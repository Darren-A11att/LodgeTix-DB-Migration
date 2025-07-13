export interface MatchResult {
  registration: any;
  matchMethod: string;
  isMatch: boolean;
}

// ID-only field mappings - simplified for exact matching
export const ID_FIELD_MAPPINGS = {
  paymentId: {
    paymentPaths: [
      'paymentId',
      'transactionId',
      'originalData.PaymentIntent ID',
      'originalData.metadata.paymentId'
    ],
    registrationPaths: [
      'stripePaymentIntentId',
      'squarePaymentId',
      'stripe_payment_intent_id',
      'square_payment_id',
      'registrationData.stripePaymentIntentId',
      'registrationData.stripe_payment_intent_id',
      'registrationData.squarePaymentId',
      'registrationData.square_payment_id',
      'paymentInfo.stripe_payment_intent_id',
      'paymentInfo.square_payment_id',
      'paymentData.transactionId',
      'paymentData.paymentId'
    ]
  },
  registrationId: {
    paymentPaths: [
      'linkedRegistrationId',
      'matchedRegistrationId',
      'originalData.metadata.registrationId',
      'originalData.metadata.registration_id',
      'originalData.registrationId (metadata)'
    ],
    registrationPaths: [
      '_id',
      'registrationId',
      'registrationData.registrationId'
    ]
  },
  confirmationNumber: {
    paymentPaths: [
      'confirmationNumber',
      'transactionId' // Sometimes transaction ID is stored as confirmation
    ],
    registrationPaths: [
      'confirmationNumber',
      'confirmation_number'
    ]
  }
};

// Match methods (simplified)
export const MATCH_METHODS = {
  MANUAL: 'manual',
  PAYMENT_ID: 'paymentId',
  REGISTRATION_ID: 'registrationId', 
  CONFIRMATION_NUMBER: 'confirmationNumber',
  NO_MATCH: 'none'
};

// Helper function to extract nested values
export function extractValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current && typeof current === 'object') {
      // Handle array notation and special characters
      if (key.includes('(') || key.includes('[')) {
        return current[key] || null;
      }
      return current[key] || null;
    }
    return null;
  }, obj);
}

// Helper function to normalize values for comparison
export function normalizeValue(value: any): any {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'object' && value.$numberDecimal) {
    return parseFloat(value.$numberDecimal);
  }
  return value;
}

// Query builder for MongoDB searches - ID-only matching
export function buildIdOnlyQuery(payment: any): any {
  const idConditions: any[] = [];
  
  // Build conditions for each ID field type
  for (const [fieldType, mapping] of Object.entries(ID_FIELD_MAPPINGS)) {
    const paymentValues = mapping.paymentPaths
      .map(path => extractValue(payment, path))
      .filter(val => val !== null && val !== undefined && val !== '');
    
    if (paymentValues.length > 0) {
      const registrationConditions = mapping.registrationPaths.map(regPath => {
        return paymentValues.map(pVal => ({ [regPath]: pVal }));
      }).flat();
      
      if (registrationConditions.length > 0) {
        idConditions.push({ $or: registrationConditions });
      }
    }
  }
  
  // Return ID matches only, or empty query if no IDs
  return idConditions.length > 0 ? { $or: idConditions } : {};
}