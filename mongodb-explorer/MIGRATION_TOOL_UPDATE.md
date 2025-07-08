# Migration Tool Update - Manual Document Selection

## 🚀 What Changed

The migration tool now supports manual document selection for better control:

### Previous Behavior:
- Automatically tried to find related documents
- Navigated through documents sequentially
- Limited control over which documents to combine

### New Behavior:
- **Manual Document Selection**: Click "Select Document" button for each collection
- **Search Interface**: Search for specific documents by ID, email, name, etc.
- **Visual Feedback**: See which documents are selected
- **Flexible Combination**: Build exactly the document set you want to migrate

## 📋 Updated Workflow

1. **Select Primary Source Collection**
   - Choose your main collection (e.g., `functions`)
   - Click "Select Document" button
   - Search for and select the specific document

2. **Add Additional Sources**
   - Add additional source collections
   - For each collection, click "Select Doc" 
   - Search and select related documents

3. **Configure Destinations**
   - Select primary and additional destination collections
   - Map fields from your selected source documents

4. **Process Documents**
   - Preview the migration
   - Process the selected documents
   - Documents are cleared after successful migration
   - Ready to select new documents immediately

## 🔍 Document Search Tips

- Search by document ID (exact match)
- Search by email (partial match)
- Search by name or other text fields
- View key fields before selecting

## ✨ Benefits

- **Full Control**: Choose exactly which documents to migrate together
- **Better Accuracy**: Manually verify relationships before migration
- **Flexible Workflow**: Not limited to automatic relationship detection
- **Clear Visibility**: See what you're migrating before processing

## 🎯 Example Use Case

Migrating a function with specific events:
1. Select `functions` as primary source
2. Search for and select the function document
3. Add `events` as additional source
4. Search for and select only the events you want
5. Map fields and process

The tool is now ready for your controlled data migration workflow!