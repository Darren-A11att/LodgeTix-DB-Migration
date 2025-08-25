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

    // Map to simplified structure with attendee lookups
    const ticketRows = await Promise.all(tickets.map(async (ticket) => {
      const attendeeId = ticket.ticketHolder?.attendeeId || ticket.ticket_holder?.attendee_id || '';
      const registrationId = ticket.details?.registrationId || ticket.details?.registration_id || '';
      
      // Lookup attendee if we have an attendeeId
      let attendeeName = '';
      let attendeeType = '';
      let lodgeNameNumber = '';
      let grandLodgeAbbreviation = '';
      let partner = '';
      
      if (attendeeId) {
        const attendee = await db.collection('attendees').findOne({
          $or: [
            { attendeeId: attendeeId },
            { attendee_id: attendeeId }
          ]
        });
        
        if (attendee) {
          // Build attendee name from parts
          const title = attendee.title || '';
          const firstName = attendee.firstName || attendee.first_name || '';
          const lastName = attendee.lastName || attendee.last_name || '';
          const suffix = attendee.suffix || '';
          const postnominals = attendee.postnominals || '';
          
          // Combine name parts, filtering out empty values
          const nameParts = [title, firstName, lastName, suffix, postnominals].filter(part => part);
          attendeeName = nameParts.join(' ');
          
          // Get other attendee fields
          attendeeType = attendee.attendeeType || attendee.attendee_type || '';
          lodgeNameNumber = attendee.lodgeNameNumber || attendee.lodge_name_number || '';
          
          // For partner field, check partner, then isPartner, then partnerOf
          const partnerId = attendee.partner || 
                           attendee.isPartner || 
                           attendee.is_partner || 
                           attendee.partnerOf || 
                           attendee.partner_of || 
                           '';
          
          // If we have a partner ID, lookup the partner attendee
          let partnerLodgeNameNumber = '';
          let partnerGrandLodgeId = '';
          if (partnerId && typeof partnerId === 'string' && partnerId !== 'true' && partnerId !== 'false') {
            const partnerAttendee = await db.collection('attendees').findOne({
              $or: [
                { attendeeId: partnerId },
                { attendee_id: partnerId }
              ]
            });
            
            if (partnerAttendee) {
              // Store partner's lodge name/number and grand lodge ID for potential use
              partnerLodgeNameNumber = partnerAttendee.lodgeNameNumber || partnerAttendee.lodge_name_number || '';
              partnerGrandLodgeId = partnerAttendee.grandLodgeId || partnerAttendee.grand_lodge_id || '';
              
              // Build partner display with relationship and name
              const relationship = partnerAttendee.relationship || '';
              const pTitle = partnerAttendee.title || '';
              const pFirstName = partnerAttendee.firstName || partnerAttendee.first_name || '';
              const pLastName = partnerAttendee.lastName || partnerAttendee.last_name || '';
              const pSuffix = partnerAttendee.suffix || '';
              
              const partnerName = [pTitle, pFirstName, pLastName, pSuffix].filter(part => part).join(' ');
              
              if (relationship) {
                partner = `${relationship} | ${partnerName}`;
              } else {
                partner = partnerName;
              }
            } else {
              // If partner not found, show the ID
              partner = partnerId;
            }
          } else {
            // Show the raw value if it's not a valid partner ID
            partner = partnerId ? String(partnerId) : '';
          }
          
          // If attendee type is 'guest' and we have partner's info, use that instead
          let grandLodgeIdToLookup = attendee.grandLodgeId || attendee.grand_lodge_id || '';
          
          if (attendeeType.toLowerCase() === 'guest') {
            if (partnerLodgeNameNumber) {
              lodgeNameNumber = partnerLodgeNameNumber;
            }
            if (partnerGrandLodgeId) {
              grandLodgeIdToLookup = partnerGrandLodgeId;
            }
          }
          
          // Lookup Grand Lodge abbreviation
          if (grandLodgeIdToLookup) {
            const grandLodge = await db.collection('grandLodges').findOne({
              $or: [
                { grandLodgeId: grandLodgeIdToLookup },
                { grand_lodge_id: grandLodgeIdToLookup }
              ]
            });
            
            if (grandLodge) {
              grandLodgeAbbreviation = grandLodge.abbreviation || '';
            } else {
              // If not found, show the ID as fallback
              grandLodgeAbbreviation = grandLodgeIdToLookup;
            }
          }
        }
      } else if (registrationId) {
        // If no attendeeId but we have a registrationId, lookup the registration
        const registration = await db.collection('registrations').findOne({
          $or: [
            { registrationId: registrationId },
            { registration_id: registrationId }
          ]
        });
        
        if (registration) {
          // Get organisation name from registration
          const organisationName = registration.organisationName || 
                                  registration.organisation_name || 
                                  registration.customer?.businessName || 
                                  registration.customer?.business_name || 
                                  '';
          
          // Use organisation name for attendee name and lodge name/number
          attendeeName = organisationName;
          lodgeNameNumber = organisationName;
          
          // Use registration type for attendee type
          attendeeType = registration.registrationType || 
                        registration.registration_type || 
                        '';
        }
      }
      
      // Lookup registration confirmation number
      let confirmationNumber = '';
      
      if (registrationId) {
        const registration = await db.collection('registrations').findOne({
          $or: [
            { registrationId: registrationId },
            { registration_id: registrationId }
          ]
        });
        
        if (registration) {
          confirmationNumber = registration.confirmationNumber || registration.confirmation_number || registrationId;
        } else {
          // If registration not found, show the ID
          confirmationNumber = registrationId;
        }
      }
      
      return {
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
        attendeeName: attendeeName, // Now showing name instead of ID
        attendeeType: attendeeType,
        lodgeNameNumber: lodgeNameNumber,
        grandLodgeAbbreviation: grandLodgeAbbreviation, // Now showing abbreviation instead of ID
        partner: partner,
        customerName: ticket.ticketOwner?.customerName || ticket.ticket_owner?.customer_name || '',
        businessName: ticket.ticketOwner?.customerBusinessName || ticket.ticket_owner?.customer_business_name || '',
        confirmationNumber: confirmationNumber, // Now showing confirmation number instead of registration ID
        paymentId: ticket.details?.paymentId || ticket.details?.payment_id || '',
        createdAt: ticket.createdAt || ticket.created_at || null
      };
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