import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

interface Attendee {
  attendeeId: string;
  firstName: string;
  lastName: string;
  title?: string;
  suffix?: string;
  email?: string;
  phone?: string;
  lodgeName?: string;
  lodgeNumber?: string;
  rank?: string;
  grandLodge?: string;
  postNominals?: string;
  dietaryRequirements?: string;
  specialNeeds?: string;
  accessibility?: string;
  relationship?: Array<{
    type: string;
    firstName: string;
    lastName: string;
    attendeeId?: string;
  }>;
}

interface Registration {
  registrationId: string;
  eventId: string;
  bookingContact?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  attendees: Attendee[];
}

interface CartItem {
  cartItemId: string;
  productId: string;
  formData?: any;
  metadata?: {
    registrationId?: string;
    registrationType?: string;
    attendeeId?: string;
  };
}

interface Cart {
  _id: any;
  cartId: string;
  cartItems: CartItem[];
}

async function fixIndividualCartFormData() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('supabase');  // Use supabase database where carts are located
    const cartsCollection = db.collection('carts');
    const registrationsCollection = db.collection('registrations');
    const oldAttendeesCollection = db.collection('old_attendees');
    
    // Find all carts with individual registration items
    const individualCarts = await cartsCollection.find({
      'cartItems.metadata.registrationType': 'individual',
      'cartItems.formData': { $exists: true }
    }).toArray();
    
    console.log(`Found ${individualCarts.length} individual carts to process`);
    
    let cartsFixed = 0;
    let cartsSkipped = 0;
    const fixedExamples: any[] = [];
    const errors: string[] = [];
    
    for (const cart of individualCarts as Cart[]) {
      try {
        console.log(`Processing cart ${cart.cartId}`);
        
        let cartUpdated = false;
        const updatedCartItems = [...cart.cartItems];
        
        for (let i = 0; i < updatedCartItems.length; i++) {
          const cartItem = updatedCartItems[i];
          
          // Skip if not individual registration item or no formData
          if (cartItem.metadata?.registrationType !== 'individual' || !cartItem.formData) {
            continue;
          }
          
          const attendeeId = cartItem.formData.attendeeId || cartItem.metadata?.attendeeId;
          if (!attendeeId) {
            console.log(`Cart item ${cartItem.cartItemId} has no attendeeId`);
            continue;
          }
          
          // Get registration ID from cart item metadata
          const registrationId = cartItem.metadata?.registrationId;
          if (!registrationId) {
            console.log(`Cart item ${cartItem.cartItemId} has no registrationId`);
            continue;
          }
          
          // Find the original registration
          const registration = await registrationsCollection.findOne({
            registrationId: registrationId
          }) as unknown as Registration | null;
          
          if (!registration) {
            console.log(`Registration ${registrationId} not found for cart ${cart.cartId}`);
            errors.push(`Registration ${registrationId} not found for cart ${cart.cartId}`);
            continue;
          }
          
          // Find attendee in registration data (where the detailed attendee info is stored)
          let attendee = (registration as any).registrationData?.attendees?.find((a: any) => a.attendeeId === attendeeId);
          
          // If not found in registrationData attendees, try the root attendees array
          if (!attendee) {
            attendee = registration.attendees?.find((a: any) => a.attendeeId === attendeeId);
          }
          
          // If still not found, try old_attendees collection
          if (!attendee) {
            attendee = await oldAttendeesCollection.findOne({
              attendeeId: attendeeId
            }) as unknown as Attendee | null;
          }
          
          if (!attendee) {
            console.log(`Attendee ${attendeeId} not found`);
            continue;
          }
          
          // Build complete form data using the actual field names from registration data
          const completeFormData = {
            // Preserve existing formData first, then overwrite with actual data
            ...cartItem.formData,
            
            // Personal information
            firstName: attendee.firstName,
            lastName: attendee.lastName,
            ...(attendee.title && { title: attendee.title }),
            ...(attendee.suffix && { suffix: attendee.suffix }),
            
            // Contact information (use attendee data or fall back to booking contact)
            email: attendee.primaryEmail || attendee.email || (registration as any).registrationData?.bookingContact?.email || registration.bookingContact?.email,
            phone: attendee.primaryPhone || attendee.phone || (registration as any).registrationData?.bookingContact?.phone || registration.bookingContact?.phone,
            
            // Mason-specific fields
            ...(attendee.lodge && { lodgeName: attendee.lodge }),
            ...(attendee.lodgeNameNumber && { lodgeNumber: attendee.lodgeNameNumber }),
            ...(attendee.rank && { rank: attendee.rank }),
            ...(attendee.grandLodge && { grandLodge: attendee.grandLodge }),
            ...(attendee.postNominals && { postNominals: attendee.postNominals }),
            
            // Dietary and accessibility requirements
            ...(attendee.dietaryRequirements && { dietaryRequirements: attendee.dietaryRequirements }),
            ...(attendee.specialNeeds && { specialNeeds: attendee.specialNeeds }),
            ...(attendee.accessibility && { accessibility: attendee.accessibility }),
            
            // Partner/relationship information
            ...(attendee.isPartner !== null && attendee.isPartner !== undefined && { isPartner: attendee.isPartner }),
            ...(attendee.partnerOf && { partnerOf: attendee.partnerOf }),
            ...(attendee.relationship && { relationship: attendee.relationship })
          };
          
          // Check if formData needs updating
          const currentFormData = cartItem.formData || {};
          const hasChanges = JSON.stringify(currentFormData) !== JSON.stringify(completeFormData);
          
          if (hasChanges) {
            updatedCartItems[i] = {
              ...cartItem,
              formData: completeFormData
            };
            cartUpdated = true;
            
            // Add to examples if we don't have many yet
            if (fixedExamples.length < 3) {
              fixedExamples.push({
                cartId: cart.cartId,
                attendeeId: attendeeId,
                attendeeName: `${attendee.firstName} ${attendee.lastName}`,
                beforeFormData: currentFormData,
                afterFormData: completeFormData
              });
            }
          }
        }
        
        // Update cart if changes were made
        if (cartUpdated) {
          await cartsCollection.updateOne(
            { _id: cart._id },
            { $set: { cartItems: updatedCartItems } }
          );
          cartsFixed++;
          console.log(`Fixed cart ${cart.cartId}`);
        } else {
          console.log(`Cart ${cart.cartId} already has complete formData`);
        }
        
      } catch (error) {
        console.error(`Error processing cart ${cart._id}:`, error);
        errors.push(`Error processing cart ${cart._id}: ${error}`);
        cartsSkipped++;
      }
    }
    
    // Generate report
    console.log('\n=== MIGRATION REPORT ===');
    console.log(`Total carts processed: ${individualCarts.length}`);
    console.log(`Carts fixed: ${cartsFixed}`);
    console.log(`Carts skipped: ${cartsSkipped}`);
    console.log(`Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\nErrors encountered:');
      errors.forEach(error => console.log(`- ${error}`));
    }
    
    if (fixedExamples.length > 0) {
      console.log('\nSample fixed formData:');
      fixedExamples.forEach((example, index) => {
        console.log(`\n${index + 1}. Cart ${example.cartId}, Attendee: ${example.attendeeName}`);
        console.log('Before:', JSON.stringify(example.beforeFormData, null, 2));
        console.log('After:', JSON.stringify(example.afterFormData, null, 2));
      });
    }
    
    return {
      totalCarts: individualCarts.length,
      cartsFixed,
      cartsSkipped,
      errors: errors.length,
      examples: fixedExamples
    };
    
  } finally {
    await client.close();
  }
}

// Execute the script
fixIndividualCartFormData()
  .then(result => {
    console.log('\nScript completed successfully!');
    console.log('Final results:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });

export { fixIndividualCartFormData };