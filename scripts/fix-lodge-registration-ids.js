const { MongoClient, ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixLodgeRegistrationIds() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== FIXING LODGE REGISTRATION IDS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const lodgesCollection = db.collection('lodges');
    
    // Find Lodge Jose Rizal No. 1045 in the lodges collection
    const lodgeJoseRizal = await lodgesCollection.findOne({
      _id: new ObjectId('685beb9eb2fa6b693adab6eb')
    });
    
    if (!lodgeJoseRizal) {
      console.log('❌ Lodge Jose Rizal No. 1045 not found in lodges collection');
      console.log('\nSearching for all lodges with "Jose Rizal" in the name...');
      
      const joseRizalLodges = await lodgesCollection.find({
        $or: [
          { name: { $regex: 'Jose Rizal', $options: 'i' } },
          { lodgeName: { $regex: 'Jose Rizal', $options: 'i' } }
        ]
      }).toArray();
      
      console.log(`Found ${joseRizalLodges.length} lodge(s):`);
      joseRizalLodges.forEach(lodge => {
        console.log(`  - ${lodge.name || lodge.lodgeName} (ID: ${lodge._id})`);
      });
      
      return;
    }
    
    console.log('Found Lodge Jose Rizal No. 1045:');
    console.log(`  MongoDB ID: ${lodgeJoseRizal._id}`);
    console.log(`  Lodge ID: ${lodgeJoseRizal.lodgeId}`);
    console.log(`  Name: ${lodgeJoseRizal.name || lodgeJoseRizal.lodgeName}`);
    console.log(`  Display Name: ${lodgeJoseRizal.displayName}`);
    console.log(`  Number: ${lodgeJoseRizal.lodgeNumber || lodgeJoseRizal.number}\n`);
    
    // Find the lodge registration we created
    const lodgeRegistration = await registrationsCollection.findOne({
      confirmationNumber: 'LDG-102908JR'
    });
    
    if (!lodgeRegistration) {
      console.log('❌ Lodge registration LDG-102908JR not found');
      return;
    }
    
    console.log('Found lodge registration LDG-102908JR');
    console.log(`  Current lodge ID: ${lodgeRegistration.registrationData.lodgeDetails.lodgeId}`);
    console.log(`  Current registration ID: ${lodgeRegistration.registrationId}\n`);
    
    // Generate new UUID v4 for registrationId if needed
    const needsNewRegistrationId = !lodgeRegistration.registrationId || 
                                   !lodgeRegistration.registrationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    
    const newRegistrationId = needsNewRegistrationId ? uuidv4() : lodgeRegistration.registrationId;
    
    // Update tickets with correct lodge ID
    const updatedTickets = lodgeRegistration.registrationData.tickets.map(ticket => ({
      ...ticket,
      ownerId: lodgeJoseRizal.lodgeId,
      eventTicketId: ticket.eventTicketId && !ticket.eventTicketId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) 
        ? uuidv4() 
        : ticket.eventTicketId
    }));
    
    // Prepare update
    const updateData = {
      'registrationData.lodgeDetails.lodgeId': lodgeJoseRizal.lodgeId,
      'registrationData.tickets': updatedTickets,
      'organisationId': lodgeJoseRizal.organisationId || lodgeJoseRizal.lodgeId,
      updatedAt: new Date()
    };
    
    if (needsNewRegistrationId) {
      updateData.registrationId = newRegistrationId;
    }
    
    console.log('=== UPDATING REGISTRATION ===\n');
    console.log('Updates to apply:');
    console.log(`  Lodge ID: ${lodgeRegistration.registrationData.lodgeDetails.lodgeId} → ${lodgeJoseRizal.lodgeId}`);
    if (needsNewRegistrationId) {
      console.log(`  Registration ID: ${lodgeRegistration.registrationId} → ${newRegistrationId}`);
    }
    console.log(`  Ticket owner IDs: All set to ${lodgeJoseRizal.lodgeId}`);
    console.log(`  Organisation ID: Set to ${lodgeJoseRizal.organisationId || lodgeJoseRizal.lodgeId}`);
    console.log(`  Number of tickets to update: ${updatedTickets.length}\n`);
    
    // Apply update
    const result = await registrationsCollection.updateOne(
      { _id: lodgeRegistration._id },
      { $set: updateData }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Successfully updated lodge registration\n');
      
      // Verify the update
      const updatedReg = await registrationsCollection.findOne({ _id: lodgeRegistration._id });
      
      console.log('=== VERIFICATION ===\n');
      console.log('Updated registration:');
      console.log(`  Registration ID: ${updatedReg.registrationId}`);
      console.log(`  Lodge ID: ${updatedReg.registrationData.lodgeDetails.lodgeId}`);
      console.log(`  Organisation ID: ${updatedReg.organisationId}`);
      console.log(`  First ticket owner ID: ${updatedReg.registrationData.tickets[0]?.ownerId}`);
      
      // Verify all tickets have correct owner ID
      const allTicketsCorrect = updatedReg.registrationData.tickets.every(
        ticket => ticket.ownerId === lodgeJoseRizal.lodgeId
      );
      
      console.log(`  All tickets have correct owner ID: ${allTicketsCorrect ? '✅' : '❌'}`);
      
      // Check if IDs are valid UUID v4
      const isValidUUID = (id) => {
        return id && typeof id === 'string' && id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      };
      
      console.log(`\n=== UUID VALIDATION ===`);
      console.log(`  Registration ID is valid UUID v4: ${isValidUUID(updatedReg.registrationId) ? '✅' : '❌'}`);
      console.log(`  Lodge ID is valid UUID v4: ${isValidUUID(updatedReg.registrationData.lodgeDetails.lodgeId) ? '✅' : '❌'}`);
      console.log(`  Organisation ID is valid UUID v4: ${isValidUUID(updatedReg.organisationId) ? '✅' : '❌'}`);
      
    } else {
      console.log('❌ No changes were made to the registration');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the fix
fixLodgeRegistrationIds();