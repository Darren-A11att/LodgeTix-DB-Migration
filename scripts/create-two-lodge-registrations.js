#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function createTwoLodgeRegistrations() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('LodgeTix-migration-test-1');
    const lodges = db.collection('lodges');
    const registrations = db.collection('registrations');

    // Look up the lodges
    console.log('=== LOOKING UP LODGE DETAILS ===\n');

    // Search for Jerusalem lodge (various possible spellings)
    const jerusalemLodge = await lodges.findOne({
      $or: [
        { name: { $regex: /jerusalem/i } },
        { lodgeName: { $regex: /jerusalem/i } },
        { name: { $regex: /juruselem/i } },
        { lodgeName: { $regex: /juruselem/i } }
      ]
    });

    console.log('Jerusalem Lodge:');
    if (jerusalemLodge) {
      console.log(`- Name: ${jerusalemLodge.name || jerusalemLodge.lodgeName}`);
      console.log(`- Number: ${jerusalemLodge.lodgeNumber || jerusalemLodge.number}`);
      console.log(`- ID: ${jerusalemLodge.lodgeId || jerusalemLodge._id}`);
    } else {
      console.log('- NOT FOUND');
    }

    // Search for Mark Owen lodge
    const markOwenLodge = await lodges.findOne({
      $or: [
        { name: { $regex: /mark owen/i } },
        { lodgeName: { $regex: /mark owen/i } }
      ]
    });

    console.log('\nMark Owen Lodge:');
    if (markOwenLodge) {
      console.log(`- Name: ${markOwenLodge.name || markOwenLodge.lodgeName}`);
      console.log(`- Number: ${markOwenLodge.lodgeNumber || markOwenLodge.number}`);
      console.log(`- ID: ${markOwenLodge.lodgeId || markOwenLodge._id}`);
    } else {
      console.log('- NOT FOUND');
    }

    // Generate confirmation numbers
    const generateConfirmationNumber = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const nums = '0123456789';
      let code = 'LDG-';
      for (let i = 0; i < 6; i++) {
        code += nums.charAt(Math.floor(Math.random() * nums.length));
      }
      for (let i = 0; i < 2; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    const now = new Date();
    const functionId = 'eebddef5-6833-43e3-8d32-700508b1c089'; // Grand Proclamation 2025

    // Create Jerusalem registration
    const jerusalemRegistration = {
      registrationId: uuidv4(),
      confirmationNumber: generateConfirmationNumber(),
      registrationType: 'lodge',
      functionId: functionId,
      registrationData: {
        lodgeDetails: {
          lodgeId: jerusalemLodge?.lodgeId || jerusalemLodge?._id || uuidv4(),
          lodgeName: jerusalemLodge?.name || jerusalemLodge?.lodgeName || 'Lodge Jerusalem',
          lodgeNumber: jerusalemLodge?.lodgeNumber || jerusalemLodge?.number || ''
        },
        bookingContact: {
          firstName: 'Rod',
          lastName: 'Cohen',
          emailAddress: 'rod@cohenco.com.au',
          phone: '041426616',
          mobileNumber: '+61414266166',
          businessName: jerusalemLodge?.name || jerusalemLodge?.lodgeName || 'Lodge Jerusalem',
          addressLine1: 'P.O Box 206',
          addressLine2: '',
          city: 'BONDI JUNCTION',
          stateProvince: 'New South Wales',
          postalCode: '1355',
          country: 'AU'
        },
        tickets: [
          {
            eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216',
            name: 'Proclamation Banquet - Best Available',
            price: 115,
            quantity: 10,
            ownerType: 'lodge',
            ownerId: jerusalemLodge?.lodgeId || jerusalemLodge?._id || uuidv4(),
            status: 'sold'
          }
        ],
        packageDetails: {
          packageCount: 1,
          itemsPerPackage: 10
        },
        totalAmount: 1150,
        subtotal: 1150
      },
      totalAmountPaid: 0, // To be paid
      totalPricePaid: 1150,
      paymentStatus: 'pending',
      status: 'pending',
      organisationName: jerusalemLodge?.name || jerusalemLodge?.lodgeName || 'Lodge Jerusalem',
      organisationId: jerusalemLodge?.lodgeId || jerusalemLodge?._id || uuidv4(),
      createdAt: now,
      updatedAt: now,
      registrationDate: now,
      importedAt: now,
      importSource: 'manual-creation',
      metadata: {
        createdBy: 'create-two-lodge-registrations',
        createdFor: 'Jerusalem lodge registration with 10 Proclamation Banquet tickets',
        requestedBy: 'user',
        createdAt: now
      }
    };

    // Create Mark Owen registration
    const markOwenRegistration = {
      registrationId: uuidv4(),
      confirmationNumber: generateConfirmationNumber(),
      registrationType: 'lodge',
      functionId: functionId,
      registrationData: {
        lodgeDetails: {
          lodgeId: markOwenLodge?.lodgeId || markOwenLodge?._id || uuidv4(),
          lodgeName: markOwenLodge?.name || markOwenLodge?.lodgeName || 'Lodge Mark Owen',
          lodgeNumber: markOwenLodge?.lodgeNumber || markOwenLodge?.number || ''
        },
        bookingContact: {
          firstName: 'Joshua',
          lastName: 'Newman',
          emailAddress: 'jjsnewman@gmail.com',
          phone: '',
          businessName: markOwenLodge?.name || markOwenLodge?.lodgeName || 'Lodge Mark Owen'
        },
        tickets: [
          {
            eventTicketId: 'fd12d7f0-f346-49bf-b1eb-0682ad226216',
            name: 'Proclamation Banquet - Best Available',
            price: 115,
            quantity: 10,
            ownerType: 'lodge',
            ownerId: markOwenLodge?.lodgeId || markOwenLodge?._id || uuidv4(),
            status: 'sold'
          }
        ],
        packageDetails: {
          packageCount: 1,
          itemsPerPackage: 10
        },
        totalAmount: 1150,
        subtotal: 1150
      },
      totalAmountPaid: 0, // To be paid
      totalPricePaid: 1150,
      paymentStatus: 'pending',
      status: 'pending',
      organisationName: markOwenLodge?.name || markOwenLodge?.lodgeName || 'Lodge Mark Owen',
      organisationId: markOwenLodge?.lodgeId || markOwenLodge?._id || uuidv4(),
      createdAt: now,
      updatedAt: now,
      registrationDate: now,
      importedAt: now,
      importSource: 'manual-creation',
      metadata: {
        createdBy: 'create-two-lodge-registrations',
        createdFor: 'Mark Owen lodge registration with 10 Proclamation Banquet tickets',
        requestedBy: 'user',
        createdAt: now
      }
    };

    // Insert the registrations
    console.log('\n=== CREATING REGISTRATIONS ===\n');

    const jerusalemResult = await registrations.insertOne(jerusalemRegistration);
    console.log(`Jerusalem Lodge Registration:`);
    console.log(`- Confirmation: ${jerusalemRegistration.confirmationNumber}`);
    console.log(`- Registration ID: ${jerusalemRegistration.registrationId}`);
    console.log(`- Lodge: ${jerusalemRegistration.organisationName}`);
    console.log(`- Contact: Rod Cohen (rod@cohenco.com.au)`);
    console.log(`- Tickets: 10 x Proclamation Banquet @ $115 = $1,150`);
    console.log(`- Status: Created ✅\n`);

    const markOwenResult = await registrations.insertOne(markOwenRegistration);
    console.log(`Mark Owen Lodge Registration:`);
    console.log(`- Confirmation: ${markOwenRegistration.confirmationNumber}`);
    console.log(`- Registration ID: ${markOwenRegistration.registrationId}`);
    console.log(`- Lodge: ${markOwenRegistration.organisationName}`);
    console.log(`- Contact: Joshua Newman (jjsnewman@gmail.com)`);
    console.log(`- Tickets: 10 x Proclamation Banquet @ $115 = $1,150`);
    console.log(`- Status: Created ✅`);

    // Verify new total
    console.log('\n=== VERIFICATION: NEW PROCLAMATION BANQUET TOTAL ===');
    const banquetCount = await registrations.aggregate([
      { $unwind: '$registrationData.tickets' },
      { $match: { 
        'registrationData.tickets.eventTicketId': 'fd12d7f0-f346-49bf-b1eb-0682ad226216',
        'registrationData.tickets.status': 'sold'
      }},
      { $group: {
        _id: null,
        totalQuantity: { $sum: '$registrationData.tickets.quantity' },
        registrationCount: { $sum: 1 }
      }}
    ]).toArray();

    if (banquetCount.length > 0) {
      console.log(`Total Proclamation Banquet tickets: ${banquetCount[0].totalQuantity}`);
      console.log(`From ${banquetCount[0].registrationCount} registrations`);
      console.log(`\nPrevious: 446 tickets`);
      console.log(`Added: 20 tickets (2 lodges × 10 tickets)`);
      console.log(`Expected new total: 466 tickets`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the creation
createTwoLodgeRegistrations().catch(console.error);