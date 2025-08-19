#!/usr/bin/env node

/**
 * Verify error document and search for similar IDs or payment intent references
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function verifyErrorDocument() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db('LodgeTix-migration-test-1');
        const errorDocumentId = '68a09f38c18a9f49d9048751';
        const paymentIntentId = 'pi_3RZInfHDfNBUEWUu0BQQrnLx';
        
        console.log(`\n=== VERIFYING ERROR DOCUMENT AND PAYMENT INTENT ===`);
        console.log(`Error Document ID: ${errorDocumentId}`);
        console.log(`Payment Intent ID: ${paymentIntentId}`);
        
        // Search for documents with similar IDs
        console.log('\n--- 1. Searching for similar document IDs ---');
        const similarIdPattern = errorDocumentId.substring(0, 10); // First 10 characters
        console.log(`Looking for IDs starting with: ${similarIdPattern}`);
        
        const collections = await db.listCollections().toArray();
        
        for (const collection of collections) {
            if (collection.name.includes('error') || collection.name.includes('payment') || collection.name.includes('failed')) {
                console.log(`\n🔍 Checking ${collection.name} for similar IDs...`);
                
                try {
                    // Try both ObjectId and string searches
                    const similarDocs = await db.collection(collection.name).find({
                        $or: [
                            { _id: { $regex: `^${similarIdPattern}`, $options: 'i' } },
                            { _id: new RegExp(`^${similarIdPattern.substring(0, 8)}`) }
                        ]
                    }).limit(5).toArray();
                    
                    if (similarDocs.length > 0) {
                        console.log(`  ✅ Found ${similarDocs.length} documents with similar IDs:`);
                        similarDocs.forEach(doc => {
                            console.log(`    - ${doc._id}`);
                        });
                    } else {
                        console.log(`  ❌ No similar IDs found`);
                    }
                } catch (error) {
                    console.log(`  ⚠️  Error: ${error.message}`);
                }
            }
        }
        
        // Search for any document containing the payment intent ID anywhere
        console.log(`\n--- 2. Searching for documents containing payment intent ${paymentIntentId} ---`);
        
        for (const collection of collections) {
            console.log(`\n🔍 Text search in ${collection.name}...`);
            
            try {
                // Use aggregation with $match to find any field containing the payment intent
                const pipeline = [
                    {
                        $match: {
                            $expr: {
                                $gt: [
                                    {
                                        $size: {
                                            $filter: {
                                                input: { $objectToArray: "$$ROOT" },
                                                as: "field",
                                                cond: {
                                                    $and: [
                                                        { $eq: [{ $type: "$$field.v" }, "string"] },
                                                        { $regexMatch: { input: "$$field.v", regex: paymentIntentId, options: "i" } }
                                                    ]
                                                }
                                            }
                                        }
                                    },
                                    0
                                ]
                            }
                        }
                    },
                    { $limit: 3 }
                ];
                
                const containsDocs = await db.collection(collection.name).aggregate(pipeline).toArray();
                
                if (containsDocs.length > 0) {
                    console.log(`  ✅ Found ${containsDocs.length} documents containing the payment intent:`);
                    containsDocs.forEach(doc => {
                        console.log(`    - Document ID: ${doc._id}`);
                        console.log(`    - Collection: ${collection.name}`);
                        
                        // Find which field contains the payment intent
                        Object.entries(doc).forEach(([key, value]) => {
                            if (typeof value === 'string' && value.includes(paymentIntentId)) {
                                console.log(`    - Field "${key}": ${value}`);
                            }
                        });
                    });
                }
            } catch (error) {
                // Skip aggregation errors (not all collections support this)
                continue;
            }
        }
        
        // Search for exact payment intent in key collections
        console.log(`\n--- 3. Direct search for payment intent in key collections ---`);
        
        const keyCollections = ['registrations', 'payments', 'stripe_payments', 'payments_unified_final', 'unified_payments'];
        
        for (const collectionName of keyCollections) {
            if (collections.some(c => c.name === collectionName)) {
                console.log(`\n🔍 Deep search in ${collectionName}...`);
                
                try {
                    // Get a sample document to understand the schema
                    const sampleDoc = await db.collection(collectionName).findOne();
                    if (sampleDoc) {
                        console.log(`  📋 Sample document structure:`);
                        const keys = Object.keys(sampleDoc).slice(0, 10); // First 10 keys
                        keys.forEach(key => {
                            const value = sampleDoc[key];
                            const type = typeof value;
                            console.log(`    - ${key}: ${type} ${type === 'object' && value ? `(${Object.keys(value).slice(0, 3).join(', ')})` : ''}`);
                        });
                    }
                    
                    // Search for the payment intent in all string fields
                    const count = await db.collection(collectionName).countDocuments();
                    console.log(`  📊 Total documents in collection: ${count}`);
                    
                } catch (error) {
                    console.log(`  ⚠️  Error: ${error.message}`);
                }
            }
        }
        
        // Check if the provided payment intent format is correct
        console.log(`\n--- 4. Validating payment intent format ---`);
        console.log(`Payment Intent: ${paymentIntentId}`);
        console.log(`Format: ${paymentIntentId.startsWith('pi_') ? '✅ Valid Stripe format' : '❌ Invalid format'}`);
        console.log(`Length: ${paymentIntentId.length} characters`);
        
        // Search for any payment intents with similar pattern
        console.log(`\n--- 5. Searching for similar payment intent patterns ---`);
        
        const intentPrefix = paymentIntentId.substring(0, 10); // pi_3RZInfH
        console.log(`Looking for payment intents starting with: ${intentPrefix}`);
        
        for (const collectionName of keyCollections) {
            if (collections.some(c => c.name === collectionName)) {
                try {
                    const similarIntents = await db.collection(collectionName).find({
                        $or: [
                            { paymentIntentId: { $regex: `^${intentPrefix}`, $options: 'i' } },
                            { payment_intent_id: { $regex: `^${intentPrefix}`, $options: 'i' } },
                            { intentId: { $regex: `^${intentPrefix}`, $options: 'i' } },
                            { 'payment.intentId': { $regex: `^${intentPrefix}`, $options: 'i' } },
                            { 'payment.paymentIntentId': { $regex: `^${intentPrefix}`, $options: 'i' } }
                        ]
                    }).limit(3).toArray();
                    
                    if (similarIntents.length > 0) {
                        console.log(`  ✅ Found ${similarIntents.length} similar payment intents in ${collectionName}:`);
                        similarIntents.forEach(doc => {
                            const intent = doc.paymentIntentId || doc.payment_intent_id || doc.intentId || 
                                          (doc.payment && (doc.payment.intentId || doc.payment.paymentIntentId));
                            console.log(`    - ${doc._id}: ${intent}`);
                        });
                    }
                } catch (error) {
                    continue;
                }
            }
        }
        
        console.log(`\n=== CONCLUSION ===`);
        console.log(`❌ Error document with ID ${errorDocumentId} was not found in any collection`);
        console.log(`❌ Payment intent ${paymentIntentId} was not found in any collection`);
        console.log(`\nPossible explanations:`);
        console.log(`1. The error document exists in a different database`);
        console.log(`2. The error document ID is incorrect or has been removed`);
        console.log(`3. The payment intent belongs to a different environment (staging/production)`);
        console.log(`4. The data has been archived or moved to a different collection`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

// Run the verification
verifyErrorDocument().catch(console.error);