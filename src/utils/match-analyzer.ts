export interface MatchDetail {
  valueType: 'paymentId' | 'registrationId' | 'confirmationNumber' | 'email' | 'amount' | 'accountId' | 'name' | 'address' | 'timestamp';
  paymentField: string;
  registrationPaths: string[];
  value: any;
  weight: number;
}

export interface ExtractedValue {
  value: string;
  sourceField: string;
  valueType: 'paymentId' | 'registrationId' | 'confirmationNumber' | 'email' | 'amount' | 'accountId' | 'name' | 'address';
  weight: number;
}

// Field weights for confidence calculation
const FIELD_WEIGHTS = {
  paymentId: 30,      // Most reliable
  registrationId: 25, // Very reliable
  confirmationNumber: 20, // Reliable
  accountId: 10,      // Good indicator
  email: 8,           // Moderate reliability
  name: 5,            // Supporting evidence
  address: 2,         // Weak indicator
  amount: 2,          // Weak indicator
  timestamp: 1        // Very weak indicator
};

// Extract all potential matching values from payment
function extractPaymentValues(payment: any): ExtractedValue[] {
  const values: ExtractedValue[] = [];
  
  // Payment IDs (highest priority)
  if (payment.paymentId && payment.paymentId.trim()) {
    values.push({ 
      value: payment.paymentId.trim(), 
      sourceField: 'paymentId', 
      valueType: 'paymentId', 
      weight: FIELD_WEIGHTS.paymentId 
    });
  }
  
  if (payment.transactionId && payment.transactionId.trim()) {
    values.push({ 
      value: payment.transactionId.trim(), 
      sourceField: 'transactionId', 
      valueType: 'paymentId', 
      weight: FIELD_WEIGHTS.paymentId 
    });
  }
  
  // Check originalData for various payment IDs
  if (payment.originalData) {
    if (payment.originalData['PaymentIntent ID'] && payment.originalData['PaymentIntent ID'].trim()) {
      values.push({ 
        value: payment.originalData['PaymentIntent ID'].trim(), 
        sourceField: 'originalData.PaymentIntent ID', 
        valueType: 'paymentId', 
        weight: FIELD_WEIGHTS.paymentId 
      });
    }
    
    // Extract from metadata
    if (payment.originalData.metadata) {
      const metadata = payment.originalData.metadata;
      
      if (metadata.paymentId && metadata.paymentId.trim()) {
        values.push({ 
          value: metadata.paymentId.trim(), 
          sourceField: 'metadata.paymentId', 
          valueType: 'paymentId', 
          weight: FIELD_WEIGHTS.paymentId 
        });
      }
      
      if (metadata.registrationId && metadata.registrationId.trim()) {
        values.push({ 
          value: metadata.registrationId.trim(), 
          sourceField: 'metadata.registrationId', 
          valueType: 'registrationId', 
          weight: FIELD_WEIGHTS.registrationId 
        });
      }
      
      if (metadata.confirmationNumber && metadata.confirmationNumber.trim()) {
        values.push({ 
          value: metadata.confirmationNumber.trim(), 
          sourceField: 'metadata.confirmationNumber', 
          valueType: 'confirmationNumber', 
          weight: FIELD_WEIGHTS.confirmationNumber 
        });
      }
      
      if (metadata.confirmation_number && metadata.confirmation_number.trim()) {
        values.push({ 
          value: metadata.confirmation_number.trim(), 
          sourceField: 'metadata.confirmation_number', 
          valueType: 'confirmationNumber', 
          weight: FIELD_WEIGHTS.confirmationNumber 
        });
      }
    }
    
    // Check for confirmation number in various formats
    if (payment.originalData['confirmation_number (metadata)'] && payment.originalData['confirmation_number (metadata)'].trim()) {
      values.push({ 
        value: payment.originalData['confirmation_number (metadata)'].trim(), 
        sourceField: 'originalData.confirmation_number (metadata)', 
        valueType: 'confirmationNumber', 
        weight: FIELD_WEIGHTS.confirmationNumber 
      });
    }
    
    // Check for registration ID in metadata format
    if (payment.originalData['registrationId (metadata)'] && payment.originalData['registrationId (metadata)'].trim()) {
      values.push({ 
        value: payment.originalData['registrationId (metadata)'].trim(), 
        sourceField: 'originalData.registrationId (metadata)', 
        valueType: 'registrationId', 
        weight: FIELD_WEIGHTS.registrationId 
      });
    }
    
    // Account IDs
    if (payment.originalData['stripe_onbehalfof (metadata)'] && payment.originalData['stripe_onbehalfof (metadata)'].trim()) {
      values.push({ 
        value: payment.originalData['stripe_onbehalfof (metadata)'].trim(), 
        sourceField: 'originalData.stripe_onbehalfof (metadata)', 
        valueType: 'accountId', 
        weight: FIELD_WEIGHTS.accountId 
      });
    }
    
    if (payment.originalData.Destination && payment.originalData.Destination.trim()) {
      values.push({ 
        value: payment.originalData.Destination.trim(), 
        sourceField: 'originalData.Destination', 
        valueType: 'accountId', 
        weight: FIELD_WEIGHTS.accountId 
      });
    }
  }
  
  // Connected account ID
  if (payment.connectedAccountId && payment.connectedAccountId.trim()) {
    values.push({ 
      value: payment.connectedAccountId.trim(), 
      sourceField: 'connectedAccountId', 
      valueType: 'accountId', 
      weight: FIELD_WEIGHTS.accountId 
    });
  }
  
  // Email
  if (payment.customerEmail && payment.customerEmail.trim()) {
    values.push({ 
      value: payment.customerEmail.toLowerCase().trim(), 
      sourceField: 'customerEmail', 
      valueType: 'email', 
      weight: FIELD_WEIGHTS.email 
    });
  }
  
  // Name
  if (payment.customerName && payment.customerName.trim()) {
    values.push({ 
      value: payment.customerName.trim(), 
      sourceField: 'customerName', 
      valueType: 'name', 
      weight: FIELD_WEIGHTS.name 
    });
  }
  
  if (payment.originalData?.['Card Name'] && payment.originalData['Card Name'].trim()) {
    values.push({ 
      value: payment.originalData['Card Name'].trim(), 
      sourceField: 'originalData.Card Name', 
      valueType: 'name', 
      weight: FIELD_WEIGHTS.name 
    });
  }
  
  // Remove duplicates by value
  const uniqueValues: ExtractedValue[] = [];
  const seenValues = new Set<string>();
  
  for (const extractedValue of values) {
    const key = `${extractedValue.valueType}:${extractedValue.value}`;
    if (!seenValues.has(key)) {
      seenValues.add(key);
      uniqueValues.push(extractedValue);
    }
  }
  
  return uniqueValues;
}

// Recursively search for a value anywhere in the registration object
function findValueInObject(obj: any, searchValue: string, currentPath: string = ''): { found: boolean; paths: string[] } {
  const paths: string[] = [];
  
  if (!obj) {
    return { found: false, paths: [] };
  }
  
  // Handle primitive values
  if (typeof obj !== 'object') {
    if (String(obj).toLowerCase().trim() === searchValue.toLowerCase().trim()) {
      return { found: true, paths: [currentPath] };
    }
    return { found: false, paths: [] };
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const arrayPath = currentPath ? `${currentPath}[${index}]` : `[${index}]`;
      const result = findValueInObject(item, searchValue, arrayPath);
      paths.push(...result.paths);
    });
  } else {
    // Handle objects
    for (const [key, value] of Object.entries(obj)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      
      if (value === null || value === undefined) continue;
      
      // Check if this value matches our search
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        if (String(value).toLowerCase().trim() === searchValue.toLowerCase().trim()) {
          // This is the exact field that matches
          paths.push(newPath);
        }
      } else if (typeof value === 'object') {
        // Continue searching in nested objects
        const result = findValueInObject(value, searchValue, newPath);
        paths.push(...result.paths);
      }
    }
  }
  
  return { found: paths.length > 0, paths };
}

// Find amount values in registration
function findAmountInRegistration(registration: any): number | null {
  const possibleAmounts = [
    registration?.totalAmountPaid?.$numberDecimal,
    registration?.totalAmount?.$numberDecimal,
    registration?.totalAmountPaid,
    registration?.totalAmount,
    registration?.registrationData?.totalAmountPaid,
    registration?.registrationData?.totalAmount
  ];
  
  for (const amount of possibleAmounts) {
    if (amount !== null && amount !== undefined) {
      return parseFloat(String(amount));
    }
  }
  
  return null;
}

// Check if date is in Australian DST period
function isAustralianDST(date: Date): boolean {
  const year = date.getFullYear();
  // DST starts first Sunday in October
  const dstStart = new Date(year, 9, 1); // October 1
  while (dstStart.getDay() !== 0) dstStart.setDate(dstStart.getDate() + 1);
  
  // DST ends first Sunday in April
  const dstEnd = new Date(year, 3, 1); // April 1
  while (dstEnd.getDay() !== 0) dstEnd.setDate(dstEnd.getDate() + 1);
  
  return date >= dstStart || date < dstEnd;
}

// Handle AEST to UTC conversion
function normalizeTimestamp(timestamp: string, sourceTimezone: 'UTC' | 'AEST'): Date {
  const date = new Date(timestamp);
  
  if (sourceTimezone === 'AEST') {
    // Convert AEST to UTC
    const isDST = isAustralianDST(date);
    const hoursOffset = isDST ? 11 : 10;
    // Add hours to get UTC (AEST is ahead of UTC)
    date.setHours(date.getHours() - hoursOffset);
  }
  
  return date;
}

// Check if timestamps match within tolerance
function timestampsMatch(paymentTime: string, registrationTime: string): boolean {
  try {
    // Payment is in AEST, registration is in UTC
    const paymentUTC = normalizeTimestamp(paymentTime, 'AEST');
    const registrationUTC = new Date(registrationTime);
    
    // Allow up to 30 minutes difference
    const diffMinutes = Math.abs(paymentUTC.getTime() - registrationUTC.getTime()) / (1000 * 60);
    return diffMinutes <= 30;
  } catch (error) {
    return false;
  }
}

// Main matching function
export function analyzeMatch(payment: any, registration: any): MatchDetail[] {
  if (!registration) {
    return [];
  }
  
  const matches: MatchDetail[] = [];
  const paymentValues = extractPaymentValues(payment);
  
  // Search for each payment value in the registration
  for (const paymentValue of paymentValues) {
    const searchResult = findValueInObject(registration, paymentValue.value);
    
    if (searchResult.found && searchResult.paths.length > 0) {
      // Debug log for email matches
      if (paymentValue.valueType === 'email') {
        console.log(`Email match found: "${paymentValue.value}" at paths:`, searchResult.paths);
      }
      
      matches.push({
        valueType: paymentValue.valueType,
        paymentField: paymentValue.sourceField,
        registrationPaths: searchResult.paths,
        value: paymentValue.value,
        weight: paymentValue.weight
      });
    }
  }
  
  // Special handling for amounts (with tolerance)
  const paymentAmount = payment.amount || payment.grossAmount;
  const registrationAmount = findAmountInRegistration(registration);
  
  if (paymentAmount && registrationAmount) {
    const amountDiff = Math.abs(paymentAmount - registrationAmount);
    if (amountDiff < 0.10) {
      matches.push({
        valueType: 'amount',
        paymentField: payment.amount ? 'amount' : 'grossAmount',
        registrationPaths: ['totalAmountPaid or totalAmount'],
        value: `$${paymentAmount} ≈ $${registrationAmount}`,
        weight: FIELD_WEIGHTS.amount
      });
    }
  }
  
  // Timezone-aware timestamp matching
  if (payment.timestamp && registration.created_at) {
    if (timestampsMatch(payment.timestamp, registration.created_at)) {
      matches.push({
        valueType: 'timestamp',
        paymentField: 'timestamp',
        registrationPaths: ['created_at'],
        value: 'within 30 minutes',
        weight: FIELD_WEIGHTS.timestamp
      });
    }
  }
  
  return matches;
}

// Calculate total confidence from matches
export function calculateConfidence(matches: MatchDetail[]): number {
  // Use a Set to track which value types we've already counted
  const countedTypes = new Set<string>();
  let totalConfidence = 0;
  
  for (const match of matches) {
    const typeKey = `${match.valueType}:${match.value}`;
    if (!countedTypes.has(typeKey)) {
      countedTypes.add(typeKey);
      totalConfidence += match.weight;
    }
  }
  
  return Math.min(totalConfidence, 100);
}

// Get fields to highlight in UI
export function getHighlightFields(matches: MatchDetail[]): {
  paymentFields: string[];
  registrationFields: string[];
} {
  const paymentFields: string[] = [];
  const registrationFields: string[] = [];
  
  for (const match of matches) {
    paymentFields.push(match.paymentField);
    registrationFields.push(...match.registrationPaths);
  }
  
  // Remove duplicates
  return {
    paymentFields: [...new Set(paymentFields)],
    registrationFields: [...new Set(registrationFields)]
  };
}