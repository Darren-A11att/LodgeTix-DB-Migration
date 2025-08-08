// @ts-nocheck
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load parent project's .env.local
const parentEnvPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(parentEnvPath)) {
  console.log('Loading parent .env.local from:', parentEnvPath);
  dotenv.config({ path: parentEnvPath });
}

// Import reconciliation service
const { SquarePaymentReconciliationService } = require('../src/services/square-payment-reconciliation');

const app = express();
const PORT = process.env.API_PORT || 3006;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Square Payment Reconciliation Endpoints
app.post('/api/square/reconcile/fetch', async (req, res) => {
  let client = null;
  try {
    const { startDate, endDate, locationIds, limit } = req.body;
    
    const mongoUri = process.env.MONGODB_URI;
    const squareToken = process.env.SQUARE_ACCESS_TOKEN;
    
    if (!mongoUri || !squareToken) {
      return res.status(500).json({ 
        error: 'Missing required environment variables (MONGODB_URI or SQUARE_ACCESS_TOKEN)' 
      });
    }
    
    client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db();
    const environment = squareToken.startsWith('EAAA') ? 'production' : 'sandbox';
    
    console.log('Fetching Square payments for reconciliation...');
    console.log('Environment:', environment);
    console.log('Date range:', startDate || 'default', 'to', endDate || 'now');
    
    const reconciliationService = new SquarePaymentReconciliationService(
      db, 
      squareToken, 
      environment
    );
    
    const result = await reconciliationService.fetchAndStoreSquarePayments({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      locationIds,
      limit
    });
    
    console.log('Fetch complete:', result);
    
    res.json({
      success: true,
      result
    });
    
  } catch (error) {
    console.error('Error in fetch endpoint:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

app.post('/api/square/reconcile/process', async (req, res) => {
  let client = null;
  try {
    const { batchSize, onlyNew } = req.body;
    
    const mongoUri = process.env.MONGODB_URI;
    const squareToken = process.env.SQUARE_ACCESS_TOKEN;
    
    if (!mongoUri || !squareToken) {
      return res.status(500).json({ 
        error: 'Missing required environment variables' 
      });
    }
    
    client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db();
    const environment = squareToken.startsWith('EAAA') ? 'production' : 'sandbox';
    
    console.log('Processing reconciliation...');
    console.log('Batch size:', batchSize || 'default');
    console.log('Only new:', onlyNew || false);
    
    const reconciliationService = new SquarePaymentReconciliationService(
      db, 
      squareToken, 
      environment
    );
    
    const result = await reconciliationService.reconcilePayments({
      batchSize,
      onlyNew
    });
    
    console.log('Reconciliation complete:', result);
    
    res.json({
      success: true,
      result
    });
    
  } catch (error) {
    console.error('Error in process endpoint:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

app.get('/api/square/reconcile/stats', async (req, res) => {
  let client = null;
  try {
    const mongoUri = process.env.MONGODB_URI;
    const squareToken = process.env.SQUARE_ACCESS_TOKEN;
    
    if (!mongoUri || !squareToken) {
      return res.status(500).json({ 
        error: 'Missing required environment variables' 
      });
    }
    
    client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db();
    const environment = squareToken.startsWith('EAAA') ? 'production' : 'sandbox';
    
    const reconciliationService = new SquarePaymentReconciliationService(
      db, 
      squareToken, 
      environment
    );
    
    const stats = await reconciliationService.getReconciliationStats();
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('Error in stats endpoint:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

app.get('/api/square/reconcile/discrepancies', async (req, res) => {
  let client = null;
  try {
    const { limit = 50 } = req.query;
    
    const mongoUri = process.env.MONGODB_URI;
    const squareToken = process.env.SQUARE_ACCESS_TOKEN;
    
    if (!mongoUri || !squareToken) {
      return res.status(500).json({ 
        error: 'Missing required environment variables' 
      });
    }
    
    client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db();
    const environment = squareToken.startsWith('EAAA') ? 'production' : 'sandbox';
    
    const reconciliationService = new SquarePaymentReconciliationService(
      db, 
      squareToken, 
      environment
    );
    
    const discrepancies = await reconciliationService.getDiscrepancies(
      parseInt(limit)
    );
    
    res.json({
      success: true,
      discrepancies
    });
    
  } catch (error) {
    console.error('Error in discrepancies endpoint:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// Write port configuration
const portConfig = {
  apiPort: PORT,
  timestamp: new Date().toISOString()
};

fs.writeFileSync(
  path.join(__dirname, '..', '.port-config.json'),
  JSON.stringify(portConfig, null, 2)
);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`📍 Reconciliation endpoints available at:`);
  console.log(`   POST http://localhost:${PORT}/api/square/reconcile/fetch`);
  console.log(`   POST http://localhost:${PORT}/api/square/reconcile/process`);
  console.log(`   GET  http://localhost:${PORT}/api/square/reconcile/stats`);
  console.log(`   GET  http://localhost:${PORT}/api/square/reconcile/discrepancies`);
  console.log(`\n🔑 Environment:`);
  console.log(`   MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);
  console.log(`   Square Token: ${process.env.SQUARE_ACCESS_TOKEN ? 'Found' : 'Not configured'}`);
});
