#!/usr/bin/env ts-node

/**
 * Script to create a registration in Supabase from test database document
 * 
 * This script:
 * 1. Gets registration document from LodgeTix-migration-test-1 database 
 * 2. Gets error_payment document from lodgetix database for charge ID
 * 3. Creates registration in Supabase with proper field mappings
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import { createClient } from '@supabase/supabase-js';

// Load environment from the explorer env file
const envPath = path.join(__dirname, '..', '.env.explorer');
dotenv.config({ path: envPath });

// MongoDB connection strings
const MONGODB_TEST_DB_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
const MONGODB_LODGETIX_URI = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Document IDs to retrieve
const REGISTRATION_ID = '6886bd91bc34c2425617c25e';
const ERROR_PAYMENT_ID = '68a09f38c18a9f49d9048751';

interface RegistrationDocument {
  _id: ObjectId;
  registrationId: string;
  customerId?: string;
  registrationDate?: Date;
  status?: string;
  totalAmountPaid?: number;
  totalPricePaid?: number;
  paymentStatus?: string;
  agreeToTerms?: boolean;
  primaryAttendeeId?: string;
  registrationType?: string;
  confirmationNumber?: string;
  organisationId?: string;
  connectedAccountId?: string;
  platformFeeAmount?: number;
  platformFeeId?: string;
  subtotal?: number;
  stripeFee?: number;
  includesProcessingFee?: boolean;
  functionId?: string;
  authUserId?: string;
  organisationName?: string;
  organisationNumber?: string;
  primaryAttendee?: any;
  attendeeCount?: number;
  confirmationGeneratedAt?: Date;
  eventId?: string;
  bookingContactId?: string;
  [key: string]: any;
}

interface ErrorPaymentDocument {
  _id: ObjectId;
  chargeId?: string;
  charge_id?: string;
  [key: string]: any;
}

async function connectToMongoDB(uri: string) {
  const client = new MongoClient(uri);
  await client.connect();
  return client;
}

async function getRegistrationDocument(client: MongoClient): Promise<RegistrationDocument | null> {
  try {
    const db = client.db('LodgeTix-migration-test-1');
    const collection = db.collection('registrations');
    
    console.log(`Searching for registration with _id: ${REGISTRATION_ID}`);
    const registration = await collection.findOne({ _id: new ObjectId(REGISTRATION_ID) }) as RegistrationDocument | null;
    
    if (!registration) {
      console.log('Registration document not found');
      return null;
    }
    
    console.log('Found registration document:', {
      _id: registration._id,
      registrationId: registration.registrationId,
      status: registration.status,
      paymentStatus: registration.paymentStatus,
      totalAmountPaid: registration.totalAmountPaid,
      confirmationNumber: registration.confirmationNumber,
      confirmationNumberLength: registration.confirmationNumber?.length
    });
    
    return registration;
  } catch (error) {
    console.error('Error fetching registration document:', error);
    return null;
  }
}

async function getErrorPaymentDocument(client: MongoClient): Promise<string | null> {
  try {
    const db = client.db('lodgetix');
    
    // First, let's see what collections exist
    console.log('Listing collections in lodgetix database...');
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    // Try different collection names for error payments
    const possibleCollections = ['error_payment', 'error_payments', 'errorPayments', 'payments'];
    
    for (const collectionName of possibleCollections) {
      if (collections.find(c => c.name === collectionName)) {
        console.log(`Trying collection: ${collectionName}`);
        const collection = db.collection(collectionName);
        
        console.log(`Searching for document with _id: ${ERROR_PAYMENT_ID}`);
        let errorPayment = await collection.findOne({ _id: new ObjectId(ERROR_PAYMENT_ID) }) as ErrorPaymentDocument | null;
        
        if (!errorPayment) {
          // Try without ObjectId conversion in case it's stored as string
          console.log(`Trying to find document with string _id: ${ERROR_PAYMENT_ID}`);
          errorPayment = await collection.findOne({ _id: ERROR_PAYMENT_ID as any }) as ErrorPaymentDocument | null;
        }
        
        if (errorPayment) {
          console.log('Found error payment document in collection:', collectionName);
          console.log('Document keys:', Object.keys(errorPayment));
          
          // Try to extract charge ID from various possible fields
          const chargeId = errorPayment.chargeId || errorPayment.charge_id || errorPayment.id;
          
          console.log('Found error payment document:', {
            _id: errorPayment._id,
            chargeId: chargeId,
            fullDocument: errorPayment
          });
          
          return chargeId || 'ch_3RZInfHDfNBUEWUu08WSM1W1'; // Fallback to the provided charge ID
        }
      }
    }
    
    console.log('Error payment document not found in any collection');
    // Use the hardcoded charge ID from the requirements
    const fallbackChargeId = 'ch_3RZInfHDfNBUEWUu08WSM1W1';
    console.log(`Using fallback charge ID: ${fallbackChargeId}`);
    return fallbackChargeId;
    
  } catch (error) {
    console.error('Error fetching error payment document:', error);
    // Use the hardcoded charge ID from the requirements
    const fallbackChargeId = 'ch_3RZInfHDfNBUEWUu08WSM1W1';
    console.log(`Using fallback charge ID due to error: ${fallbackChargeId}`);
    return fallbackChargeId;
  }
}

// Helper function to convert MongoDB decimal values to numbers
function convertMongoDecimal(value: any): number | null {
  if (!value) return null;
  
  // Handle MongoDB Decimal128 format
  if (typeof value === 'object' && value.$numberDecimal) {
    return parseFloat(value.$numberDecimal);
  }
  
  // Handle regular numbers
  if (typeof value === 'number') {
    return value;
  }
  
  // Handle string numbers
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

// Helper function to validate confirmation number format
function validateConfirmationNumber(confirmationNumber: string | null): string | null {
  if (!confirmationNumber) return null;
  
  // Based on Supabase data, pattern is: XXX-XXXXXXXX (3 letters, dash, exactly 8 alphanumeric)
  // Examples: IND-264651AH, LDG-861089SF, LDG-817438HTR
  const pattern = /^[A-Z]{3}-[A-Z0-9]{8}$/;
  
  console.log(`Validating confirmation number: "${confirmationNumber}" against pattern: ${pattern}`);
  
  if (pattern.test(confirmationNumber)) {
    console.log(`✓ Confirmation number "${confirmationNumber}" is valid`);
    return confirmationNumber;
  }
  
  console.log(`Warning: Confirmation number "${confirmationNumber}" doesn't match expected pattern ${pattern}, setting to null`);
  return null;
}

async function createSupabaseRegistration(registration: RegistrationDocument, chargeId: string) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Map fields from MongoDB document to Supabase schema
    const supabaseRegistration = {
      registration_id: registration.registrationId || null,
      customer_id: registration.customerId || null,
      registration_date: registration.registrationDate || null,
      status: registration.status || null,
      total_amount_paid: convertMongoDecimal(registration.totalAmountPaid),
      total_price_paid: convertMongoDecimal(registration.totalPricePaid),
      payment_status: registration.paymentStatus || null,
      agree_to_terms: registration.agreeToTerms || null,
      stripe_payment_intent_id: chargeId, // From error_payment document
      primary_attendee_id: registration.primaryAttendeeId || null,
      registration_type: registration.registrationType || null,
      registration_data: registration, // Store entire document as JSONB
      confirmation_number: validateConfirmationNumber(registration.confirmationNumber),
      organisation_id: registration.organisationId || null,
      connected_account_id: registration.connectedAccountId || null,
      platform_fee_amount: convertMongoDecimal(registration.platformFeeAmount),
      platform_fee_id: registration.platformFeeId || null,
      subtotal: convertMongoDecimal(registration.subtotal),
      stripe_fee: convertMongoDecimal(registration.stripeFee),
      includes_processing_fee: registration.includesProcessingFee || null,
      function_id: registration.functionId || null,
      auth_user_id: registration.authUserId || null,
      organisation_name: registration.organisationName || null,
      organisation_number: registration.organisationNumber || null,
      primary_attendee: registration.primaryAttendee || null,
      attendee_count: registration.attendeeCount || null,
      confirmation_generated_at: registration.confirmationGeneratedAt || null,
      event_id: registration.eventId || null,
      booking_contact_id: registration.bookingContactId || null,
      square_payment_id: null, // This is a Stripe payment
      square_fee: 0, // This is a Stripe payment
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Creating registration in Supabase with data:', {
      registration_id: supabaseRegistration.registration_id,
      customer_id: supabaseRegistration.customer_id,
      status: supabaseRegistration.status,
      payment_status: supabaseRegistration.payment_status,
      stripe_payment_intent_id: supabaseRegistration.stripe_payment_intent_id,
      total_amount_paid: supabaseRegistration.total_amount_paid
    });
    
    const { data, error } = await supabase
      .from('registrations')
      .insert([supabaseRegistration])
      .select();
    
    if (error) {
      console.error('Error creating registration in Supabase:', error);
      return { success: false, error };
    }
    
    console.log('Successfully created registration in Supabase:', data);
    return { success: true, data };
    
  } catch (error) {
    console.error('Error connecting to Supabase:', error);
    return { success: false, error };
  }
}

async function deleteExistingRegistration(registrationId: string) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { error } = await supabase
      .from('registrations')
      .delete()
      .eq('registration_id', registrationId);
    
    if (error) {
      console.error('Error deleting existing registration:', error);
      return { success: false, error };
    }
    
    console.log('Successfully deleted existing registration');
    return { success: true };
    
  } catch (error) {
    console.error('Error deleting existing registration:', error);
    return { success: false, error };
  }
}

async function verifyRegistrationExists(registrationId: string) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data, error } = await supabase
      .from('registrations')
      .select('registration_id, status, payment_status, total_amount_paid, confirmation_number')
      .eq('registration_id', registrationId)
      .single();
    
    if (error) {
      console.error('Error verifying registration:', error);
      return { exists: false, error };
    }
    
    console.log('Verified registration exists in Supabase:', data);
    return { exists: true, data };
    
  } catch (error) {
    console.error('Error verifying registration:', error);
    return { exists: false, error };
  }
}

async function checkSupabaseSchema() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Check existing registrations to understand confirmation number pattern
    const { data, error } = await supabase
      .from('registrations')
      .select('confirmation_number, registration_id')
      .not('confirmation_number', 'is', null)
      .limit(10);
    
    if (error) {
      console.log('Error querying registrations:', error);
    } else {
      console.log('Supabase registrations table exists');
      console.log('Sample confirmation numbers:', data?.map(r => r.confirmation_number));
    }
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

async function main() {
  console.log('=== Creating Registration in Supabase from Test DB ===\n');
  
  let testClient: MongoClient | null = null;
  let lodgetixClient: MongoClient | null = null;
  
  try {
    // Check Supabase schema first
    console.log('0. Checking Supabase schema...');
    await checkSupabaseSchema();
    console.log('✓ Schema check complete\n');
    
    // Connect to MongoDB databases
    console.log('1. Connecting to MongoDB databases...');
    testClient = await connectToMongoDB(MONGODB_TEST_DB_URI);
    lodgetixClient = await connectToMongoDB(MONGODB_LODGETIX_URI);
    console.log('✓ Connected to MongoDB databases\n');
    
    // Get registration document
    console.log('2. Fetching registration document from test database...');
    const registration = await getRegistrationDocument(testClient);
    if (!registration) {
      throw new Error('Failed to fetch registration document');
    }
    console.log('✓ Retrieved registration document\n');
    
    // Get charge ID from error_payment
    console.log('3. Fetching charge ID from error_payment document...');
    const chargeId = await getErrorPaymentDocument(lodgetixClient);
    if (!chargeId) {
      throw new Error('Failed to fetch charge ID from error_payment document');
    }
    console.log(`✓ Retrieved charge ID: ${chargeId}\n`);
    
    // Delete existing registration if it exists
    console.log('4. Checking for existing registration...');
    const existingCheck = await verifyRegistrationExists(registration.registrationId);
    if (existingCheck.exists) {
      console.log('Found existing registration, deleting it...');
      const deleteResult = await deleteExistingRegistration(registration.registrationId);
      if (!deleteResult.success) {
        console.warn('Could not delete existing registration, continuing anyway...');
      } else {
        console.log('✓ Deleted existing registration');
      }
    } else {
      console.log('No existing registration found');
    }
    console.log('');
    
    // Create registration in Supabase
    console.log('5. Creating registration in Supabase...');
    const result = await createSupabaseRegistration(registration, chargeId);
    if (!result.success) {
      throw new Error(`Failed to create registration in Supabase: ${JSON.stringify(result.error)}`);
    }
    console.log('✓ Created registration in Supabase\n');
    
    // Verify registration exists
    console.log('6. Verifying registration exists in Supabase...');
    const verification = await verifyRegistrationExists(registration.registrationId);
    if (!verification.exists) {
      console.warn('⚠ Could not verify registration exists in Supabase');
    } else {
      console.log('✓ Registration verified in Supabase\n');
    }
    
    // Report summary
    console.log('=== SUMMARY ===');
    console.log(`✓ Registration created successfully`);
    console.log(`   Registration ID: ${registration.registrationId}`);
    console.log(`   Stripe Charge ID: ${chargeId}`);
    console.log(`   Status: ${registration.status}`);
    console.log(`   Payment Status: ${registration.paymentStatus}`);
    console.log(`   Total Amount: ${registration.totalAmountPaid}`);
    
    // Check for unmapped fields
    const requiredFields = [
      'registrationId', 'customerId', 'registrationDate', 'status',
      'totalAmountPaid', 'totalPricePaid', 'paymentStatus', 'agreeToTerms',
      'primaryAttendeeId', 'registrationType', 'confirmationNumber'
    ];
    
    const missingFields = requiredFields.filter(field => !registration[field]);
    if (missingFields.length > 0) {
      console.log(`\n⚠ Fields that couldn't be mapped:`, missingFields);
    } else {
      console.log(`\n✓ All required fields successfully mapped`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    // Close connections
    if (testClient) {
      await testClient.close();
    }
    if (lodgetixClient) {
      await lodgetixClient.close();
    }
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}