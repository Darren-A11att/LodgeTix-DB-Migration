import path from 'path';
import { parse } from 'csv-parse';
import fs from 'fs';
import { connectMongoDB } from './connections/mongodb';
import { Collection } from 'mongodb';

interface StandardizedRegistration {
  registrationId: string;
  customerId?: string;
  registrationDate: Date;
  status: string;
  totalAmountPaid: number;
  totalPricePaid: number;
  paymentStatus: string;
  confirmationNumber?: string;
  registrationType: string;
  stripePaymentIntentId?: string;
  squarePaymentId?: string;
  customerEmail?: string;
  customerName?: string;
  attendeeCount: number;
  organisationName?: string;
  functionId?: string;
  createdAt: Date;
  updatedAt: Date;
  registrationData?: any;
  sourceFile: string;
}

export class RegistrationParser {
  private registrationsCollection!: Collection<StandardizedRegistration>;

  async initialize() {
    const connection = await connectMongoDB();
    this.registrationsCollection = connection.db.collection<StandardizedRegistration>('registrations');
    
    // Create indexes for better query performance
    await this.registrationsCollection.createIndex({ registrationId: 1 });
    await this.registrationsCollection.createIndex({ paymentStatus: 1 });
    await this.registrationsCollection.createIndex({ stripePaymentIntentId: 1 });
    await this.registrationsCollection.createIndex({ squarePaymentId: 1 });
    await this.registrationsCollection.createIndex({ customerEmail: 1 });
  }

  private parseAmount(amountStr: string): number {
    if (!amountStr) return 0;
    const amount = parseFloat(amountStr);
    return isNaN(amount) ? 0 : amount;
  }

  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    return new Date(dateStr);
  }

  private extractEmailFromRegistrationData(registrationData: any): string | undefined {
    try {
      if (typeof registrationData === 'string') {
        const parsed = JSON.parse(registrationData);
        return parsed.bookingContact?.email || parsed.bookingContact?.emailAddress;
      }
      return registrationData?.bookingContact?.email || registrationData?.bookingContact?.emailAddress;
    } catch {
      return undefined;
    }
  }

  private extractNameFromRegistrationData(registrationData: any): string | undefined {
    try {
      if (typeof registrationData === 'string') {
        const parsed = JSON.parse(registrationData);
        const contact = parsed.bookingContact;
        if (contact) {
          return `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || undefined;
        }
      }
      const contact = registrationData?.bookingContact;
      if (contact) {
        return `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || undefined;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  private parseRegistrationRecord(record: any, sourceFile: string): StandardizedRegistration | null {
    const paymentStatus = (record.payment_status || '').toLowerCase();
    const status = (record.status || '').toLowerCase();
    
    // Only import registrations with completed payment status
    const validStatuses = ['completed', 'paid', 'succeeded', 'success'];
    
    if (!validStatuses.includes(paymentStatus) && !validStatuses.includes(status)) {
      console.log(`⚠️ Skipping registration ${record.registration_id} - payment status: ${paymentStatus}, status: ${status}`);
      return null;
    }

    const customerEmail = this.extractEmailFromRegistrationData(record.registration_data) || record.customer_email;
    const customerName = this.extractNameFromRegistrationData(record.registration_data) || record.primary_attendee;

    return {
      registrationId: record.registration_id,
      customerId: record.customer_id,
      registrationDate: this.parseDate(record.registration_date),
      status: record.status || 'unknown',
      totalAmountPaid: this.parseAmount(record.total_amount_paid),
      totalPricePaid: this.parseAmount(record.total_price_paid),
      paymentStatus: record.payment_status || 'unknown',
      confirmationNumber: record.confirmation_number,
      registrationType: record.registration_type || 'unknown',
      stripePaymentIntentId: record.stripe_payment_intent_id,
      squarePaymentId: record.square_payment_id,
      customerEmail,
      customerName,
      attendeeCount: parseInt(record.attendee_count) || 1,
      organisationName: record.organisation_name,
      functionId: record.function_id,
      createdAt: this.parseDate(record.created_at),
      updatedAt: this.parseDate(record.updated_at),
      registrationData: record.registration_data,
      sourceFile
    };
  }

  async parseCSVFile(filePath: string): Promise<StandardizedRegistration[]> {
    const registrations: StandardizedRegistration[] = [];
    const fileName = path.basename(filePath);
    
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
            const registration = this.parseRegistrationRecord(record, fileName);
            
            if (registration && registration.registrationId) {
              registrations.push(registration);
            }
          } catch (error) {
            console.error(`Error parsing record in ${fileName}:`, error);
          }
        }
      });

      parser.on('error', reject);
      parser.on('end', () => resolve(registrations));

      const stream = fs.createReadStream(filePath);
      stream.pipe(parser);
    });
  }

  async importRegistrations(csvFiles: string[]): Promise<void> {
    console.log('🚀 Starting registration import process...');
    
    let totalImported = 0;
    let totalSkipped = 0;
    
    for (const file of csvFiles) {
      console.log(`\n📄 Processing ${path.basename(file)}...`);
      
      try {
        const registrations = await this.parseCSVFile(file);
        const validRegistrations = registrations.filter(reg => reg !== null);
        
        console.log(`  ✓ Parsed ${validRegistrations.length} valid registrations (completed payments only)`);
        
        if (validRegistrations.length > 0) {
          // Insert registrations with upsert to avoid duplicates
          const operations = validRegistrations.map(registration => ({
            updateOne: {
              filter: { registrationId: registration.registrationId },
              update: { $set: registration },
              upsert: true
            }
          }));
          
          const result = await this.registrationsCollection.bulkWrite(operations);
          console.log(`  ✓ Imported: ${result.upsertedCount} new, ${result.modifiedCount} updated`);
          totalImported += result.upsertedCount + result.modifiedCount;
        }
      } catch (error) {
        console.error(`  ✗ Error processing ${file}:`, error);
      }
    }
    
    const totalCount = await this.registrationsCollection.countDocuments();
    console.log(`\n✅ Import complete! Total registrations in database: ${totalCount}`);
    console.log(`📊 Imported in this run: ${totalImported} registrations`);
  }

  async getRegistrationsSummary() {
    const summary = await this.registrationsCollection.aggregate([
      {
        $group: {
          _id: {
            paymentStatus: '$paymentStatus',
            registrationType: '$registrationType'
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmountPaid' }
        }
      },
      {
        $group: {
          _id: '$_id.registrationType',
          statuses: {
            $push: {
              paymentStatus: '$_id.paymentStatus',
              count: '$count',
              totalAmount: '$totalAmount'
            }
          },
          totalCount: { $sum: '$count' },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]).toArray();
    
    return summary;
  }
}

async function main() {
  const parser = new RegistrationParser();
  
  try {
    // Initialize database connection and collection
    await parser.initialize();
    
    // Define the CSV files to import
    const csvFiles = [
      path.join(__dirname, '../../Database-Export/registrations_rows (1).csv')
    ];
    
    // Import all registrations
    await parser.importRegistrations(csvFiles);
    
    // Get and display summary
    console.log('\n📊 Registration Summary by Type:');
    const summary = await parser.getRegistrationsSummary();
    
    summary.forEach((type: any) => {
      console.log(`\n${type._id.toUpperCase()}:`);
      console.log(`  Total Registrations: ${type.totalCount}`);
      console.log(`  Total Amount: $${type.totalAmount.toFixed(2)}`);
      
      console.log('  By Payment Status:');
      type.statuses.forEach((status: any) => {
        console.log(`    ${status.paymentStatus}: ${status.count} registrations ($${status.totalAmount.toFixed(2)})`);
      });
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing registrations:', error);
    process.exit(1);
  }
}

main();