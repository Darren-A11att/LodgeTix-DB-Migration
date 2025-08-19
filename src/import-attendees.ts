import path from 'path';
import { parse } from 'csv-parse';
import fs from 'fs';
import { connectMongoDB } from './connections/mongodb';
import { Collection } from 'mongodb';

interface StandardizedAttendee {
  attendeeId: string;
  registrationId: string;
  attendeeType: string;
  dietaryRequirements?: string;
  specialNeeds?: string;
  contactPreference?: string;
  relatedAttendeeId?: string;
  relationship?: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  suffix?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
  isPartner: boolean;
  hasPartner: boolean;
  contactId?: string;
  eventTitle?: string;
  personId?: string;
  authUserId?: string;
  qrCodeUrl?: string;
  masonicStatus?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  attendeeData?: any;
  createdAt: Date;
  updatedAt: Date;
  sourceFile: string;
}

export class AttendeeParser {
  private attendeesCollection!: Collection<StandardizedAttendee>;
  private registrationsCollection!: Collection;

  async initialize() {
    const connection = await connectMongoDB();
    this.attendeesCollection = connection.db.collection<StandardizedAttendee>('attendees');
    this.registrationsCollection = connection.db.collection('registrations');
    
    // Create indexes for better query performance
    await this.attendeesCollection.createIndex({ attendeeId: 1 });
    await this.attendeesCollection.createIndex({ registrationId: 1 });
    await this.attendeesCollection.createIndex({ isPrimary: 1 });
    await this.attendeesCollection.createIndex({ primaryEmail: 1 });
  }

  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    return new Date(dateStr);
  }

  private parseBoolean(value: string): boolean {
    return value === 'true' || value === '1' || value === 't';
  }

  private async isValidRegistration(registrationId: string): Promise<boolean> {
    const registration = await this.registrationsCollection.findOne({ registrationId });
    return registration !== null;
  }

  private parseAttendeeRecord(record: any, sourceFile: string): StandardizedAttendee {
    return {
      attendeeId: record.attendee_id,
      registrationId: record.registration_id,
      attendeeType: record.attendee_type || 'unknown',
      dietaryRequirements: record.dietary_requirements || undefined,
      specialNeeds: record.special_needs || undefined,
      contactPreference: record.contact_preference || undefined,
      relatedAttendeeId: record.related_attendee_id || undefined,
      relationship: record.relationship || undefined,
      title: record.title || undefined,
      firstName: record.first_name || undefined,
      lastName: record.last_name || undefined,
      suffix: record.suffix || undefined,
      email: record.email || undefined,
      phone: record.phone || undefined,
      isPrimary: this.parseBoolean(record.is_primary),
      isPartner: this.parseBoolean(record.is_partner),
      hasPartner: this.parseBoolean(record.has_partner),
      contactId: record.contact_id || undefined,
      eventTitle: record.event_title || undefined,
      personId: record.person_id || undefined,
      authUserId: record.auth_user_id || undefined,
      qrCodeUrl: record.qr_code_url || undefined,
      masonicStatus: record.masonic_status || undefined,
      primaryEmail: record.primary_email || undefined,
      primaryPhone: record.primary_phone || undefined,
      attendeeData: record.attendee_data,
      createdAt: this.parseDate(record.created_at),
      updatedAt: this.parseDate(record.updated_at),
      sourceFile
    };
  }

  async parseCSVFile(filePath: string): Promise<StandardizedAttendee[]> {
    const attendees: StandardizedAttendee[] = [];
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
            const attendee = this.parseAttendeeRecord(record, fileName);
            
            if (attendee && attendee.attendeeId) {
              attendees.push(attendee);
            }
          } catch (error) {
            console.error(`Error parsing attendee record in ${fileName}:`, error);
          }
        }
      });

      parser.on('error', reject);
      parser.on('end', () => resolve(attendees));

      const stream = fs.createReadStream(filePath);
      stream.pipe(parser);
    });
  }

  async importAttendees(csvFiles: string[]): Promise<void> {
    console.log('🚀 Starting attendee import process...');
    
    let totalImported = 0;
    let totalSkipped = 0;
    
    for (const file of csvFiles) {
      console.log(`\n📄 Processing ${path.basename(file)}...`);
      
      try {
        const attendees = await this.parseCSVFile(file);
        console.log(`  ✓ Parsed ${attendees.length} attendees`);
        
        // Filter attendees to only include those with valid registrations
        const validAttendees: StandardizedAttendee[] = [];
        
        for (const attendee of attendees) {
          const hasValidRegistration = await this.isValidRegistration(attendee.registrationId);
          if (hasValidRegistration) {
            validAttendees.push(attendee);
          } else {
            console.log(`⚠️ Skipping attendee ${attendee.attendeeId} - registration ${attendee.registrationId} not found in completed registrations`);
            totalSkipped++;
          }
        }
        
        console.log(`  ✓ ${validAttendees.length} attendees have valid completed registrations`);
        
        if (validAttendees.length > 0) {
          // Insert attendees with upsert to avoid duplicates
          const operations = validAttendees.map(attendee => ({
            updateOne: {
              filter: { attendeeId: attendee.attendeeId },
              update: { $set: attendee },
              upsert: true
            }
          }));
          
          const result = await this.attendeesCollection.bulkWrite(operations);
          console.log(`  ✓ Imported: ${result.upsertedCount} new, ${result.modifiedCount} updated`);
          totalImported += result.upsertedCount + result.modifiedCount;
        }
      } catch (error) {
        console.error(`  ✗ Error processing ${file}:`, error);
      }
    }
    
    const totalCount = await this.attendeesCollection.countDocuments();
    console.log(`\n✅ Import complete! Total attendees in database: ${totalCount}`);
    console.log(`📊 Imported in this run: ${totalImported} attendees`);
    console.log(`⚠️ Skipped attendees (no valid registration): ${totalSkipped}`);
  }

  async getAttendeesSummary() {
    const summary = await this.attendeesCollection.aggregate([
      {
        $group: {
          _id: {
            attendeeType: '$attendeeType',
            isPrimary: '$isPrimary'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.attendeeType',
          types: {
            $push: {
              isPrimary: '$_id.isPrimary',
              count: '$count'
            }
          },
          totalCount: { $sum: '$count' }
        }
      }
    ]).toArray();
    
    return summary;
  }
}

async function main() {
  const parser = new AttendeeParser();
  
  try {
    // Initialize database connection and collection
    await parser.initialize();
    
    // Define the CSV files to import
    const csvFiles = [
      path.join(__dirname, '../../Database-Export/attendees_rows.csv')
    ];
    
    // Import all attendees
    await parser.importAttendees(csvFiles);
    
    // Get and display summary
    console.log('\n📊 Attendee Summary by Type:');
    const summary = await parser.getAttendeesSummary();
    
    summary.forEach((type: any) => {
      console.log(`\n${type._id.toUpperCase()}:`);
      console.log(`  Total Attendees: ${type.totalCount}`);
      
      console.log('  Breakdown:');
      type.types.forEach((breakdown: any) => {
        const role = breakdown.isPrimary ? 'Primary' : 'Secondary';
        console.log(`    ${role}: ${breakdown.count} attendees`);
      });
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing attendees:', error);
    process.exit(1);
  }
}

main();