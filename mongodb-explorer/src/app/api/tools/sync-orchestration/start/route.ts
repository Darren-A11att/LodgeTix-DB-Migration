import { NextRequest, NextResponse } from 'next/server';
import { connectMongoDB } from '@/connections/mongodb';
import { v4 as uuidv4 } from 'uuid';

interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  error?: string;
  details?: string;
}

interface WorkflowRun {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  steps: WorkflowStep[];
  autoMode: boolean;
  summary?: {
    paymentsImported: number;
    registrationsImported: number;
    matchesFound: number;
    pendingCreated: number;
    failedImports: number;
  };
}

// Store active workflows in memory (in production, use Redis or database)
const activeWorkflows = new Map<string, WorkflowRun>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { autoMode = false } = body;
    
    // Create new workflow run
    const workflowRun: WorkflowRun = {
      id: uuidv4(),
      startTime: new Date(),
      status: 'running',
      autoMode,
      steps: [
        { id: 'square-sync', name: 'Sync Square Payments', status: 'pending' },
        { id: 'stripe-sync', name: 'Sync Stripe Payments', status: 'pending' },
        { id: 'import-registrations', name: 'Import New Registrations', status: 'pending' },
        { id: 'process-pending', name: 'Process Pending Imports', status: 'pending' },
        { id: 'cleanup-failed', name: 'Cleanup Failed Imports', status: 'pending' },
        { id: 'generate-report', name: 'Generate Sync Report', status: 'pending' }
      ]
    };
    
    activeWorkflows.set(workflowRun.id, workflowRun);
    
    // Start the workflow in the background
    executeWorkflow(workflowRun.id, autoMode).catch(error => {
      console.error('Workflow execution error:', error);
      const run = activeWorkflows.get(workflowRun.id);
      if (run) {
        run.status = 'failed';
        run.endTime = new Date();
      }
    });
    
    return NextResponse.json({ run: workflowRun });
    
  } catch (error: any) {
    console.error('Start workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to start workflow', details: error.message },
      { status: 500 }
    );
  }
}

async function executeWorkflow(runId: string, autoMode: boolean) {
  const run = activeWorkflows.get(runId);
  if (!run) return;
  
  const connection = await connectMongoDB();
  const db = connection.db;
  
  const summary = {
    paymentsImported: 0,
    registrationsImported: 0,
    matchesFound: 0,
    pendingCreated: 0,
    failedImports: 0
  };
  
  try {
    // Step 1: Sync Square Payments
    await executeStep(run, 'square-sync', async () => {
      // Simulate Square sync (in real implementation, call Square API)
      const result = await syncSquarePayments(db);
      summary.paymentsImported += result.imported;
      return `Imported ${result.imported} new payments from Square`;
    });
    
    // Step 2: Sync Stripe Payments
    await executeStep(run, 'stripe-sync', async () => {
      // Simulate Stripe sync (in real implementation, call Stripe API)
      const result = await syncStripePayments(db);
      summary.paymentsImported += result.imported;
      return `Imported ${result.imported} new payments from Stripe`;
    });
    
    // Step 3: Import New Registrations
    await executeStep(run, 'import-registrations', async () => {
      const result = await importRegistrations(db, autoMode);
      summary.registrationsImported = result.imported;
      summary.matchesFound = result.matched;
      summary.pendingCreated = result.pending;
      return `Imported ${result.imported} registrations (${result.matched} matched, ${result.pending} pending)`;
    });
    
    // Step 4: Process Pending Imports
    await executeStep(run, 'process-pending', async () => {
      const result = await processPendingImports(db);
      summary.registrationsImported += result.resolved;
      return `Processed ${result.resolved} pending imports`;
    });
    
    // Step 5: Cleanup Failed Imports
    await executeStep(run, 'cleanup-failed', async () => {
      const result = await cleanupFailedImports(db);
      summary.failedImports = result.cleaned;
      return `Cleaned up ${result.cleaned} failed imports`;
    });
    
    // Step 6: Generate Report
    await executeStep(run, 'generate-report', async () => {
      await generateReport(db, summary);
      return 'Sync report generated successfully';
    });
    
    // Mark workflow as completed
    run.status = 'completed';
    run.endTime = new Date();
    run.summary = summary;
    
  } catch (error) {
    run.status = 'failed';
    run.endTime = new Date();
    throw error;
  }
}

async function executeStep(
  run: WorkflowRun, 
  stepId: string, 
  action: () => Promise<string>
): Promise<void> {
  const step = run.steps.find(s => s.id === stepId);
  if (!step) return;
  
  step.status = 'running';
  step.startTime = new Date();
  
  try {
    const details = await action();
    step.status = 'completed';
    step.details = details;
  } catch (error: any) {
    step.status = 'failed';
    step.error = error.message;
    throw error;
  } finally {
    step.endTime = new Date();
    step.duration = step.endTime.getTime() - step.startTime!.getTime();
  }
}

// Simulated sync functions (replace with actual implementations)
async function syncSquarePayments(db: any) {
  // In real implementation, fetch from Square API
  await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
  return { imported: Math.floor(Math.random() * 50) + 10 };
}

async function syncStripePayments(db: any) {
  // In real implementation, fetch from Stripe API
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
  return { imported: Math.floor(Math.random() * 30) + 5 };
}

async function importRegistrations(db: any, autoMode: boolean) {
  // In real implementation, process actual registrations
  await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate processing
  
  const total = Math.floor(Math.random() * 100) + 20;
  const matched = Math.floor(total * 0.7);
  const pending = total - matched;
  
  return {
    imported: matched,
    matched: matched,
    pending: pending
  };
}

async function processPendingImports(db: any) {
  // In real implementation, process actual pending imports
  await new Promise(resolve => setTimeout(resolve, 2500)); // Simulate processing
  
  const pendingCount = await db.collection('pending-imports').countDocuments();
  const resolved = Math.floor(pendingCount * 0.3);
  
  return { resolved };
}

async function cleanupFailedImports(db: any) {
  // In real implementation, cleanup old failed imports
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate cleanup
  
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 30);
  
  const result = await db.collection('failedRegistrations').deleteMany({
    failedAt: { $lt: oldDate }
  });
  
  return { cleaned: result.deletedCount || 0 };
}

async function generateReport(db: any, summary: any) {
  // In real implementation, generate and save report
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate report generation
  
  await db.collection('sync-reports').insertOne({
    generatedAt: new Date(),
    summary,
    type: 'workflow-run'
  });
}

// Export for status checking
export { activeWorkflows };