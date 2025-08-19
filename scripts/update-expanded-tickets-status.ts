#!/usr/bin/env npx ts-node

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.explorer') });

interface TicketDocument {
  _id: any;
  status: string;
  details?: {
    parentPackageId?: string;
    packageExpansion?: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

async function updateExpandedTicketsStatus() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('lodgetix');
    
    // Collections to update
    const importTicketsCollection = db.collection('import_tickets');
    const productionTicketsCollection = db.collection('tickets');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('\n=== UPDATING EXPANDED TICKETS STATUS ===\n');

    // 1. Update import_tickets
    console.log('1. Updating import_tickets collection...');
    
    // Query for expanded tickets (tickets with parentPackageId or packageExpansion flag)
    const importQuery = {
      $and: [
        { status: 'pending' },
        {
          $or: [
            { 'details.parentPackageId': { $exists: true, $ne: null } },
            { 'details.packageExpansion': true },
            { createdAt: { $gte: today } }
          ]
        }
      ]
    };

    // Check current status before update
    const importTicketsBefore = await importTicketsCollection.find(importQuery).toArray();
    console.log(`Found ${importTicketsBefore.length} import tickets to update`);

    if (importTicketsBefore.length > 0) {
      console.log('Sample tickets before update:');
      importTicketsBefore.slice(0, 3).forEach((ticket: TicketDocument, index) => {
        console.log(`  ${index + 1}. ID: ${ticket._id}, Status: ${ticket.status}, ParentPackageId: ${ticket.details?.parentPackageId}, PackageExpansion: ${ticket.details?.packageExpansion}`);
      });
    }

    // Perform the update
    const importUpdateResult = await importTicketsCollection.updateMany(
      importQuery,
      { 
        $set: { 
          status: 'sold',
          updatedAt: new Date()
        } 
      }
    );

    console.log(`Import tickets updated: ${importUpdateResult.modifiedCount}`);

    // 2. Update production tickets
    console.log('\n2. Updating production tickets collection...');
    
    const productionQuery = {
      $and: [
        { status: 'pending' },
        {
          $or: [
            { 'details.parentPackageId': { $exists: true, $ne: null } },
            { 'details.packageExpansion': true },
            { createdAt: { $gte: today } }
          ]
        }
      ]
    };

    // Check current status before update
    const productionTicketsBefore = await productionTicketsCollection.find(productionQuery).toArray();
    console.log(`Found ${productionTicketsBefore.length} production tickets to update`);

    if (productionTicketsBefore.length > 0) {
      console.log('Sample tickets before update:');
      productionTicketsBefore.slice(0, 3).forEach((ticket: TicketDocument, index) => {
        console.log(`  ${index + 1}. ID: ${ticket._id}, Status: ${ticket.status}, ParentPackageId: ${ticket.details?.parentPackageId}, PackageExpansion: ${ticket.details?.packageExpansion}`);
      });
    }

    // Perform the update
    const productionUpdateResult = await productionTicketsCollection.updateMany(
      productionQuery,
      { 
        $set: { 
          status: 'sold',
          updatedAt: new Date()
        } 
      }
    );

    console.log(`Production tickets updated: ${productionUpdateResult.modifiedCount}`);

    // 3. Verify updates
    console.log('\n=== VERIFICATION ===');
    
    // Check import tickets after update
    const importTicketsAfter = await importTicketsCollection.find({
      $or: [
        { 'details.parentPackageId': { $exists: true, $ne: null } },
        { 'details.packageExpansion': true },
        { createdAt: { $gte: today } }
      ]
    }).toArray();

    console.log('\nImport tickets status distribution after update:');
    const importStatusCounts = importTicketsAfter.reduce((acc: Record<string, number>, ticket: TicketDocument) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      return acc;
    }, {});
    console.log(importStatusCounts);

    // Check production tickets after update
    const productionTicketsAfter = await productionTicketsCollection.find({
      $or: [
        { 'details.parentPackageId': { $exists: true, $ne: null } },
        { 'details.packageExpansion': true },
        { createdAt: { $gte: today } }
      ]
    }).toArray();

    console.log('\nProduction tickets status distribution after update:');
    const productionStatusCounts = productionTicketsAfter.reduce((acc: Record<string, number>, ticket: TicketDocument) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      return acc;
    }, {});
    console.log(productionStatusCounts);

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Import tickets updated: ${importUpdateResult.modifiedCount}`);
    console.log(`Production tickets updated: ${productionUpdateResult.modifiedCount}`);
    console.log(`Total tickets updated: ${importUpdateResult.modifiedCount + productionUpdateResult.modifiedCount}`);

    // Show sample of updated tickets
    if (importUpdateResult.modifiedCount > 0 || productionUpdateResult.modifiedCount > 0) {
      console.log('\nSample of updated tickets:');
      
      const updatedImportTickets = await importTicketsCollection.find({
        status: 'sold',
        $or: [
          { 'details.parentPackageId': { $exists: true, $ne: null } },
          { 'details.packageExpansion': true },
          { createdAt: { $gte: today } }
        ]
      }).limit(3).toArray();

      updatedImportTickets.forEach((ticket: TicketDocument, index) => {
        console.log(`  Import ${index + 1}. ID: ${ticket._id}, Status: ${ticket.status}, ParentPackageId: ${ticket.details?.parentPackageId}`);
      });

      const updatedProductionTickets = await productionTicketsCollection.find({
        status: 'sold',
        $or: [
          { 'details.parentPackageId': { $exists: true, $ne: null } },
          { 'details.packageExpansion': true },
          { createdAt: { $gte: today } }
        ]
      }).limit(3).toArray();

      updatedProductionTickets.forEach((ticket: TicketDocument, index) => {
        console.log(`  Production ${index + 1}. ID: ${ticket._id}, Status: ${ticket.status}, ParentPackageId: ${ticket.details?.parentPackageId}`);
      });
    }

  } catch (error) {
    console.error('Error updating ticket status:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\nMongoDB connection closed');
  }
}

// Execute the script
updateExpandedTicketsStatus()
  .then(() => {
    console.log('\n✅ Ticket status update completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ticket status update failed:', error);
    process.exit(1);
  });

export { updateExpandedTicketsStatus };