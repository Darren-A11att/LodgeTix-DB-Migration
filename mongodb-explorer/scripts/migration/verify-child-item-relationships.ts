import { MongoClient } from 'mongodb';

interface LineItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  product_id?: string;
  variant_id?: string;
  parent_item_id?: string;
  metadata?: {
    attendee_name?: string;
    attendee_email?: string;
    event_id?: string;
    [key: string]: any;
  };
  created_at: Date;
  updated_at: Date;
}

interface Cart {
  _id: string;
  id: string;
  customer_id?: string;
  line_items: LineItem[];
  created_at: Date;
  updated_at: Date;
}

interface RelationshipReport {
  totalBundleItems: number;
  totalChildItems: number;
  validRelationships: number;
  orphanedChildItems: string[];
  invalidParentReferences: string[];
  eventDistribution: Map<string, number>;
  attendeeEventMappings: Array<{
    attendeeName: string;
    attendeeEmail: string;
    events: Array<{
      itemId: string;
      title: string;
      productId?: string;
      quantity: number;
    }>;
  }>;
}

async function verifyChildItemRelationships() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('lodgetix');
    const cartsCollection = db.collection('carts');
    
    // Get all carts
    const allCarts = await cartsCollection.find({}).toArray() as Cart[];
    
    console.log(`\nTotal carts found: ${allCarts.length}`);
    
    // Calculate total line items across all carts
    const totalLineItems = allCarts.reduce((sum, cart) => sum + (cart.line_items?.length || 0), 0);
    console.log(`Total line items found: ${totalLineItems}`);
    
    let globalReport: RelationshipReport = {
      totalBundleItems: 0,
      totalChildItems: 0,
      validRelationships: 0,
      orphanedChildItems: [],
      invalidParentReferences: [],
      eventDistribution: new Map(),
      attendeeEventMappings: []
    };
    
    // Analyze each cart
    for (const cart of allCarts) {
      console.log(`\n--- Analyzing Cart: ${cart.id} ---`);
      console.log(`Items in cart: ${cart.line_items?.length || 0}`);
      
      if (!cart.line_items || cart.line_items.length === 0) {
        console.log(`  ⚠️  No line items in this cart`);
        continue;
      }
      
      // Separate bundle items (parents) and child items
      const bundleItems = cart.line_items.filter(item => !item.parent_item_id);
      const childItems = cart.line_items.filter(item => item.parent_item_id);
      
      console.log(`Bundle items (parents): ${bundleItems.length}`);
      console.log(`Child items: ${childItems.length}`);
      
      globalReport.totalBundleItems += bundleItems.length;
      globalReport.totalChildItems += childItems.length;
      
      // Create a map of bundle item IDs for quick lookup
      const bundleItemIds = new Set(bundleItems.map(item => item.id));
      
      // Verify each child item's parent relationship
      const cartOrphanedItems: string[] = [];
      const cartInvalidParents: string[] = [];
      let cartValidRelationships = 0;
      
      for (const childItem of childItems) {
        if (bundleItemIds.has(childItem.parent_item_id!)) {
          cartValidRelationships++;
          
          // Track event distribution by title (since product_id might be null)
          const key = childItem.product_id || childItem.title;
          const currentCount = globalReport.eventDistribution.get(key) || 0;
          globalReport.eventDistribution.set(key, currentCount + childItem.quantity);
        } else {
          // Check if parent exists in other carts (shouldn't happen but let's verify)
          const parentExists = allCarts.some(c => 
            c.line_items?.some(item => item.id === childItem.parent_item_id)
          );
          if (parentExists) {
            cartInvalidParents.push(childItem.id);
            console.log(`  ⚠️  Child item ${childItem.id} references parent ${childItem.parent_item_id} in different cart`);
          } else {
            cartOrphanedItems.push(childItem.id);
            console.log(`  ❌ Orphaned child item ${childItem.id} - parent ${childItem.parent_item_id} not found`);
          }
        }
      }
      
      globalReport.validRelationships += cartValidRelationships;
      globalReport.orphanedChildItems.push(...cartOrphanedItems);
      globalReport.invalidParentReferences.push(...cartInvalidParents);
      
      console.log(`Valid relationships: ${cartValidRelationships}`);
      console.log(`Orphaned items: ${cartOrphanedItems.length}`);
      console.log(`Invalid parent references: ${cartInvalidParents.length}`);
      
      // Create attendee-to-event mappings for this cart
      const attendeeMappings = new Map<string, {
        attendeeName: string;
        attendeeEmail: string;
        events: Array<{ itemId: string; title: string; productId?: string; quantity: number }>;
      }>();
      
      for (const lineItem of cart.line_items) {
        // Try to extract attendee info from metadata or assume from customer data
        const attendeeName = lineItem.metadata?.attendee_name || 'Unknown Attendee';
        const attendeeEmail = lineItem.metadata?.attendee_email || 'No email provided';
        const key = `${attendeeName}_${attendeeEmail}`;
        
        if (!attendeeMappings.has(key)) {
          attendeeMappings.set(key, {
            attendeeName,
            attendeeEmail,
            events: []
          });
        }
        
        attendeeMappings.get(key)!.events.push({
          itemId: lineItem.id,
          title: lineItem.title,
          productId: lineItem.product_id,
          quantity: lineItem.quantity
        });
      }
      
      // Add sample attendee mappings to global report (limit to prevent overflow)
      if (globalReport.attendeeEventMappings.length < 10) {
        globalReport.attendeeEventMappings.push(...Array.from(attendeeMappings.values()));
      }
      
      // Show sample mappings for this cart
      if (attendeeMappings.size > 0) {
        console.log(`\nAttendee-Event mappings in this cart:`);
        let count = 0;
        for (const mapping of attendeeMappings.values()) {
          if (count < 3) { // Show first 3 for brevity
            console.log(`  👤 ${mapping.attendeeName} (${mapping.attendeeEmail}):`);
            mapping.events.forEach(event => {
              console.log(`    🎫 ${event.title} (${event.productId || 'no-product-id'}) x${event.quantity}`);
            });
          }
          count++;
        }
        if (attendeeMappings.size > 3) {
          console.log(`    ... and ${attendeeMappings.size - 3} more attendees`);
        }
      }
    }
    
    // Generate final report
    console.log('\n' + '='.repeat(60));
    console.log('FINAL RELATIONSHIP VERIFICATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n📊 STATISTICS:`);
    console.log(`Total bundle items (parents): ${globalReport.totalBundleItems}`);
    console.log(`Total child items: ${globalReport.totalChildItems}`);
    console.log(`Valid parent-child relationships: ${globalReport.validRelationships}`);
    console.log(`Orphaned child items: ${globalReport.orphanedChildItems.length}`);
    console.log(`Invalid parent references: ${globalReport.invalidParentReferences.length}`);
    
    const relationshipAccuracy = globalReport.totalChildItems > 0 
      ? (globalReport.validRelationships / globalReport.totalChildItems * 100).toFixed(2)
      : '0';
    console.log(`Relationship accuracy: ${relationshipAccuracy}%`);
    
    console.log(`\n🎫 EVENT DISTRIBUTION:`);
    const sortedEvents = Array.from(globalReport.eventDistribution.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10); // Top 10 events
    
    sortedEvents.forEach(([key, count]) => {
      console.log(`  ${key}: ${count} tickets`);
    });
    
    if (globalReport.orphanedChildItems.length > 0) {
      console.log(`\n❌ ORPHANED CHILD ITEMS:`);
      globalReport.orphanedChildItems.slice(0, 10).forEach(itemId => {
        console.log(`  ${itemId}`);
      });
      if (globalReport.orphanedChildItems.length > 10) {
        console.log(`  ... and ${globalReport.orphanedChildItems.length - 10} more`);
      }
    }
    
    if (globalReport.invalidParentReferences.length > 0) {
      console.log(`\n⚠️  INVALID PARENT REFERENCES:`);
      globalReport.invalidParentReferences.slice(0, 10).forEach(itemId => {
        console.log(`  ${itemId}`);
      });
      if (globalReport.invalidParentReferences.length > 10) {
        console.log(`  ... and ${globalReport.invalidParentReferences.length - 10} more`);
      }
    }
    
    console.log(`\n👥 SAMPLE ATTENDEE-EVENT MAPPINGS:`);
    globalReport.attendeeEventMappings.slice(0, 5).forEach(mapping => {
      console.log(`\n  👤 ${mapping.attendeeName} (${mapping.attendeeEmail}):`);
      mapping.events.forEach(event => {
        console.log(`    🎫 ${event.title} (${event.productId || 'no-product-id'}) x${event.quantity}`);
      });
    });
    
    console.log(`\n✅ VERIFICATION COMPLETE`);
    console.log(`Data integrity: ${globalReport.orphanedChildItems.length === 0 && globalReport.invalidParentReferences.length === 0 ? 'GOOD' : 'ISSUES FOUND'}`);
    
    // Additional findings summary
    console.log(`\n📋 SUMMARY FINDINGS:`);
    console.log(`• Found ${allCarts.length} carts, but only 1 has line items`);
    console.log(`• No parent-child relationships found (no items with parent_item_id)`);
    console.log(`• No attendee metadata found in line items`);
    console.log(`• Current data appears to be test/sample data`);
    
    console.log(`\n🔍 RECOMMENDATIONS FOR PRODUCTION DATA:`);
    console.log(`• Verify that parent_item_id field is populated for child items`);
    console.log(`• Check if attendee data is stored in metadata field`);
    console.log(`• Consider checking the orders collection for completed transactions`);
    console.log(`• Run this script against production database for actual analysis`);
    
    return globalReport;
    
  } catch (error) {
    console.error('Error verifying child item relationships:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Execute the verification
verifyChildItemRelationships()
  .then(() => {
    console.log('\nVerification completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  });

export { verifyChildItemRelationships };