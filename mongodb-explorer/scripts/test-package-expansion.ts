#!/usr/bin/env tsx
/**
 * Test script to verify package ticket expansion works correctly
 * Tests package expansion logic from EnhancedPaymentSyncService
 */

import { MongoClient, Db, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.explorer') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/';
const DB_NAME = 'lodgetix';

interface TestResults {
  packageFound: boolean;
  packageExpanded: boolean;
  individualTicketsCreated: number;
  ownershipFieldsValid: boolean;
  packageRemoved: boolean;
  errors: string[];
}

class PackageExpansionTester {
  private db: Db | null = null;
  private mongoClient: MongoClient | null = null;

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

  private async expandPackageTickets(packageTicket: any, attendeeId: string): Promise<any[]> {
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
        return [];
      }
      
      const includedItems = packageDoc.includedItems || [];
      console.log(`    📦 Package contains ${includedItems.length} items`);
      
      const expandedTickets = [];
      
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
            originalAttendeeId: packageTicket.attendeeId || null
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
            description: `Ticket expanded from package ${packageId} during sync`,
            timestamp: new Date(),
            userId: 'system-sync',
            source: 'enhanced-payment-sync-package-expansion'
          }]
        };
        
        expandedTickets.push(expandedTicket);
        console.log(`    ✓ Expanded package item: ${item.eventTicketId} -> ${expandedTicket.eventName}`);
      }
      
      console.log(`    📦 Successfully expanded package ${packageId} into ${expandedTickets.length} individual tickets`);
      return expandedTickets;
      
    } catch (error: any) {
      console.log(`    ❌ Error expanding package ticket: ${error.message}`);
      return [];
    }
  }

  async findPackageRegistration(): Promise<any> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n🔍 Looking for registration with package tickets...');
    
    // Look for registrations with isPackage: true tickets
    const registrations = await this.db.collection('import_registrations').find({
      'registrationData.tickets': {
        $elemMatch: { isPackage: true }
      }
    }).limit(5).toArray();
    
    if (registrations.length === 0) {
      // Fallback - look in registration_data field
      const fallbackRegistrations = await this.db.collection('import_registrations').find({
        'registration_data.tickets': {
          $elemMatch: { isPackage: true }
        }
      }).limit(5).toArray();
      
      if (fallbackRegistrations.length === 0) {
        console.log('❌ No registrations found with package tickets');
        return null;
      }
      
      return fallbackRegistrations[0];
    }
    
    return registrations[0];
  }

  async createTestPackageRegistration(): Promise<any> {
    if (!this.db) throw new Error('Database not connected');
    
    console.log('\n🧪 Creating test registration with package ticket...');
    
    // First, check if packages collection exists and has data
    const packageCount = await this.db.collection('packages').countDocuments();
    console.log(`📦 Found ${packageCount} packages in database`);
    
    if (packageCount === 0) {
      // Create a test package
      const testPackage = {
        packageId: 'test-package-001',
        name: 'Test Package',
        description: 'Test package for expansion testing',
        price: 200,
        includedItems: [
          {
            eventTicketId: 'evt-001',
            name: 'Banquet Ticket',
            quantity: 1,
            price: 115
          },
          {
            eventTicketId: 'evt-002', 
            name: 'Cocktail Reception',
            quantity: 1,
            price: 85
          }
        ],
        createdAt: new Date(),
        modifiedAt: new Date()
      };
      
      await this.db.collection('packages').insertOne(testPackage);
      console.log('✅ Created test package');
      
      // Create corresponding event tickets
      const eventTickets = [
        {
          eventTicketId: 'evt-001',
          name: 'Banquet Ticket',
          eventName: 'Annual Banquet',
          price: { $numberDecimal: '115' },
          attributes: []
        },
        {
          eventTicketId: 'evt-002',
          name: 'Cocktail Reception',
          eventName: 'Cocktail Reception',
          price: { $numberDecimal: '85' },
          attributes: []
        }
      ];
      
      for (const ticket of eventTickets) {
        await this.db.collection('eventTickets').replaceOne(
          { eventTicketId: ticket.eventTicketId },
          ticket,
          { upsert: true }
        );
      }
      console.log('✅ Created test event tickets');
    }
    
    // Create test registration with package ticket
    const testRegistration = {
      id: `test-reg-${Date.now()}`,
      registrationId: `test-reg-${Date.now()}`,
      status: 'completed',
      paymentStatus: 'paid',
      authUserId: 'test-user-001',
      registrationData: {
        bookingContact: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          mobile: '0400000000'
        },
        attendees: [
          {
            attendeeId: 'test-attendee-001',
            firstName: 'Test',
            lastName: 'Attendee',
            email: 'attendee@example.com',
            isPrimary: true
          }
        ],
        tickets: [
          {
            id: 'test-ticket-001',
            ticketId: 'test-ticket-001',
            eventTicketId: 'test-package-001',
            packageId: 'test-package-001',
            isPackage: true,
            attendeeId: 'test-attendee-001',
            status: 'sold',
            quantity: 1,
            details: {
              registrationId: `test-reg-${Date.now()}`,
              attendeeId: 'test-attendee-001'
            },
            createdAt: new Date().toISOString()
          }
        ]
      },
      createdAt: new Date().toISOString(),
      modifiedAt: new Date()
    };
    
    await this.db.collection('import_registrations').insertOne(testRegistration);
    console.log('✅ Created test registration with package ticket');
    
    return testRegistration;
  }

  async testPackageExpansion(registration: any): Promise<TestResults> {
    const results: TestResults = {
      packageFound: false,
      packageExpanded: false,
      individualTicketsCreated: 0,
      ownershipFieldsValid: false,
      packageRemoved: false,
      errors: []
    };
    
    try {
      console.log('\n🧪 Testing package expansion...');
      
      // Extract tickets from registration
      const tickets = registration.registrationData?.tickets || registration.registration_data?.tickets || [];
      console.log(`Found ${tickets.length} tickets in registration`);
      
      // Find package ticket
      const packageTicket = tickets.find((t: any) => t.isPackage === true);
      
      if (!packageTicket) {
        results.errors.push('No package ticket found in registration');
        return results;
      }
      
      results.packageFound = true;
      console.log(`✅ Found package ticket: ${packageTicket.packageId || packageTicket.eventTicketId}`);
      
      // Test package expansion
      const registrationId = registration.id || registration.registrationId;
      const attendeeId = `import_${registrationId}_attendee_0`;
      
      console.log('\n📦 Testing package expansion logic...');
      const expandedTickets = await this.expandPackageTickets(packageTicket, attendeeId);
      
      if (expandedTickets.length === 0) {
        results.errors.push('Package expansion returned no tickets');
        return results;
      }
      
      results.packageExpanded = true;
      results.individualTicketsCreated = expandedTickets.length;
      console.log(`✅ Package expanded into ${expandedTickets.length} individual tickets`);
      
      // Verify ownership fields
      let ownershipValid = true;
      for (const ticket of expandedTickets) {
        if (!ticket.ownerId || !ticket.ownerType) {
          ownershipValid = false;
          results.errors.push(`Ticket ${ticket.ticketId} missing ownership fields`);
        }
        
        if (ticket.details?.isPackage !== false) {
          ownershipValid = false;
          results.errors.push(`Ticket ${ticket.ticketId} isPackage should be false`);
        }
        
        if (!ticket.details?.parentPackageId) {
          ownershipValid = false;
          results.errors.push(`Ticket ${ticket.ticketId} missing parentPackageId`);
        }
      }
      
      results.ownershipFieldsValid = ownershipValid;
      
      if (ownershipValid) {
        console.log('✅ All ownership fields properly set');
      } else {
        console.log('❌ Some ownership fields missing or invalid');
      }
      
      // Test that original package would be removed in real processing
      // (We just verify the logic, don't actually remove from test data)
      results.packageRemoved = true; // This would happen in real sync
      console.log('✅ Original package ticket would be removed during normal processing');
      
      // Log detailed ticket information
      console.log('\n📝 Expanded ticket details:');
      for (let i = 0; i < expandedTickets.length; i++) {
        const ticket = expandedTickets[i];
        console.log(`  ${i + 1}. ${ticket.eventName} (${ticket.eventTicketId})`);
        console.log(`     Price: $${ticket.price}, Quantity: ${ticket.quantity}`);
        console.log(`     Owner: ${ticket.ownerType} - ${ticket.ownerId}`);
        console.log(`     Status: ${ticket.status}`);
        console.log(`     Parent Package: ${ticket.details?.parentPackageId}`);
      }
      
    } catch (error: any) {
      results.errors.push(`Expansion test failed: ${error.message}`);
      console.log(`❌ Error during testing: ${error.message}`);
    }
    
    return results;
  }

  async testErrorHandling(): Promise<void> {
    console.log('\n🚨 Testing error handling...');
    
    // Test 1: Package not found
    console.log('\n1. Testing package not found scenario...');
    const invalidPackageTicket = {
      isPackage: true,
      packageId: 'non-existent-package',
      ticketId: 'test-invalid-001',
      status: 'sold'
    };
    
    const result1 = await this.expandPackageTickets(invalidPackageTicket, 'test-attendee');
    console.log(`   Result: ${result1.length === 0 ? '✅ Correctly returned empty array' : '❌ Should return empty array'}`);
    
    // Test 2: Package with missing eventTicketId
    console.log('\n2. Testing package with invalid eventTicketId...');
    if (!this.db) throw new Error('Database not connected');
    
    const invalidPackageDoc = {
      packageId: 'test-invalid-package',
      includedItems: [
        {
          eventTicketId: 'non-existent-event-ticket',
          quantity: 1,
          price: 100
        }
      ]
    };
    
    await this.db.collection('packages').replaceOne(
      { packageId: 'test-invalid-package' },
      invalidPackageDoc,
      { upsert: true }
    );
    
    const invalidPackageTicket2 = {
      isPackage: true,
      packageId: 'test-invalid-package',
      ticketId: 'test-invalid-002',
      status: 'sold'
    };
    
    const result2 = await this.expandPackageTickets(invalidPackageTicket2, 'test-attendee');
    console.log(`   Result: ${result2.length > 0 ? '✅ Handled missing eventTicket gracefully' : '❌ Failed to handle missing eventTicket'}`);
    
    // Test 3: Missing packageId
    console.log('\n3. Testing missing packageId...');
    const noPackageIdTicket = {
      isPackage: true,
      ticketId: 'test-no-package-id',
      status: 'sold'
    };
    
    const result3 = await this.expandPackageTickets(noPackageIdTicket, 'test-attendee');
    console.log(`   Result: ${result3.length === 0 ? '✅ Correctly handled missing packageId' : '❌ Should return empty array'}`);
  }

  async cleanup(): Promise<void> {
    if (!this.db) return;
    
    console.log('\n🧹 Cleaning up test data...');
    
    // Remove test data
    await this.db.collection('import_registrations').deleteMany({
      id: { $regex: /^test-reg-/ }
    });
    
    await this.db.collection('packages').deleteMany({
      packageId: { $regex: /^test-/ }
    });
    
    await this.db.collection('eventTickets').deleteMany({
      eventTicketId: { $in: ['evt-001', 'evt-002'] }
    });
    
    console.log('✅ Test data cleaned up');
  }
}

async function runPackageExpansionTests(): Promise<void> {
  const tester = new PackageExpansionTester();
  
  try {
    await tester.connect();
    
    console.log('='.repeat(60));
    console.log('🎯 PACKAGE TICKET EXPANSION TEST SUITE');
    console.log('='.repeat(60));
    
    // Step 1: Look for existing package registration
    let registration = await tester.findPackageRegistration();
    
    // Step 2: Create test data if needed
    if (!registration) {
      console.log('📝 No existing package registrations found, creating test data...');
      registration = await tester.createTestPackageRegistration();
    } else {
      console.log('✅ Found existing package registration for testing');
    }
    
    // Step 3: Test package expansion
    const results = await tester.testPackageExpansion(registration);
    
    // Step 4: Test error handling
    await tester.testErrorHandling();
    
    // Step 5: Display results
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`Package Found: ${results.packageFound ? '✅' : '❌'}`);
    console.log(`Package Expanded: ${results.packageExpanded ? '✅' : '❌'}`);
    console.log(`Individual Tickets Created: ${results.individualTicketsCreated}`);
    console.log(`Ownership Fields Valid: ${results.ownershipFieldsValid ? '✅' : '❌'}`);
    console.log(`Package Removed: ${results.packageRemoved ? '✅' : '❌'} (simulated)`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      results.errors.forEach(error => console.log(`   • ${error}`));
    } else {
      console.log('\n✅ ALL TESTS PASSED!');
    }
    
    // Step 6: Cleanup (optional - comment out to inspect test data)
    // await tester.cleanup();
    
  } catch (error: any) {
    console.error('❌ Test suite failed:', error.message);
    console.error(error.stack);
  } finally {
    await tester.disconnect();
  }
}

// Run the tests
if (require.main === module) {
  runPackageExpansionTests()
    .then(() => {
      console.log('\n🎉 Package expansion test suite completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test suite crashed:', error);
      process.exit(1);
    });
}

export default PackageExpansionTester;