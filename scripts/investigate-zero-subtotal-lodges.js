const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function investigateZeroSubtotalLodges() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    // Find the zero-subtotal lodge registrations
    const zeroSubtotalConfirmations = ['LDG-499228VV', 'LDG-047204NQ', 'LDG-144723KI', 'LDG-490194LF'];
    
    console.log('=== Investigating Zero-Subtotal Lodge Registrations ===\n');
    
    for (const confirmationNumber of zeroSubtotalConfirmations) {
      const registration = await db.collection('registrations').findOne({
        $or: [
          { confirmation_number: confirmationNumber },
          { confirmationNumber: confirmationNumber }
        ]
      });
      
      if (registration) {
        console.log(`\n========== ${confirmationNumber} ==========`);
        
        // Extract lodge name
        const lodgeName = registration.lodge_name || 
                         registration.lodgeName || 
                         registration.organisation_name || 
                         registration.organizationName ||
                         registration.registrationData?.lodgeName ||
                         registration.registration_data?.lodgeName ||
                         'Not specified';
        
        console.log(`Lodge Name: ${lodgeName}`);
        
        // Extract booking contact
        const bookingContact = registration.registrationData?.bookingContact || 
                              registration.registration_data?.bookingContact ||
                              registration.booking_contact ||
                              registration.bookingContact ||
                              {};
        
        console.log('\nBooking Contact:');
        console.log(`  Name: ${bookingContact.firstName || bookingContact.first_name || ''} ${bookingContact.lastName || bookingContact.last_name || ''}`);
        console.log(`  Email: ${bookingContact.email || 'Not provided'}`);
        console.log(`  Phone: ${bookingContact.phone || bookingContact.phoneNumber || 'Not provided'}`);
        
        // Extract billing contact
        const billingContact = registration.registrationData?.billingContact || 
                              registration.registration_data?.billingContact ||
                              registration.billing_contact ||
                              registration.billingContact ||
                              {};
        
        console.log('\nBilling Contact:');
        console.log(`  Name: ${billingContact.firstName || billingContact.first_name || ''} ${billingContact.lastName || billingContact.last_name || ''}`);
        console.log(`  Email: ${billingContact.email || 'Not provided'}`);
        console.log(`  Phone: ${billingContact.phone || billingContact.phoneNumber || 'Not provided'}`);
        
        // Show financial information
        console.log('\nFinancial Information:');
        console.log(`  Subtotal: ${extractNumericValue(registration.subtotal)}`);
        console.log(`  Total: ${extractNumericValue(registration.total)}`);
        console.log(`  Total Price Paid: ${extractNumericValue(registration.total_price_paid || registration.totalPricePaid)}`);
        
        // Show registration details
        console.log('\nRegistration Details:');
        console.log(`  Type: ${registration.registration_type || registration.registrationType}`);
        console.log(`  Created: ${registration.created_at || registration.createdAt || 'Unknown'}`);
        console.log(`  Attendee Count: ${registration.attendee_count || registration.attendeeCount || 'Unknown'}`);
        
        // Check for any payment information
        const payments = await db.collection('payments').find({
          $or: [
            { registrationId: registration.registrationId || registration.registration_id || registration._id.toString() },
            { registration_id: registration.registrationId || registration.registration_id || registration._id.toString() }
          ]
        }).toArray();
        
        console.log(`\nPayments Found: ${payments.length}`);
        if (payments.length > 0) {
          for (const payment of payments) {
            console.log(`  - Amount: ${payment.amount || payment.payment_amount}, Status: ${payment.status || payment.payment_status}`);
          }
        }
      }
    }
    
  } finally {
    await client.close();
  }
}

function extractNumericValue(value) {
  if (value === null || value === undefined) return 0;
  
  // Handle MongoDB Decimal128 instances
  if (typeof value === 'object' && value.constructor && value.constructor.name === 'Decimal128') {
    return parseFloat(value.toString());
  }
  
  // Handle MongoDB Decimal128 as plain object
  if (typeof value === 'object' && value.$numberDecimal !== undefined) {
    return parseFloat(value.$numberDecimal);
  }
  
  // Handle plain numbers
  if (typeof value === 'number') {
    return value;
  }
  
  // Handle strings
  if (typeof value === 'string') {
    return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
  }
  
  return 0;
}

investigateZeroSubtotalLodges().catch(console.error);