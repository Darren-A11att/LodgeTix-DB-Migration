"use strict";
/**
 * Line item builder for creating invoice line items
 * Provides a fluent interface for building invoice items with proper formatting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LineItemBuilder = void 0;
const monetary_1 = require("../calculators/monetary");
class LineItemBuilder {
    constructor() {
        this.items = [];
    }
    /**
     * Add a header line item (no quantity/price)
     */
    addHeader(description) {
        this.items.push({
            description,
            quantity: 0,
            price: 0,
            total: 0,
            type: 'header'
        });
        return this;
    }
    /**
     * Add a confirmation header for individuals registration
     */
    addConfirmationHeader(confirmationNumber, functionName) {
        const description = `${confirmationNumber || 'N/A'} | Individuals for ${functionName || 'Event'}`;
        return this.addHeader(description);
    }
    /**
     * Add a lodge header
     */
    addLodgeHeader(confirmationNumber, lodgeName, functionName) {
        const description = `${confirmationNumber || 'N/A'} | ${lodgeName || 'Lodge'} for ${functionName || 'Event'}`;
        return this.addHeader(description);
    }
    /**
     * Add attendees with their tickets as sub-items
     */
    addAttendees(attendees) {
        attendees.forEach(attendee => {
            // Add attendee line (no quantity/price)
            const attendeeItem = {
                description: this.formatAttendeeName(attendee),
                quantity: 0,
                price: 0,
                total: 0,
                type: 'attendee',
                subItems: []
            };
            // Add attendee's tickets as sub-items
            if (attendee.tickets && attendee.tickets.length > 0) {
                attendeeItem.subItems = attendee.tickets.map(ticket => this.createTicketSubItem(ticket));
            }
            this.items.push(attendeeItem);
        });
        return this;
    }
    /**
     * Add a single line item with quantity and price
     */
    addLineItem(description, quantity, price) {
        const total = (0, monetary_1.roundToMoney)(quantity * price);
        this.items.push({
            description,
            quantity,
            price: (0, monetary_1.roundToMoney)(price),
            total,
            type: 'other'
        });
        return this;
    }
    /**
     * Add lodge registration items
     */
    addLodgeItems(lodgeName, memberCount, pricePerMember) {
        const description = `${lodgeName} - ${memberCount} Members`;
        return this.addLineItem(description, memberCount, pricePerMember);
    }
    /**
     * Add processing fees reimbursement (for supplier invoices)
     */
    addProcessingFeesReimbursement(amount) {
        return this.addLineItem('Processing Fees Reimbursement', 1, amount);
    }
    /**
     * Add software utilization fee (for supplier invoices)
     */
    addSoftwareUtilizationFee(amount) {
        return this.addLineItem('Software Utilization Fee', 1, amount);
    }
    /**
     * Add unassigned tickets (tickets not assigned to specific attendees)
     */
    addUnassignedTickets(tickets) {
        const unassignedTickets = tickets.filter(t => !t.attendeeId || t.ownerType === 'registration');
        if (unassignedTickets.length > 0) {
            // Add header for unassigned tickets
            this.addHeader('Additional Tickets');
            // Add each ticket
            unassignedTickets.forEach(ticket => {
                this.addLineItem(ticket.name, ticket.quantity, ticket.price);
            });
        }
        return this;
    }
    /**
     * Build and return the items array
     */
    build() {
        // Calculate totals for any items that need it
        this.items.forEach(item => {
            if (item.quantity && item.price && !item.total) {
                item.total = (0, monetary_1.roundToMoney)(item.quantity * item.price);
            }
            // Calculate sub-item totals
            if (item.subItems) {
                item.subItems.forEach(subItem => {
                    if (subItem.quantity && subItem.price && !subItem.total) {
                        subItem.total = (0, monetary_1.roundToMoney)(subItem.quantity * subItem.price);
                    }
                });
            }
        });
        return this.items;
    }
    /**
     * Clear all items and start fresh
     */
    clear() {
        this.items = [];
        return this;
    }
    /**
     * Get current item count
     */
    getItemCount() {
        return this.items.length;
    }
    /**
     * Calculate subtotal from current items
     */
    calculateSubtotal() {
        let subtotal = 0;
        this.items.forEach(item => {
            // Add main item total
            if (item.total) {
                subtotal += item.total;
            }
            // Add sub-item totals
            if (item.subItems) {
                item.subItems.forEach(subItem => {
                    if (subItem.total) {
                        subtotal += subItem.total;
                    }
                });
            }
        });
        return (0, monetary_1.roundToMoney)(subtotal);
    }
    /**
     * Format attendee name with lodge info
     */
    formatAttendeeName(attendee) {
        let name = attendee.name;
        // Add lodge info if available
        if (attendee.lodgeInfo) {
            name += ` | ${attendee.lodgeInfo}`;
        }
        return name;
    }
    /**
     * Create a ticket sub-item with proper formatting
     */
    createTicketSubItem(ticket) {
        return {
            description: `  - ${ticket.name}`, // Indented with dash
            quantity: ticket.quantity,
            price: (0, monetary_1.roundToMoney)(ticket.price),
            total: (0, monetary_1.roundToMoney)(ticket.quantity * ticket.price),
            type: 'ticket'
        };
    }
    /**
     * Create line items from raw items array (for migration)
     */
    static fromRawItems(items) {
        const builder = new LineItemBuilder();
        items.forEach(item => {
            if (item.quantity === 0 && item.price === 0) {
                // Header item
                builder.addHeader(item.description);
            }
            else if (item.description.startsWith('  -') || item.description.startsWith('-')) {
                // Skip sub-items as they should be handled with their parent
                return;
            }
            else {
                // Regular line item
                builder.addLineItem(item.description, item.quantity || 1, item.price || 0);
            }
        });
        return builder.build();
    }
}
exports.LineItemBuilder = LineItemBuilder;
