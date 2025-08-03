const { MongoClient } = require('mongodb');

async function checkAllCollectionsData() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://darrenallatt:jcvnyprynSOqIc2k@lodgetix.0u7ogxj.mongodb.net/?retryWrites=true&w=majority&appName=LodgeTix';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('LodgeTix');
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    
    console.log('\n=== CHECKING ALL COLLECTIONS FOR DATA ===');
    
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`${collection.name}: ${count} documents`);
      
      // If collection has data, show a sample
      if (count > 0) {
        const sample = await db.collection(collection.name).findOne({});
        console.log(`  Sample fields: ${Object.keys(sample).join(', ')}`);
        
        // Check for ticket-related fields
        const ticketRelatedFields = Object.keys(sample).filter(field => 
          field.toLowerCase().includes('ticket') || 
          field.toLowerCase().includes('attendee') ||
          field.toLowerCase().includes('owner')
        );
        
        if (ticketRelatedFields.length > 0) {
          console.log(`  Ticket-related fields: ${ticketRelatedFields.join(', ')}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
checkAllCollectionsData().catch(console.error);