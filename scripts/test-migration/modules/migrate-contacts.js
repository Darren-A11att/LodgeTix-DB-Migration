const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { writeDocument, logError, logWarning } = require('../utils/helpers');

/**
 * Migrate contacts and users according to the new schema
 * - Uses UUID v4 for all IDs
 * - Deduplicates by email OR phone
 * - Creates context-based roles (registrations{}, organizations{}, hosting{})
 * - Ensures booking/billing contacts have user accounts
 * - Migrates complete masonic profile from attendees
 */
async function migrateContacts(db, migrationState) {
  try {
    // Collect data from all sources
    const sources = {
      users: await db.collection('users').find({}).toArray(),
      attendees: await db.collection('attendees').find({}).toArray(),
      registrations: await db.collection('registrations').find({}).toArray(),
      customers: await db.collection('customers').find({}).toArray(),
      functions: await db.collection('functions').find({}).toArray(),
      organisations: await db.collection('organisations').find({}).toArray()
    };
    
    console.log(`Found ${sources.users.length} users`);
    console.log(`Found ${sources.attendees.length} attendees`);
    console.log(`Found ${sources.registrations.length} registrations`);
    console.log(`Found ${sources.customers.length} customers`);
    
    // Map to store contacts by lookup key
    const contactMap = new Map();
    
    // Track emails and phones for order migration
    migrationState.emailToContact = new Map();
    migrationState.phoneToContact = new Map();
    
    // Track contacts that need user accounts
    const contactsNeedingUsers = new Set();
    
    // Step 1: Process attendees first (they have the most complete data)
    console.log('Processing attendees...');
    for (const attendee of sources.attendees) {
      const contact = await createContactFromAttendee(attendee, sources, migrationState);
      const key = getContactKey(contact);
      
      if (key && !contactMap.has(key)) {
        contactMap.set(key, contact);
        migrationState.attendeeToContact.set(attendee._id.toString(), contact.contactId);
        // Also map by attendeeId if it exists
        if (attendee.attendeeId) {
          migrationState.attendeeToContact.set(attendee.attendeeId, contact.contactId);
        }
      } else if (key) {
        // Merge attendee data into existing contact
        const existing = contactMap.get(key);
        mergeAttendeeIntoContact(existing, attendee, migrationState);
        migrationState.attendeeToContact.set(attendee._id.toString(), existing.contactId);
        // Also map by attendeeId if it exists
        if (attendee.attendeeId) {
          migrationState.attendeeToContact.set(attendee.attendeeId, existing.contactId);
        }
      }
    }
    
    // Step 2: Process registrations for booking/billing contacts
    console.log('Processing registration contacts...');
    for (const registration of sources.registrations) {
      // Process booking contact
      if (registration.registrationData?.bookingContact) {
        const bookingContact = registration.registrationData.bookingContact;
        const contact = await createContactFromBooking(bookingContact, registration, migrationState);
        const key = getContactKey(contact);
        
        if (key && !contactMap.has(key)) {
          contactMap.set(key, contact);
          contactsNeedingUsers.add(contact.contactId);
        } else if (key) {
          const existing = contactMap.get(key);
          mergeBookingIntoContact(existing, bookingContact, registration, migrationState);
          contactsNeedingUsers.add(existing.contactId);
        }
      }
      
      // Process billing contact
      if (registration.registrationData?.billingContact) {
        const billingContact = registration.registrationData.billingContact;
        const contact = await createContactFromBilling(billingContact, registration, migrationState);
        const key = getContactKey(contact);
        
        if (key && !contactMap.has(key)) {
          contactMap.set(key, contact);
          contactsNeedingUsers.add(contact.contactId);
        } else if (key) {
          const existing = contactMap.get(key);
          mergeBillingIntoContact(existing, billingContact, registration, migrationState);
          contactsNeedingUsers.add(existing.contactId);
        }
      }
    }
    
    // Step 3: Process existing users (might not be in attendees)
    console.log('Processing existing users...');
    for (const user of sources.users) {
      const contact = await createContactFromUser(user, migrationState);
      const key = getContactKey(contact);
      
      if (key && !contactMap.has(key)) {
        contactMap.set(key, contact);
        migrationState.userToContact.set(user._id.toString(), contact.contactId);
      } else if (key) {
        const existing = contactMap.get(key);
        mergeUserIntoContact(existing, user, migrationState);
        migrationState.userToContact.set(user._id.toString(), existing.contactId);
      }
    }
    
    // Step 4: Process organization contacts
    console.log('Processing organization contacts...');
    for (const org of sources.organisations) {
      if (org.contactEmail || org.billingEmail) {
        const contact = await createContactFromOrganization(org, migrationState);
        const key = getContactKey(contact);
        
        if (key && !contactMap.has(key)) {
          contactMap.set(key, contact);
        } else if (key) {
          const existing = contactMap.get(key);
          mergeOrganizationIntoContact(existing, org, migrationState);
        }
      }
    }
    
    // Step 5: Process function hosts
    console.log('Processing function hosts...');
    for (const func of sources.functions) {
      if (func.host || func.organizer) {
        // This would need more logic to identify the actual contact
        // For now, we'll skip this as it requires linking to actual people
      }
    }
    
    // Step 6: Write all contacts and create necessary users
    console.log('Writing contacts and creating users...');
    const userMap = new Map();
    
    for (const [key, contact] of contactMap) {
      // Write contact document
      await writeDocument('contacts', contact._id, contact);
      migrationState.stats.contacts++;
      
      // Track by email and phone for deduplication in order migration
      if (contact.email) {
        migrationState.emailToContact.set(contact.email, contact.contactId);
      }
      if (contact.phone) {
        migrationState.phoneToContact.set(contact.phone, contact.contactId);
      }
      
      // Create user if needed
      if (contact.hasUserAccount || contactsNeedingUsers.has(contact.contactId)) {
        const user = await createUserFromContact(contact, sources.users, migrationState);
        userMap.set(contact.contactId, user);
        await writeDocument('users', user._id, user);
        migrationState.stats.users++;
      }
    }
    
    console.log(`Successfully migrated ${migrationState.stats.contacts} contacts`);
    console.log(`Created ${migrationState.stats.users} user records`);
    
  } catch (error) {
    await logError('CONTACT_MIGRATION_FATAL', error);
    throw error;
  }
}

/**
 * Generate a unique key for contact deduplication
 */
function getContactKey(contact) {
  const email = normalizeEmail(contact.email);
  const phone = normalizePhone(contact.phone || contact.mobile);
  
  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  return null;
}

/**
 * Normalize email for consistent comparison
 */
function normalizeEmail(email) {
  if (!email) return null;
  return email.toLowerCase().trim();
}

/**
 * Normalize phone to E.164 format
 */
function normalizePhone(phone, defaultCountryCode = '+61') {
  if (!phone) return null;
  
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle Australian numbers
  if (!phone.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = defaultCountryCode.replace('+', '') + cleaned;
  }
  
  return '+' + cleaned;
}

/**
 * Create contact from attendee record
 */
async function createContactFromAttendee(attendee, sources, migrationState) {
  const contactId = uuidv4();
  
  // Map registration to get function details
  const registration = sources.registrations.find(r => 
    r.registrationData?.attendees?.some(a => 
      a.attendeeId === attendee._id.toString() || 
      a.attendee_id === attendee.attendee_id
    )
  );
  
  const contact = {
    _id: new ObjectId(),
    contactId,
    
    // Core identity
    firstName: attendee.firstName || '',
    lastName: attendee.lastName || '',
    preferredName: attendee.preferredName || null,
    title: attendee.title && !isMasonicTitle(attendee.title) ? attendee.title : null,
    
    // Contact info
    email: normalizeEmail(attendee.primaryEmail || attendee.email),
    phone: normalizePhone(attendee.primaryPhone || attendee.phone),
    mobile: normalizePhone(attendee.mobile),
    alternatePhone: normalizePhone(attendee.alternatePhone),
    
    // Address (from registration if available)
    address: null, // Attendees typically don't have addresses
    
    // Complete masonic profile
    masonicProfile: createMasonicProfile(attendee),
    
    // Context-based roles - using objects instead of arrays
    registrations: {},
    organizations: {},
    hosting: {},
    
    // Relationships
    relationships: createRelationships(attendee),
    
    // Additional profile
    profile: {
      dateOfBirth: attendee.dateOfBirth || null,
      dietaryRequirements: parseDietaryRequirements(attendee.dietaryRequirements),
      specialNeeds: attendee.specialNeeds || null,
      preferredCommunication: 'email'
    },
    
    // System fields
    hasUserAccount: false,
    isActive: true,
    tags: generateTags(attendee),
    
    // Metadata
    source: 'attendee',
    createdAt: attendee.createdAt || new Date(),
    updatedAt: attendee.updatedAt || new Date(),
    createdBy: 'migration',
    updatedBy: 'migration'
  };
  
  // Add registration context if we found it
  if (registration) {
    const regId = registration._id.toString();
    contact.registrations[regId] = {
      role: 'attendee',
      functionId: registration.functionId || registration.function_id,
      functionName: registration.functionName || '',
      eventId: attendee.eventId || attendee.event_id || null,
      eventName: attendee.eventName || null,
      tableNumber: attendee.tableNumber || null,
      seatNumber: attendee.seatNumber || null,
      registeredAt: registration.createdAt || new Date(),
      registeredBy: registration.registrationData?.bookingContact?.contactId || null
    };
  }
  
  return contact;
}

/**
 * Create contact from booking contact
 */
async function createContactFromBooking(bookingContact, registration, migrationState) {
  const contactId = uuidv4();
  
  return {
    _id: new ObjectId(),
    contactId,
    
    // Core identity
    firstName: bookingContact.firstName || '',
    lastName: bookingContact.lastName || '',
    preferredName: null,
    title: bookingContact.title || null,
    
    // Contact info
    email: normalizeEmail(bookingContact.email),
    phone: normalizePhone(bookingContact.phone),
    mobile: normalizePhone(bookingContact.mobile),
    alternatePhone: null,
    
    // Address from booking contact
    address: bookingContact.addressLine1 ? {
      line1: bookingContact.addressLine1 || '',
      line2: bookingContact.addressLine2 || null,
      city: bookingContact.city || '',
      state: bookingContact.stateProvince || '',
      postcode: bookingContact.postalCode || '',
      country: bookingContact.country || 'Australia'
    } : null,
    
    // No masonic profile for booking contacts typically
    masonicProfile: null,
    
    // Context-based roles
    registrations: {
      [registration._id.toString()]: {
        role: 'bookingContact',
        functionId: registration.functionId || registration.function_id,
        functionName: registration.functionName || '',
        bookingsManaged: registration.registrationData?.attendees?.length || 0,
        registeredAt: registration.createdAt || new Date()
      }
    },
    organizations: {},
    hosting: {},
    
    // No relationships for booking contacts
    relationships: { partners: [], emergencyContacts: [] },
    
    // Additional profile
    profile: {
      dateOfBirth: null,
      dietaryRequirements: [],
      specialNeeds: null,
      preferredCommunication: 'email'
    },
    
    // System fields - booking contacts MUST have user accounts
    hasUserAccount: true,
    isActive: true,
    tags: ['booking-contact'],
    
    // Metadata
    source: 'registration',
    createdAt: registration.createdAt || new Date(),
    updatedAt: new Date(),
    createdBy: 'migration',
    updatedBy: 'migration'
  };
}

/**
 * Create contact from billing contact
 */
async function createContactFromBilling(billingContact, registration, migrationState) {
  const contactId = uuidv4();
  
  return {
    _id: new ObjectId(),
    contactId,
    
    // Core identity
    firstName: billingContact.firstName || '',
    lastName: billingContact.lastName || '',
    preferredName: null,
    title: billingContact.title || null,
    
    // Contact info
    email: normalizeEmail(billingContact.email),
    phone: normalizePhone(billingContact.phone),
    mobile: normalizePhone(billingContact.mobile),
    alternatePhone: null,
    
    // Address from billing contact
    address: billingContact.addressLine1 ? {
      line1: billingContact.addressLine1 || '',
      line2: billingContact.addressLine2 || null,
      city: billingContact.city || '',
      state: billingContact.stateProvince || '',
      postcode: billingContact.postalCode || '',
      country: billingContact.country || 'Australia'
    } : null,
    
    // No masonic profile for billing contacts typically
    masonicProfile: null,
    
    // Context-based roles
    registrations: {
      [registration._id.toString()]: {
        role: 'billingContact',
        functionId: registration.functionId || registration.function_id,
        functionName: registration.functionName || '',
        registeredAt: registration.createdAt || new Date()
      }
    },
    organizations: {},
    hosting: {},
    
    // No relationships for billing contacts
    relationships: { partners: [], emergencyContacts: [] },
    
    // Additional profile
    profile: {
      dateOfBirth: null,
      dietaryRequirements: [],
      specialNeeds: null,
      preferredCommunication: 'email'
    },
    
    // System fields - billing contacts MUST have user accounts
    hasUserAccount: true,
    isActive: true,
    tags: ['billing-contact'],
    
    // Metadata
    source: 'registration',
    createdAt: registration.createdAt || new Date(),
    updatedAt: new Date(),
    createdBy: 'migration',
    updatedBy: 'migration'
  };
}

/**
 * Create contact from user record
 */
async function createContactFromUser(user, migrationState) {
  const contactId = uuidv4();
  
  return {
    _id: new ObjectId(),
    contactId,
    
    // Core identity from user profile
    firstName: user.profile?.firstName || user.firstName || '',
    lastName: user.profile?.lastName || user.lastName || '',
    preferredName: user.profile?.preferredName || null,
    title: user.profile?.title || null,
    
    // Contact info
    email: normalizeEmail(user.email),
    phone: normalizePhone(user.profile?.phone || user.phone),
    mobile: normalizePhone(user.profile?.mobile || user.mobile),
    alternatePhone: null,
    
    // Address from user profile
    address: user.profile?.address ? {
      line1: user.profile.address.line1 || '',
      line2: user.profile.address.line2 || null,
      city: user.profile.address.city || '',
      state: user.profile.address.state || '',
      postcode: user.profile.address.postcode || '',
      country: user.profile.address.country || 'Australia'
    } : null,
    
    // Masonic profile if exists
    masonicProfile: user.profile?.masonicProfile || null,
    
    // Context-based roles - empty initially
    registrations: {},
    organizations: {},
    hosting: {},
    
    // Relationships
    relationships: { partners: [], emergencyContacts: [] },
    
    // Additional profile
    profile: {
      dateOfBirth: user.profile?.dateOfBirth || null,
      dietaryRequirements: [],
      specialNeeds: null,
      preferredCommunication: user.profile?.preferredCommunication || 'email'
    },
    
    // System fields
    hasUserAccount: true,
    isActive: user.status === 'active',
    tags: user.tags || [],
    
    // Metadata
    source: 'user',
    createdAt: user.createdAt || new Date(),
    updatedAt: user.updatedAt || new Date(),
    createdBy: 'migration',
    updatedBy: 'migration'
  };
}

/**
 * Create contact from organization
 */
async function createContactFromOrganization(org, migrationState) {
  const contactId = uuidv4();
  
  return {
    _id: new ObjectId(),
    contactId,
    
    // Core identity - use organization name
    firstName: org.contactName ? extractFirstName(org.contactName) : 'Contact',
    lastName: org.contactName ? extractLastName(org.contactName) : org.name,
    preferredName: null,
    title: null,
    
    // Contact info
    email: normalizeEmail(org.contactEmail || org.billingEmail),
    phone: normalizePhone(org.contactPhone || org.billingPhone),
    mobile: null,
    alternatePhone: null,
    
    // Organization address
    address: org.address || null,
    
    // No masonic profile for org contacts
    masonicProfile: null,
    
    // Context-based roles
    registrations: {},
    organizations: {
      [org.organizationId || org._id.toString()]: {
        organizationName: org.name,
        role: org.contactRole || 'contact',
        startDate: org.createdAt || new Date(),
        endDate: null,
        isCurrent: true
      }
    },
    hosting: {},
    
    // No relationships
    relationships: { partners: [], emergencyContacts: [] },
    
    // Additional profile
    profile: {
      dateOfBirth: null,
      dietaryRequirements: [],
      specialNeeds: null,
      preferredCommunication: 'email'
    },
    
    // System fields
    hasUserAccount: false,
    isActive: org.status === 'active',
    tags: ['organization-contact'],
    
    // Metadata
    source: 'organization',
    createdAt: org.createdAt || new Date(),
    updatedAt: org.updatedAt || new Date(),
    createdBy: 'migration',
    updatedBy: 'migration'
  };
}

/**
 * Create masonic profile from attendee data
 */
function createMasonicProfile(attendee) {
  if (!attendee.isMason && !attendee.lodgeId && !attendee.grandLodgeId) {
    return null;
  }
  
  return {
    isMason: attendee.isMason || false,
    title: isMasonicTitle(attendee.title) ? attendee.title : null,
    rank: attendee.rank || null,
    grandRank: attendee.grandRank || null,
    grandOffice: attendee.grandOffice || null,
    grandOfficer: attendee.grandOfficer || false,
    grandLodgeId: attendee.grandLodgeId || null,
    grandLodgeName: attendee.grandLodgeName || null,
    lodgeId: attendee.lodgeId || attendee.lodgeOrganisationId || null,
    lodgeName: attendee.lodgeName || null,
    lodgeNumber: extractLodgeNumber(attendee.lodgeName) || attendee.lodgeNumber || null
  };
}

/**
 * Create relationships from attendee data
 */
function createRelationships(attendee) {
  const relationships = {
    partners: [],
    emergencyContacts: []
  };
  
  // Add partner if exists
  if (attendee.partnerName) {
    relationships.partners.push({
      contactId: null, // Will be linked later if partner exists as contact
      relationshipType: attendee.partnerRelationship || 'partner',
      name: attendee.partnerName,
      isPrimary: true
    });
  }
  
  // Add emergency contacts if exist
  if (attendee.emergencyContactName) {
    relationships.emergencyContacts.push({
      contactId: null,
      name: attendee.emergencyContactName,
      relationship: attendee.emergencyContactRelationship || 'other',
      phone: normalizePhone(attendee.emergencyContactPhone)
    });
  }
  
  return relationships;
}

/**
 * Create user from contact
 */
async function createUserFromContact(contact, existingUsers, migrationState) {
  const userId = uuidv4();
  
  // Check if user already exists for this contact
  const existingUser = existingUsers.find(u => 
    normalizeEmail(u.email) === contact.email ||
    normalizePhone(u.phone) === contact.phone
  );
  
  const user = {
    _id: new ObjectId(),
    userId,
    contactId: contact.contactId,
    
    // Authentication identifiers
    email: contact.email,
    phone: contact.phone,
    
    // Password - use existing or create placeholder
    password: existingUser?.password || await bcrypt.hash('TempPassword123!', 10),
    
    // OAuth providers - empty initially
    authProviders: {},
    
    // Access control
    roles: ['user'],
    permissions: [],
    
    // Account status
    status: 'active',
    emailVerified: existingUser?.emailVerified || false,
    phoneVerified: false,
    
    // Security
    lastLogin: existingUser?.lastLogin || null,
    loginCount: existingUser?.loginCount || 0,
    passwordResetToken: null,
    passwordResetExpires: null,
    
    // Metadata
    createdAt: contact.createdAt,
    updatedAt: new Date()
  };
  
  // Add additional roles based on contact type
  if (contact.tags.includes('booking-contact')) {
    user.permissions.push('manage_bookings');
  }
  if (contact.tags.includes('billing-contact')) {
    user.permissions.push('view_invoices');
  }
  if (Object.keys(contact.hosting).length > 0) {
    user.roles.push('host');
    user.permissions.push('create_events', 'manage_events');
  }
  
  return user;
}

/**
 * Merge attendee data into existing contact
 */
function mergeAttendeeIntoContact(contact, attendee, migrationState) {
  // Update masonic profile if more complete
  if (!contact.masonicProfile && (attendee.isMason || attendee.lodgeId)) {
    contact.masonicProfile = createMasonicProfile(attendee);
  } else if (contact.masonicProfile && attendee.lodgeId) {
    // Update with more complete data
    if (!contact.masonicProfile.lodgeId && attendee.lodgeId) {
      contact.masonicProfile.lodgeId = attendee.lodgeId;
      contact.masonicProfile.lodgeName = attendee.lodgeName;
    }
    if (!contact.masonicProfile.grandLodgeId && attendee.grandLodgeId) {
      contact.masonicProfile.grandLodgeId = attendee.grandLodgeId;
      contact.masonicProfile.grandLodgeName = attendee.grandLodgeName;
    }
  }
  
  // Update profile data if missing
  if (!contact.profile.dateOfBirth && attendee.dateOfBirth) {
    contact.profile.dateOfBirth = attendee.dateOfBirth;
  }
  if (!contact.profile.dietaryRequirements.length && attendee.dietaryRequirements) {
    contact.profile.dietaryRequirements = parseDietaryRequirements(attendee.dietaryRequirements);
  }
  if (!contact.profile.specialNeeds && attendee.specialNeeds) {
    contact.profile.specialNeeds = attendee.specialNeeds;
  }
  
  // Add relationships if not exist
  if (attendee.partnerName && !contact.relationships.partners.some(p => p.name === attendee.partnerName)) {
    contact.relationships.partners.push({
      contactId: null,
      relationshipType: attendee.partnerRelationship || 'partner',
      name: attendee.partnerName,
      isPrimary: contact.relationships.partners.length === 0
    });
  }
}

/**
 * Merge booking contact data into existing contact
 */
function mergeBookingIntoContact(contact, bookingContact, registration, migrationState) {
  // Add registration context
  const regId = registration._id.toString();
  if (!contact.registrations[regId]) {
    contact.registrations[regId] = {
      role: 'bookingContact',
      functionId: registration.functionId || registration.function_id,
      functionName: registration.functionName || '',
      bookingsManaged: registration.registrationData?.attendees?.length || 0,
      registeredAt: registration.createdAt || new Date()
    };
  }
  
  // Update address if missing
  if (!contact.address && bookingContact.addressLine1) {
    contact.address = {
      line1: bookingContact.addressLine1 || '',
      line2: bookingContact.addressLine2 || null,
      city: bookingContact.city || '',
      state: bookingContact.stateProvince || '',
      postcode: bookingContact.postalCode || '',
      country: bookingContact.country || 'Australia'
    };
  }
  
  // Ensure has user account
  contact.hasUserAccount = true;
  if (!contact.tags.includes('booking-contact')) {
    contact.tags.push('booking-contact');
  }
}

/**
 * Merge billing contact data into existing contact
 */
function mergeBillingIntoContact(contact, billingContact, registration, migrationState) {
  // Add registration context
  const regId = registration._id.toString();
  if (!contact.registrations[regId]) {
    contact.registrations[regId] = {
      role: 'billingContact',
      functionId: registration.functionId || registration.function_id,
      functionName: registration.functionName || '',
      registeredAt: registration.createdAt || new Date()
    };
  } else {
    // Update role to include billing
    contact.registrations[regId].role = 'bookingContact,billingContact';
  }
  
  // Update address if missing or if this is billing address
  if (!contact.address && billingContact.addressLine1) {
    contact.address = {
      line1: billingContact.addressLine1 || '',
      line2: billingContact.addressLine2 || null,
      city: billingContact.city || '',
      state: billingContact.stateProvince || '',
      postcode: billingContact.postalCode || '',
      country: billingContact.country || 'Australia'
    };
  }
  
  // Ensure has user account
  contact.hasUserAccount = true;
  if (!contact.tags.includes('billing-contact')) {
    contact.tags.push('billing-contact');
  }
}

/**
 * Merge user data into existing contact
 */
function mergeUserIntoContact(contact, user, migrationState) {
  // User data takes precedence for auth
  contact.hasUserAccount = true;
  
  // Update profile if more complete
  if (!contact.profile.dateOfBirth && user.profile?.dateOfBirth) {
    contact.profile.dateOfBirth = user.profile.dateOfBirth;
  }
  
  // Update address if missing
  if (!contact.address && user.profile?.address) {
    contact.address = user.profile.address;
  }
  
  // Merge tags
  if (user.tags) {
    user.tags.forEach(tag => {
      if (!contact.tags.includes(tag)) {
        contact.tags.push(tag);
      }
    });
  }
}

/**
 * Merge organization data into existing contact
 */
function mergeOrganizationIntoContact(contact, org, migrationState) {
  const orgId = org.organizationId || org._id.toString();
  if (!contact.organizations[orgId]) {
    contact.organizations[orgId] = {
      organizationName: org.name,
      role: org.contactRole || 'contact',
      startDate: org.createdAt || new Date(),
      endDate: null,
      isCurrent: true
    };
  }
  
  if (!contact.tags.includes('organization-contact')) {
    contact.tags.push('organization-contact');
  }
}

/**
 * Helper functions
 */
function isMasonicTitle(title) {
  const masonicTitles = ['Bro', 'W Bro', 'VW Bro', 'RW Bro', 'MW Bro'];
  return masonicTitles.includes(title);
}

function extractLodgeNumber(lodgeName) {
  if (!lodgeName) return null;
  const match = lodgeName.match(/No\.?\s*(\d+)/i);
  return match ? match[1] : null;
}

function parseDietaryRequirements(dietary) {
  if (!dietary) return [];
  if (Array.isArray(dietary)) return dietary;
  
  // Common dietary requirements
  const requirements = [];
  const text = dietary.toLowerCase();
  
  if (text.includes('vegetarian')) requirements.push('vegetarian');
  if (text.includes('vegan')) requirements.push('vegan');
  if (text.includes('gluten')) requirements.push('gluten-free');
  if (text.includes('dairy')) requirements.push('dairy-free');
  if (text.includes('nut')) requirements.push('nut-free');
  if (text.includes('halal')) requirements.push('halal');
  if (text.includes('kosher')) requirements.push('kosher');
  
  // If no standard requirements found, return the original text as array
  if (requirements.length === 0 && dietary.trim()) {
    requirements.push(dietary.trim());
  }
  
  return requirements;
}

function generateTags(attendee) {
  const tags = [];
  
  if (attendee.isMason) tags.push('mason');
  if (attendee.grandOfficer) tags.push('grand-officer');
  if (attendee.rank === 'PM') tags.push('past-master');
  if (attendee.vip) tags.push('vip');
  
  return tags;
}

function extractFirstName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || '';
}

function extractLastName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(1).join(' ') || '';
}

module.exports = migrateContacts;