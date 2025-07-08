import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';

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
    
    // Fetch all registrations
    const registrations = await db.collection('registrations').find({}).toArray();
    
    // Find registrations that include this event ticket
    const matchingRegistrations = [];
    
    for (const registration of registrations) {
      const regData = registration.registrationData || registration.registration_data;
      if (!regData) continue;
      
      let hasTicket = false;
      let ticketQuantity = 0;
      let ticketRevenue = 0;
      
      // Check new 'tickets' structure
      if (regData.tickets && Array.isArray(regData.tickets)) {
        const relevantTickets = regData.tickets.filter((ticket: any) => {
          const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
          return ticketId === eventTicketId;
        });
        
        if (relevantTickets.length > 0) {
          hasTicket = true;
          relevantTickets.forEach((ticket: any) => {
            const quantity = ticket.quantity || 1;
            const price = parseFloat(ticket.price?.$numberDecimal || ticket.price || eventTicket.price?.$numberDecimal || eventTicket.price || 0);
            ticketQuantity += quantity;
            ticketRevenue += price * quantity;
          });
        }
      }
      // Check old 'selectedTickets' structure
      else if (regData.selectedTickets && Array.isArray(regData.selectedTickets)) {
        const relevantTickets = regData.selectedTickets.filter((ticket: any) => {
          const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
          return ticketId === eventTicketId;
        });
        
        if (relevantTickets.length > 0) {
          hasTicket = true;
          relevantTickets.forEach((ticket: any) => {
            const quantity = ticket.quantity || 1;
            const price = parseFloat(ticket.price?.$numberDecimal || ticket.price || eventTicket.price?.$numberDecimal || eventTicket.price || 0);
            ticketQuantity += quantity;
            ticketRevenue += price * quantity;
          });
        }
      }
      
      if (hasTicket) {
        // Get payment information
        const payments = await db.collection('payments').find({
          $or: [
            { registrationId: registration.registrationId || registration.registration_id },
            { registration_id: registration.registrationId || registration.registration_id }
          ]
        }).toArray();
        
        const bookingContact = regData.bookingContact || regData.booking_contact || {};
        
        matchingRegistrations.push({
          registrationId: registration.registrationId || registration.registration_id || registration._id.toString(),
          confirmationNumber: registration.confirmationNumber || registration.confirmation_number || '',
          registrationType: registration.registrationType || registration.registration_type || 'unknown',
          bookingContact: {
            firstName: bookingContact.firstName || bookingContact.first_name || '',
            lastName: bookingContact.lastName || bookingContact.last_name || '',
            email: bookingContact.email || ''
          },
          paymentId: payments.length > 0 ? (payments[0].paymentId || payments[0].payment_id || payments[0]._id.toString()) : null,
          createdAt: registration.createdAt || registration.created_at || new Date(),
          ticketQuantity,
          ticketRevenue
        });
      }
    }
    
    // Calculate summary statistics
    const summary = {
      totalRegistrations: matchingRegistrations.length,
      totalQuantity: matchingRegistrations.reduce((sum, reg) => sum + reg.ticketQuantity, 0),
      totalRevenue: matchingRegistrations.reduce((sum, reg) => sum + reg.ticketRevenue, 0),
      byType: {
        individuals: 0,
        lodges: 0,
        delegations: 0,
        other: 0
      }
    };
    
    // Count by registration type
    matchingRegistrations.forEach(reg => {
      const type = reg.registrationType.toLowerCase();
      if (type === 'individuals' || type === 'individual') {
        summary.byType.individuals++;
      } else if (type === 'lodges' || type === 'lodge') {
        summary.byType.lodges++;
      } else if (type === 'delegations' || type === 'delegation') {
        summary.byType.delegations++;
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