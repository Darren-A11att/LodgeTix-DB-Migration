import 'dotenv/config';
import { connectMongoDB } from '../connections/mongodb';
import { Collection } from 'mongodb';
import { SquareClient, SquareEnvironment } from 'square';
import { roundToTwoDecimals, parsePrice } from '../utils/number-helpers';

// Handle BigInt serialization
// @ts-ignore
BigInt.prototype.toJSON = function() {
  return this.toString();
};

interface Registration {
  _id?: any;
  registrationId: string;
  confirmationNumber: string;
  paymentStatus: string;
  stripePaymentIntentId?: string;
  squarePaymentId?: string;
  totalAmountPaid?: number;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

interface Payment {
  paymentId: string;
  transactionId: string;
  status: string;
  grossAmount: number;
  source: 'square' | 'stripe';
}

interface PendingImport extends Registration {
  pendingSince: Date;
  attemptedPaymentIds: string[];
  lastCheckDate: Date;
  checkCount: number;
  reason: string;
}

class PendingImportProcessor {
  private registrationsCollection!: Collection<Registration>;
  private paymentsCollection!: Collection<Payment>;
  private pendingImportsCollection!: Collection<PendingImport>;
  private failedRegistrationsCollection!: Collection<any>;
  private squareClient: SquareClient;
  private db!: any;
  
  constructor() {
    this.squareClient = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment: SquareEnvironment.Production
    });
  }
  
  async initialize() {
    const connection = await connectMongoDB();
    this.db = connection.db;
    this.registrationsCollection = connection.db.collection<Registration>('registrations');
    this.paymentsCollection = connection.db.collection<Payment>('payments');
    this.pendingImportsCollection = connection.db.collection<PendingImport>('registration_imports');
    this.failedRegistrationsCollection = connection.db.collection('failedRegistrations');
  }
  
  async processPendingImports(options: { maxRetries?: number; batchSize?: number } = {}) {
    const maxRetries = options.maxRetries || 5;
    const batchSize = options.batchSize || 50;
    
    console.log('🔄 Processing pending imports...\n');
    
    // Get pending imports that haven't exceeded retry limit
    const pendingImports = await this.pendingImportsCollection
      .find({ checkCount: { $lt: maxRetries } })
      .sort({ pendingSince: 1 }) // Process oldest first
      .limit(batchSize)
      .toArray();
    
    if (pendingImports.length === 0) {
      console.log('No pending imports to process.');
      return;
    }
    
    console.log(`Found ${pendingImports.length} pending imports to check\n`);
    
    const stats = {
      resolved: 0,
      stillPending: 0,
      failed: 0,
      apiChecked: 0
    };
    
    for (const pending of pendingImports) {
      console.log(`\nProcessing: ${pending.confirmationNumber}`);
      console.log(`  Pending since: ${pending.pendingSince.toLocaleDateString()}`);
      console.log(`  Check count: ${pending.checkCount + 1}/${maxRetries}`);
      
      // First check local database
      const paymentFound = await this.checkLocalPayments(pending);
      
      if (paymentFound) {
        await this.resolveRegistration(pending);
        stats.resolved++;
        console.log(`  ✅ Resolved - payment found in database`);
        continue;
      }
      
      // Check Square API directly if we have a Square payment ID
      if (pending.squarePaymentId && pending.checkCount >= 2) {
        console.log(`  🔍 Checking Square API for payment ${pending.squarePaymentId}...`);
        const apiPayment = await this.checkSquareAPI(pending.squarePaymentId);
        
        if (apiPayment) {
          // Import the payment to our database
          await this.importSquarePayment(apiPayment);
          await this.resolveRegistration(pending);
          stats.resolved++;
          stats.apiChecked++;
          console.log(`  ✅ Resolved - payment found in Square API and imported`);
          continue;
        }
      }
      
      // Update check count
      await this.pendingImportsCollection.updateOne(
        { _id: pending._id },
        {
          $set: {
            lastCheckDate: new Date(),
            reason: this.getUpdatedReason(pending)
          },
          $inc: { checkCount: 1 }
        }
      );
      
      // Check if we should move to failed
      if (pending.checkCount + 1 >= maxRetries) {
        await this.moveToFailed(pending);
        stats.failed++;
        console.log(`  ❌ Moved to failed - exceeded retry limit`);
      } else {
        stats.stillPending++;
        console.log(`  ⏳ Still pending - will retry later`);
      }
    }
    
    // Process summary
    console.log('\n' + '='.repeat(60));
    console.log('PROCESSING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Processed: ${pendingImports.length} pending imports`);
    console.log(`Resolved: ${stats.resolved} (${stats.apiChecked} from API)`);
    console.log(`Still pending: ${stats.stillPending}`);
    console.log(`Failed: ${stats.failed}`);
    
    // Show remaining pending count
    const remainingCount = await this.pendingImportsCollection.countDocuments({
      checkCount: { $lt: maxRetries }
    });
    console.log(`\nRemaining pending imports: ${remainingCount}`);
    
    if (remainingCount > batchSize) {
      console.log(`ℹ️  Run again to process more pending imports`);
    }
  }
  
  private async checkLocalPayments(registration: PendingImport): Promise<boolean> {
    // Check Square payment
    if (registration.squarePaymentId) {
      const squarePayment = await this.paymentsCollection.findOne({
        paymentId: registration.squarePaymentId,
        source: 'square',
        status: { $in: ['paid', 'completed'] }
      });
      
      if (squarePayment) {
        return true;
      }
    }
    
    // Check Stripe payment
    if (registration.stripePaymentIntentId) {
      const stripePayment = await this.paymentsCollection.findOne({
        paymentId: registration.stripePaymentIntentId,
        source: 'stripe',
        status: { $in: ['paid', 'succeeded'] }
      });
      
      if (stripePayment) {
        return true;
      }
    }
    
    return false;
  }
  
  private async checkSquareAPI(paymentId: string): Promise<any> {
    try {
      const response = await this.squareClient.payments.get({ paymentId });
      
      if (response.payment && response.payment.status === 'COMPLETED') {
        return response.payment;
      }
    } catch (error) {
      console.log(`    API error: Payment not found or inaccessible`);
    }
    
    return null;
  }
  
  private async importSquarePayment(squarePayment: any) {
    const payment = {
      paymentId: squarePayment.id,
      transactionId: squarePayment.orderId || squarePayment.id,
      source: 'square' as const,
      status: 'paid',
      timestamp: new Date(squarePayment.createdAt),
      grossAmount: squarePayment.amountMoney ? roundToTwoDecimals(Number(squarePayment.amountMoney.amount) / 100) : 0,
      customerName: squarePayment.shippingAddress?.name || 'Unknown',
      squareData: squarePayment,
      importedFromAPI: true,
      importedAt: new Date()
    };
    
    await this.paymentsCollection.updateOne(
      { paymentId: payment.paymentId },
      { $set: payment },
      { upsert: true }
    );
  }
  
  private async resolveRegistration(pending: PendingImport) {
    // Remove pending-specific fields
    const { _id, pendingSince, attemptedPaymentIds, lastCheckDate, checkCount, reason, ...registration } = pending;
    
    // Initialize audit log array to track all transformations
    const auditLog: any[] = [];
    
    // Transform tickets if present
    let transformedData = { ...registration };
    const regData = registration.registrationData || registration.registration_data;
    
    if (regData) {
      // Check for selectedTickets that need transformation
      const selectedTickets = regData.selectedTickets || [];
      
      if (selectedTickets.length > 0 && selectedTickets.some((t: any) => t.attendeeId)) {
        // This registration has selectedTickets that need transformation
        const isIndividual = registration.registrationType === 'individuals' || 
                            registration.registrationType === 'individual';
        
        const transformedTickets: any[] = [];
        const ticketTransformations: any[] = [];
        
        // Fetch event ticket information for enrichment
        const eventTicketIds = selectedTickets.map((t: any) => 
          t.event_ticket_id || t.eventTicketId || t.ticketDefinitionId || t.eventTicketsId
        ).filter(Boolean);
        
        const eventTickets = await this.db.collection('eventTickets').find({
          $or: [
            { eventTicketId: { $in: eventTicketIds } },
            { event_ticket_id: { $in: eventTicketIds } }
          ]
        }).toArray();
        
        const ticketInfoMap = new Map();
        eventTickets.forEach(et => {
          const id = et.eventTicketId || et.event_ticket_id;
          ticketInfoMap.set(id, {
            name: et.name || '',
            price: parsePrice(et.price)
          });
        });
        
        selectedTickets.forEach((selectedTicket: any, index: number) => {
          const eventTicketId = selectedTicket.event_ticket_id || 
                               selectedTicket.eventTicketId || 
                               selectedTicket.ticketDefinitionId ||
                               selectedTicket.eventTicketsId;
          
          if (!eventTicketId) {
            console.warn(`No event ticket ID found for ticket in registration ${registration.registrationId}`);
            return;
          }
          
          const ticketInfo = ticketInfoMap.get(eventTicketId) || {};
          const quantity = selectedTicket.quantity || 1;
          
          // CRITICAL: Direct 1:1 mapping - NO COMPUTATIONS
          let ownerId: string;
          let ownerType: 'attendee' | 'lodge';
          
          if (isIndividual && selectedTicket.attendeeId) {
            // DIRECT MAPPING: attendeeId -> ownerId
            ownerType = 'attendee';
            ownerId = selectedTicket.attendeeId;
          } else if (!isIndividual) {
            ownerType = 'lodge';
            ownerId = regData.lodgeDetails?.lodgeId || 
                     regData.lodgeId || 
                     registration.organisationId ||
                     registration.organisation_id ||
                     registration.registrationId;
          } else {
            // This should not happen - log error
            console.error(`ERROR: Individual ticket without attendeeId in registration ${registration.registrationId}`);
            ownerType = 'attendee';
            ownerId = registration.registrationId; // Fallback only
          }
          
          const transformedTicket = {
            eventTicketId: eventTicketId,
            name: ticketInfo.name || selectedTicket.name || 'Unknown Ticket',
            price: ticketInfo.price !== undefined ? ticketInfo.price : parsePrice(selectedTicket.price),
            quantity: quantity,
            ownerType: ownerType,
            ownerId: ownerId
          };
          
          transformedTickets.push(transformedTicket);
          
          // Detailed audit log for this ticket transformation
          const ticketAudit = {
            ticketIndex: index,
            originalId: selectedTicket.id,
            transformations: []
          };
          
          // Track field mappings and changes
          ticketAudit.transformations.push({
            field: 'structure',
            action: 'restructure',
            from: 'selectedTickets[' + index + ']',
            to: 'tickets[' + index + ']'
          });
          
          if (selectedTicket.id) {
            ticketAudit.transformations.push({
              field: 'id',
              action: 'delete',
              oldValue: selectedTicket.id,
              reason: 'Composite ID not needed in new structure'
            });
          }
          
          ticketAudit.transformations.push({
            field: 'event_ticket_id',
            action: 'rename',
            from: 'event_ticket_id',
            to: 'eventTicketId',
            value: eventTicketId
          });
          
          if (ticketInfo.name && ticketInfo.name !== selectedTicket.name) {
            ticketAudit.transformations.push({
              field: 'name',
              action: selectedTicket.name ? 'update' : 'add',
              from: selectedTicket.name || null,
              to: ticketInfo.name,
              source: 'eventTickets collection lookup'
            });
          }
          
          const originalPrice = parsePrice(selectedTicket.price);
          if (ticketInfo.price !== undefined && ticketInfo.price !== originalPrice) {
            ticketAudit.transformations.push({
              field: 'price',
              action: 'update',
              from: originalPrice,
              to: ticketInfo.price,
              source: 'eventTickets collection lookup'
            });
          }
          
          if (!selectedTicket.quantity) {
            ticketAudit.transformations.push({
              field: 'quantity',
              action: 'add',
              from: null,
              to: 1,
              reason: 'Default quantity when not specified'
            });
          }
          
          ticketAudit.transformations.push({
            field: 'ownerType',
            action: 'add',
            from: null,
            to: ownerType,
            reason: `Determined by registrationType: ${registration.registrationType}`
          });
          
          ticketAudit.transformations.push({
            field: 'attendeeId',
            action: 'rename',
            from: 'attendeeId',
            to: 'ownerId',
            oldValue: selectedTicket.attendeeId,
            newValue: ownerId,
            preserved: selectedTicket.attendeeId === ownerId
          });
          
          ticketTransformations.push(ticketAudit);
        });
        
        // Update registration data with transformed tickets
        const updatePath = registration.registrationData ? 'registrationData' : 'registration_data';
        if (updatePath === 'registrationData') {
          transformedData.registrationData = {
            ...regData,
            tickets: transformedTickets,
            selectedTickets: undefined // Remove old format
          };
        } else {
          transformedData.registration_data = {
            ...regData,
            tickets: transformedTickets,
            selectedTickets: undefined // Remove old format
          };
        }
        
        // Record transformation in audit log
        auditLog.push({
          timestamp: new Date(),
          action: 'transform_tickets',
          description: 'Transformed selectedTickets array to tickets array with owner structure',
          summary: {
            ticketsTransformed: transformedTickets.length,
            registrationType: registration.registrationType,
            attendeeIdsPreserved: ticketTransformations.filter(t => 
              t.transformations.some((tr: any) => tr.field === 'attendeeId' && tr.preserved)
            ).length,
            dataLossDetected: ticketTransformations.some(t => 
              t.transformations.some((tr: any) => tr.field === 'attendeeId' && !tr.preserved)
            )
          },
          fieldChanges: [
            {
              field: 'selectedTickets',
              action: 'rename',
              from: 'selectedTickets',
              to: 'tickets'
            },
            {
              field: 'selectedTickets',
              action: 'delete',
              reason: 'Replaced by tickets array'
            }
          ],
          ticketTransformations: ticketTransformations
        });
      }
    }
    
    // Add import audit entry
    auditLog.push({
      timestamp: new Date(),
      action: 'imported_from_registration_imports',
      description: 'Imported from registration_imports collection after payment verification',
      details: {
        pendingSince: pendingSince,
        checkCount: checkCount + 1,
        pendingReason: reason,
        paymentVerified: true,
        importSource: 'registration_imports'
      }
    });
    
    // Insert into main registrations collection with transformations and audit log
    await this.registrationsCollection.insertOne({
      ...transformedData,
      importedAt: new Date(),
      paymentVerified: true,
      previouslyPendingSince: pendingSince,
      resolvedAfterChecks: checkCount + 1,
      auditLog: auditLog
    });
    
    // Remove from pending imports
    await this.pendingImportsCollection.deleteOne({ _id });
  }
  
  private async moveToFailed(pending: PendingImport) {
    await this.failedRegistrationsCollection.insertOne({
      ...pending,
      failureReason: 'Payment verification failed after maximum retries',
      failedAt: new Date(),
      finalCheckCount: pending.checkCount + 1
    });
    
    await this.pendingImportsCollection.deleteOne({ _id: pending._id });
  }
  
  private getUpdatedReason(registration: PendingImport): string {
    const reasons = [];
    
    if (registration.squarePaymentId) {
      reasons.push(`Square payment ${registration.squarePaymentId} not found or not completed`);
    }
    
    if (registration.stripePaymentIntentId) {
      reasons.push(`Stripe payment ${registration.stripePaymentIntentId} not found or not completed`);
    }
    
    if (reasons.length === 0) {
      reasons.push('No payment ID provided');
    }
    
    return reasons.join('; ');
  }
  
  async showPendingStatistics() {
    console.log('\n📊 Pending Import Statistics\n');
    
    const total = await this.pendingImportsCollection.countDocuments();
    const byCheckCount = await this.pendingImportsCollection.aggregate([
      {
        $group: {
          _id: '$checkCount',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    const oldestPending = await this.pendingImportsCollection
      .find()
      .sort({ pendingSince: 1 })
      .limit(1)
      .toArray();
    
    console.log(`Total pending imports: ${total}`);
    
    if (byCheckCount.length > 0) {
      console.log('\nBy check count:');
      byCheckCount.forEach(item => {
        console.log(`  ${item._id} checks: ${item.count} registrations`);
      });
    }
    
    if (oldestPending.length > 0) {
      const oldest = oldestPending[0];
      const daysPending = Math.floor((Date.now() - oldest.pendingSince.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`\nOldest pending: ${oldest.confirmationNumber}`);
      console.log(`  Pending for: ${daysPending} days`);
      console.log(`  Reason: ${oldest.reason}`);
    }
    
    // Show sample of recent additions
    const recentPending = await this.pendingImportsCollection
      .find()
      .sort({ pendingSince: -1 })
      .limit(5)
      .toArray();
    
    if (recentPending.length > 0) {
      console.log('\nRecent pending imports:');
      recentPending.forEach(reg => {
        console.log(`  ${reg.confirmationNumber} - ${reg.pendingSince.toLocaleDateString()}`);
      });
    }
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx tsx process-pending-imports.ts [options]

Options:
  --max-retries <n>   Maximum retry attempts before failing (default: 5)
  --batch-size <n>    Number of pending imports to process (default: 50)
  --stats             Show statistics only, don't process
  --help              Show this help message

This script processes registrations in the pending-imports collection:
- Checks if their payments have arrived
- Moves them to main registrations collection if payment found
- Checks Square API directly after 2 attempts
- Moves to failed collection after max retries
    `);
    process.exit(0);
  }
  
  const processor = new PendingImportProcessor();
  await processor.initialize();
  
  if (args.includes('--stats')) {
    await processor.showPendingStatistics();
  } else {
    const maxRetries = parseInt(args[args.indexOf('--max-retries') + 1]) || 5;
    const batchSize = parseInt(args[args.indexOf('--batch-size') + 1]) || 50;
    
    await processor.processPendingImports({ maxRetries, batchSize });
  }
}

// Run the processor
main().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});