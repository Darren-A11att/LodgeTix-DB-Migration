import React from 'react';
import type { DocumentType, DocContext } from '@/app/documents/DocumentTypes';
import { requireString, requireArrayNonEmpty, requireNonNegativeNumber } from '@/app/documents/validation';
import InvoiceDocument from '@/services/pdf/templates/InvoiceDocument';
import type { Db, ObjectId } from 'mongodb';
import { ObjectId as ObjId } from 'mongodb';

type Input = { paymentId: string; regenerateNumber?: boolean };

type InvoiceData = React.ComponentProps<typeof InvoiceDocument>;

export class InvoiceDocumentType implements DocumentType<Input, InvoiceData> {
  async load(input: Input, ctx: DocContext): Promise<any> {
    const { db } = ctx;
    const payment = await db.collection('payments').findOne({ _id: new ObjId(input.paymentId) });
    if (!payment) throw new Error('Payment not found');
    if (!payment.matchedRegistrationId) throw new Error('Payment has no matched registration');

    const registration = await db.collection('registrations').findOne({ _id: new ObjId(payment.matchedRegistrationId) });
    if (!registration) throw new Error('Registration not found');

    const event = await db.collection('events').findOne({ eventId: registration.functionId || registration.eventId });
    return { payment, registration, event };
  }

  async transform(raw: any, ctx: DocContext): Promise<InvoiceData> {
    const { payment, registration, event } = raw;
    const invoiceNumber = await this.ensureInvoiceNumber(ctx.db, payment);

    const totalAmount: number = Number(payment.amount) || 0;
    const gstRate = 0.1;
    const gstAmount = Math.round(totalAmount * gstRate * 100) / 100;
    const subtotal = Math.max(totalAmount - gstAmount, 0);

    const items = this.buildItems(registration);

    return {
      invoiceNumber,
      date: new Date(),
      status: 'Paid',
      customer: {
        name: registration.registrationData?.bookingContact?.name || registration.registrationData?.attendees?.[0]?.name || payment.customerName || 'Unknown Customer',
        email: registration.registrationData?.bookingContact?.email || payment.customerEmail || '',
        address: registration.registrationData?.bookingContact?.address || '',
      },
      event: { name: event?.name || 'Event' },
      registration: { confirmationNumber: registration.confirmationNumber },
      items,
      subtotal,
      gstAmount,
      totalAmount,
      payment: { method: payment.paymentMethod || 'Card', date: payment.createdAt || payment.timestamp || new Date() },
      organization: {
        name: 'United Grand Lodge of NSW & ACT',
        abn: '93 230 340 687',
        address: 'Level 5, 279 Castlereagh St Sydney NSW 2000',
        issuedBy: 'LodgeTix as Agent',
      },
    };
  }

  validate(data: InvoiceData): void {
    requireString(data.invoiceNumber, 'invoiceNumber');
    requireString(data.customer?.name, 'customer.name');
    requireArrayNonEmpty(data.items, 'items');
    requireNonNegativeNumber(data.subtotal, 'subtotal');
    requireNonNegativeNumber(data.gstAmount, 'gstAmount');
    requireNonNegativeNumber(data.totalAmount, 'totalAmount');
  }

  title(data: InvoiceData): string { return data.invoiceNumber; }

  template(data: InvoiceData): React.ReactElement { return React.createElement(InvoiceDocument, data); }

  // Helpers
  private buildItems(registration: any): InvoiceData['items'] {
    const out: InvoiceData['items'] = [];
    const tickets = registration.registrationData?.tickets || [];
    const groups: Record<string, { name: string; price: number; quantity: number; }> = {};
    for (const t of tickets) {
      const key = `${t.eventTicketId}-${t.price}`;
      if (!groups[key]) groups[key] = { name: t.name || 'Ticket', price: t.price || 0, quantity: 0 };
      groups[key].quantity += t.quantity || 1;
    }
    Object.values(groups).forEach(g => {
      out.push({ description: g.name, quantity: g.quantity, unitPrice: g.price, total: g.price * g.quantity });
    });
    if (out.length === 0) {
      out.push({ description: `${registration.registrationType || 'Registration'} Fee`, quantity: registration.attendeeCount || 1, unitPrice: registration.totalAmountPaid || 0, total: registration.totalAmountPaid || 0 });
    }
    return out;
  }

  private async ensureInvoiceNumber(db: Db, payment: any): Promise<string> {
    if (payment.invoiceNumber) return payment.invoiceNumber;
    const next = await db.collection('counters').findOneAndUpdate(
      { _id: 'invoiceNumber' as any },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const seq = next.value?.value || 1;
    const num = `LTIV-${String(seq).padStart(9, '0')}`;
    // persist back minimally
    await db.collection('payments').updateOne({ _id: payment._id }, { $set: { invoiceNumber: num } });
    return num;
  }
}

export default InvoiceDocumentType;
