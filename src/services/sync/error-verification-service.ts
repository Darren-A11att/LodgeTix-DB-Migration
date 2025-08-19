import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { format } from 'date-fns';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ErrorPayment {
  _id: ObjectId;
  paymentId: string;
  errorType: string;
  errorMessage: string;
  timestamp: Date;
  rawData?: any;
  existsInTestDb?: boolean;
  testDbDocumentId?: ObjectId;
  verifiedAt?: Date;
}

interface ErrorRegistration {
  _id: ObjectId;
  registrationId: string;
  errorType: string;
  errorMessage: string;
  timestamp: Date;
  rawData?: any;
  existsInTestDb?: boolean;
  testDbDocumentId?: ObjectId;
  verifiedAt?: Date;
}

interface OrphanedRegistration {
  _id: ObjectId;
  registrationId: string;
  reason: string;
  timestamp: Date;
  rawData?: any;
  existsInTestDb?: boolean;
  testDbDocumentId?: ObjectId;
  verifiedAt?: Date;
}

interface VerificationStats {
  errorPayments: {
    total: number;
    verified: number;
    found: number;
    notFound: number;
    errors: number;
  };
  errorRegistrations: {
    total: number;
    verified: number;
    found: number;
    notFound: number;
    errors: number;
  };
  orphanedRegistrations: {
    total: number;
    verified: number;
    found: number;
    notFound: number;
    errors: number;
  };
}

interface VerificationReport {
  stats: VerificationStats;
  details: {
    errorPaymentsFound: Array<{
      errorId: ObjectId;
      paymentId: string;
      testDbId: ObjectId;
    }>;
    errorPaymentsNotFound: Array<{
      errorId: ObjectId;
      paymentId: string;
    }>;
    errorRegistrationsFound: Array<{
      errorId: ObjectId;
      registrationId: string;
      testDbId: ObjectId;
    }>;
    errorRegistrationsNotFound: Array<{
      errorId: ObjectId;
      registrationId: string;
    }>;
    orphanedRegistrationsFound: Array<{
      errorId: ObjectId;
      registrationId: string;
      testDbId: ObjectId;
    }>;
    orphanedRegistrationsNotFound: Array<{
      errorId: ObjectId;
      registrationId: string;
    }>;
    verificationErrors: Array<{
      collection: string;
      documentId: ObjectId;
      error: string;
    }>;
  };
  summary: string;
  timestamp: Date;
}

export class ErrorVerificationService {
  private importClient: MongoClient | null = null;
  private testClient: MongoClient | null = null;
  private importDb: Db | null = null;
  private testDb: Db | null = null;
  private logDir: string = path.join(process.cwd(), 'verification-logs');
  private report: VerificationReport;

  constructor() {
    this.report = this.initializeReport();
  }

  private initializeReport(): VerificationReport {
    return {
      stats: {
        errorPayments: {
          total: 0,
          verified: 0,
          found: 0,
          notFound: 0,
          errors: 0
        },
        errorRegistrations: {
          total: 0,
          verified: 0,
          found: 0,
          notFound: 0,
          errors: 0
        },
        orphanedRegistrations: {
          total: 0,
          verified: 0,
          found: 0,
          notFound: 0,
          errors: 0
        }
      },
      details: {
        errorPaymentsFound: [],
        errorPaymentsNotFound: [],
        errorRegistrationsFound: [],
        errorRegistrationsNotFound: [],
        orphanedRegistrationsFound: [],
        orphanedRegistrationsNotFound: [],
        verificationErrors: []
      },
      summary: '',
      timestamp: new Date()
    };
  }

  async connect(importUri: string, testUri: string): Promise<void> {
    try {
      console.log('🔌 Connecting to databases for verification...');
      
      // Connect to import database
      this.importClient = new MongoClient(importUri);
      await this.importClient.connect();
      this.importDb = this.importClient.db('lodgetix');
      console.log('✅ Connected to import database');

      // Connect to test database  
      this.testClient = new MongoClient(testUri);
      await this.testClient.connect();
      this.testDb = this.testClient.db('lodgetix');
      console.log('✅ Connected to test database');

      // Ensure log directory exists
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('❌ Failed to connect to databases:', error);
      throw error;
    }
  }

  async verifyErrorPayments(): Promise<void> {
    if (!this.importDb || !this.testDb) {
      throw new Error('Databases not connected');
    }

    console.log('\n📋 Verifying error_payments...');
    const errorPaymentsCol = this.importDb.collection<ErrorPayment>('error_payments');
    const testPaymentsCol = this.testDb.collection('payments');

    try {
      const errorPayments = await errorPaymentsCol.find({}).toArray();
      this.report.stats.errorPayments.total = errorPayments.length;
      console.log(`Found ${errorPayments.length} error payments to verify`);

      for (const errorPayment of errorPayments) {
        try {
          // Look for payment in test database by paymentId
          const testPayment = await testPaymentsCol.findOne({ 
            paymentId: errorPayment.paymentId 
          });

          const updateData: Partial<ErrorPayment> = {
            verifiedAt: new Date()
          };

          if (testPayment) {
            updateData.existsInTestDb = true;
            updateData.testDbDocumentId = testPayment._id;
            
            this.report.stats.errorPayments.found++;
            this.report.details.errorPaymentsFound.push({
              errorId: errorPayment._id,
              paymentId: errorPayment.paymentId,
              testDbId: testPayment._id
            });

            console.log(`✅ Found payment ${errorPayment.paymentId} in test DB`);
          } else {
            updateData.existsInTestDb = false;
            
            this.report.stats.errorPayments.notFound++;
            this.report.details.errorPaymentsNotFound.push({
              errorId: errorPayment._id,
              paymentId: errorPayment.paymentId
            });

            console.log(`❌ Payment ${errorPayment.paymentId} NOT found in test DB`);
          }

          // Update the error document
          await errorPaymentsCol.updateOne(
            { _id: errorPayment._id },
            { $set: updateData }
          );

          this.report.stats.errorPayments.verified++;
        } catch (error) {
          this.report.stats.errorPayments.errors++;
          this.report.details.verificationErrors.push({
            collection: 'error_payments',
            documentId: errorPayment._id,
            error: String(error)
          });
          console.error(`Error verifying payment ${errorPayment.paymentId}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to verify error payments:', error);
      throw error;
    }
  }

  async verifyErrorRegistrations(): Promise<void> {
    if (!this.importDb || !this.testDb) {
      throw new Error('Databases not connected');
    }

    console.log('\n📋 Verifying error_registrations...');
    const errorRegistrationsCol = this.importDb.collection<ErrorRegistration>('error_registrations');
    const testRegistrationsCol = this.testDb.collection('registrations');

    try {
      const errorRegistrations = await errorRegistrationsCol.find({}).toArray();
      this.report.stats.errorRegistrations.total = errorRegistrations.length;
      console.log(`Found ${errorRegistrations.length} error registrations to verify`);

      for (const errorReg of errorRegistrations) {
        try {
          // Look for registration in test database by registrationId
          const testReg = await testRegistrationsCol.findOne({ 
            registrationId: errorReg.registrationId 
          });

          const updateData: Partial<ErrorRegistration> = {
            verifiedAt: new Date()
          };

          if (testReg) {
            updateData.existsInTestDb = true;
            updateData.testDbDocumentId = testReg._id;
            
            this.report.stats.errorRegistrations.found++;
            this.report.details.errorRegistrationsFound.push({
              errorId: errorReg._id,
              registrationId: errorReg.registrationId,
              testDbId: testReg._id
            });

            console.log(`✅ Found registration ${errorReg.registrationId} in test DB`);
          } else {
            updateData.existsInTestDb = false;
            
            this.report.stats.errorRegistrations.notFound++;
            this.report.details.errorRegistrationsNotFound.push({
              errorId: errorReg._id,
              registrationId: errorReg.registrationId
            });

            console.log(`❌ Registration ${errorReg.registrationId} NOT found in test DB`);
          }

          // Update the error document
          await errorRegistrationsCol.updateOne(
            { _id: errorReg._id },
            { $set: updateData }
          );

          this.report.stats.errorRegistrations.verified++;
        } catch (error) {
          this.report.stats.errorRegistrations.errors++;
          this.report.details.verificationErrors.push({
            collection: 'error_registrations',
            documentId: errorReg._id,
            error: String(error)
          });
          console.error(`Error verifying registration ${errorReg.registrationId}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to verify error registrations:', error);
      throw error;
    }
  }

  async verifyOrphanedRegistrations(): Promise<void> {
    if (!this.importDb || !this.testDb) {
      throw new Error('Databases not connected');
    }

    console.log('\n📋 Verifying orphaned_registrations...');
    const orphanedCol = this.importDb.collection<OrphanedRegistration>('orphaned_registrations');
    const testRegistrationsCol = this.testDb.collection('registrations');

    try {
      const orphanedRegs = await orphanedCol.find({}).toArray();
      this.report.stats.orphanedRegistrations.total = orphanedRegs.length;
      console.log(`Found ${orphanedRegs.length} orphaned registrations to verify`);

      for (const orphaned of orphanedRegs) {
        try {
          // Look for registration in test database
          const testReg = await testRegistrationsCol.findOne({ 
            registrationId: orphaned.registrationId 
          });

          const updateData: Partial<OrphanedRegistration> = {
            verifiedAt: new Date()
          };

          if (testReg) {
            updateData.existsInTestDb = true;
            updateData.testDbDocumentId = testReg._id;
            
            this.report.stats.orphanedRegistrations.found++;
            this.report.details.orphanedRegistrationsFound.push({
              errorId: orphaned._id,
              registrationId: orphaned.registrationId,
              testDbId: testReg._id
            });

            console.log(`✅ Found orphaned registration ${orphaned.registrationId} in test DB`);
          } else {
            updateData.existsInTestDb = false;
            
            this.report.stats.orphanedRegistrations.notFound++;
            this.report.details.orphanedRegistrationsNotFound.push({
              errorId: orphaned._id,
              registrationId: orphaned.registrationId
            });

            console.log(`❌ Orphaned registration ${orphaned.registrationId} NOT found in test DB`);
          }

          // Update the orphaned document
          await orphanedCol.updateOne(
            { _id: orphaned._id },
            { $set: updateData }
          );

          this.report.stats.orphanedRegistrations.verified++;
        } catch (error) {
          this.report.stats.orphanedRegistrations.errors++;
          this.report.details.verificationErrors.push({
            collection: 'orphaned_registrations',
            documentId: orphaned._id,
            error: String(error)
          });
          console.error(`Error verifying orphaned registration ${orphaned.registrationId}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to verify orphaned registrations:', error);
      throw error;
    }
  }

  private generateSummary(): string {
    const stats = this.report.stats;
    const lines: string[] = [
      '='.repeat(80),
      'ERROR VERIFICATION SUMMARY',
      '='.repeat(80),
      '',
      `Verification completed at: ${format(this.report.timestamp, 'yyyy-MM-dd HH:mm:ss')}`,
      '',
      '📊 ERROR PAYMENTS:',
      `  Total: ${stats.errorPayments.total}`,
      `  Verified: ${stats.errorPayments.verified}`,
      `  Found in Test DB: ${stats.errorPayments.found} (${this.getPercentage(stats.errorPayments.found, stats.errorPayments.total)}%)`,
      `  Not Found: ${stats.errorPayments.notFound} (${this.getPercentage(stats.errorPayments.notFound, stats.errorPayments.total)}%)`,
      `  Errors: ${stats.errorPayments.errors}`,
      '',
      '📊 ERROR REGISTRATIONS:',
      `  Total: ${stats.errorRegistrations.total}`,
      `  Verified: ${stats.errorRegistrations.verified}`,
      `  Found in Test DB: ${stats.errorRegistrations.found} (${this.getPercentage(stats.errorRegistrations.found, stats.errorRegistrations.total)}%)`,
      `  Not Found: ${stats.errorRegistrations.notFound} (${this.getPercentage(stats.errorRegistrations.notFound, stats.errorRegistrations.total)}%)`,
      `  Errors: ${stats.errorRegistrations.errors}`,
      '',
      '📊 ORPHANED REGISTRATIONS:',
      `  Total: ${stats.orphanedRegistrations.total}`,
      `  Verified: ${stats.orphanedRegistrations.verified}`,
      `  Found in Test DB: ${stats.orphanedRegistrations.found} (${this.getPercentage(stats.orphanedRegistrations.found, stats.orphanedRegistrations.total)}%)`,
      `  Not Found: ${stats.orphanedRegistrations.notFound} (${this.getPercentage(stats.orphanedRegistrations.notFound, stats.orphanedRegistrations.total)}%)`,
      `  Errors: ${stats.orphanedRegistrations.errors}`,
      '',
      '='.repeat(80),
      'OVERALL STATISTICS:',
      '='.repeat(80),
      `Total Documents Processed: ${stats.errorPayments.total + stats.errorRegistrations.total + stats.orphanedRegistrations.total}`,
      `Total Found in Test DB: ${stats.errorPayments.found + stats.errorRegistrations.found + stats.orphanedRegistrations.found}`,
      `Total Not Found: ${stats.errorPayments.notFound + stats.errorRegistrations.notFound + stats.orphanedRegistrations.notFound}`,
      `Total Verification Errors: ${stats.errorPayments.errors + stats.errorRegistrations.errors + stats.orphanedRegistrations.errors}`,
      '',
      '='.repeat(80)
    ];

    return lines.join('\n');
  }

  private getPercentage(value: number, total: number): string {
    if (total === 0) return '0.00';
    return ((value / total) * 100).toFixed(2);
  }

  async generateReport(): Promise<string> {
    this.report.summary = this.generateSummary();
    
    // Save report to file
    const timestamp = format(new Date(), "yyyy-MM-dd'T'HH-mm-ss-SSS'Z'");
    const reportPath = path.join(this.logDir, `verification-report-${timestamp}.json`);
    const summaryPath = path.join(this.logDir, `verification-summary-${timestamp}.txt`);

    await fs.writeFile(reportPath, JSON.stringify(this.report, null, 2));
    await fs.writeFile(summaryPath, this.report.summary);

    console.log(`\n📄 Report saved to: ${reportPath}`);
    console.log(`📄 Summary saved to: ${summaryPath}`);

    return this.report.summary;
  }

  async runFullVerification(): Promise<VerificationReport> {
    try {
      console.log('🚀 Starting full error verification...\n');
      
      // Reset report
      this.report = this.initializeReport();
      
      // Run all verifications
      await this.verifyErrorPayments();
      await this.verifyErrorRegistrations();
      await this.verifyOrphanedRegistrations();
      
      // Generate and save report
      const summary = await this.generateReport();
      console.log('\n' + summary);
      
      return this.report;
    } catch (error) {
      console.error('❌ Verification failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.importClient) {
      await this.importClient.close();
      console.log('Disconnected from import database');
    }
    if (this.testClient) {
      await this.testClient.close();
      console.log('Disconnected from test database');
    }
  }

  // Utility method to get verification status for a specific document
  async getVerificationStatus(collection: 'error_payments' | 'error_registrations' | 'orphaned_registrations', documentId: string): Promise<any> {
    if (!this.importDb) {
      throw new Error('Import database not connected');
    }

    const col = this.importDb.collection(collection);
    return await col.findOne({ _id: new ObjectId(documentId) });
  }

  // Method to re-verify a specific document
  async reverifyDocument(collection: 'error_payments' | 'error_registrations' | 'orphaned_registrations', documentId: string): Promise<boolean> {
    if (!this.importDb || !this.testDb) {
      throw new Error('Databases not connected');
    }

    const col = this.importDb.collection(collection);
    const doc = await col.findOne({ _id: new ObjectId(documentId) });

    if (!doc) {
      console.error(`Document ${documentId} not found in ${collection}`);
      return false;
    }

    let testCollection: string;
    let searchField: string;
    let searchValue: string;

    switch (collection) {
      case 'error_payments':
        testCollection = 'payments';
        searchField = 'paymentId';
        searchValue = (doc as any).paymentId;
        break;
      case 'error_registrations':
      case 'orphaned_registrations':
        testCollection = 'registrations';
        searchField = 'registrationId';
        searchValue = (doc as any).registrationId;
        break;
      default:
        throw new Error(`Unknown collection: ${collection}`);
    }

    const testDoc = await this.testDb.collection(testCollection).findOne({
      [searchField]: searchValue
    });

    const updateData: any = {
      verifiedAt: new Date(),
      existsInTestDb: !!testDoc
    };

    if (testDoc) {
      updateData.testDbDocumentId = testDoc._id;
    }

    await col.updateOne(
      { _id: new ObjectId(documentId) },
      { $set: updateData }
    );

    console.log(`Document ${documentId} re-verified: ${testDoc ? 'FOUND' : 'NOT FOUND'} in test DB`);
    return !!testDoc;
  }
}