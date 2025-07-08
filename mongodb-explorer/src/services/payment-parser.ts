import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';
import { connectMongoDB } from '../connections/mongodb';
import { Collection } from 'mongodb';

interface StandardizedPayment {
  // Transaction Information
  transactionId: string;
  paymentId?: string;
  timestamp: Date;
  status: 'paid' | 'failed' | 'refunded' | 'pending';
  
  // Amount Information
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
  refundAmount?: number;
  currency: string;
  
  // Customer Information
  customerName?: string;
  customerEmail?: string;
  customerId?: string;
  
  // Card Information
  cardBrand?: string;
  cardLast4?: string;
  
  // Event Information
  eventType?: string;
  eventDescription?: string;
  functionName?: string;
  organisation?: string;
  lodgeName?: string;
  totalAttendees?: number;
  
  // Source Information
  source: 'square' | 'stripe';
  sourceFile: string;
  originalData: any;
}

export class PaymentParser {
  private paymentsCollection!: Collection<StandardizedPayment>;

  async initialize() {
    const connection = await connectMongoDB();
    this.paymentsCollection = connection.db.collection<StandardizedPayment>('payments');
    
    // Create indexes for better query performance
    await this.paymentsCollection.createIndex({ transactionId: 1 });
    await this.paymentsCollection.createIndex({ timestamp: -1 });
    await this.paymentsCollection.createIndex({ source: 1 });
  }

  private parseAmount(amountStr: string): number {
    if (!amountStr) return 0;
    // Remove currency symbols, commas, and parentheses
    const cleaned = amountStr.replace(/[$,()]/g, '').trim();
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : Math.abs(amount);
  }

  private parseSquareTimestamp(date: string, time: string, _timezone: string): Date {
    // Combine date and time, then parse
    const dateTimeStr = `${date} ${time}`;
    const timestamp = new Date(dateTimeStr);
    
    // TODO: Handle timezone conversion properly
    // For now, assuming Sydney timezone for Square data
    return timestamp;
  }

  private parseStripeTimestamp(timestampStr: string): Date {
    return new Date(timestampStr);
  }

  private mapStatus(status: string, _source: 'square' | 'stripe'): StandardizedPayment['status'] {
    const normalizedStatus = status.toLowerCase();
    
    if (normalizedStatus === 'complete' || normalizedStatus === 'paid') {
      return 'paid';
    } else if (normalizedStatus === 'failed') {
      return 'failed';
    } else if (normalizedStatus === 'refunded') {
      return 'refunded';
    } else {
      return 'pending';
    }
  }

  private parseSquareRecord(record: any, sourceFile: string): StandardizedPayment {
    return {
      transactionId: record['Transaction ID'] || '',
      paymentId: record['Payment ID'],
      timestamp: this.parseSquareTimestamp(
        record['Date'],
        record['Time'],
        record['Time Zone']
      ),
      status: this.mapStatus(record['Transaction Status'] || '', 'square'),
      
      grossAmount: this.parseAmount(record['Gross Sales'] || record['Gross Amount']),
      netAmount: this.parseAmount(record['Net Total'] || record['Net Sales']),
      feeAmount: this.parseAmount(record['Fees']),
      refundAmount: this.parseAmount(record['Partial Refunds']),
      currency: 'AUD', // Square doesn't explicitly state currency
      
      customerName: record['Customer Name'],
      customerId: record['Customer ID'],
      // Square doesn't have email in the export
      
      cardBrand: record['Card Brand'],
      cardLast4: record['PAN Suffix'],
      
      eventDescription: record['Description'] || record['Details'],
      organisation: record['Location'],
      
      source: 'square',
      sourceFile,
      originalData: record
    };
  }

  private parseStripeRecord(record: any, sourceFile: string): StandardizedPayment {
    // Extract metadata fields
    const metadataFields: any = {};
    Object.keys(record).forEach(key => {
      if (key.startsWith('metadata[') && key.endsWith(']')) {
        const metadataKey = key.slice(9, -1);
        metadataFields[metadataKey] = record[key];
      }
    });

    return {
      transactionId: record['id'] || '',
      paymentId: record['PaymentIntent ID'],
      timestamp: this.parseStripeTimestamp(record['Created date (UTC)']),
      status: this.mapStatus(record['Status'] || '', 'stripe'),
      
      grossAmount: parseFloat(record['Amount']) || 0,
      netAmount: parseFloat(record['Amount']) || 0,
      feeAmount: parseFloat(record['Fee']) || 0,
      refundAmount: parseFloat(record['Amount Refunded']) || 0,
      currency: record['Currency'] || 'AUD',
      
      customerName: record['Card Name'] || record['Customer Description'],
      customerEmail: record['Customer Email'],
      customerId: record['Customer ID'],
      
      cardBrand: record['Card Brand'],
      cardLast4: record['Card Last4'],
      
      eventType: metadataFields['registration_type'],
      eventDescription: record['Description'],
      functionName: metadataFields['function_name'],
      organisation: metadataFields['organisation_name'],
      lodgeName: metadataFields['lodge_name'],
      totalAttendees: parseInt(metadataFields['total_attendees']) || undefined,
      
      source: 'stripe',
      sourceFile,
      originalData: record
    };
  }

  async parseCSVFile(filePath: string): Promise<StandardizedPayment[]> {
    const payments: StandardizedPayment[] = [];
    const fileName = path.basename(filePath);
    const isSquareFile = fileName.includes('items-') || fileName.includes('transactions-');
    
    return new Promise((resolve, reject) => {
      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      parser.on('readable', () => {
        let record;
        while ((record = parser.read()) !== null) {
          try {
            const payment = isSquareFile
              ? this.parseSquareRecord(record, fileName)
              : this.parseStripeRecord(record, fileName);
            
            if (payment.transactionId) {
              payments.push(payment);
            }
          } catch (error) {
            console.error(`Error parsing record in ${fileName}:`, error);
          }
        }
      });

      parser.on('error', reject);
      parser.on('end', () => resolve(payments));

      const stream = fs.createReadStream(filePath);
      stream.pipe(parser);
    });
  }

  async importPayments(csvFiles: string[]): Promise<void> {
    console.log('🚀 Starting payment import process...');
    
    for (const file of csvFiles) {
      console.log(`\n📄 Processing ${path.basename(file)}...`);
      
      try {
        const payments = await this.parseCSVFile(file);
        console.log(`  ✓ Parsed ${payments.length} payments`);
        
        if (payments.length > 0) {
          // Insert payments with upsert to avoid duplicates
          const operations = payments.map(payment => ({
            updateOne: {
              filter: { transactionId: payment.transactionId, source: payment.source },
              update: { $set: payment },
              upsert: true
            }
          }));
          
          const result = await this.paymentsCollection.bulkWrite(operations);
          console.log(`  ✓ Imported: ${result.upsertedCount} new, ${result.modifiedCount} updated`);
        }
      } catch (error) {
        console.error(`  ✗ Error processing ${file}:`, error);
      }
    }
    
    const totalCount = await this.paymentsCollection.countDocuments();
    console.log(`\n✅ Import complete! Total payments in database: ${totalCount}`);
  }

  async getPaymentsSummary() {
    const summary = await this.paymentsCollection.aggregate([
      {
        $group: {
          _id: {
            source: '$source',
            status: '$status'
          },
          count: { $sum: 1 },
          totalGross: { $sum: '$grossAmount' },
          totalFees: { $sum: '$feeAmount' }
        }
      },
      {
        $group: {
          _id: '$_id.source',
          statuses: {
            $push: {
              status: '$_id.status',
              count: '$count',
              totalGross: '$totalGross',
              totalFees: '$totalFees'
            }
          },
          totalCount: { $sum: '$count' },
          totalGross: { $sum: '$totalGross' },
          totalFees: { $sum: '$totalFees' }
        }
      }
    ]).toArray();
    
    return summary;
  }
}