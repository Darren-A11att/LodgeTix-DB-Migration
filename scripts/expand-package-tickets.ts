#!/usr/bin/env tsx
/**
 * PACKAGE TICKET EXPANSION SCRIPT
 * 
 * This script finds and expands package tickets in both import and production registrations.
 * It directly modifies the database to convert isPackage: true tickets into individual tickets.
 */

import { MongoClient, Db, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.explorer') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
const DB_NAME = 'lodgetix';

interface ExpansionSummary {
  importRegistrationsFound: number;
  importRegistrationsExpanded: number;
  productionRegistrationsFound: number;
  productionRegistrationsExpanded: number;
  totalPackagesExpanded: number;
  expandedPackageDetails: Array<{
    packageId: string;
    packageName: string;
    individualTickets: Array<{
      eventTicketId: string;
      eventName: string;
      quantity: number;
      price: number;
    }>;
  }>;
  errors: string[];
}

class PackageTicketExpander {
  private db: Db | null = null;
  private mongoClient: MongoClient | null = null;
  private summary: ExpansionSummary = {
    importRegistrationsFound: 0,
    importRegistrationsExpanded: 0,
    productionRegistrationsFound: 0,
    productionRegistrationsExpanded: 0,
    totalPackagesExpanded: 0,
    expandedPackageDetails: [],
    errors: []
  };

  async connect(): Promise<void> {
    this.mongoClient = new MongoClient(MONGODB_URI);
    await this.mongoClient.connect();
    this.db = this.mongoClient.db(DB_NAME);
    console.log('✅ Connected to MongoDB');
  }

  async disconnect(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.mongoClient = null;
      this.db = null;
    }
  }

  private async fetchEventTicketDetails(eventTicketId: string): Promise<any> {
    try {
      if (!this.db) throw new Error('Database not connected');
      
      const eventTicket = await this.db.collection('eventTickets').findOne({ 
        eventTicketId: eventTicketId 
      });
      
      if (eventTicket) {
        const ticketName = eventTicket.eventName || eventTicket.name || 'Unknown Event';
        const ticketPrice = eventTicket.price && typeof eventTicket.price === 'object' && eventTicket.price.$numberDecimal 
          ? parseFloat(eventTicket.price.$numberDecimal) 
          : (eventTicket.price || 0);
        
        return {
          eventTicketId: eventTicket.eventTicketId,
          eventName: ticketName,
          name: ticketName,
          price: ticketPrice,
          attributes: eventTicket.attributes || []
        };
      }
      
      return null;
    } catch (error) {
      console.log(`    ⚠️ Error fetching event ticket ${eventTicketId}: ${error}`);
      return null;
    }
  }

  private async expandPackageTickets(packageTicket: any, attendeeId: string, registrationId: string): Promise<any[]> {
    try {
      const packageId = packageTicket.packageId || packageTicket.eventTicketId || packageTicket.ticketId;
      
      if (!packageId) {
        console.log(`    ⚠️ Package ticket missing packageId`);
        return [];
      }
      
      console.log(`    🔍 Looking up package: ${packageId}`);
      
      if (!this.db) throw new Error('Database not connected');
      
      // Query packages collection for package details
      const packageDoc = await this.db.collection('packages').findOne({ packageId: packageId });
      
      if (!packageDoc) {
        console.log(`    ⚠️ Package ${packageId} not found in packages collection`);
        this.summary.errors.push(`Package ${packageId} not found in packages collection`);
        return [];
      }
      
      const includedItems = packageDoc.includedItems || [];
      console.log(`    📦 Package "${packageDoc.name || packageId}" contains ${includedItems.length} items`);
      
      const expandedTickets = [];
      const packageDetails = {
        packageId: packageId,
        packageName: packageDoc.name || packageId,
        individualTickets: []
      };
      
      for (let i = 0; i < includedItems.length; i++) {
        const item = includedItems[i];
        
        // Fetch event ticket details for this item
        const eventTicketDetails = await this.fetchEventTicketDetails(item.eventTicketId);
        
        const expandedTicket = {
          // Core identifiers
          ticketId: `${packageTicket.ticketId || packageId}_item_${i}`,
          originalTicketId: `${packageTicket.id || packageId}_expanded_${item.eventTicketId}`,
          eventTicketId: item.eventTicketId,
          ticketNumber: `PKG-${Date.now()}-${i}`,
          
          // Event details
          eventName: eventTicketDetails?.eventName || eventTicketDetails?.name || item.name || 'Unknown Event',
          price: eventTicketDetails?.price !== undefined 
            ? (eventTicketDetails.price && typeof eventTicketDetails.price === 'object' && eventTicketDetails.price.$numberDecimal 
                ? parseFloat(eventTicketDetails.price.$numberDecimal) 
                : eventTicketDetails.price)
            : (item.price || 0),
          quantity: item.quantity || 1,
          
          // Owner info - inherit from package ticket
          ownerType: 'individual',
          ownerId: attendeeId,
          
          // Status - inherit from package
          status: packageTicket.status || 'pending',
          
          // Attributes
          attributes: eventTicketDetails?.attributes || [],
          
          // Details
          details: {
            ...packageTicket.details,
            isPackage: false,
            parentPackageId: packageId,
            attendeeId: attendeeId,
            originalAttendeeId: packageTicket.attendeeId || null,
            registrationId: registrationId
          },
          
          // Timestamps
          createdAt: packageTicket.createdAt || new Date().toISOString(),
          modifiedAt: new Date(),
          
          // Modification tracking
          modificationHistory: [{
            type: 'package_expansion',
            changes: [
              {
                field: 'expanded_from_package',
                from: null,
                to: packageId
              },
              {
                field: 'eventTicketId',
                from: null,
                to: item.eventTicketId
              }
            ],
            description: `Ticket expanded from package ${packageId} during package expansion script`,
            timestamp: new Date(),
            userId: 'system-script',
            source: 'package-expansion-script'
          }]
        };
        
        expandedTickets.push(expandedTicket);
        packageDetails.individualTickets.push({
          eventTicketId: item.eventTicketId,
          eventName: expandedTicket.eventName,
          quantity: expandedTicket.quantity,
          price: expandedTicket.price
        });
        
        console.log(`    ✓ Expanded package item: ${item.eventTicketId} -> ${expandedTicket.eventName}`);
      }
      
      this.summary.expandedPackageDetails.push(packageDetails);
      this.summary.totalPackagesExpanded++;
      
      console.log(`    📦 Successfully expanded package ${packageId} into ${expandedTickets.length} individual tickets`);
      return expandedTickets;
      
    } catch (error: any) {
      console.log(`    ❌ Error expanding package ticket: ${error.message}`);
      this.summary.errors.push(`Error expanding package: ${error.message}`);
      return [];
    }
  }

  async findAndExpandImportRegistrations(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n🔍 Searching import_registrations for package tickets...');
    
    // Search for registrations with package tickets
    const query = {
      $or: [
        { 'registrationData.tickets.isPackage': true },
        { 'registration_data.tickets.isPackage': true }
      ]
    };
    
    const registrations = await this.db.collection('import_registrations').find(query).toArray();
    this.summary.importRegistrationsFound = registrations.length;
    
    console.log(`📊 Found ${registrations.length} import registrations with package tickets`);
    
    for (const registration of registrations) {
      try {
        console.log(`\n📝 Processing import registration: ${registration.id || registration.registrationId}`);
        
        // Extract tickets from the correct field
        const tickets = registration.registrationData?.tickets || registration.registration_data?.tickets || [];
        const packageTickets = tickets.filter((t: any) => t.isPackage === true);
        
        if (packageTickets.length === 0) {
          console.log('  ⚠️ No package tickets found (false positive)');
          continue;
        }
        
        console.log(`  📦 Found ${packageTickets.length} package ticket(s)`);
        
        let allExpandedTickets: any[] = [];
        let ticketsToRemove: any[] = [];
        
        // Process each package ticket
        for (const packageTicket of packageTickets) {
          const registrationId = registration.id || registration.registrationId;
          
          // Find the attendee index for this package ticket
          const attendees = registration.registrationData?.attendees || registration.registration_data?.attendees || [];
          const attendeeIndex = attendees.findIndex(
            (a: any) => a.attendeeId === packageTicket.attendeeId || a.id === packageTicket.attendeeId
          );
          const finalAttendeeIndex = attendeeIndex >= 0 ? attendeeIndex : 0;
          const attendeeId = `import_${registrationId}_attendee_${finalAttendeeIndex}`;
          
          console.log(`    🎯 Expanding package for attendee: ${attendeeId}`);
          
          // Expand the package ticket
          const expandedTickets = await this.expandPackageTickets(packageTicket, attendeeId, registrationId);
          
          if (expandedTickets.length > 0) {
            allExpandedTickets.push(...expandedTickets);
            ticketsToRemove.push(packageTicket);
          }
        }
        
        // Update the registration if we have expanded tickets
        if (allExpandedTickets.length > 0) {
          // Remove package tickets and add expanded tickets
          const updatedTickets = tickets.filter((t: any) => !ticketsToRemove.includes(t));
          updatedTickets.push(...allExpandedTickets);
          
          // Update the registration
          const updateField = registration.registrationData ? 'registrationData.tickets' : 'registration_data.tickets';
          await this.db.collection('import_registrations').updateOne(
            { _id: registration._id },
            { 
              $set: { 
                [updateField]: updatedTickets,
                modifiedAt: new Date(),
                packageExpansionProcessed: true
              } 
            }
          );
          
          // Also update import_tickets collection
          await this.updateImportTicketsCollection(registration.id || registration.registrationId, allExpandedTickets, ticketsToRemove);
          
          this.summary.importRegistrationsExpanded++;
          console.log(`  ✅ Updated registration with ${allExpandedTickets.length} expanded tickets`);
        }
        
      } catch (error: any) {
        console.log(`  ❌ Error processing registration ${registration.id}: ${error.message}`);
        this.summary.errors.push(`Import registration ${registration.id}: ${error.message}`);
      }
    }
  }

  async findAndExpandProductionRegistrations(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n🔍 Searching registrations (production) for package tickets...');
    
    // Search for registrations with package tickets
    const query = {
      $or: [
        { 'registrationData.tickets.isPackage': true },
        { 'registration_data.tickets.isPackage': true }
      ]
    };
    
    const registrations = await this.db.collection('registrations').find(query).toArray();
    this.summary.productionRegistrationsFound = registrations.length;
    
    console.log(`📊 Found ${registrations.length} production registrations with package tickets`);
    
    for (const registration of registrations) {
      try {
        console.log(`\n📝 Processing production registration: ${registration.id || registration.registrationId}`);
        
        // Extract tickets from the correct field
        const tickets = registration.registrationData?.tickets || registration.registration_data?.tickets || [];
        const packageTickets = tickets.filter((t: any) => t.isPackage === true);
        
        if (packageTickets.length === 0) {
          console.log('  ⚠️ No package tickets found (false positive)');
          continue;
        }
        
        console.log(`  📦 Found ${packageTickets.length} package ticket(s)`);
        
        let allExpandedTickets: any[] = [];
        let ticketsToRemove: any[] = [];
        
        // Process each package ticket
        for (const packageTicket of packageTickets) {
          const registrationId = registration.id || registration.registrationId;
          
          // Find the attendee index for this package ticket
          const attendees = registration.registrationData?.attendees || registration.registration_data?.attendees || [];
          const attendeeIndex = attendees.findIndex(
            (a: any) => a.attendeeId === packageTicket.attendeeId || a.id === packageTicket.attendeeId
          );
          const finalAttendeeIndex = attendeeIndex >= 0 ? attendeeIndex : 0;
          const attendeeId = `prod_${registrationId}_attendee_${finalAttendeeIndex}`;
          
          console.log(`    🎯 Expanding package for attendee: ${attendeeId}`);
          
          // Expand the package ticket
          const expandedTickets = await this.expandPackageTickets(packageTicket, attendeeId, registrationId);
          
          if (expandedTickets.length > 0) {
            allExpandedTickets.push(...expandedTickets);
            ticketsToRemove.push(packageTicket);
          }
        }
        
        // Update the registration if we have expanded tickets
        if (allExpandedTickets.length > 0) {
          // Remove package tickets and add expanded tickets
          const updatedTickets = tickets.filter((t: any) => !ticketsToRemove.includes(t));
          updatedTickets.push(...allExpandedTickets);
          
          // Update the registration
          const updateField = registration.registrationData ? 'registrationData.tickets' : 'registration_data.tickets';
          await this.db.collection('registrations').updateOne(
            { _id: registration._id },
            { 
              $set: { 
                [updateField]: updatedTickets,
                modifiedAt: new Date(),
                packageExpansionProcessed: true
              } 
            }
          );
          
          // Also update tickets collection
          await this.updateTicketsCollection(registration.id || registration.registrationId, allExpandedTickets, ticketsToRemove);
          
          this.summary.productionRegistrationsExpanded++;
          console.log(`  ✅ Updated registration with ${allExpandedTickets.length} expanded tickets`);
        }
        
      } catch (error: any) {
        console.log(`  ❌ Error processing registration ${registration.id}: ${error.message}`);
        this.summary.errors.push(`Production registration ${registration.id}: ${error.message}`);
      }
    }
  }

  private async updateImportTicketsCollection(registrationId: string, expandedTickets: any[], removedPackageTickets: any[]): Promise<void> {
    if (!this.db) return;
    
    try {
      // Remove package ticket entries
      for (const packageTicket of removedPackageTickets) {
        await this.db.collection('import_tickets').deleteMany({
          registrationId: registrationId,
          ticketId: packageTicket.ticketId || packageTicket.id
        });
      }
      
      // Add individual ticket entries
      for (const ticket of expandedTickets) {
        const ticketDoc = {
          ...ticket,
          registrationId: registrationId,
          createdAt: new Date(),
          source: 'package-expansion-script'
        };
        
        await this.db.collection('import_tickets').insertOne(ticketDoc);
      }
      
      console.log(`    ✅ Updated import_tickets collection`);
      
    } catch (error: any) {
      console.log(`    ⚠️ Error updating import_tickets: ${error.message}`);
      this.summary.errors.push(`Error updating import_tickets for ${registrationId}: ${error.message}`);
    }
  }

  private async updateTicketsCollection(registrationId: string, expandedTickets: any[], removedPackageTickets: any[]): Promise<void> {
    if (!this.db) return;
    
    try {
      // Remove package ticket entries
      for (const packageTicket of removedPackageTickets) {
        await this.db.collection('tickets').deleteMany({
          registrationId: registrationId,
          ticketId: packageTicket.ticketId || packageTicket.id
        });
      }
      
      // Add individual ticket entries
      for (const ticket of expandedTickets) {
        const ticketDoc = {
          ...ticket,
          registrationId: registrationId,
          createdAt: new Date(),
          source: 'package-expansion-script'
        };
        
        await this.db.collection('tickets').insertOne(ticketDoc);
      }
      
      console.log(`    ✅ Updated tickets collection`);
      
    } catch (error: any) {
      console.log(`    ⚠️ Error updating tickets: ${error.message}`);
      this.summary.errors.push(`Error updating tickets for ${registrationId}: ${error.message}`);
    }
  }

  getSummary(): ExpansionSummary {
    return this.summary;
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PACKAGE EXPANSION SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n📥 IMPORT REGISTRATIONS:`);
    console.log(`   Found with packages: ${this.summary.importRegistrationsFound}`);
    console.log(`   Successfully expanded: ${this.summary.importRegistrationsExpanded}`);
    
    console.log(`\n🏭 PRODUCTION REGISTRATIONS:`);
    console.log(`   Found with packages: ${this.summary.productionRegistrationsFound}`);
    console.log(`   Successfully expanded: ${this.summary.productionRegistrationsExpanded}`);
    
    console.log(`\n📦 PACKAGES EXPANDED: ${this.summary.totalPackagesExpanded}`);
    
    if (this.summary.expandedPackageDetails.length > 0) {
      console.log(`\n📋 PACKAGE DETAILS:`);
      this.summary.expandedPackageDetails.forEach((pkg, index) => {
        console.log(`   ${index + 1}. ${pkg.packageName} (${pkg.packageId}):`);
        pkg.individualTickets.forEach(ticket => {
          console.log(`      → ${ticket.eventName} - $${ticket.price} x${ticket.quantity}`);
        });
      });
    }
    
    if (this.summary.errors.length > 0) {
      console.log(`\n❌ ERRORS (${this.summary.errors.length}):`);
      this.summary.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    } else {
      console.log(`\n✅ NO ERRORS ENCOUNTERED`);
    }
    
    console.log('='.repeat(80));
  }
}

async function runPackageExpansion(): Promise<void> {
  const expander = new PackageTicketExpander();
  
  try {
    await expander.connect();
    
    console.log('🎯 PACKAGE TICKET EXPANSION SCRIPT');
    console.log('This script will find and expand package tickets in both import and production registrations');
    console.log('='.repeat(80));
    
    // Step 1: Process import registrations
    await expander.findAndExpandImportRegistrations();
    
    // Step 2: Process production registrations
    await expander.findAndExpandProductionRegistrations();
    
    // Step 3: Print summary
    expander.printSummary();
    
  } catch (error: any) {
    console.error('❌ Package expansion failed:', error.message);
    console.error(error.stack);
  } finally {
    await expander.disconnect();
  }
}

// Run the expansion
if (require.main === module) {
  runPackageExpansion()
    .then(() => {
      console.log('\n🎉 Package expansion completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Package expansion crashed:', error);
      process.exit(1);
    });
}

export default PackageTicketExpander;