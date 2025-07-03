#!/bin/bash

# Copy schema files to the public directory for the migration tool

SOURCE_DIR="docs/database-schema/collections"
DEST_DIR="mongodb-explorer/public/database-schema/collections"

echo "Copying schema files to public directory..."

# Ensure destination exists
mkdir -p "$DEST_DIR"

# Copy all documents.json files
for collection in functions registrations attendees tickets financial-transactions organisations contacts users jurisdictions; do
  if [ -f "$SOURCE_DIR/$collection/documents.json" ]; then
    mkdir -p "$DEST_DIR/$collection"
    cp "$SOURCE_DIR/$collection/documents.json" "$DEST_DIR/$collection/"
    echo "✓ Copied $collection/documents.json"
  else
    echo "✗ Missing $collection/documents.json"
  fi
done

echo "Schema files copied successfully!"