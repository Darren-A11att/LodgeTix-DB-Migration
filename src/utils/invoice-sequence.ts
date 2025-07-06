import { Db } from 'mongodb';

/**
 * MongoDB Counter Collection Method
 * This is the most reliable way to generate sequential numbers in MongoDB
 * It uses a separate collection to store counters
 */

interface Counter {
  _id: string;
  sequence_value: number;
}

export class InvoiceSequence {
  private db: Db;
  private counterCollection: string = 'counters';

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Initialize the counter if it doesn't exist
   */
  async initializeCounter(sequenceName: string = 'invoice_number', startValue: number = 1000): Promise<void> {
    const counters = this.db.collection<Counter>(this.counterCollection);
    
    try {
      await counters.insertOne({
        _id: sequenceName,
        sequence_value: startValue
      });
      console.log(`Initialized ${sequenceName} counter at ${startValue}`);
    } catch (error: any) {
      if (error.code === 11000) {
        // Duplicate key error - counter already exists
        console.log(`Counter ${sequenceName} already exists`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Get the next sequence number atomically
   * This uses findOneAndUpdate with $inc to ensure thread-safety
   */
  async getNextSequenceNumber(sequenceName: string = 'invoice_number'): Promise<number> {
    const counters = this.db.collection<Counter>(this.counterCollection);
    
    const result = await counters.findOneAndUpdate(
      { _id: sequenceName },
      { $inc: { sequence_value: 1 } },
      { 
        returnDocument: 'after',
        upsert: true
      }
    );

    if (!result) {
      throw new Error('Failed to get next sequence number');
    }

    return result.sequence_value;
  }

  /**
   * Get the next sequence number for a specific year/month/day
   * This creates separate counters for each YYMMDD combination
   */
  async getNextDailySequenceNumber(year: number, month: number, day: number): Promise<number> {
    const yy = year.toString().slice(-2);
    const mm = month.toString().padStart(2, '0');
    const dd = day.toString().padStart(2, '0');
    const sequenceName = `invoice_${yy}${mm}${dd}`;
    
    const counters = this.db.collection<Counter>(this.counterCollection);
    
    const result = await counters.findOneAndUpdate(
      { _id: sequenceName },
      { $inc: { sequence_value: 1 } },
      { 
        returnDocument: 'after',
        upsert: true
      }
    );

    if (!result) {
      throw new Error('Failed to get next sequence number');
    }

    return result.sequence_value;
  }

  /**
   * Get the current sequence number without incrementing
   */
  async getCurrentSequenceNumber(sequenceName: string = 'invoice_number'): Promise<number> {
    const counters = this.db.collection<Counter>(this.counterCollection);
    
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
  async resetSequence(sequenceName: string = 'invoice_number', newValue: number): Promise<void> {
    const counters = this.db.collection<Counter>(this.counterCollection);
    
    await counters.updateOne(
      { _id: sequenceName },
      { $set: { sequence_value: newValue } },
      { upsert: true }
    );

    console.log(`Reset ${sequenceName} counter to ${newValue}`);
  }

  /**
   * Generate a formatted invoice number using payment date
   * Example: INV-250103001 (YY MM DD ###)
   */
  async generateInvoiceNumber(prefix: string = 'INV', paymentDate?: Date): Promise<string> {
    const date = paymentDate || new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    const day = date.getDate();
    
    const sequenceNumber = await this.getNextDailySequenceNumber(year, month, day);
    const yy = year.toString().slice(-2);
    const mm = month.toString().padStart(2, '0');
    const dd = day.toString().padStart(2, '0');
    const paddedNumber = sequenceNumber.toString().padStart(3, '0');
    
    return `${prefix}-${yy}${mm}${dd}${paddedNumber}`;
  }

  /**
   * Generate a LodgeTix invoice number using payment date
   * Example: LTIV-250103001 (YY MM DD ###)
   */
  async generateLodgeTixInvoiceNumber(paymentDate?: Date): Promise<string> {
    return this.generateInvoiceNumber('LTIV', paymentDate);
  }
}