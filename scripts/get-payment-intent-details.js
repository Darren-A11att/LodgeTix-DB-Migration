#!/usr/bin/env node

/**
 * Get detailed information about found payment intent records
 * Payment intent: pi_3RZInfHDfNBUEWUu0BQQrnLx
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: '.env.explorer' });

async function getPaymentIntentDetails() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db('LodgeTix-migration-test-1');
        const paymentIntentId = 'pi_3RZInfHDfNBUEWUu0BQQrnLx';
        
        console.log(`\n=== DETAILED PAYMENT INTENT ANALYSIS ===`);
        console.log(`Payment Intent ID: ${paymentIntentId}`);
        
        // 1. Get registration details
        console.log(`\n=== 1. REGISTRATION DETAILS ===`);
        const registration = await db.collection('registrations').findOne({
            paymentId: paymentIntentId
        });
        
        if (registration) {
            console.log(`✅ Registration found:`);
            console.log(`  - Registration ID: ${registration._id}`);
            console.log(`  - Registration Status: ${registration.status || 'N/A'}`);
            console.log(`  - Payment Status: ${registration.paymentStatus || 'N/A'}`);
            console.log(`  - Payment ID: ${registration.paymentId || 'N/A'}`);
            console.log(`  - Customer ID: ${registration.customerId || 'N/A'}`);
            console.log(`  - Event ID: ${registration.eventId || 'N/A'}`);
            console.log(`  - Registration Date: ${registration.registrationDate || 'N/A'}`);
            console.log(`  - Total Amount Paid: ${registration.totalAmountPaid || 'N/A'}`);
            console.log(`  - Total Price Paid: ${registration.totalPricePaid || 'N/A'}`);
            console.log(`  - Subtotal: ${registration.subtotal || 'N/A'}`);
            console.log(`  - Email: ${registration.email || registration.contactEmail || 'N/A'}`);
            console.log(`  - Contact Name: ${registration.contactName || 'N/A'}`);
            console.log(`  - Agree to Terms: ${registration.agreeToTerms || 'N/A'}`);
            console.log(`  - Created At: ${registration.createdAt || registration.created || 'N/A'}`);
            console.log(`  - Updated At: ${registration.updatedAt || registration.updated || 'N/A'}`);
            
            // Show full document for analysis
            console.log(`\n  📄 Full Registration Document:`);
            console.log(JSON.stringify(registration, null, 4));
        } else {
            console.log(`❌ No registration found with paymentId field`);
        }
        
        // 2. Get payment details
        console.log(`\n=== 2. PAYMENT DETAILS ===`);
        const payment = await db.collection('payments').findOne({
            paymentId: paymentIntentId
        });
        
        if (payment) {
            console.log(`✅ Payment found:`);
            console.log(`  - Payment ID: ${payment._id}`);
            console.log(`  - Transaction ID: ${payment.transactionId || 'N/A'}`);
            console.log(`  - Payment ID: ${payment.paymentId || 'N/A'}`);
            console.log(`  - Source: ${payment.source || 'N/A'}`);
            console.log(`  - Amount: ${payment.amount || 'N/A'}`);
            console.log(`  - Currency: ${payment.currency || 'N/A'}`);
            console.log(`  - Status: ${payment.status || 'N/A'}`);
            console.log(`  - Card Brand: ${payment.cardBrand || 'N/A'}`);
            console.log(`  - Card Last 4: ${payment.cardLast4 || 'N/A'}`);
            console.log(`  - Customer ID: ${payment.customerId || 'N/A'}`);
            console.log(`  - Customer Name: ${payment.customerName || 'N/A'}`);
            console.log(`  - Event Description: ${payment.eventDescription || 'N/A'}`);
            console.log(`  - Fee Amount: ${payment.feeAmount || 'N/A'}`);
            console.log(`  - Created At: ${payment.createdAt || payment.created || 'N/A'}`);
            
            console.log(`\n  📄 Full Payment Document:`);
            console.log(JSON.stringify(payment, null, 4));
        } else {
            console.log(`❌ No payment found with paymentId field`);
        }
        
        // 3. Get Stripe payment details
        console.log(`\n=== 3. STRIPE PAYMENT DETAILS ===`);
        const stripePayment = await db.collection('stripe_payments').findOne({
            stripePaymentIntentId: paymentIntentId
        });
        
        if (stripePayment) {
            console.log(`✅ Stripe payment found:`);
            console.log(`  - Stripe Payment ID: ${stripePayment._id}`);
            console.log(`  - Stripe Payment Intent ID: ${stripePayment.stripePaymentIntentId || 'N/A'}`);
            console.log(`  - Amount: ${stripePayment.amount || 'N/A'}`);
            console.log(`  - Amount Received: ${stripePayment.amount_received || 'N/A'}`);
            console.log(`  - Currency: ${stripePayment.currency || 'N/A'}`);
            console.log(`  - Status: ${stripePayment.status || 'N/A'}`);
            console.log(`  - Client Secret: ${stripePayment.client_secret || 'N/A'}`);
            console.log(`  - Customer: ${stripePayment.customer || 'N/A'}`);
            console.log(`  - Description: ${stripePayment.description || 'N/A'}`);
            console.log(`  - Receipt Email: ${stripePayment.receipt_email || 'N/A'}`);
            console.log(`  - Created: ${stripePayment.created ? new Date(stripePayment.created * 1000) : 'N/A'}`);
            
            console.log(`\n  📄 Full Stripe Payment Document:`);
            console.log(JSON.stringify(stripePayment, null, 4));
        } else {
            console.log(`❌ No Stripe payment found with stripePaymentIntentId field`);
        }
        
        // 4. Get Stripe flat payment details
        console.log(`\n=== 4. STRIPE FLAT PAYMENT DETAILS ===`);
        const stripeFlatPayment = await db.collection('stripe_payments_flat').findOne({
            id: paymentIntentId
        });
        
        if (stripeFlatPayment) {
            console.log(`✅ Stripe flat payment found:`);
            console.log(`  - ID: ${stripeFlatPayment.id || 'N/A'}`);
            console.log(`  - Amount: ${stripeFlatPayment.amount || 'N/A'}`);
            console.log(`  - Currency: ${stripeFlatPayment.currency || 'N/A'}`);
            console.log(`  - Status: ${stripeFlatPayment.status || 'N/A'}`);
            console.log(`  - Customer: ${stripeFlatPayment.customer || 'N/A'}`);
            console.log(`  - Description: ${stripeFlatPayment.description || 'N/A'}`);
            console.log(`  - Receipt Email: ${stripeFlatPayment.receipt_email || 'N/A'}`);
            
            console.log(`\n  📄 Full Stripe Flat Payment Document:`);
            console.log(JSON.stringify(stripeFlatPayment, null, 4));
        } else {
            console.log(`❌ No Stripe flat payment found with id field`);
        }
        
        // 5. Get unified payment details
        console.log(`\n=== 5. UNIFIED PAYMENT DETAILS ===`);
        const unifiedPayment = await db.collection('unified_payments').findOne({
            paymentId: paymentIntentId
        });
        
        if (unifiedPayment) {
            console.log(`✅ Unified payment found:`);
            console.log(`  - Payment ID: ${unifiedPayment._id}`);
            console.log(`  - Payment ID: ${unifiedPayment.paymentId || 'N/A'}`);
            console.log(`  - Transaction ID: ${unifiedPayment.transactionId || 'N/A'}`);
            console.log(`  - Source: ${unifiedPayment.source || 'N/A'}`);
            console.log(`  - Source Account Name: ${unifiedPayment.sourceAccountName || 'N/A'}`);
            console.log(`  - Amount: ${unifiedPayment.amount || 'N/A'}`);
            console.log(`  - Amount Formatted: ${unifiedPayment.amountFormatted || 'N/A'}`);
            console.log(`  - Currency: ${unifiedPayment.currency || 'N/A'}`);
            console.log(`  - Fees: ${unifiedPayment.fees || 'N/A'}`);
            console.log(`  - Gross Amount: ${unifiedPayment.grossAmount || 'N/A'}`);
            console.log(`  - Status: ${unifiedPayment.status || 'N/A'}`);
            console.log(`  - Customer Name: ${unifiedPayment.customerName || 'N/A'}`);
            console.log(`  - Event Description: ${unifiedPayment.eventDescription || 'N/A'}`);
            console.log(`  - Created At: ${unifiedPayment.createdAt || unifiedPayment.created || 'N/A'}`);
            
            console.log(`\n  📄 Full Unified Payment Document:`);
            console.log(JSON.stringify(unifiedPayment, null, 4));
        } else {
            console.log(`❌ No unified payment found with paymentId field`);
        }
        
        // 6. Get transaction details
        console.log(`\n=== 6. TRANSACTION DETAILS ===`);
        const transactions = await db.collection('transactions').find({
            paymentId: paymentIntentId
        }).toArray();
        
        if (transactions.length > 0) {
            console.log(`✅ Found ${transactions.length} transaction(s):`);
            transactions.forEach((transaction, index) => {
                console.log(`\n  Transaction ${index + 1}:`);
                console.log(`    - Transaction ID: ${transaction._id}`);
                console.log(`    - Payment ID: ${transaction.paymentId || 'N/A'}`);
                console.log(`    - Amount: ${transaction.amount || 'N/A'}`);
                console.log(`    - Type: ${transaction.type || 'N/A'}`);
                console.log(`    - Status: ${transaction.status || 'N/A'}`);
                console.log(`    - Created At: ${transaction.createdAt || transaction.created || 'N/A'}`);
                
                console.log(`\n    📄 Full Transaction Document:`);
                console.log(JSON.stringify(transaction, null, 6));
            });
        } else {
            console.log(`❌ No transactions found with paymentId field`);
        }
        
        // 7. Summary report
        console.log(`\n=== FINAL SUMMARY REPORT ===`);
        console.log(`Payment Intent ID: ${paymentIntentId}`);
        console.log(`Registration found: ${registration ? '✅ YES' : '❌ NO'}`);
        console.log(`Payment found: ${payment ? '✅ YES' : '❌ NO'}`);
        console.log(`Stripe payment found: ${stripePayment ? '✅ YES' : '❌ NO'}`);
        console.log(`Stripe flat payment found: ${stripeFlatPayment ? '✅ YES' : '❌ NO'}`);
        console.log(`Unified payment found: ${unifiedPayment ? '✅ YES' : '❌ NO'}`);
        console.log(`Transactions found: ${transactions.length > 0 ? `✅ YES (${transactions.length})` : '❌ NO'}`);
        
        console.log(`\nField names where payment intent was found:`);
        const foundFields = [];
        if (registration) foundFields.push('registrations.paymentId');
        if (payment) foundFields.push('payments.paymentId');
        if (stripePayment) foundFields.push('stripe_payments.stripePaymentIntentId');
        if (stripeFlatPayment) foundFields.push('stripe_payments_flat.id');
        if (unifiedPayment) foundFields.push('unified_payments.paymentId');
        if (transactions.length > 0) foundFields.push('transactions.paymentId');
        
        foundFields.forEach(field => console.log(`  - ${field}`));
        
        if (registration) {
            console.log(`\nRegistration Details:`);
            console.log(`  - Registration ID: ${registration._id}`);
            console.log(`  - Status: ${registration.status || 'N/A'}`);
            console.log(`  - Payment Status: ${registration.paymentStatus || 'N/A'}`);
            console.log(`  - Amount: ${registration.totalAmountPaid || registration.totalPricePaid || 'N/A'}`);
            console.log(`  - Customer ID: ${registration.customerId || 'N/A'}`);
            console.log(`  - Event ID: ${registration.eventId || 'N/A'}`);
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

// Run the detailed analysis
getPaymentIntentDetails().catch(console.error);