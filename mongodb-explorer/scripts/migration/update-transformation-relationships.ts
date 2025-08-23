import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

interface Relationship {
  type: string; // 'Wife', 'Partner', 'Spouse', 'Guest', etc.
  partnerOf: string; // Full name of the partner (e.g., "John Smith")
  partnerId: string; // attendeeId of the partner
}

async function updateTransformationRelationships() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db('supabase');
  
  console.log('🔄 UPDATING CART FORMDATA WITH RELATIONSHIP ARRAYS');
  console.log('='.repeat(80));
  
  try {
    const cartsCollection = db.collection('carts');
    const productsCollection = db.collection('products');
    
    // Get the bundle product
    const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
    if (!bundleProduct) {
      throw new Error('Bundle product not found');
    }
    
    // Get all carts
    const carts = await cartsCollection.find({}).toArray();
    console.log(`\n📦 Found ${carts.length} carts to update`);
    
    let updatedCount = 0;
    let relationshipsAdded = 0;
    
    for (const cart of carts) {
      let cartModified = false;
      
      // Process each cart item
      for (const item of cart.cartItems) {
        // Only process bundle items (not child bundled products)
        if (item.productId === bundleProduct.productId && !item.parentItemId && item.formData) {
          const formData = item.formData;
          
          // Initialize relationship array if it doesn't exist
          if (!formData.relationship) {
            formData.relationship = [];
          }
          
          // Convert old relationship fields to new array format
          if (formData.isPartner || formData.partnerOf) {
            // Check if this relationship isn't already in the array
            const existingRelationship = formData.relationship.find((rel: Relationship) => 
              rel.partnerOf === formData.partnerOf
            );
            
            if (!existingRelationship && formData.partnerOf) {
              // Determine relationship type
              let relationshipType = 'Partner'; // Default
              
              // Check if we have relationship type info in other fields
              if (typeof formData.relationship === 'string') {
                relationshipType = formData.relationship;
                formData.relationship = []; // Reset to array
              } else if (formData.relationshipType) {
                relationshipType = formData.relationshipType;
              }
              
              // Find the partner's attendeeId if possible
              let partnerId = formData.partnerId || '';
              
              // If we don't have partnerId, try to find it in the same cart
              if (!partnerId && formData.partnerOf) {
                // Look for another bundle item with matching name
                const partnerItem = cart.cartItems.find((otherItem: any) => {
                  if (otherItem.cartItemId === item.cartItemId) return false;
                  if (!otherItem.formData) return false;
                  
                  const fullName = `${otherItem.formData.firstName} ${otherItem.formData.lastName}`.trim();
                  return fullName === formData.partnerOf;
                });
                
                if (partnerItem && partnerItem.formData) {
                  partnerId = partnerItem.formData.attendeeId || partnerItem.cartItemId;
                }
              }
              
              // Add to relationship array
              formData.relationship.push({
                type: relationshipType,
                partnerOf: formData.partnerOf,
                partnerId: partnerId || ''
              });
              
              relationshipsAdded++;
              cartModified = true;
              
              // Clean up old fields
              delete formData.isPartner;
              delete formData.partnerOf;
              delete formData.partnerId;
              delete formData.relationshipType;
              delete formData.partner;
            }
          }
          
          // For lodge registrations, check attendees array
          if (formData.attendees && Array.isArray(formData.attendees)) {
            for (const attendee of formData.attendees) {
              if (!attendee.relationship) {
                attendee.relationship = [];
              }
              
              if (attendee.isPartner || attendee.partnerOf) {
                const existingRel = attendee.relationship.find((rel: Relationship) => 
                  rel.partnerOf === attendee.partnerOf
                );
                
                if (!existingRel && attendee.partnerOf) {
                  let relType = 'Partner';
                  if (typeof attendee.relationship === 'string') {
                    relType = attendee.relationship;
                    attendee.relationship = [];
                  } else if (attendee.relationshipType) {
                    relType = attendee.relationshipType;
                  }
                  
                  // Find partner in same attendees array
                  let partnerId = attendee.partnerId || '';
                  if (!partnerId) {
                    const partner = formData.attendees.find((other: any) => {
                      const fullName = `${other.firstName} ${other.lastName}`.trim();
                      return fullName === attendee.partnerOf;
                    });
                    if (partner) {
                      partnerId = partner.attendeeId || '';
                    }
                  }
                  
                  attendee.relationship.push({
                    type: relType,
                    partnerOf: attendee.partnerOf,
                    partnerId: partnerId
                  });
                  
                  relationshipsAdded++;
                  cartModified = true;
                  
                  // Clean up
                  delete attendee.isPartner;
                  delete attendee.partnerOf;
                  delete attendee.partnerId;
                  delete attendee.relationshipType;
                  delete attendee.partner;
                }
              }
            }
          }
        }
      }
      
      // Update cart if modified
      if (cartModified) {
        await cartsCollection.updateOne(
          { _id: cart._id },
          { 
            $set: { 
              cartItems: cart.cartItems,
              updatedAt: new Date()
            }
          }
        );
        updatedCount++;
      }
    }
    
    console.log(`\n✅ Updated ${updatedCount} carts`);
    console.log(`✅ Added ${relationshipsAdded} relationships to arrays`);
    
    // Show sample of updated relationships
    console.log('\n' + '='.repeat(80));
    console.log('📊 SAMPLE UPDATED RELATIONSHIPS');
    console.log('-'.repeat(40));
    
    const sampleCart = await cartsCollection.findOne({
      'cartItems.formData.relationship.0': { $exists: true }
    });
    
    if (sampleCart) {
      console.log(`\nCart ID: ${sampleCart.cartId}`);
      
      for (const item of sampleCart.cartItems) {
        if (item.formData?.relationship && Array.isArray(item.formData.relationship) && 
            item.formData.relationship.length > 0) {
          console.log(`\n  Attendee: ${item.formData.firstName} ${item.formData.lastName}`);
          console.log(`  Relationships:`);
          for (const rel of item.formData.relationship) {
            console.log(`    - ${rel.type} of ${rel.partnerOf}`);
            if (rel.partnerId) {
              console.log(`      Partner ID: ${rel.partnerId}`);
            }
          }
        }
      }
    }
    
    // Also update orders collection
    console.log('\n' + '='.repeat(80));
    console.log('🔄 UPDATING ORDERS WITH RELATIONSHIP ARRAYS');
    console.log('-'.repeat(40));
    
    const ordersCollection = db.collection('orders');
    const orders = await ordersCollection.find({}).toArray();
    
    let ordersUpdated = 0;
    for (const order of orders) {
      let orderModified = false;
      
      // Update metadata in order items
      for (const item of order.orderItems) {
        if (item.metadata?.attendeeInfo) {
          const attendeeInfo = item.metadata.attendeeInfo;
          
          if (!attendeeInfo.relationship) {
            attendeeInfo.relationship = [];
          }
          
          if (attendeeInfo.isPartner || attendeeInfo.partnerOf) {
            const existingRel = attendeeInfo.relationship.find((rel: Relationship) => 
              rel.partnerOf === attendeeInfo.partnerOf
            );
            
            if (!existingRel && attendeeInfo.partnerOf) {
              attendeeInfo.relationship.push({
                type: attendeeInfo.relationshipType || 'Partner',
                partnerOf: attendeeInfo.partnerOf,
                partnerId: attendeeInfo.partnerId || ''
              });
              
              orderModified = true;
              
              delete attendeeInfo.isPartner;
              delete attendeeInfo.partnerOf;
              delete attendeeInfo.partnerId;
              delete attendeeInfo.relationshipType;
            }
          }
        }
      }
      
      if (orderModified) {
        await ordersCollection.updateOne(
          { _id: order._id },
          { 
            $set: { 
              orderItems: order.orderItems,
              updatedAt: new Date()
            }
          }
        );
        ordersUpdated++;
      }
    }
    
    console.log(`\n✅ Updated ${ordersUpdated} orders`);
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('💡 RELATIONSHIP ARRAY STRUCTURE');
    console.log('-'.repeat(40));
    console.log('\n✅ Relationships now stored as arrays');
    console.log('✅ Each relationship has: type, partnerOf (name), partnerId');
    console.log('✅ Supports multiple relationships per attendee');
    console.log('✅ Old fields (isPartner, partnerOf) cleaned up');
    console.log('✅ Partner IDs linked where possible');
    
  } catch (error) {
    console.error('❌ Error updating relationships:', error);
  } finally {
    await client.close();
  }
}

// Run the script
updateTransformationRelationships()
  .then(() => {
    console.log('\n✅ Relationship arrays updated successfully!');
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
  });