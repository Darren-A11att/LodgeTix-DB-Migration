"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceSequence = void 0;
class InvoiceSequence {
    db;
    counterCollection = 'counters';
    constructor(db) {
        this.db = db;
    }
    /**
     * Initialize the counter if it doesn't exist
     */
    async initializeCounter(sequenceName = 'invoice_number', startValue = 1000) {
        const counters = this.db.collection(this.counterCollection);
        try {
            await counters.insertOne({
                _id: sequenceName,
                sequence_value: startValue
            });
            console.log(`Initialized ${sequenceName} counter at ${startValue}`);
        }
        catch (error) {
            if (error.code === 11000) {
                // Duplicate key error - counter already exists
                console.log(`Counter ${sequenceName} already exists`);
            }
            else {
                throw error;
            }
        }
    }
    /**
     * Get the next sequence number atomically
     * This uses findOneAndUpdate with $inc to ensure thread-safety
     */
    async getNextSequenceNumber(sequenceName = 'invoice_number') {
        const counters = this.db.collection(this.counterCollection);
        const result = await counters.findOneAndUpdate({ _id: sequenceName }, { $inc: { sequence_value: 1 } }, {
            returnDocument: 'after',
            upsert: true
        });
        if (!result) {
            throw new Error('Failed to get next sequence number');
        }
        return result.sequence_value;
    }
    /**
     * Get the next sequence number for a specific year/month
     * This creates separate counters for each YYMM combination
     */
    async getNextMonthlySequenceNumber(year, month) {
        const yy = year.toString().slice(-2);
        const mm = month.toString().padStart(2, '0');
        const sequenceName = `invoice_${yy}${mm}`;
        const counters = this.db.collection(this.counterCollection);
        const result = await counters.findOneAndUpdate({ _id: sequenceName }, { $inc: { sequence_value: 1 } }, {
            returnDocument: 'after',
            upsert: true
        });
        if (!result) {
            throw new Error('Failed to get next sequence number');
        }
        return result.sequence_value;
    }
    /**
     * Get the current sequence number without incrementing
     */
    async getCurrentSequenceNumber(sequenceName = 'invoice_number') {
        const counters = this.db.collection(this.counterCollection);
        const counter = await counters.findOne({ _id: sequenceName });
        if (!counter) {
            return 0;
        }
        return counter.sequence_value;
    }
    /**
     * Reset the sequence to a specific value
     * WARNING: Use with caution to avoid duplicate invoice numbers
     */
    async resetSequence(sequenceName = 'invoice_number', newValue) {
        const counters = this.db.collection(this.counterCollection);
        await counters.updateOne({ _id: sequenceName }, { $set: { sequence_value: newValue } }, { upsert: true });
        console.log(`Reset ${sequenceName} counter to ${newValue}`);
    }
    /**
     * Generate a formatted invoice number
     * Example: INV-25060001
     */
    async generateInvoiceNumber(prefix = 'INV') {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // getMonth() returns 0-11
        const sequenceNumber = await this.getNextMonthlySequenceNumber(year, month);
        const yy = year.toString().slice(-2);
        const mm = month.toString().padStart(2, '0');
        const paddedNumber = sequenceNumber.toString().padStart(4, '0');
        return `${prefix}-${yy}${mm}${paddedNumber}`;
    }
    /**
     * Generate a LodgeTix invoice number
     * Example: LTIV-25060001
     */
    async generateLodgeTixInvoiceNumber() {
        return this.generateInvoiceNumber('LTIV');
    }
}
exports.InvoiceSequence = InvoiceSequence;
//# sourceMappingURL=invoice-sequence.js.map