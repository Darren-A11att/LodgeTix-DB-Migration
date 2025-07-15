import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, Db } from 'mongodb';
import { InvoiceDataRepository } from '@/services/invoice/invoice-data-repository';
import { InvoiceGeneratorFactory } from '@/services/invoice/generators/invoice-generator-factory';
import { formatMoney } from '@/services/invoice/calculators/monetary';

const MONGODB_URI = process.env.MONGODB_URI!;
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';

// Payment IDs provided by the user
const TEST_PAYMENT_IDS = {
  individuals: [
    'pi_3QWwNBI6o3M7akJR0xo7fLRD',
    'pi_3QWwXqI6o3M7akJR0CbhjGac',
    'pi_3QWvdDI6o3M7akJR10aGGBJz',
    'pi_3QWwKrI6o3M7akJR0pYM7Bya'
  ],
  lodges: [
    'pi_3QWvJxI6o3M7akJR1QL0aLKK',
    'pi_3QX0NRI6o3M7akJR0HdqiJgb',
    'pi_3QX17xI6o3M7akJR0fZCQ9z6',
    'pi_3QX0jVI6o3M7akJR175YQnxr',
    'pi_3QWvgLI6o3M7akJR09n6rCT5'
  ]
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const paymentId = searchParams.get('paymentId');
  const testAll = searchParams.get('testAll') === 'true';

  let client: MongoClient | null = null;
  
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db: Db = client.db(DATABASE_NAME);
    const dataRepository = new InvoiceDataRepository(db);
    const invoiceGeneratorFactory = new InvoiceGeneratorFactory();
    
    const results: any[] = [];
    
    if (paymentId) {
      // Test single payment
      const result = await testSinglePayment(paymentId, dataRepository, invoiceGeneratorFactory);
      results.push(result);
    } else if (testAll) {
      // Test all payments
      for (const paymentId of [...TEST_PAYMENT_IDS.individuals, ...TEST_PAYMENT_IDS.lodges]) {
        const result = await testSinglePayment(paymentId, dataRepository, invoiceGeneratorFactory);
        results.push(result);
      }
    } else {
      // Return list of test payment IDs
      return NextResponse.json({
        testPaymentIds: TEST_PAYMENT_IDS,
        usage: {
          singlePayment: '/api/test-invoice-generation?paymentId=PAYMENT_ID',
          allPayments: '/api/test-invoice-generation?testAll=true'
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

async function testSinglePayment(
  paymentId: string,
  dataRepository: InvoiceDataRepository,
  invoiceGeneratorFactory: InvoiceGeneratorFactory
): Promise<any> {
  try {
    const { payment, registration } = await dataRepository.getPaymentWithRegistration(paymentId);
    
    if (!payment) {
      return {
        paymentId,
        success: false,
        error: 'Payment not found'
      };
    }
    
    if (!registration) {
      return {
        paymentId,
        success: false,
        error: 'No registration found',
        payment: {
          amount: payment.amount,
          timestamp: payment.timestamp,
          source: payment.source
        }
      };
    }
    
    // Determine registration type
    const registrationType = determineRegistrationType(registration);
    
    // Generate invoice
    const generator = invoiceGeneratorFactory.getGenerator(registrationType);
    const invoice = await generator.generateInvoice({
      payment,
      registration,
      invoiceNumbers: {
        customerInvoiceNumber: `TEST-${paymentId.slice(-6)}`,
        supplierInvoiceNumber: `TEST-${paymentId.slice(-6)}`
      }
    });
    
    return {
      paymentId,
      success: true,
      registrationType,
      confirmation: registration.confirmationNumber,
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        billTo: {
          name: invoice.billTo.businessName || `${invoice.billTo.firstName} ${invoice.billTo.lastName}`,
          email: invoice.billTo.email
        },
        subtotal: invoice.subtotal,
        processingFees: invoice.processingFees,
        gstIncluded: invoice.gstIncluded,
        total: invoice.total,
        itemCount: invoice.items.length,
        items: invoice.items.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        }))
      }
    };
    
  } catch (error) {
    return {
      paymentId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function determineRegistrationType(registration: any): string {
  const regType = registration.registrationType || 
                 registration.registrationData?.type ||
                 registration.type;

  if (regType?.toLowerCase().includes('lodge')) return 'Lodge';
  if (regType?.toLowerCase().includes('delegation')) return 'Delegation';
  return 'Individual';
}