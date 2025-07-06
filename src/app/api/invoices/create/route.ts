import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/lib/mongodb';
import { InvoiceSequence } from '@/utils/invoice-sequence';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payment, registration, customerInvoice, supplierInvoice } = body;
    
    if (!payment || !registration) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const { db } = await connectMongoDB();
    const invoiceSequence = new InvoiceSequence(db);
    
    // Use payment date for invoice number generation
    const paymentDate = payment.timestamp ? new Date(payment.timestamp) : new Date();
    
    // Generate customer invoice number
    const customerInvoiceNumber = await invoiceSequence.generateLodgeTixInvoiceNumber(paymentDate);
    
    // Generate supplier invoice number (same number, different prefix)
    const supplierInvoiceNumber = customerInvoiceNumber.replace('LTIV-', 'LTSP-');
    
    // Prepare invoice documents with generated invoice numbers
    const invoicesToInsert = [];
    let customerInvoiceId = null;
    
    if (customerInvoice) {
      customerInvoiceId = new ObjectId();
      invoicesToInsert.push({
        _id: customerInvoiceId,
        ...customerInvoice,
        invoiceNumber: customerInvoiceNumber,
        paymentId: payment._id,
        registrationId: registration._id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    if (supplierInvoice) {
      invoicesToInsert.push({
        _id: new ObjectId(),
        ...supplierInvoice,
        invoiceNumber: supplierInvoiceNumber,
        paymentId: payment._id,
        registrationId: registration._id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Start a transaction to ensure all updates happen together
    const session = (db as any).client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Insert invoices
        if (invoicesToInsert.length > 0) {
          await db.collection('invoices').insertMany(invoicesToInsert, { session });
        }
        
        // Create transaction records for each invoice
        const transactionsToInsert = [];
        
        if (customerInvoice && customerInvoice.items) {
          // Create a transaction for each line item
          customerInvoice.items.forEach((item: any, index: number) => {
            const transactionId = new ObjectId();
            const transaction = {
              _id: transactionId,
              functionId: registration.functionId || null,
              paymentId: payment.paymentId || payment.transactionId,
              registrationId: registration.registrationId || registration._id,
              customerId: null,
              registrationDate: registration.createdAt || registration.timestamp,
              registrationType: registration.registrationType || null,
              paymentDate: payment.timestamp,
              paymentStatus: 'paid',
              invoiceNumber: customerInvoiceNumber,
              invoiceDate: new Date(customerInvoice.date).toISOString().split('T')[0],
              invoiceDueDate: customerInvoice.dueDate,
              invoiceType: 'customer',
              billTo_businessName: customerInvoice.billTo?.businessName || '',
              billTo_businessNumber: customerInvoice.billTo?.businessNumber || '',
              billTo_firstName: customerInvoice.billTo?.firstName || '',
              billTo_lastName: customerInvoice.billTo?.lastName || '',
              billTo_email: customerInvoice.billTo?.email || '',
              billTo_phone: customerInvoice.billTo?.phone || null,
              billTo_addressLine1: customerInvoice.billTo?.addressLine1 || '',
              billTo_addressLine2: customerInvoice.billTo?.addressLine2 || null,
              billTo_city: customerInvoice.billTo?.city || '',
              billTo_postalCode: customerInvoice.billTo?.postalCode || '',
              billTo_stateProvince: customerInvoice.billTo?.stateProvince || '',
              supplier_name: customerInvoice.billFrom?.name || 'United Grand Lodge of NSW & ACT',
              supplier_abn: customerInvoice.billFrom?.abn || '93 230 340 687',
              supplier_address: customerInvoice.billFrom?.address || 'Level 5, 279 Castlereagh St Sydney NSW 2000',
              supplier_issuedBy: customerInvoice.issuedBy || 'LodgeTix as Agent',
              item_description: item.description,
              item_quantity: item.quantity || 0,
              item_price: item.price || 0,
              invoice_subtotal: customerInvoice.subtotal || 0,
              invoice_processingFees: customerInvoice.processingFees || 0,
              invoice_total: customerInvoice.total || 0,
              payment_method: payment.paymentMethod || 'credit_card',
              payment_transactionId: payment.transactionId,
              payment_paidDate: new Date(payment.timestamp).toISOString().split('T')[0],
              payment_amount: payment.grossAmount || payment.amount || 0,
              payment_currency: payment.currency || 'AUD',
              payment_status: 'completed',
              payment_source: payment.source,
              payment_last4: payment.cardLast4 || payment.last4,
              payment_cardBrand: payment.cardBrand,
              registration_objectId: registration._id,
              payment_objectId: payment._id,
              invoice_objectId: customerInvoiceId?.toString(),
              invoice_object_createdAt: new Date(),
              invoice_object_updatedAt: new Date(),
              invoice_emailedTo: null,
              invoice_emailedDate: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            transactionsToInsert.push(transaction);
            
            // If item has children, create transactions for them too
            if (item.children && Array.isArray(item.children)) {
              item.children.forEach((child: any, childIndex: number) => {
                const childTransaction = {
                  ...transaction,
                  _id: new ObjectId(),
                  item_description: `${item.description} - ${child.description}`,
                  item_quantity: child.quantity || 0,
                  item_price: child.price || 0,
                  item_parentId: transactionId
                };
                transactionsToInsert.push(childTransaction);
              });
            }
          });
        }
        
        // Insert transactions
        if (transactionsToInsert.length > 0) {
          await db.collection('transactions').insertMany(transactionsToInsert, { session });
        }
        
        // Update payment as processed
        await db.collection('payments').updateOne(
          { _id: payment._id },
          { 
            $set: { 
              customerInvoiceNumber: customerInvoiceNumber,
              supplierInvoiceNumber: supplierInvoiceNumber,
              invoiceCreated: true,
              invoiceCreatedAt: new Date(),
              invoiceId: customerInvoiceId,
              invoiceStatus: 'created',
              // Store the complete invoice objects with all mapped values
              customerInvoice: customerInvoice ? {
                ...customerInvoice,
                invoiceNumber: customerInvoiceNumber
              } : null,
              supplierInvoice: supplierInvoice ? {
                ...supplierInvoice,
                invoiceNumber: supplierInvoiceNumber
              } : null
            }
          },
          { session }
        );
        
        // Update registration as processed
        await db.collection('registrations').updateOne(
          { _id: registration._id },
          { 
            $set: { 
              customerInvoiceNumber: customerInvoiceNumber,
              supplierInvoiceNumber: supplierInvoiceNumber,
              invoiceCreated: true,
              invoiceCreatedAt: new Date(),
              invoiceId: customerInvoiceId,
              invoiceStatus: 'created',
              // Store the complete invoice objects with all mapped values
              customerInvoice: customerInvoice ? {
                ...customerInvoice,
                invoiceNumber: customerInvoiceNumber
              } : null,
              supplierInvoice: supplierInvoice ? {
                ...supplierInvoice,
                invoiceNumber: supplierInvoiceNumber
              } : null
            }
          },
          { session }
        );
      });
      
      // Return the generated invoice numbers
      return NextResponse.json({
        success: true,
        customerInvoiceNumber,
        supplierInvoiceNumber
      });
      
    } finally {
      await session.endSession();
    }
    
  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}