import { Db } from 'mongodb';
export declare class InvoiceSequence {
    private db;
    private counterCollection;
    constructor(db: Db);
    /**
     * Initialize the counter if it doesn't exist
     */
    initializeCounter(sequenceName?: string, startValue?: number): Promise<void>;
    /**
     * Get the next sequence number atomically
     * This uses findOneAndUpdate with $inc to ensure thread-safety
     */
    getNextSequenceNumber(sequenceName?: string): Promise<number>;
    /**
     * Get the next sequence number for a specific year/month
     * This creates separate counters for each YYMM combination
     */
    getNextMonthlySequenceNumber(year: number, month: number): Promise<number>;
    /**
     * Get the current sequence number without incrementing
     */
    getCurrentSequenceNumber(sequenceName?: string): Promise<number>;
    /**
     * Reset the sequence to a specific value
     * WARNING: Use with caution to avoid duplicate invoice numbers
     */
    resetSequence(sequenceName: string | undefined, newValue: number): Promise<void>;
    /**
     * Generate a formatted invoice number
     * Example: INV-25060001
     */
    generateInvoiceNumber(prefix?: string): Promise<string>;
    /**
     * Generate a LodgeTix invoice number
     * Example: LTIV-25060001
     */
    generateLodgeTixInvoiceNumber(): Promise<string>;
}
//# sourceMappingURL=invoice-sequence.d.ts.map