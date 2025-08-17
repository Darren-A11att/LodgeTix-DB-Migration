#!/usr/bin/env node

/**
 * Search for registration with specific payment intent ID
 * Using provided payment intent: pi_3RZInfHDfNBUEWUu0BQQrnLx
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function searchRegistrationByPaymentIntent() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db('LodgeTix-migration-test-1');
        const paymentIntentId = 'pi_3RZInfHDfNBUEWUu0BQQrnLx';
        
        console.log(`\n=== SEARCHING FOR PAYMENT INTENT: ${paymentIntentId} ===`);
        
        // Search for registrations with paymentIntentId field
        console.log('\n--- 1. Searching for paymentIntentId field ---');
        const registrationsWithPaymentIntentId = await db.collection('registrations').find({
            paymentIntentId: paymentIntentId
        }).toArray();
        
        console.log(`Found ${registrationsWithPaymentIntentId.length} registrations with paymentIntentId field`);
        
        if (registrationsWithPaymentIntentId.length > 0) {
            registrationsWithPaymentIntentId.forEach((reg, index) => {
                console.log(`\n✅ Registration ${index + 1} (paymentIntentId field):`);
                console.log(`  - ID: ${reg._id}`);
                console.log(`  - Payment Intent ID: ${reg.paymentIntentId}`);
                console.log(`  - Status: ${reg.status || 'N/A'}`);
                console.log(`  - Amount: ${reg.amount || reg.totalAmount || 'N/A'}`);
                console.log(`  - Email: ${reg.email || reg.contactEmail || 'N/A'}`);
                console.log(`  - Created: ${reg.createdAt || reg.created || 'N/A'}`);
                console.log(`  - Event ID: ${reg.eventId || 'N/A'}`);
                console.log(`  - Registration Status: ${reg.registrationStatus || 'N/A'}`);
            });
        }
        
        // Search for registrations with payment_intent_id field
        console.log('\n--- 2. Searching for payment_intent_id field ---');
        const registrationsWithPaymentIntentIdUnderscore = await db.collection('registrations').find({
            payment_intent_id: paymentIntentId
        }).toArray();
        
        console.log(`Found ${registrationsWithPaymentIntentIdUnderscore.length} registrations with payment_intent_id field`);
        
        if (registrationsWithPaymentIntentIdUnderscore.length > 0) {
            registrationsWithPaymentIntentIdUnderscore.forEach((reg, index) => {
                console.log(`\n✅ Registration ${index + 1} (payment_intent_id field):`);
                console.log(`  - ID: ${reg._id}`);
                console.log(`  - Payment Intent ID: ${reg.payment_intent_id}`);
                console.log(`  - Status: ${reg.status || 'N/A'}`);
                console.log(`  - Amount: ${reg.amount || reg.totalAmount || 'N/A'}`);
                console.log(`  - Email: ${reg.email || reg.contactEmail || 'N/A'}`);
                console.log(`  - Created: ${reg.createdAt || reg.created || 'N/A'}`);
                console.log(`  - Event ID: ${reg.eventId || 'N/A'}`);
                console.log(`  - Registration Status: ${reg.registrationStatus || 'N/A'}`);
            });
        }
        
        // Search using regex in nested payment objects
        console.log('\n--- 3. Searching in nested payment objects ---');
        const nestedSearch = await db.collection('registrations').find({
            $or: [
                { 'payment.intentId': paymentIntentId },
                { 'payment.intent_id': paymentIntentId },
                { 'payment.paymentIntentId': paymentIntentId },
                { 'paymentDetails.intentId': paymentIntentId },
                { 'paymentDetails.intent_id': paymentIntentId },
                { 'paymentDetails.paymentIntentId': paymentIntentId },
                { 'stripe.paymentIntentId': paymentIntentId },
                { 'stripe.intent_id': paymentIntentId }
            ]
        }).toArray();
        
        console.log(`Found ${nestedSearch.length} registrations with nested payment intent ID`);
        
        if (nestedSearch.length > 0) {
            nestedSearch.forEach((reg, index) => {
                console.log(`\n✅ Registration ${index + 1} (nested payment object):`);
                console.log(`  - ID: ${reg._id}`);
                console.log(`  - Status: ${reg.status || 'N/A'}`);
                console.log(`  - Amount: ${reg.amount || reg.totalAmount || 'N/A'}`);
                console.log(`  - Email: ${reg.email || reg.contactEmail || 'N/A'}`);
                console.log(`  - Created: ${reg.createdAt || reg.created || 'N/A'}`);
                console.log(`  - Event ID: ${reg.eventId || 'N/A'}`);
                
                // Show which nested field contained the match
                if (reg.payment) {
                    if (reg.payment.intentId === paymentIntentId) console.log(`  - Match found in: payment.intentId`);
                    if (reg.payment.intent_id === paymentIntentId) console.log(`  - Match found in: payment.intent_id`);
                    if (reg.payment.paymentIntentId === paymentIntentId) console.log(`  - Match found in: payment.paymentIntentId`);
                }
                if (reg.paymentDetails) {
                    if (reg.paymentDetails.intentId === paymentIntentId) console.log(`  - Match found in: paymentDetails.intentId`);
                    if (reg.paymentDetails.intent_id === paymentIntentId) console.log(`  - Match found in: paymentDetails.intent_id`);
                    if (reg.paymentDetails.paymentIntentId === paymentIntentId) console.log(`  - Match found in: paymentDetails.paymentIntentId`);
                }
                if (reg.stripe) {
                    if (reg.stripe.paymentIntentId === paymentIntentId) console.log(`  - Match found in: stripe.paymentIntentId`);
                    if (reg.stripe.intent_id === paymentIntentId) console.log(`  - Match found in: stripe.intent_id`);
                }
            });
        }
        
        // Search using regex to find partial matches or any reference
        console.log('\n--- 4. Searching with regex for any reference ---');
        const regexSearch = await db.collection('registrations').find({
            $or: [
                { paymentIntentId: { $regex: paymentIntentId, $options: 'i' } },
                { payment_intent_id: { $regex: paymentIntentId, $options: 'i' } },
                { 'payment.intentId': { $regex: paymentIntentId, $options: 'i' } },
                { 'payment.intent_id': { $regex: paymentIntentId, $options: 'i' } },
                { 'payment.paymentIntentId': { $regex: paymentIntentId, $options: 'i' } },
                { 'paymentDetails.intentId': { $regex: paymentIntentId, $options: 'i' } },
                { 'paymentDetails.intent_id': { $regex: paymentIntentId, $options: 'i' } },
                { 'paymentDetails.paymentIntentId': { $regex: paymentIntentId, $options: 'i' } },
                { 'stripe.paymentIntentId': { $regex: paymentIntentId, $options: 'i' } },
                { 'stripe.intent_id': { $regex: paymentIntentId, $options: 'i' } }
            ]
        }).toArray();
        
        console.log(`Found ${regexSearch.length} registrations with regex search`);
        
        if (regexSearch.length > 0) {
            regexSearch.forEach((reg, index) => {
                console.log(`\n✅ Registration ${index + 1} (regex match):`);
                console.log(`  - ID: ${reg._id}`);
                console.log(`  - Status: ${reg.status || 'N/A'}`);
                console.log(`  - Amount: ${reg.amount || reg.totalAmount || 'N/A'}`);
                console.log(`  - Email: ${reg.email || reg.contactEmail || 'N/A'}`);
                console.log(`  - Created: ${reg.createdAt || reg.created || 'N/A'}`);
                console.log(`  - Event ID: ${reg.eventId || 'N/A'}`);
            });
        }
        
        // Search in other relevant collections
        console.log('\n--- 5. Searching in other collections ---');
        
        // Search in payments collection
        const paymentsWithIntent = await db.collection('payments').find({
            $or: [
                { paymentIntentId: paymentIntentId },
                { payment_intent_id: paymentIntentId },
                { intentId: paymentIntentId },
                { intent_id: paymentIntentId }
            ]
        }).toArray();
        
        console.log(`Found ${paymentsWithIntent.length} payments with this payment intent`);
        
        if (paymentsWithIntent.length > 0) {
            paymentsWithIntent.forEach((payment, index) => {
                console.log(`\n💰 Payment ${index + 1}:`);
                console.log(`  - ID: ${payment._id}`);
                console.log(`  - Amount: ${payment.amount || 'N/A'}`);
                console.log(`  - Status: ${payment.status || 'N/A'}`);
                console.log(`  - Registration ID: ${payment.registrationId || 'N/A'}`);
                console.log(`  - Created: ${payment.createdAt || payment.created || 'N/A'}`);
            });
        }
        
        // Search in stripe_payments collection
        const stripePaymentsWithIntent = await db.collection('stripe_payments').find({
            $or: [
                { paymentIntentId: paymentIntentId },
                { payment_intent_id: paymentIntentId },
                { intentId: paymentIntentId },
                { intent_id: paymentIntentId },
                { 'paymentIntent.id': paymentIntentId }
            ]
        }).toArray();
        
        console.log(`Found ${stripePaymentsWithIntent.length} stripe payments with this payment intent`);
        
        if (stripePaymentsWithIntent.length > 0) {
            stripePaymentsWithIntent.forEach((payment, index) => {
                console.log(`\n💳 Stripe Payment ${index + 1}:`);
                console.log(`  - ID: ${payment._id}`);
                console.log(`  - Amount: ${payment.amount || 'N/A'}`);
                console.log(`  - Status: ${payment.status || 'N/A'}`);
                console.log(`  - Registration ID: ${payment.registrationId || 'N/A'}`);
                console.log(`  - Created: ${payment.createdAt || payment.created || 'N/A'}`);
            });
        }
        
        // Summary
        console.log('\n=== SUMMARY REPORT ===');
        console.log(`Payment Intent ID: ${paymentIntentId}`);
        console.log(`Registrations found with paymentIntentId field: ${registrationsWithPaymentIntentId.length}`);
        console.log(`Registrations found with payment_intent_id field: ${registrationsWithPaymentIntentIdUnderscore.length}`);
        console.log(`Registrations found with nested payment objects: ${nestedSearch.length}`);
        console.log(`Registrations found with regex search: ${regexSearch.length}`);
        console.log(`Payments found with this intent: ${paymentsWithIntent.length}`);
        console.log(`Stripe payments found with this intent: ${stripePaymentsWithIntent.length}`);
        
        const allRegistrationMatches = [
            ...registrationsWithPaymentIntentId,
            ...registrationsWithPaymentIntentIdUnderscore,
            ...nestedSearch,
            ...regexSearch
        ];
        
        const uniqueRegistrationIds = new Set(allRegistrationMatches.map(r => r._id.toString()));
        
        console.log(`Total unique registrations found: ${uniqueRegistrationIds.size}`);
        
        if (uniqueRegistrationIds.size === 0) {
            console.log('\n❌ NO REGISTRATIONS FOUND with the specified payment intent ID');
        } else {
            console.log('\n✅ REGISTRATIONS FOUND with the specified payment intent ID');
            console.log('Field names where payment intent was found:');
            
            const fieldNames = new Set();
            if (registrationsWithPaymentIntentId.length > 0) fieldNames.add('paymentIntentId');
            if (registrationsWithPaymentIntentIdUnderscore.length > 0) fieldNames.add('payment_intent_id');
            if (nestedSearch.length > 0) fieldNames.add('nested payment objects');
            
            fieldNames.forEach(field => console.log(`  - ${field}`));
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

// Run the search
searchRegistrationByPaymentIntent().catch(console.error);