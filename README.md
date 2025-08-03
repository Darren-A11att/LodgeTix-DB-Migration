# LodgeTix - Reconcile

A comprehensive MongoDB database explorer and data management tool for LodgeTix, featuring payment reconciliation, invoice generation, and data migration capabilities.

## Overview

This project provides:
- **MongoDB Explorer**: A web-based interface for exploring and managing MongoDB collections
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
cd mongodb-explorer && npm install

# Run the MongoDB Explorer
npm run dev
```

The MongoDB Explorer will be available at [http://localhost:3005](http://localhost:3005)

### Available Scripts

```bash
# Development
npm run dev                    # Run MongoDB Explorer
npm run migration-viewer       # Run Migration Viewer
npm run dev:all               # Run all services concurrently

# Data Sync
npm run sync                  # Sync all data
npm run sync:quick           # Sync last 7 days
npm run sync:payments        # Sync payments only
npm run sync:registrations   # Sync registrations only
```

## Features

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
├── mongodb-explorer/       # Main application
│   ├── src/               # Source code
│   │   ├── app/          # Next.js app directory
│   │   ├── services/     # Business logic services
│   │   ├── utils/        # Utility functions
│   │   └── components/   # React components
│   └── public/           # Static assets
├── migration-viewer/      # Migration tracking UI
└── scripts/              # Utility scripts
```

## Environment Variables

Create a `.env` file in the mongodb-explorer directory:

```env
MONGODB_URI=mongodb://...
MONGODB_DATABASE=your-database
SQUARE_ACCESS_TOKEN=your-token
SQUARE_ENVIRONMENT=sandbox|production
```

## Support

For issues or questions, please contact the development team.