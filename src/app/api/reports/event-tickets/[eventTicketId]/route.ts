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
    
    // Fetch all tickets for this eventTicketId with aggregation pipeline
    const ticketsWithData = await db.collection('tickets').aggregate([
      {
        $match: {
          $or: [
            { eventTicketId: eventTicketId },
            { event_ticket_id: eventTicketId }
          ]
        }
      },
      // Lookup attendee data using ticketHolder.attendeeId
      {
        $lookup: {
          from: 'attendees',
          let: { attendeeId: { $ifNull: ['$ticketHolder.attendeeId', '$ticket_holder.attendee_id'] } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$attendeeId', '$$attendeeId'] },
                    { $eq: ['$attendee_id', '$$attendeeId'] }
                  ]
                }
              }
            }
          ],
          as: 'attendeeData'
        }
      },
      // Lookup registration data using details.registrationId
      {
        $lookup: {
          from: 'registrations',
          let: { 
            regId: { 
              $ifNull: [
                '$details.registrationId', 
                '$details.registration_id'
              ] 
            } 
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$registrationId', '$$regId'] },
                    { $eq: ['$registration_id', '$$regId'] }
                  ]
                }
              }
            }
          ],
          as: 'registrationData'
        }
      },
      // Lookup contact data if ticketOwner.ownerType is 'contact'
      {
        $lookup: {
          from: 'contacts',
          let: { 
            customerId: { 
              $ifNull: [
                '$ticketOwner.customerId', 
                '$ticket_owner.customer_id'
              ] 
            },
            ownerType: {
              $ifNull: [
                '$ticketOwner.ownerType',
                '$ticket_owner.owner_type'
              ]
            }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$$ownerType', 'contact'] },
                    {
                      $or: [
                        { $eq: ['$contactId', '$$customerId'] },
                        { $eq: ['$contact_id', '$$customerId'] }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: 'contactData'
        }
      },
      // Lookup organisation data if ticketOwner.ownerType is 'organisation'
      {
        $lookup: {
          from: 'organisations',
          let: { 
            customerId: { 
              $ifNull: [
                '$ticketOwner.customerId', 
                '$ticket_owner.customer_id'
              ] 
            },
            ownerType: {
              $ifNull: [
                '$ticketOwner.ownerType',
                '$ticket_owner.owner_type'
              ]
            }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$$ownerType', 'organisation'] },
                    {
                      $or: [
                        { $eq: ['$organisationId', '$$customerId'] },
                        { $eq: ['$organisation_id', '$$customerId'] }
                      ]
                    }
                  ]
                }
              }
            }
          ],
          as: 'organisationData'
        }
      }
    ]).toArray();
    
    // Process each ticket to build the report data
    const ticketRows = [];
    
    for (const ticket of ticketsWithData) {
      const attendee = ticket.attendeeData?.[0] || null;
      const registration = ticket.registrationData?.[0] || null;
      const contact = ticket.contactData?.[0] || null;
      const organisation = ticket.organisationData?.[0] || null;
      
      // Check if ticketHolder has an attendeeId
      const ticketHolderAttendeeId = ticket.ticketHolder?.attendeeId || ticket.ticket_holder?.attendee_id || '';
      
      // Build holder name - check various conditions
      let holderName = '';
      let attendeeType = '';
      let lodgeNameNumber = '';
      let partnerInfo = '';
      
      if (!ticketHolderAttendeeId || ticketHolderAttendeeId === '') {
        // If no attendeeId and registration type is lodge, use lodge name from registration
        const registrationType = registration?.registrationType || registration?.registration_type || '';
        if (registrationType === 'lodge' && registration) {
          const regData = registration.registrationData || registration.registration_data || {};
          const lodgeDetails = regData.lodgeDetails || regData.lodge_details || {};
          holderName = lodgeDetails.lodgeName || lodgeDetails.lodge_name || '';
        }
        
        // If still no holder name, use customerBusinessName
        if (!holderName) {
          holderName = ticket.ticketOwner?.customerBusinessName || 
                      ticket.ticket_owner?.customer_business_name || '';
        }
      } else if (attendee) {
        // Otherwise use attendee information
        const title = attendee.title || '';
        const firstName = attendee.firstName || attendee.first_name || '';
        const lastName = attendee.lastName || attendee.last_name || '';
        const suffix = attendee.suffix || '';
        holderName = `${title} ${firstName} ${lastName} ${suffix}`.trim();
      }
      
      if (attendee) {
        attendeeType = attendee.attendeeType || attendee.attendee_type || '';
        
        // If attendeeType is guest and relationship exists, show relationship instead
        const relationship = attendee.relationship || '';
        if (attendeeType === 'guest' && relationship) {
          attendeeType = relationship;
        }
        
        lodgeNameNumber = attendee.lodgeNameNumber || attendee.lodge_name_number || '';
        
        // Handle partner logic
        const partnerId = attendee.partner || attendee.partnerOf || (attendee.isPartner ? attendee.attendeeId || attendee.attendee_id : null);
        if (partnerId) {
          // Lookup partner attendee
          const partnerAttendee = await db.collection('attendees').findOne({
            $or: [
              { attendeeId: partnerId },
              { attendee_id: partnerId }
            ]
          });
          
          if (partnerAttendee) {
            const pTitle = partnerAttendee.title || '';
            const pFirstName = partnerAttendee.firstName || partnerAttendee.first_name || '';
            const pLastName = partnerAttendee.lastName || partnerAttendee.last_name || '';
            const pSuffix = partnerAttendee.suffix || '';
            partnerInfo = `${pTitle} ${pFirstName} ${pLastName} ${pSuffix}`.trim();
            
            // If attendeeType is partner or guest, use partner's lodge info
            if ((attendee.attendeeType || attendee.attendee_type || '') === 'partner' || 
                (attendee.attendeeType || attendee.attendee_type || '') === 'guest') {
              lodgeNameNumber = partnerAttendee.lodgeNameNumber || partnerAttendee.lodge_name_number || '';
            }
          }
        }
      }
      
      // Debug: Log ticket owner structure for first few tickets
      if (ticketRows.length < 3) {
        console.log(`\nTicket ${ticket.ticketNumber || ticket.ticket_number}:`);
        console.log('ticketOwner:', JSON.stringify(ticket.ticketOwner || ticket.ticket_owner, null, 2));
        console.log('contact:', contact ? `${contact.firstName} ${contact.lastName}` : 'null');
        console.log('organisation:', organisation ? organisation.name : 'null');
      }
      
      // Get booked by and owner from ticketOwner and looked up data
      const ticketOwnerData = ticket.ticketOwner || ticket.ticket_owner || {};
      const ticketOwnerType = ticketOwnerData.ownerType || ticketOwnerData.owner_type || '';
      
      // Determine bookedBy and owner based on ownerType and actual data
      let bookedBy = '';
      let owner = '';
      
      if (ticketOwnerType === 'organisation' && organisation) {
        // Use actual organisation name from lookup
        bookedBy = organisation.name || '';
        owner = organisation.name || '';
      } else if (ticketOwnerType === 'contact' && contact) {
        // Use actual contact name from lookup
        const firstName = contact.firstName || contact.first_name || '';
        const lastName = contact.lastName || contact.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        bookedBy = fullName;
        owner = fullName;
      } else {
        // Fallback to data in ticketOwner if lookup failed
        if (ticketOwnerType === 'organisation') {
          bookedBy = ticketOwnerData.customerBusinessName || ticketOwnerData.customer_business_name || '';
        } else if (ticketOwnerType === 'contact') {
          bookedBy = ticketOwnerData.customerName || ticketOwnerData.customer_name || '';
        }
        owner = bookedBy;
      }
      
      // If still no owner/bookedBy, try to get from registration
      if (!bookedBy && registration) {
        // Check if registration has customer info
        const regCustomer = registration.customer || {};
        if (regCustomer.type === 'organisation' || regCustomer.businessName) {
          bookedBy = regCustomer.businessName || regCustomer.name || '';
          owner = bookedBy;
        } else if (regCustomer.type === 'contact' || regCustomer.firstName || regCustomer.lastName) {
          const firstName = regCustomer.firstName || regCustomer.first_name || '';
          const lastName = regCustomer.lastName || regCustomer.last_name || '';
          bookedBy = `${firstName} ${lastName}`.trim() || regCustomer.name || '';
          owner = bookedBy;
        }
        
        // Also check registrationData for lodge registrations
        if (!bookedBy && registration.registrationType === 'lodge') {
          const regData = registration.registrationData || registration.registration_data || {};
          const lodgeDetails = regData.lodgeDetails || regData.lodge_details || {};
          bookedBy = lodgeDetails.lodgeName || lodgeDetails.lodge_name || '';
          owner = bookedBy;
        }
      }
      
      // Get registration fields including registration type
      const confirmationNumber = registration?.confirmationNumber || 
                                registration?.confirmation_number || '';
      const paymentStatus = registration?.paymentStatus || 
                           registration?.payment_status || '';
      const registrationType = registration?.registrationType || 
                              registration?.registration_type || '';
      const createdDate = registration?.createdDate || 
                         registration?.created_date || 
                         registration?.createdAt || 
                         registration?.created_at || 
                         ticket.createdAt || 
                         ticket.created_at || 
                         new Date();
      
      // Get direct ticket fields
      const ticketNumber = ticket.ticketNumber || ticket.ticket_number || '';
      const status = ticket.status || '';
      const price = parseFloat(
        ticket.price?.$numberDecimal || 
        ticket.price || 
        eventTicket.price?.$numberDecimal || 
        eventTicket.price || 
        0
      );
      const quantity = ticket.quantity || 1;
      
      ticketRows.push({
        ticketId: ticket.ticketId || ticket.ticket_id || ticket._id.toString(),
        ticketNumber: ticketNumber,
        status: status,
        price: price,
        quantity: quantity,
        holderName: holderName,
        registrationType: registrationType || '',  // Registration type from registration
        attendeeType: attendeeType,  // Attendee type from attendee
        partnerName: partnerInfo,
        lodgeNameNumber: lodgeNameNumber,
        bookedBy: bookedBy,
        owner: owner,  // Owner based on ticketOwner.ownerType
        confirmationNumber: confirmationNumber,
        paymentStatus: paymentStatus,
        createdDate: createdDate,
        revenue: price * quantity
      });
    }
    
    // Calculate summary statistics
    const summary = {
      totalTickets: ticketRows.length,
      totalQuantity: ticketRows.reduce((sum, row) => sum + row.quantity, 0),
      totalRevenue: ticketRows.reduce((sum, row) => sum + row.revenue, 0),
      byStatus: {
        active: ticketRows.filter(t => t.status === 'active').length,
        cancelled: ticketRows.filter(t => t.status === 'cancelled').length,
        other: ticketRows.filter(t => !['active', 'cancelled'].includes(t.status)).length
      },
      byPaymentStatus: {
        paid: ticketRows.filter(t => t.paymentStatus === 'paid').length,
        pending: ticketRows.filter(t => t.paymentStatus === 'pending').length,
        failed: ticketRows.filter(t => t.paymentStatus === 'failed').length,
        other: ticketRows.filter(t => !['paid', 'pending', 'failed'].includes(t.paymentStatus)).length
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