import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: { collection: string } }
) {
  try {
    const { action, ids } = await request.json();
    const client = await clientPromise;
    const db = client.db('commerce');
    
    // Convert string IDs to ObjectIds
    const objectIds = ids.map((id: string) => new ObjectId(id));
    
    let result;
    
    switch (params.collection) {
      case 'orders':
        result = await handleOrderBulkAction(db, action, objectIds);
        break;
      case 'products':
        result = await handleProductBulkAction(db, action, objectIds);
        break;
      case 'inventory':
        result = await handleInventoryBulkAction(db, action, objectIds);
        break;
      default:
        result = await handleGenericBulkAction(db, params.collection, action, objectIds);
    }
    
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error performing bulk action:', error);
    return NextResponse.json({ error: 'Failed to perform bulk action' }, { status: 500 });
  }
}

async function handleOrderBulkAction(db: any, action: string, ids: ObjectId[]) {
  switch (action) {
    case 'mark_fulfilled':
      const fulfillResult = await db.collection('orders').updateMany(
        { _id: { $in: ids } },
        { 
          $set: { 
            fulfillment_status: 'fulfilled',
            fulfilled_at: new Date(),
            updatedAt: new Date()
          }
        }
      );
      return { modified: fulfillResult.modifiedCount, action: 'marked as fulfilled' };
    
    case 'print_labels':
      // In real app, would generate shipping labels
      const orders = await db.collection('orders').find({ _id: { $in: ids } }).toArray();
      return { 
        message: `Generating labels for ${orders.length} orders`, 
        orders: orders.map((o: any) => ({ id: o._id, display_id: o.display_id }))
      };
    
    case 'send_confirmation':
      // In real app, would send emails
      const emailResult = await db.collection('orders').updateMany(
        { _id: { $in: ids } },
        { 
          $set: { 
            confirmation_sent_at: new Date(),
            updatedAt: new Date()
          }
        }
      );
      return { modified: emailResult.modifiedCount, action: 'confirmation emails queued' };
    
    case 'export':
      // Return data for export
      const exportOrders = await db.collection('orders').find({ _id: { $in: ids } }).toArray();
      return { data: exportOrders, action: 'exported' };
    
    default:
      return { error: 'Unknown action' };
  }
}

async function handleProductBulkAction(db: any, action: string, ids: ObjectId[]) {
  switch (action) {
    case 'publish':
      const publishResult = await db.collection('products').updateMany(
        { _id: { $in: ids } },
        { 
          $set: { 
            status: 'published',
            updatedAt: new Date()
          }
        }
      );
      return { modified: publishResult.modifiedCount, action: 'published' };
    
    case 'unpublish':
      const unpublishResult = await db.collection('products').updateMany(
        { _id: { $in: ids } },
        { 
          $set: { 
            status: 'draft',
            updatedAt: new Date()
          }
        }
      );
      return { modified: unpublishResult.modifiedCount, action: 'unpublished' };
    
    case 'delete':
      const deleteResult = await db.collection('products').deleteMany(
        { _id: { $in: ids } }
      );
      return { deleted: deleteResult.deletedCount, action: 'deleted' };
    
    default:
      return { error: 'Unknown action' };
  }
}

async function handleInventoryBulkAction(db: any, action: string, ids: ObjectId[]) {
  switch (action) {
    case 'mark_low_stock':
      const lowStockResult = await db.collection('inventoryItems').updateMany(
        { _id: { $in: ids } },
        { 
          $set: { 
            low_stock_alert: true,
            updatedAt: new Date()
          }
        }
      );
      return { modified: lowStockResult.modifiedCount, action: 'marked as low stock' };
    
    case 'reset_stock':
      const resetResult = await db.collection('inventoryItems').updateMany(
        { _id: { $in: ids } },
        { 
          $set: { 
            stocked_quantity: 0,
            reserved_quantity: 0,
            updatedAt: new Date()
          }
        }
      );
      return { modified: resetResult.modifiedCount, action: 'stock reset' };
    
    default:
      return { error: 'Unknown action' };
  }
}

async function handleGenericBulkAction(db: any, collection: string, action: string, ids: ObjectId[]) {
  switch (action) {
    case 'delete':
      const deleteResult = await db.collection(collection).deleteMany(
        { _id: { $in: ids } }
      );
      return { deleted: deleteResult.deletedCount, action: 'deleted' };
    
    case 'archive':
      const archiveResult = await db.collection(collection).updateMany(
        { _id: { $in: ids } },
        { 
          $set: { 
            archived: true,
            archived_at: new Date(),
            updatedAt: new Date()
          }
        }
      );
      return { modified: archiveResult.modifiedCount, action: 'archived' };
    
    default:
      return { error: 'Unknown action' };
  }
}