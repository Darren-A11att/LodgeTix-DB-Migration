import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('commerce');
    
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Fetch metrics in parallel
    const [
      ordersToProcess,
      lowStockItems,
      pendingRefunds,
      todaysOrders,
      newCustomers,
      activeCarts,
      awaitingFulfillment,
    ] = await Promise.all([
      // Orders with pending payment or processing status
      db.collection('orders').countDocuments({ 
        $or: [
          { payment_status: 'pending' },
          { payment_status: 'awaiting' },
          { fulfillment_status: 'not_fulfilled' }
        ]
      }),
      
      // Items with stock below threshold (assuming 10 is low)
      db.collection('inventoryItems').countDocuments({ 
        stocked_quantity: { $lt: 10, $gte: 0 } 
      }),
      
      // Payments with refund status
      db.collection('payments').countDocuments({ 
        status: 'requires_refund' 
      }),
      
      // Today's orders
      db.collection('orders').find({ 
        createdAt: { $gte: today, $lt: tomorrow } 
      }).toArray(),
      
      // New customers today
      db.collection('customers').countDocuments({ 
        createdAt: { $gte: today, $lt: tomorrow } 
      }),
      
      // Active carts (not completed)
      db.collection('carts').find({ 
        completed_at: null 
      }).toArray(),
      
      // Orders awaiting fulfillment
      db.collection('orders').countDocuments({ 
        fulfillment_status: 'awaiting_fulfillment' 
      }),
    ]);
    
    // Calculate today's revenue
    const todaysRevenue = todaysOrders.reduce((sum, order) => {
      return sum + (order.total || 0);
    }, 0) / 100; // Convert from cents
    
    // Calculate active carts total value
    const activeCartsTotal = activeCarts.reduce((sum, cart) => {
      const cartTotal = (cart.items || []).reduce((itemSum: number, item: any) => {
        return itemSum + ((item.unit_price || 0) * (item.quantity || 1));
      }, 0);
      return sum + cartTotal;
    }, 0);
    
    return NextResponse.json({
      ordersToProcess,
      lowStockItems,
      pendingRefunds,
      todaysRevenue,
      todaysOrders: todaysOrders.length,
      newCustomers,
      activeCartsTotal: activeCarts.length,
      awaitingFulfillment,
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch metrics',
      ordersToProcess: 0,
      lowStockItems: 0,
      pendingRefunds: 0,
      todaysRevenue: 0,
      todaysOrders: 0,
      newCustomers: 0,
      activeCartsTotal: 0,
      awaitingFulfillment: 0,
    }, { status: 500 });
  }
}