"use strict";
/**
 * Registration processor for extracting and processing registration data
 * Handles attendees, tickets, billing details, and lodge information
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrationProcessor = void 0;
class RegistrationProcessor {
    /**
     * Process a registration and extract all relevant data
     */
    process(registration) {
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
    extractAttendees(registration) {
        const attendees = [];
        // Try multiple paths to find attendees
        const attendeeList = registration.registrationData?.attendees ||
            registration.attendees ||
            [];
        attendeeList.forEach((attendee, index) => {
            const processedAttendee = {
                id: attendee.attendeeId || attendee._id || `attendee_${index}`,
                name: this.buildAttendeeName(attendee, index),
                title: attendee.title,
                firstName: attendee.firstName,
                lastName: attendee.lastName,
                lodgeInfo: this.extractAttendeeLodgeInfo(attendee),
                lodgeNameNumber: attendee.lodgeNameNumber || attendee.lodge,
                tickets: [] // Will be populated by assignTicketsToAttendees
            };
            attendees.push(processedAttendee);
        });
        return attendees;
    }
    /**
     * Build attendee name from available fields
     */
    buildAttendeeName(attendee, index) {
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
    extractAttendeeLodgeInfo(attendee) {
        if (attendee.lodgeNameNumber) {
            return attendee.lodgeNameNumber;
        }
        if (attendee.lodge) {
            return attendee.lodge;
        }
        if (attendee.lodgeName && attendee.lodgeNumber) {
            return `${attendee.lodgeName} ${attendee.lodgeNumber}`;
        }
        if (attendee.lodgeName) {
            return attendee.lodgeName;
        }
        return '';
    }
    /**
     * Extract all tickets from registration
     */
    extractTickets(registration) {
        const tickets = [];
        // Try multiple paths to find tickets
        const ticketList = registration.registrationData?.selectedTickets ||
            registration.selectedTickets ||
            [];
        ticketList.forEach((ticket, index) => {
            const processedTicket = {
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
    extractTicketPrice(ticket) {
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
    extractBillingDetails(registration) {
        // Priority 1: metadata.billingDetails (for lodge registrations)
        if (registration.metadata?.billingDetails) {
            return this.normalizeBillingDetails(registration.metadata.billingDetails);
        }
        // Priority 2: bookingContact
        const bookingContact = registration.registrationData?.bookingContact ||
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
    normalizeBillingDetails(billingDetails) {
        return {
            businessName: billingDetails.businessName || billingDetails.company || '',
            businessNumber: billingDetails.businessNumber || billingDetails.abn || '',
            firstName: billingDetails.firstName || '',
            lastName: billingDetails.lastName || '',
            email: billingDetails.email || billingDetails.emailAddress || '',
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
    extractBillingFromBookingContact(bookingContact) {
        // Handle name splitting if needed
        let firstName = bookingContact.firstName || '';
        let lastName = bookingContact.lastName || '';
        if (!firstName && !lastName && bookingContact.name) {
            const nameParts = bookingContact.name.trim().split(' ');
            firstName = nameParts[0] || '';
            lastName = nameParts.slice(1).join(' ') || '';
        }
        return {
            businessName: bookingContact.businessName || bookingContact.company || bookingContact.organisation || '',
            businessNumber: bookingContact.businessNumber || bookingContact.abn || '',
            firstName: firstName || 'Unknown',
            lastName: lastName || 'Customer',
            email: bookingContact.email || bookingContact.emailAddress || 'no-email@lodgetix.io',
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
    findPrimaryAttendee(registration) {
        const attendees = registration.registrationData?.attendees || registration.attendees || [];
        // First try to find explicitly marked primary
        const primary = attendees.find((a) => a.isPrimary === true);
        if (primary)
            return primary;
        // Otherwise return first attendee
        return attendees[0];
    }
    /**
     * Extract billing from attendee
     */
    extractBillingFromAttendee(attendee, registration) {
        return {
            businessName: '',
            businessNumber: '',
            firstName: attendee.firstName || 'Unknown',
            lastName: attendee.lastName || 'Customer',
            email: attendee.email || registration.customerEmail || 'no-email@lodgetix.io',
            addressLine1: attendee.address || attendee.addressLine1 || '',
            city: attendee.city || '',
            postalCode: attendee.postalCode || attendee.postcode || '',
            stateProvince: attendee.stateProvince || attendee.state || 'NSW',
            country: attendee.country || 'Australia'
        };
    }
    /**
     * Extract billing from registration level data
     */
    extractBillingFromRegistration(registration) {
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
            firstName: firstName || 'Unknown',
            lastName: lastName || 'Customer',
            email: registration.customerEmail || 'no-email@lodgetix.io',
            addressLine1: registration.addressLine1 || '',
            city: registration.city || '',
            postalCode: registration.postalCode || '',
            stateProvince: registration.stateProvince || 'NSW',
            country: registration.country || 'Australia'
        };
    }
    /**
     * Extract lodge information from registration
     */
    extractLodgeInfo(registration) {
        // Check if this is a lodge registration
        const registrationType = registration.registrationType ||
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
    assignTicketsToAttendees(attendees, tickets, registration) {
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
                const attendee = attendees.find(a => String(a.id) === String(ticket.attendeeId) ||
                    a.id.endsWith(String(ticket.attendeeId)) ||
                    String(ticket.attendeeId).endsWith(a.id));
                if (attendee) {
                    attendee.tickets.push(ticket);
                    return;
                }
            }
        });
        // Strategy 3: Registration-owned tickets to primary attendee
        const registrationTickets = tickets.filter(t => t.ownerType === 'registration' && !this.isTicketAssigned(t, attendees));
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
    isTicketAssigned(ticket, attendees) {
        return attendees.some(attendee => attendee.tickets.some(t => t.id === ticket.id));
    }
}
exports.RegistrationProcessor = RegistrationProcessor;
