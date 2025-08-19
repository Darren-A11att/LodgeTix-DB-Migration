/**
 * Generates a confirmation number in the format: PREFIX-NNNNNNAA
 * Where:
 * - PREFIX is 3 letters (IND, LDG, DEL, or REG)
 * - NNNNNN is 6 random digits
 * - AA is 2 random uppercase letters
 */

export type RegistrationType = 'individuals' | 'lodge' | 'delegation' | 'registration';

const PREFIXES: Record<RegistrationType, string> = {
  individuals: 'IND',
  lodge: 'LDG',
  delegation: 'DEL',
  registration: 'REG'
};

export function generateConfirmationNumber(registrationType: RegistrationType = 'registration'): string {
  // Get prefix based on registration type
  const prefix = PREFIXES[registrationType] || 'REG';
  
  // Generate 6 random digits (000000-999999)
  const digits = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  
  // Generate 2 random uppercase letters (A-Z)
  const letter1 = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const letter2 = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  
  // Combine into final format
  return `${prefix}-${digits}${letter1}${letter2}`;
}

/**
 * Validates if a confirmation number matches the expected format
 */
export function isValidConfirmationNumber(confirmationNumber: string): boolean {
  const pattern = /^(IND|LDG|DEL|REG)-[0-9]{6}[A-Z]{2}$/;
  return pattern.test(confirmationNumber);
}

/**
 * Extracts the registration type from a confirmation number
 */
export function getRegistrationTypeFromConfirmationNumber(confirmationNumber: string): RegistrationType | null {
  if (!isValidConfirmationNumber(confirmationNumber)) {
    return null;
  }
  
  const prefix = confirmationNumber.split('-')[0];
  const typeEntry = Object.entries(PREFIXES).find(([_, p]) => p === prefix);
  
  return typeEntry ? typeEntry[0] as RegistrationType : 'registration';
}