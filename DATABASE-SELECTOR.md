# Database Selector Feature

The MongoDB Explorer now includes a database selector dropdown that allows you to switch between different MongoDB databases/clusters.

## 🎯 Purpose

This feature enables you to:
- Switch between production and test databases
- Compare data across different environments
- Use different databases for different purposes

## 📋 Available Databases

### 1. **LodgeTix** (Production - Default)
- **Description**: Clean, completed transaction data only
- **Use Case**: Production data with validated payments and registrations
- **Status**: ✅ Default database

### 2. **LodgeTix-migration-test-1** (Test/Migration)
- **Description**: Development and testing data
- **Use Case**: Testing, development, and migration verification
- **Status**: 🧪 Test environment

## 🎛️ How to Use

### In the Web Interface:
1. Open the MongoDB Explorer in your browser
2. Look for the **Database Selector** dropdown in the top-right corner of the homepage
3. Click on the dropdown to see available databases
4. Select your desired database
5. The page will reload with the selected database

### Visual Indicators:
- **Green dot (●)**: Production/Default database
- **Blue dot (●)**: Test/Development database
- **Checkmark**: Currently selected database

## 🔧 Technical Details

### Configuration
Database configurations are stored in `src/lib/database-selector.ts`:

```typescript
export const DATABASE_CONFIGS: DatabaseConfig[] = [
  {
    id: 'lodgetix-production',
    name: 'LodgeTix',
    description: 'Production database with clean, completed transaction data',
    connectionString: 'mongodb+srv://...',
    isDefault: true
  },
  {
    id: 'lodgetix-migration-test',
    name: 'LodgeTix-migration-test-1', 
    description: 'Migration test database with development/testing data',
    connectionString: 'mongodb+srv://...'
  }
];
```

### Client-Side Selection
The selected database is stored in localStorage and persists across browser sessions.

### API Integration
All API routes now support dynamic database selection through query parameters.

## 🚀 Features

- **Persistent Selection**: Your database choice is remembered across browser sessions
- **Real-time Switching**: Change databases instantly with page reload
- **Visual Feedback**: Clear indicators show which database is active
- **Production Safety**: Default to production database for safety
- **Easy Expansion**: Add new databases by updating the configuration

## 💡 Tips

1. **Production First**: The system defaults to the production database for safety
2. **Data Comparison**: Use different browser tabs to compare data across databases
3. **Development Workflow**: Use the test database for development and testing
4. **Visual Cues**: Pay attention to the colored dots to know which environment you're in

## 🔐 Security Notes

- Database credentials are securely stored in environment variables
- Each database has its own connection string for isolation
- No sensitive information is exposed in the client-side code

## 📈 Current Data Status

### LodgeTix (Production)
- ✅ 127 payments (completed only)
- ✅ 98 registrations (completed payments only) 
- ✅ 131 attendees (from completed registrations)

### LodgeTix-migration-test-1 (Test)
- 🧪 Full dataset including pending/failed transactions
- 🧪 Development and testing data
- 🧪 Migration verification data