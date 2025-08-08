import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    
    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const client = await clientPromise;
    const db = client.db('commerce');
    
    // Create search regex
    const searchRegex = new RegExp(query, 'i');
    
    // Search across multiple collections in parallel
    const searchPromises = [
      // Search orders
      db.collection('orders').find({
        $or: [
          { display_id: searchRegex },
          { customer_email: searchRegex },
          { customer_name: searchRegex },
          { 'shipping_address.name': searchRegex },
        ]
      }).limit(5).toArray(),
      
      // Search products
      db.collection('products').find({
        $or: [
          { title: searchRegex },
          { handle: searchRegex },
          { description: searchRegex },
          { vendor_handle: searchRegex },
        ]
      }).limit(5).toArray(),
      
      // Search customers
      db.collection('customers').find({
        $or: [
          { email: searchRegex },
          { first_name: searchRegex },
          { last_name: searchRegex },
          { phone: searchRegex },
        ]
      }).limit(5).toArray(),
      
      // Search vendors
      db.collection('vendors').find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ]
      }).limit(3).toArray(),
    ];
    
    const [orders, products, customers, vendors] = await Promise.all(searchPromises);
    
    // Format results
    const results = [
      ...orders.map(doc => ({
        collection: 'orders',
        document: doc,
        matchField: doc.display_id?.match(searchRegex) ? 'Order ID' : 
                    doc.customer_email?.match(searchRegex) ? 'Email' : 'Customer Name'
      })),
      ...products.map(doc => ({
        collection: 'products',
        document: doc,
        matchField: doc.title?.match(searchRegex) ? 'Title' : 
                    doc.handle?.match(searchRegex) ? 'Handle' : 'Description'
      })),
      ...customers.map(doc => ({
        collection: 'customers',
        document: doc,
        matchField: doc.email?.match(searchRegex) ? 'Email' : 
                    doc.first_name?.match(searchRegex) ? 'First Name' : 
                    doc.last_name?.match(searchRegex) ? 'Last Name' : 'Phone'
      })),
      ...vendors.map(doc => ({
        collection: 'vendors',
        document: doc,
        matchField: doc.name?.match(searchRegex) ? 'Name' : 
                    doc.email?.match(searchRegex) ? 'Email' : 'Phone'
      })),
    ];
    
    return NextResponse.json({ 
      results: results.slice(0, 10), // Limit total results
      query 
    });
  } catch (error) {
    console.error('Error searching:', error);
    return NextResponse.json({ error: 'Search failed', results: [] }, { status: 500 });
  }
}