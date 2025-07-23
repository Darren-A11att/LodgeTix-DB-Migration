const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function enrichSquareTransactionsWithRegistrations() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || 'LodgeTix-migration-test-1';
  
  const mongoClient = await MongoClient.connect(uri);
  const db = mongoClient.db(dbName);
  
  try {
    console.log('=== ENRICHING SQUARE TRANSACTIONS WITH REGISTRATION DATA ===\n');
    
    const transactionsCollection = db.collection('squareTransactions');
    const registrationsCollection = db.collection('registrations');
    
    // Get all square transactions
    const transactions = await transactionsCollection.find({}).toArray();
    console.log(`Found ${transactions.length} square transactions to process\n`);
    
    let matched = 0;
    let unmatched = 0;
    let errors = 0;
    
    // Track unenriched transactions
    const unenrichedTransactions = [];
    
    for (const transaction of transactions) {
      try {
        const paymentId = transaction.payment?.id || transaction._id;
        
        // Find matching registration
        const registration = await registrationsCollection.findOne({
          $or: [
            { stripePaymentIntentId: paymentId },
            { squarePaymentId: paymentId },
            { square_payment_id: paymentId }
          ]
        });
        
        if (!registration) {
          unmatched++;
          
          // Record unenriched transaction
          unenrichedTransactions.push({
            transactionId: transaction._id,
            paymentId: paymentId,
            amount: transaction.summary?.amount ? (transaction.summary.amount / 100).toFixed(2) : 'Unknown',
            currency: transaction.summary?.currency || 'Unknown',
            customerEmail: transaction.summary?.customerEmail || transaction.customer?.email_address || 'Unknown',
            customerName: transaction.summary?.customerName || 'Unknown',
            createdAt: transaction.payment?.created_at || transaction.summary?.createdAt || 'Unknown',
            transactionType: transaction.transactionType || 'payment',
            reason: 'No matching registration found',
            searchCriteria: {
              stripePaymentIntentId: paymentId,
              squarePaymentId: paymentId,
              square_payment_id: paymentId
            },
            orderMetadata: transaction.order?.metadata || {},
            hasOrder: transaction.metadata?.hasOrder || false,
            hasCustomer: transaction.metadata?.hasCustomer || false
          });
          
          continue;
        }
        
        matched++;
        console.log(`Processing: ${paymentId} → ${registration.confirmationNumber} (${registration.registrationType})`);
        
        // Build registration object
        const registrationObj = {
          id: registration.registrationId || registration._id,
          confirmationNumber: registration.confirmationNumber,
          type: registration.registrationType,
          attendees: []
        };
        
        // Process based on registration type
        if (registration.registrationType === 'lodge') {
          // For lodge registrations, create attendees based on tickets
          const tickets = registration.registrationData?.tickets || [];
          
          tickets.forEach((ticket, index) => {
            const attendee = {
              id: uuidv4(),
              type: 'lodge',
              details: {
                title: null,
                firstName: null,
                lastName: null,
                rank: null,
                grandRank: null,
                grandOfficer: null,
                grandOffice: null
              },
              contact: {
                preference: null,
                phone: null,
                email: null
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
                  lodgeNameNumber: registration.registrationData?.lodgeDetails?.lodgeName || registration.organisationName,
                  id: registration.registrationData?.lodgeDetails?.lodgeId || registration.organisationId
                }
              },
              catering: {
                dietaryRequirements: null,
                specialNeeds: null
              },
              tickets: [{
                eventTicketId: ticket.eventTicketId,
                name: ticket.name,
                price: ticket.price,
                quantity: ticket.quantity || 1
              }]
            };
            
            registrationObj.attendees.push(attendee);
          });
          
        } else {
          // For individual registrations, process attendees
          const attendees = registration.registrationData?.attendees || [];
          
          for (const att of attendees) {
            const attendee = {
              id: att.attendeeId || att.id || uuidv4(),
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
          
          // If no attendees found, create from booking contact
          if (registrationObj.attendees.length === 0 && registration.registrationData?.bookingContact) {
            const contact = registration.registrationData.bookingContact;
            const attendee = {
              id: uuidv4(),
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
            
            // Add all tickets to this attendee
            const tickets = registration.registrationData?.tickets || [];
            attendee.tickets = tickets.map(ticket => ({
              eventTicketId: ticket.eventTicketId || ticket.id,
              name: ticket.name,
              price: ticket.price,
              quantity: ticket.quantity || 1
            }));
            
            registrationObj.attendees.push(attendee);
          }
        }
        
        // Update the transaction with registration data
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
        
      } catch (error) {
        console.error(`Error processing transaction ${transaction._id}:`, error.message);
        errors++;
        
        // Record error transaction
        unenrichedTransactions.push({
          transactionId: transaction._id,
          paymentId: transaction.payment?.id || transaction._id,
          amount: transaction.summary?.amount ? (transaction.summary.amount / 100).toFixed(2) : 'Unknown',
          currency: transaction.summary?.currency || 'Unknown',
          customerEmail: transaction.summary?.customerEmail || transaction.customer?.email_address || 'Unknown',
          customerName: transaction.summary?.customerName || 'Unknown',
          createdAt: transaction.payment?.created_at || transaction.summary?.createdAt || 'Unknown',
          transactionType: transaction.transactionType || 'payment',
          reason: 'Error during enrichment',
          error: error.message,
          orderMetadata: transaction.order?.metadata || {},
          hasOrder: transaction.metadata?.hasOrder || false,
          hasCustomer: transaction.metadata?.hasCustomer || false
        });
      }
    }
    
    console.log('\n=== ENRICHMENT COMPLETE ===\n');
    console.log(`Total transactions: ${transactions.length}`);
    console.log(`Matched with registrations: ${matched}`);
    console.log(`No matching registration: ${unmatched}`);
    console.log(`Errors: ${errors}`);
    
    // Write unenriched transactions report
    if (unenrichedTransactions.length > 0) {
      const reportPath = path.join(__dirname, 'unenriched-transactions-report.json');
      const report = {
        generatedAt: new Date().toISOString(),
        summary: {
          totalTransactions: transactions.length,
          enrichedTransactions: matched,
          unenrichedTransactions: unenrichedTransactions.length,
          errors: errors
        },
        unenrichedTransactions: unenrichedTransactions
      };
      
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Unenriched transactions report saved to: ${reportPath}`);
    }
    
    // Show some examples
    console.log('\n=== SAMPLE ENRICHED TRANSACTIONS ===\n');
    
    const enrichedSamples = await transactionsCollection.find({
      'metadata.hasRegistration': true
    }).limit(3).toArray();
    
    for (const sample of enrichedSamples) {
      console.log(`Transaction: ${sample._id}`);
      console.log(`  Registration: ${sample.registration.confirmationNumber} (${sample.registration.type})`);
      console.log(`  Attendees: ${sample.registration.attendees.length}`);
      
      if (sample.registration.attendees.length > 0) {
        const firstAttendee = sample.registration.attendees[0];
        console.log(`  First attendee:`);
        console.log(`    Type: ${firstAttendee.type}`);
        console.log(`    Name: ${firstAttendee.details.firstName} ${firstAttendee.details.lastName}`);
        console.log(`    Tickets: ${firstAttendee.tickets.length}`);
      }
      console.log('');
    }
    
    // Check Troy Quimpo's transactions
    console.log('=== TROY QUIMPO TRANSACTIONS ===\n');
    
    const troyTransactions = await transactionsCollection.find({
      $or: [
        { 'customer.email_address': 'troyquimpo@yahoo.com' },
        { 'summary.customerEmail': 'troyquimpo@yahoo.com' }
      ]
    }).toArray();
    
    for (const tx of troyTransactions) {
      console.log(`Transaction: ${tx._id}`);
      console.log(`  Amount: $${(tx.summary.amount / 100).toFixed(2)}`);
      console.log(`  Has registration: ${tx.metadata?.hasRegistration ? 'Yes' : 'No'}`);
      
      if (tx.registration) {
        console.log(`  Registration: ${tx.registration.confirmationNumber} (${tx.registration.type})`);
        console.log(`  Attendees: ${tx.registration.attendees.length}`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoClient.close();
  }
}

// Run the enrichment
enrichSquareTransactionsWithRegistrations();