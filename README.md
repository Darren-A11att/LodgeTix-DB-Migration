# LodgeTix - Reconcile

A comprehensive MongoDB database explorer and data management tool for LodgeTix, featuring payment reconciliation, invoice generation, and data migration capabilities.

## Overview

This project provides:
- **MongoDB Explorer**: A web-based interface for exploring and managing MongoDB collections
- **MedusaJS E-commerce Backend**: Complete e-commerce system with products, inventory, carts, and orders
- **Payment Import & Reconciliation**: Tools for importing and matching Square payments with registrations
- **Invoice Generation**: Automated invoice creation and management
- **Data Migration Tools**: Utilities for migrating and transforming data
- **Migration Viewer**: Visual interface for tracking data migration progress

## Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB connection
- Environment variables configured (see `.env.example`)

### Installation

```bash
# Install dependencies
npm install
cd mongodb-explorer && npm install

# Setup MedusaJS database (one-time setup)
node medusajs/scripts/setup-medusajs-database.js

# Run services
npm run dev                    # MongoDB Explorer
npm run api                    # MedusaJS API Server
```

- MongoDB Explorer: [http://localhost:3005](http://localhost:3005)
- MedusaJS API: [http://localhost:3001](http://localhost:3001)
- API Health Check: [http://localhost:3001/health](http://localhost:3001/health)

### Available Scripts

```bash
# Development
npm run dev                    # Run MongoDB Explorer
npm run api                    # Run MedusaJS API Server
npm run migration-viewer       # Run Migration Viewer
npm run dev:all               # Run all services concurrently

# MedusaJS Operations
node medusajs/scripts/setup-medusajs-database.js    # Setup database
node medusajs/scripts/verify-medusajs-setup.js      # Verify setup
node medusajs/scripts/test-medusajs-operations.js   # Run tests

# Data Sync
npm run sync                  # Sync all data
npm run sync:quick           # Sync last 7 days
npm run sync:payments        # Sync payments only
npm run sync:registrations   # Sync registrations only
```

### TypeScript, Linting, and Formatting

- Scripts now run via tsx and are written in TypeScript:
  - `npm run dev`, `npm run sync:quick`, etc.
- Typecheck:
  - Core: `npm run typecheck`
  - App (components/hooks/lib): `cd mongodb-explorer && npm run typecheck:app`
- Lint & format:
  - `npm run lint` / `npm run lint:fix`
  - `npm run format` / `npm run format:check`

See `docs/typing-plan.md` for the staged strictness plan.

## Features

### MedusaJS E-commerce Backend
- **Product Management**: Complete product catalog with variants and pricing
- **Unified Inventory System**: Single pattern for simple products, bundles, and multi-part products
- **Shopping Cart**: Real-time cart management with availability checking
- **Order Processing**: Complete order workflow with inventory reservations
- **Customer Management**: Customer profiles and order history
- **Performance Optimization**: Multi-level caching and query optimization

### MongoDB Explorer
- Browse all collections with document counts
- Search across collections by ID, email, name, or confirmation number
- View and edit individual documents
- Enhanced payment views with registration matching

### Payment Import & Reconciliation
- Import Square payments
- Automatic matching with registrations
- Manual match review and approval
- Match analysis tools

### Invoice Management
- Generate invoices for payments
- Support for individual and lodge invoices
- PDF generation with multiple rendering engines
- Email invoice functionality

### Reports & Tools
- Proclamation Banquet Sales Report
- Event ticket sales analysis
- Registration type breakdown
- Data reconciliation dashboard

## Project Structure

```
LodgeTix - Reconcile/
├── medusajs/              # MedusaJS E-commerce Backend
│   ├── api/              # Express API server
│   ├── scripts/          # Database setup & utilities
│   └── implementation/   # Schema & documentation
├── mongodb-explorer/      # Main application
│   ├── src/              # Source code
│   │   ├── app/         # Next.js app directory
│   │   ├── services/    # Business logic services
│   │   ├── utils/       # Utility functions
│   │   └── components/  # React components
│   └── public/          # Static assets
├── migration-viewer/     # Migration tracking UI
└── scripts/             # Utility scripts
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=lodgetix

# MedusaJS API
PORT=3001
NODE_ENV=production

# Payment Providers
SQUARE_ACCESS_TOKEN=your-token
SQUARE_ENVIRONMENT=sandbox|production
STRIPE_SECRET_KEY=your-stripe-key

# Email Service
RESEND_API_KEY=your-resend-key
```

## Component Descriptions

### MedusaJS E-commerce API
- **Products**: `GET /store/products` - List products with pagination and search
- **Product Details**: `GET /store/products/:id` - Get product with availability information
- **Cart Management**: `POST /store/carts` - Create and manage shopping carts
- **Add to Cart**: `POST /store/carts/:id/line-items` - Add items with inventory validation
- **Orders**: `POST /store/carts/:id/complete` - Complete cart as order with reservations

### MongoDB Explorer UI
- **Collections Browser**: View all MongoDB collections with document counts
- **Document Editor**: View and edit individual documents with JSON editor
- **Search Interface**: Cross-collection search by ID, email, name, confirmation number
- **Invoice Management**: Generate, approve, and email invoices with PDF rendering

### Data Import & Sync
- **Square Integration**: Import payments and match with registrations
- **Stripe Integration**: Multi-account Stripe payment import and processing
- **Supabase Sync**: Registration data synchronization from Supabase
- **Payment Matching**: Automated and manual payment-to-registration matching

## Testing Instructions

### Unit Tests
```bash
# Run MedusaJS operation tests (26 test cases)
node medusajs/scripts/test-medusajs-operations.js

# Expected output: All tests pass with performance metrics
# Coverage: Availability checks, reservations, cart operations, concurrent access
```

### Integration Tests
```bash
# Test API endpoints
node medusajs/api/test-endpoints.js

# Test database operations
node medusajs/scripts/integration-tests.js
```

### Performance Tests
```bash
# Load testing (100 concurrent requests)
node medusajs/scripts/load-test.js

# Memory and performance monitoring
node medusajs/scripts/monitoring-dashboard.js
```

### Manual Testing
```bash
# Start services
npm run api

# Test endpoints
curl http://localhost:3001/health
curl http://localhost:3001/store/products
curl -X POST http://localhost:3001/store/carts \
  -H "Content-Type: application/json" \
  -d '{"region_id":"reg_default"}'
```

## Support

For issues or questions, please contact the development team.

### Documentation References
- **Complete Implementation**: `/medusajs/IMPLEMENTATION-COMPLETE.md`
- **API Documentation**: `/medusajs/API-DOCUMENTATION.md`
- **Schema Reference**: `/medusajs/implementation/mongodb-schema.md`
## Server-side Invoice PDF API

- Endpoint: `GET /api/invoices/:paymentId/pdf`
  - Returns an `application/pdf` response rendered on the server without side effects (no DB writes, no emails, no uploads).
  - Uses `UnifiedInvoiceService.generatePreview` and the PDF generator service with PDFKit on Node and Puppeteer fallback.

Example (from the `mongodb-explorer` app):

```
curl -L "http://localhost:3005/api/invoices/<paymentId>/pdf" \
  -o invoice.pdf
```

If running the local dev servers via the root scripts, ensure the API and web ports are correctly configured (see `.port-config.json` and `mongodb-explorer/server.ts`).
