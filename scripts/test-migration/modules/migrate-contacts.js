const { ObjectId } = require('mongodb');
const { writeDocument, logError, logWarning } = require('../utils/helpers');

async function migrateContacts(db, migrationState) {
  try {
    // Collect contacts from multiple sources
    const contactSources = {
      users: await db.collection('users').find({}).toArray(),
      attendees: await db.collection('attendees').find({}).toArray(),
      registrations: await db.collection('registrations').find({}).toArray()
    };
    
    console.log(`Found ${contactSources.users.length} users`);
    console.log(`Found ${contactSources.attendees.length} attendees`);
    console.log(`Found ${contactSources.registrations.length} registrations`);
    
    // Create a map to deduplicate contacts by email and phone
    const contactMap = new Map();
    
    // Process users first (they have auth accounts)
    for (const user of contactSources.users) {
      const key = generateContactKey(user.primary_email || user.email, user.phone || user.mobile);
      
      if (!contactMap.has(key)) {
        const contact = await createContactFromUser(user, migrationState);
        contactMap.set(key, contact);
        migrationState.userToContact.set(user._id.toString(), contact._id);
      }
    }
    
    // Process attendees
    for (const attendee of contactSources.attendees) {
      const key = generateContactKey(attendee.email, attendee.phone || attendee.mobile);
      
      if (contactMap.has(key)) {
        // Update existing contact with attendee info
        const contact = contactMap.get(key);
        updateContactWithAttendee(contact, attendee, migrationState);
        migrationState.attendeeToContact.set(attendee.attendee_id, contact._id);
      } else {
        // Create new contact
        const contact = await createContactFromAttendee(attendee, migrationState);
        contactMap.set(key, contact);
        migrationState.attendeeToContact.set(attendee.attendee_id, contact._id);
      }
    }
    
    // Process registration billing contacts
    for (const registration of contactSources.registrations) {
      // Process purchaser
      if (registration.purchaser?.email) {
        const key = generateContactKey(
          registration.purchaser.email, 
          registration.purchaser.phone || registration.billing?.contact?.phone
        );
        
        if (!contactMap.has(key)) {
          const contact = await createContactFromPurchaser(registration, migrationState);
          contactMap.set(key, contact);
        }
        
        // Add registration reference to contact
        const contact = contactMap.get(key);
        if (!contact.orderReferences) {
          contact.orderReferences = [];
        }
        
        contact.orderReferences.push({
          orderId: registration._id, // Will be mapped to order later
          orderNumber: registration.confirmation_number,
          role: 'purchaser',
          items: [] // Will be populated during order migration
        });
      }
      
      // Process billing contact if different
      if (registration.billing?.contact?.email && 
          registration.billing.contact.email !== registration.purchaser?.email) {
        
        const key = generateContactKey(
          registration.billing.contact.email,
          registration.billing.contact.phone
        );
        
        if (!contactMap.has(key)) {
          const contact = await createContactFromBilling(registration.billing.contact, migrationState);
          contactMap.set(key, contact);
        }
      }
    }
    
    // Generate contact numbers and write documents
    let contactNumber = 1;
    for (const [key, contact] of contactMap) {
      contact.contactNumber = `CON-${new Date().getFullYear()}-${String(contactNumber++).padStart(5, '0')}`;
      
      // Create user record if they had one in the old system
      if (contact.userId) {
        await createUserRecord(contact, migrationState);
      }
      
      await writeDocument('contacts', contact._id, contact);
    }
    
    console.log(`Successfully migrated ${migrationState.stats.contacts} contacts`);
    console.log(`Created ${migrationState.stats.users} user records`);
    
  } catch (error) {
    await logError('CONTACT_MIGRATION_FATAL', error);
    throw error;
  }
}

function generateContactKey(email, phone) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const normalizedPhone = (phone || '').replace(/\D/g, '');
  
  if (normalizedEmail && normalizedPhone) {
    return `${normalizedEmail}:${normalizedPhone}`;
  } else if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  } else if (normalizedPhone) {
    return `phone:${normalizedPhone}`;
  } else {
    return `unknown:${Date.now()}:${Math.random()}`;
  }
}

async function createContactFromUser(user, migrationState) {
  const contactId = new ObjectId();
  
  return {
    _id: contactId,
    contactNumber: '', // Will be assigned later
    
    profile: {
      firstName: user.first_name || user.firstName || '',
      lastName: user.last_name || user.lastName || '',
      preferredName: user.preferred_name || user.preferredName || '',
      email: user.primary_email || user.email || '',
      phone: user.phone || user.mobile || '',
      dateOfBirth: user.date_of_birth || user.dateOfBirth || null,
      dietaryRequirements: user.dietary_requirements || '',
      specialNeeds: user.special_needs || ''
    },
    
    addresses: [],
    
    masonicProfile: user.lodge_id || user.grand_lodge_id ? {
      craft: {
        grandLodge: user.grand_lodge_id ? {
          name: user.grand_lodge_name || '',
          memberNumber: user.grand_lodge_member_number || ''
        } : null,
        lodge: user.lodge_id ? {
          organisationId: new ObjectId(user.lodge_organisation_id || user.lodge_id),
          name: user.lodge_name || '',
          number: user.lodge_number || ''
        } : null,
        title: user.masonic_title || '',
        rank: user.masonic_rank || ''
      }
    } : null,
    
    roles: [],
    orderReferences: [],
    relationships: [],
    
    userId: user._id, // Will create user record
    
    metadata: {
      source: 'user_migration',
      createdAt: user.created_at || user.createdAt || new Date(),
      createdBy: null,
      updatedAt: user.updated_at || user.updatedAt || new Date(),
      updatedBy: null
    }
  };
}

async function createContactFromAttendee(attendee, migrationState) {
  const contactId = new ObjectId();
  
  return {
    _id: contactId,
    contactNumber: '', // Will be assigned later
    
    profile: {
      firstName: attendee.first_name || attendee.firstName || '',
      lastName: attendee.last_name || attendee.lastName || '',
      preferredName: attendee.preferred_name || '',
      email: attendee.email || '',
      phone: attendee.phone || attendee.mobile || '',
      dateOfBirth: attendee.date_of_birth || null,
      dietaryRequirements: attendee.dietary_requirements || attendee.dietaryRequirements || '',
      specialNeeds: attendee.special_needs || attendee.specialNeeds || ''
    },
    
    addresses: [],
    
    masonicProfile: attendee.lodge_id ? {
      craft: {
        grandLodge: null,
        lodge: {
          organisationId: new ObjectId(attendee.lodge_organisation_id || attendee.lodge_id),
          name: attendee.lodge_name || '',
          number: attendee.lodge_number || ''
        },
        title: attendee.masonic_title || '',
        rank: attendee.masonic_rank || ''
      }
    } : null,
    
    roles: [{
      role: 'attendee',
      context: 'function',
      contextId: attendee.function_id || attendee.event_id,
      startDate: attendee.created_at || new Date(),
      endDate: null,
      permissions: []
    }],
    
    orderReferences: [],
    relationships: [],
    
    userId: null,
    
    metadata: {
      source: 'attendee_migration',
      createdAt: attendee.created_at || new Date(),
      createdBy: null,
      updatedAt: attendee.updated_at || new Date(),
      updatedBy: null
    }
  };
}

async function createContactFromPurchaser(registration, migrationState) {
  const contactId = new ObjectId();
  const purchaser = registration.purchaser;
  const billing = registration.billing?.contact || {};
  
  return {
    _id: contactId,
    contactNumber: '', // Will be assigned later
    
    profile: {
      firstName: purchaser.first_name || extractFirstName(purchaser.name) || '',
      lastName: purchaser.last_name || extractLastName(purchaser.name) || '',
      preferredName: '',
      email: purchaser.email || billing.email || '',
      phone: purchaser.phone || billing.phone || '',
      dateOfBirth: null,
      dietaryRequirements: '',
      specialNeeds: ''
    },
    
    addresses: registration.billing?.address ? [{
      type: 'billing',
      addressLine1: registration.billing.address.addressLine1 || '',
      addressLine2: registration.billing.address.addressLine2 || '',
      city: registration.billing.address.city || '',
      state: registration.billing.address.state || '',
      postcode: registration.billing.address.postcode || '',
      country: registration.billing.address.country || 'Australia',
      isPrimary: true
    }] : [],
    
    masonicProfile: null,
    
    roles: [{
      role: 'purchaser',
      context: 'system',
      contextId: 'system',
      startDate: registration.created_at || new Date(),
      endDate: null,
      permissions: []
    }],
    
    orderReferences: [],
    relationships: [],
    
    userId: null,
    
    metadata: {
      source: 'registration_purchaser',
      createdAt: registration.created_at || new Date(),
      createdBy: null,
      updatedAt: new Date(),
      updatedBy: null
    }
  };
}

async function createContactFromBilling(billingContact, migrationState) {
  const contactId = new ObjectId();
  
  return {
    _id: contactId,
    contactNumber: '', // Will be assigned later
    
    profile: {
      firstName: extractFirstName(billingContact.name) || '',
      lastName: extractLastName(billingContact.name) || '',
      preferredName: '',
      email: billingContact.email || '',
      phone: billingContact.phone || '',
      dateOfBirth: null,
      dietaryRequirements: '',
      specialNeeds: ''
    },
    
    addresses: [],
    masonicProfile: null,
    
    roles: [{
      role: 'billing_contact',
      context: 'system',
      contextId: 'system',
      startDate: new Date(),
      endDate: null,
      permissions: []
    }],
    
    orderReferences: [],
    relationships: [],
    
    userId: null,
    
    metadata: {
      source: 'billing_contact',
      createdAt: new Date(),
      createdBy: null,
      updatedAt: new Date(),
      updatedBy: null
    }
  };
}

function updateContactWithAttendee(contact, attendee, migrationState) {
  // Add attendee role
  contact.roles.push({
    role: 'attendee',
    context: 'function',
    contextId: attendee.function_id || attendee.event_id,
    startDate: attendee.created_at || new Date(),
    endDate: null,
    permissions: []
  });
  
  // Update profile with any missing data
  if (!contact.profile.dietaryRequirements && attendee.dietary_requirements) {
    contact.profile.dietaryRequirements = attendee.dietary_requirements;
  }
  
  if (!contact.profile.specialNeeds && attendee.special_needs) {
    contact.profile.specialNeeds = attendee.special_needs;
  }
  
  // Update masonic profile if attendee has lodge info
  if (attendee.lodge_id && !contact.masonicProfile?.craft?.lodge) {
    if (!contact.masonicProfile) {
      contact.masonicProfile = { craft: {} };
    }
    
    contact.masonicProfile.craft.lodge = {
      organisationId: new ObjectId(attendee.lodge_organisation_id || attendee.lodge_id),
      name: attendee.lodge_name || '',
      number: attendee.lodge_number || ''
    };
  }
}

async function createUserRecord(contact, migrationState) {
  const userDoc = {
    _id: contact.userId,
    email: contact.profile.email || contact.profile.primary_email,
    password: '$2b$10$dummy.hashed.password', // Placeholder - should be real hash
    contactId: contact._id,
    status: 'active',
    emailVerified: true,
    
    authentication: {
      lastLogin: null,
      lastLoginIp: null,
      failedAttempts: 0,
      lockedUntil: null,
      mfa: {
        enabled: false,
        type: null,
        secret: null
      }
    },
    
    createdAt: contact.metadata.createdAt,
    updatedAt: contact.metadata.updatedAt
  };
  
  await writeDocument('users', userDoc._id, userDoc);
}

function extractFirstName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || '';
}

function extractLastName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(1).join(' ') || parts[0] || '';
}

module.exports = migrateContacts;