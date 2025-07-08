import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';

interface ColumnAnalysis {
  fileName: string;
  columns: string[];
  sampleData: Record<string, any>;
}

async function getCSVColumns(filePath: string): Promise<ColumnAnalysis> {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(filePath);
    let columns: string[] = [];
    let sampleData: Record<string, any> = {};
    let firstDataRow = true;

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      max_record_size: 8192
    });

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        if (columns.length === 0) {
          columns = Object.keys(record);
        }
        
        // Get sample data from first actual data row
        if (firstDataRow && Object.values(record).some(v => v)) {
          sampleData = record;
          firstDataRow = false;
        }
      }
    });

    parser.on('error', reject);
    parser.on('end', () => {
      resolve({
        fileName,
        columns,
        sampleData
      });
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(parser);
  });
}

function findSimilarColumns(allColumns: Map<string, Set<string>>): void {
  // Common patterns to look for
  const patterns = [
    { pattern: /transaction/i, category: 'Transaction ID' },
    { pattern: /payment.*id/i, category: 'Payment ID' },
    { pattern: /^id$/i, category: 'ID' },
    { pattern: /date|time/i, category: 'Date/Time' },
    { pattern: /amount|total|gross|net/i, category: 'Amount' },
    { pattern: /fee/i, category: 'Fees' },
    { pattern: /refund/i, category: 'Refunds' },
    { pattern: /currency/i, category: 'Currency' },
    { pattern: /customer|card.*name/i, category: 'Customer Name' },
    { pattern: /email/i, category: 'Email' },
    { pattern: /card.*brand/i, category: 'Card Brand' },
    { pattern: /card.*last|last.*4|pan/i, category: 'Card Last 4' },
    { pattern: /status/i, category: 'Status' },
    { pattern: /description|details|notes/i, category: 'Description' },
    { pattern: /location|organisation|organization/i, category: 'Organisation' },
    { pattern: /metadata/i, category: 'Metadata' }
  ];

  console.log('\n🔍 Column Categories Analysis:\n');

  patterns.forEach(({ pattern, category }) => {
    const matchingColumns = new Map<string, string[]>();
    
    allColumns.forEach((fileSet, column) => {
      if (pattern.test(column)) {
        fileSet.forEach(file => {
          if (!matchingColumns.has(file)) {
            matchingColumns.set(file, []);
          }
          matchingColumns.get(file)!.push(column);
        });
      }
    });

    if (matchingColumns.size > 0) {
      console.log(`\n${category}:`);
      matchingColumns.forEach((columns, file) => {
        console.log(`  ${file}: ${columns.join(', ')}`);
      });
    }
  });

  // Find exact matches across files
  console.log('\n\n📊 Exact Column Matches Across Files:\n');
  allColumns.forEach((fileSet, column) => {
    if (fileSet.size > 1) {
      console.log(`"${column}" appears in:`);
      fileSet.forEach(file => console.log(`  - ${file}`));
      console.log('');
    }
  });

  // Find unique columns per file
  console.log('\n🔷 Unique Columns Per File:\n');
  const fileColumns = new Map<string, Set<string>>();
  
  allColumns.forEach((fileSet, column) => {
    fileSet.forEach(file => {
      if (!fileColumns.has(file)) {
        fileColumns.set(file, new Set());
      }
      fileColumns.get(file)!.add(column);
    });
  });

  fileColumns.forEach((columns, file) => {
    const uniqueColumns = Array.from(columns).filter(col => {
      const files = allColumns.get(col)!;
      return files.size === 1;
    });

    if (uniqueColumns.length > 0) {
      console.log(`\n${file} unique columns (${uniqueColumns.length}):`);
      uniqueColumns.forEach(col => console.log(`  - ${col}`));
    }
  });
}

async function main() {
  const csvFiles = [
    path.join(__dirname, '../Payments-Export/items-2025-01-01-2026-01-01.csv'),
    path.join(__dirname, '../Payments-Export/transactions-2025-01-01-2026-01-01.csv'),
    path.join(__dirname, '../Payments-Export/Stripe - Lodge Tickets Exports.csv'),
    path.join(__dirname, '../Payments-Export/Stripe - LodgeTix Darren Export.csv'),
    path.join(__dirname, '../Payments-Export/Stripe - LodgeTix Export.csv')
  ];

  console.log('🔍 Analyzing CSV Column Names...\n');

  const analyses: ColumnAnalysis[] = [];
  const allColumns = new Map<string, Set<string>>();

  // Analyze each file
  for (const file of csvFiles) {
    try {
      const analysis = await getCSVColumns(file);
      analyses.push(analysis);
      
      console.log(`\n📄 ${analysis.fileName}`);
      console.log(`Total columns: ${analysis.columns.length}`);
      
      // Add columns to the map
      analysis.columns.forEach(col => {
        if (!allColumns.has(col)) {
          allColumns.set(col, new Set());
        }
        allColumns.get(col)!.add(analysis.fileName);
      });
      
      // Show first 10 columns as preview
      console.log('Preview of columns:');
      analysis.columns.slice(0, 10).forEach(col => {
        const sampleValue = analysis.sampleData[col];
        const preview = sampleValue ? 
          (String(sampleValue).length > 30 ? 
            String(sampleValue).substring(0, 30) + '...' : 
            String(sampleValue)) : 
          '(empty)';
        console.log(`  - ${col}: "${preview}"`);
      });
      
      if (analysis.columns.length > 10) {
        console.log(`  ... and ${analysis.columns.length - 10} more columns`);
      }
    } catch (error) {
      console.error(`Error analyzing ${file}:`, error);
    }
  }

  // Find similar columns
  findSimilarColumns(allColumns);

  // Generate mapping suggestions
  console.log('\n\n🎯 Suggested Column Mappings:\n');
  console.log('Square → Stripe mappings:');
  console.log('  Transaction ID → id');
  console.log('  Payment ID → PaymentIntent ID');
  console.log('  Date + Time + Time Zone → Created date (UTC)');
  console.log('  Gross Sales → Amount');
  console.log('  Fees → Fee');
  console.log('  Customer Name → Card Name or Customer Description');
  console.log('  PAN Suffix → Card Last4');
  console.log('  Card Brand → Card Brand');
  console.log('  Transaction Status → Status');
  console.log('  Description/Details → Description');
}

main().catch(console.error);