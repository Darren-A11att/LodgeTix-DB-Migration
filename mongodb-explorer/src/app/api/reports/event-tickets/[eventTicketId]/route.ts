import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventTicketId: string }> }
) {
  try {
    const { db } = await connectMongoDB();
    const { eventTicketId } = await params;
    
    // Fetch the event ticket details
    const eventTicket = await db.collection('eventTickets').findOne({
      $or: [
        { eventTicketId: eventTicketId },
        { event_ticket_id: eventTicketId }
      ]
    });
    
    if (!eventTicket) {
      return NextResponse.json(
        { error: 'Event ticket not found' },
        { status: 404 }
      );
    }
    
    // Fetch all tickets for this eventTicketId
    const tickets = await db.collection('tickets').find({
      $or: [
        { eventTicketId: eventTicketId },
        { event_ticket_id: eventTicketId }
      ]
    }).toArray();
    
    // Process each ticket to build the report data
    const matchingRegistrations = [];
    
    for (const ticket of tickets) {
      // Get owner information based on ownerType
      let ownerInfo = '';
      let lodgeInfo = '';
      const ownerType = ticket.ownerType || ticket.owner_type || 'unknown';
      const ownerId = ticket.ownerId || ticket.owner_id;
      
      if (ownerId) {
        if (ownerType === 'attendee') {
          // Lookup attendee using attendeeId
          const attendee = await db.collection('attendees').findOne({
            $or: [
              { attendeeId: ownerId },
              { attendee_id: ownerId }
            ]
          });
          
          if (attendee) {
            const title = attendee.title || '';
            const firstName = attendee.firstName || attendee.first_name || '';
            const lastName = attendee.lastName || attendee.last_name || '';
            const rank = attendee.rank || '';
            const displayRank = rank === 'GL' ? 'Grand Rank' : rank;
            ownerInfo = `${title} ${firstName} ${lastName} ${displayRank}`.trim();
            
            // Get lodge info from attendee
            lodgeInfo = attendee.lodgeNameNumber || attendee.lodge_name_number || '';
          }
        } else if (ownerType === 'lodge') {
          // Lookup lodge
          const lodge = await db.collection('lodges').findOne({
            $or: [
              { lodgeId: ownerId },
              { lodge_id: ownerId },
              { _id: ObjectId.isValid(ownerId) ? new ObjectId(ownerId) : ownerId }
            ]
          });
          
          if (lodge) {
            const lodgeNameNumber = lodge.lodgeNameNumber || lodge.lodge_name_number || '';
            const grandLodge = lodge.grandLodge || lodge.grand_lodge || {};
            const abbreviation = grandLodge.abbreviation || '';
            ownerInfo = abbreviation ? `${lodgeNameNumber} | ${abbreviation}` : lodgeNameNumber;
            lodgeInfo = lodgeNameNumber;
          }
        }
      }
      
      // Get registration information from details object
      const details = ticket.details || {};
      const registrationId = details.registrationId || details.registration_id;
      let confirmationNumber = '';
      let invoiceNumber = '';
      let paymentStatus = '';
      let bookingContact = { firstName: '', lastName: '', email: '' };
      let paymentId = null;
      
      if (registrationId) {
        const registration = await db.collection('registrations').findOne({
          $or: [
            { registrationId: registrationId },
            { registration_id: registrationId }
          ]
        });
        
        if (registration) {
          confirmationNumber = registration.confirmationNumber || registration.confirmation_number || '';
          invoiceNumber = registration.invoiceNumber || registration.invoice_number || '';
          paymentStatus = registration.paymentStatus || registration.payment_status || '';
          
          // Get booking contact from import_customers
          const regData = registration.registrationData || registration.registration_data || {};
          const bookingContactId = regData.bookingContact || regData.booking_contact;
          
          if (bookingContactId && ObjectId.isValid(bookingContactId)) {
            const customer = await db.collection('import_customers').findOne({
              _id: new ObjectId(bookingContactId)
            });
            
            if (customer) {
              bookingContact = {
                firstName: customer.firstName || customer.first_name || '',
                lastName: customer.lastName || customer.last_name || '',
                email: customer.email || ''
              };
            }
          }
          
          // Get payment information
          const payment = await db.collection('payments').findOne({
            $or: [
              { registrationId: registrationId },
              { registration_id: registrationId }
            ]
          });
          
          if (payment) {
            paymentId = payment.paymentId || payment.payment_id || payment._id.toString();
          }
        }
      }
      
      // Get quantity from ticket
      const quantity = ticket.quantity || 1;
      
      // Calculate revenue (using ticket price or event ticket price)
      const price = parseFloat(
        ticket.price?.$numberDecimal || 
        ticket.price || 
        eventTicket.price?.$numberDecimal || 
        eventTicket.price || 
        0
      );
      
      matchingRegistrations.push({
        registrationId: ticket.ticketId || ticket.ticket_id || ticket._id.toString(),
        confirmationNumber: confirmationNumber,
        invoiceNumber: invoiceNumber,
        paymentStatus: paymentStatus,
        registrationType: ownerType,
        owner: ownerInfo,
        lodge: lodgeInfo,
        bookingContact: bookingContact,
        paymentId: paymentId,
        createdAt: ticket.createdAt || ticket.created_at || new Date(),
        ticketQuantity: quantity,
        ticketRevenue: price * quantity
      });
    }
    
    // Calculate summary statistics
    const summary = {
      totalRegistrations: matchingRegistrations.length,
      totalQuantity: matchingRegistrations.reduce((sum, reg) => sum + reg.ticketQuantity, 0),
      totalRevenue: matchingRegistrations.reduce((sum, reg) => sum + reg.ticketRevenue, 0),
      byType: {
        attendee: 0,
        lodge: 0,
        delegation: 0,
        other: 0
      }
    };
    
    // Count by owner type
    matchingRegistrations.forEach(reg => {
      const type = reg.registrationType.toLowerCase();
      if (type === 'attendee') {
        summary.byType.attendee++;
      } else if (type === 'lodge') {
        summary.byType.lodge++;
      } else if (type === 'delegation') {
        summary.byType.delegation++;
      } else {
        summary.byType.other++;
      }
    });
    
    return NextResponse.json({
      eventTicket: {
        eventTicketId: eventTicket.eventTicketId || eventTicket.event_ticket_id,
        name: eventTicket.name,
        description: eventTicket.description || '',
        price: parseFloat(eventTicket.price?.$numberDecimal || eventTicket.price || 0)
      },
      registrations: matchingRegistrations,
      summary
    });
    
  } catch (error) {
    console.error('Error fetching event ticket details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch details' },
      { status: 500 }
    );
  }
}