const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

/**
 * Generate confirmation number using reversed timestamp strategy
 * Format: [PREFIX]-[8-9 digits][1 random letter]
 * 
 * Example:
 * Timestamp: 1736527234
 * Reversed: 4327256371
 * Drop last digit: 432725637
 * Add random letter: 432725637K
 * Result: IND-432725637K
 */
function generateUniqueConfirmationNumber(registrationType) {
  // Determine prefix based on registration type
  const prefix = registrationType === 'lodge' || registrationType === 'lodges' ? 'LDG' : 'IND';
  
  // Get current timestamp
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Reverse the timestamp
  const reversed = timestamp.toString().split('').reverse().join('');
  
  // Drop the last digit (which is the first digit of the original timestamp)
  const truncated = reversed.substring(0, reversed.length - 1);
  
  // Generate a random uppercase letter (A-Z)
  const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  
  // Combine into final format
  return `${prefix}-${truncated}${randomLetter}`;
}

async function generateConfirmationNumbersForMatched() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';
  
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  try {
    console.log('=== GENERATING CONFIRMATION NUMBERS FOR MATCHED PAYMENTS ===\n');
    
    // Find registrations that:
    // 1. Don't have a confirmation number
    // 2. Have a completed payment (matched to payment)
    const registrationsNeedingNumbers = await db.collection('registrations').find({
      confirmationNumber: { $in: [null, '', undefined] },
      $and: [
        {
          $or: [
            { paymentStatus: 'completed' },
            { paymentStatus: 'paid' },
            { status: 'completed' },
            { status: 'confirmed' }
          ]
        },
        {
          $or: [
            { stripePaymentIntentId: { $exists: true, $ne: null, $ne: '' } },
            { squarePaymentId: { $exists: true, $ne: null, $ne: '' } },
            { totalPricePaid: { $gt: 0 } }
          ]
        }
      ]
    }).toArray();
    
    console.log(`Found ${registrationsNeedingNumbers.length} registrations needing confirmation numbers\n`);
    
    if (registrationsNeedingNumbers.length === 0) {
      console.log('No registrations need confirmation numbers.');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process each registration
    for (const registration of registrationsNeedingNumbers) {
      try {
        // Generate confirmation number
        const confirmationNumber = generateUniqueConfirmationNumber(registration.registrationType);
        
        // Update the registration
        const result = await db.collection('registrations').updateOne(
          { _id: registration._id },
          {
            $set: {
              confirmationNumber: confirmationNumber,
              confirmationGeneratedAt: new Date(),
              confirmationGeneratedMethod: 'reversed-timestamp',
              updatedAt: new Date()
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          successCount++;
          console.log(`✓ ${registration.registrationId || registration._id}: ${confirmationNumber}`);
          
          // Show payment info
          if (registration.stripePaymentIntentId) {
            console.log(`  Payment: Stripe ${registration.stripePaymentIntentId}`);
          } else if (registration.squarePaymentId) {
            console.log(`  Payment: Square ${registration.squarePaymentId}`);
          }
          console.log(`  Amount: $${registration.totalPricePaid || registration.totalAmountPaid || 0}`);
          console.log();
        } else {
          console.log(`⚠️  No changes made for ${registration._id}`);
        }
        
      } catch (error) {
        errorCount++;
        errors.push({
          registration: registration._id,
          error: error.message
        });
        console.error(`✗ Error processing ${registration._id}: ${error.message}`);
      }
      
      // Small delay to ensure timestamp uniqueness
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total processed: ${registrationsNeedingNumbers.length}`);
    console.log(`✓ Success: ${successCount}`);
    console.log(`✗ Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(err => {
        console.log(`  - ${err.registration}: ${err.error}`);
      });
    }
    
    // Show example of the format
    console.log('\n=== CONFIRMATION NUMBER FORMAT ===');
    console.log('Format: [PREFIX]-[8-9 digits][1 letter]');
    console.log('Example: IND-432725637K');
    console.log('\nBenefits:');
    console.log('- Guaranteed unique (based on timestamp)');
    console.log('- No database checks needed');
    console.log('- No collision possibility');
    console.log('- Simple and fast generation');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

// Add function to generate confirmation numbers going forward
async function generateForNewPaymentMatch(db, registrationId, registrationType) {
  const confirmationNumber = generateUniqueConfirmationNumber(registrationType);
  
  const result = await db.collection('registrations').updateOne(
    { 
      registrationId: registrationId,
      confirmationNumber: { $in: [null, '', undefined] }
    },
    {
      $set: {
        confirmationNumber: confirmationNumber,
        confirmationGeneratedAt: new Date(),
        confirmationGeneratedMethod: 'reversed-timestamp',
        updatedAt: new Date()
      }
    }
  );
  
  if (result.modifiedCount > 0) {
    console.log(`Generated confirmation number ${confirmationNumber} for registration ${registrationId}`);
    return confirmationNumber;
  }
  
  // If no modification, check if it already has a confirmation number
  const existing = await db.collection('registrations').findOne({ registrationId });
  return existing?.confirmationNumber || null;
}

// Export for use in other scripts
module.exports = {
  generateUniqueConfirmationNumber,
  generateForNewPaymentMatch
};

// Run if called directly
if (require.main === module) {
  generateConfirmationNumbersForMatched().catch(console.error);
}