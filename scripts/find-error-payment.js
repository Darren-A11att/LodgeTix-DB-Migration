#!/usr/bin/env node

/**
 * Find error payment document and check available collections
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function findErrorPayment() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db('LodgeTix-migration-test-1');
        
        // List all collections
        console.log('\n=== Available Collections ===');
        const collections = await db.listCollections().toArray();
        collections.forEach(col => {
            console.log(`- ${col.name}`);
        });
        
        const errorPaymentId = '68a09f38c18a9f49d9048751';
        console.log(`\n=== Searching for document with _id: ${errorPaymentId} ===`);
        
        // Search in all collections that might contain error payments
        const errorCollections = collections.filter(col => 
            col.name.includes('error') || 
            col.name.includes('payment') || 
            col.name.includes('failed')
        );
        
        console.log('\nSearching in error/payment related collections:');
        for (const col of errorCollections) {
            console.log(`\n--- Checking collection: ${col.name} ---`);
            try {
                const doc = await db.collection(col.name).findOne({
                    _id: new ObjectId(errorPaymentId)
                });
                
                if (doc) {
                    console.log('✅ Document found!');
                    console.log('Document:', JSON.stringify(doc, null, 2));
                    
                    // Extract payment intent
                    const paymentIntent = doc.paymentIntent || doc.payment_intent_id || doc.paymentIntentId;
                    console.log(`\nPayment Intent: ${paymentIntent}`);
                    
                    return paymentIntent;
                } else {
                    console.log('❌ Document not found in this collection');
                }
            } catch (err) {
                console.log(`Error searching in ${col.name}:`, err.message);
            }
        }
        
        // If not found in error collections, search in all collections
        console.log('\n=== Searching in ALL collections ===');
        for (const col of collections) {
            try {
                const doc = await db.collection(col.name).findOne({
                    _id: new ObjectId(errorPaymentId)
                });
                
                if (doc) {
                    console.log(`✅ Document found in collection: ${col.name}`);
                    console.log('Document:', JSON.stringify(doc, null, 2));
                    
                    // Extract payment intent
                    const paymentIntent = doc.paymentIntent || doc.payment_intent_id || doc.paymentIntentId;
                    console.log(`\nPayment Intent: ${paymentIntent}`);
                    
                    return paymentIntent;
                }
            } catch (err) {
                // Skip invalid ObjectId searches
                continue;
            }
        }
        
        console.log('\n❌ Document not found in any collection');
        
        // Try searching with string ID instead
        console.log('\n=== Trying string ID search ===');
        for (const col of errorCollections) {
            console.log(`\n--- Checking collection: ${col.name} with string ID ---`);
            try {
                const doc = await db.collection(col.name).findOne({
                    _id: errorPaymentId
                });
                
                if (doc) {
                    console.log('✅ Document found with string ID!');
                    console.log('Document:', JSON.stringify(doc, null, 2));
                    
                    // Extract payment intent
                    const paymentIntent = doc.paymentIntent || doc.payment_intent_id || doc.paymentIntentId;
                    console.log(`\nPayment Intent: ${paymentIntent}`);
                    
                    return paymentIntent;
                }
            } catch (err) {
                console.log(`Error searching in ${col.name}:`, err.message);
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

// Run the search
findErrorPayment().catch(console.error);