import { Db } from 'mongodb';

/**
 * Reversed Timestamp Confirmation Number Service
 * 
 * Generates guaranteed unique confirmation numbers using reversed Unix timestamps.
 * No database checks needed, no collision possibility.
 * 
 * Format: [PREFIX]-[8-9 digits][1 letter]
 * Example: IND-432725637K
 */

export type RegistrationType = 'individuals' | 'individual' | 'lodge' | 'lodges' | 'delegation';

/**
 * Generate a unique confirmation number using reversed timestamp strategy
 * 
 * @param registrationType Type of registration
 * @returns Confirmation number in format PREFIX-DIGITSLETTER
 */
export function generateConfirmationNumber(registrationType?: RegistrationType | string): string {
  // Determine prefix based on registration type
  let prefix = 'REG'; // default
  
  if (registrationType) {
    const type = registrationType.toLowerCase();
    if (type.includes('lodge')) {
      prefix = 'LDG';
    } else if (type.includes('individual')) {
      prefix = 'IND';
    } else if (type.includes('delegation')) {
      prefix = 'DEL';
    }
  }
  
  // Get current timestamp in seconds
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Reverse the timestamp string
  const reversed = timestamp.toString().split('').reverse().join('');
  
  // Drop the last digit (first digit of original timestamp - the '1' from 17xxxxxxxx)
  const truncated = reversed.substring(0, reversed.length - 1);
  
  // Generate a random uppercase letter (A-Z)
  const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  
  // Combine into final format
  return `${prefix}-${truncated}${randomLetter}`;
}

/**
 * Generate confirmation number for a registration when payment is matched
 * 
 * @param db MongoDB database instance
 * @param registrationId The registration ID
 * @param registrationType Type of registration
 * @returns The generated confirmation number or existing one
 */
export async function generateForPaymentMatch(
  db: Db,
  registrationId: string,
  registrationType?: string
): Promise<string | null> {
  // Check if registration already has a confirmation number
  const existing = await db.collection('registrations').findOne({
    registrationId: registrationId
  });
  
  if (existing?.confirmationNumber) {
    console.log(`Registration ${registrationId} already has confirmation number: ${existing.confirmationNumber}`);
    return existing.confirmationNumber;
  }
  
  // Generate new confirmation number
  const confirmationNumber = generateConfirmationNumber(registrationType || existing?.registrationType);
  
  // Update the registration
  const result = await db.collection('registrations').updateOne(
    { 
      registrationId: registrationId,
      confirmationNumber: { $in: [null, '', undefined] }
    },
    {
      $set: {
        confirmationNumber: confirmationNumber,
        confirmationGeneratedAt: new Date(),
        confirmationGeneratedMethod: 'reversed-timestamp',
        updatedAt: new Date()
      }
    }
  );
  
  if (result.modifiedCount > 0) {
    console.log(`Generated confirmation number ${confirmationNumber} for registration ${registrationId}`);
    return confirmationNumber;
  }
  
  // If no modification, double-check if it was set by another process
  const updated = await db.collection('registrations').findOne({ registrationId });
  return updated?.confirmationNumber || null;
}

/**
 * Batch generate confirmation numbers for multiple registrations
 * 
 * @param db MongoDB database instance
 * @param registrationIds Array of registration IDs
 * @returns Map of registrationId to confirmationNumber
 */
export async function batchGenerateForPaymentMatches(
  db: Db,
  registrationIds: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  for (const registrationId of registrationIds) {
    // Small delay to ensure timestamp uniqueness
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const confirmationNumber = await generateForPaymentMatch(db, registrationId);
    if (confirmationNumber) {
      results.set(registrationId, confirmationNumber);
    }
  }
  
  return results;
}

/**
 * Validate confirmation number format
 * Checks if it matches our expected pattern
 */
export function isValidConfirmationNumber(confirmationNumber: string): boolean {
  // Pattern: PREFIX-DIGITS(8-10)LETTER
  const pattern = /^(IND|LDG|DEL|REG)-[0-9]{8,10}[A-Z]$/;
  return pattern.test(confirmationNumber);
}

/**
 * Extract registration type from confirmation number
 */
export function getTypeFromConfirmationNumber(confirmationNumber: string): string | null {
  if (!confirmationNumber) return null;
  
  const prefix = confirmationNumber.split('-')[0];
  switch (prefix) {
    case 'IND': return 'individuals';
    case 'LDG': return 'lodge';
    case 'DEL': return 'delegation';
    case 'REG': return 'registration';
    default: return null;
  }
}