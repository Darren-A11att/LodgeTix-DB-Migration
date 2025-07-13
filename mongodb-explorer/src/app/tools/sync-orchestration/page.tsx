'use client';

import { useState, useEffect } from 'react';
import BackButton from '@/components/BackButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
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
  summary?: {
    paymentsImported: number;
    registrationsImported: number;
    matchesFound: number;
    pendingCreated: number;
    failedImports: number;
  };
}

export default function SyncOrchestrationPage() {
  const [running, setRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<WorkflowRun | null>(null);
  const [recentRuns, setRecentRuns] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [autoMode, setAutoMode] = useState(false);

  const workflowSteps = [
    { id: 'square-sync', name: 'Sync Square Payments' },
    { id: 'stripe-sync', name: 'Sync Stripe Payments' },
    { id: 'import-registrations', name: 'Import New Registrations' },
    { id: 'process-pending', name: 'Process Pending Imports' },
    { id: 'cleanup-failed', name: 'Cleanup Failed Imports' },
    { id: 'generate-report', name: 'Generate Sync Report' }
  ];

  useEffect(() => {
    // Poll for updates while running
    if (running && currentRun) {
      const interval = setInterval(() => {
        checkWorkflowStatus(currentRun.id);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [running, currentRun]);

  const startWorkflow = async () => {
    setRunning(true);
    try {
      const response = await fetch('/api/tools/sync-orchestration/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoMode })
      });
      
      const data = await response.json();
      setCurrentRun(data.run);
      
      // Start polling for updates
      checkWorkflowStatus(data.run.id);
    } catch (error) {
      console.error('Failed to start workflow:', error);
      setRunning(false);
    }
  };

  const checkWorkflowStatus = async (runId: string) => {
    try {
      const response = await fetch(`/api/tools/sync-orchestration/status/${runId}`);
      const data = await response.json();
      
      setCurrentRun(data.run);
      
      if (data.run.status !== 'running') {
        setRunning(false);
        // Add to recent runs
        setRecentRuns(prev => [data.run, ...prev.slice(0, 9)]);
      }
    } catch (error) {
      console.error('Failed to check workflow status:', error);
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'running':
        return (
          <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'skipped':
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
          </svg>
        );
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold">Data Sync Orchestration</h1>
          <p className="text-gray-600 mt-1">Automated workflow for syncing payments and registrations</p>
        </div>
      </div>

      {/* Control Panel */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Workflow Control</CardTitle>
          <CardDescription>
            Run the complete sync workflow or monitor ongoing processes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                size="lg"
                onClick={startWorkflow}
                disabled={running}
                className="min-w-[140px]"
              >
                {running ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Running...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Workflow
                  </>
                )}
              </Button>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoMode}
                  onChange={(e) => setAutoMode(e.target.checked)}
                  disabled={running}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Auto-approve matches</span>
              </label>
            </div>
            
            {running && currentRun && (
              <div className="text-sm text-gray-600">
                Started {new Date(currentRun.startTime).toLocaleTimeString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Run Progress */}
      {currentRun && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Current Workflow Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workflowSteps.map((step, index) => {
                const runStep = currentRun.steps.find(s => s.id === step.id) || {
                  id: step.id,
                  name: step.name,
                  status: 'pending' as const
                };
                
                return (
                  <div key={step.id} className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {getStepIcon(runStep.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{step.name}</h4>
                        <div className="flex items-center gap-2">
                          {runStep.duration && (
                            <span className="text-sm text-gray-500">
                              {formatDuration(runStep.duration)}
                            </span>
                          )}
                          <Badge
                            variant={
                              runStep.status === 'completed' ? 'default' :
                              runStep.status === 'running' ? 'secondary' :
                              runStep.status === 'failed' ? 'destructive' :
                              'outline'
                            }
                          >
                            {runStep.status}
                          </Badge>
                        </div>
                      </div>
                      {runStep.details && (
                        <p className="text-sm text-gray-600 mt-1">{runStep.details}</p>
                      )}
                      {runStep.error && (
                        <p className="text-sm text-red-600 mt-1">{runStep.error}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {currentRun.summary && currentRun.status === 'completed' && (
              <Alert className="mt-6">
                <AlertTitle>Workflow Completed</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1">
                    <div>✅ Payments imported: {currentRun.summary.paymentsImported}</div>
                    <div>✅ Registrations imported: {currentRun.summary.registrationsImported}</div>
                    <div>🔍 Matches found: {currentRun.summary.matchesFound}</div>
                    <div>⏳ Pending created: {currentRun.summary.pendingCreated}</div>
                    {currentRun.summary.failedImports > 0 && (
                      <div>❌ Failed imports: {currentRun.summary.failedImports}</div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Workflow Runs</CardTitle>
          <CardDescription>
            View details and results from previous sync operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recent workflow runs
            </div>
          ) : (
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedRun(run)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">
                          {new Date(run.startTime).toLocaleString()}
                        </span>
                        <Badge
                          variant={run.status === 'completed' ? 'default' : 'destructive'}
                        >
                          {run.status}
                        </Badge>
                      </div>
                      {run.summary && (
                        <div className="text-sm text-gray-600 mt-1">
                          {run.summary.paymentsImported} payments, {run.summary.registrationsImported} registrations imported
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      Duration: {formatDuration(
                        run.endTime ? new Date(run.endTime).getTime() - new Date(run.startTime).getTime() : 0
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run Details Modal */}
      {selectedRun && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold">Workflow Run Details</h2>
                <button
                  onClick={() => setSelectedRun(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Run Information</h3>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Start Time</dt>
                      <dd>{new Date(selectedRun.startTime).toLocaleString()}</dd>
                    </div>
                    {selectedRun.endTime && (
                      <div>
                        <dt className="text-gray-500">End Time</dt>
                        <dd>{new Date(selectedRun.endTime).toLocaleString()}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-gray-500">Status</dt>
                      <dd>
                        <Badge
                          variant={selectedRun.status === 'completed' ? 'default' : 'destructive'}
                        >
                          {selectedRun.status}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Duration</dt>
                      <dd>
                        {formatDuration(
                          selectedRun.endTime 
                            ? new Date(selectedRun.endTime).getTime() - new Date(selectedRun.startTime).getTime()
                            : 0
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Workflow Steps</h3>
                  <div className="space-y-2">
                    {selectedRun.steps.map((step) => (
                      <div key={step.id} className="border rounded p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStepIcon(step.status)}
                            <span className="font-medium">{step.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {step.duration && (
                              <span className="text-sm text-gray-500">
                                {formatDuration(step.duration)}
                              </span>
                            )}
                            <Badge
                              variant={
                                step.status === 'completed' ? 'default' :
                                step.status === 'failed' ? 'destructive' :
                                'outline'
                              }
                            >
                              {step.status}
                            </Badge>
                          </div>
                        </div>
                        {step.details && (
                          <p className="text-sm text-gray-600 mt-1">{step.details}</p>
                        )}
                        {step.error && (
                          <p className="text-sm text-red-600 mt-1">{step.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedRun.summary && (
                  <div>
                    <h3 className="font-semibold mb-2">Summary</h3>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-gray-500">Payments Imported</dt>
                        <dd className="font-medium">{selectedRun.summary.paymentsImported}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Registrations Imported</dt>
                        <dd className="font-medium">{selectedRun.summary.registrationsImported}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Matches Found</dt>
                        <dd className="font-medium">{selectedRun.summary.matchesFound}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Pending Created</dt>
                        <dd className="font-medium">{selectedRun.summary.pendingCreated}</dd>
                      </div>
                      {selectedRun.summary.failedImports > 0 && (
                        <div>
                          <dt className="text-gray-500">Failed Imports</dt>
                          <dd className="font-medium text-red-600">{selectedRun.summary.failedImports}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  variant="outline"
                  onClick={() => setSelectedRun(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}