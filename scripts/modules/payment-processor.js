const { ObjectId } = require('mongodb');
const { safeObjectId } = require('../fix-objectid-validation');

/**
 * Payment Processor Module
 * Handles payment import processing with clean separation of concerns
 */
class PaymentProcessor {
  constructor(db) {
    this.db = db;
    this.stats = {
      paymentsProcessed: 0,
      registrationsProcessed: 0,
      attendeesExtracted: 0,
      ticketsExtracted: 0,
      matchesCreated: 0,
      skipped: 0,
      failed: 0
    };
  }

  /**
   * Process a single payment with proper error handling
   */
  async processPayment(stagedPayment) {
    const paymentId = this.extractPaymentId(stagedPayment);
    
    if (!paymentId) {
      throw new Error('No valid payment ID found');
    }

    console.log(`Processing payment: ${paymentId}`);

    // Check for duplicate
    if (await this.isDuplicatePayment(paymentId)) {
      console.log(`  ⏭️  Skipping duplicate payment`);
      this.stats.skipped++;
      await this.markPaymentProcessed(stagedPayment._id, 'skipped', null, 'Duplicate payment already exists');
      return;
    }

    // Find matching registration
    const matchingRegistration = await this.findMatchingRegistration(paymentId);
    if (!matchingRegistration) {
      throw new Error(`No matching registration found for payment ${paymentId}`);
    }

    console.log(`  ✓ Found matching registration: ${matchingRegistration.confirmationNumber}`);

    // Process registration and get ID
    const registrationId = await this.processRegistration(matchingRegistration, paymentId);

    // Insert payment with match information
    await this.insertPaymentWithMatch(stagedPayment, registrationId);

    // Mark as processed
    await this.markPaymentProcessed(stagedPayment._id, 'imported', registrationId);
    
    console.log(`  ✅ Payment processed successfully with match`);
  }

  /**
   * Extract payment ID from staged payment record
   */
  extractPaymentId(stagedPayment) {
    return stagedPayment.squarePaymentId || 
           stagedPayment.stripePaymentId || 
           stagedPayment.paymentId;
  }

  /**
   * Check if payment already exists
   */
  async isDuplicatePayment(paymentId) {
    const existing = await this.db.collection('payments').findOne({
      $or: [
        { paymentId: paymentId },
        { squarePaymentId: paymentId },
        { stripePaymentId: paymentId }
      ]
    });
    return !!existing;
  }

  /**
   * Find matching registration for payment
   */
  async findMatchingRegistration(paymentId) {
    const query = {
      $and: [
        {
          $or: [
            { processed: false },
            { processed: { $exists: false } }
          ]
        },
        {
          $or: [
            { stripePaymentIntentId: paymentId },
            { squarePaymentId: paymentId },
            { 'registrationData.stripePaymentIntentId': paymentId },
            { 'registrationData.squarePaymentId': paymentId },
            { 'registrationData.stripe_payment_intent_id': paymentId },
            { 'registrationData.square_payment_id': paymentId }
          ]
        }
      ]
    };
    
    return await this.db.collection('registration_imports').findOne(query);
  }

  /**
   * Process registration and return its ID
   */
  async processRegistration(matchingRegistration, paymentId) {
    const existingRegistration = await this.db.collection('registrations').findOne({
      registrationId: matchingRegistration.registrationId
    });

    if (existingRegistration) {
      console.log(`  - Registration already exists in production - preserving it`);
      await this.markRegistrationProcessed(
        matchingRegistration._id, 
        'skipped_exists_in_production',
        existingRegistration._id
      );
      return existingRegistration._id;
    }

    // Transform and insert new registration
    const transformedData = await this.transformRegistrationData(matchingRegistration);
    const insertResult = await this.db.collection('registrations').insertOne({
      ...transformedData,
      importedAt: new Date(),
      importedFrom: 'staged_import'
    });

    this.stats.registrationsProcessed++;
    
    // Update stats for extracted data
    if (transformedData.registrationData?.attendees?.length > 0) {
      this.stats.attendeesExtracted += transformedData.registrationData.attendees.length;
    }
    if (transformedData.registrationData?.tickets?.length > 0) {
      this.stats.ticketsExtracted += transformedData.registrationData.tickets.length;
    }

    await this.markRegistrationProcessed(matchingRegistration._id, 'imported');
    
    return insertResult.insertedId;
  }

  /**
   * Transform registration data (simplified version)
   */
  async transformRegistrationData(registration) {
    const { _id, processed, processedAt, ...registrationData } = registration;
    
    // Note: In a real implementation, this would call the full 
    // transformRegistrationDataWithExtraction function
    return registrationData;
  }

  /**
   * Insert payment with match information
   */
  async insertPaymentWithMatch(stagedPayment, registrationId) {
    const paymentData = this.transformPaymentImport(stagedPayment);
    
    // Add match information
    paymentData.matchedRegistrationId = registrationId ? registrationId.toString() : null;
    paymentData.matchedAt = new Date();
    paymentData.matchedBy = 'staged_import_processor';
    paymentData.matchMethod = 'paymentId';
    paymentData.matchConfidence = 100;
    
    await this.db.collection('payments').insertOne(paymentData);
    
    this.stats.paymentsProcessed++;
    this.stats.matchesCreated++;
  }

  /**
   * Transform payment import to main format
   */
  transformPaymentImport(importRecord) {
    return {
      paymentId: importRecord.squarePaymentId || importRecord.stripePaymentId,
      transactionId: importRecord.transactionId || importRecord.orderId,
      squarePaymentId: importRecord.squarePaymentId,
      stripePaymentId: importRecord.stripePaymentId,
      source: importRecord.squarePaymentId ? 'square' : 'stripe',
      customerName: importRecord.customerName || 'Unknown',
      customerEmail: importRecord.customerEmail,
      customerId: importRecord.buyerId || importRecord.customerId,
      amount: importRecord.amount,
      currency: importRecord.currency || 'AUD',
      status: this.mapPaymentStatus(importRecord.status),
      paymentMethod: importRecord.paymentMethod,
      cardBrand: importRecord.cardBrand,
      cardLast4: importRecord.last4,
      timestamp: importRecord.createdAt,
      createdAt: importRecord.createdAt,
      updatedAt: importRecord.updatedAt || importRecord.createdAt,
      importedAt: new Date(),
      receiptUrl: importRecord.receiptUrl,
      receiptNumber: importRecord.receiptNumber,
      originalData: importRecord.rawSquareData || importRecord.originalData
    };
  }

  /**
   * Map payment status to standard format
   */
  mapPaymentStatus(status) {
    const statusMap = {
      'COMPLETED': 'paid',
      'APPROVED': 'paid',
      'PENDING': 'pending',
      'FAILED': 'failed',
      'CANCELED': 'cancelled'
    };
    return statusMap[status] || status?.toLowerCase() || 'unknown';
  }

  /**
   * Mark payment as processed in staging
   */
  async markPaymentProcessed(paymentId, status, registrationId = null, reason = null) {
    const update = {
      processed: true,
      processedAt: new Date(),
      processedStatus: status
    };
    
    if (registrationId) {
      update.matchedRegistrationId = registrationId.toString();
    }
    
    if (reason) {
      update.processingNote = reason;
    }
    
    await this.db.collection('payment_imports').updateOne(
      { _id: paymentId },
      { $set: update }
    );
  }

  /**
   * Mark registration as processed in staging
   */
  async markRegistrationProcessed(registrationId, status, productionId = null) {
    const update = {
      processed: true,
      processedAt: new Date(),
      processedStatus: status
    };
    
    if (productionId) {
      update.productionRegistrationId = productionId;
    }
    
    await this.db.collection('registration_imports').updateOne(
      { _id: registrationId },
      { $set: update }
    );
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return { ...this.stats };
  }
}

module.exports = PaymentProcessor;