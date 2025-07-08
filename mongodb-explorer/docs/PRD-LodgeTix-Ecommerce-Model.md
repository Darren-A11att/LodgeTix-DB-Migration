# LodgeTix E-Commerce Model - Product Requirements Document (PRD)

## Version 2.0 - January 2025

## Executive Summary

LodgeTix is transforming from an event management system to a comprehensive e-commerce platform for Masonic organizations. This document defines the new e-commerce data model that provides flexibility for tickets, merchandise, sponsorships, and future product types.

## E-Commerce Model Architecture

### Hierarchy
```
Catalog Objects (e.g., "Grand Proclamation 2025")
  └── Products (e.g., "Grand Banquet", "Ceremony", "Gold Sponsorship")
      └── Variations (e.g., "Standard Ticket", "VIP Ticket", "Early Bird")
          └── Items (inventory units with quantity tracking)
```

## Core Collections

### 1. Users (Authentication Only)
- **Purpose**: Minimal user records for authentication per MongoDB standards
- **Key Attributes**:
  - Email (unique identifier)
  - Password (hashed)
  - ContactId (reference to profile data)
  - Authentication metadata
- **Relationships**:
  - User → Contact (1:1 optional)

### 2. Contacts (Universal People Entity)
- **Purpose**: Central entity for all people in the system
- **Replaces**: Separate attendees, customers, and user profile tables
- **Key Attributes**:
  - Contact number (CON-YYYY-NNNNN)
  - Profile information
  - Masonic affiliations
  - Addresses
  - Relationships
- **Roles** (Context-specific):
  - Attendee (for a function)
  - Organizer (for a function)
  - Sponsor (for a function)
  - Staff (for organization)
  - Multiple roles allowed per contact
- **Order References**:
  - Tracks all orders where contact is purchaser or attendee
  - Enables viewing "my registrations" and "my tickets"
- **Key Rules**:
  - Can exist without user account
  - Start with minimal data, enrich over time
  - When user claims registration, link to contact

### 3. Catalog Objects
- **Purpose**: Top-level grouping of related products (currently only "function" type)
- **Key Attributes**:
  - CatalogId (UUID)
  - Name and slug
  - Type (function, merchandise_collection, sponsorship_program)
  - Status (draft, published, active, closed)
  - Organizer (organisation or contact)
  - Dates (published, on sale, start, end)
- **Embedded Structure**:
  - Products[] (embedded array)
  - Settings and metadata

### 4. Products (Embedded in Catalog Objects)
- **Purpose**: Sellable items within a catalog
- **Categories**:
  - **Event**: Ticketed experiences (banquet, ceremony, workshop)
  - **Merchandise**: Physical goods
  - **Sponsorship**: Sponsorship packages
  - **Package**: Bundle of other products
- **Key Attributes**:
  - ProductId (UUID)
  - Name and description
  - Category
  - Attributes (flexible based on category)
  - Dependencies (eligibility, prerequisites)
- **Embedded Structure**:
  - Variations[] (embedded array)

### 5. Variations (Embedded in Products)
- **Purpose**: Different versions of a product
- **Examples**:
  - Event: Standard Ticket, VIP Ticket, Early Bird
  - Merchandise: Small, Medium, Large
  - Sponsorship: Gold, Silver, Bronze
- **Key Attributes**:
  - VariationId (UUID)
  - Name and description
  - Price (amount and currency)
  - Inventory (embedded)
- **Inventory Tracking**:
  - quantity_total: Maximum that can be sold
  - quantity_sold: Current sold count
  - quantity_reserved: In carts/pending
  - quantity_available: total - sold - reserved

### 6. Orders (Replaces Registrations)
- **Purpose**: Record of a purchase transaction
- **Order Types**:
  - Registration (event tickets)
  - Purchase (merchandise)
  - Sponsorship
- **Key Attributes**:
  - Order number (ORD-YYYY-NNNNNN)
  - Customer (individual, lodge, delegation)
  - Line items
  - Financial totals
  - Payment status
- **Line Items**:
  - Product and variation references
  - Quantity and pricing
  - Owner (contact or organization)
  - Raw attendee data (before contact creation)
  - Fulfillment status

### 7. Tickets (Fulfillment Records)
- **Purpose**: The actual tickets created after order payment
- **Creation**:
  - Generated after successful payment
  - One ticket per quantity in line item
  - Contains QR code for check-in
- **Ownership**:
  - Individual: Assigned to contact
  - Lodge/Delegation: Owned by organization until assigned
- **Key Attributes**:
  - Ticket number (TKT-YYYY-NNNNNNN)
  - Order and line item references
  - Owner (contact or organization)
  - QR code
  - Usage tracking

### 8. Financial Transactions (Unchanged)
- Payment processing records
- Links to orders

### 9. Invoices (Unchanged)
- Financial documents
- Links to orders

### 10. Organizations (Unchanged)
- Lodges, Grand Lodges, associations
- Can be order customers
- Can own tickets for distribution

### 11. Jurisdictions (Unchanged)
- Hierarchical structure for Masonic jurisdictions

## Key Business Rules

### Inventory Management
1. **Atomic Updates**: Inventory updates must be atomic to prevent overselling
2. **Real-time Availability**: quantity_available = quantity_total - quantity_sold - quantity_reserved
3. **Reservation System**: Items in cart are temporarily reserved

### Order Processing
1. **Validation**: Check inventory availability before accepting order
2. **Payment First**: Tickets only created after payment success
3. **Fulfillment**: Different products have different fulfillment methods

### Contact Management
1. **Progressive Enhancement**: Start with minimal data, add details over time
2. **Claim Process**: Users can claim their attendee records
3. **Role-Based**: Contacts have different roles in different contexts

### Lodge/Delegation Orders
1. **Bulk Purchase**: Can buy multiple items
2. **Unassigned Ownership**: Organization owns until assigned
3. **Later Assignment**: Can assign to attendees post-purchase

## Migration Impact

### From Old Model to New:
1. **Functions** → Catalog Objects (type: function)
2. **Events** → Products (category: event)
3. **Event Tickets** → Variations of event products
4. **Attendees** → Contacts with attendee role
5. **Registrations** → Orders (type: registration)
6. **Products Collection** → Deleted (embedded in catalog)

## Advantages of E-Commerce Model

1. **Flexibility**: Easy to add new product types
2. **Scalability**: Supports merchandise, sponsorships, packages
3. **Inventory Control**: Real-time tracking at variation level
4. **Order Management**: Unified order processing
5. **Contact Unification**: Single source of truth for people
6. **Future-Proof**: Aligns with standard e-commerce patterns

## Implementation Notes

### Embedded vs Referenced
- **Embedded**: Products in Catalog, Variations in Products
  - Always accessed together
  - Strong ownership relationship
  - Within MongoDB 16MB limit
- **Referenced**: Orders reference Contacts
  - Independent lifecycle
  - Many-to-many relationships

### Atomic Operations
- Use MongoDB transactions for inventory updates
- Implement optimistic locking for concurrent access
- Reserve inventory during checkout process

### Performance Considerations
- Index on all lookup fields
- Computed views for common aggregations
- Denormalize frequently accessed data