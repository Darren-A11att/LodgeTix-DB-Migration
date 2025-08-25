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
    
    // Get tickets directly without aggregation - just simple find
    const tickets = await db.collection('tickets')
      .find({ 
        $or: [
          { eventTicketId: eventTicketId },
          { event_ticket_id: eventTicketId }
        ]
      })
      .toArray();

    // Map to simplified structure
    const ticketRows = tickets.map(ticket => ({
      ticketNumber: ticket.ticketNumber || ticket.ticket_number || '',
      price: parseFloat(
        ticket.price?.$numberDecimal || 
        ticket.price || 
        eventTicket.price?.$numberDecimal || 
        eventTicket.price || 
        0
      ),
      quantity: ticket.quantity || 1,
      status: ticket.status || '',
      attendeeId: ticket.ticketHolder?.attendeeId || ticket.ticket_holder?.attendee_id || '',
      customerName: ticket.ticketOwner?.customerName || ticket.ticket_owner?.customer_name || '',
      businessName: ticket.ticketOwner?.customerBusinessName || ticket.ticket_owner?.customer_business_name || '',
      registrationId: ticket.details?.registrationId || ticket.details?.registration_id || '',
      paymentId: ticket.details?.paymentId || ticket.details?.payment_id || '',
      createdAt: ticket.createdAt || ticket.created_at || null
    }));

    // Calculate summary
    const summary = {
      totalTickets: ticketRows.length,
      totalQuantity: ticketRows.reduce((sum, row) => sum + row.quantity, 0),
      totalRevenue: ticketRows.reduce((sum, row) => sum + (row.price * row.quantity), 0),
      byStatus: {
        active: ticketRows.filter(t => t.status === 'active').length,
        sold: ticketRows.filter(t => t.status === 'sold').length,
        cancelled: ticketRows.filter(t => t.status === 'cancelled').length,
        other: ticketRows.filter(t => !['active', 'sold', 'cancelled'].includes(t.status)).length
      }
    };

    return NextResponse.json({
      eventTicket: {
        eventTicketId: eventTicket.eventTicketId || eventTicket.event_ticket_id,
        name: eventTicket.name,
        description: eventTicket.description || '',
        price: parseFloat(eventTicket.price?.$numberDecimal || eventTicket.price || 0)
      },
      tickets: ticketRows,
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