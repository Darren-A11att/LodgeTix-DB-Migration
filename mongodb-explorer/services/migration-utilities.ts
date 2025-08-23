/**
 * Migration Utilities
 * Reusable functions for data migration and transformation
 */

import { MongoClient, Db } from 'mongodb';
import { CartService, RegistrationData } from './cart-service';
import { CartValidationService } from './cart-validation-service';

export interface MigrationOptions {
  batchSize?: number;
  validateBeforeSave?: boolean;
  continueOnError?: boolean;
  dryRun?: boolean;
}

export interface MigrationResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{
    registrationId: string;
    error: string;
  }>;
  duration: number;
}

export class MigrationUtilities {
  private db: Db;
  private cartService: CartService;
  private validationService: CartValidationService;
  
  constructor(db: Db) {
    this.db = db;
    this.cartService = new CartService(db);
    this.validationService = new CartValidationService();
  }
  
  /**
   * Migrate all registrations to carts
   */
  async migrateRegistrationsToCarts(options: MigrationOptions = {}): Promise<MigrationResult> {
    const {
      batchSize = 100,
      validateBeforeSave = true,
      continueOnError = true,
      dryRun = false
    } = options;
    
    const startTime = Date.now();
    const result: MigrationResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      duration: 0
    };
    
    console.log('🔄 Starting registration to cart migration...');
    if (dryRun) {
      console.log('  ⚠️ DRY RUN MODE - No data will be saved');
    }
    
    try {
      const registrationsCollection = this.db.collection('old_registrations');
      const cartsCollection = this.db.collection('carts');
      
      // Get total count
      const totalCount = await registrationsCollection.countDocuments();
      console.log(`  📊 Found ${totalCount} registrations to migrate`);
      
      // Process in batches
      let processed = 0;
      let skip = 0;
      
      while (processed < totalCount) {
        const batch = await registrationsCollection
          .find({})
          .skip(skip)
          .limit(batchSize)
          .toArray();
        
        if (batch.length === 0) break;
        
        for (const registration of batch) {
          try {
            // Check if already migrated
            const existingCart = await cartsCollection.findOne({
              'cartItems.metadata.registrationId': registration.registrationId
            });
            
            if (existingCart) {
              result.skipped++;
              console.log(`  ⏭️ Skipping ${registration.registrationId} - already migrated`);
              continue;
            }
            
            // Transform to registration data format
            const registrationData = this.transformToRegistrationData(registration);
            
            // Convert to cart
            const cart = await this.cartService.registrationToCart(registrationData);
            
            // Validate if requested
            if (validateBeforeSave) {
              const validation = this.validationService.validateCart(cart);
              if (!validation.valid) {
                throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
              }
            }
            
            // Save cart (unless dry run)
            if (!dryRun) {
              await this.cartService.saveCart(cart);
            }
            
            result.success++;
            
            if (result.success % 10 === 0) {
              console.log(`  ✅ Migrated ${result.success} registrations`);
            }
            
          } catch (error) {
            result.failed++;
            result.errors.push({
              registrationId: registration.registrationId,
              error: error instanceof Error ? error.message : String(error)
            });
            
            console.error(`  ❌ Failed to migrate ${registration.registrationId}: ${error}`);
            
            if (!continueOnError) {
              throw error;
            }
          }
          
          processed++;
        }
        
        skip += batchSize;
      }
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
    
    result.duration = Date.now() - startTime;
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('-'.repeat(60));
    console.log(`  ✅ Success: ${result.success}`);
    console.log(`  ❌ Failed: ${result.failed}`);
    console.log(`  ⏭️ Skipped: ${result.skipped}`);
    console.log(`  ⏱️ Duration: ${(result.duration / 1000).toFixed(2)}s`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.slice(0, 10).forEach(err => {
        console.log(`  - ${err.registrationId}: ${err.error}`);
      });
      if (result.errors.length > 10) {
        console.log(`  ... and ${result.errors.length - 10} more errors`);
      }
    }
    
    return result;
  }
  
  /**
   * Transform old registration format to RegistrationData
   */
  private transformToRegistrationData(oldRegistration: any): RegistrationData {
    const regData = oldRegistration.registrationData || {};
    
    return {
      registrationId: oldRegistration.registrationId,
      registrationType: oldRegistration.registrationType || 'individual',
      registrationDate: new Date(oldRegistration.registrationDate),
      confirmationNumber: oldRegistration.confirmationNumber,
      bookingContact: regData.bookingContact || {
        firstName: '',
        lastName: '',
        email: oldRegistration.customerEmail || ''
      },
      attendees: regData.attendees,
      lodgeDetails: regData.lodgeDetails,
      grandLodgeDetails: regData.grandLodgeDetails,
      masonicOrderDetails: regData.masonicOrderDetails,
      tickets: regData.tickets,
      metadata: {
        ...regData.metadata,
        originalId: oldRegistration._id
      }
    };
  }
  
  /**
   * Copy attendee data to formData for existing carts
   */
  async updateFormDataFromAttendees(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      duration: 0
    };
    
    console.log('🔄 Updating formData from attendee records...');
    
    try {
      const cartsCollection = this.db.collection('carts');
      const registrationsCollection = this.db.collection('old_registrations');
      const productsCollection = this.db.collection('products');
      
      // Get bundle product
      const bundleProduct = await productsCollection.findOne({ type: 'bundle' });
      if (!bundleProduct) {
        throw new Error('Bundle product not found');
      }
      
      // Get all individual registration carts
      const carts = await cartsCollection.find({
        'cartItems.metadata.registrationType': 'individual'
      }).toArray();
      
      console.log(`  📊 Found ${carts.length} individual carts to update`);
      
      for (const cart of carts) {
        try {
          let cartModified = false;
          
          // Find original registration
          const registration = await registrationsCollection.findOne({
            registrationId: cart.cartItems[0]?.metadata?.registrationId
          });
          
          if (!registration?.registrationData?.attendees) {
            result.skipped++;
            continue;
          }
          
          const attendees = registration.registrationData.attendees;
          
          // Update each bundle item
          for (const item of cart.cartItems) {
            if (item.productId === bundleProduct.productId && !item.parentItemId) {
              // Match attendee by various methods
              let matchedAttendee = null;
              
              // Try by attendeeId
              if (item.formData?.attendeeId) {
                matchedAttendee = attendees.find((a: any) => 
                  a.attendeeId === item.formData.attendeeId
                );
              }
              
              // Try by name
              if (!matchedAttendee && item.formData?.firstName && item.formData?.lastName) {
                matchedAttendee = attendees.find((a: any) => 
                  a.firstName?.trim() === item.formData.firstName?.trim() && 
                  a.lastName?.trim() === item.formData.lastName?.trim()
                );
              }
              
              if (matchedAttendee) {
                item.formData = { ...matchedAttendee };
                cartModified = true;
              }
            }
          }
          
          if (cartModified) {
            await cartsCollection.updateOne(
              { _id: cart._id },
              { 
                $set: { 
                  cartItems: cart.cartItems,
                  updatedAt: new Date()
                }
              }
            );
            result.success++;
          } else {
            result.skipped++;
          }
          
        } catch (error) {
          result.failed++;
          result.errors.push({
            registrationId: cart.cartId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Update failed:', error);
      throw error;
    }
    
    result.duration = Date.now() - startTime;
    
    console.log(`\n✅ Updated ${result.success} carts in ${(result.duration / 1000).toFixed(2)}s`);
    
    return result;
  }
  
  /**
   * Validate all existing carts
   */
  async validateAllCarts(): Promise<{
    total: number;
    valid: number;
    invalid: number;
    issues: Array<{
      cartId: string;
      errors: string[];
      warnings: string[];
    }>;
  }> {
    const cartsCollection = this.db.collection('carts');
    const carts = await cartsCollection.find({}).toArray();
    
    let valid = 0;
    let invalid = 0;
    const issues: Array<{
      cartId: string;
      errors: string[];
      warnings: string[];
    }> = [];
    
    console.log(`🔍 Validating ${carts.length} carts...`);
    
    for (const cart of carts) {
      const validation = this.validationService.validateCart(cart as any);
      
      if (validation.valid) {
        valid++;
      } else {
        invalid++;
        issues.push({
          cartId: cart.cartId,
          errors: validation.errors.map(e => e.message),
          warnings: validation.warnings.map(w => w.message)
        });
      }
    }
    
    console.log(`\n✅ Valid: ${valid}`);
    console.log(`❌ Invalid: ${invalid}`);
    
    if (issues.length > 0) {
      console.log('\n⚠️ Issues found:');
      issues.slice(0, 5).forEach(issue => {
        console.log(`  Cart ${issue.cartId}:`);
        issue.errors.forEach(err => console.log(`    ❌ ${err}`));
        issue.warnings.forEach(warn => console.log(`    ⚠️ ${warn}`));
      });
      if (issues.length > 5) {
        console.log(`  ... and ${issues.length - 5} more carts with issues`);
      }
    }
    
    return {
      total: carts.length,
      valid,
      invalid,
      issues
    };
  }
  
  /**
   * Clean up orphaned child items
   */
  async cleanupOrphanedItems(): Promise<number> {
    const cartsCollection = this.db.collection('carts');
    const carts = await cartsCollection.find({}).toArray();
    
    let cleaned = 0;
    
    for (const cart of carts) {
      const bundleItemIds = cart.cartItems
        .filter((item: any) => !item.parentItemId)
        .map((item: any) => item.cartItemId);
      
      const orphanedItems = cart.cartItems.filter((item: any) => 
        item.parentItemId && !bundleItemIds.includes(item.parentItemId)
      );
      
      if (orphanedItems.length > 0) {
        const cleanedItems = cart.cartItems.filter((item: any) => 
          !orphanedItems.includes(item)
        );
        
        await cartsCollection.updateOne(
          { _id: cart._id },
          { 
            $set: { 
              cartItems: cleanedItems,
              updatedAt: new Date()
            }
          }
        );
        
        cleaned += orphanedItems.length;
        console.log(`  🧹 Cleaned ${orphanedItems.length} orphaned items from cart ${cart.cartId}`);
      }
    }
    
    console.log(`\n✅ Cleaned ${cleaned} total orphaned items`);
    return cleaned;
  }
}