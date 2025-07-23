import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';

interface EventTicketSalesData {
  eventTicketId: string;
  eventId: string;
  name: string;
  description: string;
  price: number;
  totalCapacity: number;
  availableCount: number;
  soldCount: number;
  status: string;
  createdAt: Date;
  transactionCount: number;
  registrationCount: number;
  totalAttendees: number;
  totalRevenue: number;
  averageOrderValue: number;
  utilizationRate: number;
  transactions: any[];
  registrations: any[];
  monthlyRevenue: Record<string, number>;
  registrationsByType: {
    individuals: number;
    lodges: number;
    delegations: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'json';
    const eventId = searchParams.get('eventId');
    
    // Fetch all eventTickets
    const eventTicketsQuery: any = {};
    if (eventId) {
      eventTicketsQuery.$or = [
        { eventId: eventId },
        { event_id: eventId }
      ];
    }
    
    // Use the view that dynamically computes counts from registrations
    const eventTickets = await db.collection('eventTickets_computed').find(eventTicketsQuery).toArray();
    console.log(`Found ${eventTickets.length} event tickets`);
    
    // Build transaction query
    const transactionQuery: any = {
      $or: [
        { item_description: { $regex: /event.*ticket/i } },
        { eventTicketId: { $exists: true } },
        { event_ticket_id: { $exists: true } }
      ]
    };
    
    // Add date filtering for transactions
    if (startDate || endDate) {
      transactionQuery.invoiceDate = {};
      if (startDate) {
        transactionQuery.invoiceDate.$gte = new Date(startDate);
      }
      if (endDate) {
        transactionQuery.invoiceDate.$lte = new Date(endDate);
      }
    }
    
    // Fetch transactions
    const eventTicketTransactions = await db.collection('transactions')
      .find(transactionQuery)
      .toArray();
    console.log(`Found ${eventTicketTransactions.length} event ticket transactions`);
    
    // Fetch all registrations
    const registrations = await db.collection('registrations').find({}).toArray();
    console.log(`Found ${registrations.length} registrations`);
    
    // Create comprehensive map for each event ticket
    const eventTicketSalesData = new Map<string, EventTicketSalesData>();
    
    // Initialize all eventTickets with sales data structure
    eventTickets.forEach(ticket => {
      const ticketId = ticket.eventTicketId || ticket.event_ticket_id;
      eventTicketSalesData.set(ticketId, {
        eventTicketId: ticketId,
        eventId: ticket.eventId || ticket.event_id,
        name: ticket.name,
        description: ticket.description || '',
        price: parseFloat(ticket.price?.$numberDecimal || ticket.price || 0),
        totalCapacity: ticket.totalCapacity || ticket.total_capacity || 0,
        availableCount: ticket.availableCount || ticket.available_count || 0,
        soldCount: ticket.soldCount || ticket.sold_count || 0,
        status: ticket.status || (ticket.isActive ? 'active' : 'inactive'),
        createdAt: ticket.createdAt || ticket.created_at,
        transactionCount: 0,
        registrationCount: 0,
        totalAttendees: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        utilizationRate: 0,
        transactions: [],
        registrations: [],
        monthlyRevenue: {},
        registrationsByType: {
          individuals: 0,
          lodges: 0,
          delegations: 0
        }
      });
    });
    
    // Process transactions
    eventTicketTransactions.forEach(transaction => {
      const eventTicketId = transaction.eventTicketId || transaction.event_ticket_id;
      
      let ticketData = null;
      if (eventTicketId) {
        ticketData = eventTicketSalesData.get(eventTicketId);
      } else {
        // Try to match by description
        for (const [id, data] of eventTicketSalesData) {
          if (transaction.item_description && data.name && 
              transaction.item_description.toLowerCase().includes(data.name.toLowerCase())) {
            ticketData = data;
            break;
          }
        }
      }
      
      if (ticketData) {
        ticketData.transactionCount++;
        const itemPrice = parseFloat(transaction.item_price || 0);
        const itemQuantity = parseInt(transaction.item_quantity || 1);
        ticketData.totalRevenue += itemPrice;
        ticketData.totalAttendees += itemQuantity;
        
        // Track monthly revenue
        if (transaction.invoiceDate) {
          const date = new Date(transaction.invoiceDate);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          ticketData.monthlyRevenue[monthKey] = (ticketData.monthlyRevenue[monthKey] || 0) + itemPrice;
        }
        
        ticketData.transactions.push({
          transactionId: transaction._id,
          invoiceNumber: transaction.invoiceNumber,
          invoiceDate: transaction.invoiceDate,
          quantity: itemQuantity,
          price: itemPrice,
          customerName: `${transaction.billTo_firstName || ''} ${transaction.billTo_lastName || ''}`.trim(),
          customerEmail: transaction.billTo_email
        });
      }
    });
    
    // Process registrations
    registrations.forEach(registration => {
      const regData = registration.registrationData || registration.registration_data;
      if (regData) {
        const uniqueEventTicketIds = new Set<string>();
        let ticketCount = 0;
        
        // Check for tickets array (new structure)
        if (regData.tickets && Array.isArray(regData.tickets)) {
          regData.tickets.forEach((ticket: any) => {
            const eventTicketId = ticket.eventTicketId || ticket.event_ticket_id;
            // Only count tickets that have a valid eventTicketId (skip packages and null IDs)
            if (eventTicketId && eventTicketId !== null) {
              uniqueEventTicketIds.add(eventTicketId);
              ticketCount++;
            }
          });
        }
        // Fall back to selectedTickets (old structure)
        else if (regData.selectedTickets && Array.isArray(regData.selectedTickets)) {
          regData.selectedTickets.forEach((ticket: any) => {
            const eventTicketId = ticket.eventTicketId || ticket.event_ticket_id;
            if (eventTicketId) {
              uniqueEventTicketIds.add(eventTicketId);
              ticketCount += ticket.quantity || 1;
            }
          });
        }
        
        uniqueEventTicketIds.forEach(eventTicketId => {
          const ticketData = eventTicketSalesData.get(eventTicketId);
          if (ticketData) {
            ticketData.registrationCount++;
            
            // Calculate quantity for this ticket in this registration
            let quantityForThisTicket = 0;
            
            // Count attendees based on ticket structure
            if (regData.tickets) {
              // For new structure, count tickets considering quantity field
              const ticketsForThisEvent = regData.tickets.filter((t: any) => 
                (t.eventTicketId || t.event_ticket_id) === eventTicketId
              );
              
              ticketsForThisEvent.forEach((t: any) => {
                // If ticket has a quantity field, use it; otherwise count as 1
                const quantity = t.quantity || 1;
                quantityForThisTicket += quantity;
                ticketData.totalAttendees += quantity;
                
                // Calculate revenue: price × quantity
                const ticketPrice = parseFloat(t.price || ticketData.price || 0);
                ticketData.totalRevenue += ticketPrice * quantity;
              });
            } else if (regData.selectedTickets) {
              // For old structure, use quantity
              const selectedTicket = regData.selectedTickets.find((t: any) => 
                (t.eventTicketId || t.event_ticket_id) === eventTicketId
              );
              if (selectedTicket) {
                const quantity = selectedTicket.quantity || 1;
                quantityForThisTicket += quantity;
                ticketData.totalAttendees += quantity;
              }
            }
            
            // Track quantity by registration type (not just count)
            const regType = (registration.registrationType || registration.registration_type || '').toLowerCase();
            if (regType === 'individuals' || regType === 'individual') {
              ticketData.registrationsByType.individuals += quantityForThisTicket;
            } else if (regType === 'lodges' || regType === 'lodge') {
              ticketData.registrationsByType.lodges += quantityForThisTicket;
            } else if (regType === 'delegations' || regType === 'delegation') {
              ticketData.registrationsByType.delegations += quantityForThisTicket;
            }
            
            ticketData.registrations.push({
              registrationId: registration.registrationId || registration.registration_id,
              confirmationNumber: registration.confirmationNumber || registration.confirmation_number,
              registrationType: registration.registrationType || registration.registration_type,
              attendeeCount: registration.attendeeCount || registration.attendee_count || ticketCount,
              totalAmount: parseFloat(registration.totalAmountPaid?.$numberDecimal || registration.totalAmountPaid || registration.total_amount_paid || 0)
            });
          }
        });
      }
    });
    
    // Calculate averages and utilization
    const reportData = Array.from(eventTicketSalesData.values())
      .map(ticket => {
        ticket.averageOrderValue = ticket.transactionCount > 0 
          ? parseFloat((ticket.totalRevenue / ticket.transactionCount).toFixed(2))
          : 0;
        ticket.utilizationRate = ticket.totalCapacity > 0 
          ? parseFloat(((ticket.totalAttendees / ticket.totalCapacity) * 100).toFixed(1))
          : 0;
        return ticket;
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    // Calculate summary statistics
    const totalTickets = reportData.length;
    const activeTickets = reportData.filter(t => t.status === 'active').length;
    const ticketsWithSales = reportData.filter(t => t.transactionCount > 0 || t.registrationCount > 0).length;
    const totalRevenue = reportData.reduce((sum, t) => sum + t.totalRevenue, 0);
    const totalAttendees = reportData.reduce((sum, t) => sum + t.totalAttendees, 0);
    const totalCapacity = reportData.reduce((sum, t) => sum + (t.totalCapacity || 0), 0);
    const overallUtilization = totalCapacity > 0 ? ((totalAttendees / totalCapacity) * 100).toFixed(1) : 0;
    
    // Calculate monthly totals
    const monthlyTotals: Record<string, number> = {};
    reportData.forEach(ticket => {
      Object.entries(ticket.monthlyRevenue).forEach(([month, revenue]) => {
        monthlyTotals[month] = (monthlyTotals[month] || 0) + revenue;
      });
    });
    
    // Format response based on requested format
    if (format === 'csv') {
      // Generate CSV
      const csv = [
        'Event Ticket ID,Event ID,Name,Description,Status,Price,Total Capacity,Available Count,Sold Count,Transaction Count,Registration Count,Individuals,Lodges,Delegations,Total Attendees,Total Revenue,Average Order Value,Utilization Rate %',
        ...reportData.map(ticket => 
          `"${ticket.eventTicketId}","${ticket.eventId}","${ticket.name}","${ticket.description}","${ticket.status}",${ticket.price.toFixed(2)},${ticket.totalCapacity || ''},${ticket.availableCount || ''},${ticket.soldCount || 0},${ticket.transactionCount},${ticket.registrationCount},${ticket.registrationsByType.individuals},${ticket.registrationsByType.lodges},${ticket.registrationsByType.delegations},${ticket.totalAttendees},${ticket.totalRevenue.toFixed(2)},${ticket.averageOrderValue},${ticket.utilizationRate}`
        )
      ].join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="event-tickets-sales-report-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }
    
    // Return JSON response
    return NextResponse.json({
      summary: {
        totalTickets,
        activeTickets,
        ticketsWithSales,
        totalRevenue,
        totalAttendees,
        totalCapacity,
        overallUtilization: parseFloat(overallUtilization as string)
      },
      monthlyRevenue: monthlyTotals,
      tickets: reportData.map(ticket => ({
        eventTicketId: ticket.eventTicketId,
        eventId: ticket.eventId,
        name: ticket.name,
        description: ticket.description,
        status: ticket.status,
        price: ticket.price,
        totalCapacity: ticket.totalCapacity,
        availableCount: ticket.availableCount,
        soldCount: ticket.soldCount,
        transactionCount: ticket.transactionCount,
        registrationCount: ticket.registrationCount,
        totalAttendees: ticket.totalAttendees,
        totalRevenue: ticket.totalRevenue,
        averageOrderValue: ticket.averageOrderValue,
        utilizationRate: ticket.utilizationRate,
        monthlyRevenue: ticket.monthlyRevenue,
        recentTransactions: ticket.transactions.slice(-5),
        registrationsByType: ticket.registrationsByType
      }))
    });
    
  } catch (error) {
    console.error('Error generating event tickets report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}