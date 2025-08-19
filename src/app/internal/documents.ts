import type { Db } from 'mongodb';
import DocumentFactory from '@/app/documents/DocumentFactory';
import DocumentOrchestrator from '@/app/documents/DocumentOrchestrator';
import type { DistributionActions } from '@/app/documents/DocumentTypes';

export async function generateDocument(
  db: Db,
  type: Parameters<typeof DocumentFactory.get>[0],
  input: any,
  preferredEngine: 'puppeteer' | 'pdfkit' = 'puppeteer'
): Promise<{ filename: string; pdfBuffer: Buffer; data: any; }> {
  const doc = DocumentFactory.get(type as any);
  const orchestrator = new DocumentOrchestrator(doc, { db });
  return orchestrator.render(input, preferredEngine);
}

export async function generateAndDistributeDocument(
  db: Db,
  type: Parameters<typeof DocumentFactory.get>[0],
  input: any,
  actions: DistributionActions,
  preferredEngine: 'puppeteer' | 'pdfkit' = 'puppeteer'
): Promise<{ data: any; result: any; }> {
  const doc = DocumentFactory.get(type as any);
  const orchestrator = new DocumentOrchestrator(doc, { db });
  return orchestrator.renderAndDistribute(input, actions, preferredEngine);
}

