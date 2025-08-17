import { MongoClient } from 'mongodb';

const MONGODB_URI_PROD = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/lodgetix?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';
const MONGODB_URI_TEST = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/test?retryWrites=true&w=majority&appName=LodgeTix';
const MONGODB_URI_MIGTEST = 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/LodgeTix-migration-test-1?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1';

interface ErrorPaymentDetails {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderTotal: number;
  currency: string;
  orderItems: Array<{
    name: string;
    quantity: number;
  }>;
  orderDate: string;
}

async function searchMatchingRegistrations() {
  const prodClient = new MongoClient(MONGODB_URI_PROD);
  const testClient = new MongoClient(MONGODB_URI_TEST);
  const migTestClient = new MongoClient(MONGODB_URI_MIGTEST);
  
  try {
    // Connect to all databases
    await prodClient.connect();
    await testClient.connect();
    await migTestClient.connect();
    console.log('Connected to production, test, and migration test databases\n');
    
    // Get enriched error payments from production
    const prodDb = prodClient.db('lodgetix');
    const errorPayments = await prodDb.collection('error_payments').find({ 
      'originalData.order': { $exists: true },
      'originalData.customer': { $exists: true }
    }).toArray();
    
    console.log(`Found ${errorPayments.length} enriched error payments\n`);
    
    // Extract details from error payments
    const paymentDetails: ErrorPaymentDetails[] = errorPayments.map(payment => {
      const order = payment.originalData.order;
      const customer = payment.originalData.customer;
      
      return {
        id: payment._id.toString(),
        customerName: `${customer.given_name || ''} ${customer.family_name || ''}`.trim(),
        customerEmail: customer.email_address || '',
        customerPhone: customer.phone_number || '',
        orderTotal: order.total_money ? order.total_money.amount / 100 : 0,
        currency: order.total_money ? order.total_money.currency : '',
        orderItems: order.line_items ? order.line_items.map((item: any) => ({
          name: item.name || 'Unknown',
          quantity: parseInt(item.quantity) || 1
        })) : [],
        orderDate: order.created_at || ''
      };
    });
    
    // Search both test databases for matching registrations
    const testDb = testClient.db('test');
    const migTestDb = migTestClient.db('LodgeTix-migration-test-1');
    
    const testRegistrations = await testDb.collection('registrations').find({}).toArray();
    const migTestRegistrations = await migTestDb.collection('registrations').find({}).toArray();
    
    console.log(`Found ${testRegistrations.length} registrations in test database`);
    console.log(`Found ${migTestRegistrations.length} registrations in migration test database`);
    
    const allRegistrations = [...testRegistrations, ...migTestRegistrations];
    console.log(`Total registrations to search: ${allRegistrations.length}\n`);
    
    // Find matches for each error payment
    for (const payment of paymentDetails) {
      console.log(`=== Searching matches for Payment: ${payment.customerName} ===`);
      console.log(`Order: ${payment.orderTotal} ${payment.currency}`);
      console.log(`Email: ${payment.customerEmail}`);
      console.log(`Phone: ${payment.customerPhone}`);
      console.log(`Items: ${payment.orderItems.map(item => `${item.name} (x${item.quantity})`).join(', ')}`);
      console.log(`Date: ${payment.orderDate}\n`);
      
      const matches = [];
      
      // Search by various criteria
      for (const reg of allRegistrations) {
        let matchScore = 0;
        let matchReasons = [];
        
        // Check amount match (within $5 tolerance for currency conversion)
        const regTotal = reg.totalAmount || 0;
        if (Math.abs(regTotal - payment.orderTotal) <= 5) {
          matchScore += 30;
          matchReasons.push(`Amount match: ${regTotal} vs ${payment.orderTotal}`);
        }
        
        // Check email match
        if (reg.contactEmail && payment.customerEmail && 
            reg.contactEmail.toLowerCase() === payment.customerEmail.toLowerCase()) {
          matchScore += 40;
          matchReasons.push('Email exact match');
        }
        
        // Check name similarity
        const regName = `${reg.firstName || ''} ${reg.lastName || ''}`.trim();
        if (regName && payment.customerName && 
            regName.toLowerCase().includes(payment.customerName.toLowerCase()) ||
            payment.customerName.toLowerCase().includes(regName.toLowerCase())) {
          matchScore += 20;
          matchReasons.push(`Name similarity: "${regName}" vs "${payment.customerName}"`);
        }
        
        // Check phone match (remove formatting)
        if (reg.phone && payment.customerPhone) {
          const regPhone = reg.phone.replace(/\D/g, '');
          const paymentPhone = payment.customerPhone.replace(/\D/g, '');
          if (regPhone === paymentPhone || 
              (regPhone.length > 6 && paymentPhone.length > 6 && 
               regPhone.slice(-8) === paymentPhone.slice(-8))) {
            matchScore += 25;
            matchReasons.push('Phone match');
          }
        }
        
        // Check registration type/items
        if (reg.registrationType) {
          const hasLodgePackage = payment.orderItems.some(item => 
            item.name && item.name.toLowerCase().includes('lodge'));
          const regTypeIsLodge = reg.registrationType.toLowerCase().includes('lodge');
          
          if (hasLodgePackage && regTypeIsLodge) {
            matchScore += 15;
            matchReasons.push('Lodge package match');
          }
        }
        
        // Check quantity match
        const totalOrderQuantity = payment.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        if (reg.attendeeCount && Math.abs(reg.attendeeCount - totalOrderQuantity) <= 2) {
          matchScore += 10;
          matchReasons.push(`Quantity match: ${reg.attendeeCount} vs ${totalOrderQuantity}`);
        }
        
        // Check date proximity (within 7 days)
        if (reg.createdAt && payment.orderDate) {
          const regDate = new Date(reg.createdAt);
          const orderDate = new Date(payment.orderDate);
          const daysDiff = Math.abs((regDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff <= 7) {
            matchScore += 5;
            matchReasons.push(`Date proximity: ${daysDiff.toFixed(1)} days apart`);
          }
        }
        
        // Consider it a potential match if score >= 40
        if (matchScore >= 40) {
          matches.push({
            registration: reg,
            score: matchScore,
            reasons: matchReasons,
            regName,
            regEmail: reg.contactEmail,
            regPhone: reg.phone,
            regAmount: regTotal,
            regType: reg.registrationType,
            regCount: reg.attendeeCount,
            regDate: reg.createdAt
          });
        }
      }
      
      // Sort matches by score (highest first)
      matches.sort((a, b) => b.score - a.score);
      
      if (matches.length > 0) {
        console.log(`🎯 Found ${matches.length} potential match(es):\n`);
        
        matches.forEach((match, idx) => {
          console.log(`  Match ${idx + 1} (Score: ${match.score}):`);
          console.log(`    Registration ID: ${match.registration._id}`);
          console.log(`    Name: ${match.regName}`);
          console.log(`    Email: ${match.regEmail}`);
          console.log(`    Phone: ${match.regPhone}`);
          console.log(`    Amount: ${match.regAmount} ${payment.currency}`);
          console.log(`    Type: ${match.regType}`);
          console.log(`    Count: ${match.regCount}`);
          console.log(`    Date: ${match.regDate}`);
          console.log(`    Reasons: ${match.reasons.join(', ')}`);
          console.log('');
        });
      } else {
        console.log('❌ No potential matches found\n');
      }
      
      console.log('---\n');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prodClient.close();
    await testClient.close();
    await migTestClient.close();
  }
}

searchMatchingRegistrations();