export interface FieldMatch {
  fieldName: string;
  paymentValue: any;
  registrationValue: any;
  paymentPath: string;
  registrationPath: string;
  points: number;
}

export interface MatchResult {
  registration: any;
  matches: FieldMatch[];
  totalPoints: number;
  confidence: number;
  matchCount: number;
}

// Type for field definitions
interface FieldDefinition {
  name: string;
  points: number;
  extractFromPayment: (p: any) => Array<{ value: any; path: string }>;
  extractFromRegistration: (r: any) => Array<{ value: any; path: string }>;
  compareValues?: (pVal: any, rVal: any) => boolean;
}

// Field definitions with point values matching your requirements
const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    name: 'paymentId',
    points: 50,  // 50% weight - REQUIRED
    extractFromPayment: (p: any) => {
      const ids = [];
      if (p.paymentId) ids.push({ value: p.paymentId, path: 'paymentId' });
      if (p.transactionId) ids.push({ value: p.transactionId, path: 'transactionId' });
      if (p.originalData?.['PaymentIntent ID']) ids.push({ value: p.originalData['PaymentIntent ID'], path: 'originalData.PaymentIntent ID' });
      if (p.originalData?.metadata?.paymentId) ids.push({ value: p.originalData.metadata.paymentId, path: 'originalData.metadata.paymentId' });
      return ids;
    },
    extractFromRegistration: (r: any) => {
      const ids = [];
      if (r.stripePaymentIntentId) ids.push({ value: r.stripePaymentIntentId, path: 'stripePaymentIntentId' });
      if (r.squarePaymentId) ids.push({ value: r.squarePaymentId, path: 'squarePaymentId' });
      if (r.registrationData?.stripePaymentIntentId) ids.push({ value: r.registrationData.stripePaymentIntentId, path: 'registrationData.stripePaymentIntentId' });
      if (r.registrationData?.stripe_payment_intent_id) ids.push({ value: r.registrationData.stripe_payment_intent_id, path: 'registrationData.stripe_payment_intent_id' });
      return ids;
    }
  },
  {
    name: 'registrationId',
    points: 30,  // 30% weight - Strong indicator
    extractFromPayment: (p: any) => {
      const ids = [];
      if (p.originalData?.metadata?.registrationId) ids.push({ value: p.originalData.metadata.registrationId, path: 'originalData.metadata.registrationId' });
      if (p.originalData?.metadata?.registration_id) ids.push({ value: p.originalData.metadata.registration_id, path: 'originalData.metadata.registration_id' });
      if (p.originalData?.['registrationId (metadata)']) ids.push({ value: p.originalData['registrationId (metadata)'], path: 'originalData.registrationId (metadata)' });
      return ids;
    },
    extractFromRegistration: (r: any) => {
      const ids = [];
      if (r.registrationId) ids.push({ value: r.registrationId, path: 'registrationId' });
      if (r.registrationData?.registrationId) ids.push({ value: r.registrationData.registrationId, path: 'registrationData.registrationId' });
      return ids;
    }
  },
  {
    name: 'totalAmount',
    points: 10,  // 10% weight - Financial validation
    extractFromPayment: (p: any) => {
      const amounts = [];
      if (p.amount) amounts.push({ value: p.amount, path: 'amount' });
      if (p.grossAmount) amounts.push({ value: p.grossAmount, path: 'grossAmount' });
      return amounts;
    },
    extractFromRegistration: (r: any) => {
      const amounts = [];
      if (r.totalAmountPaid?.$numberDecimal) amounts.push({ value: parseFloat(r.totalAmountPaid.$numberDecimal), path: 'totalAmountPaid' });
      else if (r.totalAmountPaid) amounts.push({ value: parseFloat(r.totalAmountPaid), path: 'totalAmountPaid' });
      if (r.totalAmount?.$numberDecimal) amounts.push({ value: parseFloat(r.totalAmount.$numberDecimal), path: 'totalAmount' });
      else if (r.totalAmount) amounts.push({ value: parseFloat(r.totalAmount), path: 'totalAmount' });
      return amounts;
    },
    compareValues: (pVal: number, rVal: number) => Math.abs(pVal - rVal) < 0.10
  },
  {
    name: 'processingFees',
    points: 5,  // 5% weight - Additional financial check
    extractFromPayment: (p: any) => {
      const fees = [];
      if (p.feeAmount) fees.push({ value: p.feeAmount, path: 'feeAmount' });
      if (p.originalData?.Fee) fees.push({ value: parseFloat(p.originalData.Fee), path: 'originalData.Fee' });
      if (p.originalData?.metadata?.processing_fees) fees.push({ value: parseFloat(p.originalData.metadata.processing_fees), path: 'originalData.metadata.processing_fees' });
      return fees;
    },
    extractFromRegistration: (r: any) => {
      const fees = [];
      if (r.stripeFee?.$numberDecimal) fees.push({ value: parseFloat(r.stripeFee.$numberDecimal), path: 'stripeFee' });
      else if (r.stripeFee) fees.push({ value: parseFloat(r.stripeFee), path: 'stripeFee' });
      if (r.squareFee?.$numberDecimal) fees.push({ value: parseFloat(r.squareFee.$numberDecimal), path: 'squareFee' });
      else if (r.squareFee) fees.push({ value: parseFloat(r.squareFee), path: 'squareFee' });
      return fees;
    },
    compareValues: (pVal: number, rVal: number) => Math.abs(pVal - rVal) < 0.10
  },
  {
    name: 'email',
    points: 3,  // 3% weight - Contact validation
    extractFromPayment: (p: any) => {
      const emails = [];
      if (p.customerEmail) emails.push({ value: p.customerEmail.toLowerCase().trim(), path: 'customerEmail' });
      if (p.originalData?.['Customer Email']) emails.push({ value: p.originalData['Customer Email'].toLowerCase().trim(), path: 'originalData.Customer Email' });
      return emails;
    },
    extractFromRegistration: (r: any) => {
      const emails = [];
      if (r.customerEmail) emails.push({ value: r.customerEmail.toLowerCase().trim(), path: 'customerEmail' });
      if (r.registrationData?.bookingContact?.email) emails.push({ value: r.registrationData.bookingContact.email.toLowerCase().trim(), path: 'registrationData.bookingContact.email' });
      if (r.registrationData?.bookingContact?.emailAddress) emails.push({ value: r.registrationData.bookingContact.emailAddress.toLowerCase().trim(), path: 'registrationData.bookingContact.emailAddress' });
      return emails;
    }
  },
  {
    name: 'name',
    points: 2,  // 2% weight - Identity confirmation
    extractFromPayment: (p: any) => {
      const names = [];
      if (p.customerName) names.push({ value: p.customerName.toLowerCase().trim(), path: 'customerName' });
      if (p.originalData?.['Card Name']) names.push({ value: p.originalData['Card Name'].toLowerCase().trim(), path: 'originalData.Card Name' });
      return names;
    },
    extractFromRegistration: (r: any) => {
      const names = [];
      if (r.customerName) names.push({ value: r.customerName.toLowerCase().trim(), path: 'customerName' });
      if (r.primaryAttendee) names.push({ value: r.primaryAttendee.toLowerCase().trim(), path: 'primaryAttendee' });
      
      // Combine first and last name
      const firstName = r.registrationData?.bookingContact?.firstName;
      const lastName = r.registrationData?.bookingContact?.lastName;
      if (firstName && lastName) {
        names.push({ value: `${firstName} ${lastName}`.toLowerCase().trim(), path: 'registrationData.bookingContact.firstName+lastName' });
      }
      return names;
    },
    compareValues: (pVal: string, rVal: string) => {
      // Check exact match or if one contains the other
      return pVal === rVal || pVal.includes(rVal) || rVal.includes(pVal);
    }
  },
  {
    name: 'timestamp',
    points: 1,  // 1% weight - Timing correlation
    extractFromPayment: (p: any) => {
      const timestamps = [];
      if (p.timestamp) timestamps.push({ value: new Date(p.timestamp), path: 'timestamp' });
      if (p.originalData?.['Created date (UTC)']) timestamps.push({ value: new Date(p.originalData['Created date (UTC)']), path: 'originalData.Created date (UTC)' });
      return timestamps;
    },
    extractFromRegistration: (r: any) => {
      const timestamps = [];
      if (r.created_at) timestamps.push({ value: new Date(r.created_at), path: 'created_at' });
      if (r.createdAt) timestamps.push({ value: new Date(r.createdAt), path: 'createdAt' });
      if (r.registrationData?.metadata?.created_at) timestamps.push({ value: new Date(r.registrationData.metadata.created_at), path: 'registrationData.metadata.created_at' });
      return timestamps;
    },
    compareValues: (pVal: Date, rVal: Date) => {
      // Within 30 minutes
      const diffMinutes = Math.abs(pVal.getTime() - rVal.getTime()) / (1000 * 60);
      return diffMinutes <= 30;
    }
  }
];

// Calculate matches between payment and registration
export function calculateMatches(payment: any, registration: any): FieldMatch[] {
  const matches: FieldMatch[] = [];
  
  for (const fieldDef of FIELD_DEFINITIONS) {
    const paymentValues = fieldDef.extractFromPayment(payment);
    const registrationValues = fieldDef.extractFromRegistration(registration);
    
    // Compare all payment values against all registration values
    for (const pVal of paymentValues) {
      for (const rVal of registrationValues) {
        let isMatch = false;
        
        // Skip empty values
        if (!pVal.value || !rVal.value) continue;
        
        // Use custom comparison if provided, otherwise exact match
        if (fieldDef.compareValues) {
          isMatch = fieldDef.compareValues(pVal.value, rVal.value);
        } else {
          isMatch = pVal.value === rVal.value;
        }
        
        if (isMatch) {
          matches.push({
            fieldName: fieldDef.name,
            paymentValue: pVal.value,
            registrationValue: rVal.value,
            paymentPath: pVal.path,
            registrationPath: rVal.path,
            points: fieldDef.points
          });
          // Only count one match per field type
          break;
        }
      }
      if (matches.some(m => m.fieldName === fieldDef.name)) break;
    }
  }
  
  return matches;
}

// Calculate confidence from matches
export function calculateMatchConfidence(matches: FieldMatch[]): { totalPoints: number; confidence: number } {
  const totalPossiblePoints = 101; // Sum of all weights: 50+30+10+5+3+2+1 = 101
  const totalPoints = matches.reduce((sum, match) => sum + match.points, 0);
  // Normalize to 100% max
  const confidence = Math.min(Math.round((totalPoints / totalPossiblePoints) * 100), 100);
  
  return { totalPoints, confidence };
}

// Find all potential registration matches for a payment
export async function findPotentialMatches(payment: any, registrationsCollection: any): Promise<any[]> {
  const queries = [];
  
  // Build queries for each field type
  // Payment IDs
  const paymentIds = FIELD_DEFINITIONS[0].extractFromPayment(payment).map(p => p.value).filter(Boolean);
  if (paymentIds.length > 0) {
    queries.push({
      $or: paymentIds.flatMap(id => [
        { stripePaymentIntentId: id },
        { squarePaymentId: id },
        { 'registrationData.stripePaymentIntentId': id },
        { 'registrationData.stripe_payment_intent_id': id }
      ])
    });
  }
  
  // Registration IDs
  const regIds = FIELD_DEFINITIONS[1].extractFromPayment(payment).map(p => p.value).filter(Boolean);
  if (regIds.length > 0) {
    queries.push({
      $or: regIds.map(id => ({ registrationId: id }))
    });
  }
  
  // Email
  const emails = FIELD_DEFINITIONS[5].extractFromPayment(payment).map(p => p.value).filter(Boolean);
  if (emails.length > 0) {
    queries.push({
      $or: emails.flatMap(email => [
        { customerEmail: new RegExp(`^${email}$`, 'i') },
        { 'registrationData.bookingContact.email': new RegExp(`^${email}$`, 'i') },
        { 'registrationData.bookingContact.emailAddress': new RegExp(`^${email}$`, 'i') }
      ])
    });
  }
  
  // Execute queries and combine results
  if (queries.length === 0) return [];
  
  const results = await registrationsCollection.find({ $or: queries }).toArray();
  
  // Remove duplicates
  const uniqueResults = [];
  const seenIds = new Set();
  for (const result of results) {
    const id = result._id.toString();
    if (!seenIds.has(id)) {
      seenIds.add(id);
      uniqueResults.push(result);
    }
  }
  
  return uniqueResults;
}

// Main function to find best match
export async function findBestMatch(
  payment: any, 
  registrationsCollection: any,
  excludeIds: Set<string> = new Set()
): Promise<MatchResult | null> {
  // Find all potential matches
  const potentialMatches = await findPotentialMatches(payment, registrationsCollection);
  
  // Filter out excluded registrations
  const availableMatches = potentialMatches.filter(r => !excludeIds.has(r._id.toString()));
  
  if (availableMatches.length === 0) return null;
  
  // Score each potential match
  let bestResult: MatchResult | null = null;
  let highestConfidence = 0;
  
  for (const registration of availableMatches) {
    const matches = calculateMatches(payment, registration);
    const { totalPoints, confidence } = calculateMatchConfidence(matches);
    
    if (confidence > highestConfidence) {
      highestConfidence = confidence;
      bestResult = {
        registration,
        matches,
        totalPoints,
        confidence,
        matchCount: matches.length
      };
    }
  }
  
  return bestResult;
}

// Convert to legacy format for compatibility
export function convertToLegacyMatchDetails(matches: FieldMatch[]): any[] {
  return matches.map(match => ({
    valueType: match.fieldName,
    paymentField: match.paymentPath,
    registrationPaths: [match.registrationPath],
    value: match.paymentValue,
    weight: match.points
  }));
}