import React from 'react';
import type { DocumentType, DocContext } from '@/app/documents/DocumentTypes';
import { requireString, requireNonNegativeNumber } from '@/app/documents/validation';
import ReceiptDocument from '@/services/pdf/templates/ReceiptDocument';
import { ObjectId } from 'mongodb';

type Input = { paymentId: string };
type ReceiptData = React.ComponentProps<typeof ReceiptDocument>;

export class ReceiptDocumentType implements DocumentType<Input, ReceiptData> {
  async load(input: Input, ctx: DocContext): Promise<any> {
    const payment = await ctx.db.collection('payments').findOne({ _id: new ObjectId(input.paymentId) });
    if (!payment) throw new Error('Payment not found');
    return { payment };
  }

  async transform(raw: any, ctx: DocContext): Promise<ReceiptData> {
    const { payment } = raw;
    const receiptNumber = await this.ensureReceiptNumber(ctx, payment);
    const amount = Number(payment.amount) || 0;
    return {
      receiptNumber,
      date: payment.createdAt || payment.timestamp || new Date(),
      customer: { name: payment.customerName || 'Unknown Customer', email: payment.customerEmail || '' },
      payment: { method: payment.paymentMethod || 'Card', date: payment.createdAt || new Date(), amount, reference: payment.paymentId || payment.squarePaymentId },
      organization: {
        name: 'United Grand Lodge of NSW & ACT',
        abn: '93 230 340 687',
        address: 'Level 5, 279 Castlereagh St Sydney NSW 2000',
        issuedBy: 'LodgeTix as Agent',
      },
      note: 'Thank you for your payment.',
    };
  }

  validate(data: ReceiptData): void {
    requireString(data.receiptNumber, 'receiptNumber');
    requireString(data.customer?.name, 'customer.name');
    requireNonNegativeNumber(data.payment?.amount, 'payment.amount');
  }

  title(data: ReceiptData): string { return data.receiptNumber; }

  template(data: ReceiptData): React.ReactElement { return <ReceiptDocument {...data} />; }

  private async ensureReceiptNumber(ctx: DocContext, payment: any): Promise<string> {
    if (payment.receiptNumber) return payment.receiptNumber;
    const next = await ctx.db.collection('counters').findOneAndUpdate(
      { _id: 'receiptNumber' },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const seq = next.value?.value || 1;
    const num = `LTRC-${String(seq).padStart(9, '0')}`;
    await ctx.db.collection('payments').updateOne({ _id: payment._id }, { $set: { receiptNumber: num } });
    return num;
  }
}

export default ReceiptDocumentType;

