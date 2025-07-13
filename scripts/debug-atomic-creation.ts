#!/usr/bin/env node

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

interface Invoice {
  _id: ObjectId;
  customerInvoice?: {
    invoiceNumber?: string;
  };
  supplierInvoice?: {
    invoiceNumber?: string;
  };
  createdAt: Date;
  transactionIds?: ObjectId[];
  payment?: {
    _id: ObjectId;
  };
  registration?: {
    _id: ObjectId;
  };
}

interface Payment {
  _id: ObjectId;
  invoiceCreated?: boolean;
  invoiceId?: ObjectId | string;
}

interface Registration {
  _id: ObjectId;
  invoiceCreated?: boolean;
  invoiceId?: ObjectId | string;
}

interface Transaction {
  _id: ObjectId;
}

interface Counter {
  _id: string;
  sequence_value: number;
}

async function debugAtomicCreation(): Promise<void> {
  const MONGODB_URI = process.env.MONGODB_URI;
  const MONGODB_DATABASE = process.env.MONGODB_DATABASE;
  
  if (!MONGODB_URI || !MONGODB_DATABASE) {
    throw new Error('MONGODB_URI and MONGODB_DATABASE environment variables are required');
  }

  let client: MongoClient | null = null;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db: Db = client.db(MONGODB_DATABASE);
    
    console.log('Checking recent invoices...');
    
    // Find the most recent invoice
    const recentInvoice: Invoice | null = await db.collection('invoices').findOne(
      {},
      { sort: { createdAt: -1 } }
    );
    
    if (recentInvoice) {
      console.log('\nMost recent invoice:');
      console.log('- ID:', recentInvoice._id);
      console.log('- Customer Invoice:', recentInvoice.customerInvoice?.invoiceNumber);
      console.log('- Supplier Invoice:', recentInvoice.supplierInvoice?.invoiceNumber);
      console.log('- Created:', recentInvoice.createdAt);
      console.log('- Transaction IDs:', recentInvoice.transactionIds);
      
      // Check if payment was updated
      if (recentInvoice.payment?._id) {
        const payment: Payment | null = await db.collection('payments').findOne({
          _id: new ObjectId(recentInvoice.payment._id)
        });
        console.log('\nPayment status:');
        console.log('- Invoice Created:', payment?.invoiceCreated);
        console.log('- Invoice ID:', payment?.invoiceId);
      }
      
      // Check if registration was updated
      if (recentInvoice.registration?._id) {
        const registration: Registration | null = await db.collection('registrations').findOne({
          _id: new ObjectId(recentInvoice.registration._id)
        });
        console.log('\nRegistration status:');
        console.log('- Invoice Created:', registration?.invoiceCreated);
        console.log('- Invoice ID:', registration?.invoiceId);
      }
      
      // Check transactions
      if (recentInvoice.transactionIds?.length && recentInvoice.transactionIds.length > 0) {
        const transactions: Transaction[] = await db.collection('transactions').find({
          _id: { $in: recentInvoice.transactionIds }
        }).toArray();
        console.log('\nTransactions found:', transactions.length);
      }
    } else {
      console.log('No invoices found');
    }
    
    // Check transaction sequence
    const counter: Counter | null = await db.collection('counters').findOne({ _id: 'transaction_sequence' });
    console.log('\nTransaction sequence counter:', counter?.sequence_value);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

debugAtomicCreation().catch(console.error);