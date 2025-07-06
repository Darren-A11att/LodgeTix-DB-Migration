# Package Migration Implementation Summary

## Overview
The migration scripts have been updated to handle the `packages` collection and transform packages into products within the catalog object structure.

## Changes Made

### 1. migrate-catalog-objects.js
- Added code to read the `packages` collection from the database
- Added grouping of packages by function ID
- Created `transformPackageToProduct` function that:
  - Parses PostgreSQL array format `{"(variation_id,quantity)"}` for included items
  - Transforms packages into products with type "package"
  - Stores package mappings for order processing
  - Initializes inventory tracking for packages
  - Calculates discount percentages from original vs package price

### 2. migrate-orders-payments.js
- Updated `createLineItems` function to detect and handle package tickets
- Added `createPackageLineItem` function to create line items for packages
- Enhanced `updateInventoryForOrder` function to:
  - Detect package line items
  - Update inventory for each included item based on quantity
  - Handle both package inventory and included item inventory

## Package Structure Handling

### Input Package Fields:
- `packageId` (UUID) - Unique identifier
- `name` - Package name
- `description` - Package description
- `originalPrice` / `packagePrice` (Decimal128) - Pricing
- `quantity` - Number of items in package
- `included_items` - PostgreSQL array format (e.g., `{"(variation_id,quantity)"}`)
- `functionId` - Associated function ID
- `registrationTypes` - Array of allowed registration types
- `eligibilityCriteria` - Eligibility criteria text

### Output Product Structure:
- Product with `category: 'package'`
- Single variation representing the package
- `dependencies` array listing included items
- `attributes` containing original price, discount %, and included items summary
- Inventory tracking for both package and included items

## Inventory Management

When a package is sold:
1. The package's own inventory is reduced by the quantity sold
2. Each included item's inventory is reduced by: `included_quantity * packages_sold`

Example: If a lodge package contains 10 banquet tickets and 2 packages are sold:
- Package inventory: reduced by 2
- Banquet ticket inventory: reduced by 20 (10 × 2)

## Testing

A test script (`test-package-migration.js`) has been created to verify:
- PostgreSQL array parsing functionality
- Inventory calculation logic
- Package structure transformation

## Usage

The migration will automatically:
1. Read packages from the `packages` collection
2. Transform them into products in the catalog
3. Track package sales in orders
4. Update inventory for both packages and their included items
5. Maintain all mappings for proper order-to-ticket relationships

## Notes

- Packages are treated as a special type of product with dependencies
- The system maintains referential integrity between packages and their included items
- Inventory updates cascade properly from package sales to included item inventory
- All package metadata is preserved in the transformed structure