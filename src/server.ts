import express from 'express';
import cors from 'cors';
import { connectMongoDB, disconnectMongoDB } from './connections/mongodb';
import { 
  connectBothDBs, 
  disconnectBothDBs,
  getDestinationDb
} from './connections/dual-mongodb';
import { MigrationService } from './services/migration-service';
import path from 'path';
import { ObjectId } from 'mongodb';
import { PaymentRegistrationMatcher, PaymentData } from './services/payment-registration-matcher';
import { InvoicePreviewGenerator } from './services/invoice-preview-generator';
import { InvoiceSequence } from './utils/invoice-sequence';
import { DEFAULT_INVOICE_SUPPLIER } from './constants/invoice';
import fs from 'fs/promises';
import { findBestMatch, convertToLegacyMatchDetails } from './utils/match-analyzer-multi-field';
import { findAvailablePort } from './utils/port-finder';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Routes

// Get all collections
app.get('/api/collections', async (_req, res) => {
  try {
    const { db } = await connectMongoDB();
    const collections = await db.listCollections().toArray();
    
    // Get document count for each collection
    const collectionsWithCount = await Promise.all(
      collections.map(async (col) => ({
        name: col.name,
        count: await db.collection(col.name).countDocuments()
      }))
    );
    
    // Sort collections by name, but put 'payments' first
    collectionsWithCount.sort((a, b) => {
      if (a.name === 'payments') return -1;
      if (b.name === 'payments') return 1;
      return a.name.localeCompare(b.name);
    });
    
    res.json(collectionsWithCount);
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// Global search across all collections
app.get('/api/search', async (req, res) => {
  try {
    const { db } = await connectMongoDB();
    const searchQuery = req.query.q as string || '';
    const limit = parseInt(req.query.limit as string) || 10;
    
    if (!searchQuery) {
      res.json({ results: [], total: 0, query: searchQuery });
      return;
    }
    
    // Define collections to search and their relevant fields
    const searchTargets = [
      {
        collection: 'registrations',
        fields: ['registrationId', 'customerId', 'confirmationNumber', 'primaryAttendee']
      },
      {
        collection: 'payments',
        fields: ['transactionId', 'paymentId', 'customerEmail', 'customerName']
      },
      {
        collection: 'attendees',
        fields: ['attendeeId', 'firstName', 'lastName', 'primaryEmail']
      },
      {
        collection: 'invoices',
        fields: ['invoiceNumber', 'registrationId', 'paymentId']
      }
    ];
    
    const allResults: Array<{ collection: string; document: any }> = [];
    
    for (const target of searchTargets) {
      const collection = db.collection(target.collection);
      
      // Build search conditions
      const searchConditions = [];
      
      // Check if it's a valid ObjectId
      if (ObjectId.isValid(searchQuery)) {
        searchConditions.push({ _id: new ObjectId(searchQuery) });
      }
      
      // Search in specific fields
      target.fields.forEach(field => {
        // Exact match for IDs
        if (field.includes('Id') || field === 'confirmationNumber') {
          searchConditions.push({ [field]: searchQuery });
        } else {
          // Partial match for other fields
          searchConditions.push({ [field]: { $regex: searchQuery, $options: 'i' } });
        }
      });
      
      // Search in nested fields for registrations
      if (target.collection === 'registrations') {
        searchConditions.push(
          { 'registrationData.registrationId': searchQuery },
          { 'registrationData.bookingContact.email': { $regex: searchQuery, $options: 'i' } },
          { 'registrationData.attendees.primaryEmail': { $regex: searchQuery, $options: 'i' } }
        );
      }
      
      const filter = { $or: searchConditions };
      const results = await collection.find(filter).limit(limit).toArray();
      
      // Add collection name to each result
      results.forEach(doc => {
        allResults.push({
          collection: target.collection,
          document: doc
        });
      });
    }
    
    res.json({
      results: allResults.slice(0, limit * 2), // Return max 2x limit across all collections
      total: allResults.length,
      query: searchQuery
    });
    
  } catch (error) {
    console.error('Error performing global search:', error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

// Get documents from a specific collection with search
app.get('/api/collections/:name/documents', async (req, res) => {
  try {
    const { db } = await connectMongoDB();
    const collectionName = req.params.name;
    
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = parseInt(req.query.skip as string) || 0;
    const searchQuery = req.query.search as string || '';
    
    const collection = db.collection(collectionName);
    
    // Build search filter
    let filter: any = {};
    if (searchQuery) {
      // Create search conditions for common ID fields
      const searchConditions = [];
      
      // For ObjectId fields
      if (ObjectId.isValid(searchQuery)) {
        searchConditions.push({ _id: new ObjectId(searchQuery) });
      }
      
      // For string ID fields - exact match
      const idFields = [
        'registrationId', 'customerId', 'functionId', 'authUserId',
        'bookingContactId', 'transactionId', 'paymentId', 'attendeeId',
        'confirmationNumber', 'stripePaymentIntentId', 'connectedAccountId',
        'organisationId', 'eventId', 'primaryAttendeeId'
      ];
      
      idFields.forEach(field => {
        searchConditions.push({ [field]: searchQuery });
      });
      
      // For nested ID fields
      searchConditions.push(
        { 'registrationData.registrationId': searchQuery },
        { 'registrationData.attendees.attendeeId': searchQuery },
        { 'registrationData.attendees.lodge_id': searchQuery },
        { 'originalData.registrationId (metadata)': searchQuery },
        { 'originalData.functionId (metadata)': searchQuery }
      );
      
      // For email fields - partial match
      searchConditions.push(
        { 'customerEmail': { $regex: searchQuery, $options: 'i' } },
        { 'registrationData.bookingContact.email': { $regex: searchQuery, $options: 'i' } },
        { 'registrationData.attendees.primaryEmail': { $regex: searchQuery, $options: 'i' } }
      );
      
      // For name fields - partial match
      searchConditions.push(
        { 'customerName': { $regex: searchQuery, $options: 'i' } },
        { 'primaryAttendee': { $regex: searchQuery, $options: 'i' } },
        { 'registrationData.bookingContact.firstName': { $regex: searchQuery, $options: 'i' } },
        { 'registrationData.bookingContact.lastName': { $regex: searchQuery, $options: 'i' } },
        { 'registrationData.attendees.firstName': { $regex: searchQuery, $options: 'i' } },
        { 'registrationData.attendees.lastName': { $regex: searchQuery, $options: 'i' } }
      );
      
      // For confirmation numbers
      searchConditions.push(
        { 'confirmationNumber': { $regex: searchQuery, $options: 'i' } }
      );
      
      filter = { $or: searchConditions };
    }
    
    const documents = await collection.find(filter).skip(skip).limit(limit).toArray();
    const total = await collection.countDocuments(filter);
    
    res.json({
      documents,
      total,
      limit,
      skip,
      collection: collectionName,
      searchQuery
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Search documents in a specific collection
app.post('/api/collections/:name/search', async (req, res) => {
  try {
    const { db } = await connectMongoDB();
    const collectionName = req.params.name;
    const { query } = req.body;
    
    if (!query || typeof query !== 'object') {
      res.status(400).json({ error: 'Invalid search query' });
      return;
    }
    
    const collection = db.collection(collectionName);
    
    // Build MongoDB query from the provided query object
    const filter: any = {};
    
    // Handle different query patterns
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // For ID fields, use exact match
        if (key.includes('Id') || key === '_id') {
          if (key === '_id' && ObjectId.isValid(value as string)) {
            filter[key] = new ObjectId(value as string);
          } else {
            filter[key] = value;
          }
        } else if (key === 'email' || key === 'customerEmail') {
          // For email fields, use case-insensitive regex
          filter[key] = { $regex: new RegExp(value as string, 'i') };
        } else {
          // For other fields, use exact match
          filter[key] = value;
        }
      }
    });
    
    // If no valid filters, return empty results
    if (Object.keys(filter).length === 0) {
      res.json({
        results: [],
        total: 0,
        collection: collectionName,
        query
      });
      return;
    }
    
    // Execute search
    const results = await collection.find(filter).limit(50).toArray();
    const total = await collection.countDocuments(filter);
    
    res.json({
      results,
      total,
      collection: collectionName,
      query
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({ error: 'Failed to search documents' });
  }
});

// Create a new document in a collection
app.post('/api/collections/:name/documents', async (req, res) => {
  try {
    const { db } = await connectMongoDB();
    const collectionName = req.params.name;
    const document = req.body;
    
    if (!document || typeof document !== 'object') {
      res.status(400).json({ error: 'Invalid document data' });
      return;
    }
    
    const collection = db.collection(collectionName);
    
    // Add timestamps
    const newDocument = {
      ...document,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert document
    const result = await collection.insertOne(newDocument);
    
    res.json({
      success: true,
      insertedId: result.insertedId,
      document: { ...newDocument, _id: result.insertedId }
    });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Get related documents for any document in any collection
app.get('/api/collections/:name/documents/:id/related', async (req, res) => {
  try {
    const { db } = await connectMongoDB();
    const { name: collectionName, id: documentId } = req.params;
    
    if (!ObjectId.isValid(documentId)) {
      res.status(400).json({ error: 'Invalid document ID' });
      return;
    }
    
    // Get the source document
    const sourceCollection = db.collection(collectionName);
    const sourceDoc = await sourceCollection.findOne({ _id: new ObjectId(documentId) });
    
    if (!sourceDoc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    
    const relatedDocs: Record<string, any[]> = {};
    
    // Special handling for functions collection
    if (collectionName === 'functions') {
      // First, get documents by specific IDs mentioned in the function
      if (sourceDoc.locationId) {
        try {
          const locationsCollection = db.collection('locations');
          const locationQueries: any[] = [
            { locationId: sourceDoc.locationId },
            { id: sourceDoc.locationId }
          ];
          if (ObjectId.isValid(sourceDoc.locationId)) {
            locationQueries.push({ _id: new ObjectId(sourceDoc.locationId) });
          }
          const location = await locationsCollection.findOne({ $or: locationQueries });
          if (location) {
            relatedDocs.locations = [location];
          }
        } catch (err) {
          console.warn('Failed to fetch location:', err);
        }
      }
      
      if (sourceDoc.organiserId) {
        try {
          const organisersCollection = db.collection('organisers');
          const organiserQueries: any[] = [
            { organiserId: sourceDoc.organiserId },
            { id: sourceDoc.organiserId }
          ];
          if (ObjectId.isValid(sourceDoc.organiserId)) {
            organiserQueries.push({ _id: new ObjectId(sourceDoc.organiserId) });
          }
          const organiser = await organisersCollection.findOne({ $or: organiserQueries });
          if (organiser) {
            relatedDocs.organisers = [organiser];
          }
        } catch (err) {
          console.warn('Failed to fetch organiser:', err);
        }
      }
      
      // Then get documents with functionId
      const functionRelatedCollections = ['events', 'packages'];  // Removed event_tickets as we'll get them via events
      for (const relCollection of functionRelatedCollections) {
        try {
          const collection = db.collection(relCollection);
          const results = await collection.find({
            $or: [
              { functionId: sourceDoc._id.toString() },
              { functionId: sourceDoc.functionId },
              { function_id: sourceDoc._id.toString() },
              { function_id: sourceDoc.functionId }
            ]
          }).limit(50).toArray();
          
          if (results.length > 0) {
            relatedDocs[relCollection] = results;
          }
        } catch (err) {
          console.warn(`Failed to search ${relCollection}:`, err);
        }
      }
      
      // If we found events, also get their eventTickets (product templates)
      if (relatedDocs.events && relatedDocs.events.length > 0) {
        try {
          const eventTicketsCollection = db.collection('eventTickets');
          const eventIds = relatedDocs.events.map((event: any) => event._id.toString());
          
          // Also collect any eventId/event_id fields from the events
          relatedDocs.events.forEach((event: any) => {
            if (event.eventId) eventIds.push(event.eventId);
            if (event.event_id) eventIds.push(event.event_id);
            if (event.id) eventIds.push(event.id);
          });
          
          // Also add the eventId field values from events
          const allEventIds = [...eventIds];
          relatedDocs.events.forEach((event: any) => {
            if (event.eventId && !allEventIds.includes(event.eventId)) {
              allEventIds.push(event.eventId);
            }
          });
          
          console.log('Looking for eventTickets for event IDs:', allEventIds);
          
          const eventTickets = await eventTicketsCollection.find({
            $or: [
              { eventId: { $in: allEventIds } },
              { event_id: { $in: allEventIds } },
              { event: { $in: allEventIds } }
            ]
          }).limit(200).toArray();
          
          console.log(`Found ${eventTickets.length} eventTickets`);
          
          if (eventTickets.length > 0) {
            // Remove duplicates based on _id
            const uniqueEventTickets = eventTickets.filter(
              (ticket: any, index: number, self: any[]) =>
                index === self.findIndex((t: any) => t._id?.toString() === ticket._id?.toString())
            );
            
            relatedDocs.eventTickets = uniqueEventTickets;
          }
        } catch (err) {
          console.warn('Failed to fetch eventTickets for events:', err);
        }
      }
      
      // Skip the normal relationship processing for functions
      res.json({
        source: {
          collection: collectionName,
          document: sourceDoc
        },
        relatedDocuments: relatedDocs,
        summary: {
          totalRelated: Object.values(relatedDocs).reduce((sum, docs) => sum + docs.length, 0),
          collections: Object.keys(relatedDocs)
        }
      });
      return;
    }
    
    // Special handling for events collection
    if (collectionName === 'events') {
      // Get eventTickets (product templates) for this event
      try {
        const eventTicketsCollection = db.collection('eventTickets');
        const eventId = sourceDoc.event_id || sourceDoc.eventId || sourceDoc._id.toString();
        
        console.log('Event document - looking for eventTickets with eventId:', eventId);
        
        const eventTickets = await eventTicketsCollection.find({
          $or: [
            { eventId: eventId },
            { event_id: eventId },
            { event: eventId }
          ]
        }).limit(200).toArray();
        
        console.log(`Found ${eventTickets.length} eventTickets for event`);
        
        if (eventTickets.length > 0) {
          relatedDocs.eventTickets = eventTickets;
        }
      } catch (err) {
        console.warn('Failed to fetch eventTickets for event:', err);
      }
      
      // Also get the parent function
      if (sourceDoc.functionId || sourceDoc.function_id) {
        try {
          const functionsCollection = db.collection('functions');
          const functionId = sourceDoc.functionId || sourceDoc.function_id;
          const functionQueries: any[] = [
            { functionId: functionId },
            { _id: ObjectId.isValid(functionId) ? new ObjectId(functionId) : functionId }
          ];
          const functionDoc = await functionsCollection.findOne({ $or: functionQueries });
          if (functionDoc) {
            relatedDocs.functions = [functionDoc];
          }
        } catch (err) {
          console.warn('Failed to fetch function for event:', err);
        }
      }
    }
    
    // Define relationships for other collection types
    const relationships: Record<string, string[]> = {
      registrations: ['attendees', 'eventTickets', 'packages', 'functions', 'events', 'lodges', 'organisations', 'users'],
      attendees: ['registrations', 'tickets', 'users'],
      payments: ['registrations', 'invoices'],
      users: ['registrations', 'attendees', 'organisations'],
      organisations: ['registrations', 'users', 'lodges'],
      events: ['locations', 'registrations']  // Removed eventTickets since we handle it specially above
    };
    
    const relatedCollections = relationships[collectionName] || [];
    
    // Extract all possible ID fields from source document
    const idFields: Record<string, any> = {};
    const extractIds = (obj: any, prefix = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        if (key.includes('Id') || key === '_id' || key === 'id') {
          idFields[key] = value;
        }
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          extractIds(value, prefix ? `${prefix}.${key}` : key);
        }
      });
    };
    extractIds(sourceDoc);
    
    console.log(`Searching for related documents for ${collectionName} document ${documentId}`);
    console.log('Extracted ID fields:', idFields);
    console.log('Will search in collections:', relatedCollections);
    
    // Search related collections
    for (const relatedCollection of relatedCollections) {
      try {
        const collection = db.collection(relatedCollection);
        const queries: any[] = [];
        
        // Build queries based on ID fields
        Object.entries(idFields).forEach(([field, value]) => {
          if (value) {
            // Direct field match
            queries.push({ [field]: value });
            
            // Also check if it's an ObjectId
            if (ObjectId.isValid(value)) {
              queries.push({ [field]: new ObjectId(value) });
              queries.push({ _id: new ObjectId(value) });
            }
            
            // Check nested fields
            queries.push({ [`${collectionName}Id`]: value });
            queries.push({ [`${collectionName}._id`]: value });
          }
        });
        
        // Add email-based queries if applicable
        if (sourceDoc.email) {
          queries.push({ email: sourceDoc.email });
          queries.push({ customerEmail: sourceDoc.email });
          queries.push({ primaryEmail: sourceDoc.email });
        }
        if (sourceDoc.customerEmail) {
          queries.push({ email: sourceDoc.customerEmail });
          queries.push({ customerEmail: sourceDoc.customerEmail });
          queries.push({ primaryEmail: sourceDoc.customerEmail });
        }
        
        // Add registration-specific queries
        if (collectionName === 'registrations') {
          if (sourceDoc.confirmationNumber) {
            queries.push({ confirmationNumber: sourceDoc.confirmationNumber });
            queries.push({ registrationConfirmationNumber: sourceDoc.confirmationNumber });
          }
          if (sourceDoc.registrationId) {
            queries.push({ registrationId: sourceDoc.registrationId });
            queries.push({ registration_id: sourceDoc.registrationId });
          }
          if (sourceDoc.customerId) {
            queries.push({ customerId: sourceDoc.customerId });
            queries.push({ customer_id: sourceDoc.customerId });
            queries.push({ userId: sourceDoc.customerId });
          }
          if (sourceDoc.functionId) {
            queries.push({ functionId: sourceDoc.functionId });
            queries.push({ function_id: sourceDoc.functionId });
          }
          if (sourceDoc.lodgeId) {
            queries.push({ lodgeId: sourceDoc.lodgeId });
            queries.push({ lodge_id: sourceDoc.lodgeId });
            queries.push({ organisationId: sourceDoc.lodgeId });
          }
        }
        
        if (queries.length > 0) {
          const results = await collection.find({ $or: queries }).limit(50).toArray();
          if (results.length > 0) {
            relatedDocs[relatedCollection] = results;
          }
        }
      } catch (err) {
        console.warn(`Failed to search ${relatedCollection}:`, err);
      }
    }
    
    res.json({
      source: {
        collection: collectionName,
        document: sourceDoc
      },
      relatedDocuments: relatedDocs,
      summary: {
        totalRelated: Object.values(relatedDocs).reduce((sum, docs) => sum + docs.length, 0),
        collections: Object.keys(relatedDocs)
      }
    });
  } catch (error) {
    console.error('Error fetching related documents:', error);
    res.status(500).json({ error: 'Failed to fetch related documents' });
  }
});

// Get reconciliation data
app.get('/api/reconciliation', async (_req, res) => {
  try {
    const { db } = await connectMongoDB();
    
    // Analyze ticket counts from different sources
    const registrationAttendees = await db.collection('registrations').aggregate([
      { $group: { _id: null, total: { $sum: '$attendeeCount' } } }
    ]).toArray();
    
    const ticketCount = await db.collection('tickets').countDocuments();
    
    const paymentAttendees = await db.collection('payments').aggregate([
      { $match: { status: 'paid' } },
      { $unwind: { path: '$originalData', preserveNullAndEmptyArrays: true } },
      { $group: { 
        _id: null, 
        total: { 
          $sum: { 
            $convert: { 
              input: '$originalData.metadata[total_attendees]', 
              to: 'int', 
              onError: 0, 
              onNull: 0 
            } 
          } 
        } 
      }}
    ]).toArray();
    
    // Analyze payment matching
    const totalRegistrations = await db.collection('registrations').countDocuments();
    const registrationsWithPayments = await db.collection('registrations').countDocuments({ 
      $or: [
        { paymentIntentId: { $exists: true, $ne: null } },
        { stripePaymentIntentId: { $exists: true, $ne: null } }
      ]
    });
    
    const totalPayments = await db.collection('payments').countDocuments({ status: 'paid' });
    
    // Calculate payment amounts
    const paymentAmounts = await db.collection('payments').aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$grossAmount' } } }
    ]).toArray();
    
    const registrationAmounts = await db.collection('registrations').aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]).toArray();
    
    // Data quality checks
    const duplicateRegistrations = await db.collection('registrations').aggregate([
      { $group: { 
        _id: { confirmationNumber: '$confirmationNumber' }, 
        count: { $sum: 1 } 
      }},
      { $match: { count: { $gt: 1 } } },
      { $count: 'total' }
    ]).toArray();
    
    const missingAttendeeInfo = await db.collection('registrations').countDocuments({
      $or: [
        { attendees: { $exists: false } },
        { attendees: { $size: 0 } },
        { attendees: null }
      ]
    });
    
    const invalidEmails = await db.collection('registrations').countDocuments({
      email: { $not: { $regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ } }
    });
    
    const missingLodgeInfo = await db.collection('registrations').countDocuments({
      registrationType: 'lodge',
      lodgeName: { $in: [null, '', undefined] }
    });
    
    // Prepare response
    const ticketCountData = {
      fromRegistrations: registrationAttendees[0]?.total || 0,
      fromTickets: ticketCount,
      fromPayments: paymentAttendees[0]?.total || 0,
      discrepancies: [] as string[]
    };
    
    // Check for discrepancies
    if (ticketCountData.fromRegistrations !== ticketCountData.fromTickets) {
      ticketCountData.discrepancies.push(
        `Registration count (${ticketCountData.fromRegistrations}) doesn't match ticket count (${ticketCountData.fromTickets})`
      );
    }
    
    res.json({
      ticketCounts: ticketCountData,
      paymentStatus: {
        totalRegistrations,
        registrationsWithPayments,
        registrationsWithoutPayments: totalRegistrations - registrationsWithPayments,
        paymentsWithoutRegistrations: totalPayments - registrationsWithPayments,
        totalPaymentAmount: paymentAmounts[0]?.total || 0,
        totalRegistrationAmount: registrationAmounts[0]?.total || 0
      },
      dataQuality: {
        duplicateRegistrations: duplicateRegistrations[0]?.total || 0,
        missingAttendeeInfo,
        invalidEmails,
        missingLodgeInfo
      }
    });
    
  } catch (error) {
    console.error('Error generating reconciliation data:', error);
    res.status(500).json({ error: 'Failed to generate reconciliation data' });
  }
});

// Get proclamation banquet report data
app.get('/api/reports/proclamation-banquet', async (_req, res) => {
  try {
    const { db } = await connectMongoDB();
    const registrationsCollection = db.collection('registrations');
    
    // Find all lodge registrations
    const lodgeRegistrations = await registrationsCollection.find({
      registrationType: 'lodge'
    }).toArray();
    
    // Calculate total attendees
    const totalAttendees = lodgeRegistrations.reduce((sum, reg) => {
      return sum + (reg.attendeeCount || 0);
    }, 0);
    
    res.json({
      registrations: lodgeRegistrations,
      totalAttendees,
      total: lodgeRegistrations.length
    });
  } catch (error) {
    console.error('Error fetching proclamation banquet data:', error);
    res.status(500).json({ error: 'Failed to fetch report data' });
  }
});

// Get a specific document
app.get('/api/collections/:name/documents/:id', async (req, res) => {
  try {
    const { db } = await connectMongoDB();
    const collectionName = req.params.name;
    const documentId = req.params.id;
    
    const collection = db.collection(collectionName);
    
    // Try to find by ObjectId if the ID is a valid ObjectId format
    let query: any = {};
    if (ObjectId.isValid(documentId)) {
      query._id = new ObjectId(documentId);
    } else {
      // Fallback to string search if not a valid ObjectId
      query._id = documentId;
    }
    
    const document = await collection.findOne(query);
    
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    
    res.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Invoice endpoints
app.get('/api/invoices/pending', async (req, res) => {
  try {
    const { db } = await connectMongoDB();
    
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const minConfidence = parseInt(req.query.minConfidence as string) || 0;

    // Initialize services
    const previewGenerator = new InvoicePreviewGenerator(db);
    const matcher = new PaymentRegistrationMatcher(db);

    // Get all unmatched payments
    const matchResults = await matcher.matchAllPayments();

    // Filter by confidence
    const filteredResults = matchResults.filter(
      result => result.matchConfidence >= minConfidence
    );

    // Sort by payment date (oldest first) to ensure proper invoice numbering
    filteredResults.sort((a, b) => {
      const dateA = new Date(a.payment.timestamp).getTime();
      const dateB = new Date(b.payment.timestamp).getTime();
      return dateA - dateB; // Oldest first
    });

    // Apply pagination
    const paginatedResults = filteredResults.slice(offset, offset + limit);

    // Generate previews
    const previews = await previewGenerator.generatePreviews(paginatedResults);

    // Get statistics
    const stats = await matcher.getMatchStatistics();

    res.json({
      success: true,
      data: {
        previews,
        pagination: {
          total: filteredResults.length,
          limit,
          offset,
          hasMore: offset + limit < filteredResults.length
        },
        statistics: stats
      }
    });

  } catch (error) {
    console.error('Error fetching pending invoices:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.post('/api/invoices/approve', async (req, res) => {
  try {
    const { db } = await connectMongoDB();
    const { invoicePreview, paymentId, registrationId } = req.body;

    if (!invoicePreview || !paymentId || !registrationId) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    // Generate final invoice number
    const invoiceSequence = new InvoiceSequence(db);
    const invoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber();

    // Create final invoice
    const finalInvoice = {
      ...invoicePreview,
      invoiceNumber,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Remove preview-specific fields
    delete finalInvoice.matchDetails;
    delete finalInvoice.paymentDetails;
    delete finalInvoice.registrationDetails;

    // Insert invoice
    const invoicesCollection = db.collection('invoices');
    const insertResult = await invoicesCollection.insertOne(finalInvoice);

    // Update payment record
    const paymentsCollection = db.collection('payments');
    await paymentsCollection.updateOne(
      { _id: new ObjectId(paymentId) },
      { 
        $set: { 
          invoiceCreated: true,
          invoiceId: insertResult.insertedId,
          invoiceNumber,
          processedAt: new Date()
        }
      }
    );

    // Update registration record
    const registrationsCollection = db.collection('registrations');
    await registrationsCollection.updateOne(
      { _id: new ObjectId(registrationId) },
      { 
        $set: { 
          invoiceCreated: true,
          invoiceId: insertResult.insertedId,
          invoiceNumber,
          processedAt: new Date()
        }
      }
    );

    // Log approval
    const auditCollection = db.collection('invoice_audit_log');
    await auditCollection.insertOne({
      action: 'approved',
      invoiceNumber,
      paymentId,
      registrationId,
      approvedAt: new Date(),
      approvedBy: 'system',
      matchConfidence: req.body.matchConfidence,
      matchMethod: req.body.matchMethod
    });

    res.json({
      success: true,
      message: 'Invoice approved and created successfully'
    });

  } catch (error) {
    console.error('Error approving invoice:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.post('/api/invoices/decline', async (req, res) => {
  try {
    const { db } = await connectMongoDB();
    const { paymentId, registrationId, reason, comments, invoicePreview } = req.body;

    if (!paymentId || !reason) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    // Update payment record to mark as declined
    const paymentsCollection = db.collection('payments');
    await paymentsCollection.updateOne(
      { _id: new ObjectId(paymentId) },
      { 
        $set: { 
          invoiceDeclined: true,
          declinedAt: new Date(),
          declineReason: reason,
          declineComments: comments
        }
      }
    );

    // Log decline in audit log
    const auditCollection = db.collection('invoice_audit_log');
    await auditCollection.insertOne({
      action: 'declined',
      paymentId,
      registrationId,
      declinedAt: new Date(),
      declinedBy: 'system',
      reason,
      comments,
      matchConfidence: invoicePreview?.matchDetails?.confidence,
      matchMethod: invoicePreview?.matchDetails?.method
    });

    // Write to decline log file
    const declineLog = {
      timestamp: new Date().toISOString(),
      paymentId,
      registrationId,
      reason,
      comments,
      paymentDetails: {
        amount: invoicePreview?.payment?.amount,
        date: invoicePreview?.payment?.paidDate,
        source: invoicePreview?.paymentDetails?.source,
        originalId: invoicePreview?.paymentDetails?.originalPaymentId
      },
      registrationDetails: {
        confirmationNumber: invoicePreview?.registrationDetails?.confirmationNumber,
        functionName: invoicePreview?.registrationDetails?.functionName
      },
      matchDetails: invoicePreview?.matchDetails
    };

    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs', 'declined-invoices');
    await fs.mkdir(logsDir, { recursive: true });

    // Write to daily log file
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logsDir, `declined-${today}.json`);
    
    let existingLogs = [];
    try {
      const fileContent = await fs.readFile(logFile, 'utf-8');
      existingLogs = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist or is empty, start with empty array
    }

    existingLogs.push(declineLog);
    await fs.writeFile(logFile, JSON.stringify(existingLogs, null, 2));

    res.json({
      success: true,
      message: 'Invoice declined and logged successfully'
    });

  } catch (error) {
    console.error('Error declining invoice:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Simplified Invoice Matching Endpoints
app.get('/api/invoices/matches', async (req, res) => {
  try {
    const { db } = await connectMongoDB();
    
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Initialize services
    const previewGenerator = new InvoicePreviewGenerator(db);
    
    // Get all payments without invoices
    const paymentsCollection = db.collection('payments');
    const payments = await paymentsCollection.find({
      status: 'paid',
      invoiceCreated: { $ne: true }
    })
    .sort({ timestamp: 1 }) // Oldest first for proper invoice numbering
    .skip(offset)
    .limit(limit)
    .toArray();
    
    // For each payment, find matching registration and generate invoice
    const matches = [];
    const registrationsCollection = db.collection('registrations');
    
    // Track which registrations have already been matched to avoid duplicates
    const matchedRegistrationIds = new Set<string>();
    
    for (const payment of payments) {
      // Use the new multi-field matching system
      const matchResult = await findBestMatch(payment, registrationsCollection, matchedRegistrationIds);
      
      let registration = null;
      let bestMatchDetails: any[] = [];
      let bestConfidence = 0;
      
      if (matchResult) {
        registration = matchResult.registration;
        bestMatchDetails = convertToLegacyMatchDetails(matchResult.matches);
        bestConfidence = matchResult.confidence;
        
        // Mark as matched
        matchedRegistrationIds.add(registration._id.toString());
      }
      
      // Create match result for invoice preview generator
      let invoice = null;
      let matchDetails = [];
      let matchConfidence = 0;
      
      if (registration) {
        // Create a match result object compatible with InvoicePreviewGenerator
        const matchResult = {
          payment: {
            _id: payment._id?.toString(),
            paymentId: payment.paymentId,
            transactionId: payment.transactionId,
            amount: payment.amount || 0,
            timestamp: payment.timestamp,
            source: payment.source,
            customerEmail: payment.customerEmail,
            status: payment.status,
            metadata: payment.metadata,
            originalData: payment.originalData
          } as PaymentData,
          registration,
          matchConfidence: bestConfidence,
          matchMethod: 'multi_field',
          issues: [],
          matchDetails: bestMatchDetails
        };
        
        // Generate invoice preview using the updated generator
        const invoicePreview = await previewGenerator.generatePreview(matchResult);
        
        if (invoicePreview) {
          // Extract just the invoice data (without match details)
          const { matchDetails: _, paymentDetails: __, registrationDetails: ___, ...invoiceData } = invoicePreview;
          invoice = invoiceData;
          matchDetails = bestMatchDetails;
          matchConfidence = bestConfidence;
        }
      } else {
        // No registration match - create minimal invoice
        invoice = {
          invoiceNumber: 'PREVIEW-' + Date.now(),
          date: new Date(),
          status: 'paid',
          supplier: DEFAULT_INVOICE_SUPPLIER,
          billTo: {
            businessName: '',
            businessNumber: '',
            firstName: payment.customerName?.split(' ')[0] || 'Unknown',
            lastName: payment.customerName?.split(' ').slice(1).join(' ') || 'Customer',
            email: payment.customerEmail || 'no-email@lodgetix.io',
            addressLine1: 'Address not provided',
            city: 'Sydney',
            postalCode: '2000',
            stateProvince: 'NSW',
            country: 'AU'
          },
          items: [
            {
              description: 'Payment - No matching registration found',
              quantity: 1,
              price: payment.amount || 0
            }
          ],
          subtotal: payment.amount || 0,
          processingFees: 0,
          gstIncluded: Math.round((payment.amount || 0) * 0.10 * 100) / 100,
          total: payment.amount || 0,
          payment: {
            method: 'credit_card',
            transactionId: payment.transactionId,
            paidDate: payment.timestamp,
            amount: payment.amount || 0,
            currency: 'AUD',
            status: 'completed'
          },
          paymentId: payment._id?.toString()
        };
      }
      
      if (invoice) {
        matches.push({
          payment,
          registration,
          invoice,
          matchConfidence,
          matchDetails
        });
      }
    }
    
    // Get total count
    const totalCount = await paymentsCollection.countDocuments({
      status: 'paid',
      invoiceCreated: { $ne: true }
    });
    
    res.json({
      matches,
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount
    });
    
  } catch (error) {
    console.error('Error fetching invoice matches:', error);
    res.status(500).json({ error: 'Failed to fetch invoice matches' });
  }
});

// Get related documents for a registration
app.get('/api/registrations/:id/related', async (req, res) => {
  try {
    const { db } = await connectMongoDB();
    const { id } = req.params;
    
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid registration ID' });
      return;
    }
    
    // Get the registration
    const registrationsCollection = db.collection('registrations');
    const registration = await registrationsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!registration) {
      res.status(404).json({ error: 'Registration not found' });
      return;
    }
    
    const relatedDocs: any = {
      eventTickets: [],
      events: [],
      packages: [],
      lodges: [],
      customers: [],
      bookingContacts: [],
      functions: []
    };
    
    // Extract ticket IDs from registration
    const ticketIds: string[] = [];
    
    // Check for tickets in registrationData.tickets
    if (registration.registrationData?.tickets && Array.isArray(registration.registrationData.tickets)) {
      registration.registrationData.tickets.forEach((ticket: any) => {
        if (ticket.eventTicketId) {
          ticketIds.push(ticket.eventTicketId);
        }
        if (ticket.ticketDefinitionId) {
          ticketIds.push(ticket.ticketDefinitionId);
        }
      });
    }
    
    // Check for tickets in other possible locations
    if (registration.tickets && Array.isArray(registration.tickets)) {
      registration.tickets.forEach((ticket: any) => {
        if (typeof ticket === 'string') {
          ticketIds.push(ticket);
        } else if (ticket.eventTicketId) {
          ticketIds.push(ticket.eventTicketId);
        } else if (ticket.ticketDefinitionId) {
          ticketIds.push(ticket.ticketDefinitionId);
        }
      });
    }
    
    // Fetch eventTickets
    if (ticketIds.length > 0) {
      const eventTicketsCollection = db.collection('eventTickets');
      const objectIds = ticketIds
        .filter(id => ObjectId.isValid(id))
        .map(id => new ObjectId(id));
      
      let eventTickets: any[] = [];
      if (objectIds.length > 0) {
        eventTickets = await eventTicketsCollection.find({
          _id: { $in: objectIds }
        }).toArray();
      }
      
      // Also try with the ID as a regular field
      const eventTicketsByField = await eventTicketsCollection.find({
        $or: [
          { eventTicketId: { $in: ticketIds }},
          { ticketDefinitionId: { $in: ticketIds }},
          { id: { $in: ticketIds }}
        ]
      }).toArray();
      
      // Combine and deduplicate
      const allEventTickets = [...eventTickets, ...eventTicketsByField];
      const uniqueEventTickets = allEventTickets.filter((ticket, index, self) =>
        index === self.findIndex((t) => t._id?.toString() === ticket._id?.toString())
      );
      
      relatedDocs.eventTickets = uniqueEventTickets;
      
      // Extract event IDs from eventTickets
      const eventIds: string[] = [];
      uniqueEventTickets.forEach((ticket: any) => {
        if (ticket.eventId) {
          eventIds.push(ticket.eventId);
        }
      });
      
      // Fetch events
      if (eventIds.length > 0) {
        const eventsCollection = db.collection('events');
        const eventObjectIds = eventIds
          .filter(id => ObjectId.isValid(id))
          .map(id => new ObjectId(id));
        
        const eventQueries: any[] = [];
        if (eventObjectIds.length > 0) {
          eventQueries.push({ _id: { $in: eventObjectIds }});
        }
        eventQueries.push(
          { eventId: { $in: eventIds }},
          { id: { $in: eventIds }}
        );
        
        const events = await eventsCollection.find({
          $or: eventQueries
        }).toArray();
        
        relatedDocs.events = events;
      }
    }
    
    // Extract other IDs from registration
    const packageId = registration.packageId;
    const lodgeId = registration.lodgeId;
    const customerId = registration.customerId;
    const bookingContactId = registration.bookingContactId;
    const functionId = registration.functionId;
    
    // Fetch packages
    if (packageId) {
      const packagesCollection = db.collection('packages');
      const packageQueries: any[] = [];
      
      if (ObjectId.isValid(packageId)) {
        packageQueries.push({ _id: new ObjectId(packageId) });
      }
      packageQueries.push(
        { packageId: packageId },
        { id: packageId }
      );
      
      const packages = await packagesCollection.find({
        $or: packageQueries
      }).toArray();
      
      relatedDocs.packages = packages;
    }
    
    // Fetch lodges
    if (lodgeId) {
      const lodgesCollection = db.collection('lodges');
      const lodgeQueries: any[] = [];
      
      if (ObjectId.isValid(lodgeId)) {
        lodgeQueries.push({ _id: new ObjectId(lodgeId) });
      }
      lodgeQueries.push(
        { lodgeId: lodgeId },
        { id: lodgeId }
      );
      
      const lodges = await lodgesCollection.find({
        $or: lodgeQueries
      }).toArray();
      
      relatedDocs.lodges = lodges;
    }
    
    // Fetch customers
    if (customerId) {
      const customersCollection = db.collection('customers');
      const customerQueries: any[] = [];
      
      if (ObjectId.isValid(customerId)) {
        customerQueries.push({ _id: new ObjectId(customerId) });
      }
      customerQueries.push(
        { customerId: customerId },
        { id: customerId }
      );
      
      const customers = await customersCollection.find({
        $or: customerQueries
      }).toArray();
      
      relatedDocs.customers = customers;
    }
    
    // Fetch booking contacts (might be in attendees collection)
    if (bookingContactId) {
      // Try attendees collection first
      const attendeesCollection = db.collection('attendees');
      const contactQueries: any[] = [];
      
      if (ObjectId.isValid(bookingContactId)) {
        contactQueries.push({ _id: new ObjectId(bookingContactId) });
      }
      contactQueries.push(
        { attendeeId: bookingContactId },
        { bookingContactId: bookingContactId },
        { id: bookingContactId }
      );
      
      const contacts = await attendeesCollection.find({
        $or: contactQueries
      }).toArray();
      
      // If not found in attendees, try bookingContacts collection
      if (contacts.length === 0) {
        const bookingContactsCollection = db.collection('bookingContacts');
        const bookingContacts = await bookingContactsCollection.find({
          $or: contactQueries
        }).toArray();
        relatedDocs.bookingContacts = bookingContacts;
      } else {
        relatedDocs.bookingContacts = contacts;
      }
    }
    
    // Fetch functions
    if (functionId) {
      const functionsCollection = db.collection('functions');
      const functionQueries: any[] = [];
      
      if (ObjectId.isValid(functionId)) {
        functionQueries.push({ _id: new ObjectId(functionId) });
      }
      functionQueries.push(
        { functionId: functionId },
        { id: functionId }
      );
      
      const functions = await functionsCollection.find({
        $or: functionQueries
      }).toArray();
      
      relatedDocs.functions = functions;
    }
    
    res.json({
      success: true,
      registration,
      relatedDocuments: relatedDocs,
      summary: {
        ticketIds: ticketIds,
        eventTicketsFound: relatedDocs.eventTickets.length,
        eventsFound: relatedDocs.events.length,
        packagesFound: relatedDocs.packages.length,
        lodgesFound: relatedDocs.lodges.length,
        customersFound: relatedDocs.customers.length,
        bookingContactsFound: relatedDocs.bookingContacts.length,
        functionsFound: relatedDocs.functions.length
      }
    });
    
  } catch (error) {
    console.error('Error fetching related documents:', error);
    res.status(500).json({ error: 'Failed to fetch related documents' });
  }
});

// Update registration endpoint
app.patch('/api/registrations/:id', async (req, res) => {
  try {
    const { db } = await connectMongoDB();
    const { id } = req.params;
    const updates = req.body;
    
    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid registration ID' });
      return;
    }
    
    // Remove _id from updates to prevent modification
    delete updates._id;
    
    // Update the registration
    const registrationsCollection = db.collection('registrations');
    const result = await registrationsCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      res.status(404).json({ error: 'Registration not found' });
      return;
    }
    
    // Log the update for audit purposes
    console.log(`Updated registration ${id}:`, {
      timestamp: new Date(),
      registrationId: id,
      updatedFields: Object.keys(updates)
    });
    
    res.json({
      success: true,
      registration: result,
      message: 'Registration updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating registration:', error);
    res.status(500).json({ error: 'Failed to update registration' });
  }
});

app.post('/api/invoices/create', async (req, res) => {
  try {
    const { db } = await connectMongoDB();
    const { payment, registration, invoice, customerInvoice, supplierInvoice } = req.body;
    
    if (!payment || !invoice) {
      res.status(400).json({ error: 'Payment and invoice data are required' });
      return;
    }
    
    // Generate final invoice number for customer invoice
    const invoiceSequence = new InvoiceSequence(db);
    const customerInvoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber();
    
    // Extract the base number (without prefix) to use for supplier invoice
    const baseNumber = customerInvoiceNumber.replace('LTIV-', '');
    const supplierInvoiceNumber = `LTSP-${baseNumber}`;
    
    // Create invoice document with both customer and supplier invoices
    const invoiceDocument = {
      _id: new ObjectId(),
      customerInvoice: customerInvoice ? {
        ...customerInvoice,
        invoiceNumber: customerInvoiceNumber,
        invoiceType: 'customer'
      } : {
        ...invoice,
        invoiceNumber: customerInvoiceNumber,
        invoiceType: 'customer'
      },
      supplierInvoice: supplierInvoice ? {
        ...supplierInvoice,
        invoiceNumber: supplierInvoiceNumber,
        invoiceType: 'supplier'
      } : null,
      payment: {
        _id: payment._id,
        paymentId: payment.paymentId,
        transactionId: payment.transactionId,
        amount: payment.amount || payment.grossAmount,
        customerEmail: payment.customerEmail,
        customerName: payment.customerName,
        timestamp: payment.timestamp
      },
      registration: registration ? {
        _id: registration._id,
        registrationId: registration.registrationId,
        confirmationNumber: registration.confirmationNumber,
        functionName: registration.functionName,
        customerName: registration.customerName || registration.primaryAttendee
      } : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert invoice document
    const invoicesCollection = db.collection('invoices');
    const insertResult = await invoicesCollection.insertOne(invoiceDocument);
    
    // Update payment record
    const paymentsCollection = db.collection('payments');
    await paymentsCollection.updateOne(
      { _id: new ObjectId(payment._id) },
      { 
        $set: { 
          invoiceCreated: true,
          customerInvoiceNumber,
          supplierInvoiceNumber: supplierInvoice ? supplierInvoiceNumber : null,
          invoiceStatus: 'created',
          invoiceId: insertResult.insertedId,
          invoiceCreatedAt: new Date()
        }
      }
    );
    
    // Update registration record if exists
    if (registration && registration._id) {
      const registrationsCollection = db.collection('registrations');
      await registrationsCollection.updateOne(
        { _id: new ObjectId(registration._id) },
        { 
          $set: { 
            invoiceCreated: true,
            customerInvoiceNumber,
            supplierInvoiceNumber: supplierInvoice ? supplierInvoiceNumber : null,
            invoiceStatus: 'created',
            invoiceId: insertResult.insertedId,
            invoiceCreatedAt: new Date()
          }
        }
      );
    }
    
    res.json({
      success: true,
      invoiceNumber: customerInvoiceNumber,
      customerInvoiceNumber,
      supplierInvoiceNumber: supplierInvoice ? supplierInvoiceNumber : null,
      invoiceId: insertResult.insertedId,
      message: 'Invoice created successfully'
    });
    
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// ===== MIGRATION ENDPOINTS =====

// Initialize migration service
const migrationService = new MigrationService();

// Load default mappings on startup
migrationService.loadDefaultMappings().catch(console.error);

// Get default mapping for a collection
app.get('/api/migration/mappings/:collection', (_req, res) => {
  try {
    const collection = _req.params.collection;
    const defaultMapping = migrationService.getDefaultMapping(collection);
    
    if (!defaultMapping) {
      res.status(404).json({ error: `No default mapping found for collection: ${collection}` });
      return;
    }
    
    res.json({
      collection,
      mapping: defaultMapping
    });
  } catch (error) {
    console.error('Error fetching default mapping:', error);
    res.status(500).json({ error: 'Failed to fetch default mapping' });
  }
});

// Get all available default mappings
app.get('/api/migration/mappings', (_req, res) => {
  try {
    const collections = [
      'functions',
      'registrations',
      'tickets',
      'financial-transactions',
      'organisations',
      'contacts',
      'attendees',
      'users',
      'jurisdictions',
      'products'
    ];
    
    const mappings: Record<string, any> = {};
    
    for (const collection of collections) {
      const mapping = migrationService.getDefaultMapping(collection);
      if (mapping) {
        mappings[collection] = mapping;
      }
    }
    
    res.json({
      collections: Object.keys(mappings),
      mappings
    });
  } catch (error) {
    console.error('Error fetching all mappings:', error);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// Create document in destination database
app.post('/api/migration/collections/:name/documents', async (req, res) => {
  try {
    await connectBothDBs();
    const collectionName = req.params.name;
    const document = req.body;
    
    const destinationDb = getDestinationDb();
    const collection = destinationDb.collection(collectionName);
    
    // Check if already migrated
    if (document.sourceId) {
      const existing = await collection.findOne({
        'metadata.sourceId': document.sourceId
      });
      
      if (existing) {
        res.status(409).json({ 
          error: 'Document already migrated',
          existingId: existing._id
        });
        return;
      }
    }
    
    // Add metadata
    document.metadata = {
      ...document.metadata,
      migrated: true,
      migratedAt: new Date()
    };
    
    const result = await collection.insertOne(document);
    
    res.json({
      success: true,
      insertedId: result.insertedId,
      message: `Document created in destination ${collectionName}`
    });
    
  } catch (error) {
    console.error('Error creating document in destination:', error);
    res.status(500).json({ error: 'Failed to create document in destination' });
  }
});

// Process complex migration (with transactions)
app.post('/api/migration/process', async (req, res) => {
  try {
    await connectBothDBs();
    const { 
      sourceDocument,
      relatedDocuments,
      destinationCollection,
      mappings
    } = req.body;
    
    let result;
    
    switch (destinationCollection) {
      case 'functions':
        result = await migrationService.migrateFunction(sourceDocument, mappings);
        break;
        
      case 'registrations':
        result = await migrationService.migrateRegistration(
          sourceDocument,
          relatedDocuments || {},
          mappings
        );
        break;
        
      default:
        // Simple migration without transactions
        result = await migrationService.migrateSimpleDocument(
          sourceDocument,
          destinationCollection,
          mappings[destinationCollection] || {}
        );
    }
    
    res.json({
      success: true,
      result,
      message: `Successfully migrated to ${destinationCollection}`
    });
    
  } catch (error) {
    console.error('Error processing migration:', error);
    res.status(500).json({ 
      error: 'Failed to process migration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Check migration status
app.get('/api/migration/status/:collection/:sourceId', async (req, res) => {
  try {
    await connectBothDBs();
    const { collection, sourceId } = req.params;
    
    const isMigrated = await migrationService.isAlreadyMigrated(sourceId, collection);
    
    res.json({
      collection,
      sourceId,
      migrated: isMigrated
    });
    
  } catch (error) {
    console.error('Error checking migration status:', error);
    res.status(500).json({ error: 'Failed to check migration status' });
  }
});

// Get destination database stats
app.get('/api/migration/destination/stats', async (_, res) => {
  try {
    await connectBothDBs();
    const destinationDb = getDestinationDb();
    
    const collections = await destinationDb.listCollections().toArray();
    const stats: Record<string, any> = {};
    
    for (const col of collections) {
      const count = await destinationDb.collection(col.name).countDocuments();
      const migrated = await destinationDb.collection(col.name).countDocuments({
        'metadata.migrated': true
      });
      
      stats[col.name] = {
        total: count,
        migrated,
        nonMigrated: count - migrated
      };
    }
    
    res.json({
      database: process.env.NEW_MONGODB_DATABASE,
      collections: stats,
      totalDocuments: Object.values(stats).reduce((sum: number, s: any) => sum + s.total, 0),
      totalMigrated: Object.values(stats).reduce((sum: number, s: any) => sum + s.migrated, 0)
    });
    
  } catch (error) {
    console.error('Error fetching destination stats:', error);
    res.status(500).json({ error: 'Failed to fetch destination stats' });
  }
});

// Serve the HTML page
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Write port configuration to file for mongodb-explorer
async function writePortConfig(port: number) {
  const config = {
    apiPort: port,
    timestamp: new Date().toISOString()
  };
  
  await fs.mkdir(path.join(__dirname, '..'), { recursive: true });
  await fs.writeFile(
    path.join(__dirname, '../.port-config.json'),
    JSON.stringify(config, null, 2)
  );
}

// Start server with dynamic port
async function startServer() {
  try {
    const defaultPort = parseInt(process.env.API_PORT || '3006');
    const port = await findAvailablePort(defaultPort);
    
    // Write port config for mongodb-explorer
    await writePortConfig(port);
    
    const server = app.listen(port, () => {
      console.log(`🚀 API Server running at http://localhost:${port}`);
      if (port !== defaultPort) {
        console.log(`✨ Port ${defaultPort} was busy, automatically found port ${port}`);
      }
      console.log('\nPress Ctrl+C to stop the server');
    });
    
    // Handle server errors
    server.on('error', (error: any) => {
      console.error('❌ Server error:', error);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down server...');
  Promise.all([
    disconnectMongoDB(),
    disconnectBothDBs()
  ]).then(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down server...');
  Promise.all([
    disconnectMongoDB(),
    disconnectBothDBs()
  ]).then(() => {
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

startServer();