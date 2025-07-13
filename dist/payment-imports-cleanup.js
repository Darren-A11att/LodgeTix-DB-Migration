"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentImportsCleanupService = void 0;
class PaymentImportsCleanupService {
    constructor(db) {
        this.db = db;
    }
    /**
     * Clean up payment_imports by removing records that already exist in payments collection
     */
    async cleanupProcessedPayments(options = {}) {
        const dryRun = options.dryRun ?? true; // Default to dry run for safety
        const batchSize = options.batchSize ?? 100;
        console.log(`Starting payment_imports cleanup (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
        const stats = {
            total: 0,
            processed: 0,
            deleted: 0,
            errors: 0,
            details: []
        };
        try {
            // Get all payment IDs from the payments collection
            console.log('Loading payment IDs from payments collection...');
            const paymentsWithIds = await this.db.collection('payments')
                .find({ paymentId: { $exists: true, $ne: null } })
                .project({ paymentId: 1 })
                .toArray();
            const paymentIdSet = new Set(paymentsWithIds.map(p => p.paymentId));
            console.log(`Found ${paymentIdSet.size} payments in payments collection`);
            // Process payment_imports in batches
            let skip = 0;
            while (true) {
                const importBatch = await this.db.collection('payment_imports')
                    .find({})
                    .skip(skip)
                    .limit(batchSize)
                    .toArray();
                if (importBatch.length === 0)
                    break;
                stats.total += importBatch.length;
                for (const importRecord of importBatch) {
                    stats.processed++;
                    try {
                        // Check if this payment already exists in payments collection
                        if (paymentIdSet.has(importRecord.squarePaymentId)) {
                            const detail = {
                                _id: importRecord._id,
                                squarePaymentId: importRecord.squarePaymentId,
                                amount: importRecord.amount,
                                customerEmail: importRecord.customerEmail,
                                importedAt: importRecord.importedAt,
                                processingStatus: importRecord.processingStatus,
                                action: dryRun ? 'would_delete' : 'deleted'
                            };
                            stats.details.push(detail);
                            if (!dryRun) {
                                // Delete the duplicate record
                                await this.db.collection('payment_imports').deleteOne({
                                    _id: importRecord._id
                                });
                                stats.deleted++;
                                console.log(`Deleted duplicate payment_import: ${importRecord.squarePaymentId}`);
                            }
                            else {
                                stats.deleted++;
                                console.log(`[DRY RUN] Would delete duplicate: ${importRecord.squarePaymentId}`);
                            }
                        }
                    }
                    catch (error) {
                        console.error(`Error processing payment_import ${importRecord._id}:`, error);
                        stats.errors++;
                    }
                }
                skip += batchSize;
                // Progress update
                console.log(`Processed ${stats.processed}/${stats.total} records, found ${stats.deleted} duplicates`);
            }
            // Final summary
            console.log('\n=== Cleanup Summary ===');
            console.log(`Total payment_imports checked: ${stats.total}`);
            console.log(`Duplicates found: ${stats.deleted}`);
            console.log(`Errors: ${stats.errors}`);
            if (dryRun) {
                console.log('\n⚠️  This was a DRY RUN - no records were actually deleted');
                console.log('Run with dryRun: false to actually delete duplicates');
            }
        }
        catch (error) {
            console.error('Cleanup process failed:', error);
            throw error;
        }
        return stats;
    }
    /**
     * Get statistics about payment_imports vs payments overlap
     */
    async getOverlapStatistics() {
        console.log('Analyzing payment_imports overlap with payments collection...');
        // Get counts
        const paymentImportsTotal = await this.db.collection('payment_imports').countDocuments();
        const paymentsTotal = await this.db.collection('payments').countDocuments();
        // Find duplicates
        const paymentsWithIds = await this.db.collection('payments')
            .find({ paymentId: { $exists: true, $ne: null } })
            .project({ paymentId: 1 })
            .toArray();
        const paymentIdSet = new Set(paymentsWithIds.map(p => p.paymentId));
        // Check payment_imports for duplicates
        const duplicates = await this.db.collection('payment_imports')
            .find({ squarePaymentId: { $in: Array.from(paymentIdSet) } })
            .limit(10) // Show first 10 examples
            .toArray();
        const duplicatesCount = await this.db.collection('payment_imports')
            .countDocuments({ squarePaymentId: { $in: Array.from(paymentIdSet) } });
        const duplicateDetails = duplicates.map(d => ({
            squarePaymentId: d.squarePaymentId,
            amount: d.amount,
            customerEmail: d.customerEmail,
            importedAt: d.importedAt,
            processingStatus: d.processingStatus
        }));
        return {
            paymentImportsTotal,
            paymentsTotal,
            duplicatesCount,
            duplicateDetails
        };
    }
    /**
     * Mark payment_imports records as processed instead of deleting
     * Alternative approach if you want to keep records for audit
     */
    async markAsProcessed(options = {}) {
        const dryRun = options.dryRun ?? true;
        const batchSize = options.batchSize ?? 100;
        console.log(`Marking processed payments (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
        const stats = {
            total: 0,
            updated: 0,
            errors: 0
        };
        // Get all payment IDs from payments collection
        const paymentsWithIds = await this.db.collection('payments')
            .find({ paymentId: { $exists: true, $ne: null } })
            .project({ paymentId: 1 })
            .toArray();
        const paymentIdSet = new Set(paymentsWithIds.map(p => p.paymentId));
        // Update payment_imports that exist in payments
        const filter = {
            squarePaymentId: { $in: Array.from(paymentIdSet) },
            processingStatus: { $ne: 'imported' }
        };
        stats.total = await this.db.collection('payment_imports').countDocuments(filter);
        if (!dryRun) {
            const result = await this.db.collection('payment_imports').updateMany(filter, {
                $set: {
                    processingStatus: 'imported',
                    processedAt: new Date(),
                    processedBy: 'cleanup-service'
                }
            });
            stats.updated = result.modifiedCount || 0;
        }
        else {
            stats.updated = stats.total;
        }
        console.log(`\nMarked ${stats.updated} records as imported`);
        return stats;
    }
}
exports.PaymentImportsCleanupService = PaymentImportsCleanupService;
