/**
 * Registration processor for extracting and processing registration data
 * Updated to use normalized attendees and tickets collections
 */

import {
  RegistrationData,
  ProcessedAttendee,
  ProcessedTicket,
  BillingDetails,
  LodgeInfo,
  ProcessedRegistrationData
} from '../types';
import { MongoClient, ObjectId } from 'mongodb';

export class NormalizedRegistrationProcessor {
  private mongoClient: MongoClient;
  private dbName: string;

  constructor() {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    this.dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
    this.mongoClient = new MongoClient(uri);
  }

  /**
   * Process a registration and extract all relevant data from normalized collections
   */
  async process(registration: RegistrationData): Promise<ProcessedRegistrationData> {
    try {
      await this.mongoClient.connect();
      const db = this.mongoClient.db(this.dbName);
      
      // Get attendees from the attendees collection
      const attendees = await this.extractAttendeesFromCollection(registration, db);
      
      // Get tickets from the tickets collection (for reference)
      const tickets = await this.extractTicketsFromCollection(registration, db);
      
      // Extract other data as before
      const billingDetails = this.extractBillingDetails(registration);
      const lodgeInfo = this.extractLodgeInfo(registration);
      
      return {
        attendees,
        tickets,
        billingDetails,
        lodgeInfo,
        functionName: registration.functionName,
        confirmationNumber: registration.confirmationNumber
      };
    } finally {
      await this.mongoClient.close();
    }
  }

  /**
   * Extract attendees from the normalized attendees collection
   */
  private async extractAttendeesFromCollection(
    registration: RegistrationData, 
    db: any
  ): Promise<ProcessedAttendee[]> {
    const processedAttendees: ProcessedAttendee[] = [];
    
    // Get attendee ObjectId references from registration
    const attendeeRefs = registration.registrationData?.attendees || registration.attendees || [];
    
    for (const attendeeRef of attendeeRefs) {
      // Handle both ObjectId references and legacy full objects
      let attendeeId: string;
      
      if (attendeeRef._id && Object.keys(attendeeRef).length === 1) {
        // This is an ObjectId reference
        attendeeId = attendeeRef._id.toString();
      } else if (attendeeRef.attendeeId || attendeeRef.id) {
        // Legacy full object - skip as we should use the collection
        console.warn('Found legacy attendee object in registration - should be ObjectId reference');
        continue;
      } else {
        continue;
      }
      
      // Fetch attendee from collection
      const attendee = await db.collection('attendees').findOne({
        _id: ObjectId.isValid(attendeeId) ? new ObjectId(attendeeId) : attendeeId
      });
      
      if (!attendee) {
        console.warn(`Attendee not found: ${attendeeId}`);
        continue;
      }
      
      // Fetch tickets for this attendee
      const attendeeTickets: ProcessedTicket[] = [];
      
      for (const ticketRef of (attendee.event_tickets || [])) {
        const ticket = await db.collection('tickets').findOne({
          _id: ticketRef._id
        });
        
        if (ticket) {
          attendeeTickets.push({
            id: ticket._id.toString(),
            attendeeId: attendee.attendeeId,
            ownerId: ticket.ownerId,
            ownerType: ticket.ownerType,
            name: ticket.eventName,
            price: ticket.price || 0,
            quantity: ticket.quantity || 1,
            description: '',
            eventTicketId: ticket.eventTicketId,
            status: ticket.status
          });
        }
      }
      
      // Create processed attendee
      const processedAttendee: ProcessedAttendee = {
        id: attendee.attendeeId || attendee._id.toString(),
        name: this.buildAttendeeName(attendee),
        title: attendee.title,
        firstName: attendee.firstName,
        lastName: attendee.lastName,
        lodgeInfo: attendee.organization || '',
        lodgeNameNumber: attendee.organization || '',
        tickets: attendeeTickets
      };
      
      processedAttendees.push(processedAttendee);
    }
    
    return processedAttendees;
  }

  /**
   * Extract all tickets for a registration from the tickets collection
   */
  private async extractTicketsFromCollection(
    registration: RegistrationData,
    db: any
  ): Promise<ProcessedTicket[]> {
    const tickets: ProcessedTicket[] = [];
    
    // Query tickets collection for this registration
    const registrationId = registration.registrationId || registration._id?.toString();
    
    const ticketDocs = await db.collection('tickets').find({
      'details.registrationId': registrationId
    }).toArray();
    
    for (const ticket of ticketDocs) {
      tickets.push({
        id: ticket._id.toString(),
        attendeeId: ticket.ownerId, // May not be an attendee for lodge/unassigned tickets
        ownerId: ticket.ownerId,
        ownerType: ticket.ownerType,
        name: ticket.eventName,
        price: ticket.price || 0,
        quantity: ticket.quantity || 1,
        description: '',
        eventTicketId: ticket.eventTicketId,
        status: ticket.status
      });
    }
    
    return tickets;
  }

  /**
   * Build attendee name from available fields
   */
  private buildAttendeeName(attendee: any): string {
    const parts = [
      attendee.title,
      attendee.firstName,
      attendee.lastName
    ].filter(Boolean);
    
    if (parts.length > 0) {
      return parts.join(' ');
    }
    
    return attendee.name || 'Unknown Attendee';
  }

  /**
   * Extract billing details from registration
   */
  extractBillingDetails(registration: RegistrationData): BillingDetails {
    const regData = registration.registrationData || {};
    const billing = regData.billingDetails || regData.bookingContact || {};
    
    return {
      businessName: billing.businessName || billing.companyName || '',
      businessNumber: billing.businessNumber || billing.abn || '',
      title: billing.title || '',
      firstName: billing.firstName || billing.first_name || '',
      lastName: billing.lastName || billing.last_name || '',
      email: billing.email || billing.emailAddress || '',
      phone: billing.phone || billing.phoneNumber || '',
      mobileNumber: billing.mobileNumber || billing.mobile || '',
      addressLine1: billing.addressLine1 || billing.address1 || '',
      addressLine2: billing.addressLine2 || billing.address2 || '',
      city: billing.city || billing.suburb || '',
      postalCode: billing.postalCode || billing.postcode || '',
      stateProvince: billing.stateProvince || billing.state || '',
      country: billing.country || 'Australia'
    };
  }

  /**
   * Extract lodge information from registration
   */
  private extractLodgeInfo(registration: RegistrationData): LodgeInfo | undefined {
    if (registration.registrationType !== 'lodge' && registration.registrationType !== 'lodges') {
      return undefined;
    }
    
    const regData = registration.registrationData || {};
    const lodge = regData.lodgeDetails || regData.lodge || {};
    
    return {
      lodgeName: lodge.lodgeName || lodge.name || '',
      lodgeNumber: lodge.lodgeNumber || lodge.number || '',
      lodgeNameNumber: lodge.lodgeNameNumber || `${lodge.lodgeName} ${lodge.lodgeNumber}`.trim(),
      memberCount: lodge.memberCount || regData.attendeeCount || 0,
      pricePerMember: lodge.pricePerMember || 0
    };
  }
}