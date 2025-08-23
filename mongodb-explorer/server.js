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

let client;
let db;

// Connect to MongoDB
async function connectDB() {
  try {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db('supabase');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// API Routes

// Get all collections
app.get('/api/collections', async (req, res) => {
  try {
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

// Get schema analysis for a collection
app.get('/api/collections/:name/schema', async (req, res) => {
  try {
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
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 MongoDB Explorer running at http://localhost:${PORT}`);
    console.log('📊 View your collections at http://localhost:${PORT}');
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  if (client) {
    await client.close();
  }
  process.exit(0);
});