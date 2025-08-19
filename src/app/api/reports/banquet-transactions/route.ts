import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    
    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'json'; // json or csv
    
    // Build the match query
    const matchQuery: any = {
      item_description: { $regex: /banquet/i }
    };
    
    // Add date filtering if provided
    if (startDate || endDate) {
      matchQuery.invoiceDate = {};
      if (startDate) {
        matchQuery.invoiceDate.$gte = new Date(startDate);
      }
      if (endDate) {
        matchQuery.invoiceDate.$lte = new Date(endDate);
      }
    }
    
    // Get total count
    const totalCount = await db.collection('transactions').countDocuments(matchQuery);
    
    // Get detailed transactions
    const transactions = await db.collection('transactions')
      .find(matchQuery)
      .sort({ invoiceDate: -1 })
      .toArray();
    
    // Calculate statistics
    const stats = transactions.reduce((acc: any, transaction) => {
      const price = transaction.item_price || 0;
      acc.totalRevenue += price;
      acc.totalQuantity += transaction.item_quantity || 0;
      
      // Group by description
      const desc = transaction.item_description || 'Unknown';
      if (!acc.byDescription[desc]) {
        acc.byDescription[desc] = {
          count: 0,
          revenue: 0,
          quantity: 0
        };
      }
      acc.byDescription[desc].count++;
      acc.byDescription[desc].revenue += price;
      acc.byDescription[desc].quantity += transaction.item_quantity || 0;
      
      // Group by month
      const date = new Date(transaction.invoiceDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!acc.byMonth[monthKey]) {
        acc.byMonth[monthKey] = {
          count: 0,
          revenue: 0
        };
      }
      acc.byMonth[monthKey].count++;
      acc.byMonth[monthKey].revenue += price;
      
      return acc;
    }, {
      totalRevenue: 0,
      totalQuantity: 0,
      byDescription: {},
      byMonth: {}
    });
    
    // Format response based on requested format
    if (format === 'csv') {
      // Generate CSV
      const csv = [
        'Transaction ID,Invoice Number,Invoice Date,Description,Quantity,Price,Customer Name,Customer Email',
        ...transactions.map(t => 
          `${t._id},"${t.invoiceNumber}",${new Date(t.invoiceDate).toISOString().split('T')[0]},"${t.item_description}",${t.item_quantity},${t.item_price},"${t.billTo_firstName || ''} ${t.billTo_lastName || ''}","${t.billTo_email || ''}"`
        )
      ].join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="banquet-transactions-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }
    
    // Return JSON response
    return NextResponse.json({
      summary: {
        totalTransactions: totalCount,
        totalRevenue: stats.totalRevenue,
        totalQuantity: stats.totalQuantity,
        averagePrice: totalCount > 0 ? stats.totalRevenue / totalCount : 0
      },
      breakdownByDescription: stats.byDescription,
      breakdownByMonth: stats.byMonth,
      transactions: transactions.map(t => ({
        id: t._id,
        invoiceNumber: t.invoiceNumber,
        invoiceDate: t.invoiceDate,
        description: t.item_description,
        quantity: t.item_quantity,
        price: t.item_price,
        customerName: `${t.billTo_firstName || ''} ${t.billTo_lastName || ''}`.trim(),
        customerEmail: t.billTo_email
      }))
    });
    
  } catch (error) {
    console.error('Error generating banquet report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}