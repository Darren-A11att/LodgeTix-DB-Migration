const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store multiple MongoDB connections
const connections = new Map();
let currentConnection = {
  cluster: 'LodgeTix-migration-test-1',
  database: 'lodgetix',
  client: null,
  db: null
};

// MongoDB cluster configurations - matching the frontend DatabaseSelector
const clusters = {
  'LodgeTix': {
    uri: 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix',
    databases: ['LodgeTix', 'LodgeTix-migration-test-1', 'admin', 'local']
  },
  'LodgeTix-migration-test-1': {
    uri: process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix-migration-test.wydwfu6.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix-migration-test-1',
    databases: ['LodgeTix-migration-test-1', 'admin', 'commerce', 'local', 'lodgetix', 'projectCleanUp', 'supabase', 'test', 'UGLOps']
  }
};

// Connect to MongoDB with cluster and database selection
async function connectDB(clusterName = 'LodgeTix-migration-test-1', databaseName = 'lodgetix') {
  try {
    const connectionKey = `${clusterName}:${databaseName}`;
    
    // Check if we already have this connection
    if (connections.has(connectionKey)) {
      const conn = connections.get(connectionKey);
      currentConnection = conn;
      console.log(`✅ Switched to ${clusterName}/${databaseName}`);
      return conn.db;
    }
    
    // Create new connection
    const cluster = clusters[clusterName];
    if (!cluster) {
      throw new Error(`Unknown cluster: ${clusterName}`);
    }
    
    const client = new MongoClient(cluster.uri);
    await client.connect();
    const db = client.db(databaseName);
    
    const connection = {
      cluster: clusterName,
      database: databaseName,
      client,
      db
    };
    
    connections.set(connectionKey, connection);
    currentConnection = connection;
    
    console.log(`✅ Connected to MongoDB ${clusterName}/${databaseName}`);
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

// Get current database connection
function getDB() {
  return currentConnection.db;
}

// API Routes

// Get available clusters and databases
app.get('/api/clusters', async (req, res) => {
  try {
    const clusterList = Object.keys(clusters).map(name => ({
      name,
      databases: clusters[name].databases,
      current: name === currentConnection.cluster
    }));
    res.json(clusterList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current connection info
app.get('/api/connection', async (req, res) => {
  res.json({
    cluster: currentConnection.cluster,
    database: currentConnection.database
  });
});

// Switch database connection
app.post('/api/connection', async (req, res) => {
  try {
    const { cluster, database } = req.body;
    
    if (!cluster || !database) {
      return res.status(400).json({ error: 'Cluster and database are required' });
    }
    
    await connectDB(cluster, database);
    
    res.json({
      success: true,
      cluster: currentConnection.cluster,
      database: currentConnection.database
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all collections
app.get('/api/collections', async (req, res) => {
  try {
    const db = getDB();
    if (!db) {
      return res.status(500).json({ error: 'No database connection' });
    }
    
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name).sort();
    res.json(collectionNames);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get collection stats
app.get('/api/collections/:name/stats', async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection(req.params.name);
    const count = await collection.countDocuments();
    const sample = await collection.findOne({});
    
    res.json({
      name: req.params.name,
      count,
      fields: sample ? Object.keys(sample) : []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get documents from a collection with pagination
app.get('/api/collections/:name/documents', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', field = '', value = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const db = getDB();
    const collection = db.collection(req.params.name);
    
    // Build query
    let query = {};
    if (search) {
      // Simple text search on string fields
      query = { $text: { $search: search } };
    } else if (field && value) {
      // Field-specific search
      if (value === 'true' || value === 'false') {
        query[field] = value === 'true';
      } else if (!isNaN(value)) {
        query[field] = Number(value);
      } else {
        query[field] = { $regex: value, $options: 'i' };
      }
    }
    
    const documents = await collection
      .find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    
    const total = await collection.countDocuments(query);
    
    res.json({
      documents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single document by ID
app.get('/api/collections/:name/documents/:id', async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection(req.params.name);
    const document = await collection.findOne({ 
      $or: [
        { _id: req.params.id },
        { cartId: req.params.id },
        { orderId: req.params.id },
        { customerId: req.params.id },
        { productId: req.params.id },
        { formId: req.params.id }
      ]
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(document);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comparison data for registration vs cart
app.get('/api/compare/:registrationId', async (req, res) => {
  try {
    const { ComparisonViewer } = require('./services/comparison-viewer');
    const viewer = new ComparisonViewer(getDB());
    
    const comparison = await viewer.compareRegistrationToCart(req.params.registrationId);
    
    if (!comparison) {
      return res.status(404).json({ error: 'Registration or cart not found' });
    }
    
    res.json(comparison);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get validation report for single registration
app.get('/api/validation/:registrationId', async (req, res) => {
  try {
    const { ComparisonViewer } = require('./services/comparison-viewer');
    const viewer = new ComparisonViewer(getDB());
    
    const report = await viewer.generateFieldValidationReport(req.params.registrationId);
    
    if (!report) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get validation summary for all registrations
app.get('/api/validation/all', async (req, res) => {
  try {
    const { ComparisonViewer } = require('./services/comparison-viewer');
    const viewer = new ComparisonViewer(getDB());
    
    // Get all registration IDs
    const db = getDB();
    const registrations = await db.collection('registrations')
      .find({}, { projection: { registrationId: 1 } })
      .toArray();
    
    const validationResults = [];
    let totalRegistrations = registrations.length;
    let processedCount = 0;
    
    // Process each registration
    for (const registration of registrations) {
      try {
        const report = await viewer.generateFieldValidationReport(registration.registrationId);
        if (report) {
          validationResults.push({
            registrationId: registration.registrationId,
            overallTransferPercentage: report.overallTransferPercentage,
            totalFields: report.totalFields,
            transferredFields: report.transferredFields,
            missingFields: report.missingFields.length,
            status: report.overallTransferPercentage >= 80 ? 'good' : 
                   report.overallTransferPercentage >= 60 ? 'warning' : 'poor'
          });
        }
        processedCount++;
      } catch (error) {
        console.error(`Error validating registration ${registration.registrationId}:`, error);
      }
    }
    
    // Calculate summary statistics
    const summary = {
      totalRegistrations,
      processedCount,
      averageTransferPercentage: validationResults.length > 0 
        ? (validationResults.reduce((sum, r) => sum + r.overallTransferPercentage, 0) / validationResults.length).toFixed(2)
        : 0,
      statusBreakdown: {
        good: validationResults.filter(r => r.status === 'good').length,
        warning: validationResults.filter(r => r.status === 'warning').length,
        poor: validationResults.filter(r => r.status === 'poor').length
      }
    };
    
    res.json({
      summary,
      results: validationResults.sort((a, b) => b.overallTransferPercentage - a.overallTransferPercentage)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reports page route
app.get('/reports', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reports.html'));
});

// Get all registration IDs for navigation
app.get('/api/registrations/ids', async (req, res) => {
  try {
    const db = getDB();
    const registrations = await db.collection('registrations')
      .find({}, { projection: { registrationId: 1, registrationType: 1 } })
      .toArray();
    
    res.json(registrations.map(r => ({
      id: r.registrationId,
      type: r.registrationType
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get schema analysis for a collection
app.get('/api/collections/:name/schema', async (req, res) => {
  try {
    const db = getDB();
    const collection = db.collection(req.params.name);
    const sample = await collection.aggregate([
      { $sample: { size: 100 } }
    ]).toArray();
    
    const schema = {};
    
    // Analyze field types and frequencies
    sample.forEach(doc => {
      analyzeDocument(doc, schema, '');
    });
    
    // Convert to array and sort by frequency
    const fields = Object.entries(schema)
      .map(([path, info]) => ({
        path,
        types: Array.from(info.types),
        frequency: (info.count / sample.length * 100).toFixed(1) + '%',
        samples: info.samples.slice(0, 3)
      }))
      .sort((a, b) => parseFloat(b.frequency) - parseFloat(a.frequency));
    
    res.json({
      collection: req.params.name,
      sampleSize: sample.length,
      fields
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function analyzeDocument(obj, schema, prefix) {
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_id') continue;
    
    const path = prefix ? `${prefix}.${key}` : key;
    
    if (!schema[path]) {
      schema[path] = {
        types: new Set(),
        count: 0,
        samples: []
      };
    }
    
    schema[path].count++;
    schema[path].types.add(Array.isArray(value) ? 'array' : typeof value);
    
    if (schema[path].samples.length < 3 && value !== null && value !== undefined) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        schema[path].samples.push('{...}');
      } else if (Array.isArray(value)) {
        schema[path].samples.push(`[${value.length} items]`);
      } else {
        schema[path].samples.push(value);
      }
    }
    
    // Recurse for nested objects (but not arrays)
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && prefix.split('.').length < 2) {
      analyzeDocument(value, schema, path);
    }
  }
}

// Start server
connectDB('LodgeTix-migration-test-1', 'lodgetix').then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 MongoDB Explorer running at http://localhost:${PORT}`);
    console.log(`📊 Default connection: LodgeTix-migration-test-1/lodgetix`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  // Close all MongoDB connections
  for (const [key, conn] of connections) {
    console.log(`Closing connection: ${key}`);
    if (conn.client) {
      await conn.client.close();
    }
  }
  process.exit(0);
});