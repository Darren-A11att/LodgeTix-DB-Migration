/**
 * Registration processor for extracting and processing registration data
 * Handles attendees, tickets, billing details, and lodge information
 */

import {
  RegistrationData,
  ProcessedAttendee,
  ProcessedTicket,
  BillingDetails,
  LodgeInfo,
  ProcessedRegistrationData
} from '../types';

export class RegistrationProcessor {
  /**
   * Process a registration and extract all relevant data
   */
  process(registration: RegistrationData): ProcessedRegistrationData {
    const attendees = this.extractAttendees(registration);
    const tickets = this.extractTickets(registration);
    const billingDetails = this.extractBillingDetails(registration);
    const lodgeInfo = this.extractLodgeInfo(registration);
    
    // Assign tickets to attendees using fallback strategies
    this.assignTicketsToAttendees(attendees, tickets, registration);
    
    return {
      attendees,
      tickets,
      billingDetails,
      lodgeInfo,
      functionName: registration.functionName,
      confirmationNumber: registration.confirmationNumber
    };
  }

  /**
   * Extract attendees from registration data
   */
  private extractAttendees(registration: RegistrationData): ProcessedAttendee[] {
    const attendees: ProcessedAttendee[] = [];
    
    // Try multiple paths to find attendees
    const attendeeList = 
      registration.registrationData?.attendees || 
      registration.attendees || 
      [];
    
    attendeeList.forEach((attendee: any, index: number) => {
      const processedAttendee: ProcessedAttendee = {
        id: attendee.attendeeId || attendee._id || `attendee_${index}`,
        name: this.buildAttendeeName(attendee, index),
        title: attendee.title,
        firstName: attendee.firstName,
        lastName: attendee.lastName,
        lodgeInfo: this.extractAttendeeLodgeInfo(attendee),
        lodgeNameNumber: attendee.membership?.lodgeNameNumber,
        tickets: [] // Will be populated by assignTicketsToAttendees
      };
      
      attendees.push(processedAttendee);
    });
    
    return attendees;
  }

  /**
   * Build attendee name from available fields
   */
  private buildAttendeeName(attendee: any, index: number): string {
    // Try to build full name from parts
    const parts = [
      attendee.title,
      attendee.firstName,
      attendee.lastName
    ].filter(Boolean);
    
    if (parts.length > 0) {
      return parts.join(' ');
    }
    
    // Fallback to name field
    if (attendee.name) {
      return attendee.name;
    }
    
    // Final fallback
    return `Attendee ${index + 1}`;
  }

  /**
   * Extract lodge information for an attendee
   */
  private extractAttendeeLodgeInfo(attendee: any): string {
    // Use new structure only
    if (attendee.membership?.lodgeNameNumber) {
      return attendee.membership.lodgeNameNumber;
    }
    
    if (attendee.membership?.lodgeName && attendee.membership?.lodgeNumber) {
      return `${attendee.membership.lodgeName} ${attendee.membership.lodgeNumber}`;
    }
    
    if (attendee.membership?.lodgeName) {
      return attendee.membership.lodgeName;
    }
    
    
    return '';
  }

  /**
   * Extract all tickets from registration
   */
  private extractTickets(registration: RegistrationData): ProcessedTicket[] {
    const tickets: ProcessedTicket[] = [];
    
    // Try multiple paths to find tickets
    const ticketList = 
      registration.registrationData?.selectedTickets || 
      registration.selectedTickets || 
      [];
    
    ticketList.forEach((ticket: any, index: number) => {
      const processedTicket: ProcessedTicket = {
        id: ticket.ticketId || ticket._id || `ticket_${index}`,
        attendeeId: ticket.attendeeId,
        ownerId: ticket.ownerId || ticket.attendeeId,
        ownerType: ticket.ownerType || (ticket.attendeeId ? 'attendee' : 'registration'),
        name: ticket.name || ticket.ticketName || ticket.eventName || 'Ticket',
        price: this.extractTicketPrice(ticket),
        quantity: ticket.quantity || 1,
        description: ticket.description,
        eventTicketId: ticket.event_ticket_id || ticket.eventTicketId
      };
      
      tickets.push(processedTicket);
    });
    
    return tickets;
  }

  /**
   * Extract ticket price with fallbacks
   */
  private extractTicketPrice(ticket: any): number {
    // Try various price fields
    const price = ticket.price || ticket.amount || ticket.cost || 0;
    
    // Ensure it's a number
    if (typeof price === 'object' && price.$numberDecimal) {
      return parseFloat(price.$numberDecimal) || 0;
    }
    
    return parseFloat(price) || 0;
  }

  /**
   * Extract billing details from registration
   */
  extractBillingDetails(registration: RegistrationData): BillingDetails {
    // Priority 1: metadata.billingDetails (for lodge registrations)
    if (registration.metadata?.billingDetails) {
      return this.normalizeBillingDetails(registration.metadata.billingDetails);
    }
    
    // Priority 2: bookingContact
    const bookingContact = 
      registration.registrationData?.bookingContact || 
      registration.bookingContact;
    
    if (bookingContact) {
      return this.extractBillingFromBookingContact(bookingContact);
    }
    
    // Priority 3: Primary attendee
    const primaryAttendee = this.findPrimaryAttendee(registration);
    if (primaryAttendee) {
      return this.extractBillingFromAttendee(primaryAttendee, registration);
    }
    
    // Priority 4: Registration level data
    return this.extractBillingFromRegistration(registration);
  }

  /**
   * Normalize billing details from metadata
   */
  private normalizeBillingDetails(billingDetails: any): BillingDetails {
    return {
      businessName: billingDetails.businessName || billingDetails.company || '',
      businessNumber: billingDetails.businessNumber || billingDetails.abn || '',
      title: billingDetails.title || '',
      firstName: billingDetails.firstName || '',
      lastName: billingDetails.lastName || '',
      email: billingDetails.email || billingDetails.emailAddress || '',
      phone: billingDetails.phone || billingDetails.phoneNumber || '',
      mobileNumber: billingDetails.mobileNumber || billingDetails.mobile || '',
      addressLine1: billingDetails.addressLine1 || billingDetails.address || '',
      addressLine2: billingDetails.addressLine2 || '',
      city: billingDetails.city || '',
      postalCode: billingDetails.postalCode || billingDetails.postcode || '',
      stateProvince: billingDetails.stateProvince || billingDetails.state || '',
      country: billingDetails.country || 'Australia'
    };
  }

  /**
   * Extract billing from booking contact
   */
  private extractBillingFromBookingContact(bookingContact: any): BillingDetails {
    // Handle name splitting if needed
    let firstName = bookingContact.firstName || '';
    let lastName = bookingContact.lastName || '';
    let title = bookingContact.title || '';
    
    if (!firstName && !lastName && bookingContact.name) {
      const nameParts = bookingContact.name.trim().split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }
    
    return {
      businessName: bookingContact.businessName || bookingContact.company || bookingContact.organisation || '',
      businessNumber: bookingContact.businessNumber || bookingContact.abn || '',
      title: title,
      firstName: firstName || 'Unknown',
      lastName: lastName || 'Customer',
      email: bookingContact.email || bookingContact.emailAddress || 'no-email@lodgetix.io',
      phone: bookingContact.phone || bookingContact.phoneNumber || '',
      mobileNumber: bookingContact.mobileNumber || bookingContact.mobile || '',
      addressLine1: bookingContact.addressLine1 || bookingContact.address?.line1 || bookingContact.address || '',
      addressLine2: bookingContact.addressLine2 || bookingContact.address?.line2 || '',
      city: bookingContact.city || bookingContact.address?.city || '',
      postalCode: bookingContact.postalCode || bookingContact.postcode || bookingContact.address?.postalCode || '',
      stateProvince: bookingContact.stateProvince || bookingContact.state || bookingContact.address?.state || 'NSW',
      country: bookingContact.country || bookingContact.address?.country || 'Australia'
    };
  }

  /**
   * Find primary attendee in registration
   */
  private findPrimaryAttendee(registration: RegistrationData): any {
    const attendees = registration.registrationData?.attendees || registration.attendees || [];
    
    // First try to find explicitly marked primary
    const primary = attendees.find((a: any) => a.isPrimary === true);
    if (primary) return primary;
    
    // Otherwise return first attendee
    return attendees[0];
  }

  /**
   * Extract billing from attendee
   */
  private extractBillingFromAttendee(attendee: any, registration: RegistrationData): BillingDetails {
    return {
      businessName: '',
      businessNumber: '',
      title: attendee.title || '',
      firstName: attendee.firstName || 'Unknown',
      lastName: attendee.lastName || 'Customer',
      email: attendee.primaryEmail || attendee.email || registration.customerEmail || 'no-email@lodgetix.io',
      phone: attendee.primaryPhone || attendee.phone || attendee.phoneNumber || '',
      mobileNumber: attendee.mobileNumber || attendee.mobile || '',
      addressLine1: attendee.address || attendee.addressLine1 || '',
      addressLine2: attendee.addressLine2 || '',
      city: attendee.city || '',
      postalCode: attendee.postalCode || attendee.postcode || '',
      stateProvince: attendee.stateProvince || attendee.state || 'NSW',
      country: attendee.country || 'Australia'
    };
  }

  /**
   * Extract billing from registration level data
   */
  private extractBillingFromRegistration(registration: RegistrationData): BillingDetails {
    // Handle customer name splitting
    let firstName = '';
    let lastName = '';
    
    if (registration.customerName) {
      const nameParts = registration.customerName.trim().split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }
    
    return {
      businessName: registration.businessName || registration.organisation?.name || '',
      businessNumber: registration.businessNumber || registration.organisation?.abn || '',
      title: '',
      firstName: firstName || 'Unknown',
      lastName: lastName || 'Customer',
      email: registration.customerEmail || 'no-email@lodgetix.io',
      phone: registration.phone || registration.phoneNumber || '',
      mobileNumber: registration.mobileNumber || registration.mobile || '',
      addressLine1: registration.addressLine1 || '',
      addressLine2: registration.addressLine2 || '',
      city: registration.city || '',
      postalCode: registration.postalCode || '',
      stateProvince: registration.stateProvince || 'NSW',
      country: registration.country || 'Australia'
    };
  }

  /**
   * Extract lodge information from registration
   */
  private extractLodgeInfo(registration: RegistrationData): LodgeInfo | undefined {
    // Check if this is a lodge registration
    const registrationType = 
      registration.registrationType || 
      registration.registrationData?.type || 
      registration.type;
    
    if (registrationType !== 'lodge') {
      return undefined;
    }
    
    return {
      lodgeName: registration.lodgeName || registration.registrationData?.lodge?.name || registration.lodge?.name,
      lodgeNumber: registration.lodgeNumber || registration.registrationData?.lodge?.number || registration.lodge?.number,
      lodgeNameNumber: registration.lodgeNameNumber || registration.registrationData?.lodge?.nameNumber,
      membershipType: registration.membershipType || registration.registrationData?.membershipType
    };
  }

  /**
   * Assign tickets to attendees using multiple fallback strategies
   */
  assignTicketsToAttendees(
    attendees: ProcessedAttendee[], 
    tickets: ProcessedTicket[],
    registration: RegistrationData
  ): void {
    // Clear existing ticket assignments
    attendees.forEach(attendee => {
      attendee.tickets = [];
    });
    
    // Strategy 1: Direct attendeeId match
    tickets.forEach(ticket => {
      if (ticket.attendeeId) {
        const attendee = attendees.find(a => a.id === ticket.attendeeId);
        if (attendee) {
          attendee.tickets.push(ticket);
          return;
        }
      }
    });
    
    // Strategy 2: String ID comparison (handle different ID formats)
    tickets.forEach(ticket => {
      if (ticket.attendeeId && !this.isTicketAssigned(ticket, attendees)) {
        const attendee = attendees.find(a => 
          String(a.id) === String(ticket.attendeeId) ||
          a.id.endsWith(String(ticket.attendeeId)) ||
          String(ticket.attendeeId).endsWith(a.id)
        );
        if (attendee) {
          attendee.tickets.push(ticket);
          return;
        }
      }
    });
    
    // Strategy 3: Registration-owned tickets to primary attendee
    const registrationTickets = tickets.filter(t => 
      t.ownerType === 'registration' && !this.isTicketAssigned(t, attendees)
    );
    
    if (registrationTickets.length > 0 && attendees.length > 0) {
      // Assign to first (primary) attendee
      attendees[0].tickets.push(...registrationTickets);
    }
    
    // Strategy 4: Unassigned tickets distributed evenly
    const unassignedTickets = tickets.filter(t => !this.isTicketAssigned(t, attendees));
    
    if (unassignedTickets.length > 0 && attendees.length > 0) {
      // Distribute remaining tickets evenly among attendees
      unassignedTickets.forEach((ticket, index) => {
        const attendeeIndex = index % attendees.length;
        attendees[attendeeIndex].tickets.push(ticket);
      });
    }
  }

  /**
   * Check if a ticket has been assigned to any attendee
   */
  private isTicketAssigned(ticket: ProcessedTicket, attendees: ProcessedAttendee[]): boolean {
    return attendees.some(attendee => 
      attendee.tickets.some(t => t.id === ticket.id)
    );
  }
}