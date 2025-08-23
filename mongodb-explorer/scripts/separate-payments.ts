import { MongoClient, Db, Collection } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

interface Payment {
  _id?: any;
  _sourceSystem: string;
  [key: string]: any;
}

interface MigrationStats {
  totalPayments: number;
  squarePayments: number;
  stripePayments: number;
  otherPayments: number;
  migrationTime: number;
}

class PaymentSeparationService {
  private client: MongoClient;
  private db: Db;
  private originalCollection: Collection<Payment>;
  private squareCollection: Collection<Payment>;
  private stripeCollection: Collection<Payment>;
  
  private backupData: Payment[] = [];
  private migrationStartTime: number = 0;

  constructor() {
    // Use environment variable or default connection string
    const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    this.client = new MongoClient(connectionString);
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      console.log('✅ Connected to MongoDB');
      
      this.db = this.client.db('supabase');
      this.originalCollection = this.db.collection('payments');
      this.squareCollection = this.db.collection('squarePayments');
      this.stripeCollection = this.db.collection('stripePayments');
      
      console.log('📊 Database and collections initialized');
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async createBackup(): Promise<void> {
    try {
      console.log('💾 Creating backup of original payments collection...');
      this.backupData = await this.originalCollection.find({}).toArray();
      console.log(`✅ Backup created: ${this.backupData.length} documents`);
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
      throw error;
    }
  }

  async separatePayments(): Promise<MigrationStats> {
    this.migrationStartTime = Date.now();
    
    try {
      // Get all payments
      console.log('📖 Reading all payments from collection...');
      const allPayments = await this.originalCollection.find({}).toArray();
      console.log(`📊 Found ${allPayments.length} total payments`);

      if (allPayments.length === 0) {
        console.log('⚠️  No payments found to migrate');
        return {
          totalPayments: 0,
          squarePayments: 0,
          stripePayments: 0,
          otherPayments: 0,
          migrationTime: 0
        };
      }

      // Separate payments by source system
      const squarePayments: Payment[] = [];
      const stripePayments: Payment[] = [];
      const otherPayments: Payment[] = [];

      for (const payment of allPayments) {
        if (!payment._sourceSystem) {
          console.warn(`⚠️  Payment ${payment._id} has no _sourceSystem field`);
          otherPayments.push(payment);
          continue;
        }

        const sourceSystem = payment._sourceSystem.toLowerCase();
        
        if (sourceSystem === 'square') {
          squarePayments.push(payment);
        } else if (sourceSystem.startsWith('stripe')) {
          stripePayments.push(payment);
        } else {
          console.warn(`⚠️  Unknown source system: ${payment._sourceSystem} for payment ${payment._id}`);
          otherPayments.push(payment);
        }
      }

      console.log(`📊 Categorized payments:`);
      console.log(`   - Square: ${squarePayments.length}`);
      console.log(`   - Stripe: ${stripePayments.length}`);
      console.log(`   - Other/Unknown: ${otherPayments.length}`);

      // Bulk insert operations
      if (squarePayments.length > 0) {
        console.log('🔄 Inserting Square payments...');
        await this.squareCollection.insertMany(squarePayments, { ordered: false });
        console.log(`✅ Inserted ${squarePayments.length} Square payments`);
      }

      if (stripePayments.length > 0) {
        console.log('🔄 Inserting Stripe payments...');
        await this.stripeCollection.insertMany(stripePayments, { ordered: false });
        console.log(`✅ Inserted ${stripePayments.length} Stripe payments`);
      }

      // Handle other payments - log but don't migrate
      if (otherPayments.length > 0) {
        console.log(`⚠️  ${otherPayments.length} payments with unknown source systems were not migrated`);
        console.log('   These payments remain in the original collection');
        
        // Log the unknown source systems
        const unknownSystems = [...new Set(otherPayments.map(p => p._sourceSystem))];
        console.log(`   Unknown source systems: ${unknownSystems.join(', ')}`);
      }

      // Verify insertion counts
      const squareCount = await this.squareCollection.countDocuments();
      const stripeCount = await this.stripeCollection.countDocuments();

      console.log(`🔍 Verification counts:`);
      console.log(`   - squarePayments collection: ${squareCount} documents`);
      console.log(`   - stripePayments collection: ${stripeCount} documents`);

      const migrationTime = Date.now() - this.migrationStartTime;

      return {
        totalPayments: allPayments.length,
        squarePayments: squarePayments.length,
        stripePayments: stripePayments.length,
        otherPayments: otherPayments.length,
        migrationTime
      };

    } catch (error) {
      console.error('❌ Error during payment separation:', error);
      throw error;
    }
  }

  async clearOriginalCollection(stats: MigrationStats): Promise<void> {
    try {
      // Only clear payments that were successfully migrated
      const migratedCount = stats.squarePayments + stats.stripePayments;
      
      if (migratedCount === 0) {
        console.log('⚠️  No payments were migrated, skipping deletion');
        return;
      }

      console.log('🗑️  Clearing migrated payments from original collection...');
      
      // Delete only Square and Stripe payments
      const squareDeleteResult = await this.originalCollection.deleteMany({ 
        _sourceSystem: 'square' 
      });
      
      const stripeDeleteResult = await this.originalCollection.deleteMany({ 
        _sourceSystem: { $regex: /^stripe/i } 
      });

      console.log(`✅ Deleted ${squareDeleteResult.deletedCount} Square payments`);
      console.log(`✅ Deleted ${stripeDeleteResult.deletedCount} Stripe payments`);
      
      const remainingCount = await this.originalCollection.countDocuments();
      console.log(`📊 Remaining payments in original collection: ${remainingCount}`);

    } catch (error) {
      console.error('❌ Error clearing original collection:', error);
      throw error;
    }
  }

  async rollback(): Promise<void> {
    try {
      console.log('🔄 Starting rollback process...');
      
      if (this.backupData.length === 0) {
        console.log('⚠️  No backup data available for rollback');
        return;
      }

      // Clear the separated collections
      console.log('🗑️  Clearing separated collections...');
      await this.squareCollection.deleteMany({});
      await this.stripeCollection.deleteMany({});
      
      // Restore original collection
      console.log('🔄 Restoring original payments collection...');
      await this.originalCollection.deleteMany({});
      await this.originalCollection.insertMany(this.backupData);
      
      console.log(`✅ Rollback completed: Restored ${this.backupData.length} documents`);
      
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    console.log('👋 Disconnected from MongoDB');
  }

  async run(): Promise<void> {
    try {
      await this.connect();
      await this.createBackup();
      
      const stats = await this.separatePayments();
      
      if (stats.totalPayments === 0) {
        console.log('✅ Migration completed (no payments to migrate)');
        return;
      }

      // Confirm before clearing original collection
      console.log('\n📋 Migration Summary:');
      console.log(`   Total payments processed: ${stats.totalPayments}`);
      console.log(`   Square payments migrated: ${stats.squarePayments}`);
      console.log(`   Stripe payments migrated: ${stats.stripePayments}`);
      console.log(`   Payments not migrated: ${stats.otherPayments}`);
      console.log(`   Migration time: ${stats.migrationTime}ms`);
      
      const migratedCount = stats.squarePayments + stats.stripePayments;
      
      if (migratedCount > 0) {
        console.log('\n⚠️  About to delete migrated payments from original collection...');
        console.log('   Press Ctrl+C within 5 seconds to abort, or wait to continue...');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await this.clearOriginalCollection(stats);
        console.log('✅ Payment separation completed successfully!');
      } else {
        console.log('⚠️  No payments were migrated, original collection unchanged');
      }

    } catch (error) {
      console.error('💥 Migration failed:', error);
      console.log('🔄 Attempting rollback...');
      
      try {
        await this.rollback();
      } catch (rollbackError) {
        console.error('💥 Rollback also failed:', rollbackError);
        console.log('⚠️  Manual data recovery may be required');
      }
    } finally {
      await this.disconnect();
    }
  }
}

// Execute the migration
async function main() {
  console.log('🚀 Starting payment separation migration...');
  console.log('=' .repeat(60));
  
  const migrationService = new PaymentSeparationService();
  await migrationService.run();
  
  console.log('=' .repeat(60));
  console.log('🏁 Payment separation process completed');
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n⚠️  Migration interrupted by user');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { PaymentSeparationService };