import { Db } from 'mongodb';

export class TransactionSequence {
  private db: Db;
  private collectionName = 'counters';

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Get the next sequential transaction ID
   * Starts from 1 and increments by 1 for each new transaction
   */
  async getNextTransactionId(): Promise<number> {
    const result = await this.db.collection(this.collectionName).findOneAndUpdate(
      { _id: 'transaction_sequence' as any },
      { $inc: { sequence_value: 1 } },
      { 
        upsert: true, 
        returnDocument: 'after',
        projection: { sequence_value: 1 }
      }
    );

    // If this is the first time, the document was just created with sequence_value: 1
    // Otherwise, we get the incremented value
    return result.sequence_value || 1;
  }

  /**
   * Get the current sequence value without incrementing
   */
  async getCurrentSequenceValue(): Promise<number> {
    const counter = await this.db.collection(this.collectionName).findOne(
      { _id: 'transaction_sequence' as any },
      { projection: { sequence_value: 1 } }
    );
    
    return counter?.sequence_value || 0;
  }

  /**
   * Reset the sequence to a specific value (useful for testing or migration)
   */
  async resetSequence(value: number = 0): Promise<void> {
    await this.db.collection(this.collectionName).updateOne(
      { _id: 'transaction_sequence' as any },
      { $set: { sequence_value: value } },
      { upsert: true }
    );
  }
}