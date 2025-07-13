"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SquarePaymentReconciliationService = void 0;
const square_1 = require("square");
class SquarePaymentReconciliationService {
    constructor(db, squareAccessToken, environment = 'production') {
        this.db = db;
        console.log('Initializing Square Payment Reconciliation Service...');
        console.log('Environment:', environment);
        console.log('Token exists:', !!squareAccessToken);
        this.squareClient = new square_1.SquareClient({
            token: squareAccessToken,
            environment: environment === 'production' ? square_1.SquareEnvironment.Production : square_1.SquareEnvironment.Sandbox
        });
        this.getPaymentsCollection = db.collection('get_payments');
        this.paymentsCollection = db.collection('payments');
        // Ensure TTL index for 7-day retention
        this.ensureTTLIndex();
    }
    /**
     * Ensure TTL index exists for automatic deletion after 7 days
     */
    async ensureTTLIndex() {
        try {
            await this.getPaymentsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_index' });
            console.log('TTL index ensured for get_payments collection');
        }
        catch (error) {
            console.error('Error creating TTL index:', error);
        }
    }
    /**
     * Fetch payments from Square and store in get_payments collection
     */
    async fetchAndStoreSquarePayments(options = {}) {
        const stats = {
            fetchedCount: 0,
            newCount: 0,
            errors: []
        };
        try {
            let cursor;
            const endDate = options.endDate || new Date();
            const startDate = options.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default 7 days back
            console.log('Fetching Square payments...');
            console.log('Date range:', startDate.toISOString(), 'to', endDate.toISOString());
            do {
                const response = await this.squareClient.payments.list({
                    beginTime: startDate.toISOString(),
                    endTime: endDate.toISOString(),
                    sortOrder: 'DESC', // Newest first
                    cursor: cursor,
                    limit: options.limit || 100
                });
                // Handle response structure variations
                const payments = response.response?.payments || response.result?.payments || [];
                cursor = response.response?.cursor || response.result?.cursor;
                console.log(`Fetched ${payments.length} payments from Square`);
                stats.fetchedCount += payments.length;
                // Process each payment
                for (const squarePayment of payments) {
                    try {
                        // Check if we already have this payment
                        const existing = await this.getPaymentsCollection.findOne({
                            squarePaymentId: squarePayment.id
                        });
                        if (!existing) {
                            // Store new payment record
                            const record = {
                                squarePaymentId: squarePayment.id,
                                status: 'new',
                                fetchedAt: new Date(),
                                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expire in 7 days
                                squareData: squarePayment
                            };
                            await this.getPaymentsCollection.insertOne(record);
                            stats.newCount++;
                        }
                        else {
                            // Update existing record with latest data
                            await this.getPaymentsCollection.updateOne({ squarePaymentId: squarePayment.id }, {
                                $set: {
                                    fetchedAt: new Date(),
                                    squareData: squarePayment
                                }
                            });
                        }
                    }
                    catch (error) {
                        console.error(`Error processing payment ${squarePayment.id}:`, error);
                        stats.errors.push({ paymentId: squarePayment.id, error: error.message });
                    }
                }
                // Stop if no cursor or reached limit
                if (!cursor || (options.limit && stats.fetchedCount >= options.limit)) {
                    break;
                }
            } while (true);
        }
        catch (error) {
            console.error('Error fetching Square payments:', error);
            stats.errors.push({ error: error.message, phase: 'fetch' });
        }
        return stats;
    }
    /**
     * Reconcile stored Square payments with database payments
     */
    async reconcilePayments(options = {}) {
        const stats = {
            processed: 0,
            matched: 0,
            discrepancies: 0,
            errors: 0
        };
        const query = options.onlyNew ? { status: 'new' } : {};
        const batchSize = options.batchSize || 100;
        const squarePayments = await this.getPaymentsCollection
            .find(query)
            .limit(batchSize)
            .toArray();
        console.log(`Processing ${squarePayments.length} Square payments for reconciliation`);
        for (const squareRecord of squarePayments) {
            try {
                const result = await this.reconcileSinglePayment(squareRecord);
                stats.processed++;
                if (result.matchFound && !result.discrepancies?.length) {
                    stats.matched++;
                }
                else if (result.discrepancies?.length) {
                    stats.discrepancies++;
                }
                // Update the record with reconciliation result
                await this.getPaymentsCollection.updateOne({ _id: squareRecord._id }, {
                    $set: {
                        status: result.discrepancies?.length ? 'discrepancy' : 'checked',
                        reconciliationResult: result
                    }
                });
            }
            catch (error) {
                console.error(`Error reconciling payment ${squareRecord.squarePaymentId}:`, error);
                stats.errors++;
            }
        }
        return stats;
    }
    /**
     * Reconcile a single Square payment with database
     */
    async reconcileSinglePayment(squareRecord) {
        const squarePayment = squareRecord.squareData;
        const result = {
            checkedAt: new Date(),
            matchFound: false,
            discrepancies: []
        };
        // Find matching payment in database by paymentId
        const dbPayment = await this.paymentsCollection.findOne({
            paymentId: squarePayment.id
        });
        if (!dbPayment) {
            // No match found - this might be a new payment
            return result;
        }
        result.matchFound = true;
        result.databasePaymentId = dbPayment._id.toString();
        // Compare fields
        const matchedFields = {
            amount: false,
            status: false,
            cardLast4: false,
            updatedAt: false
        };
        const discrepancies = [];
        // 1. Compare amount
        const squareAmountDollars = squarePayment.amountMoney ?
            squarePayment.amountMoney.amount / 100 : 0;
        if (Math.abs(squareAmountDollars - dbPayment.grossAmount) < 0.01) {
            matchedFields.amount = true;
        }
        else {
            discrepancies.push({
                field: 'amount',
                squareValue: squareAmountDollars,
                databaseValue: dbPayment.grossAmount,
                reason: 'Amount mismatch'
            });
        }
        // 2. Compare status (with mapping)
        const statusMapping = {
            'COMPLETED': 'paid',
            'APPROVED': 'paid',
            'PENDING': 'pending',
            'FAILED': 'failed',
            'CANCELED': 'cancelled'
        };
        const mappedSquareStatus = statusMapping[squarePayment.status] || squarePayment.status?.toLowerCase();
        const dbStatus = dbPayment.status?.toLowerCase() || 'unknown';
        if (mappedSquareStatus === dbStatus) {
            matchedFields.status = true;
        }
        else {
            discrepancies.push({
                field: 'status',
                squareValue: squarePayment.status,
                databaseValue: dbPayment.status,
                reason: `Status mismatch (mapped: ${mappedSquareStatus} vs ${dbStatus})`
            });
        }
        // 3. Compare card last 4
        const squareCardLast4 = squarePayment.cardDetails?.card?.last4;
        if (squareCardLast4 && dbPayment.cardLast4) {
            if (squareCardLast4 === dbPayment.cardLast4) {
                matchedFields.cardLast4 = true;
            }
            else {
                discrepancies.push({
                    field: 'cardLast4',
                    squareValue: squareCardLast4,
                    databaseValue: dbPayment.cardLast4,
                    reason: 'Card last 4 digits mismatch'
                });
            }
        }
        else if (!squareCardLast4 && !dbPayment.cardLast4) {
            // Both null/undefined - consider as match
            matchedFields.cardLast4 = true;
        }
        // 4. Compare updated at
        const squareUpdatedAt = new Date(squarePayment.updatedAt || squarePayment.createdAt);
        const dbUpdatedAt = dbPayment.gatewayUpdatedAt || dbPayment.updatedAt;
        if (dbUpdatedAt) {
            // Allow 1 minute tolerance for timestamp differences
            const timeDiff = Math.abs(squareUpdatedAt.getTime() - dbUpdatedAt.getTime());
            if (timeDiff < 60000) { // 1 minute
                matchedFields.updatedAt = true;
            }
            else {
                discrepancies.push({
                    field: 'updatedAt',
                    squareValue: squareUpdatedAt.toISOString(),
                    databaseValue: dbUpdatedAt.toISOString(),
                    reason: `Timestamp difference: ${timeDiff / 1000} seconds`
                });
            }
        }
        result.matchedFields = matchedFields;
        result.discrepancies = discrepancies.length > 0 ? discrepancies : undefined;
        return result;
    }
    /**
     * Get reconciliation statistics
     */
    async getReconciliationStats() {
        const stats = await this.getPaymentsCollection.aggregate([
            {
                $facet: {
                    statusCounts: [
                        { $group: { _id: '$status', count: { $sum: 1 } } }
                    ],
                    expiringCount: [
                        {
                            $match: {
                                expiresAt: {
                                    $lte: new Date(Date.now() + 24 * 60 * 60 * 1000)
                                }
                            }
                        },
                        { $count: 'count' }
                    ],
                    total: [
                        { $count: 'count' }
                    ]
                }
            }
        ]).toArray();
        const result = stats[0];
        const statusMap = result.statusCounts.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {});
        return {
            total: result.total[0]?.count || 0,
            new: statusMap.new || 0,
            checked: statusMap.checked || 0,
            completed: statusMap.completed || 0,
            discrepancies: statusMap.discrepancy || 0,
            expiringIn24h: result.expiringCount[0]?.count || 0
        };
    }
    /**
     * Get payments with discrepancies
     */
    async getDiscrepancies(limit = 50) {
        return await this.getPaymentsCollection
            .find({ status: 'discrepancy' })
            .sort({ fetchedAt: -1 })
            .limit(limit)
            .toArray();
    }
}
exports.SquarePaymentReconciliationService = SquarePaymentReconciliationService;
