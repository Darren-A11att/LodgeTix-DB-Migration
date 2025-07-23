const { MongoClient } = require('mongodb');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function importFoundRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    console.log('=== IMPORTING FOUND REGISTRATIONS ===\n');
    
    const registrationsCollection = db.collection('registrations');
    const transactionsCollection = db.collection('squareTransactions');
    
    // The found registrations from our search
    const foundRegistrations = [
      { paymentId: 'bbt1J0xMeBdB1GXNakdpciUyx6FZY', confirmationNumber: 'IND-991563YW' },
      { paymentId: 'DjHXcnzNvuuZVVGxdUe9PXWraYJZY', confirmationNumber: 'IND-241525JY' },
      { paymentId: 'Pdbu7w9Ia2VEdeu2lhuZEBVvhzfZY', confirmationNumber: 'IND-176449HG' }
    ];
    
    for (const found of foundRegistrations) {
      console.log(`\nProcessing ${found.confirmationNumber} (Payment: ${found.paymentId})`);
      
      // Check if already exists in MongoDB
      const existingReg = await registrationsCollection.findOne({
        confirmationNumber: found.confirmationNumber
      });
      
      if (existingReg) {
        console.log('✅ Already exists in MongoDB');
        
        // Update the payment ID if needed
        if (existingReg.squarePaymentId !== found.paymentId) {
          await registrationsCollection.updateOne(
            { _id: existingReg._id },
            { 
              $set: { 
                squarePaymentId: found.paymentId,
                updatedAt: new Date()
              }
            }
          );
          console.log('✅ Updated payment ID');
        }
        continue;
      }
      
      // Fetch from Supabase
      const { data: registration, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('confirmation_number', found.confirmationNumber)
        .single();
      
      if (error || !registration) {
        console.error('❌ Failed to fetch from Supabase:', error?.message);
        continue;
      }
      
      // Transform and import
      const { v4: uuidv4 } = require('uuid');
      
      const transformedReg = {
        registrationId: registration.id || uuidv4(),
        confirmationNumber: registration.confirmation_number,
        registrationType: registration.registration_type || 'individuals',
        functionId: registration.function_id,
        status: registration.status,
        paymentStatus: registration.payment_status,
        
        // Payment info - use the Square payment ID we found
        squarePaymentId: found.paymentId,
        stripePaymentIntentId: registration.stripe_payment_intent_id,
        
        // Registration data
        registrationData: registration.registration_data || {},
        
        // Amounts
        totalAmountPaid: parseFloat(registration.total_amount_paid || 0),
        totalPricePaid: parseFloat(registration.total_price_paid || 0),
        
        // Dates
        createdAt: new Date(registration.created_at),
        updatedAt: new Date(registration.updated_at || registration.created_at),
        registrationDate: new Date(registration.registration_date || registration.created_at),
        
        // Import metadata
        importedAt: new Date(),
        importSource: 'found-registrations-import',
        metadata: {
          importedFrom: 'supabase',
          foundViaSearch: true,
          originalPaymentIdField: 'stripe_payment_intent_id'
        }
      };
      
      // Insert into MongoDB
      const result = await registrationsCollection.insertOne(transformedReg);
      
      if (result.acknowledged) {
        console.log('✅ Successfully imported to MongoDB');
        
        // Now update the squareTransaction to link it
        const updateTx = await transactionsCollection.updateOne(
          { _id: found.paymentId },
          { 
            $set: { 
              'metadata.hasRegistration': true,
              'metadata.registrationLinkedAt': new Date(),
              'metadata.registrationId': transformedReg.registrationId,
              'metadata.confirmationNumber': transformedReg.confirmationNumber
            }
          }
        );
        
        if (updateTx.modifiedCount > 0) {
          console.log('✅ Updated transaction with registration info');
        }
      }
    }
    
    // Run the enrichment for these specific transactions
    console.log('\n=== ENRICHING NEWLY LINKED TRANSACTIONS ===\n');
    
    for (const found of foundRegistrations) {
      const transaction = await transactionsCollection.findOne({ _id: found.paymentId });
      const registration = await registrationsCollection.findOne({ 
        confirmationNumber: found.confirmationNumber 
      });
      
      if (transaction && registration) {
        // Build the same registration object structure as before
        const registrationObj = {
          id: registration.registrationId || registration._id,
          confirmationNumber: registration.confirmationNumber,
          type: registration.registrationType,
          attendees: []
        };
        
        // Process attendees
        const attendees = registration.registrationData?.attendees || [];
        
        if (attendees.length > 0) {
          for (const att of attendees) {
            const attendee = {
              id: att.attendeeId || att.id || registration.registrationId + '-att',
              type: att.attendeeType || att.type || 'guest',
              details: {
                title: att.title || null,
                firstName: att.firstName || null,
                lastName: att.lastName || null,
                rank: att.rank || att.masonicRank || null,
                grandRank: att.grandRank || null,
                grandOfficer: att.grandOfficer || (att.isGrandOfficer ? true : false),
                grandOffice: att.grandOffice || null
              },
              contact: {
                preference: att.contactPreference || att.preferredContact || null,
                phone: att.phone || att.phoneNumber || null,
                email: att.email || att.emailAddress || null
              },
              relationship: {
                isPartner: att.isPartner || false,
                partnerOf: att.partnerOf || null
              },
              membership: {
                grandLodge: {
                  name: att.grandLodgeName || att.grandLodge?.name || null,
                  abbrv: att.grandLodgeAbbreviation || att.grandLodge?.abbreviation || null,
                  id: att.grandLodgeId || att.grandLodge?.id || null
                },
                lodge: {
                  lodgeNameNumber: att.lodgeNameNumber || att.lodge?.name || null,
                  id: att.lodgeId || att.lodge?.id || null
                }
              },
              catering: {
                dietaryRequirements: att.dietaryRequirements || att.dietary || null,
                specialNeeds: att.specialNeeds || att.accessibility || null
              },
              tickets: []
            };
            
            // Find tickets for this attendee
            const attendeeTickets = registration.registrationData?.tickets?.filter(
              ticket => ticket.ownerId === att.attendeeId || ticket.attendeeId === att.attendeeId
            ) || [];
            
            attendee.tickets = attendeeTickets.map(ticket => ({
              eventTicketId: ticket.eventTicketId || ticket.id,
              name: ticket.name,
              price: ticket.price,
              quantity: ticket.quantity || 1
            }));
            
            registrationObj.attendees.push(attendee);
          }
        } else if (registration.registrationData?.bookingContact) {
          // Create attendee from booking contact
          const contact = registration.registrationData.bookingContact;
          const attendee = {
            id: registration.registrationId + '-att',
            type: 'guest',
            details: {
              title: contact.title || null,
              firstName: contact.firstName || null,
              lastName: contact.lastName || null,
              rank: null,
              grandRank: null,
              grandOfficer: false,
              grandOffice: null
            },
            contact: {
              preference: null,
              phone: contact.phone || contact.phoneNumber || null,
              email: contact.email || contact.emailAddress || null
            },
            relationship: {
              isPartner: false,
              partnerOf: null
            },
            membership: {
              grandLodge: {
                name: null,
                abbrv: null,
                id: null
              },
              lodge: {
                lodgeNameNumber: null,
                id: null
              }
            },
            catering: {
              dietaryRequirements: null,
              specialNeeds: null
            },
            tickets: []
          };
          
          // Add all tickets
          const tickets = registration.registrationData?.tickets || [];
          attendee.tickets = tickets.map(ticket => ({
            eventTicketId: ticket.eventTicketId || ticket.id,
            name: ticket.name,
            price: ticket.price,
            quantity: ticket.quantity || 1
          }));
          
          registrationObj.attendees.push(attendee);
        }
        
        // Update transaction with registration data
        await transactionsCollection.updateOne(
          { _id: transaction._id },
          { 
            $set: { 
              registration: registrationObj,
              'metadata.hasRegistration': true,
              'metadata.registrationEnrichedAt': new Date()
            }
          }
        );
        
        console.log(`✅ Enriched transaction ${found.paymentId} with registration data`);
      }
    }
    
    console.log('\n=== IMPORT COMPLETE ===');
    console.log(`Processed ${foundRegistrations.length} registrations`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the import
importFoundRegistrations();