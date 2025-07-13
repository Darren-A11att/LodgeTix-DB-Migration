/**
 * MongoDB connection helper
 * Converted from MongoDB Relational Migrator output
 */
import { MongoClient, Db } from "mongodb";

// Connection URI - should be configured via environment variables in production
const uri = "mongodb+srv://sample-hostname:27017/?maxPoolSize=20&w=majority";

// Create a new MongoClient
const client = new MongoClient(uri);

async function run(): Promise<void> {
    try {
        // Connect the client to the server (optional starting in v4.7)
        await client.connect();
        // Establish and verify connection
        const database: Db = client.db("test");
        await database.command({ ping: 1 });
        console.log("Connected successfully to server");
    } finally {
        // Ensures that the client will close when you finish/error
        await client.close();
    }
}

// Export the run function and client for potential reuse
export { run, client };

// Run the connection test if this file is executed directly
if (require.main === module) {
    run().catch(console.dir);
}