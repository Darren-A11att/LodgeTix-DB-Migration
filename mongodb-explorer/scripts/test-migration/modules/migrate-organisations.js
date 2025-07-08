const { ObjectId, Decimal128 } = require('mongodb');
const { writeDocument, logError, logWarning } = require('../utils/helpers');

async function migrateOrganisations(db, migrationState) {
  try {
    const organisations = await db.collection('organisations').find({}).toArray();
    
    console.log(`Found ${organisations.length} organisations to migrate`);
    
    for (const org of organisations) {
      try {
        const transformedOrg = await transformOrganisation(org, db, migrationState);
        await writeDocument('organisations', transformedOrg._id, transformedOrg);
        
      } catch (error) {
        await logError('ORGANISATION_MIGRATION', error, { 
          organisationId: org.organisation_id || org.organisationId,
          organisationName: org.name 
        });
      }
    }
    
    console.log(`Successfully migrated ${migrationState.stats.organisations} organisations`);
    
  } catch (error) {
    await logError('ORGANISATION_MIGRATION_FATAL', error);
    throw error;
  }
}

async function transformOrganisation(org, db, migrationState) {
  // Check if this is a lodge by looking for it in lodges collection
  const lodge = await db.collection('lodges').findOne({ organisation_id: org.organisation_id || org.organisationId }) || 
                 await db.collection('lodges').findOne({ organisationId: org.organisation_id || org.organisationId });
  const isLodge = !!lodge;
  
  return {
    _id: org._id || new ObjectId(),
    organisationId: org.organisation_id || org.organisationId || `ORG-${Date.now()}`,
    
    profile: {
      name: org.name || 'Unknown Organisation',
      displayName: org.display_name || org.name || 'Unknown Organisation',
      type: determineOrgType(org, isLodge),
      
      registration: {
        number: org.registration_number || lodge?.number || '',
        registeredName: org.registered_name || org.name || '',
        abn: org.abn || '',
        acn: org.acn || '',
        taxId: org.tax_id || '',
        gstRegistered: org.gst_registered || false,
        charityStatus: org.charity_status || false,
        charityNumber: org.charity_number || ''
      },
      
      contact: {
        primary: {
          name: org.primary_contact_name || '',
          role: org.primary_contact_role || (isLodge ? 'Secretary' : 'Contact'),
          email: org.primary_contact_email || org.email || '',
          phone: org.primary_contact_phone || org.phone || ''
        },
        
        billing: {
          name: org.billing_contact_name || '',
          email: org.billing_contact_email || '',
          phone: org.billing_contact_phone || ''
        },
        
        events: {
          name: org.events_contact_name || '',
          email: org.events_contact_email || '',
          phone: org.events_contact_phone || ''
        },
        
        general: {
          email: org.email || '',
          phone: org.phone || '',
          website: org.website || '',
          socialMedia: {
            facebook: org.facebook || '',
            twitter: org.twitter || '',
            linkedin: org.linkedin || '',
            instagram: org.instagram || ''
          }
        }
      },
      
      addresses: {
        physical: {
          addressLine1: org.physical_address_line_1 || org.address_line_1 || '',
          addressLine2: org.physical_address_line_2 || org.address_line_2 || '',
          city: org.physical_city || org.city || '',
          state: org.physical_state || org.state || '',
          postcode: org.physical_postcode || org.postcode || '',
          country: org.physical_country || org.country || 'Australia',
          
          venue: lodge ? {
            name: lodge.meeting_place || '',
            capacity: null,
            facilities: [],
            directions: ''
          } : null
        },
        
        postal: {
          addressLine1: org.postal_address_line_1 || org.address_line_1 || '',
          addressLine2: org.postal_address_line_2 || org.address_line_2 || '',
          city: org.postal_city || org.city || '',
          state: org.postal_state || org.state || '',
          postcode: org.postal_postcode || org.postcode || '',
          country: org.postal_country || org.country || 'Australia'
        },
        
        billing: {
          sameAsPostal: org.billing_same_as_postal !== false,
          addressLine1: org.billing_address_line_1 || '',
          addressLine2: org.billing_address_line_2 || '',
          city: org.billing_city || '',
          state: org.billing_state || '',
          postcode: org.billing_postcode || '',
          country: org.billing_country || 'Australia'
        }
      },
      
      details: {
        founded: org.founded_date || null,
        description: org.description || '',
        mission: org.mission || '',
        
        lodge: isLodge ? {
          district: lodge.district || '',
          grandLodge: lodge.grand_lodge_name || '',
          meetingSchedule: lodge.meeting_schedule || '',
          meetingTime: lodge.meeting_time || '19:30',
          dresscode: lodge.dresscode || 'Formal'
        } : null,
        
        size: {
          memberCount: org.member_count || 0,
          activeMembers: org.active_members || org.member_count || 0,
          category: determineSizeCategory(org.member_count)
        }
      }
    },
    
    membership: {
      members: [], // Will be populated during user/contact migration
      officers: [], // Will be populated if we have officer data
      
      rules: {
        approvalRequired: org.approval_required !== false,
        approvalQuorum: org.approval_quorum || 1,
        votingRights: {
          minimumTenure: org.voting_minimum_tenure || 0,
          requiresDuesPaid: org.voting_requires_dues !== false
        },
        
        eligibility: {
          minAge: org.eligibility_min_age || (isLodge ? 18 : null),
          maxAge: org.eligibility_max_age || null,
          gender: org.eligibility_gender ? [org.eligibility_gender] : [],
          requiresInvitation: org.requires_invitation || isLodge,
          requiresSponsor: org.requires_sponsor || isLodge,
          otherRequirements: org.other_requirements || []
        }
      }
    },
    
    financial: {
      banking: {
        accountName: org.bank_account_name || '',
        bsb: org.bank_bsb || '', // Should be encrypted in production
        accountNumber: org.bank_account_number || '', // Should be encrypted in production
        bankName: org.bank_name || '',
        
        preferredMethod: org.preferred_payment_method || 'invoice',
        terms: org.payment_terms || 'net30'
      },
      
      credit: {
        limit: org.credit_limit ? Decimal128.fromString(String(org.credit_limit)) : Decimal128.fromString('0'),
        used: Decimal128.fromString('0'),
        available: org.credit_limit ? Decimal128.fromString(String(org.credit_limit)) : Decimal128.fromString('0'),
        
        rating: org.credit_rating || 'good',
        lastReview: org.credit_last_review || null,
        
        onTimePayments: 0,
        latePayments: 0,
        averageDaysToPayment: 30
      },
      
      invoicing: {
        consolidated: org.consolidated_invoicing || false,
        frequency: org.invoice_frequency || 'immediate',
        format: org.invoice_format || 'pdf',
        
        purchaseOrderRequired: org.po_required || false,
        costCenters: []
      },
      
      tax: {
        exemptStatus: org.tax_exempt || false,
        exemptionCertificate: org.tax_exemption_certificate ? {
          number: org.tax_exemption_certificate,
          expiryDate: org.tax_exemption_expiry || null,
          documentUrl: ''
        } : null
      }
    },
    
    events: {
      defaults: {
        registrationType: isLodge ? 'lodge' : 'organisation',
        paymentMethod: org.default_payment_method || 'invoice',
        
        bulkBooking: {
          minimumAttendees: org.bulk_minimum || 1,
          defaultAllocation: org.bulk_default || 10,
          autoAssignMembers: org.bulk_auto_assign || false
        },
        
        seating: {
          preferTogether: org.seating_prefer_together !== false,
          specialRequirements: org.seating_requirements || [],
          vipMembers: []
        }
      },
      
      history: {
        eventsAttended: 0,
        totalAttendees: 0,
        totalSpent: Decimal128.fromString('0'),
        
        lastEventDate: null,
        favoriteEvents: [],
        eventsHosted: []
      },
      
      arrangements: {
        cateringPreferences: {
          provider: org.catering_provider || '',
          restrictions: org.catering_restrictions || [],
          notes: org.catering_notes || ''
        },
        
        transportArrangements: {
          required: org.transport_required || false,
          details: org.transport_details || ''
        },
        
        accommodationPreferences: {
          preferredHotels: org.preferred_hotels || [],
          roomTypes: org.room_types || [],
          specialNeeds: org.accommodation_needs || []
        }
      }
    },
    
    jurisdictionId: lodge?.jurisdiction_id || lodge?.jurisdictionId || null,
    
    relationships: {
      parent: (org.parent_organisation_id || org.parentOrganisationId) ? {
        organisationId: org.parent_organisation_id || org.parentOrganisationId,
        name: org.parent_organisation_name || org.parentOrganisationName || '',
        type: isLodge ? 'grand_lodge' : 'parent_company'
      } : null,
      
      children: [],
      affiliations: [],
      reciprocal: []
    },
    
    documents: {
      constitution: {
        uploaded: false,
        uploadedAt: null,
        documentUrl: '',
        version: ''
      },
      
      insurance: {
        publicLiability: org.insurance_public_liability ? {
          insurer: org.insurance_pl_insurer || '',
          policyNumber: org.insurance_pl_policy || '',
          coverAmount: Decimal128.fromString(String(org.insurance_pl_amount || 0)),
          expiryDate: org.insurance_pl_expiry || null,
          documentUrl: ''
        } : null,
        
        professionalIndemnity: null
      },
      
      compliance: [],
      agreements: []
    },
    
    communications: {
      notifications: {
        newEvents: {
          enabled: org.notifications_new_events !== false,
          channels: ['email'],
          recipients: ['secretary', 'events']
        },
        
        reminders: {
          enabled: org.notifications_reminders !== false,
          daysBefore: [30, 14, 7, 1],
          channels: ['email']
        },
        
        announcements: {
          enabled: org.notifications_announcements !== false,
          channels: ['email'],
          allMembers: false
        }
      },
      
      bulkCommunication: {
        requireApproval: true,
        approvers: [],
        blackoutDates: []
      }
    },
    
    settings: {
      privacy: {
        listPublicly: org.list_publicly || false,
        showMemberCount: org.show_member_count || false,
        allowMemberDirectory: org.allow_member_directory || false,
        shareContactDetails: org.share_contact_details || false
      },
      
      features: {
        onlineVoting: org.feature_online_voting || false,
        memberPortal: org.feature_member_portal || false,
        eventHosting: org.feature_event_hosting || isLodge,
        fundraising: org.feature_fundraising || false
      },
      
      branding: {
        logo: org.logo_url ? {
          url: org.logo_url,
          uploadedAt: new Date()
        } : null,
        colors: {
          primary: org.brand_color_primary || '#000080',
          secondary: org.brand_color_secondary || '#FFD700'
        },
        customDomain: org.custom_domain || ''
      }
    },
    
    status: org.status || 'active',
    
    verification: {
      verified: org.verified || false,
      verifiedAt: org.verified_at || null,
      verifiedBy: org.verified_by || null,
      documents: []
    },
    
    metadata: {
      source: 'migration',
      tags: org.tags || [],
      
      createdAt: org.created_at || new Date(),
      createdBy: org.created_by || null,
      updatedAt: org.updated_at || new Date(),
      updatedBy: org.updated_by || null,
      
      importBatchId: 'test-migration',
      legacyId: org.organisation_id || org.organisationId,
      migrationNotes: 'Migrated from legacy system'
    }
  };
}

function determineOrgType(org, isLodge) {
  if (isLodge) return 'lodge';
  if (org.type) return org.type;
  
  const name = (org.name || '').toLowerCase();
  
  if (name.includes('lodge')) return 'lodge';
  if (name.includes('chapter')) return 'lodge';
  if (name.includes('company') || name.includes('pty') || name.includes('ltd')) return 'company';
  if (name.includes('association') || name.includes('club')) return 'association';
  if (name.includes('charity') || org.charity_status) return 'charity';
  if (name.includes('government') || name.includes('council')) return 'government';
  if (name.includes('school') || name.includes('university')) return 'educational';
  
  return 'other';
}

function determineSizeCategory(memberCount) {
  if (!memberCount) return 'small';
  if (memberCount < 50) return 'small';
  if (memberCount < 200) return 'medium';
  return 'large';
}

module.exports = migrateOrganisations;