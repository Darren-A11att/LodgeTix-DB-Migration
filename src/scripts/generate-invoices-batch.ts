import 'dotenv/config';
import { MongoClient } from 'mongodb';
import UnifiedInvoiceService from '@/services/unified-invoice-service';

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'LodgeTix-migration-test-1';

  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  // Parse CLI args
  const args = new Map<string, string>();
  process.argv.slice(2).forEach((arg) => {
    const [k, v] = arg.split('=');
    if (k && v) args.set(k.replace(/^--/, ''), v);
  });

  const dateFrom = args.get('from') ? new Date(args.get('from')!) : undefined;
  const dateTo = args.get('to') ? new Date(args.get('to')!) : undefined;
  const limit = args.get('limit') ? parseInt(args.get('limit')!, 10) : undefined;
  const regenerate = args.get('regenerate') === 'true';

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);

    const invoiceService = new UnifiedInvoiceService(db);
    console.log('Starting batch invoice generation...', { dateFrom, dateTo, limit, regenerate });

    const result = await invoiceService.batchProcessInvoices({
      dateFrom,
      dateTo,
      limit,
      regenerate,
    });

    console.log('Batch completed:', result);
  } catch (err) {
    console.error('Batch generation failed:', err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();

