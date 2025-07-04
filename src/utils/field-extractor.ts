export interface FieldOption {
  path: string;
  value: any;
  source: 'payment' | 'registration' | 'related';
  displayPath: string;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'object';
}

/**
 * Recursively extract all field paths and values from an object
 */
function extractFieldsFromObject(
  obj: any, 
  source: 'payment' | 'registration' | 'related',
  basePath: string = '',
  baseDisplayPath: string = ''
): FieldOption[] {
  const fields: FieldOption[] = [];
  
  if (!obj || typeof obj !== 'object') {
    return fields;
  }

  // Skip certain fields that shouldn't be mapped
  const skipFields = ['_id', '__v', 'createdAt', 'updatedAt', 'timestamp'];

  Object.entries(obj).forEach(([key, value]) => {
    if (skipFields.includes(key)) return;

    const path = basePath ? `${basePath}.${key}` : key;
    const displayPath = baseDisplayPath ? `${baseDisplayPath}.${key}` : `${source}.${key}`;

    // Include null/undefined values as they can still be mapped
    if (value === null || value === undefined) {
      fields.push({
        path,
        value: '',
        source,
        displayPath,
        dataType: 'string'
      });
      return;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length > 0) {
        // For arrays of objects, extract from first item
        if (typeof value[0] === 'object') {
          value.forEach((item, index) => {
            const arrayPath = `${path}[${index}]`;
            const arrayDisplayPath = `${displayPath}[${index}]`;
            fields.push(...extractFieldsFromObject(item, source, arrayPath, arrayDisplayPath));
          });
        } else {
          // Array of primitives
          fields.push({
            path,
            value: value.join(', '),
            source,
            displayPath,
            dataType: 'string'
          });
        }
      }
    } 
    // Handle objects
    else if (typeof value === 'object' && !(value instanceof Date)) {
      fields.push(...extractFieldsFromObject(value, source, path, displayPath));
    } 
    // Handle primitives
    else {
      let dataType: FieldOption['dataType'] = 'string';
      if (typeof value === 'number') dataType = 'number';
      else if (typeof value === 'boolean') dataType = 'boolean';
      else if (value instanceof Date) dataType = 'date';

      fields.push({
        path,
        value,
        source,
        displayPath,
        dataType
      });
    }
  });

  return fields;
}

/**
 * Extract all possible field values from payment and registration data
 */
export function extractAllFieldOptions(payment: any, registration: any): FieldOption[] {
  const fields: FieldOption[] = [];

  // Extract from payment
  if (payment) {
    fields.push(...extractFieldsFromObject(payment, 'payment'));
  }

  // Extract from registration
  if (registration) {
    fields.push(...extractFieldsFromObject(registration, 'registration'));
  }

  // Add some common calculated/derived fields
  if (payment?.customerName) {
    const nameParts = payment.customerName.split(' ');
    if (nameParts.length >= 2) {
      fields.push({
        path: 'customerName.firstName',
        value: nameParts[0],
        source: 'payment',
        displayPath: 'payment.customerName (first)',
        dataType: 'string'
      });
      fields.push({
        path: 'customerName.lastName',
        value: nameParts.slice(1).join(' '),
        source: 'payment',
        displayPath: 'payment.customerName (last)',
        dataType: 'string'
      });
    }
  }

  if (registration?.primaryAttendee) {
    const nameParts = registration.primaryAttendee.split(' ');
    if (nameParts.length >= 2) {
      fields.push({
        path: 'primaryAttendee.firstName',
        value: nameParts[0],
        source: 'registration',
        displayPath: 'registration.primaryAttendee (first)',
        dataType: 'string'
      });
      fields.push({
        path: 'primaryAttendee.lastName',
        value: nameParts.slice(1).join(' '),
        source: 'registration',
        displayPath: 'registration.primaryAttendee (last)',
        dataType: 'string'
      });
    }
  }

  // Remove duplicates based on value and source
  const uniqueFields = fields.filter((field, index, self) =>
    index === self.findIndex((f) => 
      f.value === field.value && f.source === field.source && f.path === field.path
    )
  );

  return uniqueFields;
}

/**
 * Extract fields from related documents
 */
export function extractRelatedDocumentFields(relatedDocs: any): FieldOption[] {
  const fields: FieldOption[] = [];
  
  if (!relatedDocs?.relatedDocuments) return fields;
  
  const { relatedDocuments } = relatedDocs;
  
  // Extract from each document type
  const docTypes = ['eventTickets', 'events', 'packages', 'lodges', 'customers', 'bookingContacts', 'functions'];
  
  docTypes.forEach(docType => {
    if (relatedDocuments[docType] && Array.isArray(relatedDocuments[docType])) {
      relatedDocuments[docType].forEach((doc: any, index: number) => {
        const basePath = `relatedDocuments.${docType}[${index}]`;
        const baseDisplayPath = `related.${docType}[${index}]`;
        fields.push(...extractFieldsFromObject(doc, 'related', basePath, baseDisplayPath));
      });
    }
  });
  
  return fields;
}

/**
 * Get smart suggestions for a specific invoice field based on field name
 */
export function getSmartSuggestions(
  fieldName: string, 
  allOptions: FieldOption[]
): FieldOption[] {
  const suggestions: FieldOption[] = [];
  const fieldLower = fieldName.toLowerCase();

  // Define mapping rules
  const mappingRules: Record<string, string[]> = {
    'businessname': ['businessname', 'company', 'organisation', 'organization', 'business'],
    'businessnumber': ['businessnumber', 'abn', 'acn', 'taxid', 'taxnumber'],
    'firstname': ['firstname', 'first', 'fname', 'givenname'],
    'lastname': ['lastname', 'last', 'lname', 'surname', 'familyname'],
    'email': ['email', 'emailaddress', 'mail'],
    'addressline1': ['address', 'street', 'addressline', 'line1', 'address1'],
    'city': ['city', 'suburb', 'town', 'locality'],
    'postalcode': ['postalcode', 'postcode', 'zip', 'zipcode', 'postal'],
    'stateprovince': ['state', 'province', 'stateprovince', 'region'],
    'country': ['country', 'countrycode', 'nation'],
    'amount': ['amount', 'total', 'price', 'cost', 'fee'],
    'transactionid': ['transactionid', 'paymentid', 'transaction', 'reference'],
  };

  // Find matching rules
  const relevantKeywords: string[] = [];
  Object.entries(mappingRules).forEach(([key, keywords]) => {
    if (fieldLower.includes(key)) {
      relevantKeywords.push(...keywords);
    }
  });

  // Score each option
  allOptions.forEach(option => {
    const pathLower = option.displayPath.toLowerCase();
    const valueLower = String(option.value).toLowerCase();
    
    let score = 0;

    // Check if path contains relevant keywords
    relevantKeywords.forEach(keyword => {
      if (pathLower.includes(keyword)) {
        score += 10;
      }
      if (valueLower.includes(keyword)) {
        score += 5;
      }
    });

    // Check for exact field name match
    if (pathLower.includes(fieldLower)) {
      score += 20;
    }

    // Check data type relevance
    if (fieldName.toLowerCase().includes('email') && valueLower.includes('@')) {
      score += 15;
    }
    if (fieldName.toLowerCase().includes('number') && option.dataType === 'number') {
      score += 10;
    }

    if (score > 0) {
      suggestions.push({ ...option, score } as any);
    }
  });

  // Sort by score and return top suggestions
  return suggestions
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 10)
    .map(({ score, ...option }: any) => option);
}

/**
 * Extract a value from an object using a path string
 */
export function getValueByPath(obj: any, path: string | any): any {
  if (!obj || !path) return undefined;
  
  // Ensure path is a string
  if (typeof path !== 'string') {
    console.warn('getValueByPath received non-string path:', path);
    return undefined;
  }

  // Handle array notation
  const parts = path.split(/\.|\[|\]/).filter(Boolean);
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    // Check if part is a number (array index)
    const index = Number(part);
    if (!isNaN(index)) {
      current = current[index];
    } else {
      current = current[part];
    }
  }

  return current;
}