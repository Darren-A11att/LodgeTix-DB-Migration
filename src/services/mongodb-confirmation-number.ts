import { Db, MongoError } from 'mongodb';

/**
 * MongoDB Confirmation Number Service
 * 
 * Provides confirmation number generation with unique constraint handling,
 * matching the behavior of Supabase RPC functions.
 * 
 * Format: (IND|LDG|DEL|REG)-[0-9]{6}[A-Z]{2}
 */

export type RegistrationType = 'individuals' | 'lodge' | 'delegation' | 'registration';

const CONFIRMATION_PREFIXES: Record<RegistrationType, string> = {
  individuals: 'IND',
  lodge: 'LDG',
  delegation: 'DEL',
  registration: 'REG'
};

/**
 * Generate a random confirmation number with the standard format
 */
function generateRandomConfirmationNumber(registrationType: RegistrationType): string {
  const prefix = CONFIRMATION_PREFIXES[registrationType] || 'REG';
  
  // Generate 6 random digits (000000-999999)
  const digits = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  
  // Generate 2 random uppercase letters (A-Z)
  const letter1 = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const letter2 = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  
  return `${prefix}-${digits}${letter1}${letter2}`;
}

/**
 * Generate a unique confirmation number with retry logic
 * 
 * This matches the Supabase behavior where the database function generates
 * a confirmation number and the UNIQUE constraint prevents duplicates.
 * 
 * @param db MongoDB database instance
 * @param registrationType Type of registration
 * @param maxRetries Maximum number of attempts (default: 10)
 * @returns Unique confirmation number
 * @throws Error if unable to generate unique number after max retries
 */
export async function generateUniqueConfirmationNumber(
  db: Db,
  registrationType: RegistrationType = 'registration',
  maxRetries: number = 10
): Promise<string> {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    const confirmationNumber = generateRandomConfirmationNumber(registrationType);
    
    try {
      // Check if this confirmation number already exists
      const exists = await db.collection('registrations').findOne({ 
        confirmationNumber 
      });
      
      if (!exists) {
        return confirmationNumber;
      }
      
      // If it exists, we'll try again
      console.log(`Confirmation number ${confirmationNumber} already exists, retrying...`);
      
    } catch (error) {
      console.error('Error checking confirmation number uniqueness:', error);
      throw error;
    }
    
    attempts++;
  }
  
  throw new Error(
    `Failed to generate unique confirmation number after ${maxRetries} attempts. ` +
    `This is extremely unlikely (probability < 0.0000015%) and may indicate a problem.`
  );
}

/**
 * Update a registration with a confirmation number
 * 
 * This handles the unique constraint violation gracefully by retrying
 * with a new confirmation number if needed.
 * 
 * @param db MongoDB database instance
 * @param registrationId The registration ID to update
 * @param registrationType Type of registration
 * @returns The generated confirmation number
 */
export async function assignConfirmationNumber(
  db: Db,
  registrationId: string,
  registrationType: RegistrationType = 'registration'
): Promise<string> {
  // First check if registration already has a confirmation number
  const registration = await db.collection('registrations').findOne({
    registrationId
  });
  
  if (!registration) {
    throw new Error(`Registration ${registrationId} not found`);
  }
  
  if (registration.confirmationNumber) {
    console.log(`Registration ${registrationId} already has confirmation number: ${registration.confirmationNumber}`);
    return registration.confirmationNumber;
  }
  
  // Generate and assign new confirmation number
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const confirmationNumber = generateRandomConfirmationNumber(registrationType);
    
    try {
      const result = await db.collection('registrations').updateOne(
        { 
          registrationId,
          confirmationNumber: { $exists: false } // Only update if no confirmation number
        },
        {
          $set: {
            confirmationNumber,
            confirmationGeneratedAt: new Date(),
            updatedAt: new Date()
          }
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`Successfully assigned confirmation number ${confirmationNumber} to registration ${registrationId}`);
        return confirmationNumber;
      }
      
      // If no modification, either it was assigned by another process or update failed
      const updated = await db.collection('registrations').findOne({ registrationId });
      if (updated?.confirmationNumber) {
        // Another process assigned it
        return updated.confirmationNumber;
      }
      
    } catch (error) {
      // Check if it's a duplicate key error (code 11000)
      if ((error as MongoError).code === 11000 && error.message?.includes('confirmationNumber')) {
        console.log(`Duplicate confirmation number ${confirmationNumber}, retrying...`);
        attempts++;
        continue;
      }
      
      // Other errors should be thrown
      throw error;
    }
    
    attempts++;
  }
  
  throw new Error(
    `Failed to assign confirmation number to registration ${registrationId} after ${maxAttempts} attempts`
  );
}

/**
 * Validate confirmation number format
 */
export function isValidConfirmationNumber(confirmationNumber: string): boolean {
  const pattern = /^(IND|LDG|DEL|REG)-[0-9]{6}[A-Z]{2}$/;
  return pattern.test(confirmationNumber);
}

/**
 * Extract registration type from confirmation number
 */
export function getRegistrationTypeFromConfirmationNumber(
  confirmationNumber: string
): RegistrationType | null {
  if (!isValidConfirmationNumber(confirmationNumber)) {
    return null;
  }
  
  const prefix = confirmationNumber.split('-')[0];
  const entry = Object.entries(CONFIRMATION_PREFIXES).find(([_, p]) => p === prefix);
  
  return entry ? entry[0] as RegistrationType : 'registration';
}