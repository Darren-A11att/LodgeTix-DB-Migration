#!/usr/bin/env node

/**
 * Comprehensive search for payment intent across all collections
 * Payment intent: pi_3RZInfHDfNBUEWUu0BQQrnLx
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function comprehensivePaymentIntentSearch() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db('LodgeTix-migration-test-1');
        const paymentIntentId = 'pi_3RZInfHDfNBUEWUu0BQQrnLx';
        
        console.log(`\n=== COMPREHENSIVE SEARCH FOR PAYMENT INTENT: ${paymentIntentId} ===`);
        
        // Get all collections
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        console.log(`\nSearching across ${collectionNames.length} collections...`);
        
        let totalMatches = 0;
        const matchDetails = [];
        
        // Search in all payment-related collections with more comprehensive queries
        const paymentCollections = [
            'payments_unified_final',
            'stripe_payments_flat', 
            'stripe_payments',
            'square_payments_flat',
            'square_payments',
            'unified_payments',
            'payments',
            'payment_imports',
            'registrations',
            'rawRegistrations',
            'failedRegistrations'
        ];
        
        for (const collectionName of paymentCollections) {
            if (!collectionNames.includes(collectionName)) {
                console.log(`⏭️  Collection ${collectionName} not found, skipping...`);
                continue;
            }
            
            console.log(`\n🔍 Searching in: ${collectionName}`);
            
            try {
                // Comprehensive search across many possible field names
                const matches = await db.collection(collectionName).find({
                    $or: [
                        // Direct matches
                        { paymentIntentId: paymentIntentId },
                        { payment_intent_id: paymentIntentId },
                        { intentId: paymentIntentId },
                        { intent_id: paymentIntentId },
                        { paymentIntent: paymentIntentId },
                        { payment_intent: paymentIntentId },
                        
                        // Nested object searches
                        { 'payment.intentId': paymentIntentId },
                        { 'payment.intent_id': paymentIntentId },
                        { 'payment.paymentIntentId': paymentIntentId },
                        { 'payment.paymentIntent': paymentIntentId },
                        { 'paymentDetails.intentId': paymentIntentId },
                        { 'paymentDetails.intent_id': paymentIntentId },
                        { 'paymentDetails.paymentIntentId': paymentIntentId },
                        { 'paymentDetails.paymentIntent': paymentIntentId },
                        { 'stripe.paymentIntentId': paymentIntentId },
                        { 'stripe.intent_id': paymentIntentId },
                        { 'stripe.paymentIntent': paymentIntentId },
                        { 'paymentIntent.id': paymentIntentId },
                        { 'intent.id': paymentIntentId },
                        
                        // Regex searches for partial matches
                        { paymentIntentId: { $regex: paymentIntentId, $options: 'i' } },
                        { payment_intent_id: { $regex: paymentIntentId, $options: 'i' } },
                        { intentId: { $regex: paymentIntentId, $options: 'i' } },
                        { intent_id: { $regex: paymentIntentId, $options: 'i' } },
                        { paymentIntent: { $regex: paymentIntentId, $options: 'i' } },
                        { payment_intent: { $regex: paymentIntentId, $options: 'i' } }
                    ]
                }).toArray();
                
                if (matches.length > 0) {
                    console.log(`  ✅ Found ${matches.length} matches`);
                    totalMatches += matches.length;
                    
                    matches.forEach((match, index) => {
                        console.log(`\n  📄 Match ${index + 1}:`);
                        console.log(`    - ID: ${match._id}`);
                        console.log(`    - Collection: ${collectionName}`);
                        
                        // Check which field(s) contained the payment intent
                        const fields = [];
                        if (match.paymentIntentId === paymentIntentId) fields.push('paymentIntentId');
                        if (match.payment_intent_id === paymentIntentId) fields.push('payment_intent_id');
                        if (match.intentId === paymentIntentId) fields.push('intentId');
                        if (match.intent_id === paymentIntentId) fields.push('intent_id');
                        if (match.paymentIntent === paymentIntentId) fields.push('paymentIntent');
                        if (match.payment_intent === paymentIntentId) fields.push('payment_intent');
                        
                        // Check nested fields
                        if (match.payment) {
                            if (match.payment.intentId === paymentIntentId) fields.push('payment.intentId');
                            if (match.payment.intent_id === paymentIntentId) fields.push('payment.intent_id');
                            if (match.payment.paymentIntentId === paymentIntentId) fields.push('payment.paymentIntentId');
                            if (match.payment.paymentIntent === paymentIntentId) fields.push('payment.paymentIntent');
                        }
                        if (match.paymentDetails) {
                            if (match.paymentDetails.intentId === paymentIntentId) fields.push('paymentDetails.intentId');
                            if (match.paymentDetails.intent_id === paymentIntentId) fields.push('paymentDetails.intent_id');
                            if (match.paymentDetails.paymentIntentId === paymentIntentId) fields.push('paymentDetails.paymentIntentId');
                            if (match.paymentDetails.paymentIntent === paymentIntentId) fields.push('paymentDetails.paymentIntent');
                        }
                        if (match.stripe) {
                            if (match.stripe.paymentIntentId === paymentIntentId) fields.push('stripe.paymentIntentId');
                            if (match.stripe.intent_id === paymentIntentId) fields.push('stripe.intent_id');
                            if (match.stripe.paymentIntent === paymentIntentId) fields.push('stripe.paymentIntent');
                        }
                        
                        console.log(`    - Fields with payment intent: ${fields.join(', ') || 'Found via regex'}`);
                        console.log(`    - Status: ${match.status || match.registrationStatus || 'N/A'}`);
                        console.log(`    - Amount: ${match.amount || match.totalAmount || 'N/A'}`);
                        console.log(`    - Email: ${match.email || match.contactEmail || 'N/A'}`);
                        console.log(`    - Created: ${match.createdAt || match.created || 'N/A'}`);
                        
                        if (collectionName === 'registrations') {
                            console.log(`    - Event ID: ${match.eventId || 'N/A'}`);
                            console.log(`    - Registration Status: ${match.registrationStatus || 'N/A'}`);
                        }
                        
                        matchDetails.push({
                            collection: collectionName,
                            id: match._id,
                            fields: fields,
                            document: match
                        });
                    });
                } else {
                    console.log(`  ❌ No matches found`);
                }
                
            } catch (error) {
                console.log(`  ⚠️  Error searching ${collectionName}: ${error.message}`);
            }
        }
        
        // Also perform a text search across all collections if no matches found
        if (totalMatches === 0) {
            console.log(`\n🔍 Performing text search across all collections...`);
            
            for (const collectionName of collectionNames) {
                try {
                    // Check if collection has text index
                    const indexes = await db.collection(collectionName).indexes();
                    const hasTextIndex = indexes.some(idx => idx.key && idx.key._fts === 'text');
                    
                    if (hasTextIndex) {
                        const textMatches = await db.collection(collectionName).find({
                            $text: { $search: paymentIntentId }
                        }).toArray();
                        
                        if (textMatches.length > 0) {
                            console.log(`  ✅ Text search found ${textMatches.length} matches in ${collectionName}`);
                            textMatches.forEach((match, index) => {
                                console.log(`    📄 Text Match ${index + 1}: ${match._id}`);
                            });
                        }
                    }
                } catch (error) {
                    // Skip collections without text index or other errors
                    continue;
                }
            }
        }
        
        // Final report
        console.log('\n=== FINAL REPORT ===');
        console.log(`Payment Intent ID searched: ${paymentIntentId}`);
        console.log(`Total matches found: ${totalMatches}`);
        console.log(`Collections searched: ${paymentCollections.filter(c => collectionNames.includes(c)).length}`);
        
        if (totalMatches > 0) {
            console.log('\n✅ MATCHES FOUND:');
            const collectionSummary = {};
            matchDetails.forEach(match => {
                if (!collectionSummary[match.collection]) {
                    collectionSummary[match.collection] = 0;
                }
                collectionSummary[match.collection]++;
            });
            
            Object.entries(collectionSummary).forEach(([collection, count]) => {
                console.log(`  - ${collection}: ${count} match(es)`);
            });
            
            console.log('\nField names where payment intent was found:');
            const allFields = new Set();
            matchDetails.forEach(match => {
                match.fields.forEach(field => allFields.add(field));
            });
            allFields.forEach(field => console.log(`  - ${field}`));
            
        } else {
            console.log('\n❌ NO MATCHES FOUND');
            console.log('The payment intent ID pi_3RZInfHDfNBUEWUu0BQQrnLx was not found in any collection.');
            console.log('This could mean:');
            console.log('  1. The payment intent does not exist in this database');
            console.log('  2. It exists with a different field name not covered by our search');
            console.log('  3. It exists in a different database');
            console.log('  4. The original error document was from a different database');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

// Run the comprehensive search
comprehensivePaymentIntentSearch().catch(console.error);