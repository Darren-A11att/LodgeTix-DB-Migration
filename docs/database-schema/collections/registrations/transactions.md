# Registration Processing - ACID Transactions

## Overview
This document outlines the ACID transaction flows for processing registrations, creating tickets, and updating inventory in a way that prevents overselling and maintains data consistency.

## Key Principles
1. **Atomicity**: All operations succeed or all fail together
2. **Consistency**: Inventory counts remain accurate
3. **Isolation**: Concurrent registrations don't interfere
4. **Durability**: Completed transactions persist

## 1. Individual Registration Transaction

```javascript
async function processIndividualRegistration(registrationData) {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Step 1: Create registration document
      const registration = await db.registrations.insertOne({
        registrationNumber: generateRegistrationNumber(),
        type: 'individual',
        functionId: registrationData.functionId,
        registrant: {
          type: 'contact',
          contactId: registrationData.contactId,
          name: registrationData.contactName,
          email: registrationData.email,
          phone: registrationData.phone
        },
        purchase: {
          items: registrationData.items.map(item => ({
            lineItemId: new ObjectId(),
            productId: item.productId,
            productType: item.productType,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.quantity * item.unitPrice,
            ticketIds: [] // Will be populated after ticket creation
          }))
        },
        attendees: registrationData.attendees,
        status: 'pending',
        metadata: {
          createdAt: new Date(),
          createdBy: registrationData.userId
        }
      }, { session });
      
      // Step 2: Process each line item
      for (const lineItem of registration.purchase.items) {
        if (lineItem.productType === 'ticket') {
          // Step 3: Atomically update product inventory
          const product = await db.products.findOneAndUpdate(
            {
              productId: lineItem.productId,
              'inventory.availableCount': { $gte: lineItem.quantity },
              status: 'active'
            },
            {
              $inc: {
                'inventory.soldCount': lineItem.quantity,
                'inventory.availableCount': -lineItem.quantity,
                'inventory.version': 1
              },
              $set: {
                'inventory.lastUpdated': new Date()
              }
            },
            { 
              session,
              returnDocument: 'after',
              projection: { functionId: 1, eventId: 1, name: 1, category: 1 }
            }
          );
          
          if (!product) {
            throw new Error(`Insufficient inventory for product ${lineItem.productName}`);
          }
          
          // Step 4: Create ticket documents
          const ticketIds = [];
          for (let i = 0; i < lineItem.quantity; i++) {
            const ticket = await db.tickets.insertOne({
              ticketNumber: generateTicketNumber(product.functionId, product.eventId),
              
              // Product information
              product: {
                functionId: product.functionId,
                eventId: product.eventId,
                eventName: product.eventName,
                productId: lineItem.productId,
                productName: lineItem.productName,
                productCategory: product.category,
                price: lineItem.unitPrice
              },
              
              // Purchase information
              purchase: {
                registrationId: registration._id,
                registrationNumber: registration.registrationNumber,
                purchasedBy: registration.registrant,
                purchaseDate: new Date(),
                paymentStatus: 'pending',
                lineItemId: lineItem.lineItemId,
                pricePaid: lineItem.unitPrice
              },
              
              // Ownership - assigned to attendee for individual registration
              owner: {
                attendeeId: registrationData.attendees[0]._id
              },
              
              // Access control
              access: {
                zones: product.accessZones || ['general'],
                validFrom: product.sessionInfo?.startTime,
                validUntil: product.sessionInfo?.endTime,
                status: 'valid'
              },
              
              // Security
              security: {
                barcode: generateSecureBarcode(),
                qrData: generateSecureQRData(),
                securityCode: generateSecurityCode()
              },
              
              status: 'active',
              
              metadata: {
                createdAt: new Date(),
                createdBy: registrationData.userId,
                version: 1
              }
            }, { session });
            
            ticketIds.push(ticket._id);
          }
          
          // Step 5: Update registration with ticket IDs
          await db.registrations.updateOne(
            { 
              _id: registration._id,
              'purchase.items.lineItemId': lineItem.lineItemId
            },
            { 
              $set: { 
                'purchase.items.$.ticketIds': ticketIds 
              }
            },
            { session }
          );
        }
      }
      
      // Step 6: Create financial transaction
      const transaction = await db.financialTransactions.insertOne({
        transactionId: generateTransactionId(),
        type: 'payment',
        category: 'registration',
        method: registrationData.paymentMethod,
        
        reference: {
          type: 'registration',
          id: registration._id,
          number: registration.registrationNumber,
          functionId: registrationData.functionId
        },
        
        parties: {
          customer: {
            type: 'contact',
            id: registrationData.contactId,
            name: registrationData.contactName,
            email: registrationData.email
          }
        },
        
        amount: {
          currency: 'AUD',
          subtotal: registration.totals.subtotal,
          tax: registration.totals.tax,
          total: registration.totals.grandTotal
        },
        
        status: 'pending',
        
        metadata: {
          createdAt: new Date(),
          source: 'online_registration'
        }
      }, { session });
      
      // Step 7: Update registration status
      await db.registrations.updateOne(
        { _id: registration._id },
        { 
          $set: { 
            status: 'confirmed',
            'financial.transactionId': transaction._id,
            'metadata.updatedAt': new Date()
          }
        },
        { session }
      );
      
      return { registration, transaction };
    });
    
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  } finally {
    await session.endSession();
  }
}
```

## 2. Lodge Registration Transaction

```javascript
async function processLodgeRegistration(lodgeData) {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Step 1: Create lodge registration
      const registration = await db.registrations.insertOne({
        registrationNumber: generateRegistrationNumber(),
        type: 'lodge',
        functionId: lodgeData.functionId,
        
        registrant: {
          type: 'organisation',
          organisationId: lodgeData.organisationId,
          name: lodgeData.lodgeName,
          lodgeNumber: lodgeData.lodgeNumber,
          contactName: lodgeData.bookingContact.name,
          email: lodgeData.bookingContact.email,
          phone: lodgeData.bookingContact.phone
        },
        
        purchase: {
          items: lodgeData.items
        },
        
        // Lodge registrations start with no attendees assigned
        attendees: [],
        attendeeAllocation: {
          total: lodgeData.totalTickets,
          assigned: 0,
          unassigned: lodgeData.totalTickets
        },
        
        status: 'pending',
        metadata: {
          createdAt: new Date(),
          createdBy: lodgeData.userId
        }
      }, { session });
      
      // Step 2-5: Process tickets (similar to individual)
      // Key difference: tickets have owner.attendeeId = null
      for (const lineItem of registration.purchase.items) {
        if (lineItem.productType === 'ticket') {
          // Update inventory (same as individual)
          const product = await db.products.findOneAndUpdate(
            {
              productId: lineItem.productId,
              'inventory.availableCount': { $gte: lineItem.quantity },
              status: 'active'
            },
            {
              $inc: {
                'inventory.soldCount': lineItem.quantity,
                'inventory.availableCount': -lineItem.quantity,
                'inventory.version': 1
              }
            },
            { session, returnDocument: 'after' }
          );
          
          if (!product) {
            throw new Error(`Insufficient inventory for ${lineItem.productName}`);
          }
          
          // Create tickets owned by registration
          const ticketIds = [];
          for (let i = 0; i < lineItem.quantity; i++) {
            const ticket = await db.tickets.insertOne({
              ticketNumber: generateTicketNumber(product.functionId, product.eventId),
              
              product: {
                functionId: product.functionId,
                eventId: product.eventId,
                productId: lineItem.productId,
                productName: lineItem.productName,
                productCategory: product.category,
                price: lineItem.unitPrice
              },
              
              purchase: {
                registrationId: registration._id,
                registrationNumber: registration.registrationNumber,
                purchasedBy: registration.registrant,
                purchaseDate: new Date(),
                paymentStatus: 'pending',
                lineItemId: lineItem.lineItemId,
                pricePaid: lineItem.unitPrice
              },
              
              // Key difference: no attendee assigned yet
              owner: {
                attendeeId: null  // Registration owns the ticket
              },
              
              // No transfer history yet
              transferHistory: [],
              
              access: {
                zones: product.accessZones || ['general'],
                validFrom: product.sessionInfo?.startTime,
                validUntil: product.sessionInfo?.endTime,
                status: 'valid'
              },
              
              security: {
                barcode: generateSecureBarcode(),
                qrData: generateSecureQRData(),
                securityCode: generateSecurityCode()
              },
              
              status: 'active',
              
              metadata: {
                createdAt: new Date(),
                createdBy: lodgeData.userId,
                version: 1
              }
            }, { session });
            
            ticketIds.push(ticket._id);
          }
          
          // Update registration with ticket IDs
          await db.registrations.updateOne(
            { 
              _id: registration._id,
              'purchase.items.lineItemId': lineItem.lineItemId
            },
            { 
              $set: { 
                'purchase.items.$.ticketIds': ticketIds 
              }
            },
            { session }
          );
        }
      }
      
      // Create financial transaction and confirm (same as individual)
      // ...
      
      return { registration };
    });
    
  } finally {
    await session.endSession();
  }
}
```

## 3. Lodge Ticket Assignment Transaction

```javascript
async function assignLodgeTicket(assignmentData) {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Step 1: Verify ticket is unassigned and owned by registration
      const ticket = await db.tickets.findOne({
        _id: assignmentData.ticketId,
        'owner.attendeeId': null,
        status: 'active'
      }, { session });
      
      if (!ticket) {
        throw new Error('Ticket not found or already assigned');
      }
      
      // Step 2: Verify user has permission (owns the registration)
      const registration = await db.registrations.findOne({
        _id: ticket.purchase.registrationId,
        'registrant.email': assignmentData.userEmail
      }, { session });
      
      if (!registration) {
        throw new Error('Unauthorized: You do not own this registration');
      }
      
      // Step 3: Create or verify attendee
      let attendee = await db.attendees.findOne({
        _id: assignmentData.attendeeId
      }, { session });
      
      if (!attendee) {
        // Create new attendee if needed
        attendee = await db.attendees.insertOne({
          attendeeNumber: generateAttendeeNumber(),
          profile: assignmentData.attendeeProfile,
          registration: {
            registrationId: registration._id,
            functionId: registration.functionId
          },
          status: 'active',
          metadata: {
            createdAt: new Date(),
            createdBy: assignmentData.userId
          }
        }, { session });
      }
      
      // Step 4: Update ticket ownership
      await db.tickets.updateOne(
        { _id: ticket._id },
        {
          $set: {
            'owner.attendeeId': attendee._id,
            'metadata.updatedAt': new Date(),
            'metadata.updatedBy': assignmentData.userId
          },
          $push: {
            transferHistory: {
              transferId: new ObjectId(),
              type: 'assignment',
              from: {
                type: 'registration',
                name: registration.registrant.name
              },
              to: {
                type: 'attendee',
                attendeeId: attendee._id,
                name: `${attendee.profile.firstName} ${attendee.profile.lastName}`
              },
              transferDate: new Date(),
              transferredBy: assignmentData.userId,
              reason: 'initial_assignment',
              notes: assignmentData.notes
            }
          },
          $inc: {
            'metadata.version': 1
          }
        },
        { session }
      );
      
      // Step 5: Update registration attendee allocation
      await db.registrations.updateOne(
        { _id: registration._id },
        {
          $inc: {
            'attendeeAllocation.assigned': 1,
            'attendeeAllocation.unassigned': -1
          },
          $addToSet: {
            attendees: attendee._id
          },
          $set: {
            'metadata.updatedAt': new Date()
          }
        },
        { session }
      );
      
      // Step 6: Send notification email
      // This would be queued for processing outside the transaction
      
      return { ticket, attendee };
    });
    
  } finally {
    await session.endSession();
  }
}
```

## 4. Bulk Lodge Ticket Assignment

```javascript
async function bulkAssignLodgeTickets(bulkData) {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const results = [];
      
      // Verify all tickets belong to same registration
      const ticketIds = bulkData.assignments.map(a => a.ticketId);
      const tickets = await db.tickets.find({
        _id: { $in: ticketIds },
        'owner.attendeeId': null
      }).toArray();
      
      if (tickets.length !== ticketIds.length) {
        throw new Error('Some tickets are already assigned or not found');
      }
      
      const registrationId = tickets[0].purchase.registrationId;
      if (!tickets.every(t => t.purchase.registrationId.equals(registrationId))) {
        throw new Error('All tickets must belong to the same registration');
      }
      
      // Process each assignment
      for (const assignment of bulkData.assignments) {
        // Similar to single assignment but batched
        // ... assignment logic ...
        results.push({ ticketId: assignment.ticketId, status: 'assigned' });
      }
      
      // Update registration allocation counts in one operation
      await db.registrations.updateOne(
        { _id: registrationId },
        {
          $inc: {
            'attendeeAllocation.assigned': results.length,
            'attendeeAllocation.unassigned': -results.length
          }
        },
        { session }
      );
      
      return results;
    });
    
  } finally {
    await session.endSession();
  }
}
```

## 5. Inventory Reservation for Cart

```javascript
async function reserveInventoryForCart(cartData) {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const reservations = [];
      
      for (const item of cartData.items) {
        // Reserve inventory
        const product = await db.products.findOneAndUpdate(
          {
            productId: item.productId,
            'inventory.availableCount': { $gte: item.quantity },
            status: 'active'
          },
          {
            $inc: {
              'inventory.reservedCount': item.quantity,
              'inventory.availableCount': -item.quantity,
              'inventory.version': 1
            },
            $set: {
              'inventory.lastUpdated': new Date()
            }
          },
          { session, returnDocument: 'after' }
        );
        
        if (!product) {
          throw new Error(`Product ${item.productId} not available`);
        }
        
        reservations.push({
          productId: item.productId,
          quantity: item.quantity,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
        });
      }
      
      // Create cart reservation document
      const cart = await db.carts.insertOne({
        sessionId: cartData.sessionId,
        userId: cartData.userId,
        reservations: reservations,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        status: 'active'
      }, { session });
      
      return cart;
    });
    
  } finally {
    await session.endSession();
  }
}
```

## Error Handling and Rollback

```javascript
// Wrapper function with comprehensive error handling
async function safeProcessRegistration(registrationData) {
  try {
    const result = await processIndividualRegistration(registrationData);
    
    // Log success
    await logTransaction({
      type: 'registration_success',
      registrationId: result.registration._id,
      timestamp: new Date()
    });
    
    return result;
    
  } catch (error) {
    // Log failure
    await logTransaction({
      type: 'registration_failed',
      error: error.message,
      data: registrationData,
      timestamp: new Date()
    });
    
    // Specific error handling
    if (error.message.includes('Insufficient inventory')) {
      throw new Error('Some items are no longer available. Please update your cart.');
    }
    
    if (error.code === 11000) {
      throw new Error('Duplicate registration detected.');
    }
    
    throw error;
  }
}
```

## Monitoring and Alerts

```javascript
// Monitor for stuck reservations
async function cleanupExpiredReservations() {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Find expired cart reservations
      const expiredCarts = await db.carts.find({
        status: 'active',
        expiresAt: { $lt: new Date() }
      }).toArray();
      
      for (const cart of expiredCarts) {
        // Release reserved inventory
        for (const reservation of cart.reservations) {
          await db.products.updateOne(
            { productId: reservation.productId },
            {
              $inc: {
                'inventory.reservedCount': -reservation.quantity,
                'inventory.availableCount': reservation.quantity,
                'inventory.version': 1
              }
            },
            { session }
          );
        }
        
        // Mark cart as expired
        await db.carts.updateOne(
          { _id: cart._id },
          { $set: { status: 'expired' } },
          { session }
        );
      }
    });
    
  } finally {
    await session.endSession();
  }
}

// Run every 5 minutes
setInterval(cleanupExpiredReservations, 5 * 60 * 1000);
```

## Best Practices

1. **Always use sessions** for multi-document operations
2. **Check inventory before creating tickets** to prevent overselling
3. **Use optimistic locking** (version field) for high-contention updates
4. **Set appropriate timeouts** for long-running transactions
5. **Log all transaction attempts** for audit and debugging
6. **Monitor transaction metrics** for performance optimization
7. **Implement retry logic** for transient failures
8. **Use read concern "majority"** for critical reads
9. **Set write concern "majority"** for durability
10. **Test concurrent scenarios** thoroughly