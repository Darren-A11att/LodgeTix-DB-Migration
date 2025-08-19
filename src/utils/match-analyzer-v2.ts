export interface MatchDetail {
  valueType: 'paymentId' | 'registrationId' | 'confirmationNumber' | 'email' | 'amount' | 'accountId' | 'name' | 'address' | 'timestamp';
  paymentField: string;
  registrationPaths: string[];
  value: any;
  weight: number;
  priority: number;
}

// Priority-based field weights
const FIELD_PRIORITIES = {
  paymentId: { priority: 1, weight: 50 },        // Highest priority - REQUIRED
  registrationId: { priority: 2, weight: 30 },   // Very high priority
  amount: { priority: 3, weight: 10 },           // Financial fields
  processingFees: { priority: 4, weight: 5 },    // Financial fields
  email: { priority: 5, weight: 3 },             // Contact info
  name: { priority: 6, weight: 2 },              // Contact info
  timestamp: { priority: 7, weight: 1 }          // Weakest
};

// Extract payment IDs from payment record
export function extractPaymentIds(payment: any): string[] {
  const ids: string[] = [];
  
  // Direct payment ID fields
  if (payment.paymentId?.trim()) ids.push(payment.paymentId.trim());
  if (payment.transactionId?.trim()) ids.push(payment.transactionId.trim());
  
  // From original data
  if (payment.originalData?.['PaymentIntent ID']?.trim()) {
    ids.push(payment.originalData['PaymentIntent ID'].trim());
  }
  
  // From metadata
  if (payment.originalData?.metadata?.paymentId?.trim()) {
    ids.push(payment.originalData.metadata.paymentId.trim());
  }
  
  return [...new Set(ids)]; // Remove duplicates
}

// Extract registration IDs from payment record
export function extractRegistrationIds(payment: any): string[] {
  const ids: string[] = [];
  
  // From metadata
  if (payment.originalData?.metadata?.registrationId?.trim()) {
    ids.push(payment.originalData.metadata.registrationId.trim());
  }
  if (payment.originalData?.metadata?.registration_id?.trim()) {
    ids.push(payment.originalData.metadata.registration_id.trim());
  }
  if (payment.originalData?.['registrationId (metadata)']?.trim()) {
    ids.push(payment.originalData['registrationId (metadata)'].trim());
  }
  
  return [...new Set(ids)];
}

// Check if payment IDs exist in registration
export function findPaymentIdsInRegistration(paymentIds: string[], registration: any): MatchDetail[] {
  const matches: MatchDetail[] = [];
  
  for (const paymentId of paymentIds) {
    // Check top-level fields
    if (registration.stripePaymentIntentId === paymentId) {
      matches.push({
        valueType: 'paymentId',
        paymentField: 'paymentId/transactionId',
        registrationPaths: ['stripePaymentIntentId'],
        value: paymentId,
        weight: FIELD_PRIORITIES.paymentId.weight,
        priority: FIELD_PRIORITIES.paymentId.priority
      });
    }
    
    if (registration.squarePaymentId === paymentId) {
      matches.push({
        valueType: 'paymentId',
        paymentField: 'paymentId/transactionId',
        registrationPaths: ['squarePaymentId'],
        value: paymentId,
        weight: FIELD_PRIORITIES.paymentId.weight,
        priority: FIELD_PRIORITIES.paymentId.priority
      });
    }
    
    // Check nested fields
    if (registration.registrationData?.stripePaymentIntentId === paymentId) {
      matches.push({
        valueType: 'paymentId',
        paymentField: 'paymentId/transactionId',
        registrationPaths: ['registrationData.stripePaymentIntentId'],
        value: paymentId,
        weight: FIELD_PRIORITIES.paymentId.weight,
        priority: FIELD_PRIORITIES.paymentId.priority
      });
    }
    
    if (registration.registrationData?.stripe_payment_intent_id === paymentId) {
      matches.push({
        valueType: 'paymentId',
        paymentField: 'paymentId/transactionId',
        registrationPaths: ['registrationData.stripe_payment_intent_id'],
        value: paymentId,
        weight: FIELD_PRIORITIES.paymentId.weight,
        priority: FIELD_PRIORITIES.paymentId.priority
      });
    }
    
    if (registration.registrationData?.square_payment_id === paymentId) {
      matches.push({
        valueType: 'paymentId',
        paymentField: 'paymentId/transactionId',
        registrationPaths: ['registrationData.square_payment_id'],
        value: paymentId,
        weight: FIELD_PRIORITIES.paymentId.weight,
        priority: FIELD_PRIORITIES.paymentId.priority
      });
    }
  }
  
  return matches;
}

// Check if registration IDs match
export function findRegistrationIdsInRegistration(registrationIds: string[], registration: any): MatchDetail[] {
  const matches: MatchDetail[] = [];
  
  for (const regId of registrationIds) {
    if (registration.registrationId === regId || 
        registration.registrationData?.registrationId === regId ||
        registration._id?.toString() === regId) {
      matches.push({
        valueType: 'registrationId',
        paymentField: 'metadata.registrationId',
        registrationPaths: ['registrationId'],
        value: regId,
        weight: FIELD_PRIORITIES.registrationId.weight,
        priority: FIELD_PRIORITIES.registrationId.priority
      });
    }
  }
  
  return matches;
}

// Main matching function - REQUIRES payment ID match
export function analyzeMatchV2(payment: any, registration: any): { matches: MatchDetail[], isValid: boolean } {
  if (!registration) {
    return { matches: [], isValid: false };
  }
  
  const matches: MatchDetail[] = [];
  
  // STEP 1: Check for payment ID match (REQUIRED)
  const paymentIds = extractPaymentIds(payment);
  const paymentIdMatches = findPaymentIdsInRegistration(paymentIds, registration);
  
  // If no payment ID match, this is NOT a valid match
  if (paymentIdMatches.length === 0) {
    return { matches: [], isValid: false };
  }
  
  // Add payment ID matches
  matches.push(...paymentIdMatches);
  
  // STEP 2: Check for registration ID match (bonus confidence)
  const registrationIds = extractRegistrationIds(payment);
  if (registrationIds.length > 0) {
    const regIdMatches = findRegistrationIdsInRegistration(registrationIds, registration);
    matches.push(...regIdMatches);
  }
  
  // STEP 3: Check amounts
  const paymentAmount = payment.amount || payment.grossAmount;
  const registrationAmount = 
    registration.totalAmountPaid?.$numberDecimal ? parseFloat(registration.totalAmountPaid.$numberDecimal) :
    registration.totalAmountPaid ? parseFloat(registration.totalAmountPaid) :
    registration.totalAmount?.$numberDecimal ? parseFloat(registration.totalAmount.$numberDecimal) :
    registration.totalAmount ? parseFloat(registration.totalAmount) : null;
  
  if (paymentAmount && registrationAmount && Math.abs(paymentAmount - registrationAmount) < 0.10) {
    matches.push({
      valueType: 'amount',
      paymentField: 'amount',
      registrationPaths: ['totalAmountPaid'],
      value: `$${paymentAmount}`,
      weight: FIELD_PRIORITIES.amount.weight,
      priority: FIELD_PRIORITIES.amount.priority
    });
  }
  
  // STEP 4: Check processing fees
  const paymentFees = payment.feeAmount || payment.originalData?.Fee ? parseFloat(payment.originalData.Fee) : null;
  const registrationFees = 
    registration.stripeFee?.$numberDecimal ? parseFloat(registration.stripeFee.$numberDecimal) :
    registration.stripeFee ? parseFloat(registration.stripeFee) : null;
  
  if (paymentFees && registrationFees && Math.abs(paymentFees - registrationFees) < 0.10) {
    matches.push({
      valueType: 'amount',
      paymentField: 'feeAmount',
      registrationPaths: ['stripeFee'],
      value: `$${paymentFees}`,
      weight: FIELD_PRIORITIES.processingFees.weight,
      priority: FIELD_PRIORITIES.processingFees.priority
    });
  }
  
  // STEP 5: Check email (only adds confidence, not required)
  if (payment.customerEmail) {
    const emailLower = payment.customerEmail.toLowerCase().trim();
    const emailMatches = [];
    
    if (registration.customerEmail?.toLowerCase().trim() === emailLower) {
      emailMatches.push('customerEmail');
    }
    if (registration.registrationData?.bookingContact?.email?.toLowerCase().trim() === emailLower) {
      emailMatches.push('registrationData.bookingContact.email');
    }
    if (registration.registrationData?.bookingContact?.emailAddress?.toLowerCase().trim() === emailLower) {
      emailMatches.push('registrationData.bookingContact.emailAddress');
    }
    
    if (emailMatches.length > 0) {
      matches.push({
        valueType: 'email',
        paymentField: 'customerEmail',
        registrationPaths: emailMatches,
        value: payment.customerEmail,
        weight: FIELD_PRIORITIES.email.weight,
        priority: FIELD_PRIORITIES.email.priority
      });
    }
  }
  
  // STEP 6: Check name
  if (payment.customerName || payment.originalData?.['Card Name']) {
    const paymentName = (payment.customerName || payment.originalData['Card Name']).toLowerCase().trim();
    const nameMatches = [];
    
    if (registration.customerName?.toLowerCase().trim() === paymentName) {
      nameMatches.push('customerName');
    }
    if (registration.primaryAttendee?.toLowerCase().trim() === paymentName) {
      nameMatches.push('primaryAttendee');
    }
    
    // Check if payment name contains first and last name from registration
    const firstName = registration.registrationData?.bookingContact?.firstName?.toLowerCase() || '';
    const lastName = registration.registrationData?.bookingContact?.lastName?.toLowerCase() || '';
    if (firstName && lastName && paymentName.includes(firstName) && paymentName.includes(lastName)) {
      nameMatches.push('registrationData.bookingContact.firstName+lastName');
    }
    
    if (nameMatches.length > 0) {
      matches.push({
        valueType: 'name',
        paymentField: 'customerName',
        registrationPaths: nameMatches,
        value: payment.customerName || payment.originalData['Card Name'],
        weight: FIELD_PRIORITIES.name.weight,
        priority: FIELD_PRIORITIES.name.priority
      });
    }
  }
  
  return { matches, isValid: true };
}

// Calculate confidence from matches
export function calculateConfidenceV2(matches: MatchDetail[]): number {
  let totalWeight = 0;
  const uniqueTypes = new Set<string>();
  
  for (const match of matches) {
    const typeKey = `${match.valueType}:${match.value}`;
    if (!uniqueTypes.has(typeKey)) {
      uniqueTypes.add(typeKey);
      totalWeight += match.weight;
    }
  }
  
  return Math.min(totalWeight, 100);
}

// Get fields to highlight
export function getHighlightFieldsV2(matches: MatchDetail[]): {
  paymentFields: string[];
  registrationFields: string[];
} {
  const paymentFields: string[] = [];
  const registrationFields: string[] = [];
  
  for (const match of matches) {
    paymentFields.push(match.paymentField);
    registrationFields.push(...match.registrationPaths);
  }
  
  return {
    paymentFields: [...new Set(paymentFields)],
    registrationFields: [...new Set(registrationFields)]
  };
}