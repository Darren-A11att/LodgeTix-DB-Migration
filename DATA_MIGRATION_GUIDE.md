# Data Migration Tool Guide

## Overview

The Data Migration Tool is designed to help migrate data from the existing "dirty" database structure to the new clean schema we've designed. It follows a similar pattern to the payment-to-invoice reconciliation tool but is more flexible for general data migration.

## Features

- **Multi-Source Migration**: Select a primary source collection and add multiple related collections
- **Multi-Destination Mapping**: Map to a primary destination collection and additional collections
- **Field Mapping Interface**: Visual field mapping from source to destination
- **Saved Mappings**: Save and reuse field mapping templates
- **Preview Before Processing**: See exactly what will be created before committing
- **One-by-One Processing**: Process documents individually with full control

## How to Use

### 1. Access the Tool

Navigate to the Data Migration Tool from the main dashboard by clicking the "🔄 Data Migration Tool" button.

### 2. Configure Source Collections

1. **Primary Source**: Select the main collection you want to migrate from (e.g., `functions`)
2. **Additional Sources**: Add related collections that contain data you need (e.g., `events`, `eventTickets`, `locations`)

The tool will automatically try to find related documents based on common fields like:
- `_id`
- `functionId`
- `eventId`
- `organisationId`
- `userId`
- `email`

### 3. Configure Destination Collections

1. **Primary Destination**: Select the main collection to migrate to (e.g., `functions`)
2. **Additional Destinations**: Add other collections that should receive data (e.g., `contacts`, `jurisdictions`)

### 4. Map Fields

For each destination field, you can:
- **Select a source field**: Choose from any field in your source documents
- **Enter a custom value**: Type a fixed value
- **Use default mapping**: The tool will use mappings defined in `documents.json`

### 5. Preview and Process

1. Click "Preview Migration" to see what documents will be created
2. Review the preview carefully
3. Click "Process & Continue" to create the documents and move to the next record
4. Use "Previous" and "Next" to navigate without processing

### 6. Save Mappings

Save your field mappings as templates for reuse:
1. Click "Save Mapping"
2. Give it a descriptive name
3. Add a description of when to use it
4. The mapping will be saved for future use

## Example Migration Scenarios

### Scenario 1: Functions to Clean Schema

**Sources**: 
- Primary: `functions`
- Additional: `events`, `locations`

**Destinations**:
- Primary: `functions` (clean)

**Key Mappings**:
- `functionId` → `functions.functionId`
- `name` → Custom value or from events
- `events` → Embedded from events collection

### Scenario 2: Registrations with Contact Creation

**Sources**:
- Primary: `registrations`
- Additional: `attendees`, `organisations`

**Destinations**:
- Primary: `registrations` (clean)
- Additional: `contacts`, `attendees` (clean)

**Key Mappings**:
- Create contacts from registration/attendee data
- Link registrations to contacts
- Preserve attendee event-specific data

### Scenario 3: Organisation Migration

**Sources**:
- Primary: `organisations`
- Additional: `lodges`, `grandlodges`

**Destinations**:
- Primary: `organisations` (clean)
- Additional: `jurisdictions`

**Key Mappings**:
- Create jurisdiction hierarchy
- Link organisations to jurisdictions
- Preserve masonic structure

## Tips

1. **Start Small**: Test with a few documents first
2. **Save Mappings Early**: Create templates for common patterns
3. **Check Related Documents**: Ensure the tool finds the right related data
4. **Use Preview**: Always preview before processing
5. **Document Issues**: Note any data quality issues for later cleanup

## Technical Details

The tool uses the `documents.json` files from our schema design as the target structure. These files contain:
- Field definitions
- Default mappings (e.g., `"functionId": "functions: functionId"`)
- TODO markers for fields that need manual mapping

The migration preserves data integrity while transforming it to match our new schema design with:
- Contact-centric architecture
- Separated jurisdictions
- Clean relationships
- Proper data types