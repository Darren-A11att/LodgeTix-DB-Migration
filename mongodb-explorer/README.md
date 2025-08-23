# MongoDB Explorer - E-Commerce Collections Viewer

A web-based MongoDB viewer for exploring the e-commerce migration collections.

## Features

- 📦 View all MongoDB collections with document counts
- 🔍 Search and filter documents by field values
- 📊 Schema analysis for each collection
- 🏢 Customer type visualization (Person vs Organisation)
- 📝 Special formatting for e-commerce collections (products, carts, orders, forms)
- 📄 Pagination for large collections
- 🎨 Clean, modern UI with collection highlighting

## Installation

```bash
npm install
```

## Usage

Start the server:
```bash
npm start
```

Then open your browser to:
```
http://localhost:3005
```

## New E-Commerce Collections

The following collections were created during the migration:

### 📦 **products**
- Bundle products (Grand Proclamation 2025)
- Event products (individual events)
- Package products (multi-part packages)
- Each product has variants with SKUs

### 🛒 **carts**
- Shopping carts with customer objects
- Cart items with formData containing registration details
- Customer can be 'person' or 'organisation'
- Organisation customers have businessName and businessNumber

### 📋 **orders**
- Completed orders converted from carts
- Includes customer, payment, and fulfillment status
- Preserves original registration IDs

### 📝 **forms**
- Form schema definitions (not submissions)
- Maps to product variants
- Different forms for:
  - Individual Mason
  - Individual Guest
  - Lodge
  - Grand Lodge
  - Masonic Order

### 📊 **inventory**
- Stock management for products
- Tracks available, reserved, and sold quantities

## Customer Types

- **Person**: Individual customers (bookingContact without businessName)
- **Organisation**: Business customers (bookingContact with businessName)
  - Always linked to a person (the booking contact)
  - Includes businessName and optional businessNumber (ABN/ACN)

## Key Features

1. **Collection Browser**: Click any collection in the sidebar to view its documents
2. **Document Count**: See the total number of documents in each collection
3. **Search**: Filter documents by field name and value
4. **Schema Analysis**: View field types and frequencies for any collection
5. **Customer Type Tags**: Visual indicators for person vs organisation customers
6. **Expandable Documents**: Click any document to see full JSON structure

## Understanding the Data

### Cart Structure
- Each cart has a **customer** object (the bookingContact who made the purchase)
- **cartItems** array contains the products purchased
- For individual registrations: One bundle item per attendee
- For lodge registrations: Single bundle item with quantity

### Order Structure
- Similar to carts but with completed payment information
- **orderNumber** is the confirmation number
- **customer** is always the purchaser, not the attendees

### FormData
- Stored in cartItems for migration data
- Contains actual attendee or lodge details
- Relationships stored as arrays with partnerOf (name) and partnerId

## Port Configuration

Default port is 3005. Can be changed via environment variable:
```bash
PORT=3006 npm start
```

## Requirements

- Node.js 14+
- MongoDB connection (configured in ../.env.local)
- Modern web browser

## Troubleshooting

If you see connection errors:
1. Check that MongoDB URI is correct in `.env.local`
2. Ensure MongoDB server is running
3. Verify network connectivity to MongoDB host

## Development

The explorer consists of:
- `server.js` - Express API server with MongoDB connectivity
- `public/index.html` - Single-page web application
- No build process required - pure HTML/CSS/JavaScript

To modify the UI, edit `public/index.html` directly.
To add new API endpoints, edit `server.js`.