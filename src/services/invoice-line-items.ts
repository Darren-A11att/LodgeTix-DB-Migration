import { InvoiceItem } from '../types/invoice';

export interface AttendeeTicket {
  ticketName: string;
  price: number;
  quantity: number;
}

export interface AttendeeInfo {
  name: string;
  type: string; // mason, guest, etc.
  isPrimary?: boolean;
  title?: string; // RW Bro, Mrs, etc.
  rank?: string; // PAGM, etc.
  tickets: AttendeeTicket[];
}

export interface RegistrationData {
  registrationType: 'Individual' | 'Lodge' | 'Delegation';
  confirmationNumber: string;
  functionName: string;
  attendees: AttendeeInfo[];
  lodgeName?: string; // For Lodge registrations
  delegationName?: string; // For Delegation registrations
  totalAmount: number;
  processingFees: number;
}

export class InvoiceLineItemService {
  /**
   * Creates invoice line items from registration data
   * Format varies based on registration type
   */
  createLineItems(registration: RegistrationData): InvoiceItem[] {
    const items: InvoiceItem[] = [];

    // 1. Main registration item (no price)
    const mainItem = this.createMainRegistrationItem(registration);
    items.push(mainItem);

    // 2. Add attendee items based on registration type
    if (registration.registrationType === 'Lodge') {
      items.push(...this.createLodgeLineItems(registration));
    } else if (registration.registrationType === 'Delegation') {
      items.push(...this.createDelegationLineItems(registration));
    } else {
      items.push(...this.createIndividualLineItems(registration));
    }

    return items;
  }

  private createMainRegistrationItem(registration: RegistrationData): InvoiceItem {
    const typeLabel = registration.registrationType;
    const entityName = registration.lodgeName || registration.delegationName || '';
    const entityPart = entityName ? ` - ${entityName}` : '';
    
    return {
      description: `${typeLabel} Registration for ${registration.functionName}${entityPart} - Confirmation: ${registration.confirmationNumber}`,
      quantity: 1,
      price: 0
    };
  }

  private createIndividualLineItems(registration: RegistrationData): InvoiceItem[] {
    const items: InvoiceItem[] = [];

    registration.attendees.forEach((attendee) => {
      // Add attendee item (no price)
      const attendeeDescription = this.formatAttendeeName(attendee);
      items.push({
        description: attendeeDescription,
        quantity: 1,
        price: 0
      });

      // Add ticket items with prices
      attendee.tickets.forEach(ticket => {
        items.push({
          description: `  - ${ticket.ticketName}`,
          quantity: ticket.quantity,
          price: ticket.price
        });
      });
    });

    return items;
  }

  private createLodgeLineItems(registration: RegistrationData): InvoiceItem[] {
    const items: InvoiceItem[] = [];

    // For Lodge registrations, group by ticket type
    const ticketGroups = new Map<string, { quantity: number; price: number; attendees: string[] }>();

    registration.attendees.forEach((attendee) => {
      const attendeeName = this.formatAttendeeName(attendee);
      
      attendee.tickets.forEach(ticket => {
        const key = `${ticket.ticketName}_${ticket.price}`;
        if (!ticketGroups.has(key)) {
          ticketGroups.set(key, {
            quantity: 0,
            price: ticket.price,
            attendees: []
          });
        }
        const group = ticketGroups.get(key)!;
        group.quantity += ticket.quantity;
        group.attendees.push(attendeeName);
      });
    });

    // Add Lodge summary item
    items.push({
      description: `${registration.lodgeName} - ${registration.attendees.length} attendees`,
      quantity: 1,
      price: 0
    });

    // Add grouped ticket items
    ticketGroups.forEach((group, key) => {
      const ticketName = key.split('_')[0];
      items.push({
        description: `  - ${ticketName} (${group.attendees.length} attendees)`,
        quantity: group.quantity,
        price: group.price
      });
    });

    return items;
  }

  private createDelegationLineItems(registration: RegistrationData): InvoiceItem[] {
    const items: InvoiceItem[] = [];

    // For Delegation registrations, show delegation info first
    items.push({
      description: `${registration.delegationName} Delegation - ${registration.attendees.length} members`,
      quantity: 1,
      price: 0
    });

    // Group attendees by type (mason, guest)
    const attendeesByType = new Map<string, AttendeeInfo[]>();
    registration.attendees.forEach(attendee => {
      if (!attendeesByType.has(attendee.type)) {
        attendeesByType.set(attendee.type, []);
      }
      attendeesByType.get(attendee.type)!.push(attendee);
    });

    // Add summary by type
    attendeesByType.forEach((attendees, type) => {
      items.push({
        description: `  - ${type}s: ${attendees.length}`,
        quantity: attendees.length,
        price: 0
      });
    });

    // Add all tickets grouped
    const allTickets = new Map<string, { quantity: number; price: number }>();
    registration.attendees.forEach(attendee => {
      attendee.tickets.forEach(ticket => {
        const key = `${ticket.ticketName}_${ticket.price}`;
        if (!allTickets.has(key)) {
          allTickets.set(key, { quantity: 0, price: ticket.price });
        }
        allTickets.get(key)!.quantity += ticket.quantity;
      });
    });

    allTickets.forEach((ticket, key) => {
      const ticketName = key.split('_')[0];
      items.push({
        description: `  - ${ticketName}`,
        quantity: ticket.quantity,
        price: ticket.price
      });
    });

    return items;
  }

  private formatAttendeeName(attendee: AttendeeInfo): string {
    let name = '';
    
    // Add title if present
    if (attendee.title) {
      name += attendee.title + ' ';
    }
    
    name += attendee.name;
    
    // Add rank if present
    if (attendee.rank) {
      name += ` (${attendee.rank})`;
    }
    
    // Add primary attendee marker
    if (attendee.isPrimary) {
      name += ' - Primary Attendee';
    }
    
    // Add type
    name += ` (${attendee.type})`;
    
    return name;
  }

  /**
   * Calculate processing fees if not provided
   * Standard rate: 2.5% + $0.30
   */
  calculateProcessingFees(subtotal: number): number {
    const percentageFee = subtotal * 0.025;
    const fixedFee = 0.30;
    return Math.round((percentageFee + fixedFee) * 100) / 100;
  }

  /**
   * Extract registration data from MongoDB registration document
   * This will need to be adapted based on actual schema
   */
  extractRegistrationData(registrationDoc: any): RegistrationData {
    // This is a placeholder - will need to be implemented based on actual schema
    const registrationType = this.determineRegistrationType(registrationDoc);
    
    return {
      registrationType,
      confirmationNumber: registrationDoc.confirmationNumber || '',
      functionName: registrationDoc.functionName || '',
      attendees: this.extractAttendees(registrationDoc),
      lodgeName: registrationDoc.lodgeName,
      delegationName: registrationDoc.delegationName,
      totalAmount: registrationDoc.totalAmount || 0,
      processingFees: registrationDoc.processingFees || 0
    };
  }

  private determineRegistrationType(doc: any): 'Individual' | 'Lodge' | 'Delegation' {
    // Logic to determine registration type from document
    if (doc.lodgeName || doc.organisationType === 'lodge') {
      return 'Lodge';
    }
    if (doc.delegationName || doc.organisationType === 'delegation') {
      return 'Delegation';
    }
    return 'Individual';
  }

  private extractAttendees(doc: any): AttendeeInfo[] {
    // Placeholder - adapt based on actual schema
    const attendees: AttendeeInfo[] = [];
    
    if (doc.registrationData && doc.registrationData.attendees) {
      doc.registrationData.attendees.forEach((attendee: any) => {
        attendees.push({
          name: `${attendee.firstName} ${attendee.lastName}`,
          type: attendee.attendeeType || 'guest',
          isPrimary: attendee.isPrimary,
          title: attendee.title,
          rank: attendee.rank,
          tickets: this.extractTickets(attendee, doc)
        });
      });
    }
    
    return attendees;
  }

  private extractTickets(attendee: any, doc: any): AttendeeTicket[] {
    // Placeholder - adapt based on actual schema
    const tickets: AttendeeTicket[] = [];
    
    if (doc.registrationData && doc.registrationData.selectedTickets) {
      doc.registrationData.selectedTickets
        .filter((ticket: any) => ticket.attendeeId === attendee.attendeeId)
        .forEach((ticket: any) => {
          tickets.push({
            ticketName: ticket.name || ticket.ticketName || '',
            price: ticket.price || 0,
            quantity: ticket.quantity || 1
          });
        });
    }
    
    return tickets;
  }
}