/**
 * Enhanced Reference Tracking for MongoDB Sync
 * 
 * This module provides proper reference tracking when extracting embedded documents
 * from registrations into their own collections. It maintains business IDs (not ObjectIds)
 * for proper referential integrity.
 */

import { Db } from 'mongodb';

/**
 * Updates a registration with references to extracted documents
 * Uses business IDs (ticketId, attendeeId, customerId) not ObjectIds
 */
export async function updateRegistrationWithReferences(
  registrationId: string,
  extractedRefs: {
    ticketIds?: string[];
    attendeeIds?: string[];
    customerId?: string;
  },
  db: Db
): Promise<void> {
  const updateFields: any = {
    'metadata.extractionCompleted': true,
    'metadata.extractionDate': new Date(),
    'metadata.extractionVersion': '2.0'
  };

  // Add ticket references (business IDs)
  if (extractedRefs.ticketIds && extractedRefs.ticketIds.length > 0) {
    updateFields['metadata.extractedTicketIds'] = extractedRefs.ticketIds;
    updateFields['metadata.ticketCount'] = extractedRefs.ticketIds.length;
  }

  // Add attendee references (business IDs)
  if (extractedRefs.attendeeIds && extractedRefs.attendeeIds.length > 0) {
    updateFields['metadata.extractedAttendeeIds'] = extractedRefs.attendeeIds;
    updateFields['metadata.attendeeCount'] = extractedRefs.attendeeIds.length;
  }

  // Add customer reference (business ID)
  if (extractedRefs.customerId) {
    updateFields['metadata.extractedCustomerId'] = extractedRefs.customerId;
    // Replace the embedded bookingContact with the customer ID reference
    updateFields['registrationData.bookingContactRef'] = extractedRefs.customerId;
  }

  // Update the registration with all references
  const result = await db.collection('import_registrations').updateOne(
    { id: registrationId },
    { $set: updateFields }
  );

  if (result.modifiedCount > 0) {
    console.log(`✅ Updated registration ${registrationId} with ${extractedRefs.ticketIds?.length || 0} ticket refs, ${extractedRefs.attendeeIds?.length || 0} attendee refs`);
  }
}

/**
 * Adds backward references to tickets
 * Links tickets back to their attendee and registration
 */
export async function addTicketBackwardReferences(
  ticketId: string,
  references: {
    attendeeId?: string;
    registrationId: string;
    customerId?: string;
  },
  db: Db
): Promise<void> {
  const updateFields: any = {
    'metadata.registrationId': references.registrationId,
    'metadata.extractedFrom': 'registration',
    'metadata.extractionDate': new Date()
  };

  if (references.attendeeId) {
    updateFields['metadata.attendeeId'] = references.attendeeId;
  }

  if (references.customerId) {
    updateFields['metadata.customerId'] = references.customerId;
  }

  await db.collection('import_tickets').updateOne(
    { ticketId: ticketId },
    { $set: updateFields }
  );
}

/**
 * Adds backward references to attendees
 * Links attendees back to their registration and associated tickets
 */
export async function addAttendeeBackwardReferences(
  attendeeId: string,
  references: {
    registrationId: string;
    ticketIds: string[];
    customerId?: string;
  },
  db: Db
): Promise<void> {
  const updateFields: any = {
    'metadata.registrationId': references.registrationId,
    'metadata.associatedTicketIds': references.ticketIds,
    'metadata.extractedFrom': 'registration',
    'metadata.extractionDate': new Date()
  };

  if (references.customerId) {
    updateFields['metadata.customerId'] = references.customerId;
  }

  await db.collection('import_attendees').updateOne(
    { attendeeId: attendeeId },
    { $set: updateFields }
  );
}

/**
 * Optionally removes embedded data from registration after successful extraction
 * This prevents data duplication and ensures single source of truth
 */
export async function removeEmbeddedDataFromRegistration(
  registrationId: string,
  options: {
    removeTickets?: boolean;
    removeAttendees?: boolean;
    removeBookingContact?: boolean;
  },
  db: Db
): Promise<void> {
  const unsetFields: any = {};

  if (options.removeTickets) {
    unsetFields['registrationData.tickets'] = '';
    unsetFields['registrationData.selectedTickets'] = '';
    unsetFields['registration_data.tickets'] = '';
    unsetFields['registration_data.selectedTickets'] = '';
  }

  if (options.removeAttendees) {
    unsetFields['registrationData.attendees'] = '';
    unsetFields['registration_data.attendees'] = '';
  }

  if (options.removeBookingContact) {
    // Only remove if we have a reference
    const reg = await db.collection('import_registrations').findOne({ id: registrationId });
    if (reg?.metadata?.extractedCustomerId || reg?.registrationData?.bookingContactRef) {
      unsetFields['registrationData.bookingContact'] = '';
      unsetFields['registration_data.bookingContact'] = '';
    }
  }

  if (Object.keys(unsetFields).length > 0) {
    await db.collection('import_registrations').updateOne(
      { id: registrationId },
      { $unset: unsetFields }
    );
    console.log(`🧹 Removed embedded data from registration ${registrationId}`);
  }
}

/**
 * Complete extraction workflow for a registration
 * Extracts all embedded documents and maintains proper references
 */
export async function completeRegistrationExtraction(
  registration: any,
  extractedData: {
    ticketIds: string[];
    attendeeIds: string[];
    customerId?: string;
  },
  db: Db,
  options: {
    removeEmbedded?: boolean;
    addBackwardRefs?: boolean;
  } = {}
): Promise<void> {
  const registrationId = registration.id || registration.registrationId;

  // Step 1: Update registration with extracted references
  await updateRegistrationWithReferences(registrationId, extractedData, db);

  // Step 2: Add backward references if requested
  if (options.addBackwardRefs) {
    // Add references to tickets
    for (const ticketId of extractedData.ticketIds) {
      // Determine which attendee this ticket belongs to
      // This would need to be passed in or calculated based on your business logic
      const attendeeId = await determineTicketAttendee(ticketId, extractedData.attendeeIds, db);
      
      await addTicketBackwardReferences(
        ticketId,
        {
          attendeeId,
          registrationId,
          customerId: extractedData.customerId
        },
        db
      );
    }

    // Add references to attendees
    for (const attendeeId of extractedData.attendeeIds) {
      // Get tickets for this attendee
      const attendeeTickets = await getTicketsForAttendee(attendeeId, extractedData.ticketIds, db);
      
      await addAttendeeBackwardReferences(
        attendeeId,
        {
          registrationId,
          ticketIds: attendeeTickets,
          customerId: extractedData.customerId
        },
        db
      );
    }
  }

  // Step 3: Optionally remove embedded data
  if (options.removeEmbedded) {
    await removeEmbeddedDataFromRegistration(
      registrationId,
      {
        removeTickets: true,
        removeAttendees: true,
        removeBookingContact: !!extractedData.customerId
      },
      db
    );
  }

  console.log(`✅ Completed extraction for registration ${registrationId}`);
}

/**
 * Helper function to determine which attendee a ticket belongs to
 * This is a simplified version - implement your business logic here
 */
async function determineTicketAttendee(
  ticketId: string,
  attendeeIds: string[],
  db: Db
): Promise<string | undefined> {
  // Look up the ticket to find its attendeeId
  const ticket = await db.collection('import_tickets').findOne({ ticketId });
  
  // Check if ticket has attendeeId in its data
  if (ticket?.data?.attendeeId) {
    return ticket.data.attendeeId;
  }
  
  // Check if ticket has it in metadata
  if (ticket?.metadata?.attendeeId) {
    return ticket.metadata.attendeeId;
  }
  
  // Default to first attendee if no specific assignment
  return attendeeIds[0];
}

/**
 * Helper function to get tickets associated with an attendee
 */
async function getTicketsForAttendee(
  attendeeId: string,
  allTicketIds: string[],
  db: Db
): Promise<string[]> {
  // Find tickets that belong to this attendee
  const tickets = await db.collection('import_tickets').find({
    ticketId: { $in: allTicketIds },
    $or: [
      { 'data.attendeeId': attendeeId },
      { 'metadata.attendeeId': attendeeId }
    ]
  }).toArray();
  
  return tickets.map(t => t.ticketId);
}

/**
 * Validates that all references are properly set
 * Use this for testing and verification
 */
export async function validateRegistrationReferences(
  registrationId: string,
  db: Db
): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  
  // Get the registration
  const registration = await db.collection('import_registrations').findOne({ id: registrationId });
  
  if (!registration) {
    return { valid: false, issues: [`Registration ${registrationId} not found`] };
  }

  // Check for extracted references
  const metadata = registration.metadata || {};
  
  if (!metadata.extractedTicketIds || metadata.extractedTicketIds.length === 0) {
    issues.push('No extracted ticket IDs found in metadata');
  }
  
  if (!metadata.extractedAttendeeIds || metadata.extractedAttendeeIds.length === 0) {
    issues.push('No extracted attendee IDs found in metadata');
  }
  
  if (!metadata.extractedCustomerId && !registration.registrationData?.bookingContactRef) {
    issues.push('No customer reference found');
  }

  // Check for embedded data that should be removed
  if (registration.registrationData?.tickets || registration.registration_data?.tickets) {
    issues.push('Embedded tickets still present in registration');
  }
  
  if (registration.registrationData?.attendees || registration.registration_data?.attendees) {
    issues.push('Embedded attendees still present in registration');
  }
  
  if (registration.registrationData?.bookingContact && typeof registration.registrationData.bookingContact === 'object') {
    issues.push('Embedded booking contact still present (should be replaced with reference)');
  }

  // Verify extracted documents exist
  if (metadata.extractedTicketIds) {
    for (const ticketId of metadata.extractedTicketIds) {
      const ticket = await db.collection('import_tickets').findOne({ ticketId });
      if (!ticket) {
        issues.push(`Referenced ticket ${ticketId} not found in import_tickets`);
      } else if (!ticket.metadata?.registrationId) {
        issues.push(`Ticket ${ticketId} missing backward reference to registration`);
      }
    }
  }
  
  if (metadata.extractedAttendeeIds) {
    for (const attendeeId of metadata.extractedAttendeeIds) {
      const attendee = await db.collection('import_attendees').findOne({ attendeeId });
      if (!attendee) {
        issues.push(`Referenced attendee ${attendeeId} not found in import_attendees`);
      } else if (!attendee.metadata?.registrationId) {
        issues.push(`Attendee ${attendeeId} missing backward reference to registration`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}