#!/usr/bin/env node

/**
 * Search for registration with matching payment intent ID
 * 
 * This script:
 * 1. Extracts payment intent ID from error_payment document
 * 2. Searches registrations collection for matching payment intent
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function searchPaymentIntentRegistration() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db('LodgeTix-migration-test-1');
        
        // Step 1: Extract payment intent from error_payment document
        console.log('\n=== STEP 1: Extracting Payment Intent from Error Document ===');
        const errorPaymentId = '68a09f38c18a9f49d9048751';
        console.log(`Searching for error_payment document with _id: ${errorPaymentId}`);
        
        const errorPayment = await db.collection('error_payment').findOne({
            _id: new ObjectId(errorPaymentId)
        });
        
        if (!errorPayment) {
            console.log('❌ Error payment document not found!');
            return;
        }
        
        console.log('✅ Error payment document found');
        console.log('Payment Intent from error document:', errorPayment.paymentIntent || 'NOT FOUND');
        
        const paymentIntentId = errorPayment.paymentIntent;
        if (!paymentIntentId) {
            console.log('❌ No paymentIntent field found in error document');
            return;
        }
        
        console.log(`\n=== STEP 2: Searching Registrations for Payment Intent: ${paymentIntentId} ===`);
        
        // Search for registrations with paymentIntentId field
        console.log('\n--- Searching for paymentIntentId field ---');
        const registrationsWithPaymentIntentId = await db.collection('registrations').find({
            paymentIntentId: paymentIntentId
        }).toArray();
        
        console.log(`Found ${registrationsWithPaymentIntentId.length} registrations with paymentIntentId field`);
        
        if (registrationsWithPaymentIntentId.length > 0) {
            registrationsWithPaymentIntentId.forEach((reg, index) => {
                console.log(`\nRegistration ${index + 1}:`);
                console.log(`  - ID: ${reg._id}`);
                console.log(`  - Payment Intent ID: ${reg.paymentIntentId}`);
                console.log(`  - Status: ${reg.status || 'N/A'}`);
                console.log(`  - Amount: ${reg.amount || reg.totalAmount || 'N/A'}`);
                console.log(`  - Email: ${reg.email || reg.contactEmail || 'N/A'}`);
                console.log(`  - Created: ${reg.createdAt || reg.created || 'N/A'}`);
            });
        }
        
        // Search for registrations with payment_intent_id field
        console.log('\n--- Searching for payment_intent_id field ---');
        const registrationsWithPaymentIntentIdUnderscore = await db.collection('registrations').find({
            payment_intent_id: paymentIntentId
        }).toArray();
        
        console.log(`Found ${registrationsWithPaymentIntentIdUnderscore.length} registrations with payment_intent_id field`);
        
        if (registrationsWithPaymentIntentIdUnderscore.length > 0) {
            registrationsWithPaymentIntentIdUnderscore.forEach((reg, index) => {
                console.log(`\nRegistration ${index + 1}:`);
                console.log(`  - ID: ${reg._id}`);
                console.log(`  - Payment Intent ID: ${reg.payment_intent_id}`);
                console.log(`  - Status: ${reg.status || 'N/A'}`);
                console.log(`  - Amount: ${reg.amount || reg.totalAmount || 'N/A'}`);
                console.log(`  - Email: ${reg.email || reg.contactEmail || 'N/A'}`);
                console.log(`  - Created: ${reg.createdAt || reg.created || 'N/A'}`);
            });
        }
        
        // Search for any field containing the payment intent ID (text search)
        console.log('\n--- Searching for any field containing the payment intent ID ---');
        const registrationsWithTextSearch = await db.collection('registrations').find({
            $text: { $search: paymentIntentId }
        }).toArray();
        
        console.log(`Found ${registrationsWithTextSearch.length} registrations with text search`);
        
        if (registrationsWithTextSearch.length > 0) {
            registrationsWithTextSearch.forEach((reg, index) => {
                console.log(`\nText Search Registration ${index + 1}:`);
                console.log(`  - ID: ${reg._id}`);
                console.log(`  - Status: ${reg.status || 'N/A'}`);
                console.log(`  - Amount: ${reg.amount || reg.totalAmount || 'N/A'}`);
                console.log(`  - Email: ${reg.email || reg.contactEmail || 'N/A'}`);
                console.log(`  - Created: ${reg.createdAt || reg.created || 'N/A'}`);
            });
        }
        
        // Alternative: Search using regex in all string fields
        console.log('\n--- Searching using regex in payment-related fields ---');
        const regexSearch = await db.collection('registrations').find({
            $or: [
                { paymentIntentId: { $regex: paymentIntentId, $options: 'i' } },
                { payment_intent_id: { $regex: paymentIntentId, $options: 'i' } },
                { 'payment.intentId': { $regex: paymentIntentId, $options: 'i' } },
                { 'payment.intent_id': { $regex: paymentIntentId, $options: 'i' } },
                { 'paymentDetails.intentId': { $regex: paymentIntentId, $options: 'i' } },
                { 'paymentDetails.intent_id': { $regex: paymentIntentId, $options: 'i' } }
            ]
        }).toArray();
        
        console.log(`Found ${regexSearch.length} registrations with regex search on payment fields`);
        
        if (regexSearch.length > 0) {
            regexSearch.forEach((reg, index) => {
                console.log(`\nRegex Search Registration ${index + 1}:`);
                console.log(`  - ID: ${reg._id}`);
                console.log(`  - Status: ${reg.status || 'N/A'}`);
                console.log(`  - Amount: ${reg.amount || reg.totalAmount || 'N/A'}`);
                console.log(`  - Email: ${reg.email || reg.contactEmail || 'N/A'}`);
                console.log(`  - Created: ${reg.createdAt || reg.created || 'N/A'}`);
                
                // Show which field contained the match
                if (reg.paymentIntentId && reg.paymentIntentId.includes(paymentIntentId)) {
                    console.log(`  - Match found in: paymentIntentId`);
                }
                if (reg.payment_intent_id && reg.payment_intent_id.includes(paymentIntentId)) {
                    console.log(`  - Match found in: payment_intent_id`);
                }
                if (reg.payment && reg.payment.intentId && reg.payment.intentId.includes(paymentIntentId)) {
                    console.log(`  - Match found in: payment.intentId`);
                }
                if (reg.payment && reg.payment.intent_id && reg.payment.intent_id.includes(paymentIntentId)) {
                    console.log(`  - Match found in: payment.intent_id`);
                }
                if (reg.paymentDetails && reg.paymentDetails.intentId && reg.paymentDetails.intentId.includes(paymentIntentId)) {
                    console.log(`  - Match found in: paymentDetails.intentId`);
                }
                if (reg.paymentDetails && reg.paymentDetails.intent_id && reg.paymentDetails.intent_id.includes(paymentIntentId)) {
                    console.log(`  - Match found in: paymentDetails.intent_id`);
                }
            });
        }
        
        // Summary
        console.log('\n=== SUMMARY ===');
        console.log(`Payment Intent ID: ${paymentIntentId}`);
        console.log(`Registrations found with paymentIntentId field: ${registrationsWithPaymentIntentId.length}`);
        console.log(`Registrations found with payment_intent_id field: ${registrationsWithPaymentIntentIdUnderscore.length}`);
        console.log(`Registrations found with text search: ${registrationsWithTextSearch.length}`);
        console.log(`Registrations found with regex search: ${regexSearch.length}`);
        
        const totalUniqueMatches = new Set([
            ...registrationsWithPaymentIntentId.map(r => r._id.toString()),
            ...registrationsWithPaymentIntentIdUnderscore.map(r => r._id.toString()),
            ...registrationsWithTextSearch.map(r => r._id.toString()),
            ...regexSearch.map(r => r._id.toString())
        ]).size;
        
        console.log(`Total unique registrations found: ${totalUniqueMatches}`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

// Run the search
searchPaymentIntentRegistration().catch(console.error);