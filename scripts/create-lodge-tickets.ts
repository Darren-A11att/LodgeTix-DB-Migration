import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

interface LodgeTicket {
  index: number;
  registrationId: string;
  ticket: {
    id: string;
    price: number;
    isPackage: boolean;
    attendeeId: string;
    eventTicketId: string;
    quantity: number;
  };
  source: string;
}

async function createLodgeTickets() {
  try {
    console.log('Reading lodge registrations...');
    
    // Read the registrations without tickets (lodge registrations)
    const lodgeRegistrationsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'registrations-without-tickets.json');
    const lodgeData = JSON.parse(fs.readFileSync(lodgeRegistrationsPath, 'utf-8'));
    
    // Read existing tickets
    const existingTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'all-tickets.json');
    let existingTickets = [];
    try {
      const fileContent = fs.readFileSync(existingTicketsPath, 'utf-8');
      existingTickets = JSON.parse(fileContent);
    } catch (error) {
      console.error('Error reading all-tickets.json:', error);
      console.log('Starting with empty tickets array');
      existingTickets = [];
    }
    
    console.log(`Found ${lodgeData.count} lodge registrations to process`);
    console.log(`Existing tickets count: ${existingTickets.length}`);
    
    // Get the starting index for new tickets
    let currentIndex = existingTickets.length;
    const newLodgeTickets: LodgeTicket[] = [];
    
    // Process each lodge registration
    for (const registration of lodgeData.registrations) {
      // Extract package_id from nested structure
      let packageId = null;
      let packagePrice = 1150; // Default price as specified
      
      // Check different possible locations for package_id
      if (registration.registration_data?.packageDetails?.packageId) {
        packageId = registration.registration_data.packageDetails.packageId;
        // Also get the actual package price if available
        if (registration.registration_data.packageDetails.packagePrice) {
          packagePrice = registration.registration_data.packageDetails.packagePrice;
        }
      } else if (registration.registration_data?.selectedPackageDetails?.packageId) {
        packageId = registration.registration_data.selectedPackageDetails.packageId;
        if (registration.registration_data.selectedPackageDetails.pricePerPackage) {
          packagePrice = registration.registration_data.selectedPackageDetails.pricePerPackage;
        }
      } else if (registration.registration_data?.lodgeOrderDetails?.packageId) {
        packageId = registration.registration_data.lodgeOrderDetails.packageId;
        if (registration.registration_data.lodgeOrderDetails.packagePrice) {
          packagePrice = registration.registration_data.lodgeOrderDetails.packagePrice;
        }
      } else if (registration.registration_data?.packageId) {
        // Check for packageId at the registration_data level
        packageId = registration.registration_data.packageId;
      }
      
      // If no packageId found, use the default one
      if (!packageId) {
        console.log(`Using default packageId for registration ${registration.registration_id}`);
        packageId = '794841e4-5f04-4899-96e2-c0afece4d5f2';
      }
      
      // Get attendee count
      let attendeeCount = registration.attendee_count || 0;
      
      // If attendee_count is 0, try to get it from registration_data
      if (attendeeCount === 0) {
        if (registration.registration_data?.totalItems) {
          attendeeCount = registration.registration_data.totalItems;
        } else if (registration.registration_data?.lodgeOrderDetails?.totalAttendees) {
          attendeeCount = registration.registration_data.lodgeOrderDetails.totalAttendees;
        }
      }
      
      // Skip if we don't have required data (packageId is now always set)
      if (!registration.customer_id || !registration.registration_id) {
        console.warn(`Skipping registration ${registration.registration_id} - missing required data`);
        console.warn(`  - customer_id: ${registration.customer_id}`);
        console.warn(`  - registration_id: ${registration.registration_id}`);
        continue;
      }
      
      // Create the ticket object
      const lodgeTicket: LodgeTicket = {
        index: currentIndex++,
        registrationId: registration.registration_id,
        ticket: {
          id: `${registration.customer_id}-${packageId}`,
          price: packagePrice,
          isPackage: true,
          attendeeId: registration.customer_id,
          eventTicketId: packageId,
          quantity: attendeeCount
        },
        source: "lodges"
      };
      
      newLodgeTickets.push(lodgeTicket);
    }
    
    console.log(`\nCreated ${newLodgeTickets.length} lodge tickets`);
    
    // Combine with existing tickets
    const allTickets = [...existingTickets, ...newLodgeTickets];
    
    // Save the updated tickets file
    fs.writeFileSync(existingTicketsPath, JSON.stringify(allTickets, null, 2));
    console.log(`\nUpdated all-tickets.json with ${allTickets.length} total tickets`);
    
    // Also save just the lodge tickets separately for review
    const lodgeTicketsPath = path.join(__dirname, '..', 'supabase-ticket-analysis', 'lodge-tickets.json');
    fs.writeFileSync(lodgeTicketsPath, JSON.stringify({
      count: newLodgeTickets.length,
      tickets: newLodgeTickets
    }, null, 2));
    console.log(`Saved lodge tickets separately to: ${lodgeTicketsPath}`);
    
    // Print summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total lodge registrations processed: ${lodgeData.registrations.length}`);
    console.log(`Lodge tickets created: ${newLodgeTickets.length}`);
    console.log(`Total tickets in all-tickets.json: ${allTickets.length}`);
    
    // Show sample lodge ticket
    if (newLodgeTickets.length > 0) {
      console.log('\nSample lodge ticket:');
      console.log(JSON.stringify(newLodgeTickets[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error creating lodge tickets:', error);
    throw error;
  }
}

// Run the script
createLodgeTickets().catch(console.error);